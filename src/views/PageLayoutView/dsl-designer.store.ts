import { computed, reactive } from 'vue'
import {
  createCanvasNodeId,
  normalizeCanvasNode,
  type CanvasComponentNode,
  type CanvasLayoutMode
} from '@/views/PageLayoutView/component-library'

interface DesignerMutationOptions {
  skipRevision?: boolean
}

export interface DesignerSchemaPayload {
  layoutMode: CanvasLayoutMode
  canvasBackground: string
  gridRows: number
  nodes: CanvasComponentNode[]
}

export interface DesignerMutationResult {
  ok: boolean
  message?: string
}

export type LayerMoveAction = 'up' | 'down' | 'top' | 'bottom'

export const designerState = reactive({
  layoutMode: 'free' as CanvasLayoutMode,
  canvasBackground: '#ffffff',
  // grid9 画布模式下的行数，默认 3 行。
  gridRows: 3,
  // 由中间画布容器实时同步，用于右侧面板“对齐到画布”计算。
  canvasWidth: 0,
  canvasHeight: 0,
  nodes: [] as CanvasComponentNode[],
  selectedNodeId: '',
  /**
   * 每次业务变更递增 revision，供外部监听后进行“写回源码”。
   */
  revision: 0
})

export const selectedDesignerNode = computed<CanvasComponentNode | null>(() => {
  return designerState.nodes.find((item) => item.id === designerState.selectedNodeId) || null
})

function bumpRevision() {
  designerState.revision += 1
}

function cloneNodeList(nodes: CanvasComponentNode[]) {
  return nodes.map((node) => normalizeCanvasNode(node))
}

function getNextZIndex() {
  const maxZIndex = designerState.nodes.reduce((maxValue, node) => {
    return Math.max(maxValue, Number(node.zIndex || 0))
  }, 0)

  return maxZIndex + 1
}

/**
 * 计算第一个可用的 9 宫格位置。
 */
export function findFirstAvailableGridCell(excludeNodeId = '') {
  const occupied = new Set<number>()

  designerState.nodes.forEach((node) => {
    if (node.id === excludeNodeId) {
      return
    }
    if (node.parentId) {
      return
    }

    if (typeof node.gridCell === 'number' && node.gridCell >= 0 && node.gridCell <= 8) {
      occupied.add(node.gridCell)
    }
  })

  for (let index = 0; index < 9; index += 1) {
    if (!occupied.has(index)) {
      return index
    }
  }

  return null
}

/**
 * 规范化 9 宫格节点占位：
 * - 占位冲突自动寻找下一个空位
 * - 超出 9 个节点时，多余节点 gridCell 会变成 null
 */
function normalizeNodesForGridMode(nodes: CanvasComponentNode[]) {
  const usedCells = new Set<number>()

  return nodes.map((rawNode) => {
    const node = normalizeCanvasNode(rawNode)
    if (node.parentId) {
      node.gridCell = null
      return node
    }

    if (typeof node.gridCell === 'number' && node.gridCell >= 0 && node.gridCell <= 8 && !usedCells.has(node.gridCell)) {
      usedCells.add(node.gridCell)
      return node
    }

    for (let index = 0; index < 9; index += 1) {
      if (!usedCells.has(index)) {
        node.gridCell = index
        usedCells.add(index)
        return node
      }
    }

    node.gridCell = null
    return node
  })
}

/**
 * 当布局模式切换时，保持节点结构可用。
 */
export function setDesignerLayoutMode(mode: CanvasLayoutMode, options: DesignerMutationOptions = {}) {
  if (designerState.layoutMode === mode) {
    return
  }

  designerState.layoutMode = mode

  if (mode === 'grid9') {
    designerState.nodes = normalizeNodesForGridMode(cloneNodeList(designerState.nodes))
  }

  if (!options.skipRevision) {
    bumpRevision()
  }
}

export function setDesignerCanvasBackground(background: string, options: DesignerMutationOptions = {}) {
  designerState.canvasBackground = background || '#ffffff'

  if (!options.skipRevision) {
    bumpRevision()
  }
}

export function setDesignerGridRows(rows: number, options: DesignerMutationOptions = {}) {
  const normalizedRows = Number.isFinite(rows) ? Math.min(Math.max(Math.round(rows), 1), 20) : 3
  if (designerState.gridRows === normalizedRows) {
    return
  }

  designerState.gridRows = normalizedRows

  if (!options.skipRevision) {
    bumpRevision()
  }
}

/**
 * 同步当前画布可编辑区域尺寸。
 * 默认不触发 revision，避免窗口 resize 导致源码频繁回写。
 */
