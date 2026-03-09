<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ProjectNode } from '@/views/PageLayoutView/AppLeftPanel/project-tree.types'
import {
  componentLibraryMap,
  type ComponentPropSchema,
  type LibraryComponentMeta,
  type ComponentDataMode
} from '@/views/PageLayoutView/component-library'
import {
  designerState,
  selectedDesignerNode,
  setDesignerCanvasBackground,
  setDesignerGridRows,
  updateDesignerNode,
  removeDesignerNode,
  duplicateDesignerNode,
  moveDesignerNodeLayer,
  selectDesignerNode,
  exportDesignerDslJson,
  importDesignerDslJson,
  type LayerMoveAction
} from '@/views/PageLayoutView/dsl-designer.store'
import {
  isCustomChartNodeType,
  resolveChartOptionEditorText,
  validateChartOptionInput
} from '@/views/PageLayoutView/AppPreviewer/echarts-option.utils'
import { parsePagedTableColumnSchema } from '@/views/PageLayoutView/AppPreviewer/paged-table.utils'

const props = defineProps<{
  selectedFileNode: ProjectNode | null
}>()

type PanelTab = 'props' | 'style' | 'data'
type AlignAction = 'left' | 'hCenter' | 'right' | 'top' | 'vCenter' | 'bottom'
type NodeSizeMode = 'fixed' | 'responsive'

const importDialogVisible = ref(false)
const importDslText = ref('')
const activePanelTab = ref<PanelTab>('props')

const hasSelectedFile = computed(() => props.selectedFileNode?.type === 'file')
const selectedNode = selectedDesignerNode
const isPagedTableSelected = computed(() => selectedNode.value?.type === 'pagedTable')

const selectedComponentMeta = computed<LibraryComponentMeta | null>(() => {
  if (!selectedNode.value) {
    return null
  }

  return componentLibraryMap[selectedNode.value.type] || null
})

const selectedPropSchema = computed<ComponentPropSchema[]>(() => {
  return selectedComponentMeta.value?.propSchema || []
})

const selectedSupportsData = computed(() => {
  return Boolean(selectedComponentMeta.value?.supportsDataConfig)
})

const dataModeOptions: Array<{ label: string; value: ComponentDataMode }> = [
  { label: '组件示例（SELF）', value: 'SELF' },
  { label: '静态池（STATIC）', value: 'STATIC' },
  { label: '接口请求（REST）', value: 'REST' }
]

const restMethodOptions = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' }
]

const styleSchemaList = [
  { key: 'color', label: '文字颜色', editor: 'color' },
  { key: 'backgroundColor', label: '背景颜色', editor: 'color' },
  { key: 'fontSize', label: '字体大小', editor: 'number', min: 10, max: 72, step: 1 },
  { key: 'borderRadius', label: '圆角', editor: 'number', min: 0, max: 40, step: 1 }
] as const

/**
 * grid9 下生成宫格列表，并禁用已被其它组件占用的位置。
 */
const gridCellOptions = computed(() => {
  const selectedId = selectedNode.value?.id || ''
  const occupiedCells = new Set<number>()

  designerState.nodes.forEach((node) => {
    if (node.id === selectedId) {
      return
    }

    if (typeof node.gridCell === 'number') {
      occupiedCells.add(node.gridCell)
    }
  })

  return Array.from({ length: 9 }).map((_, index) => {
    return {
      label: `第 ${index + 1} 宫格`,
      value: index,
      disabled: occupiedCells.has(index)
    }
  })
})

const selectedDataSourceType = computed<ComponentDataMode>(() => {
  const rawType = String(selectedNode.value?.props?.dataSourceType || '').toUpperCase()
  if (rawType === 'STATIC' || rawType === 'REST') {
    return rawType
  }
  return 'SELF'
})

const selectedChartOptionValidation = computed(() => {
  if (!selectedNode.value || !isCustomChartNodeType(selectedNode.value.type)) {
    return null
  }

  return validateChartOptionInput(selectedNode.value.props?.chartOption)
})

const chartOptionValidationHint = computed(() => {
  if (!selectedChartOptionValidation.value) {
    return null
  }

  const result = selectedChartOptionValidation.value
  if (result.mode === 'empty') {
    return {
      type: 'info' as const,
      title: '当前使用默认 Option',
      description: '尚未覆盖 setOption(option)，画布使用系统默认配置。'
    }
  }

  if (result.valid) {
    return {
      type: 'success' as const,
      title: result.mode === 'json' ? 'Option 校验通过（JSON）' : 'Option 校验通过（JS 对象）',
      description: '自定义 Option 将实时渲染并同步到源码。'
    }
  }

  const locationText = result.line
    ? result.column
      ? `（第 ${result.line} 行，第 ${result.column} 列）`
      : `（第 ${result.line} 行）`
    : ''

  return {
    type: 'error' as const,
    title: `Option 语法错误${locationText}`,
    description: result.message || '请检查 Option 配置格式。'
  }
})

/**
 * 图层列表（顶部在前），仅在自由布局下用于图层管理。
 */
const layerNodes = computed(() => {
  return [...designerState.nodes]
    .filter((node) => !node.parentId)
    .sort((left, right) => right.zIndex - left.zIndex)
})

const canAlignToCanvas = computed(() => {
  return Boolean(
    selectedNode.value &&
      !selectedNode.value.parentId &&
      designerState.layoutMode === 'free' &&
      designerState.canvasWidth > 0 &&
      designerState.canvasHeight > 0
  )
})

const canEditSelectedNodeFrame = computed(() => {
  if (!selectedNode.value || designerState.layoutMode !== 'free') {
    return false
  }

  if (!selectedNode.value.parentId) {
    return true
  }

  const parentNode = designerState.nodes.find((node) => node.id === selectedNode.value?.parentId)
  return parentNode?.type === 'layoutFree' || parentNode?.type === 'layoutTabs'
})

const selectedNodeSizeMode = computed<NodeSizeMode>(() => {
  if (!selectedNode.value) {
    return 'fixed'
  }
  return selectedNode.value.props?.sizeMode === 'responsive' ? 'responsive' : 'fixed'
})

function withSelectedNodeUpdate(patch: any) {
  if (!selectedNode.value) {
    return
  }

  const updateResult = updateDesignerNode(selectedNode.value.id, patch)
  if (!updateResult.ok) {
    ElMessage.error(updateResult.message || '组件更新失败')
  }
}

function onCanvasBackgroundChange(nextColor: string | null) {
  setDesignerCanvasBackground(nextColor || '#ffffff')
}

function onCanvasGridRowsChange(nextRows: number | null) {
  const normalizedRows = Number.isFinite(nextRows) ? Number(nextRows) : 3
  setDesignerGridRows(normalizedRows)
}

function getSelectedNodePropValue(key: string) {
  if (!selectedNode.value) {
    return ''
  }

  if (key === 'chartOption' && isCustomChartNodeType(selectedNode.value.type)) {
    return resolveChartOptionEditorText(selectedNode.value)
  }

  return selectedNode.value.props?.[key] ?? ''
}

