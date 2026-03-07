export type ProjectPreviewStatus = 'idle' | 'needs-install' | 'starting' | 'running' | 'error'

/**
 * 项目运行预览状态。
 * 该结构用于左侧目录面板与中间画布之间同步“项目是否可预览、预览地址和提示信息”。
 */
export interface ProjectPreviewState {
  projectName: string
  projectPath: string
  dependenciesInstalled: boolean
  status: ProjectPreviewStatus
  message: string
  previewUrl: string
}

export const defaultProjectPreviewState: ProjectPreviewState = {
  projectName: '',
  projectPath: '',
  dependenciesInstalled: false,
  status: 'idle',
  message: '请先选择项目文件夹',
  previewUrl: ''
}
