/**
 * 目录树扫描配置。
 * 通过该配置可以控制目录过滤和扫描上限，避免大项目读取卡顿。
 */
export interface ProjectTreeScanConfig {
  // 需要过滤的目录名（按目录名精确匹配）
  ignoredDirectoryNames: string[]
  // 最大递归深度，超过后目录将标记为 truncated
  maxDepth: number
  // 全局最大节点数，超过后停止继续扫描
  maxTotalNodes: number
  // 单个目录最多读取多少子项
  maxChildrenPerDirectory: number
}

// 项目目录树扫描默认配置。
// 后续可按团队需要修改（例如加上 .pnpm-store、tmp 等目录）。
export const projectTreeScanConfig: ProjectTreeScanConfig = {
  ignoredDirectoryNames: [
    // 按你的要求：先过滤 node_modules
    'node_modules',
    // 推荐默认过滤项
    '.git',
    '.idea',
    '.vscode',
    'dist',
    'coverage',
    '.turbo',
    '.next'
  ],
  maxDepth: 8,
  maxTotalNodes: 4000,
  maxChildrenPerDirectory: 800
}