function getSelectedNodeStyleValue(key: string) {
  if (!selectedNode.value) {
    return ''
  }

  return selectedNode.value.style?.[key] ?? ''
}

function onSelectedNodeTitleChange(nextTitle: string) {
  withSelectedNodeUpdate({ title: nextTitle })
}

function resolveSelectedNodeParentSize() {
  if (!selectedNode.value) {
    return {
      width: 0,
      height: 0
    }
  }

  if (!selectedNode.value.parentId) {
    return {
      width: Math.max(1, designerState.canvasWidth || selectedNode.value.width),
      height: Math.max(1, designerState.canvasHeight || selectedNode.value.height)
    }
  }

  const parentNode = designerState.nodes.find((node) => node.id === selectedNode.value?.parentId)
  return {
    width: Math.max(1, parentNode?.width || designerState.canvasWidth || selectedNode.value.width),
    height: Math.max(1, parentNode?.height || designerState.canvasHeight || selectedNode.value.height)
  }
}

function resolveSelectedNodeSizePercent(key: 'widthPercent' | 'heightPercent') {
  if (!selectedNode.value) {
    return 100
  }
  const rawValue = Number(selectedNode.value.props?.[key])
  if (!Number.isFinite(rawValue)) {
    const parentSize = resolveSelectedNodeParentSize()
    if (key === 'widthPercent') {
      return Math.min(Math.max(Math.round((selectedNode.value.width / parentSize.width) * 100), 1), 100)
    }
    return Math.min(Math.max(Math.round((selectedNode.value.height / parentSize.height) * 100), 1), 100)
  }
  return Math.min(Math.max(Math.round(rawValue), 1), 100)
}

function onSelectedNodePositionChange(key: 'x' | 'y', value: number | null) {
  const nextValue = Number.isFinite(value) ? Math.round(Number(value)) : 0
  withSelectedNodeUpdate({ [key]: Math.max(0, nextValue) })
}

function onSelectedNodeFixedSizeChange(key: 'width' | 'height', value: number | null) {
  const nextValue = Number.isFinite(value) ? Math.round(Number(value)) : 0
  withSelectedNodeUpdate({ [key]: Math.max(key === 'width' ? 1 : 1, nextValue) })
}

function onSelectedNodeResponsiveSizeChange(key: 'widthPercent' | 'heightPercent', value: number | null) {
  if (!selectedNode.value) {
    return
  }

  const normalizedPercent = Math.min(Math.max(Math.round(Number(value || 0)), 1), 100)
  const parentSize = resolveSelectedNodeParentSize()
  const nextWidthPercent = key === 'widthPercent' ? normalizedPercent : resolveSelectedNodeSizePercent('widthPercent')
  const nextHeightPercent = key === 'heightPercent' ? normalizedPercent : resolveSelectedNodeSizePercent('heightPercent')
  const nextWidth = Math.max(1, Math.round((parentSize.width * nextWidthPercent) / 100))
  const nextHeight = Math.max(1, Math.round((parentSize.height * nextHeightPercent) / 100))

  withSelectedNodeUpdate({
    width: nextWidth,
    height: nextHeight,
    props: {
      sizeMode: 'responsive',
      widthPercent: nextWidthPercent,
      heightPercent: nextHeightPercent
    }
  })
}

function onSelectedNodeSizeModeChange(nextMode: string | number | boolean) {
  if (!selectedNode.value) {
    return
  }

  const normalizedMode: NodeSizeMode = String(nextMode) === 'responsive' ? 'responsive' : 'fixed'
  const parentSize = resolveSelectedNodeParentSize()

  if (normalizedMode === 'responsive') {
    const widthPercent = resolveSelectedNodeSizePercent('widthPercent')
    const heightPercent = resolveSelectedNodeSizePercent('heightPercent')
    const nextWidth = Math.max(1, Math.round((parentSize.width * widthPercent) / 100))
    const nextHeight = Math.max(1, Math.round((parentSize.height * heightPercent) / 100))

    withSelectedNodeUpdate({
      width: nextWidth,
      height: nextHeight,
      props: {
        sizeMode: 'responsive',
        widthPercent,
        heightPercent
      }
    })
    return
  }

  const widthPercent = resolveSelectedNodeSizePercent('widthPercent')
  const heightPercent = resolveSelectedNodeSizePercent('heightPercent')
  const nextWidth = Math.max(1, Math.round((parentSize.width * widthPercent) / 100))
  const nextHeight = Math.max(1, Math.round((parentSize.height * heightPercent) / 100))

  withSelectedNodeUpdate({
    width: nextWidth,
    height: nextHeight,
    props: {
      sizeMode: 'fixed'
    }
  })
}

function onSelectedNodeGridCellChange(nextGridCell: number) {
  withSelectedNodeUpdate({ gridCell: nextGridCell })
}

function onSelectedNodePropChange(propKey: string, propValue: any) {
  withSelectedNodeUpdate({
    props: {
      [propKey]: propValue
    }
  })
}

function resolvePropEditorRows(propItem: ComponentPropSchema) {
  if (propItem.key === 'chartOption') {
    return 12
  }

  if (propItem.editor === 'json') {
    return 6
  }

  return 3
}

