// previewService：负责本地项目预览进程的启动与状态维护。
// 注意：这里只适用于本机开发场景，不建议直接暴露到公网环境。
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn, spawnSync } = require('node:child_process')

// key: 项目绝对路径；value: 预览进程与状态信息。
const previewProcessMap = new Map()

// 默认从 5173 开始分配预览端口，若占用则自动递增。
let latestPort = 5173

// 端口就绪检测超时（毫秒）：避免接口“秒返回成功”，但实际预览尚未可访问。
const PREVIEW_READY_TIMEOUT_MS = 20000

// 每次轮询端口间隔（毫秒）。
const PREVIEW_READY_POLL_INTERVAL_MS = 250

// 检测到父进程退出后，仍给短暂窗口继续探测端口，避免“父进程结束但服务已启动”误判。
const PROCESS_EXIT_GRACE_MS = 3000

// 记录启动日志尾部，启动失败时返回给前端辅助定位问题。
const STARTUP_LOG_TAIL_SIZE = 30

// 心跳监测超时（毫秒）：用于“新标签预览”场景的自动回收。
const PREVIEW_HEARTBEAT_TIMEOUT_MS = 60000

// 心跳巡检间隔（毫秒）。
const PREVIEW_HEARTBEAT_SWEEP_INTERVAL_MS = 5000

let heartbeatSweepTimer = null

/**
 * 读取 JSON 文件（不存在时返回 null）。
 * @param {string} filePath
 * @returns {any|null}
 */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 判断目录是否存在 node_modules。
 * @param {string} projectPath
 */
function hasInstalledDependencies(projectPath) {
  const nodeModulesPath = path.join(projectPath, 'node_modules')
  return fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isDirectory()
}

/**
 * 解析项目路径：
 * 1) 优先使用显式传入的 projectPath
 * 2) 其次按项目名在已知工作区内推断
 * @param {{ projectName?: string, projectPath?: string }} params
 */
function resolveProjectPath(params) {
  const explicitPath = String(params.projectPath || '').trim()
  if (explicitPath) {
    const resolved = path.resolve(explicitPath)
    if (!fs.existsSync(resolved)) {
      throw new Error('projectPath 指向的目录不存在')
    }
    if (!fs.statSync(resolved).isDirectory()) {
      throw new Error('projectPath 必须是目录')
    }
    return resolved
  }

  const projectName = String(params.projectName || '').trim()
  if (!projectName) {
    throw new Error('projectName 不能为空')
  }

  // service/src/services -> 项目根目录
  const repoRoot = path.resolve(__dirname, '../../..')
  const workspaceRoot = path.dirname(repoRoot)

  const candidates = [
    path.join(repoRoot, projectName),
    path.join(workspaceRoot, projectName),
    // 若选中的就是当前 low-code 项目本身，允许直接命中仓库根目录。
    path.basename(repoRoot) === projectName ? repoRoot : ''
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue
    }
    if (!fs.statSync(candidate).isDirectory()) {
      continue
    }

    // 以 package.json 作为 Node 项目标识。
    const packageJsonPath = path.join(candidate, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      return candidate
    }
  }

  throw new Error(
    `无法根据项目名定位目录：${projectName}。可在请求中传 projectPath 指定绝对路径。`
  )
}

/**
 * 根据锁文件推断包管理器。
 * @param {string} projectPath
 */
function detectPackageManager(projectPath) {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn'
  }
  return 'npm'
}

/**
 * 选择可用端口（简单递增策略）。
 * @returns {number}
 */
function allocatePort() {
  latestPort += 1
  return latestPort
}

/**
 * 判断进程是否仍在运行。
 * @param {import('node:child_process').ChildProcess | undefined} processRef
 */
function isProcessAlive(processRef) {
  return !!processRef && processRef.exitCode === null && !processRef.killed
}

/**
 * 延时工具函数。
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 保留日志尾部，避免日志无限增长造成内存压力。
 * @param {string[]} lines
 * @param {string} text
 */
function pushLogTail(lines, text) {
  const nextLines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!nextLines.length) {
    return
  }

  lines.push(...nextLines)
  if (lines.length > STARTUP_LOG_TAIL_SIZE) {
    lines.splice(0, lines.length - STARTUP_LOG_TAIL_SIZE)
  }
}

