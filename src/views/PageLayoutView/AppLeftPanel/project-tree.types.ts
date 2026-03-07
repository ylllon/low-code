/**
 * 目录树节点结构。
 * 懒加载模式下：
 * - directory 节点会携带 handle，用于展开时再读取子节点
 * - loaded/loading/loadError 用于驱动 UI 状态
 */
export interface ProjectNode {
  name: string
  type: 'directory' | 'file'
  relativePath: string
  absolutePath: string
  // 节点层级，从根目录 0 开始
  depth: number
  // 前端临时节点（未写入磁盘）标记。
  isUnsaved?: boolean
  // 低码系统生成文件标记：用于区分普通源码与可回到画布继续编辑的文件。
  isLowCodeGenerated?: boolean
  truncated?: boolean
  children?: ProjectNode[]
  loaded?: boolean
  loading?: boolean
  loadError?: string
  // 目录句柄：用于展开时读取目录子节点。
  handle?: FileSystemDirectoryHandle
  // 文件句柄：用于读取文件源码。
  fileHandle?: FileSystemFileHandle
  // 文件所属目录句柄：用于读写低码 DSL 侧车文件（*.lowcode.dsl.json）。
  parentDirectoryHandle?: FileSystemDirectoryHandle
}

/**
 * 目录节点加载函数签名。
 * 输入目录节点，函数内部负责填充该节点 children。
 */
export type LoadDirectoryFn = (node: ProjectNode) => Promise<void>

/**
 * 在指定目录节点下创建文件节点。
 * 返回 ok/message 便于组件层展示错误提示。
 */
export type CreateFileInDirectoryFn = (
  directoryNode: ProjectNode,
  fileName: string
) => Promise<{ ok: boolean; message?: string }>

/**
 * 删除“未落盘文件节点”函数签名。
 * 仅允许删除 isUnsaved=true 的文件节点，避免误删真实文件。
 */
export type DeleteUnsavedFileNodeFn = (
  fileNode: ProjectNode
) => Promise<{ ok: boolean; message?: string }>

/**
 * 选中文件节点函数签名。
 * 用于将左侧树选中的文件同步到中间编辑区。
 */
export type SelectFileNodeFn = (fileNode: ProjectNode) => void