function parseDelimitedItems(rawValue: any) {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => String(item).trim())
      .filter(Boolean)
  }

  if (typeof rawValue !== 'string') {
    return []
  }

  return rawValue
    .split(/\n|\||,/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeListItems(rawItems: string[]) {
  return rawItems
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveVisualListItems(propKey: string, fallbackItems: string[] = []) {
  const rawValue = getSelectedNodePropValue(propKey)
  const parsedItems = parseDelimitedItems(rawValue)
  if (parsedItems.length) {
    return parsedItems
  }
  return [...fallbackItems]
}

function commitVisualListItems(propKey: string, nextItems: string[]) {
  const normalizedItems = normalizeListItems(nextItems)
  onSelectedNodePropChange(propKey, normalizedItems.join('|'))
}

function resolveListItemPlaceholder(propKey: string, index: number) {
  if (propKey === 'columns' || propKey === 'columnKeys') {
    return `col_${index + 1}`
  }
  return `Option ${index + 1}`
}

function onVisualListItemChange(propKey: string, index: number, nextValue: string) {
  const currentItems = resolveVisualListItems(propKey)
  if (index < 0 || index >= currentItems.length) {
    return
  }
  const nextItems = [...currentItems]
  nextItems[index] = nextValue
  commitVisualListItems(propKey, nextItems)
}

function onAddVisualListItem(propKey: string) {
  const currentItems = resolveVisualListItems(propKey)
  const nextItems = [...currentItems, resolveListItemPlaceholder(propKey, currentItems.length)]
  commitVisualListItems(propKey, nextItems)
}

function onRemoveVisualListItem(propKey: string, index: number) {
  const currentItems = resolveVisualListItems(propKey)
  if (index < 0 || index >= currentItems.length) {
    return
  }
  const nextItems = currentItems.filter((_, itemIndex) => itemIndex !== index)
  commitVisualListItems(propKey, nextItems)
}

function isSelectOptionVisualProp(propItem: ComponentPropSchema) {
  if (!selectedNode.value) {
    return false
  }

  if (selectedNode.value.type === 'select' && propItem.key === 'options') {
    return true
  }

  if (selectedNode.value.type === 'epSelect' && propItem.key === 'optionItems') {
    return true
  }

  return false
}

function isTableColumnVisualProp(propItem: ComponentPropSchema) {
  if (!selectedNode.value) {
    return false
  }

  if (selectedNode.value.type === 'table' && propItem.key === 'columns') {
    return true
  }

  if (selectedNode.value.type === 'epTable' && propItem.key === 'columnKeys') {
    return true
  }

  return false
}

function isTableDataVisualProp(propItem: ComponentPropSchema) {
  return selectedNode.value?.type === 'epTable' && propItem.key === 'data'
}

function isPagedTableColumnSchemaProp(propItem: ComponentPropSchema) {
  return selectedNode.value?.type === 'pagedTable' && propItem.key === 'columnSchema'
}

interface PagedTableColumnDraft {
  key: string
  label: string
  valueExpr: string
  minWidth: number
}

function resolvePagedTableColumnDrafts() {
  if (selectedNode.value?.type !== 'pagedTable') {
    return [] as PagedTableColumnDraft[]
  }

  const parsed = parsePagedTableColumnSchema(
    getSelectedNodePropValue('columnSchema'),
    String(getSelectedNodePropValue('columns') || '')
  )

  return parsed.map((item, index) => {
    return {
      key: String(item.key || `col_${index + 1}`),
      label: String(item.label || `Column ${index + 1}`),
      valueExpr: String(item.valueExpr || `\${row.${item.key || `col_${index + 1}`}}`),
      minWidth: Number.isFinite(Number(item.minWidth)) ? Math.max(60, Math.round(Number(item.minWidth))) : 120
    }
  })
}

const pagedTableColumnDrafts = computed(() => resolvePagedTableColumnDrafts())

function commitPagedTableColumnDrafts(nextDrafts: PagedTableColumnDraft[]) {
  const normalized = nextDrafts
    .map((item, index) => {
      const normalizedKey = String(item.key || `col_${index + 1}`).trim() || `col_${index + 1}`
      return {
        key: normalizedKey,
        label: String(item.label || normalizedKey).trim() || normalizedKey,
        valueExpr: String(item.valueExpr || `\${row.${normalizedKey}}`).trim() || `\${row.${normalizedKey}}`,
        minWidth: Math.max(60, Math.round(Number(item.minWidth) || 120))
      }
    })
    .filter((item) => item.key)

  const serialized = JSON.stringify(normalized, null, 2)
  const fallbackColumns = normalized.map((item) => item.label).join('|')
  withSelectedNodeUpdate({
    props: {
      columnSchema: serialized,
      columns: fallbackColumns
    }
  })
}

function onPagedTableColumnDraftChange(index: number, patch: Partial<PagedTableColumnDraft>) {
  const drafts = [...pagedTableColumnDrafts.value]
  if (index < 0 || index >= drafts.length) {
    return
  }
  drafts[index] = {
    ...drafts[index],
    ...patch
  }
  commitPagedTableColumnDrafts(drafts)
}

function onAddPagedTableColumnDraft() {
  const drafts = [...pagedTableColumnDrafts.value]
  const nextIndex = drafts.length + 1
  drafts.push({
    key: `col_${nextIndex}`,
    label: `Column ${nextIndex}`,
    valueExpr: `\${row.col_${nextIndex}}`,
    minWidth: 120
  })
  commitPagedTableColumnDrafts(drafts)
}

function onRemovePagedTableColumnDraft(index: number) {
  const drafts = pagedTableColumnDrafts.value.filter((_, draftIndex) => draftIndex !== index)
  if (!drafts.length) {
    drafts.push({
      key: 'id',
      label: 'ID',
      valueExpr: '${row.id}',
      minWidth: 120
    })
  }
  commitPagedTableColumnDrafts(drafts)
}

interface VisualTableRow {
  [key: string]: any
}

function parseTableDataRows(rawValue: any): VisualTableRow[] {
  let parsedRows: any[] = []

  if (Array.isArray(rawValue)) {
    parsedRows = rawValue
  } else if (typeof rawValue === 'string' && rawValue.trim()) {
    try {
      const parsed = JSON.parse(rawValue)
      if (Array.isArray(parsed)) {
        parsedRows = parsed
      }
    } catch {
      return []
    }
  }

  return parsedRows
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({ ...item }))
}

function resolveSelectedTableColumnKeys() {
  if (!selectedNode.value) {
    return []
  }

  if (selectedNode.value.type === 'table') {
    return parseDelimitedItems(getSelectedNodePropValue('columns'))
  }

  if (selectedNode.value.type !== 'epTable') {
    return []
  }

  const columnKeys = parseDelimitedItems(getSelectedNodePropValue('columnKeys'))
  if (columnKeys.length) {
    return columnKeys
  }

  const rows = parseTableDataRows(getSelectedNodePropValue('data'))
  if (rows.length) {
    return Object.keys(rows[0]).filter(Boolean)
  }

  return []
}

function resolveSelectedTableDataRows() {
  if (!selectedNode.value || selectedNode.value.type !== 'epTable') {
    return []
  }
  return parseTableDataRows(getSelectedNodePropValue('data'))
}

const visualTableColumns = computed(() => resolveSelectedTableColumnKeys())
const visualTableRows = computed(() => resolveSelectedTableDataRows())

function normalizeTableRowsByColumns(rows: VisualTableRow[], columns: string[]) {
  const normalizedColumns = normalizeListItems(columns)
  return rows.map((row) => {
    const nextRow: VisualTableRow = {}
    normalizedColumns.forEach((columnKey) => {
      nextRow[columnKey] = typeof row?.[columnKey] === 'undefined' ? '' : row[columnKey]
    })
    return nextRow
  })
}

function commitSelectedTableColumns(nextColumns: string[]) {
  if (!selectedNode.value) {
    return
  }

  const normalizedColumns = normalizeListItems(nextColumns).map((columnKey, index) => {
    return columnKey || `col_${index + 1}`
  })

  if (selectedNode.value.type === 'table') {
    onSelectedNodePropChange('columns', normalizedColumns.join('|'))
    return
  }

  if (selectedNode.value.type !== 'epTable') {
    return
  }

  const normalizedRows = normalizeTableRowsByColumns(visualTableRows.value, normalizedColumns)
  withSelectedNodeUpdate({
    props: {
      columnKeys: normalizedColumns.join('|'),
      data: JSON.stringify(normalizedRows, null, 2)
    }
  })
}

function onSelectedTableColumnChange(index: number, nextValue: string) {
  const nextColumns = [...visualTableColumns.value]
  if (index < 0 || index >= nextColumns.length) {
    return
  }
  nextColumns[index] = nextValue
  commitSelectedTableColumns(nextColumns)
}

function onAddSelectedTableColumn() {
  const nextColumns = [...visualTableColumns.value, `col_${visualTableColumns.value.length + 1}`]
  commitSelectedTableColumns(nextColumns)
}

function onRemoveSelectedTableColumn(index: number) {
  const nextColumns = visualTableColumns.value.filter((_, columnIndex) => columnIndex !== index)
  commitSelectedTableColumns(nextColumns)
}

function commitSelectedTableRows(nextRows: VisualTableRow[]) {
  if (!selectedNode.value || selectedNode.value.type !== 'epTable') {
    return
  }

  const normalizedRows = normalizeTableRowsByColumns(nextRows, visualTableColumns.value)
  onSelectedNodePropChange('data', JSON.stringify(normalizedRows, null, 2))
}

function resolveTableCellText(row: VisualTableRow, columnKey: string) {
  const rawValue = row?.[columnKey]
  if (rawValue === null || typeof rawValue === 'undefined') {
    return ''
  }
  return String(rawValue)
}

function onSelectedTableCellChange(rowIndex: number, columnKey: string, nextValue: string) {
  const nextRows = [...visualTableRows.value]
  if (rowIndex < 0 || rowIndex >= nextRows.length) {
    return
  }

  nextRows[rowIndex] = {
    ...nextRows[rowIndex],
    [columnKey]: nextValue
  }
  commitSelectedTableRows(nextRows)
}

function onAddSelectedTableRow() {
  if (!selectedNode.value || selectedNode.value.type !== 'epTable') {
    return
  }

  const nextColumns = visualTableColumns.value.length ? [...visualTableColumns.value] : ['col_1']
  const nextRows = [...visualTableRows.value]
  const newRow: VisualTableRow = {}

  nextColumns.forEach((columnKey) => {
    newRow[columnKey] = ''
  })

  nextRows.push(newRow)
  withSelectedNodeUpdate({
    props: {
      columnKeys: nextColumns.join('|'),
      data: JSON.stringify(normalizeTableRowsByColumns(nextRows, nextColumns), null, 2)
    }
  })
}

function onRemoveSelectedTableRow(rowIndex: number) {
  if (!selectedNode.value || selectedNode.value.type !== 'epTable') {
    return
  }

  const nextRows = visualTableRows.value.filter((_, index) => index !== rowIndex)
  commitSelectedTableRows(nextRows)
}

function onClearSelectedTableRows() {
  if (!selectedNode.value || selectedNode.value.type !== 'epTable') {
    return
  }

  onSelectedNodePropChange('data', '[]')
}

function buildVisualTableGridStyle() {
  const columnCount = Math.max(visualTableColumns.value.length, 1)
  return {
    gridTemplateColumns: `48px repeat(${columnCount}, minmax(140px, 1fr)) 72px`
  }
}

function onSelectedNodeStyleChange(styleKey: string, styleValue: any) {
  withSelectedNodeUpdate({
    style: {
      [styleKey]: styleValue
    }
  })
}

function onDataSourceTypeChange(nextType: string | number | boolean) {
  withSelectedNodeUpdate({
    props: {
      dataSourceType: String(nextType).toUpperCase()
    }
  })
}

function onSelectLayerNode(nodeId: string) {
  selectDesignerNode(nodeId)
}

function onToggleLayerVisible(nodeId: string, visible: boolean) {
  const result = updateDesignerNode(nodeId, {
    visible
  })

  if (!result.ok) {
    ElMessage.error(result.message || '图层更新失败')
  }
}

function onToggleLayerLocked(nodeId: string, locked: boolean) {
  const result = updateDesignerNode(nodeId, {
    locked
  })

  if (!result.ok) {
    ElMessage.error(result.message || '图层更新失败')
  }
}

function onMoveLayer(nodeId: string, action: LayerMoveAction) {
  const result = moveDesignerNodeLayer(nodeId, action)
  if (!result.ok) {
    ElMessage.warning(result.message || '图层调整失败')
  }
}

/**
 * 将选中组件对齐到画布边缘或中心线（仅自由布局生效）。
 */
function onAlignSelectedNode(action: AlignAction) {
  if (!selectedNode.value || designerState.layoutMode !== 'free') {
    return
  }

  const canvasWidth = Math.max(designerState.canvasWidth, selectedNode.value.width)
  const canvasHeight = Math.max(designerState.canvasHeight, selectedNode.value.height)
  let nextX = selectedNode.value.x
  let nextY = selectedNode.value.y

  if (action === 'left') {
    nextX = 0
  } else if (action === 'hCenter') {
    nextX = Math.round((canvasWidth - selectedNode.value.width) / 2)
  } else if (action === 'right') {
    nextX = Math.max(0, canvasWidth - selectedNode.value.width)
  } else if (action === 'top') {
    nextY = 0
  } else if (action === 'vCenter') {
    nextY = Math.round((canvasHeight - selectedNode.value.height) / 2)
  } else if (action === 'bottom') {
    nextY = Math.max(0, canvasHeight - selectedNode.value.height)
  }

  withSelectedNodeUpdate({
    x: Math.max(0, nextX),
    y: Math.max(0, nextY)
  })
}

function onDeleteSelectedNode() {
  if (!selectedNode.value) {
    return
  }

  removeDesignerNode(selectedNode.value.id)
}

function onDuplicateSelectedNode() {
  if (!selectedNode.value) {
    return
  }

  const duplicateResult = duplicateDesignerNode(selectedNode.value.id)
  if (!duplicateResult.ok) {
    ElMessage.warning(duplicateResult.message || '复制失败')
    return
  }

  ElMessage.success('组件复制成功')
}

function onValidateDemoData() {
  const rawJson = String(getSelectedNodePropValue('demoData') || '').trim()
  if (!rawJson) {
    ElMessage.warning('请先输入 demoData JSON')
    return
  }

  try {
    const parsed = JSON.parse(rawJson)
    if (isPagedTableSelected.value) {
      if (!parsed || typeof parsed !== 'object') {
        ElMessage.error('分页表格 demoData 需要对象或数组结构')
        return
      }
      const rowCount = Array.isArray(parsed)
        ? parsed.length
        : Array.isArray((parsed as any)?.data?.records)
          ? (parsed as any).data.records.length
          : 0
      ElMessage.success(`JSON 校验通过，已识别 ${rowCount} 条 records 数据`)
      return
    }

    if (!Array.isArray(parsed)) {
      ElMessage.error('demoData 必须是数组结构')
      return
    }

    ElMessage.success(`JSON 校验通过，共 ${parsed.length} 条数据`)
  } catch (error: any) {
    ElMessage.error(`JSON 校验失败：${error?.message || '格式错误'}`)
  }
}

/**
 * 导出 DSL：下载为 json 文件，方便跨页面/跨工程导入复用。
 */
function onExportDsl() {
  const exportText = exportDesignerDslJson(props.selectedFileNode?.name || '低码页面')
  const blob = new Blob([exportText], { type: 'application/json;charset=utf-8' })
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = downloadUrl
  link.download = `dsl-page-${Date.now()}.json`
  link.click()

  URL.revokeObjectURL(downloadUrl)
  ElMessage.success('DSL 已导出')
}

function onOpenImportDialog() {
  importDslText.value = ''
  importDialogVisible.value = true
}

function onApplyImportDsl() {
  const importResult = importDesignerDslJson(importDslText.value)
  if (!importResult.ok) {
    ElMessage.error(importResult.message || 'DSL 导入失败')
    return
  }

  importDialogVisible.value = false
  ElMessage.success(importResult.message || 'DSL 导入成功')
}
</script>

<template>
  <div class="app-right-panel-wrapper tiny-scrollbar lc-shell">
    <header class="panel-header">
      <h3 class="lc-panel-title">属性面板</h3>
      <p class="lc-panel-subtitle">支持属性、样式、数据三类配置（参考 openDataV）</p>
    </header>

    <div class="panel-content">
      <el-alert
        v-if="!hasSelectedFile"
        type="warning"
        :closable="false"
        title="请先在左侧目录选择一个文件，再进行画布配置。"
      />

      <section class="panel-section lc-panel">
        <div class="section-title">画布设置</div>

        <el-form label-position="top" size="small">
          <el-form-item label="布局策略">
            <el-alert
              type="info"
              :closable="false"
              title="页面布局由左侧「布局组件」控制，支持布局套布局与响应式组合。"
            />
          </el-form-item>

          <el-form-item v-if="designerState.layoutMode === 'grid9'" label="网格行数">
            <el-input-number
              :model-value="designerState.gridRows"
              :min="1"
              :max="20"
              :step="1"
              controls-position="right"
              @change="onCanvasGridRowsChange"
            />
            <p class="field-tip">控制 9 宫格画布的行数，避免出现过多空白区域。</p>
          </el-form-item>

          <el-form-item label="画布背景">
            <div class="color-row">
              <el-color-picker
                :model-value="designerState.canvasBackground"
                show-alpha
                @change="onCanvasBackgroundChange"
              />
              <el-input :model-value="designerState.canvasBackground" readonly />
            </div>
          </el-form-item>
        </el-form>
      </section>

      <section class="panel-section lc-panel">
        <div class="section-title">DSL</div>

        <div class="dsl-actions">
          <el-button type="primary" plain @click="onExportDsl">导出 JSON</el-button>
          <el-button type="success" plain @click="onOpenImportDialog">导入 JSON</el-button>
        </div>
      </section>

      <section class="panel-section lc-panel">
        <div class="section-title">画布对齐</div>
        <p class="canvas-size-tip">当前画布：{{ designerState.canvasWidth }} x {{ designerState.canvasHeight }}</p>

        <div class="align-actions">
          <el-button size="small" :disabled="!canAlignToCanvas" @click="onAlignSelectedNode('left')">左对齐</el-button>
          <el-button size="small" :disabled="!canAlignToCanvas" @click="onAlignSelectedNode('hCenter')">水平居中</el-button>
          <el-button size="small" :disabled="!canAlignToCanvas" @click="onAlignSelectedNode('right')">右对齐</el-button>
          <el-button size="small" :disabled="!canAlignToCanvas" @click="onAlignSelectedNode('top')">顶对齐</el-button>
          <el-button size="small" :disabled="!canAlignToCanvas" @click="onAlignSelectedNode('vCenter')">垂直居中</el-button>
          <el-button size="small" :disabled="!canAlignToCanvas" @click="onAlignSelectedNode('bottom')">底对齐</el-button>
        </div>

        <p class="section-tip">仅自由布局支持“对齐到画布”。</p>
      </section>

      <section class="panel-section lc-panel">
        <div class="section-title">图层面板</div>

        <template v-if="designerState.layoutMode === 'free'">
          <div v-if="layerNodes.length" class="layer-list">
            <div
              v-for="layerNode in layerNodes"
              :key="layerNode.id"
              class="layer-item"
              :class="{ active: selectedNode?.id === layerNode.id }"
              @click="onSelectLayerNode(layerNode.id)"
            >
              <div class="layer-main">
                <span class="layer-icon">{{ componentLibraryMap[layerNode.type]?.icon || '🧩' }}</span>
                <div class="layer-meta">
                  <span class="layer-title">{{ layerNode.title }}</span>
                  <span class="layer-subtitle">z-index {{ layerNode.zIndex }}</span>
                </div>
              </div>

              <div class="layer-state-actions">
                <el-switch
                  :model-value="layerNode.visible !== false"
                  inline-prompt
                  active-text="显"
                  inactive-text="隐"
                  size="small"
                  @click.stop
                  @change="onToggleLayerVisible(layerNode.id, Boolean($event))"
                />
                <el-switch
                  :model-value="layerNode.locked === true"
                  inline-prompt
                  active-text="锁"
                  inactive-text="动"
                  size="small"
                  @click.stop
                  @change="onToggleLayerLocked(layerNode.id, Boolean($event))"
                />
              </div>

              <div class="layer-order-actions" @click.stop>
                <el-button size="small" text @click="onMoveLayer(layerNode.id, 'top')">置顶</el-button>
                <el-button size="small" text @click="onMoveLayer(layerNode.id, 'up')">上移</el-button>
                <el-button size="small" text @click="onMoveLayer(layerNode.id, 'down')">下移</el-button>
                <el-button size="small" text @click="onMoveLayer(layerNode.id, 'bottom')">置底</el-button>
              </div>
            </div>
          </div>

          <div v-else class="empty-tip">当前画布还没有组件图层。</div>
        </template>

        <div v-else class="empty-tip">9宫格布局不支持图层顺序调整。</div>
      </section>

      <section class="panel-section lc-panel">
        <div class="section-title">选中组件</div>

        <template v-if="selectedNode && selectedComponentMeta">
          <div class="selected-meta">
            <span class="selected-badge" :style="{ backgroundColor: selectedComponentMeta.color }">
              {{ selectedComponentMeta.icon }}
            </span>
            <div>
              <p class="selected-title">{{ selectedComponentMeta.name }}</p>
              <p class="selected-type">{{ selectedNode.type }}</p>
            </div>
          </div>

          <el-form label-position="top" size="small">
            <el-form-item label="组件标题">
              <el-input :model-value="selectedNode.title" @update:model-value="onSelectedNodeTitleChange" />
            </el-form-item>

            <template v-if="canEditSelectedNodeFrame">
              <div class="number-grid">
                <el-form-item label="X">
                  <el-input-number
                    :model-value="selectedNode.x"
                    :min="0"
                    :step="1"
                    controls-position="right"
                    @change="onSelectedNodePositionChange('x', $event as number | null)"
                  />
                </el-form-item>
                <el-form-item label="Y">
                  <el-input-number
                    :model-value="selectedNode.y"
                    :min="0"
                    :step="1"
                    controls-position="right"
                    @change="onSelectedNodePositionChange('y', $event as number | null)"
                  />
                </el-form-item>
              </div>
            </template>

            <template v-else-if="selectedNode.parentId">
              <el-alert
                type="info"
                :closable="false"
                title="当前组件位于流式布局容器内，位置由父布局策略控制。"
              />
            </template>

            <template v-else>
              <el-form-item label="宫格位置">
                <el-select
                  :model-value="selectedNode.gridCell"
                  placeholder="请选择宫格"
                  @change="onSelectedNodeGridCellChange"
                >
                  <el-option
                    v-for="option in gridCellOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                    :disabled="option.disabled"
                  />
                </el-select>
              </el-form-item>
            </template>

            <template v-if="designerState.layoutMode === 'free'">
              <el-form-item label="尺寸模式">
                <el-select :model-value="selectedNodeSizeMode" @change="onSelectedNodeSizeModeChange">
                  <el-option label="固定大小（px）" value="fixed" />
                  <el-option label="响应式（%）" value="responsive" />
                </el-select>
              </el-form-item>

              <div class="number-grid">
                <template v-if="selectedNodeSizeMode === 'fixed'">
                  <el-form-item label="宽度 (px)">
                    <el-input-number
                      :model-value="selectedNode.width"
                      :min="1"
                      :step="1"
                      controls-position="right"
                      @change="onSelectedNodeFixedSizeChange('width', $event as number | null)"
                    />
                  </el-form-item>
                  <el-form-item label="高度 (px)">
                    <el-input-number
                      :model-value="selectedNode.height"
                      :min="1"
                      :step="1"
                      controls-position="right"
                      @change="onSelectedNodeFixedSizeChange('height', $event as number | null)"
                    />
                  </el-form-item>
                </template>

                <template v-else>
                  <el-form-item label="宽度 (%)">
                    <el-input-number
                      :model-value="resolveSelectedNodeSizePercent('widthPercent')"
                      :min="1"
                      :max="100"
                      :step="1"
                      controls-position="right"
                      @change="onSelectedNodeResponsiveSizeChange('widthPercent', $event as number | null)"
                    />
                  </el-form-item>
                  <el-form-item label="高度 (%)">
                    <el-input-number
                      :model-value="resolveSelectedNodeSizePercent('heightPercent')"
                      :min="1"
                      :max="100"
                      :step="1"
                      controls-position="right"
                      @change="onSelectedNodeResponsiveSizeChange('heightPercent', $event as number | null)"
                    />
                  </el-form-item>
                </template>
              </div>
            </template>
          </el-form>

          <el-tabs v-model="activePanelTab" class="config-tabs">
            <el-tab-pane label="属性配置" name="props">
              <el-form label-position="top" size="small">
                <template v-for="propItem in selectedPropSchema" :key="propItem.key">
                  <el-form-item :label="propItem.label">
                    <div v-if="isSelectOptionVisualProp(propItem)" class="visual-list-editor">
                      <div
                        v-for="(optionItem, optionIndex) in resolveVisualListItems(propItem.key, ['Option 1'])"
                        :key="`${propItem.key}-${optionIndex}`"
                        class="visual-list-row"
                      >
                        <el-input
                          :model-value="optionItem"
                          :placeholder="`选项 ${optionIndex + 1}`"
                          @update:model-value="onVisualListItemChange(propItem.key, optionIndex, $event)"
                        />
                        <el-button
                          size="small"
                          text
                          :disabled="resolveVisualListItems(propItem.key, ['Option 1']).length <= 1"
                          @click="onRemoveVisualListItem(propItem.key, optionIndex)"
                        >
                          删除
                        </el-button>
                      </div>

                      <div class="visual-list-actions">
                        <el-button size="small" plain @click="onAddVisualListItem(propItem.key)">新增选项</el-button>
                      </div>
                    </div>

                    <div v-else-if="isTableColumnVisualProp(propItem)" class="visual-list-editor">
                      <div
                        v-for="(columnItem, columnIndex) in resolveVisualListItems(propItem.key, ['col_1'])"
                        :key="`${propItem.key}-${columnIndex}`"
                        class="visual-list-row"
                      >
                        <el-input
                          :model-value="columnItem"
                          :placeholder="`列 ${columnIndex + 1}`"
                          @update:model-value="
                            selectedNode?.type === 'epTable'
                              ? onSelectedTableColumnChange(columnIndex, $event)
                              : onVisualListItemChange(propItem.key, columnIndex, $event)
                          "
                        />
                        <el-button
                          size="small"
                          text
                          :disabled="resolveVisualListItems(propItem.key, ['col_1']).length <= 1"
                          @click="
                            selectedNode?.type === 'epTable'
                              ? onRemoveSelectedTableColumn(columnIndex)
                              : onRemoveVisualListItem(propItem.key, columnIndex)
                          "
                        >
                          删除
                        </el-button>
                      </div>

                      <div class="visual-list-actions">
                        <el-button
                          size="small"
                          plain
                          @click="
                            selectedNode?.type === 'epTable'
                              ? onAddSelectedTableColumn()
                              : onAddVisualListItem(propItem.key)
                          "
                        >
                          新增列
                        </el-button>
                      </div>
                    </div>

                    <div v-else-if="isTableDataVisualProp(propItem)" class="visual-table-editor">
                      <div class="visual-table-toolbar">
                        <el-button size="small" type="primary" plain @click="onAddSelectedTableRow">新增行</el-button>
                        <el-button size="small" plain @click="onClearSelectedTableRows">清空</el-button>
                        <span class="field-tip">共 {{ visualTableRows.length }} 行</span>
                      </div>

                      <el-alert
                        v-if="!visualTableColumns.length"
                        type="warning"
                        :closable="false"
                        title="请先设置列定义，再编辑表格数据。"
                      />

                      <div v-else class="visual-table-grid">
                        <div class="visual-table-head" :style="buildVisualTableGridStyle()">
                          <span class="visual-table-cell visual-table-cell--index">#</span>
                          <span
                            v-for="columnKey in visualTableColumns"
                            :key="`table-head-${columnKey}`"
                            class="visual-table-cell visual-table-cell--header"
                          >
                            {{ columnKey }}
                          </span>
                          <span class="visual-table-cell visual-table-cell--action">操作</span>
                        </div>

                        <div v-if="!visualTableRows.length" class="visual-table-empty">暂无行数据，点击“新增行”。</div>

                        <div
                          v-for="(rowItem, rowIndex) in visualTableRows"
                          :key="`table-row-${rowIndex}`"
                          class="visual-table-row"
                          :style="buildVisualTableGridStyle()"
                        >
                          <span class="visual-table-cell visual-table-cell--index">{{ rowIndex + 1 }}</span>
                          <div
                            v-for="columnKey in visualTableColumns"
                            :key="`table-cell-${rowIndex}-${columnKey}`"
                            class="visual-table-cell"
                          >
                            <el-input
                              :model-value="resolveTableCellText(rowItem, columnKey)"
                              size="small"
                              @update:model-value="onSelectedTableCellChange(rowIndex, columnKey, $event)"
                            />
                          </div>
                          <div class="visual-table-cell visual-table-cell--action">
                            <el-button size="small" text @click="onRemoveSelectedTableRow(rowIndex)">删行</el-button>
                          </div>
                        </div>
                      </div>

                      <p class="field-tip">可视化编辑会同步到 data JSON。</p>
                    </div>

                    <div v-else-if="isPagedTableColumnSchemaProp(propItem)" class="paged-column-editor">
                      <div class="paged-column-toolbar">
                        <el-button size="small" type="primary" plain @click="onAddPagedTableColumnDraft">
                          新增列映射
                        </el-button>
                        <span class="field-tip">valueExpr 支持 ${row.xxx}、${obj.xxx.xx}</span>
                      </div>

                      <div class="paged-column-grid">
                        <div class="paged-column-head">
                          <span>key</span>
                          <span>label</span>
                          <span>valueExpr</span>
                          <span>minWidth</span>
                          <span>操作</span>
                        </div>

                        <div
                          v-for="(columnDraft, columnIndex) in pagedTableColumnDrafts"
                          :key="`paged-column-${columnIndex}`"
                          class="paged-column-row"
                        >
                          <el-input
                            :model-value="columnDraft.key"
                            size="small"
                            placeholder="id"
                            @update:model-value="onPagedTableColumnDraftChange(columnIndex, { key: $event })"
                          />
                          <el-input
                            :model-value="columnDraft.label"
                            size="small"
                            placeholder="ID"
                            @update:model-value="onPagedTableColumnDraftChange(columnIndex, { label: $event })"
                          />
                          <el-input
                            :model-value="columnDraft.valueExpr"
                            size="small"
                            placeholder="${row.id}"
                            @update:model-value="onPagedTableColumnDraftChange(columnIndex, { valueExpr: $event })"
                          />
                          <el-input-number
                            :model-value="columnDraft.minWidth"
                            :min="60"
                            :max="480"
                            :step="1"
                            controls-position="right"
                            @change="onPagedTableColumnDraftChange(columnIndex, { minWidth: Number($event || 120) })"
                          />
                          <div class="paged-column-actions">
                            <el-button size="small" text @click="onRemovePagedTableColumnDraft(columnIndex)">
                              删除
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <el-input
                      v-else-if="propItem.editor === 'input'"
                      :model-value="String(getSelectedNodePropValue(propItem.key) ?? '')"
                      :placeholder="propItem.placeholder || ''"
                      @update:model-value="onSelectedNodePropChange(propItem.key, $event)"
                    />

                    <el-input
                      v-else-if="propItem.editor === 'textarea' || propItem.editor === 'json'"
                      :model-value="String(getSelectedNodePropValue(propItem.key) ?? '')"
                      type="textarea"
                      :rows="resolvePropEditorRows(propItem)"
                      :placeholder="propItem.placeholder || ''"
                      @update:model-value="onSelectedNodePropChange(propItem.key, $event)"
                    />

                    <el-switch
                      v-else-if="propItem.editor === 'switch'"
                      :model-value="Boolean(getSelectedNodePropValue(propItem.key))"
                      @change="onSelectedNodePropChange(propItem.key, $event)"
                    />

                    <el-input-number
                      v-else-if="propItem.editor === 'number'"
                      :model-value="Number(getSelectedNodePropValue(propItem.key) || 0)"
                      :min="propItem.min"
                      :max="propItem.max"
                      :step="propItem.step || 1"
                      controls-position="right"
                      @change="onSelectedNodePropChange(propItem.key, Number($event || 0))"
                    />

                    <el-color-picker
                      v-else-if="propItem.editor === 'color'"
                      :model-value="String(getSelectedNodePropValue(propItem.key) || '')"
                      @change="onSelectedNodePropChange(propItem.key, $event)"
                    />

                    <el-select
                      v-else-if="propItem.editor === 'select'"
                      :model-value="getSelectedNodePropValue(propItem.key)"
                      @change="onSelectedNodePropChange(propItem.key, $event)"
                    >
                      <el-option
                        v-for="option in propItem.options || []"
                        :key="String(option.value)"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
                    <el-alert
                      v-if="propItem.key === 'chartOption' && chartOptionValidationHint"
                      class="chart-option-alert"
                      :type="chartOptionValidationHint.type"
                      :title="chartOptionValidationHint.title"
                      :description="chartOptionValidationHint.description"
                      :closable="false"
                    />
                  </el-form-item>
                </template>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="样式配置" name="style">
              <el-form label-position="top" size="small">
                <template v-for="styleItem in styleSchemaList" :key="styleItem.key">
                  <el-form-item :label="styleItem.label">
                    <el-color-picker
                      v-if="styleItem.editor === 'color'"
                      :model-value="String(getSelectedNodeStyleValue(styleItem.key) || '')"
                      show-alpha
                      @change="onSelectedNodeStyleChange(styleItem.key, $event)"
                    />

                    <el-input-number
                      v-else
                      :model-value="Number(getSelectedNodeStyleValue(styleItem.key) || 0)"
                      :min="styleItem.min"
                      :max="styleItem.max"
                      :step="styleItem.step || 1"
                      controls-position="right"
                      @change="onSelectedNodeStyleChange(styleItem.key, Number($event || 0))"
                    />
                  </el-form-item>
                </template>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="数据配置" name="data" :disabled="!selectedSupportsData">
              <template v-if="selectedSupportsData">
                <el-form label-position="top" size="small">
                  <el-form-item label="数据来源">
                    <el-select :model-value="selectedDataSourceType" @change="onDataSourceTypeChange">
                      <el-option
                        v-for="option in dataModeOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
                  </el-form-item>

                  <template v-if="selectedDataSourceType === 'SELF'">
                    <el-form-item :label="isPagedTableSelected ? 'demoData(JSON 对象/数组)' : 'demoData(JSON 数组)'">
                      <el-input
                        :model-value="String(getSelectedNodePropValue('demoData') || '')"
                        type="textarea"
                        :rows="6"
                        :placeholder="
                          isPagedTableSelected
                            ? '例如：{data:{records:[{id:1}],total:1,size:10,current:1,pages:1}}'
                            : '例如：[{name:Mon,value:20}]'
                        "
                        @update:model-value="onSelectedNodePropChange('demoData', $event)"
                      />
                    </el-form-item>
                    <el-button type="primary" plain size="small" @click="onValidateDemoData">校验 JSON</el-button>
                  </template>

                  <template v-else-if="selectedDataSourceType === 'STATIC'">
                    <el-form-item label="静态数据键">
                      <el-input
                        :model-value="String(getSelectedNodePropValue('staticDataKey') || '')"
                        placeholder="例如：dashboard.sales.top5"
                        @update:model-value="onSelectedNodePropChange('staticDataKey', $event)"
                      />
                    </el-form-item>
                    <el-form-item label="静态回退数据(JSON)">
                      <el-input
                        :model-value="String(getSelectedNodePropValue('demoData') || '')"
                        type="textarea"
                        :rows="4"
                        @update:model-value="onSelectedNodePropChange('demoData', $event)"
                      />
                    </el-form-item>
                  </template>

                  <template v-else>
                    <el-form-item label="请求方法">
                      <el-select
                        :model-value="String(getSelectedNodePropValue('restMethod') || 'GET')"
                        @change="onSelectedNodePropChange('restMethod', $event)"
                      >
                        <el-option
                          v-for="option in restMethodOptions"
                          :key="option.value"
                          :label="option.label"
                          :value="option.value"
                        />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="请求地址">
                      <el-input
                        :model-value="String(getSelectedNodePropValue('restUrl') || '')"
                        placeholder="https://api.example.com/data"
                        @update:model-value="onSelectedNodePropChange('restUrl', $event)"
                      />
                    </el-form-item>

                    <el-form-item label="请求体(JSON)">
                      <el-input
                        :model-value="String(getSelectedNodePropValue('restBody') || '')"
                        type="textarea"
                        :rows="4"
                        @update:model-value="onSelectedNodePropChange('restBody', $event)"
                      />
                    </el-form-item>
                  </template>

                  <el-form-item label="数据转换脚本">
                    <el-input
                      :model-value="String(getSelectedNodePropValue('dataScript') || '')"
                      type="textarea"
                      :rows="3"
                      placeholder="示例：return resp.data.list"
                      @update:model-value="onSelectedNodePropChange('dataScript', $event)"
                    />
                  </el-form-item>
                </el-form>
              </template>

              <div v-else class="empty-tip">当前组件不支持数据驱动配置。</div>
            </el-tab-pane>
          </el-tabs>

          <div class="component-actions">
            <el-button type="danger" plain @click="onDeleteSelectedNode">删除组件</el-button>
            <el-button type="primary" plain @click="onDuplicateSelectedNode">复制组件</el-button>
          </div>
        </template>

        <div v-else class="empty-tip">请先在画布中点击一个组件，再进行属性配置。</div>
      </section>
    </div>

    <el-dialog v-model="importDialogVisible" title="导入 DSL JSON" width="560px">
      <el-input
        v-model="importDslText"
        type="textarea"
        :rows="12"
        placeholder="请粘贴导出的 DSL JSON 内容"
      />

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onApplyImportDsl">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.app-right-panel-wrapper {
  width: 100%;
  height: 100%;
  box-shadow: var(--lc-color-border) -1px 0 0;
  background: var(--lc-color-bg-panel);
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: var(--lc-spacing-3);
  border-bottom: 1px solid var(--lc-color-divider);
  background: linear-gradient(180deg, var(--lc-color-bg-panel-soft) 0%, var(--lc-color-bg-panel) 100%);
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--lc-spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--lc-spacing-3);
}

