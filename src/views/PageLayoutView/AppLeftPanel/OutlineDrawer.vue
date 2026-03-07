<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import ProjectTreeNode from '@/views/PageLayoutView/AppLeftPanel/ProjectTreeNode.vue'
import { projectTreeScanConfig } from '@/views/PageLayoutView/AppLeftPanel/project-tree.config'
import type {
  CreateFileInDirectoryFn,
  DeleteUnsavedFileNodeFn,
  ProjectNode,
  LoadDirectoryFn,
  SelectFileNodeFn
} from '@/views/PageLayoutView/AppLeftPanel/project-tree.types'
import {
  defaultProjectPreviewState,
  type ProjectPreviewState
} from '@/views/PageLayoutView/project-preview.types'

type PickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

type PreviewControlAction = 'start' | 'stop'

interface PreviewControlEventDetail {
  action: PreviewControlAction
}

const emit = defineEmits<{
  (e: 'file-select', fileNode: ProjectNode | null): void
  (e: 'project-preview-change', previewState: ProjectPreviewState): void
}>()

// 从配置文件读取目录扫描参数。
const IGNORED_DIRECTORY_NAMES = new Set(projectTreeScanConfig.ignoredDirectoryNames)
const MAX_DEPTH = projectTreeScanConfig.maxDepth
const MAX_TOTAL_NODES = projectTreeScanConfig.maxTotalNodes
const MAX_CHILDREN_PER_DIRECTORY = projectTreeScanConfig.maxChildrenPerDirectory

const currentProjectName = ref('')
const projectTree = ref<ProjectNode | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const loadingMessage = ref('')
const scanSummary = ref('')
const activeFilePath = ref('')
const selectedProjectHandle = ref<FileSystemDirectoryHandle | null>(null)
const previewStarting = ref(false)
const installCommandTip = ref('pnpm install')
const projectAbsolutePath = ref('')
const projectPreviewState = ref<ProjectPreviewState>({
  ...defaultProjectPreviewState
})

// 已加载节点计数（懒加载模式下会随着展开逐步增加）。
const loadedNodeCount = ref(0)

const pickerSupported =
  typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function'

const PROJECT_PATH_STORAGE_KEY = 'low-code.project-path-map.v1'
const LOW_CODE_DSL_SIDECAR_SUFFIX = '.lowcode.dsl.json'
const LOW_CODE_DSL_MARKER = '<lowcode-dsl>'
const LOW_CODE_SCRIPT_MARKER = '@low-code-generated'

function toLowCodeDslSidecarName(fileName: string) {
  if (/\.vue$/i.test(fileName)) {
    return fileName.replace(/\.vue$/i, LOW_CODE_DSL_SIDECAR_SUFFIX)
  }
  return `${fileName}${LOW_CODE_DSL_SIDECAR_SUFFIX}`
}

function emitProjectPreviewChange() {
  emit('project-preview-change', {
    ...projectPreviewState.value
  })
}

function updateProjectPreviewState(nextState: Partial<ProjectPreviewState>) {
  projectPreviewState.value = {
    ...projectPreviewState.value,
    ...nextState
  }
  emitProjectPreviewChange()
}

function readProjectPathMap() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>
  }

  const raw = window.localStorage.getItem(PROJECT_PATH_STORAGE_KEY)
  if (!raw) {
    return {} as Record<string, string>
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {} as Record<string, string>
    }
    return parsed as Record<string, string>
  } catch {
    return {} as Record<string, string>
  }
}

function writeProjectPathMap(pathMap: Record<string, string>) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(PROJECT_PATH_STORAGE_KEY, JSON.stringify(pathMap))
}

function getStoredProjectPath(projectName: string) {
  const map = readProjectPathMap()
  return String(map[projectName] || '').trim()
}

function saveCurrentProjectPath() {
  const projectName = currentProjectName.value.trim()
  const absolutePath = projectAbsolutePath.value.trim()
  if (!projectName || !absolutePath) {
    return
  }

  const pathMap = readProjectPathMap()
  pathMap[projectName] = absolutePath
  writeProjectPathMap(pathMap)
}

async function stopPreviewByProject(projectName: string, absolutePath = '') {
  const trimmedName = projectName.trim()
  if (!trimmedName) {
    return
  }

  try {
    await fetch('/api/project/v1/preview/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectName: trimmedName,
        projectPath: absolutePath.trim() || undefined
      })
    })
  } catch {
    // 停止失败不阻断主流程；后端会在进程退出时兜底清理。
  }
}