export function setDesignerCanvasSize(
  width: number,
  height: number,
  options: DesignerMutationOptions = { skipRevision: true }
) {
  const nextWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0
  const nextHeight = Number.isFinite(height) ? Math.max(0, Math.round(height)) : 0

  if (designerState.canvasWidth === nextWidth && designerState.canvasHeight === nextHeight) {
    return
  }

  designerState.canvasWidth = nextWidth
  designerState.canvasHeight = nextHeight

  if (!options.skipRevision) {
    bumpRevision()
  }
}

/**
 * 直接替换整棵节点树（用于从源码解析或 JSON 导入恢复）。
 */
export function setDesignerNodes(nodes: CanvasComponentNode[], options: DesignerMutationOptions = {}) {
  const normalizedNodes = cloneNodeList(nodes)

  designerState.nodes =
    designerState.layoutMode === 'grid9' ? normalizeNodesForGridMode(normalizedNodes) : normalizedNodes

  if (!designerState.nodes.some((node) => node.id === designerState.selectedNodeId)) {
    designerState.selectedNodeId = designerState.nodes[0]?.id || ''
  }

  if (!options.skipRevision) {
    bumpRevision()
  }
}

/**
 * 新增组件节点。
 * grid9 模式下会自动占位，若满格则返回失败。
 */
export function addDesignerNode(
  node: CanvasComponentNode,
  options: DesignerMutationOptions = {}
): DesignerMutationResult {
  const normalizedNode = normalizeCanvasNode(node)
  const isChildNode = Boolean(normalizedNode.parentId)

  if (isChildNode) {
    const parentNode = designerState.nodes.find((item) => item.id === normalizedNode.parentId)
    if (!parentNode) {
      return {
        ok: false,
        message: '目标布局容器不存在，无法添加子组件。'
      }
    }
    normalizedNode.gridCell = null
  }

  if (designerState.layoutMode === 'free' && !isChildNode) {
    normalizedNode.zIndex = getNextZIndex()
  }

  if (designerState.layoutMode === 'grid9' && !isChildNode) {
    if (typeof normalizedNode.gridCell !== 'number') {
      normalizedNode.gridCell = findFirstAvailableGridCell()
    }

    if (typeof normalizedNode.gridCell !== 'number') {
      return {
        ok: false,
        message: '9宫格已满，请先删除一个组件再拖入。'
      }
    }

    const conflictNode = designerState.nodes.find(
      (item) => item.id !== normalizedNode.id && item.gridCell === normalizedNode.gridCell
    )

    if (conflictNode) {
      return {
        ok: false,
        message: `当前宫格已被「${conflictNode.title}」占用。`
      }
    }
  }

  designerState.nodes = [...designerState.nodes, normalizedNode]
  designerState.selectedNodeId = normalizedNode.id

  if (!options.skipRevision) {
    bumpRevision()
  }

  return { ok: true }
}

/**
 * 更新指定节点。
 * patch.props / patch.style 会与原值合并，不会整对象覆盖。
 */
export function updateDesignerNode(
  nodeId: string,
  patch: Partial<CanvasComponentNode>,
  options: DesignerMutationOptions = {}
): DesignerMutationResult {
  const targetIndex = designerState.nodes.findIndex((item) => item.id === nodeId)
  if (targetIndex < 0) {
    return {
      ok: false,
      message: '未找到需要更新的组件节点。'
    }
  }

  const currentNode = designerState.nodes[targetIndex]
  const mergedNode = normalizeCanvasNode({
    ...currentNode,
    ...patch,
    props: patch.props ? { ...currentNode.props, ...patch.props } : currentNode.props,
    style: patch.style ? { ...currentNode.style, ...patch.style } : currentNode.style
  })

  const isChildNode = Boolean(mergedNode.parentId)
  if (isChildNode) {
    const parentNode = designerState.nodes.find((item) => item.id === mergedNode.parentId)
    if (!parentNode) {
      return {
        ok: false,
        message: '目标布局容器不存在，无法移动组件。'
      }
    }
    mergedNode.gridCell = null
  }

  if (designerState.layoutMode === 'grid9' && !isChildNode) {
    if (typeof mergedNode.gridCell !== 'number') {
      mergedNode.gridCell = findFirstAvailableGridCell(nodeId)
    }

    if (typeof mergedNode.gridCell !== 'number') {
      return {
        ok: false,
        message: '9宫格已满，无法分配位置。'
      }
    }

    const conflictNode = designerState.nodes.find(
      (item) => item.id !== nodeId && item.gridCell === mergedNode.gridCell
    )

    if (conflictNode) {
      return {
        ok: false,
        message: `目标宫格已被「${conflictNode.title}」占用。`
      }
    }
  }

  designerState.nodes.splice(targetIndex, 1, mergedNode)

  if (!options.skipRevision) {
    bumpRevision()
  }

  return { ok: true }
}