function clearHeartbeatSweepLoopIfIdle() {
  if (previewProcessMap.size > 0) {
    return
  }
  if (!heartbeatSweepTimer) {
    return
  }
  clearInterval(heartbeatSweepTimer)
  heartbeatSweepTimer = null
}

function ensureHeartbeatSweepLoop() {
  if (heartbeatSweepTimer) {
    return
  }

  heartbeatSweepTimer = setInterval(() => {
    const now = Date.now()

    for (const [projectPath, processInfo] of previewProcessMap.entries()) {
      if (!isProcessAlive(processInfo.processRef)) {
        previewProcessMap.delete(projectPath)
        continue
      }

      // 仅对启用心跳监控的会话执行超时自动回收，避免影响普通 overlay 场景。
      if (!processInfo.heartbeatEnabled) {
        continue
      }

      const lastHeartbeatAt = Number(processInfo.lastHeartbeatAt || 0)
      if (!lastHeartbeatAt) {
        continue
      }

      if (now - lastHeartbeatAt <= PREVIEW_HEARTBEAT_TIMEOUT_MS) {
        continue
      }

      terminatePreviewProcess(processInfo.processRef)
      previewProcessMap.delete(projectPath)
    }

    clearHeartbeatSweepLoopIfIdle()
  }, PREVIEW_HEARTBEAT_SWEEP_INTERVAL_MS)

  // 不阻塞 Node 进程退出。
  heartbeatSweepTimer.unref?.()
}

/**
 * 去除 ANSI 控制字符，便于日志解析端口。
 * @param {string} text
 */
function stripAnsi(text) {
  return String(text || '').replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m/g,
    ''
  )
}

/**
 * 从日志中提取可能的预览端口（例如 http://localhost:8001）。
 * @param {string} text
 */
function collectCandidatePortsFromText(text) {
  const normalized = stripAnsi(text)
  const result = new Set()
  const regExp = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/g
  let match = regExp.exec(normalized)

  while (match) {
    const port = Number(match[1])
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      result.add(port)
    }
    match = regExp.exec(normalized)
  }

  return result
}

/**
 * 检测 host:port 是否可连接（仅做 TCP 层可达性判断）。
 * @param {string} host
 * @param {number} port
 */
function isHostPortReachable(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host,
      port
    })

    let settled = false
    const finish = (result) => {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}

/**
 * 检测端口是否可连接。
 * 同时探测 IPv4/IPv6/localhost，兼容仅绑定 localhost 或 IPv6 的场景。
 * @param {number} port
 */
async function isPortReachable(port) {
  const hostCandidates = ['127.0.0.1', '::1', 'localhost']

  for (const host of hostCandidates) {
    // eslint-disable-next-line no-await-in-loop
    const reachable = await isHostPortReachable(host, port)
    if (reachable) {
      return true
    }
  }

  return false
}

/**
 * 等待预览服务可连接；进程提前退出时立即结束等待。
 * @param {{
 *  processRef: import('node:child_process').ChildProcess,
 *  candidatePorts: Set<number>
 * }} params
 */
async function waitUntilPreviewReady(params) {
  const { processRef, candidatePorts } = params
  const startedAt = Date.now()
  let processExitDetectedAt = 0

  while (Date.now() - startedAt < PREVIEW_READY_TIMEOUT_MS) {
    for (const port of candidatePorts.values()) {
      // eslint-disable-next-line no-await-in-loop
      const reachable = await isPortReachable(port)
      if (reachable) {
        return port
      }
    }

    // 某些 Windows/npm 场景中，父进程可能提前退出，但真正服务进程还在启动中。
    // 这里给短暂宽限，避免出现“日志已 ready 但仍报超时/退出”的误判。
    if (!isProcessAlive(processRef)) {
      if (!processExitDetectedAt) {
        processExitDetectedAt = Date.now()
      }
      if (Date.now() - processExitDetectedAt > PROCESS_EXIT_GRACE_MS) {
        return 0
      }
    } else {
      processExitDetectedAt = 0
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(PREVIEW_READY_POLL_INTERVAL_MS)
  }

  return 0
}

/**
 * 终止预览进程。
 * Windows 场景需要结束进程树，否则 shell 子进程可能残留。
 * @param {import('node:child_process').ChildProcess | undefined} processRef
 */
function terminatePreviewProcess(processRef) {
  if (!processRef || !processRef.pid) {
    return
  }

  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(processRef.pid), '/T', '/F'], {
        stdio: 'ignore'
      })
      return
    }

    processRef.kill('SIGTERM')
  } catch {
    // ignore
  }
}