function stopAllPreviewsWhenWindowClosing() {
  const endpoint = '/api/project/v1/preview/stop-all'
  const payloadText = JSON.stringify({})

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const payload = new Blob([payloadText], {
      type: 'application/json'
    })
    const accepted = navigator.sendBeacon(endpoint, payload)
    if (accepted) {
      return
    }
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: payloadText,
    keepalive: true
  })
}

function onWindowClosing() {
  stopAllPreviewsWhenWindowClosing()
}

async function safeParseApiJson(response: Response) {
  const rawText = await response.text()
  if (!rawText) {
    return {
      data: null,
      rawText: ''
    }
  }

  try {
    return {
      data: JSON.parse(rawText),
      rawText
    }
  } catch {
    return {
      data: null,
      rawText
    }
  }
}

async function syncPreviewStatusFromBackend(projectName: string) {
  const params = new URLSearchParams()
  params.set('projectName', projectName)

  const trimmedPath = projectAbsolutePath.value.trim()
  if (trimmedPath) {
    params.set('projectPath', trimmedPath)
  }

  const response = await fetch(`/api/project/v1/preview/status?${params.toString()}`)
  const { data: result, rawText } = await safeParseApiJson(response)

  if (!result || typeof result !== 'object') {
    if (!response.ok) {
      throw new Error(`获取项目状态失败（HTTP ${response.status}）`)
    }
    throw new Error(rawText || '获取项目状态失败：后端返回空响应')
  }

  if (!response.ok || !result?.state) {
    throw new Error(result?.message || result?.title || `获取项目状态失败（HTTP ${response.status}）`)
  }

  const backendProjectPath = String(result?.data?.projectPath || '').trim()
  if (backendProjectPath) {
    projectAbsolutePath.value = backendProjectPath
    saveCurrentProjectPath()
  }

  return {
    dependenciesInstalled: Boolean(result?.data?.dependenciesInstalled),
    running: Boolean(result?.data?.running),
    previewUrl: String(result?.data?.previewUrl || '').trim()
  }
}

async function hasFileByName(directoryHandle: FileSystemDirectoryHandle, fileName: string) {
  try {
    await directoryHandle.getFileHandle(fileName)
    return true
  } catch {
    return false
  }
}

async function hasNodeModules(directoryHandle: FileSystemDirectoryHandle) {
  try {
    await directoryHandle.getDirectoryHandle('node_modules')
    return true
  } catch {
    return false
  }
}

async function detectInstallCommand(directoryHandle: FileSystemDirectoryHandle) {
  if (await hasFileByName(directoryHandle, 'pnpm-lock.yaml')) {
    return 'pnpm install'
  }
  if (await hasFileByName(directoryHandle, 'yarn.lock')) {
    return 'yarn install'
  }
  if (await hasFileByName(directoryHandle, 'package-lock.json')) {
    return 'npm install'
  }
  return 'pnpm install'
}

async function startProjectPreview() {
  if (!currentProjectName.value) {
    return
  }

  previewStarting.value = true
  updateProjectPreviewState({
    status: 'starting',
    message: '正在启动项目预览，请稍候...',
    previewUrl: ''
  })

  try {
    const absolutePath = projectAbsolutePath.value.trim()

    const response = await fetch('/api/project/v1/preview/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectName: currentProjectName.value,
        projectPath: absolutePath || undefined
      })
    })

    const { data: result, rawText } = await safeParseApiJson(response)
    if (!result || typeof result !== 'object') {
      if (!response.ok) {
        throw new Error(`启动失败（HTTP ${response.status}）`)
      }
      throw new Error(rawText || '启动失败：后端返回空响应')
    }

    if (!response.ok || !result?.state) {
      throw new Error(result?.message || result?.title || `启动失败（HTTP ${response.status}）`)
    }

    const previewUrl = String(result?.data?.previewUrl || '').trim()
    const backendProjectPath = String(result?.data?.projectPath || '').trim()
    if (backendProjectPath) {
      projectAbsolutePath.value = backendProjectPath
      saveCurrentProjectPath()
    }

    updateProjectPreviewState({
      projectPath: projectAbsolutePath.value.trim(),
      status: 'running',
      message: previewUrl
        ? `项目已启动：${previewUrl}（可在画布中拖拽调整样式）`
        : '项目已启动，可在画布中查看预览',
      previewUrl
    })
  } catch (error: any) {
    updateProjectPreviewState({
      status: 'error',
      message: error?.message || '启动项目预览失败',
      previewUrl: ''
    })
  } finally {
    previewStarting.value = false
  }
}

