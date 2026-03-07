// projectService：负责读取并构建项目目录结构树。
const fs = require('node:fs')
const path = require('node:path')

// 为了避免返回过大的目录树，过滤掉常见大目录与构建产物。
const DEFAULT_IGNORES = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  'dist',
  'coverage'
])

const MAX_DEPTH = 12

/**
 * 校验并标准化输入目录路径。
 * @param {string} projectPath
 * @returns {string}
 */
function resolveProjectPath(projectPath) {
  const resolvedPath = path.resolve(projectPath)

  if (!fs.existsSync(resolvedPath)) {
    throw new Error('目录不存在')
  }

  const stats = fs.statSync(resolvedPath)
  if (!stats.isDirectory()) {
    throw new Error('path 必须是目录')
  }

  return resolvedPath
}

/**
 * 对目录项进行排序：目录优先，其次按名称升序。
 * @param {fs.Dirent[]} dirents
 */
function sortDirents(dirents) {
  return dirents.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) {
      return -1
    }
    if (!a.isDirectory() && b.isDirectory()) {
      return 1
    }
    return a.name.localeCompare(b.name)
  })
}

/**
 * 递归构建目录树。
 * @param {string} rootPath 项目根目录
 * @param {string} currentPath 当前遍历目录
 * @param {number} depth 当前递归深度
 */
function buildNode(rootPath, currentPath, depth) {
  const name = path.basename(currentPath)
  const relativePath = path.relative(rootPath, currentPath) || '.'

  // 限制最大深度，避免极深目录导致接口阻塞。
  if (depth > MAX_DEPTH) {
    return {
      name,
      type: 'directory',
      relativePath,
      absolutePath: currentPath,
      truncated: true,
      children: []
    }
  }

  const dirents = sortDirents(
    fs
      .readdirSync(currentPath, { withFileTypes: true })
      .filter((entry) => !DEFAULT_IGNORES.has(entry.name))
  )

  const children = dirents.map((entry) => {
    const fullPath = path.join(currentPath, entry.name)
    const childRelativePath = path.relative(rootPath, fullPath)

    if (entry.isDirectory()) {
      return buildNode(rootPath, fullPath, depth + 1)
    }

    return {
      name: entry.name,
      type: 'file',
      relativePath: childRelativePath,
      absolutePath: fullPath
    }
  })

  return {
    name,
    type: 'directory',
    relativePath,
    absolutePath: currentPath,
    children
  }
}

/**
 * 获取项目目录树。
 * @param {string} projectPath
 */
function getProjectTree(projectPath) {
  const resolvedPath = resolveProjectPath(projectPath)

  return {
    projectPath: resolvedPath,
    tree: buildNode(resolvedPath, resolvedPath, 0)
  }
}

module.exports = {
  getProjectTree
}