.panel-section {
  padding: var(--lc-spacing-3);
  border-radius: var(--lc-radius-md);
  border-color: var(--lc-color-border);
  box-shadow: none;
}

.section-title {
  font-size: var(--lc-font-size-sm);
  font-weight: var(--lc-font-weight-bold);
  color: var(--lc-color-text-2);
  margin-bottom: var(--lc-spacing-2);
}

.color-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--lc-spacing-2);
}

.dsl-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lc-spacing-2);
}

.canvas-size-tip {
  margin-bottom: var(--lc-spacing-2);
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
}

.align-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lc-spacing-2);
}

.section-tip {
  margin-top: var(--lc-spacing-2);
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
}

.field-tip {
  margin: 8px 0 0;
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
}

.visual-list-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visual-list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.visual-list-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.visual-table-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.visual-table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.visual-table-grid {
  border: 1px solid var(--lc-color-border);
  border-radius: var(--lc-radius-sm);
  overflow: auto;
  max-height: 280px;
  background: var(--lc-color-bg-panel);
}

.visual-table-head,
.visual-table-row {
  display: grid;
  min-width: max-content;
}

.visual-table-row {
  border-top: 1px solid var(--lc-color-divider);
}

.visual-table-cell {
  padding: 6px;
  display: flex;
  align-items: center;
  min-height: 38px;
  border-right: 1px solid var(--lc-color-divider);
}