async function stopCurrentProjectPreview() {
  if (!currentProjectName.value) {
    return
  }

  const absolutePath = projectAbsolutePath.value.trim()
  const dependenciesInstalled = projectPreviewState.value.dependenciesInstalled

  try {
    const response = await fetch('/api/project/v1/preview/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectName: currentProjectName.value,
        projectPath: absolutePath || undefined
      })
    })
    const { data: result, rawText } = await safeParseApiJson(response)

    if (!result || typeof result !== 'object') {
      if (!response.ok) {
        throw new Error(`关闭预览失败（HTTP ${response.status}）`)
      }
      throw new Error(rawText || '关闭预览失败：后端返回空响应')
    }

    if (!response.ok || !result?.state) {
      throw new Error(result?.message || result?.title || `关闭预览失败（HTTP ${response.status}）`)
    }

    updateProjectPreviewState({
      projectPath: projectAbsolutePath.value.trim(),
      status: dependenciesInstalled ? 'idle' : 'needs-install',
      message: dependenciesInstalled
        ? '预览已关闭，可点击右上角“预览”重新启动'
        : `未检测到 node_modules，请先在项目根目录执行：${installCommandTip.value}`,
      previewUrl: ''
    })
  } catch (error: any) {
    updateProjectPreviewState({
      status: 'error',
      message: error?.message || '关闭预览失败',
      previewUrl: ''
    })
  }
}

async function manualStartPreview() {
  if (!selectedProjectHandle.value) {
    updateProjectPreviewState({
      status: 'idle',
      message: '请先在左侧选择项目文件夹'
    })
    return
  }

  saveCurrentProjectPath()

  const dependenciesInstalled = await hasNodeModules(selectedProjectHandle.value)
  if (!dependenciesInstalled) {
    updateProjectPreviewState({
      dependenciesInstalled: false,
      status: 'needs-install',
      message: `未检测到 node_modules，请先在项目根目录执行：${installCommandTip.value}`
    })
    return
  }

  updateProjectPreviewState({
    dependenciesInstalled: true
  })
  await startProjectPreview()
}

function onPreviewControlEvent(event: Event) {
  const detail = (event as CustomEvent<PreviewControlEventDetail>).detail
  if (!detail || typeof detail !== 'object') {
    return
  }

  if (detail.action === 'start') {
    void manualStartPreview()
    return
  }

  if (detail.action === 'stop') {
    void stopCurrentProjectPreview()
  }
}

function sortNodes(nodes: ProjectNode[]) {
  nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') {
      return -1
    }
    if (a.type !== 'directory' && b.type === 'directory') {
      return 1
    }
    return a.name.localeCompare(b.name)
  })
}

function toRelativePath(parentRelativePath: string, name: string) {
  return parentRelativePath ? `${parentRelativePath}/${name}` : name
}

function createDirectoryNode(
  handle: FileSystemDirectoryHandle,
  parentRelativePath = '',
  depth = 0
): ProjectNode {
  const relativePath = toRelativePath(parentRelativePath, handle.name)

  return {
    name: handle.name,
    type: 'directory',
    relativePath,
    absolutePath: relativePath,
    depth,
    children: [],
    loaded: false,
    loading: false,
    truncated: false,
    handle
  }
}

function createFileNode(
  name: string,
  parentRelativePath: string,
  depth: number,
  fileHandle?: FileSystemFileHandle,
  isLowCodeGenerated = false,
  parentDirectoryHandle?: FileSystemDirectoryHandle
): ProjectNode {
  const relativePath = toRelativePath(parentRelativePath, name)

  return {
    name,
    type: 'file',
    relativePath,
    absolutePath: relativePath,
    depth,
    isUnsaved: false,
    isLowCodeGenerated,
    fileHandle,
    parentDirectoryHandle
  }
}

