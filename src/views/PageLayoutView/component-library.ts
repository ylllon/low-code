export { LOW_CODE_COMPONENT_MIME_TYPE } from './component-library.types'
export type {
  CanvasLayoutMode,
  ComponentDataMode,
  ComponentPreviewType,
  ComponentPropEditorType,
  ComponentStateStyle,
  ComponentStateStyles,
  ComponentPropOption,
  ComponentPropSchema,
  LibraryComponentMeta,
  CanvasComponentNode
} from './component-library.types'
export { componentLibraryList } from './component-library.catalog'

import type { CanvasComponentNode, LibraryComponentMeta } from './component-library.types'
import { componentLibraryList } from './component-library.catalog'

export const componentLibraryMap: Record<string, LibraryComponentMeta> = componentLibraryList.reduce(
  (accumulator, item) => {
    accumulator[item.type] = item
    return accumulator
  },
  {} as Record<string, LibraryComponentMeta>
)

/**
 * 深拷贝纯对象，避免默认 props/style 在节点间共享引用。
 */
function clonePlainObject<T extends Record<string, any>>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * 根据组件类型返回默认尺寸/标题/props/style。
 */
export function buildCanvasNodeDefaults(type: string) {
  const componentMeta = componentLibraryMap[type] ?? componentLibraryMap.text
  const isLayoutCategory = componentMeta.category === '布局组件'
  return {
    width: componentMeta.defaultWidth,
    height: componentMeta.defaultHeight,
    title: isLayoutCategory ? '' : componentMeta.name,
    props: clonePlainObject(componentMeta.defaultProps),
    style: clonePlainObject(componentMeta.defaultStyle)
  }
}

/**
 * 规范化节点结构。
 * 用于读取 schema / 导入 JSON 时兜底，确保字段完整可渲染。
 */
export function normalizeCanvasNode(rawNode: any): CanvasComponentNode {
  const type = typeof rawNode?.type === 'string' && rawNode.type ? rawNode.type : 'text'
  const defaults = buildCanvasNodeDefaults(type)

  const x = Number.isFinite(rawNode?.x) ? Math.max(0, Math.round(rawNode.x)) : 24
  const y = Number.isFinite(rawNode?.y) ? Math.max(0, Math.round(rawNode.y)) : 24
  const width = Number.isFinite(rawNode?.width) ? Math.max(120, Math.round(rawNode.width)) : defaults.width
  const height = Number.isFinite(rawNode?.height) ? Math.max(44, Math.round(rawNode.height)) : defaults.height
  const gridCell =
    Number.isInteger(rawNode?.gridCell) && rawNode.gridCell >= 0 && rawNode.gridCell <= 8 ? rawNode.gridCell : null
  const parentId = typeof rawNode?.parentId === 'string' && rawNode.parentId ? rawNode.parentId : null
  const zIndex = Number.isFinite(rawNode?.zIndex) ? Math.max(0, Math.round(rawNode.zIndex)) : 0
  const visible = rawNode?.visible !== false
  const locked = rawNode?.locked === true

  return {
    id: typeof rawNode?.id === 'string' && rawNode.id ? rawNode.id : createCanvasNodeId(type),
    type,
    parentId,
    title: typeof rawNode?.title === 'string' && rawNode.title ? rawNode.title : defaults.title,
    x,
    y,
    width,
    height,
    gridCell,
    zIndex,
    visible,
    locked,
    props: {
      ...defaults.props,
      ...(rawNode?.props && typeof rawNode.props === 'object' ? rawNode.props : {})
    },
    style: {
      ...defaults.style,
      ...(rawNode?.style && typeof rawNode.style === 'object' ? rawNode.style : {})
    }
  }
}

/**
 * 生成新的画布节点（用于拖拽落点创建）。
 */
export function buildCanvasNodeFromType(
  type: string,
  patch: Partial<Omit<CanvasComponentNode, 'id' | 'type'>> = {}
): CanvasComponentNode {
  const defaults = buildCanvasNodeDefaults(type)

  return normalizeCanvasNode({
    id: createCanvasNodeId(type),
    type,
    parentId: typeof patch.parentId === 'string' && patch.parentId ? patch.parentId : null,
    title: patch.title ?? defaults.title,
    x: patch.x ?? 24,
    y: patch.y ?? 24,
    width: patch.width ?? defaults.width,
    height: patch.height ?? defaults.height,
    gridCell: typeof patch.gridCell === 'number' ? patch.gridCell : null,
    zIndex: Number.isFinite(patch.zIndex) ? Number(patch.zIndex) : 0,
    visible: patch.visible !== false,
    locked: patch.locked === true,
    props: {
      ...defaults.props,
      ...(patch.props || {})
    },
    style: {
      ...defaults.style,
      ...(patch.style || {})
    }
  })
}

/**
 * 根据组件类型获取显示名称。
 */
export function getComponentDisplayName(type: string) {
  return componentLibraryMap[type]?.name || type
}

/**
 * 判断组件类型是否为布局容器组件。
 */
export function isLayoutComponentType(type: string) {
  return Boolean(componentLibraryMap[type]?.canAcceptChildren)
}

/**
 * 生成唯一组件 ID。
 */
export function createCanvasNodeId(type: string) {
  const randomSegment = Math.random().toString(36).slice(2, 8)
  return `${type}-${Date.now()}-${randomSegment}`
}