.visual-table-cell:last-child {
  border-right: none;
}

.visual-table-cell--index,
.visual-table-cell--action {
  justify-content: center;
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
  background: var(--lc-color-bg-subtle);
}

.visual-table-cell--header {
  font-size: var(--lc-font-size-sm);
  font-weight: var(--lc-font-weight-semibold);
  color: var(--lc-color-text-2);
  background: var(--lc-color-bg-subtle);
}

.visual-table-empty {
  padding: 12px;
  text-align: center;
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
}

.paged-column-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.paged-column-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.paged-column-grid {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--lc-color-border);
  border-radius: var(--lc-radius-sm);
  overflow: hidden;
}

.paged-column-head,
.paged-column-row {
  display: grid;
  grid-template-columns: 96px 120px minmax(180px, 1fr) 110px 56px;
  gap: 8px;
  align-items: center;
  padding: 8px;
}

.paged-column-head {
  background: var(--lc-color-bg-subtle);
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-2);
  font-weight: var(--lc-font-weight-semibold);
}

.paged-column-row {
  border-top: 1px solid var(--lc-color-divider);
}

.paged-column-actions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-option-alert {
  margin-top: 8px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: var(--lc-spacing-2);
}

.layer-item {
  border: 1px solid var(--lc-color-border);
  border-radius: var(--lc-radius-sm);
  padding: var(--lc-spacing-2);
  display: flex;
  flex-direction: column;
  gap: var(--lc-spacing-2);
  cursor: pointer;
  transition:
    border-color var(--lc-transition-fast),
    box-shadow var(--lc-transition-fast);
}