async function detectLowCodeGeneratedFile(
  fileHandle: FileSystemFileHandle,
  fileName: string,
  parentDirectoryHandle?: FileSystemDirectoryHandle
) {
  if (!/\.vue$/i.test(fileName)) {
    return false
  }

  // 优先通过 sidecar 文件识别：源码保持纯净，不再写入 <lowcode-dsl>。
  if (parentDirectoryHandle) {
    try {
      await parentDirectoryHandle.getFileHandle(toLowCodeDslSidecarName(fileName))
      return true
    } catch {
      // ignore and fallback to legacy detection
    }
  }

  // 兼容历史文件：仍允许识别旧版内嵌 DSL 标记，便于迁移。
  try {
    const file = await fileHandle.getFile()
    const headerText = await file.slice(0, 8192).text()
    if (headerText.includes(LOW_CODE_DSL_MARKER) || headerText.includes(LOW_CODE_SCRIPT_MARKER)) {
      return true
    }

    if (file.size > 8192) {
      const tailText = await file.slice(Math.max(0, file.size - 8192)).text()
      return tailText.includes(LOW_CODE_DSL_MARKER)
    }

    return false
  } catch {
    return false
  }
}

const loadDirectoryChildren: LoadDirectoryFn = async (node) => {
  if (node.type !== 'directory') {
    return
  }

  // 已加载或正在加载时直接跳过，避免重复请求。
  if (node.loaded || node.loading) {
    return
  }

  // 目录节点缺少句柄时无法继续读取。
  if (!node.handle) {
    node.loadError = '目录句柄不存在，无法继续读取'
    return
  }

  // 超过最大扫描深度时停止深入。
  if (node.depth >= MAX_DEPTH) {
    node.truncated = true
    node.loaded = true
    node.children = []
    return
  }

  // 超过全局节点上限时停止读取。
  if (loadedNodeCount.value >= MAX_TOTAL_NODES) {
    node.truncated = true
    node.loaded = true
    node.children = []
    return
  }

  node.loading = true
  node.loadError = ''

  try {
    const children: ProjectNode[] = []
    let childCount = 0

    // 逐项读取目录内容，避免超大目录导致页面阻塞。
    for await (const [, entry] of node.handle.entries()) {
      if (childCount >= MAX_CHILDREN_PER_DIRECTORY) {
        node.truncated = true
        break
      }

      if (loadedNodeCount.value >= MAX_TOTAL_NODES) {
        node.truncated = true
        break
      }

      childCount += 1

      if (entry.kind === 'directory') {
        // 命中过滤目录（如 node_modules）时跳过。
        if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
          continue
        }

        children.push(createDirectoryNode(entry, node.relativePath, node.depth + 1))
        loadedNodeCount.value += 1
        continue
      }

      // 低码 DSL sidecar 仅用于系统内部解析，不在目录树中展示。
      if (entry.name.endsWith(LOW_CODE_DSL_SIDECAR_SUFFIX)) {
        continue
      }

      const isLowCodeGenerated = await detectLowCodeGeneratedFile(entry, entry.name, node.handle)
      children.push(createFileNode(entry.name, node.relativePath, node.depth + 1, entry, isLowCodeGenerated, node.handle))
      loadedNodeCount.value += 1
    }

    sortNodes(children)
    node.children = children
    node.loaded = true
    scanSummary.value = `已加载 ${loadedNodeCount.value} 个节点（懒加载）`
  } catch (error: any) {
    node.loadError = error?.message || '读取目录失败'
  } finally {
    node.loading = false
  }
}

const createFileNodeInDirectory: CreateFileInDirectoryFn = async (directoryNode, fileName) => {
  if (directoryNode.type !== 'directory') {
    return {
      ok: false,
      message: '只能在目录下创建文件'
    }
  }

  await loadDirectoryChildren(directoryNode)

  const children = directoryNode.children || []
  const duplicated = children.some((child) => child.name === fileName)
  if (duplicated) {
    return {
      ok: false,
      message: '当前目录下已存在同名文件或文件夹'
    }
  }

  const relativePath = `${directoryNode.relativePath}/${fileName}`
  children.push({
    name: fileName,
    type: 'file',
    relativePath,
    absolutePath: relativePath,
    depth: directoryNode.depth + 1,
    // 新建文件先作为低码临时文件节点存在，待用户手动保存后再落盘。
    isUnsaved: true,
    isLowCodeGenerated: true,
    parentDirectoryHandle: directoryNode.handle
  })

  sortNodes(children)
  directoryNode.children = children
  directoryNode.loaded = true
  loadedNodeCount.value += 1
  scanSummary.value = `已加载 ${loadedNodeCount.value} 个节点（懒加载）`

  return { ok: true }
}