/**
 * 构建可直接用于 spawn 的命令与参数。
 * Windows 下通过 cmd.exe /c 执行，避免直接 spawn *.cmd 触发 EINVAL。
 * @param {string} command
 * @param {string[]} args
 */
function buildSpawnCommand(command, args) {
  if (process.platform === 'win32') {
    return {
      spawnCommand: 'cmd.exe',
      spawnArgs: ['/d', '/s', '/c', command, ...args]
    }
  }

  return {
    spawnCommand: command,
    spawnArgs: args
  }
}

/**
 * 构建启动命令（优先 dev，其次 start）。
 * @param {string} packageManager
 * @param {Record<string, string>} scripts
 * @param {number} port
 */
function buildStartCommand(packageManager, scripts, port) {
  const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : ''
  if (!scriptName) {
    throw new Error('package.json 中缺少 dev/start 脚本，无法启动预览')
  }

  const isDevScript = scriptName === 'dev'
  const npmPortArgList = isDevScript ? ['--', '--host', '0.0.0.0', '--port', String(port)] : []
  const directPortArgList = isDevScript ? ['--host', '0.0.0.0', '--port', String(port)] : []

  if (packageManager === 'pnpm') {
    return {
      command: 'pnpm',
      // pnpm run 在部分版本下会将分隔符 "--" 原样透传给脚本，故直接传入参数列表。
      args: ['run', scriptName, ...directPortArgList],
      displayCommand: `pnpm run ${scriptName}${directPortArgList.length ? ` ${directPortArgList.join(' ')}` : ''}`
    }
  }

  if (packageManager === 'yarn') {
    return {
      command: 'yarn',
      args: [scriptName, ...(scriptName === 'dev' ? ['--host', '0.0.0.0', '--port', String(port)] : [])],
      displayCommand:
        scriptName === 'dev'
          ? `yarn ${scriptName} --host 0.0.0.0 --port ${port}`
          : `yarn ${scriptName}`
    }
  }

  return {
    command: 'npm',
    args: ['run', scriptName, ...npmPortArgList],
    displayCommand: `npm run ${scriptName}${npmPortArgList.length ? ` ${npmPortArgList.join(' ')}` : ''}`
  }
}

/**
 * 获取项目预览状态。
 * @param {{ projectName?: string, projectPath?: string }} params
 */
function getPreviewStatus(params) {
  const projectPath = resolveProjectPath(params)
  const processInfo = previewProcessMap.get(projectPath)
  const dependenciesInstalled = hasInstalledDependencies(projectPath)

  if (!processInfo || !isProcessAlive(processInfo.processRef)) {
    return {
      projectPath,
      dependenciesInstalled,
      running: false,
      previewUrl: '',
      command: ''
    }
  }

  return {
    projectPath,
    dependenciesInstalled,
    running: true,
    previewUrl: processInfo.previewUrl,
    command: processInfo.command,
    heartbeatEnabled: Boolean(processInfo.heartbeatEnabled),
    lastHeartbeatAt: Number(processInfo.lastHeartbeatAt || 0),
    heartbeatTimeoutMs: PREVIEW_HEARTBEAT_TIMEOUT_MS
  }
}

/**
 * 启动项目预览进程。
 * @param {{ projectName?: string, projectPath?: string, port?: number }} params
 */