.layer-item:hover {
  border-color: var(--lc-color-primary);
}

.layer-item.active {
  border-color: var(--lc-color-primary);
  box-shadow: 0 0 0 1px rgb(0 122 255 / 20%);
}

.layer-main {
  display: flex;
  align-items: center;
  gap: var(--lc-spacing-2);
}

.layer-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--lc-radius-xs);
  background: rgb(0 122 255 / 10%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--lc-color-text-2);
}

.layer-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.layer-title {
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-1);
  font-weight: var(--lc-font-weight-semibold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-subtitle {
  margin-top: 2px;
  font-size: var(--lc-font-size-xs);
  color: var(--lc-color-text-3);
}

.layer-state-actions {
  display: flex;
  align-items: center;
  gap: var(--lc-spacing-2);
}

.layer-order-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--lc-spacing-1);
}

.selected-meta {
  display: flex;
  align-items: center;
  gap: var(--lc-spacing-2);
  margin-bottom: var(--lc-spacing-2);
  padding: var(--lc-spacing-2);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-color-primary-soft);
  border: 1px solid rgb(0 122 255 / 12%);
}

.selected-badge {
  width: 28px;
  height: 28px;
  border-radius: var(--lc-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-size: 13px;
  font-weight: var(--lc-font-weight-bold);
}

.selected-title {
  font-size: var(--lc-font-size-sm);
  font-weight: var(--lc-font-weight-bold);
  color: var(--lc-color-text-1);
}

.selected-type {
  margin-top: 2px;
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
}

.number-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.config-tabs {
  margin-top: var(--lc-spacing-2);
}

.component-actions {
  margin-top: var(--lc-spacing-2);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lc-spacing-2);
}

.empty-tip {
  font-size: var(--lc-font-size-sm);
  line-height: 1.6;
  color: var(--lc-color-text-3);
}

:deep(.el-tabs__header) {
  margin-bottom: var(--lc-spacing-2);
}

:deep(.el-tabs__item) {
  font-size: var(--lc-font-size-sm);
}

:deep(.el-form-item) {
  margin-bottom: var(--lc-spacing-2);
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-input-number),
:deep(.el-select__wrapper) {
  border-radius: var(--lc-radius-sm);
}
</style>