function removeUnsavedFileNodeFromTree(rootNode: ProjectNode | null, targetRelativePath: string): boolean {
  if (!rootNode || rootNode.type !== 'directory') {
    return false
  }

  const children = rootNode.children || []
  const matchedIndex = children.findIndex((child) => {
    return child.type === 'file' && child.isUnsaved && child.relativePath === targetRelativePath
  })

  if (matchedIndex >= 0) {
    children.splice(matchedIndex, 1)
    rootNode.children = children
    return true
  }

  for (const child of children) {
    if (child.type !== 'directory') {
      continue
    }

    const removed = removeUnsavedFileNodeFromTree(child, targetRelativePath)
    if (removed) {
      return true
    }
  }

  return false
}

const deleteUnsavedFileNode: DeleteUnsavedFileNodeFn = async (fileNode) => {
  if (fileNode.type !== 'file' || !fileNode.isUnsaved) {
    return {
      ok: false,
      message: '仅支持删除未落盘文件节点'
    }
  }

  const removed = removeUnsavedFileNodeFromTree(projectTree.value, fileNode.relativePath)
  if (!removed) {
    return {
      ok: false,
      message: '未找到可删除的节点'
    }
  }

  loadedNodeCount.value = Math.max(0, loadedNodeCount.value - 1)
  scanSummary.value = `已加载 ${loadedNodeCount.value} 个节点（懒加载）`

  if (activeFilePath.value === fileNode.relativePath) {
    activeFilePath.value = ''
    emit('file-select', null)
  }

  return { ok: true }
}

const selectFileNode: SelectFileNodeFn = (fileNode) => {
  if (fileNode.type !== 'file') {
    return
  }

  activeFilePath.value = fileNode.relativePath
  emit('file-select', fileNode)
}

async function openProjectByFolderPicker() {
  if (!pickerSupported) {
    errorMessage.value = '当前浏览器不支持文件夹选择器，请使用最新版 Chrome/Edge。'
    return
  }

  loading.value = true
  errorMessage.value = ''
  scanSummary.value = ''
  loadingMessage.value = '等待选择项目目录...'

  try {
    const previousProjectName = currentProjectName.value.trim()
    const previousProjectPath = projectAbsolutePath.value.trim()

    const picker = (window as PickerWindow).showDirectoryPicker!
    const directoryHandle = await picker()

    const projectName = directoryHandle.name
    if (previousProjectName && previousProjectName !== projectName) {
      await stopPreviewByProject(previousProjectName, previousProjectPath)
    }

    const rootNode = createDirectoryNode(directoryHandle, '', 0)
    let dependenciesInstalled = await hasNodeModules(directoryHandle)
    installCommandTip.value = await detectInstallCommand(directoryHandle)
    projectAbsolutePath.value = getStoredProjectPath(projectName)

    currentProjectName.value = projectName
    projectTree.value = rootNode
    selectedProjectHandle.value = directoryHandle
    loadedNodeCount.value = 1
    activeFilePath.value = ''
    emit('file-select', null)

    scanSummary.value = '项目已打开，展开目录后按需加载节点'

    let backendRunning = false
    let backendPreviewUrl = ''
    try {
      const backendStatus = await syncPreviewStatusFromBackend(projectName)
      dependenciesInstalled = backendStatus.dependenciesInstalled
      backendRunning = backendStatus.running
      backendPreviewUrl = backendStatus.previewUrl
    } catch {
      // 后端未能解析路径时，继续使用前端目录检测结果作为兜底。
    }

    updateProjectPreviewState({
      projectName,
      projectPath: projectAbsolutePath.value.trim(),
      dependenciesInstalled,
      status: backendRunning ? 'running' : dependenciesInstalled ? 'idle' : 'needs-install',
      message: backendRunning
        ? `项目已在运行：${backendPreviewUrl}（可在画布中拖拽调整样式）`
        : dependenciesInstalled
          ? '检测到 node_modules，可点击右上角“预览”启动项目'
          : `未检测到 node_modules，请先在项目根目录执行：${installCommandTip.value}`,
      previewUrl: backendPreviewUrl
    })

    if (!projectAbsolutePath.value) {
      updateProjectPreviewState({
        message: `${projectPreviewState.value.message}。未识别到绝对路径，请在下方填写后保存。`
      })
    }

  } catch (error: any) {
    // 用户取消选择目录时，不作为错误提示。
    if (error?.name === 'AbortError') {
      return
    }
    errorMessage.value = error?.message || '读取目录失败'
  } finally {
    loadingMessage.value = ''
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', onWindowClosing)
  window.addEventListener('pagehide', onWindowClosing)
  window.addEventListener('low-code:preview-control', onPreviewControlEvent as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onWindowClosing)
  window.removeEventListener('pagehide', onWindowClosing)
  window.removeEventListener('low-code:preview-control', onPreviewControlEvent as EventListener)
})
</script>