async function startPreview(params) {
  const projectPath = resolveProjectPath(params)
  const dependenciesInstalled = hasInstalledDependencies(projectPath)

  if (!dependenciesInstalled) {
    throw new Error('未检测到 node_modules，请先安装依赖后再启动预览')
  }

  const existing = previewProcessMap.get(projectPath)
  if (existing && isProcessAlive(existing.processRef)) {
    return {
      projectPath,
      previewUrl: existing.previewUrl,
      command: existing.command,
      heartbeatEnabled: Boolean(existing.heartbeatEnabled),
      lastHeartbeatAt: Number(existing.lastHeartbeatAt || 0),
      reused: true
    }
  }

  const packageJson = readJsonFile(path.join(projectPath, 'package.json')) || {}
  const scripts = packageJson.scripts || {}
  const packageManager = detectPackageManager(projectPath)
  const preferredPort = Number(params.port) || allocatePort()
  const { command, args, displayCommand } = buildStartCommand(packageManager, scripts, preferredPort)
  const { spawnCommand, spawnArgs } = buildSpawnCommand(command, args)
  const candidatePorts = new Set([preferredPort])

  const processRef = spawn(spawnCommand, spawnArgs, {
    cwd: projectPath,
    shell: false,
    env: {
      ...process.env,
      FORCE_COLOR: '1'
    },
    windowsHide: true
  })

  const previewUrl = `http://localhost:${preferredPort}`
  const startupLogTail = []

  previewProcessMap.set(projectPath, {
    processRef,
    previewUrl,
    command: displayCommand,
    heartbeatEnabled: false,
    lastHeartbeatAt: 0
  })

  ensureHeartbeatSweepLoop()

  processRef.stdout?.on('data', (chunk) => {
    const text = String(chunk)
    pushLogTail(startupLogTail, text)
    for (const port of collectCandidatePortsFromText(text).values()) {
      candidatePorts.add(port)
    }
  })
  processRef.stderr?.on('data', (chunk) => {
    const text = String(chunk)
    pushLogTail(startupLogTail, text)
    for (const port of collectCandidatePortsFromText(text).values()) {
      candidatePorts.add(port)
    }
  })

  const cleanup = () => {
    const cached = previewProcessMap.get(projectPath)
    if (!cached || cached.processRef !== processRef) {
      return
    }
    previewProcessMap.delete(projectPath)
    clearHeartbeatSweepLoopIfIdle()
  }

  processRef.on('exit', cleanup)
  processRef.on('error', cleanup)

  const readyPort = await waitUntilPreviewReady({
    processRef,
    candidatePorts
  })

  if (!readyPort) {
    cleanup()
    terminatePreviewProcess(processRef)

    const detail = startupLogTail.length ? `；日志：${startupLogTail.join(' | ')}` : ''
    throw new Error(`预览启动超时或进程提前退出（${displayCommand}）${detail}`)
  }

  const readyUrl = `http://localhost:${readyPort}`
  const runningInfo = previewProcessMap.get(projectPath)
  if (runningInfo && runningInfo.processRef === processRef) {
    runningInfo.previewUrl = readyUrl
  }

  return {
    projectPath,
    previewUrl: readyUrl,
    command: displayCommand,
    heartbeatEnabled: false,
    lastHeartbeatAt: 0,
    reused: false
  }
}

/**
 * 预览心跳上报：用于新标签预览的会话保活。
 * @param {{ projectName?: string, projectPath?: string, source?: string }} params
 */
function refreshPreviewHeartbeat(params) {
  const projectPath = resolveProjectPath(params)
  const processInfo = previewProcessMap.get(projectPath)

  if (!processInfo || !isProcessAlive(processInfo.processRef)) {
    return {
      projectPath,
      running: false,
      accepted: false
    }
  }

  processInfo.heartbeatEnabled = true
  processInfo.lastHeartbeatAt = Date.now()
  processInfo.lastHeartbeatSource = String(params.source || 'unknown')

  return {
    projectPath,
    running: true,
    accepted: true,
    lastHeartbeatAt: processInfo.lastHeartbeatAt,
    heartbeatTimeoutMs: PREVIEW_HEARTBEAT_TIMEOUT_MS
  }
}

/**
 * 停止某个项目预览进程。
 * @param {{ projectName?: string, projectPath?: string }} params
 */
function stopPreview(params) {
  const projectPath = resolveProjectPath(params)
  const processInfo = previewProcessMap.get(projectPath)

  if (!processInfo) {
    return {
      projectPath,
      stopped: false
    }
  }

  terminatePreviewProcess(processInfo.processRef)
  previewProcessMap.delete(projectPath)
  clearHeartbeatSweepLoopIfIdle()

  return {
    projectPath,
    stopped: true
  }
}

/**
 * 停止全部项目预览进程。
 */
function stopAllPreviews() {
  let stoppedCount = 0

  for (const [, processInfo] of previewProcessMap.entries()) {
    terminatePreviewProcess(processInfo.processRef)
    stoppedCount += 1
  }

  previewProcessMap.clear()
  clearHeartbeatSweepLoopIfIdle()

  return {
    stoppedCount
  }
}

module.exports = {
  startPreview,
  refreshPreviewHeartbeat,
  getPreviewStatus,
  stopPreview,
  stopAllPreviews
}