export function removeDesignerNode(nodeId: string, options: DesignerMutationOptions = {}) {
  const removedIds = new Set<string>()
  removedIds.add(nodeId)

  let changed = true
  while (changed) {
    changed = false
    designerState.nodes.forEach((node) => {
      if (!node.parentId) {
        return
      }
      if (removedIds.has(node.parentId) && !removedIds.has(node.id)) {
        removedIds.add(node.id)
        changed = true
      }
    })
  }

  const nextNodes = designerState.nodes.filter((node) => !removedIds.has(node.id))
  if (nextNodes.length === designerState.nodes.length) {
    return
  }

  designerState.nodes = nextNodes

  if (removedIds.has(designerState.selectedNodeId)) {
    designerState.selectedNodeId = designerState.nodes[0]?.id || ''
  }

  if (!options.skipRevision) {
    bumpRevision()
  }
}

/**
 * 克隆当前节点。
 * free 模式会自动在右下偏移；grid9 模式会占用新的空位。
 */
export function duplicateDesignerNode(
  nodeId: string,
  options: DesignerMutationOptions = {}
): DesignerMutationResult {
  const sourceNode = designerState.nodes.find((node) => node.id === nodeId)
  if (!sourceNode) {
    return {
      ok: false,
      message: '未找到要复制的组件。'
    }
  }

  const duplicateNode = normalizeCanvasNode({
    ...sourceNode,
    id: createCanvasNodeId(sourceNode.type),
    x: sourceNode.x + 20,
    y: sourceNode.y + 20,
    zIndex: sourceNode.zIndex + 1,
    gridCell: designerState.layoutMode === 'grid9' ? findFirstAvailableGridCell() : sourceNode.gridCell
  })

  return addDesignerNode(duplicateNode, options)
}

export function selectDesignerNode(nodeId: string) {
  if (!nodeId) {
    designerState.selectedNodeId = ''
    return
  }

  if (designerState.nodes.some((item) => item.id === nodeId)) {
    designerState.selectedNodeId = nodeId
  }
}

/**
 * 手动触发一次 revision 递增。
 * 用于拖拽中多次静默更新后，在 pointerup 时统一提交。
 */
export function commitDesignerRevision() {
  bumpRevision()
}

/**
 * 调整图层顺序（仅自由布局生效）。
 * - up/down: 与相邻图层交换
 * - top/bottom: 置顶/置底
 */
export function moveDesignerNodeLayer(
  nodeId: string,
  action: LayerMoveAction,
  options: DesignerMutationOptions = {}
): DesignerMutationResult {
  if (designerState.layoutMode !== 'free') {
    return {
      ok: false,
      message: '当前布局模式不支持图层顺序调整。'
    }
  }

  const targetNode = designerState.nodes.find((node) => node.id === nodeId)
  if (!targetNode) {
    return {
      ok: false,
      message: '目标图层不存在。'
    }
  }
  if (targetNode.parentId) {
    return {
      ok: false,
      message: '布局容器内组件不支持画布图层排序。'
    }
  }

  const sortedNodes = [...designerState.nodes]
    .filter((node) => !node.parentId)
    .sort((left, right) => left.zIndex - right.zIndex)
  const currentIndex = sortedNodes.findIndex((node) => node.id === nodeId)
  if (currentIndex < 0) {
    return {
      ok: false,
      message: '目标图层不存在。'
    }
  }

  if (action === 'up' && currentIndex < sortedNodes.length - 1) {
    const nextNode = sortedNodes[currentIndex + 1]
    const currentZIndex = targetNode.zIndex
    targetNode.zIndex = nextNode.zIndex
    nextNode.zIndex = currentZIndex
  } else if (action === 'down' && currentIndex > 0) {
    const prevNode = sortedNodes[currentIndex - 1]
    const currentZIndex = targetNode.zIndex
    targetNode.zIndex = prevNode.zIndex
    prevNode.zIndex = currentZIndex
  } else if (action === 'top') {
    targetNode.zIndex = getNextZIndex()
  } else if (action === 'bottom') {
    const minZIndex = sortedNodes.reduce((minValue, node) => {
      return Math.min(minValue, node.zIndex)
    }, sortedNodes[0]?.zIndex || 0)

    targetNode.zIndex = minZIndex - 1
  }

  // 重新归一化 zIndex，避免出现过大或负值。
  const normalizedByLayer = [...designerState.nodes]
    .filter((node) => !node.parentId)
    .sort((left, right) => left.zIndex - right.zIndex)
  normalizedByLayer.forEach((node, index) => {
    node.zIndex = index + 1
  })

  if (!options.skipRevision) {
    bumpRevision()
  }

  return { ok: true }
}