<template>
  <div class="outline-drawer-wrapper">
    <h3 class="drawer-title">项目源码目录</h3>

    <button
      class="open-project-btn"
      :disabled="loading"
      :title="pickerSupported ? '' : '请使用支持 showDirectoryPicker 的浏览器'"
      @click="openProjectByFolderPicker"
    >
      {{ loading ? '读取中...' : '选择项目文件夹' }}
    </button>

    <p v-if="loadingMessage" class="loading-text">{{ loadingMessage }}</p>

    <p v-if="!pickerSupported" class="error-text">
      当前浏览器不支持文件夹选择器，请使用最新版 Chrome/Edge。
    </p>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <div v-if="currentProjectName" class="current-project-info">
      当前项目：{{ currentProjectName }}
      <span v-if="scanSummary" class="scan-summary">{{ scanSummary }}</span>
      <span class="preview-status" :class="projectPreviewState.status">
        {{ projectPreviewState.message }}
      </span>

      <label class="path-label" for="project-absolute-path-input">项目绝对路径（用于启动预览）</label>
      <div class="path-row">
        <input
          id="project-absolute-path-input"
          v-model.trim="projectAbsolutePath"
          class="path-input"
          type="text"
          placeholder="例如：D:\\workspace\\demo-project"
          @blur="saveCurrentProjectPath"
        />
        <button class="path-save-btn" type="button" @click="saveCurrentProjectPath">保存</button>
      </div>

    </div>

    <ul v-if="projectTree" class="project-tree-root">
      <ProjectTreeNode
        :node="projectTree"
        :level="0"
        :load-directory="loadDirectoryChildren"
        :create-file-node="createFileNodeInDirectory"
        :delete-unsaved-file-node="deleteUnsavedFileNode"
        :select-file-node="selectFileNode"
        :active-file-path="activeFilePath"
      />
    </ul>

    <div v-else class="empty-tip">请点击“选择项目文件夹”打开项目</div>
  </div>
</template>

<style scoped>
.outline-drawer-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drawer-title {
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bolder);
  margin-bottom: 10px;
}

.open-project-btn {
  height: 34px;
  border: none;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: var(--color-white);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.open-project-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-text {
  margin-top: 8px;
  color: var(--color-gray-800);
  font-size: 12px;
}

.error-text {
  margin-top: 8px;
  color: #d93025;
  font-size: 12px;
}

.current-project-info {
  margin-top: 10px;
  padding: 8px;
  border-radius: 8px;
  background-color: var(--color-gray-100);
  color: var(--color-gray-800);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-all;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scan-summary {
  color: var(--color-gray-700);
}

.preview-status {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-gray-800);
}

.preview-status.needs-install {
  color: #d93025;
}

.preview-status.running {
  color: #137333;
}

.preview-status.starting {
  color: #185abc;
}

.preview-status.error {
  color: #d93025;
}

.path-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-gray-700);
}

.path-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: center;
}

.path-input {
  width: 100%;
  height: 30px;
  border: 1px solid var(--color-gray-300);
  border-radius: 6px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--color-gray-800);
  background: #fff;
}

.path-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgb(101 146 183 / 16%);
}

.path-save-btn {
  height: 30px;
  border: 1px solid var(--color-gray-300);
  border-radius: 6px;
  background: #fff;
  color: var(--color-gray-800);
  font-size: 12px;
  cursor: pointer;
}

.project-tree-root {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  border-radius: 8px;
  background-color: var(--color-gray-100);
}

.empty-tip {
  margin-top: 12px;
  font-size: var(--font-size-small);
  color: var(--color-gray-700);
}
</style>


