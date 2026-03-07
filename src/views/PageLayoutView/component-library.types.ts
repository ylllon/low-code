export const LOW_CODE_COMPONENT_MIME_TYPE = 'application/x-low-code-component'

export type CanvasLayoutMode = 'free' | 'grid9'

/**
 * 参考 openDataV 的数据接入模式：
 * - SELF: 组件内部/示例数据
 * - STATIC: 平台静态数据
 * - REST: HTTP 接口数据
 */
export type ComponentDataMode = 'SELF' | 'STATIC' | 'REST'

export type ComponentPropEditorType = 'input' | 'textarea' | 'switch' | 'number' | 'color' | 'select' | 'json'
export type ComponentPreviewType = 'layout' | 'text' | 'form' | 'chart' | 'data' | 'container' | 'decoration'

export interface ComponentStateStyle {
  textColor?: string
  backgroundColor?: string
  borderColor?: string
  shadow?: string
}

export interface ComponentStateStyles {
  normal?: ComponentStateStyle
  hover?: ComponentStateStyle
  active?: ComponentStateStyle
}

export interface ComponentPropOption {
  label: string
  value: string | number | boolean
}

/**
 * 组件属性配置描述。
 * 右侧属性面板会读取此结构并动态渲染对应编辑器。
 */
export interface ComponentPropSchema {
  key: string
  label: string
  editor: ComponentPropEditorType
  placeholder?: string
  min?: number
  max?: number
  step?: number
  options?: ComponentPropOption[]
}

/**
 * 左侧组件库元数据。
 * 此结构被「组件库」「画布渲染」「属性面板」三方共享，避免字段不一致。
 */
export interface LibraryComponentMeta {
  type: string
  name: string
  description: string
  category: string
  groupOrder: number
  previewType: ComponentPreviewType
  iconKey: string
  color: string
  icon: string
  defaultWidth: number
  defaultHeight: number
  defaultProps: Record<string, any>
  defaultStyle: Record<string, any>
  stateStyles?: ComponentStateStyles
  canAcceptChildren?: boolean
  propSchema: ComponentPropSchema[]
  supportsDataConfig?: boolean
  defaultDataMode?: ComponentDataMode
}

/**
 * 画布节点结构。
 * - free 模式依赖 x/y
 * - grid9 模式依赖 gridCell(0..8)
 */
export interface CanvasComponentNode {
  id: string
  type: string
  // null 表示挂载在画布根层；非 null 表示挂载在某个布局容器节点下。
  parentId: string | null
  title: string
  x: number
  y: number
  width: number
  height: number
  gridCell: number | null
  // 自由布局层级，值越大越靠上
  zIndex: number
  // 图层可见性
  visible: boolean
  // 图层锁定后不可拖拽
  locked: boolean
  props: Record<string, any>
  style: Record<string, any>
}