export function resetDesignerState(options: DesignerMutationOptions = {}) {
  designerState.layoutMode = 'free'
  designerState.canvasBackground = '#ffffff'
  designerState.gridRows = 3
  designerState.nodes = []
  designerState.selectedNodeId = ''

  if (!options.skipRevision) {
    bumpRevision()
  }
}

/**
 * 序列化当前画布 schema，供写回源码注释块使用。
 */
export function exportDesignerSchemaPayload(): DesignerSchemaPayload {
  return {
    layoutMode: designerState.layoutMode,
    canvasBackground: designerState.canvasBackground,
    gridRows: designerState.gridRows,
    nodes: cloneNodeList(designerState.nodes)
  }
}

/**
 * 从画布 schema 恢复状态（通常由源码解析得到）。
 */
export function loadDesignerSchemaPayload(
  payload: Partial<DesignerSchemaPayload>,
  options: DesignerMutationOptions = {}
) {
  const nextMode: CanvasLayoutMode = payload.layoutMode === 'grid9' ? 'grid9' : 'free'
  designerState.layoutMode = nextMode
  designerState.canvasBackground = payload.canvasBackground || '#ffffff'
  const payloadGridRows = Number(payload.gridRows)
  designerState.gridRows = Number.isFinite(payloadGridRows) ? Math.min(Math.max(Math.round(payloadGridRows), 1), 20) : 3

  const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : []
  designerState.nodes =
    nextMode === 'grid9' ? normalizeNodesForGridMode(cloneNodeList(rawNodes)) : cloneNodeList(rawNodes)

  if (!designerState.nodes.some((node) => node.id === designerState.selectedNodeId)) {
    designerState.selectedNodeId = designerState.nodes[0]?.id || ''
  }

  if (!options.skipRevision) {
    bumpRevision()
  }
}

/**
 * 导出可跨页面/跨工程复用的 DSL JSON。
 */
export function exportDesignerDslJson(pageName = '低码页面') {
  return JSON.stringify(
    {
      meta: {
        dslVersion: '1.0.0',
        exportedAt: new Date().toISOString()
      },
      page: {
        name: pageName,
        canvas: {
          layoutMode: designerState.layoutMode,
          background: designerState.canvasBackground,
          rows: designerState.gridRows
        }
      },
      nodes: cloneNodeList(designerState.nodes)
    },
    null,
    2
  )
}

/**
 * 导入 DSL JSON 并恢复到设计器。
 */
export function importDesignerDslJson(rawText: string): DesignerMutationResult {
  if (!rawText.trim()) {
    return {
      ok: false,
      message: '导入内容为空，请粘贴有效 JSON。'
    }
  }

  let parsed: any
  try {
    parsed = JSON.parse(rawText)
  } catch (error: any) {
    return {
      ok: false,
      message: `JSON 解析失败：${error?.message || '格式错误'}`
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      message: '导入内容不是对象结构。'
    }
  }

  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : Array.isArray(parsed.page?.nodes) ? parsed.page.nodes : null

  if (!nodes) {
    return {
      ok: false,
      message: 'JSON 中缺少 nodes 数组。'
    }
  }

  const layoutMode: CanvasLayoutMode =
    parsed.layoutMode === 'grid9' || parsed.page?.layoutMode === 'grid9' || parsed.page?.canvas?.layoutMode === 'grid9'
      ? 'grid9'
      : 'free'

  const background =
    parsed.canvasBackground ||
    parsed.page?.canvas?.background ||
    parsed.page?.canvasBackground ||
    '#ffffff'
  const rows = Number(parsed.gridRows ?? parsed.page?.canvas?.rows)
  const normalizedRows = Number.isFinite(rows) ? Math.min(Math.max(Math.round(rows), 1), 20) : 3

  loadDesignerSchemaPayload(
    {
      layoutMode,
      canvasBackground: background,
      gridRows: normalizedRows,
      nodes
    },
    {
      skipRevision: false
    }
  )

  return {
    ok: true,
    message: 'DSL 导入成功。'
  }
}
