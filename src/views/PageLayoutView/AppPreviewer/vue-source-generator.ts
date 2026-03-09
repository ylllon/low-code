import type {
  CanvasComponentNode,
  CanvasLayoutMode
} from '@/views/PageLayoutView/component-library'
import {
  buildDefaultChartOption,
  parseCustomChartOption
} from '@/views/PageLayoutView/AppPreviewer/echarts-option.utils'
import {
  isElementPlusAutoComponentType,
  resolveElementPlusAutoOptionItems,
  resolveElementPlusAutoSourceProps,
  resolveElementPlusAutoSlotText,
  resolveElementPlusAutoTableColumnKeys,
  resolveElementPlusAutoTableData,
  resolveElementPlusAutoTag
} from '@/views/PageLayoutView/component-library.element-plus'
import {
  type PagedTableColumnSchemaItem,
  parsePagedTableColumnSchema,
  toSafeInt
} from '@/views/PageLayoutView/AppPreviewer/paged-table.utils'

interface GeneratorInput {
  layoutMode: CanvasLayoutMode
  gridRows: number
  canvasBackground: string
  nodes: CanvasComponentNode[]
}

interface ChartBinding {
  node: CanvasComponentNode
  refVar: string
  insVar: string
  optVar: string
  initFn: string
}

interface PagedTableBinding {
  node: CanvasComponentNode
  rowsVar: string
  totalVar: string
  sizeVar: string
  currentVar: string
  loadingVar: string
  columnsVar: string
  configVar: string
  mapRowsFn: string
  fetchFn: string
  onCurrentChangeFn: string
  onSizeChangeFn: string
}

interface SimpleFormFieldModel {
  key: string
  label: string
  type: 'input' | 'select' | 'switch' | 'datePicker'
  placeholder: string
  options: string[]
  pickerType: string
  activeText: string
  inactiveText: string
  initialValue: any
}

interface SimplePagedTableModel {
  columns: Array<{ key: string; label: string; fieldKey: string; minWidth?: number }>
  pageParamKey: string
  sizeParamKey: string
  pageSizeOptions: number[]
  pageSize: number
  currentPage: number
  paginationLayout: string
  restUrl: string
  recordsExpr: string
  totalExpr: string
  usesDirectRows: boolean
}

interface SemanticRenderContext {
  input: GeneratorInput
  nodeMap: Map<string, CanvasComponentNode>
  childrenMap: Record<string, CanvasComponentNode[]>
  pagedTableNodeId: string | null
  pagedTableModel: SimplePagedTableModel | null
}

interface RenderContext {
  input: GeneratorInput
  nodeMap: Map<string, CanvasComponentNode>
  childrenMap: Record<string, CanvasComponentNode[]>
  nodeClassMap: Record<string, string>
  chartBindings: ChartBinding[]
  pagedTableBindings: PagedTableBinding[]
  tabDefaults: Record<string, string>
}

const CHART_TYPES = new Set(['barChart', 'lineChart', 'pieChart', 'gaugeChart', 'customChart'])
const SIMPLE_FORM_FIELD_TYPES = new Set(['input', 'select', 'switch', 'datePicker'])
const SIMPLE_LAYOUT_CHAIN_TYPES = new Set(['layoutRow', 'layoutColumn', 'layoutContainer'])
const SIMPLE_PAGE_NODE_TYPES = new Set([
  'input',
  'select',
  'switch',
  'datePicker',
  'button',
  'text',
  'divider',
  'table',
  'pagedTable'
])
const LAYOUT_TYPES = new Set([
  'layoutRow',
  'layoutColumn',
  'layoutGrid',
  'layoutContainer',
  'layoutFree',
  'layoutCard',
  'layoutTabs',
  'layoutHeader',
  'layoutSidebar',
  'layoutFooter'
])

function escHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toKebabToken(raw: string, fallback = 'node') {
  const token = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/--+/g, '-')
  return token || fallback
}

function toShortHash(raw: string) {
  let hash = 0
  for (const char of raw) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash.toString(36).slice(-5).padStart(5, '0')
}

function buildNodeClassMap(nodes: CanvasComponentNode[]) {
  const classMap: Record<string, string> = {}
  const usedClassSet = new Set<string>()

  nodes.forEach((node) => {
    const typeToken = toKebabToken(node.type, 'node')
    const baseClass = `lc-node--${typeToken}-${toShortHash(node.id)}`
    let className = baseClass
    let suffix = 1
    while (usedClassSet.has(className)) {
      suffix += 1
      className = `${baseClass}-${suffix}`
    }
    usedClassSet.add(className)
    classMap[node.id] = className
  })

  return classMap
}

function n(value: any, fallback: number, min = 0, max = Number.POSITIVE_INFINITY) {
  const valueNum = Number(value)
  if (!Number.isFinite(valueNum)) {
    return fallback
  }
  return Math.min(Math.max(Math.round(valueNum), min), max)
}

function parseList(raw: any, fallback: string[]) {
  if (typeof raw !== 'string') {
    return fallback
  }
  const list = raw
    .split(/\n|\||,/g)
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length ? list : fallback
}

function toCamelToken(raw: string, fallback = 'token') {
  const kebabToken = toKebabToken(raw, fallback)
  const parts = kebabToken.split('-').filter(Boolean)
  if (!parts.length) {
    return fallback
  }
  return (
    parts[0] +
    parts
      .slice(1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  )
}

function buildUniqueToken(seed: string, fallback: string, usedTokens: Set<string>) {
  const baseToken = toCamelToken(seed, fallback)
  let nextToken = baseToken
  let suffix = 1
  while (usedTokens.has(nextToken)) {
    suffix += 1
    nextToken = `${baseToken}${suffix}`
  }
  usedTokens.add(nextToken)
  return nextToken
}

function isValidIdentifier(raw: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw)
}

function normalizeSourcePathSegments(pathExpr: string, rootToken: string) {
  const normalizedPath = String(pathExpr || '').trim()
  if (!normalizedPath) {
    return [] as string[]
  }

  const unwrapped =
    normalizedPath.startsWith('${') && normalizedPath.endsWith('}')
      ? normalizedPath.slice(2, -1).trim()
      : normalizedPath
  const withoutRoot =
    unwrapped === rootToken
      ? ''
      : unwrapped.startsWith(`${rootToken}.`)
        ? unwrapped.slice(rootToken.length + 1)
        : unwrapped

  return withoutRoot
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function buildOptionalAccessExpr(rootExpr: string, pathExpr: string, rootToken: string) {
  const segments = normalizeSourcePathSegments(pathExpr, rootToken)
  if (!segments.length) {
    return rootExpr
  }

  return `${rootExpr}${segments
    .map((segment) =>
      isValidIdentifier(segment) ? `?.${segment}` : `?.[${JSON.stringify(segment)}]`
    )
    .join('')}`
}

function buildOptionalMemberAccessExpr(rootExpr: string, key: string) {
  return isValidIdentifier(key) ? `${rootExpr}?.${key}` : `${rootExpr}?.[${JSON.stringify(key)}]`
}

function renderObjectLiteralKey(rawKey: string) {
  return isValidIdentifier(rawKey) ? rawKey : JSON.stringify(rawKey)
}

function resolveSimplePagedTableColumns(columns: PagedTableColumnSchemaItem[]) {
  const normalizedColumns = columns.map((column, index) => {
    const key = String(column.key || '').trim()
    const label = String(column.label || key || `Column ${index + 1}`).trim()
    const valueExpr = String(column.valueExpr || '').trim()
    const match = valueExpr.match(/^\$\{row\.([A-Za-z_$][A-Za-z0-9_$]*)\}$/)

    if (!match) {
      return null
    }

    const minWidthValue = Number(column.minWidth)

    return {
      key: key || match[1],
      label: label || match[1],
      fieldKey: match[1],
      minWidth: Number.isFinite(minWidthValue) ? Math.max(60, Math.round(minWidthValue)) : undefined
    }
  })

  return normalizedColumns.every(Boolean)
    ? (normalizedColumns as Array<{
        key: string
        label: string
        fieldKey: string
        minWidth?: number
      }>)
    : null
}

function buildSimplePagedTableModel(node: CanvasComponentNode) {
  const rawProps = node.props || {}
  const sourceType = String(rawProps.dataSourceType || 'SELF')
    .trim()
    .toUpperCase()
  const requestMethod = String(rawProps.restMethod || 'GET')
    .trim()
    .toUpperCase()
  const restUrl = String(rawProps.restUrl || '').trim()

  if (sourceType !== 'REST' || requestMethod !== 'GET' || !restUrl) {
    return null
  }

  const fallbackColumns = String(rawProps.columns || '')
  const parsedColumns = parsePagedTableColumnSchema(rawProps.columnSchema, fallbackColumns)
  const simpleColumns = resolveSimplePagedTableColumns(parsedColumns)

  if (!simpleColumns?.length) {
    return null
  }

  return {
    columns: simpleColumns,
    pageParamKey: String(rawProps.pageParamKey || 'current').trim() || 'current',
    sizeParamKey: String(rawProps.sizeParamKey || 'size').trim() || 'size',
    pageSizeOptions: parseList(rawProps.pageSizeOptions, ['10', '20', '50', '100'])
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0),
    pageSize: Math.max(1, toSafeInt(rawProps.pageSize, 10, 1, 9999)),
    currentPage: Math.max(1, toSafeInt(rawProps.currentPage, 1, 1, 9999)),
    paginationLayout:
      String(rawProps.paginationLayout || 'total, sizes, prev, pager, next').trim() ||
      'total, sizes, prev, pager, next',
    restUrl,
    recordsExpr: buildOptionalAccessExpr(
      'responseData',
      String(rawProps.recordsPath || 'obj.data.records'),
      'obj'
    ),
    totalExpr: buildOptionalAccessExpr(
      'responseData',
      String(rawProps.totalPath || 'obj.data.total'),
      'obj'
    ),
    usesDirectRows: simpleColumns.every((column) => column.key === column.fieldKey)
  } satisfies SimplePagedTableModel
}

function buildSimplePagedTableTemplateLines(model: SimplePagedTableModel, depth: number) {
  const lines: string[] = []
  lines.push(
    `${id(depth)}<el-table v-loading="loading" :data="tableData" border stripe style="width: 100%">`
  )
  model.columns.forEach((column) => {
    const widthAttr = column.minWidth ? ` :min-width="${column.minWidth}"` : ''
    lines.push(
      `${id(depth + 1)}<el-table-column prop="${escHtml(column.key)}" label="${escHtml(column.label)}"${widthAttr} />`
    )
  })
  lines.push(`${id(depth)}</el-table>`)
  lines.push('')
  lines.push(`${id(depth)}<el-pagination`)
  lines.push(`${id(depth + 1)}class="pagination-container"`)
  lines.push(`${id(depth + 1)}v-model:current-page="pagination.currentPage"`)
  lines.push(`${id(depth + 1)}v-model:page-size="pagination.pageSize"`)
  lines.push(
    `${id(depth + 1)}:page-sizes='${JSON.stringify(model.pageSizeOptions.length ? model.pageSizeOptions : [10, 20, 50, 100])}'`
  )
  lines.push(`${id(depth + 1)}:total="total"`)
  lines.push(`${id(depth + 1)}layout="${escHtml(model.paginationLayout)}"`)
  lines.push(`${id(depth + 1)}@size-change="handleSizeChange"`)
  lines.push(`${id(depth + 1)}@current-change="handleCurrentChange"`)
  lines.push(`${id(depth)}/>`)
  return lines
}

function buildSimplePagedTableScriptLines(model: SimplePagedTableModel, queryParamsExpr = '') {
  const lines: string[] = []
  lines.push('const loading = ref(false)')
  lines.push('const tableData = ref([])')
  lines.push('const pagination = ref({')
  lines.push(`  currentPage: ${model.currentPage},`)
  lines.push(`  pageSize: ${model.pageSize}`)
  lines.push('})')
  lines.push('const total = ref(0)')

  if (!model.usesDirectRows) {
    lines.push('')
    lines.push('const normalizeTableData = rows => {')
    lines.push('  return rows.map(item => ({')
    model.columns.forEach((column, index) => {
      const suffix = index === model.columns.length - 1 ? '' : ','
      lines.push(
        `    ${renderObjectLiteralKey(column.key)}: ${buildOptionalMemberAccessExpr('item', column.fieldKey)}${suffix}`
      )
    })
    lines.push('  }))')
    lines.push('}')
  }

  lines.push('')
  lines.push('const isSuccessCode = code => {')
  lines.push(
    "  return typeof code === 'undefined' || code === null || code === 0 || code === 200 || code === '0' || code === '200'"
  )
  lines.push('}')
  lines.push('')
  lines.push('const fetchData = async () => {')
  lines.push('  loading.value = true')
  lines.push('  try {')
  lines.push(`    const res = await axios.get(${JSON.stringify(model.restUrl)}, {`)
  lines.push('      params: {')
  if (queryParamsExpr) {
    lines.push(`        ...${queryParamsExpr},`)
  }
  lines.push(`        ${renderObjectLiteralKey(model.pageParamKey)}: pagination.value.currentPage,`)
  lines.push(`        ${renderObjectLiteralKey(model.sizeParamKey)}: pagination.value.pageSize`)
  lines.push('      }')
  lines.push('    })')
  lines.push('')
  lines.push('    const responseData = res.data || {}')
  lines.push(`    const records = Array.isArray(${model.recordsExpr}) ? ${model.recordsExpr} : []`)
  lines.push(`    const nextTotal = Number(${model.totalExpr})`)
  lines.push('')
  lines.push('    if (isSuccessCode(responseData?.code)) {')
  lines.push(
    `      tableData.value = ${model.usesDirectRows ? 'records' : 'normalizeTableData(records)'}`
  )
  lines.push('      total.value = Number.isFinite(nextTotal) ? nextTotal : records.length')
  lines.push('    } else {')
  lines.push("      ElMessage.error(responseData?.message || '获取数据失败')")
  lines.push('      tableData.value = []')
  lines.push('      total.value = 0')
  lines.push('    }')
  lines.push('  } catch (error) {')
  lines.push("    ElMessage.error('网络异常，请稍后重试')")
  lines.push('    console.error(error)')
  lines.push('    tableData.value = []')
  lines.push('    total.value = 0')
  lines.push('  } finally {')
  lines.push('    loading.value = false')
  lines.push('  }')
  lines.push('}')
  lines.push('')
  lines.push('const handleSizeChange = size => {')
  lines.push('  pagination.value.pageSize = size')
  lines.push('  pagination.value.currentPage = 1')
  lines.push('  fetchData()')
  lines.push('}')
  lines.push('')
  lines.push('const handleCurrentChange = page => {')
  lines.push('  pagination.value.currentPage = page')
  lines.push('  fetchData()')
  lines.push('}')
  return lines
}

function collectSimpleFlatNodes(input: GeneratorInput) {
  const visibleNodes = input.nodes
    .filter((node) => node.visible !== false)
    .map((node) => ({ ...node }))
  const childrenMap = groupChildren(visibleNodes)

  const walk = (
    parentId: string | null,
    parentType: string | null
  ): CanvasComponentNode[] | null => {
    const currentNodes = sortNodes(
      childrenMap[parentId || '__root__'] || [],
      input.layoutMode,
      parentType
    )
    const result: CanvasComponentNode[] = []

    for (const node of currentNodes) {
      if (LAYOUT_TYPES.has(node.type)) {
        if (!SIMPLE_LAYOUT_CHAIN_TYPES.has(node.type)) {
          return null
        }
        const nestedNodes = walk(node.id, node.type)
        if (!nestedNodes) {
          return null
        }
        result.push(...nestedNodes)
        continue
      }

      if (!SIMPLE_PAGE_NODE_TYPES.has(node.type)) {
        return null
      }

      result.push(node)
    }

    return result
  }

  return walk(null, null)
}

function resolveSimpleFieldLabel(node: CanvasComponentNode, index: number) {
  const title = String(node.title || '').trim()
  const genericTitleSet = new Set(['输入框', '下拉框', '开关', '日期选择', '按钮', '文本'])
  if (title && !genericTitleSet.has(title)) {
    return title
  }

  const placeholder = String(node.props?.placeholder || '').trim()
  if (placeholder) {
    const normalizedPlaceholder = placeholder.replace(/^请(?:输入|选择)/, '').trim()
    if (normalizedPlaceholder) {
      return normalizedPlaceholder
    }
  }

  if (node.type === 'switch') {
    const switchLabel = String(node.props?.activeText || '').trim()
    if (switchLabel) {
      return switchLabel
    }
  }

  return `字段${index + 1}`
}

function buildSimpleFormFieldModels(nodes: CanvasComponentNode[]) {
  const usedKeys = new Set<string>()
  let fieldIndex = 0

  return nodes
    .filter((node) => SIMPLE_FORM_FIELD_TYPES.has(node.type))
    .map((node) => {
      const label = resolveSimpleFieldLabel(node, fieldIndex)
      const key = buildUniqueToken(label, `field${fieldIndex + 1}`, usedKeys)
      fieldIndex += 1

      if (node.type === 'select') {
        return {
          key,
          label,
          type: 'select',
          placeholder: String(node.props?.placeholder || '请选择'),
          options: parseList(node.props?.options, ['选项1', '选项2']),
          pickerType: 'date',
          activeText: '',
          inactiveText: '',
          initialValue: String(node.props?.value || '')
        } satisfies SimpleFormFieldModel
      }

      if (node.type === 'switch') {
        return {
          key,
          label,
          type: 'switch',
          placeholder: '',
          options: [],
          pickerType: 'date',
          activeText: String(node.props?.activeText || '开启'),
          inactiveText: String(node.props?.inactiveText || '关闭'),
          initialValue: node.props?.checked === true
        } satisfies SimpleFormFieldModel
      }

      if (node.type === 'datePicker') {
        const pickerType = String(node.props?.pickerType || 'date')
        return {
          key,
          label,
          type: 'datePicker',
          placeholder: String(node.props?.placeholder || '请选择日期'),
          options: [],
          pickerType,
          activeText: '',
          inactiveText: '',
          initialValue: pickerType === 'daterange' ? [] : ''
        } satisfies SimpleFormFieldModel
      }

      return {
        key,
        label,
        type: 'input',
        placeholder: String(node.props?.placeholder || '请输入内容'),
        options: [],
        pickerType: 'date',
        activeText: '',
        inactiveText: '',
        initialValue: String(node.props?.value || '')
      } satisfies SimpleFormFieldModel
    })
}

function buildObjectLiteralLines(source: Record<string, any>, depth: number) {
  const lines: string[] = []
  lines.push(`${id(depth)}({`)
  const entries = Object.entries(source)
  entries.forEach(([key, value], index) => {
    const suffix = index === entries.length - 1 ? '' : ','
    lines.push(`${id(depth + 1)}${renderObjectLiteralKey(key)}: ${JSON.stringify(value)}${suffix}`)
  })
  lines.push(`${id(depth)}})`)
  return lines
}

function getNodeDisplayText(node: CanvasComponentNode) {
  if (node.type === 'text') {
    return String(node.props?.text || node.title || '').trim()
  }
  if (node.type === 'button') {
    return String(node.props?.text || node.title || '按钮').trim()
  }
  return String(node.title || '').trim()
}

function isSearchButtonText(text: string) {
  return /查询|搜索/i.test(text)
}

function isResetButtonText(text: string) {
  return /重置|清空/i.test(text)
}

function buildSimplePageStyle(background: string) {
  const lines: string[] = []
  lines.push('<style scoped>')
  lines.push('.simple-page {')
  lines.push('  min-height: 100%;')
  lines.push('  padding: 20px;')
  lines.push('  box-sizing: border-box;')
  lines.push(`  background: ${background || '#f8fafc'};`)
  lines.push('}')
  lines.push('.page-header {')
  lines.push('  margin-bottom: 16px;')
  lines.push('}')
  lines.push('.page-title {')
  lines.push('  margin: 0;')
  lines.push('  font-size: 24px;')
  lines.push('  font-weight: 600;')
  lines.push('  color: #1f2937;')
  lines.push('}')
  lines.push('.page-description {')
  lines.push('  margin: 8px 0 0;')
  lines.push('  line-height: 1.6;')
  lines.push('  color: #64748b;')
  lines.push('}')
  lines.push('.page-card {')
  lines.push('  margin-bottom: 16px;')
  lines.push('}')
  lines.push('.page-actions {')
  lines.push('  margin-bottom: 16px;')
  lines.push('  display: flex;')
  lines.push('  flex-wrap: wrap;')
  lines.push('  gap: 12px;')
  lines.push('}')
  lines.push('.page-form :deep(.el-form-item) {')
  lines.push('  margin-bottom: 16px;')
  lines.push('}')
  lines.push('.page-form--inline :deep(.el-form-item) {')
  lines.push('  margin-bottom: 12px;')
  lines.push('}')
  lines.push('.page-note {')
  lines.push('  margin: 12px 0 0;')
  lines.push('  color: #64748b;')
  lines.push('  line-height: 1.6;')
  lines.push('}')
  lines.push('.pagination-container {')
  lines.push('  margin-top: 16px;')
  lines.push('  display: flex;')
  lines.push('  justify-content: flex-end;')
  lines.push('}')
  lines.push('</style>')
  return lines.join('\n')
}

function buildStyleAttr(entries: Array<[string, string | number | false | null | undefined]>) {
  const serialized = entries
    .filter(
      ([, value]) =>
        value !== false && value !== null && typeof value !== 'undefined' && value !== ''
    )
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('; ')

  return serialized ? ` style="${escHtml(`${serialized};`)}"` : ''
}

function createSemanticRenderContext(input: GeneratorInput): SemanticRenderContext | null {
  const nodes = input.nodes.filter((node) => node.visible !== false).map((node) => ({ ...node }))
  if (!nodes.length) {
    return null
  }

  const pagedTableNodes = nodes.filter((node) => node.type === 'pagedTable')
  if (pagedTableNodes.length > 1) {
    return null
  }

  for (const node of nodes) {
    if (
      CHART_TYPES.has(node.type) ||
      node.type === 'layoutTabs' ||
      isElementPlusAutoComponentType(node.type)
    ) {
      return null
    }

    if (node.type === 'pagedTable' && !buildSimplePagedTableModel(node)) {
      return null
    }
  }

  return {
    input,
    nodeMap: new Map(nodes.map((node) => [node.id, node])),
    childrenMap: groupChildren(nodes),
    pagedTableNodeId: pagedTableNodes[0]?.id || null,
    pagedTableModel: pagedTableNodes[0] ? buildSimplePagedTableModel(pagedTableNodes[0]) : null
  }
}

function collectSemanticNodeStyleEntries(
  node: CanvasComponentNode,
  context: SemanticRenderContext
) {
  const parentNode = node.parentId ? context.nodeMap.get(node.parentId) || null : null
  const isAbsolute = parentNode
    ? parentNode.type === 'layoutFree' || parentNode.type === 'layoutTabs'
    : context.input.layoutMode === 'free'
  const size = resolveSize(node, parentNode)
  const entries: Array<[string, string | number | false | null | undefined]> = [
    ['box-sizing', 'border-box'],
    ['min-width', 0]
  ]

  if (isAbsolute) {
    entries.push(
      ['position', 'absolute'],
      ['left', `${Math.max(0, n(node.x, 0))}px`],
      ['top', `${Math.max(0, n(node.y, 0))}px`],
      ['width', size.width],
      ['height', size.height],
      ['z-index', Math.max(1, n(node.zIndex, 1))]
    )
  } else {
    entries.push(['position', 'relative'], ['width', size.width], ['min-height', size.height])
  }

  if (!parentNode && context.input.layoutMode === 'grid9' && typeof node.gridCell === 'number') {
    entries.push(
      ['grid-column', (node.gridCell % 3) + 1],
      ['grid-row', Math.floor(node.gridCell / 3) + 1]
    )
  }

  if (node.type === 'layoutHeader' || node.type === 'layoutFooter') {
    entries.push(['min-height', `${n(node.props?.height, node.height, 40, 400)}px`])
  }

  if (node.type === 'layoutSidebar') {
    entries.push(['width', `${n(node.props?.sidebarWidth, node.width, 120, 520)}px`])
  }

  if (node.style?.color) entries.push(['color', String(node.style.color)])
  if (node.style?.backgroundColor) entries.push(['background', String(node.style.backgroundColor)])
  if (node.style?.fontSize) entries.push(['font-size', `${n(node.style.fontSize, 14)}px`])
  if (node.style?.fontWeight) entries.push(['font-weight', String(node.style.fontWeight)])
  if (node.style?.borderRadius !== undefined) {
    entries.push(['border-radius', `${n(node.style.borderRadius, 0)}px`])
  }

  return entries
}

function collectSemanticLayoutStyleEntries(node: CanvasComponentNode) {
  const gap = `${n(node.props?.gap, 0)}px`
  const padding = `${n(node.props?.padding, 0)}px`
  const entries: Array<[string, string | number | false | null | undefined]> = [
    ['box-sizing', 'border-box'],
    ['width', '100%'],
    ['height', '100%']
  ]

  if (node.type === 'layoutRow') {
    entries.push(
      ['display', 'flex'],
      ['flex-wrap', node.props?.wrap === false ? 'nowrap' : 'wrap'],
      ['justify-content', String(node.props?.justify || 'flex-start')],
      ['align-items', String(node.props?.align || 'stretch')],
      ['gap', gap],
      ['padding', padding]
    )
    return entries
  }

  if (
    node.type === 'layoutColumn' ||
    node.type === 'layoutContainer' ||
    node.type === 'layoutSidebar'
  ) {
    entries.push(
      ['display', 'flex'],
      ['flex-direction', 'column'],
      ['justify-content', String(node.props?.justify || 'flex-start')],
      ['align-items', String(node.props?.align || 'stretch')],
      ['gap', gap],
      ['padding', padding]
    )
    return entries
  }

  if (node.type === 'layoutHeader' || node.type === 'layoutFooter') {
    entries.push(
      ['display', 'flex'],
      ['justify-content', String(node.props?.justify || 'space-between')],
      ['align-items', String(node.props?.align || 'center')],
      ['gap', gap],
      ['padding', padding]
    )
    return entries
  }

  if (node.type === 'layoutGrid') {
    entries.push(
      ['display', 'grid'],
      ['--grid-desktop', n(node.props?.columnsDesktop, 4, 1, 24)],
      ['--grid-tablet', n(node.props?.columnsTablet, 2, 1, 24)],
      ['--grid-mobile', n(node.props?.columnsMobile, 1, 1, 24)],
      ['grid-template-columns', 'repeat(var(--grid-desktop), minmax(0, 1fr))'],
      ['grid-template-rows', `repeat(${n(node.props?.rows, 3, 1, 24)}, minmax(0, auto))`],
      ['gap', gap],
      ['padding', padding]
    )
    return entries
  }

  if (node.type === 'layoutFree') {
    entries.push(['display', 'block'], ['position', 'relative'], ['padding', padding])
    return entries
  }

  return entries
}

function buildSemanticCanvasStyle(input: GeneratorInput) {
  const entries: Array<[string, string | number | false | null | undefined]> = [
    ['box-sizing', 'border-box'],
    ['padding', '20px'],
    ['border-radius', '16px'],
    ['min-height', 'calc(100vh - 40px)'],
    ['background', input.canvasBackground || '#ffffff']
  ]

  if (input.layoutMode === 'free') {
    entries.push(['position', 'relative'])
  } else {
    entries.push(
      ['display', 'grid'],
      ['grid-template-columns', 'repeat(3, minmax(0, 1fr))'],
      ['grid-template-rows', `repeat(${n(input.gridRows, 3, 1, 20)}, minmax(160px, auto))`],
      ['gap', '16px']
    )
  }

  return buildStyleAttr(entries)
}

function renderSemanticNode(
  node: CanvasComponentNode,
  context: SemanticRenderContext,
  depth: number
): string[] {
  if (LAYOUT_TYPES.has(node.type)) {
    return renderSemanticLayoutNode(node, context, depth)
  }

  const styleAttr = buildStyleAttr([
    ...collectSemanticNodeStyleEntries(node, context),
    ['display', 'flex'],
    ['flex-direction', 'column'],
    ['gap', '12px']
  ])
  const lines: string[] = []
  lines.push(`${id(depth)}<section class="node-shell"${styleAttr}>`)

  if (node.type === 'text') {
    lines.push(
      `${id(depth + 1)}<p class="text-block">${escHtml(String(node.props?.text || node.title || '文本'))}</p>`
    )
  } else if (node.type === 'button') {
    lines.push(
      `${id(depth + 1)}<el-button type="${escHtml(String(node.props?.buttonType || 'primary'))}">${escHtml(String(node.props?.text || '按钮'))}</el-button>`
    )
  } else if (node.type === 'input') {
    lines.push(
      `${id(depth + 1)}<el-input :model-value='${JSON.stringify(String(node.props?.value || ''))}' :placeholder='${JSON.stringify(String(node.props?.placeholder || '请输入内容'))}' clearable />`
    )
  } else if (node.type === 'select') {
    const options = parseList(node.props?.options, ['选项1', '选项2'])
    lines.push(
      `${id(depth + 1)}<el-select :model-value='${JSON.stringify('')}' :placeholder='${JSON.stringify(String(node.props?.placeholder || '请选择'))}' clearable>`
    )
    lines.push(
      `${id(depth + 2)}<el-option v-for="option in ${JSON.stringify(options)}" :key="option" :label="option" :value="option" />`
    )
    lines.push(`${id(depth + 1)}</el-select>`)
  } else if (node.type === 'switch') {
    lines.push(
      `${id(depth + 1)}<el-switch :model-value="${node.props?.checked === true ? 'true' : 'false'}" active-text="${escHtml(String(node.props?.activeText || '开启'))}" inactive-text="${escHtml(String(node.props?.inactiveText || '关闭'))}" />`
    )
  } else if (node.type === 'datePicker') {
    lines.push(
      `${id(depth + 1)}<el-date-picker :model-value='${JSON.stringify('')}' type="${escHtml(String(node.props?.pickerType || 'date'))}" :placeholder='${JSON.stringify(String(node.props?.placeholder || '请选择日期'))}' style="width: 100%" />`
    )
  } else if (node.type === 'table') {
    const columns = parseList(node.props?.columns, ['姓名', '角色'])
    const rows = parseTableRows(node.props?.demoData, columns, n(node.props?.rows, 3, 1, 50))
    lines.push(
      `${id(depth + 1)}<el-table :data='${JSON.stringify(rows)}' border stripe style="width: 100%">`
    )
    lines.push(
      `${id(depth + 2)}<el-table-column v-for="col in ${JSON.stringify(columns)}" :key="col" :prop="col" :label="col" min-width="120" show-overflow-tooltip />`
    )
    lines.push(`${id(depth + 1)}</el-table>`)
  } else if (
    node.type === 'pagedTable' &&
    context.pagedTableModel &&
    context.pagedTableNodeId === node.id
  ) {
    lines.push(`${id(depth + 1)}<div class="table-stack">`)
    lines.push(...buildSimplePagedTableTemplateLines(context.pagedTableModel, depth + 2))
    lines.push(`${id(depth + 1)}</div>`)
  } else if (node.type === 'card') {
    lines.push(`${id(depth + 1)}<el-card shadow="never" class="content-card">`)
    lines.push(`${id(depth + 2)}<template #header>`)
    lines.push(
      `${id(depth + 3)}<span>${escHtml(String(node.props?.title || node.title || '卡片标题'))}</span>`
    )
    lines.push(`${id(depth + 2)}</template>`)
    lines.push(
      `${id(depth + 2)}<p class="text-block">${escHtml(String(node.props?.content || '这是卡片正文内容。'))}</p>`
    )
    lines.push(`${id(depth + 1)}</el-card>`)
  } else if (node.type === 'image') {
    const src = String(node.props?.src || '').trim()
    if (src) {
      lines.push(
        `${id(depth + 1)}<el-image src="${escHtml(src)}" fit="${escHtml(String(node.props?.fit || 'cover'))}" style="width: 100%; height: 100%" />`
      )
    } else {
      lines.push(`${id(depth + 1)}<div class="image-placeholder">图片</div>`)
    }
  } else if (node.type === 'divider') {
    lines.push(
      `${id(depth + 1)}<el-divider direction="${escHtml(String(node.props?.direction || 'horizontal'))}" />`
    )
  } else if (node.type === 'spacer') {
    lines.push(`${id(depth + 1)}<div aria-hidden="true" style="flex: 1 1 auto"></div>`)
  } else if (node.type === 'borderBox') {
    lines.push(`${id(depth + 1)}<section class="border-box">`)
    lines.push(
      `${id(depth + 2)}<div class="border-box__title">${escHtml(String(node.props?.borderTitle || '分区标题'))}</div>`
    )
    lines.push(`${id(depth + 2)}<div class="border-box__body"></div>`)
    lines.push(`${id(depth + 1)}</section>`)
  } else if (node.type === 'decorationLine') {
    lines.push(
      `${id(depth + 1)}<div class="decoration-line">${escHtml(String(node.props?.text || '装饰分割'))}</div>`
    )
  }

  lines.push(`${id(depth)}</section>`)
  return lines
}

function renderSemanticLayoutNode(
  node: CanvasComponentNode,
  context: SemanticRenderContext,
  depth: number
): string[] {
  const children = sortNodes(
    context.childrenMap[node.id] || [],
    context.input.layoutMode,
    node.type
  )
  const renderChildren = (nextDepth: number) => {
    if (!children.length) {
      return [`${id(nextDepth)}<div class="empty-slot">可在此区域拖入组件</div>`]
    }
    return children.flatMap((child) => renderSemanticNode(child, context, nextDepth))
  }

  if (node.type === 'layoutCard') {
    const styleAttr = buildStyleAttr(collectSemanticNodeStyleEntries(node, context))
    const bodyStyleAttr = buildStyleAttr([
      ['display', 'flex'],
      ['flex-direction', 'column'],
      ['gap', `${n(node.props?.gap, 0)}px`],
      ['padding', `${n(node.props?.padding, 0)}px`],
      ['min-height', '100%']
    ])
    const cardTitle = String(node.props?.cardTitle || node.title || '').trim()
    const lines: string[] = []
    lines.push(`${id(depth)}<el-card shadow="never" class="layout-card"${styleAttr}>`)
    if (cardTitle) {
      lines.push(`${id(depth + 1)}<template #header>`)
      lines.push(`${id(depth + 2)}<span>${escHtml(cardTitle)}</span>`)
      lines.push(`${id(depth + 1)}</template>`)
    }
    lines.push(`${id(depth + 1)}<div class="layout-stack"${bodyStyleAttr}>`)
    lines.push(...renderChildren(depth + 2))
    lines.push(`${id(depth + 1)}</div>`)
    lines.push(`${id(depth)}</el-card>`)
    return lines
  }

  const tagMap: Record<string, string> = {
    layoutHeader: 'header',
    layoutFooter: 'footer',
    layoutSidebar: 'aside',
    layoutContainer: 'section'
  }
  const classMap: Record<string, string> = {
    layoutRow: 'layout-row',
    layoutColumn: 'layout-column',
    layoutGrid: 'layout-grid',
    layoutContainer: 'layout-column',
    layoutFree: 'layout-free',
    layoutHeader: 'layout-header',
    layoutSidebar: 'layout-sidebar',
    layoutFooter: 'layout-footer'
  }

  const tag = tagMap[node.type] || 'section'
  const styleAttr = buildStyleAttr([
    ...collectSemanticNodeStyleEntries(node, context),
    ...collectSemanticLayoutStyleEntries(node)
  ])
  const lines: string[] = []
  lines.push(`${id(depth)}<${tag} class="${classMap[node.type] || 'layout-column'}"${styleAttr}>`)
  lines.push(...renderChildren(depth + 1))
  lines.push(`${id(depth)}</${tag}>`)
  return lines
}

function buildSemanticLayoutTemplate(context: SemanticRenderContext) {
  const rootNodes = sortNodes(context.childrenMap.__root__ || [], context.input.layoutMode, null)
  const lines: string[] = []
  lines.push('<template>')
  lines.push('  <main class="page-shell">')
  lines.push(`    <section class="page-canvas"${buildSemanticCanvasStyle(context.input)}>`)
  if (!rootNodes.length) {
    lines.push('      <div class="empty-slot">画布为空，请先添加组件</div>')
  } else {
    rootNodes.forEach((node) => {
      lines.push(...renderSemanticNode(node, context, 3))
    })
  }
  lines.push('    </section>')
  lines.push('  </main>')
  lines.push('</template>')
  return lines.join('\n')
}

function buildSemanticLayoutScript(context: SemanticRenderContext) {
  if (!context.pagedTableModel) {
    return ''
  }

  const lines: string[] = []
  lines.push('<script setup>')
  lines.push("import { ref, onMounted } from 'vue'")
  lines.push("import axios from 'axios'")
  lines.push("import { ElMessage } from 'element-plus'")
  lines.push('')
  lines.push(...buildSimplePagedTableScriptLines(context.pagedTableModel))
  lines.push('')
  lines.push('onMounted(fetchData)')
  lines.push('</script>')
  return lines.join('\n')
}

function buildSemanticLayoutStyle() {
  const lines: string[] = []
  lines.push('<style scoped>')
  lines.push(
    '.page-shell { min-height: 100%; padding: 20px; box-sizing: border-box; background: #f8fafc; }'
  )
  lines.push('.page-canvas { box-sizing: border-box; }')
  lines.push('.node-shell { min-width: 0; }')
  lines.push('.text-block { margin: 0; white-space: pre-wrap; line-height: 1.6; }')
  lines.push('.table-stack { display: flex; flex-direction: column; gap: 16px; min-height: 0; }')
  lines.push(
    '.layout-card :deep(.el-card__body), .content-card :deep(.el-card__body) { box-sizing: border-box; }'
  )
  lines.push(
    '.empty-slot { min-height: 80px; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; background: rgba(255, 255, 255, 0.6); }'
  )
  lines.push(
    '.image-placeholder { min-height: 120px; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b; background: #fff; }'
  )
  lines.push(
    '.border-box { width: 100%; height: 100%; display: flex; flex-direction: column; border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 12px; overflow: hidden; }'
  )
  lines.push(
    '.border-box__title { padding: 10px 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(148, 163, 184, 0.25); }'
  )
  lines.push('.border-box__body { flex: 1; }')
  lines.push(
    '.decoration-line { min-height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(14, 165, 233, 0.12)); color: #334155; font-size: 12px; }'
  )
  lines.push(
    '.pagination-container { margin-top: 16px; display: flex; justify-content: flex-end; }'
  )
  lines.push(
    '@media (max-width: 1100px) { .layout-grid { grid-template-columns: repeat(var(--grid-tablet, 2), minmax(0, 1fr)) !important; } }'
  )
  lines.push(
    '@media (max-width: 760px) { .page-shell { padding: 12px; } .layout-grid { grid-template-columns: repeat(var(--grid-mobile, 1), minmax(0, 1fr)) !important; } }'
  )
  lines.push('</style>')
  return lines.join('\n')
}

function tryGenerateSemanticLayoutPageSource(input: GeneratorInput) {
  const context = createSemanticRenderContext(input)
  if (!context) {
    return null
  }

  const template = buildSemanticLayoutTemplate(context)
  const script = buildSemanticLayoutScript(context)
  const style = buildSemanticLayoutStyle()
  return [template, script, style].filter(Boolean).join('\n\n') + '\n'
}

function tryGenerateSimplePagedTableSource(input: GeneratorInput) {
  const visibleNodes = input.nodes.filter((node) => node.visible !== false)
  if (visibleNodes.length !== 1) {
    return null
  }

  const targetNode = visibleNodes[0]
  if (targetNode.parentId || targetNode.type !== 'pagedTable') {
    return null
  }

  const model = buildSimplePagedTableModel(targetNode)
  if (!model) {
    return null
  }

  const templateLines: string[] = []
  templateLines.push('<template>')
  templateLines.push('  <div class="simple-page">')
  templateLines.push(...buildSimplePagedTableTemplateLines(model, 2))
  templateLines.push('  </div>')
  templateLines.push('</template>')

  const scriptLines: string[] = []
  scriptLines.push('<script setup>')
  scriptLines.push("import { ref, onMounted } from 'vue'")
  scriptLines.push("import axios from 'axios'")
  scriptLines.push("import { ElMessage } from 'element-plus'")
  scriptLines.push('')
  scriptLines.push(...buildSimplePagedTableScriptLines(model))
  scriptLines.push('')
  scriptLines.push('onMounted(fetchData)')
  scriptLines.push('</script>')

  return `${templateLines.join('\n')}\n\n${scriptLines.join('\n')}\n\n${buildSimplePageStyle(input.canvasBackground)}\n`
}

function tryGenerateSimpleFormPageSource(input: GeneratorInput) {
  const flatNodes = collectSimpleFlatNodes(input)
  if (!flatNodes?.length) {
    return null
  }

  if (flatNodes.some((node) => node.type === 'table' || node.type === 'pagedTable')) {
    return null
  }

  const fieldModels = buildSimpleFormFieldModels(flatNodes)
  if (!fieldModels.length) {
    return null
  }

  const textNodes = flatNodes.filter((node) => node.type === 'text')
  const buttonNodes = flatNodes.filter((node) => node.type === 'button')
  const pageTitle = textNodes[0] ? getNodeDisplayText(textNodes[0]) : '表单页面'
  const descriptions = textNodes
    .slice(1)
    .map((node) => getNodeDisplayText(node))
    .filter(Boolean)

  const initialFormData = fieldModels.reduce<Record<string, any>>((result, field) => {
    result[field.key] = field.initialValue
    return result
  }, {})

  const needSubmitHandler = buttonNodes.some((node) => !isResetButtonText(getNodeDisplayText(node)))
  const needResetHandler = buttonNodes.some((node) => isResetButtonText(getNodeDisplayText(node)))

  const templateLines: string[] = []
  templateLines.push('<template>')
  templateLines.push('  <div class="simple-page">')
  templateLines.push('    <div class="page-header">')
  templateLines.push(`      <h2 class="page-title">${escHtml(pageTitle)}</h2>`)
  descriptions.forEach((text) => {
    templateLines.push(`      <p class="page-description">${escHtml(text)}</p>`)
  })
  templateLines.push('    </div>')
  templateLines.push('')
  templateLines.push('    <el-card shadow="never" class="page-card">')
  templateLines.push('      <el-form :model="formData" label-width="100px" class="page-form">')
  fieldModels.forEach((field) => {
    templateLines.push(`        <el-form-item label="${escHtml(field.label)}">`)
    if (field.type === 'select') {
      templateLines.push(
        `          <el-select v-model="formData.${field.key}" placeholder="${escHtml(field.placeholder)}" clearable style="width: 100%">`
      )
      templateLines.push(
        `            <el-option v-for="option in ${JSON.stringify(field.options)}" :key="option" :label="option" :value="option" />`
      )
      templateLines.push('          </el-select>')
    } else if (field.type === 'switch') {
      templateLines.push(
        `          <el-switch v-model="formData.${field.key}" active-text="${escHtml(field.activeText)}" inactive-text="${escHtml(field.inactiveText)}" />`
      )
    } else if (field.type === 'datePicker') {
      templateLines.push(
        `          <el-date-picker v-model="formData.${field.key}" type="${escHtml(field.pickerType)}" placeholder="${escHtml(field.placeholder)}" style="width: 100%" />`
      )
    } else {
      templateLines.push(
        `          <el-input v-model="formData.${field.key}" placeholder="${escHtml(field.placeholder)}" clearable />`
      )
    }
    templateLines.push('        </el-form-item>')
  })
  if (buttonNodes.length) {
    templateLines.push('        <el-form-item>')
    buttonNodes.forEach((node) => {
      const buttonText = getNodeDisplayText(node) || '按钮'
      const buttonType = String(node.props?.buttonType || 'default')
      const handlerAttr = isResetButtonText(buttonText)
        ? ' @click="handleReset"'
        : needSubmitHandler
          ? ' @click="handleSubmit"'
          : ''
      templateLines.push(
        `          <el-button type="${escHtml(buttonType)}"${handlerAttr}>${escHtml(buttonText)}</el-button>`
      )
    })
    templateLines.push('        </el-form-item>')
  }
  templateLines.push('      </el-form>')
  templateLines.push('    </el-card>')
  templateLines.push('  </div>')
  templateLines.push('</template>')

  const scriptLines: string[] = []
  scriptLines.push('<script setup>')
  scriptLines.push("import { reactive } from 'vue'")
  scriptLines.push('')
  scriptLines.push('const createInitialFormData = () =>')
  scriptLines.push(...buildObjectLiteralLines(initialFormData, 0))
  scriptLines.push('')
  scriptLines.push('const formData = reactive(createInitialFormData())')
  if (needSubmitHandler) {
    scriptLines.push('')
    scriptLines.push('const handleSubmit = () => {')
    scriptLines.push("  console.log('submit form', { ...formData })")
    scriptLines.push('}')
  }
  if (needResetHandler) {
    scriptLines.push('')
    scriptLines.push('const handleReset = () => {')
    scriptLines.push('  Object.assign(formData, createInitialFormData())')
    scriptLines.push('}')
  }
  scriptLines.push('</script>')

  return `${templateLines.join('\n')}\n\n${scriptLines.join('\n')}\n\n${buildSimplePageStyle(input.canvasBackground)}\n`
}

function tryGenerateSimpleCrudPageSource(input: GeneratorInput) {
  const flatNodes = collectSimpleFlatNodes(input)
  if (!flatNodes?.length) {
    return null
  }

  const contentNodes = flatNodes.filter(
    (node) => node.type === 'table' || node.type === 'pagedTable'
  )
  if (contentNodes.length !== 1) {
    return null
  }

  const contentNode = contentNodes[0]
  const contentIndex = flatNodes.findIndex((node) => node.id === contentNode.id)
  if (contentIndex < 0) {
    return null
  }

  const beforeContentNodes = flatNodes.slice(0, contentIndex)
  const afterContentNodes = flatNodes.slice(contentIndex + 1)
  if (
    afterContentNodes.some(
      (node) => SIMPLE_FORM_FIELD_TYPES.has(node.type) || node.type === 'button'
    )
  ) {
    return null
  }

  const headerTexts = beforeContentNodes
    .filter((node) => node.type === 'text')
    .map((node) => getNodeDisplayText(node))
    .filter(Boolean)
  const tailNotes = afterContentNodes
    .filter((node) => node.type === 'text')
    .map((node) => getNodeDisplayText(node))
    .filter(Boolean)
  const fieldModels = buildSimpleFormFieldModels(beforeContentNodes)
  const allButtons = beforeContentNodes.filter((node) => node.type === 'button')
  const queryButtons = fieldModels.length
    ? allButtons.filter((node) => {
        const buttonText = getNodeDisplayText(node)
        return isSearchButtonText(buttonText) || isResetButtonText(buttonText)
      })
    : []
  const actionButtons = allButtons.filter(
    (node) => !queryButtons.some((button) => button.id === node.id)
  )

  const pageTitle = headerTexts[0] || '业务页面'
  const descriptions = headerTexts.slice(1)
  const initialQueryData = fieldModels.reduce<Record<string, any>>((result, field) => {
    result[field.key] = field.initialValue
    return result
  }, {})

  const templateLines: string[] = []
  templateLines.push('<template>')
  templateLines.push('  <div class="simple-page">')
  templateLines.push('    <div class="page-header">')
  templateLines.push(`      <h2 class="page-title">${escHtml(pageTitle)}</h2>`)
  descriptions.forEach((text) => {
    templateLines.push(`      <p class="page-description">${escHtml(text)}</p>`)
  })
  templateLines.push('    </div>')

  if (fieldModels.length) {
    templateLines.push('')
    templateLines.push('    <el-card shadow="never" class="page-card">')
    templateLines.push(
      '      <el-form :model="queryForm" inline class="page-form page-form--inline">'
    )
    fieldModels.forEach((field) => {
      templateLines.push(`        <el-form-item label="${escHtml(field.label)}">`)
      if (field.type === 'select') {
        templateLines.push(
          `          <el-select v-model="queryForm.${field.key}" placeholder="${escHtml(field.placeholder)}" clearable style="width: 180px">`
        )
        templateLines.push(
          `            <el-option v-for="option in ${JSON.stringify(field.options)}" :key="option" :label="option" :value="option" />`
        )
        templateLines.push('          </el-select>')
      } else if (field.type === 'switch') {
        templateLines.push(
          `          <el-switch v-model="queryForm.${field.key}" active-text="${escHtml(field.activeText)}" inactive-text="${escHtml(field.inactiveText)}" />`
        )
      } else if (field.type === 'datePicker') {
        templateLines.push(
          `          <el-date-picker v-model="queryForm.${field.key}" type="${escHtml(field.pickerType)}" placeholder="${escHtml(field.placeholder)}" style="width: 220px" />`
        )
      } else {
        templateLines.push(
          `          <el-input v-model="queryForm.${field.key}" placeholder="${escHtml(field.placeholder)}" clearable style="width: 180px" />`
        )
      }
      templateLines.push('        </el-form-item>')
    })

    if (queryButtons.length) {
      templateLines.push('        <el-form-item>')
      queryButtons.forEach((node) => {
        const buttonText = getNodeDisplayText(node) || '按钮'
        const buttonType = String(node.props?.buttonType || 'default')
        const handlerAttr = isResetButtonText(buttonText)
          ? ' @click="handleReset"'
          : isSearchButtonText(buttonText)
            ? ' @click="handleSearch"'
            : ''
        templateLines.push(
          `          <el-button type="${escHtml(buttonType)}"${handlerAttr}>${escHtml(buttonText)}</el-button>`
        )
      })
      templateLines.push('        </el-form-item>')
    }

    templateLines.push('      </el-form>')
    templateLines.push('    </el-card>')
  }

  if (actionButtons.length) {
    templateLines.push('')
    templateLines.push('    <div class="page-actions">')
    actionButtons.forEach((node) => {
      const buttonText = getNodeDisplayText(node) || '按钮'
      const buttonType = String(node.props?.buttonType || 'default')
      templateLines.push(
        `      <el-button type="${escHtml(buttonType)}">${escHtml(buttonText)}</el-button>`
      )
    })
    templateLines.push('    </div>')
  }

  templateLines.push('')
  templateLines.push('    <el-card shadow="never" class="page-card">')
  if (contentNode.type === 'pagedTable') {
    const pagedTableModel = buildSimplePagedTableModel(contentNode)
    if (!pagedTableModel) {
      return null
    }
    templateLines.push(...buildSimplePagedTableTemplateLines(pagedTableModel, 3))
  } else {
    const tableColumns = parseList(contentNode.props?.columns, ['姓名', '角色'])
    templateLines.push('      <el-table :data="tableData" border stripe style="width: 100%">')
    tableColumns.forEach((column) => {
      templateLines.push(
        `        <el-table-column prop="${escHtml(column)}" label="${escHtml(column)}" min-width="120" />`
      )
    })
    templateLines.push('      </el-table>')
  }
  templateLines.push('    </el-card>')

  tailNotes.forEach((text) => {
    templateLines.push(`    <p class="page-note">${escHtml(text)}</p>`)
  })
  templateLines.push('  </div>')
  templateLines.push('</template>')

  const scriptLines: string[] = []
  scriptLines.push('<script setup>')

  const needQueryForm = fieldModels.length > 0
  const needPagedTable = contentNode.type === 'pagedTable'
  const needStaticTable = contentNode.type === 'table'
  const needComputed = needStaticTable && needQueryForm

  const vueImports = new Set<string>()
  if (needQueryForm) {
    vueImports.add('reactive')
  }
  if (needPagedTable) {
    vueImports.add('ref')
    vueImports.add('onMounted')
  }
  if (needComputed) {
    vueImports.add('computed')
  }
  if (vueImports.size) {
    scriptLines.push(`import { ${Array.from(vueImports).join(', ')} } from 'vue'`)
  }
  if (needPagedTable) {
    scriptLines.push("import axios from 'axios'")
    scriptLines.push("import { ElMessage } from 'element-plus'")
  }

  if (needQueryForm) {
    scriptLines.push('')
    scriptLines.push('const createInitialQueryForm = () =>')
    scriptLines.push(...buildObjectLiteralLines(initialQueryData, 0))
    scriptLines.push('')
    scriptLines.push('const queryForm = reactive(createInitialQueryForm())')
  }

  if (needStaticTable) {
    const tableColumns = parseList(contentNode.props?.columns, ['姓名', '角色'])
    const tableRows = parseTableRows(
      contentNode.props?.demoData,
      tableColumns,
      n(contentNode.props?.rows, 3, 1, 50)
    )
    scriptLines.push('')
    scriptLines.push(`const rawTableData = ${JSON.stringify(tableRows, null, 2)}`)
    if (needComputed) {
      scriptLines.push('')
      scriptLines.push('const tableData = computed(() => {')
      scriptLines.push('  const activeFilters = Object.values(queryForm).filter((value) => {')
      scriptLines.push('    if (Array.isArray(value)) return value.length > 0')
      scriptLines.push(
        "    return value !== '' && value !== null && typeof value !== 'undefined' && value !== false"
      )
      scriptLines.push('  })')
      scriptLines.push('  if (!activeFilters.length) return rawTableData')
      scriptLines.push('  return rawTableData.filter((row) => {')
      scriptLines.push('    return activeFilters.every((keyword) => {')
      scriptLines.push(
        "      const normalizedKeyword = Array.isArray(keyword) ? keyword.join(' ') : String(keyword)"
      )
      scriptLines.push(
        "      return Object.values(row).some((value) => String(value ?? '').includes(normalizedKeyword))"
      )
      scriptLines.push('    })')
      scriptLines.push('  })')
      scriptLines.push('})')
    } else {
      scriptLines.push('')
      scriptLines.push('const tableData = rawTableData')
    }
  }

  if (needPagedTable) {
    const pagedTableModel = buildSimplePagedTableModel(contentNode)
    if (!pagedTableModel) {
      return null
    }

    if (needQueryForm) {
      scriptLines.push('')
      scriptLines.push('const buildQueryParams = () => {')
      scriptLines.push('  return Object.entries(queryForm).reduce((result, [key, value]) => {')
      scriptLines.push('    if (Array.isArray(value)) {')
      scriptLines.push("      if (value.length) result[key] = value.join(',')")
      scriptLines.push('      return result')
      scriptLines.push('    }')
      scriptLines.push(
        "    if (value === '' || value === null || typeof value === 'undefined' || value === false) return result"
      )
      scriptLines.push('    result[key] = value')
      scriptLines.push('    return result')
      scriptLines.push('  }, {})')
      scriptLines.push('}')
    }

    scriptLines.push('')
    scriptLines.push(
      ...buildSimplePagedTableScriptLines(
        pagedTableModel,
        needQueryForm ? 'buildQueryParams()' : ''
      )
    )
    scriptLines.push('')
    scriptLines.push('const handleSearch = () => {')
    scriptLines.push('  pagination.value.currentPage = 1')
    scriptLines.push('  fetchData()')
    scriptLines.push('}')
  } else if (queryButtons.some((node) => isSearchButtonText(getNodeDisplayText(node)))) {
    scriptLines.push('')
    scriptLines.push('const handleSearch = () => {}')
  }

  if (needQueryForm && queryButtons.some((node) => isResetButtonText(getNodeDisplayText(node)))) {
    scriptLines.push('')
    scriptLines.push('const handleReset = () => {')
    scriptLines.push('  Object.assign(queryForm, createInitialQueryForm())')
    if (needPagedTable) {
      scriptLines.push('  pagination.value.currentPage = 1')
      scriptLines.push('  fetchData()')
    }
    scriptLines.push('}')
  }

  if (needPagedTable) {
    scriptLines.push('')
    scriptLines.push('onMounted(fetchData)')
  }

  scriptLines.push('</script>')

  return `${templateLines.join('\n')}\n\n${scriptLines.join('\n')}\n\n${buildSimplePageStyle(input.canvasBackground)}\n`
}

function parseTableRows(raw: any, columns: string[], rowCount: number) {
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((row) => {
            const nextRow: Record<string, string | number> = {}
            columns.forEach((col) => {
              nextRow[col] = typeof row?.[col] === 'undefined' ? '' : String(row[col])
            })
            return nextRow
          })
          .filter((row) => Object.values(row).some((cell) => String(cell).trim()))
      }
    } catch {
      // ignore invalid json
    }
  }

  const total = Math.max(1, n(rowCount, 3, 1, 50))
  return Array.from({ length: total }).map((_, index) => {
    const row: Record<string, string> = {}
    columns.forEach((col) => {
      row[col] = `${col}${index + 1}`
    })
    return row
  })
}

function isSafeVueBindingKey(rawKey: string) {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(rawKey)
}

function encodeVueBindingLiteral(value: any) {
  try {
    return JSON.stringify(value).replace(/'/g, "\\'")
  } catch {
    return JSON.stringify(String(value)).replace(/'/g, "\\'")
  }
}

function buildVueBindingAttributes(rawProps: Record<string, any>) {
  return Object.entries(rawProps)
    .filter(
      ([key, value]) =>
        isSafeVueBindingKey(key) && typeof value !== 'undefined' && typeof value !== 'function'
    )
    .map(([key, value]) => `:${key}='${encodeVueBindingLiteral(value)}'`)
    .join(' ')
}

function renderAutoElementNode(node: CanvasComponentNode, depth: number): string[] {
  const tag = resolveElementPlusAutoTag(node.type)
  if (!tag) {
    return [
      `${id(depth)}<span class="lc-node__text">${escHtml(String(node.title || node.type))}</span>`
    ]
  }

  const runtimeProps = resolveElementPlusAutoSourceProps(node)
  const normalizedRuntimeProps =
    tag === 'el-table'
      ? { ...runtimeProps, data: resolveElementPlusAutoTableData(runtimeProps) }
      : runtimeProps
  const bindingAttrs = buildVueBindingAttributes(normalizedRuntimeProps)
  const openTag = bindingAttrs ? `<${tag} ${bindingAttrs}>` : `<${tag}>`
  const lines: string[] = []

  lines.push(`${id(depth)}${openTag}`)

  if (tag === 'el-select') {
    const optionItems = resolveElementPlusAutoOptionItems(node)
    optionItems.forEach((optionLabel) => {
      lines.push(
        `${id(depth + 1)}<el-option label="${escHtml(optionLabel)}" :value='${encodeVueBindingLiteral(optionLabel)}' />`
      )
    })
  } else if (tag === 'el-table') {
    const columnKeys = resolveElementPlusAutoTableColumnKeys(node, normalizedRuntimeProps)
    columnKeys.forEach((columnKey) => {
      lines.push(
        `${id(depth + 1)}<el-table-column prop="${escHtml(columnKey)}" label="${escHtml(columnKey)}" min-width="96" show-overflow-tooltip />`
      )
    })
  } else {
    const slotText = resolveElementPlusAutoSlotText(node)
    if (slotText) {
      lines.push(`${id(depth + 1)}${escHtml(slotText)}`)
    }
  }

  lines.push(`${id(depth)}</${tag}>`)
  return lines
}
function buildChartOption(node: CanvasComponentNode) {
  const chartType = (
    node.type === 'lineChart' ||
    node.type === 'pieChart' ||
    node.type === 'gaugeChart' ||
    node.type === 'customChart'
      ? node.type
      : 'barChart'
  ) as 'barChart' | 'lineChart' | 'pieChart' | 'gaugeChart' | 'customChart'

  return buildDefaultChartOption({
    chartType,
    titleText: node.props?.titleText,
    demoData: node.props?.demoData,
    maxValue: node.props?.maxValue
  })
}

function resolveChartOptionCode(node: CanvasComponentNode) {
  if (node.type !== 'customChart') {
    return JSON.stringify(buildChartOption(node), null, 2)
  }

  const rawChartOption =
    typeof node.props?.chartOption === 'string' ? node.props.chartOption.trim() : ''
  if (rawChartOption && parseCustomChartOption(rawChartOption)) {
    return rawChartOption
  }
  return JSON.stringify(buildChartOption(node), null, 2)
}
function getNodeClass(nodeId: string, context: RenderContext) {
  return context.nodeClassMap[nodeId] || 'lc-node--node-00000'
}

function id(depth: number) {
  return `${'  '.repeat(depth)}`
}

function groupChildren(nodes: CanvasComponentNode[]) {
  const result: Record<string, CanvasComponentNode[]> = { __root__: [] }
  nodes.forEach((node) => {
    const key = node.parentId || '__root__'
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(node)
  })
  return result
}

function sortNodes(
  nodes: CanvasComponentNode[],
  layoutMode: CanvasLayoutMode,
  parentType: string | null
) {
  return [...nodes].sort((left, right) => {
    if (!parentType && layoutMode === 'grid9') {
      const leftCell = typeof left.gridCell === 'number' ? left.gridCell : Number.POSITIVE_INFINITY
      const rightCell =
        typeof right.gridCell === 'number' ? right.gridCell : Number.POSITIVE_INFINITY
      if (leftCell !== rightCell) {
        return leftCell - rightCell
      }
    }
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex
    }
    return left.id.localeCompare(right.id)
  })
}

function resolveSize(node: CanvasComponentNode, parentNode?: CanvasComponentNode | null) {
  const mode = node.props?.sizeMode === 'responsive' ? 'responsive' : 'fixed'
  if (mode === 'fixed') {
    return {
      width: `${Math.max(1, Math.round(node.width))}px`,
      height: `${Math.max(1, Math.round(node.height))}px`
    }
  }

  const parentWidth = Math.max(1, Number(parentNode?.width || node.width || 1))
  const parentHeight = Math.max(1, Number(parentNode?.height || node.height || 1))
  const widthPercent = n(node.props?.widthPercent, (node.width / parentWidth) * 100, 1, 100)
  const heightPercent = n(node.props?.heightPercent, (node.height / parentHeight) * 100, 1, 100)
  return {
    width: `${widthPercent}%`,
    height: `${heightPercent}%`
  }
}

function renderNode(node: CanvasComponentNode, context: RenderContext, depth: number): string[] {
  const cls = getNodeClass(node.id, context)
  if (LAYOUT_TYPES.has(node.type)) {
    return renderLayoutNode(node, context, depth)
  }

  const lines: string[] = []
  lines.push(`${id(depth)}<div class="lc-node ${cls}">`)

  if (node.type === 'text') {
    lines.push(
      `${id(depth + 1)}<span class="lc-node__text">${escHtml(String(node.props?.text || node.title || '\u6587\u672c'))}</span>`
    )
  } else if (node.type === 'button') {
    lines.push(
      `${id(depth + 1)}<el-button type="${escHtml(String(node.props?.buttonType || 'primary'))}" size="small">${escHtml(String(node.props?.text || '\u6309\u94ae'))}</el-button>`
    )
  } else if (node.type === 'input') {
    lines.push(
      `${id(depth + 1)}<el-input :model-value='${JSON.stringify(String(node.props?.value || ''))}' :placeholder='${JSON.stringify(String(node.props?.placeholder || '\u8bf7\u8f93\u5165\u5185\u5bb9'))}' size="small" />`
    )
  } else if (node.type === 'select') {
    const options = parseList(node.props?.options, ['閫夐」1', '閫夐」2'])
    lines.push(
      `${id(depth + 1)}<el-select :model-value='${JSON.stringify('')}' :placeholder='${JSON.stringify(String(node.props?.placeholder || '\u8bf7\u9009\u62e9'))}' size="small">`
    )
    lines.push(
      `${id(depth + 2)}<el-option v-for="option in ${JSON.stringify(options)}" :key="option" :label="option" :value="option" />`
    )
    lines.push(`${id(depth + 1)}</el-select>`)
  } else if (node.type === 'switch') {
    const checked = node.props?.checked === true
    lines.push(
      `${id(depth + 1)}<el-switch :model-value="${checked ? 'true' : 'false'}" active-text="${escHtml(String(node.props?.activeText || '\u5f00\u542f'))}" inactive-text="${escHtml(String(node.props?.inactiveText || '\u5173\u95ed'))}" />`
    )
  } else if (node.type === 'datePicker') {
    lines.push(
      `${id(depth + 1)}<el-date-picker class="lc-node__date" :model-value='${JSON.stringify('')}' type="${escHtml(String(node.props?.pickerType || 'date'))}" :placeholder='${JSON.stringify(String(node.props?.placeholder || '\u8bf7\u9009\u62e9\u65e5\u671f'))}' />`
    )
  } else if (node.type === 'table') {
    const columns = parseList(node.props?.columns, ['濮撳悕', '瑙掕壊'])
    const rows = parseTableRows(node.props?.demoData, columns, n(node.props?.rows, 3, 1, 50))
    lines.push(
      `${id(depth + 1)}<el-table class="lc-node__table" :data='${JSON.stringify(rows)}' border stripe height="100%">`
    )
    lines.push(
      `${id(depth + 2)}<el-table-column v-for="col in ${JSON.stringify(columns)}" :key="col" :prop="col" :label="col" min-width="120" show-overflow-tooltip />`
    )
    lines.push(`${id(depth + 1)}</el-table>`)
  } else if (node.type === 'pagedTable') {
    const fallbackColumns = String(node.props?.columns || '')
    const columnSchema = parsePagedTableColumnSchema(node.props?.columnSchema, fallbackColumns)
    const bindingIndex = context.pagedTableBindings.length + 1
    const binding: PagedTableBinding = {
      node,
      rowsVar: `pagedTable${bindingIndex}Rows`,
      totalVar: `pagedTable${bindingIndex}Total`,
      sizeVar: `pagedTable${bindingIndex}PageSize`,
      currentVar: `pagedTable${bindingIndex}CurrentPage`,
      loadingVar: `pagedTable${bindingIndex}Loading`,
      columnsVar: `pagedTable${bindingIndex}Columns`,
      configVar: `pagedTable${bindingIndex}Config`,
      mapRowsFn: `mapPagedTable${bindingIndex}Rows`,
      fetchFn: `fetchPagedTable${bindingIndex}Data`,
      onCurrentChangeFn: `handlePagedTable${bindingIndex}CurrentChange`,
      onSizeChangeFn: `handlePagedTable${bindingIndex}SizeChange`
    }
    context.pagedTableBindings.push(binding)
    const pageSizeOptions = parseList(node.props?.pageSizeOptions, ['10', '20', '50', '100'])
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)
    const paginationLayout = String(
      node.props?.paginationLayout || 'total, sizes, prev, pager, next'
    )

    lines.push(`${id(depth + 1)}<div class="lc-node__paged-table">`)
    lines.push(
      `${id(depth + 2)}<el-table class="lc-node__table" :data="${binding.rowsVar}" border stripe height="100%" v-loading="${binding.loadingVar}">`
    )
    columnSchema.forEach((column) => {
      lines.push(
        `${id(depth + 3)}<el-table-column prop="${escHtml(column.key)}" label="${escHtml(column.label)}" :min-width="${Math.max(60, Number(column.minWidth || 96))}" show-overflow-tooltip />`
      )
    })
    lines.push(`${id(depth + 2)}</el-table>`)
    lines.push(`${id(depth + 2)}<div class="lc-node__paged-pagination">`)
    lines.push(
      `${id(depth + 3)}<el-pagination :current-page="${binding.currentVar}" :page-size="${binding.sizeVar}" :total="${binding.totalVar}" :page-sizes='${JSON.stringify(pageSizeOptions.length ? pageSizeOptions : [10, 20, 50, 100])}' layout="${escHtml(paginationLayout)}" small @current-change="${binding.onCurrentChangeFn}" @size-change="${binding.onSizeChangeFn}" />`
    )
    lines.push(`${id(depth + 2)}</div>`)
    lines.push(`${id(depth + 1)}</div>`)
  } else if (node.type === 'card') {
    const cardTitle = String(node.props?.title || node.title || '鍗＄墖鏍囬')
    const cardContent = String(node.props?.content || '鍗＄墖鍐呭')
    lines.push(`${id(depth + 1)}<el-card class="lc-node__card">`)
    lines.push(`${id(depth + 2)}<template #header>`)
    lines.push(`${id(depth + 3)}<span class="lc-node__card-title">${escHtml(cardTitle)}</span>`)
    lines.push(`${id(depth + 2)}</template>`)
    lines.push(`${id(depth + 2)}<div class="lc-node__card-body">${escHtml(cardContent)}</div>`)
    lines.push(`${id(depth + 1)}</el-card>`)
  } else if (CHART_TYPES.has(node.type)) {
    const chartIndex = context.chartBindings.length + 1
    context.chartBindings.push({
      node,
      refVar: `chartRef${chartIndex}`,
      insVar: `chartIns${chartIndex}`,
      optVar: `chartOpt${chartIndex}`,
      initFn: `initChart${chartIndex}`
    })
    const refVar = context.chartBindings[context.chartBindings.length - 1].refVar
    lines.push(`${id(depth + 1)}<div ref="${refVar}" class="lc-node__chart"></div>`)
  } else if (node.type === 'image') {
    const src = String(node.props?.src || '')
    if (src) {
      lines.push(
        `${id(depth + 1)}<el-image class="lc-node__image" src="${escHtml(src)}" fit="${escHtml(String(node.props?.fit || 'cover'))}" />`
      )
    } else {
      lines.push(`${id(depth + 1)}<div class="lc-node__img-ph">鍥剧墖</div>`)
    }
  } else if (node.type === 'divider') {
    const dir = String(node.props?.direction || 'horizontal')
    lines.push(
      `${id(depth + 1)}<el-divider class="lc-node__divider" direction="${dir === 'vertical' ? 'vertical' : 'horizontal'}" />`
    )
  } else if (node.type === 'spacer') {
    lines.push(
      `${id(depth + 1)}<div class="lc-node__spacer" style="height: ${n(node.props?.space, node.height, 4, 400)}px;"></div>`
    )
  } else if (node.type === 'borderBox') {
    lines.push(`${id(depth + 1)}<div class="lc-node__border">`)
    lines.push(
      `${id(depth + 2)}<div class="lc-node__border-title">${escHtml(String(node.props?.borderTitle || '鍒嗗尯鏍囬'))}</div>`
    )
    lines.push(`${id(depth + 2)}<div class="lc-node__border-body"></div>`)
    lines.push(`${id(depth + 1)}</div>`)
  } else if (node.type === 'decorationLine') {
    lines.push(
      `${id(depth + 1)}<div class="lc-node__deco"><span>${escHtml(String(node.props?.text || '瑁呴グ鍒嗗壊'))}</span></div>`
    )
  } else if (isElementPlusAutoComponentType(node.type)) {
    lines.push(...renderAutoElementNode(node, depth + 1))
  } else {
    lines.push(
      `${id(depth + 1)}<span class="lc-node__text">${escHtml(String(node.title || node.type))}</span>`
    )
  }

  lines.push(`${id(depth)}</div>`)
  return lines
}
function renderLayoutNode(
  node: CanvasComponentNode,
  context: RenderContext,
  depth: number
): string[] {
  const cls = getNodeClass(node.id, context)
  const children = sortNodes(
    context.childrenMap[node.id] || [],
    context.input.layoutMode,
    node.type
  )
  const lines: string[] = []

  const renderChildList = (nextDepth: number, list: CanvasComponentNode[] = children) => {
    if (!list.length) {
      lines.push(
        `${id(nextDepth)}<div class="lc-empty lc-empty--slot">鍙湪姝ゅ尯鍩熸嫋鍏ョ粍浠?/div>`
      )
      return
    }
    list.forEach((child) => {
      lines.push(...renderNode(child, context, nextDepth))
    })
  }

  if (node.type === 'layoutTabs') {
    const tabs = parseList(node.props?.tabs, ['閫夐」鍗?', '閫夐」鍗?'])
    context.tabDefaults[node.id] = String(
      n(node.props?.activeTab, 0, 0, Math.max(0, tabs.length - 1))
    )
    lines.push(`${id(depth)}<div class="lc-node ${cls}">`)
    lines.push(
      `${id(depth + 1)}<el-tabs v-model="tabState['${escHtml(node.id)}']" class="lc-tabs">`
    )
    tabs.forEach((tab, index) => {
      const paneNodes = children.filter(
        (child) => n(child.props?.tabIndex, 0, 0, Math.max(0, tabs.length - 1)) === index
      )
      lines.push(`${id(depth + 2)}<el-tab-pane label="${escHtml(tab)}" name="${index}">`)
      lines.push(`${id(depth + 3)}<div class="lc-tab-pane">`)
      renderChildList(depth + 4, paneNodes)
      lines.push(`${id(depth + 3)}</div>`)
      lines.push(`${id(depth + 2)}</el-tab-pane>`)
    })
    lines.push(`${id(depth + 1)}</el-tabs>`)
    lines.push(`${id(depth)}</div>`)
    return lines
  }

  if (node.type === 'layoutCard') {
    const cardTitle = String(node.props?.cardTitle || node.title || '鍗＄墖')
    lines.push(`${id(depth)}<div class="lc-node ${cls}">`)
    lines.push(`${id(depth + 1)}<el-card class="lc-card lc-card--layout">`)
    if (cardTitle) {
      lines.push(`${id(depth + 2)}<template #header>`)
      lines.push(`${id(depth + 3)}<span class="lc-card__title">${escHtml(cardTitle)}</span>`)
      lines.push(`${id(depth + 2)}</template>`)
    }
    lines.push(`${id(depth + 2)}<div class="lc-layout lc-layout--card">`)
    renderChildList(depth + 3)
    lines.push(`${id(depth + 2)}</div>`)
    lines.push(`${id(depth + 1)}</el-card>`)
    lines.push(`${id(depth)}</div>`)
    return lines
  }

  const layoutClassMap: Record<string, string> = {
    layoutRow: 'lc-layout--row',
    layoutColumn: 'lc-layout--column',
    layoutGrid: 'lc-layout--grid',
    layoutContainer: 'lc-layout--container',
    layoutFree: 'lc-layout--free',
    layoutHeader: 'lc-layout--header',
    layoutSidebar: 'lc-layout--sidebar',
    layoutFooter: 'lc-layout--footer'
  }

  const tagMap: Record<string, string> = {
    layoutHeader: 'header',
    layoutFooter: 'footer',
    layoutSidebar: 'aside',
    layoutContainer: 'section'
  }

  const shellTag = tagMap[node.type] || 'div'
  lines.push(`${id(depth)}<div class="lc-node ${cls}">`)
  lines.push(
    `${id(depth + 1)}<${shellTag} class="lc-layout ${layoutClassMap[node.type] || 'lc-layout--container'}">`
  )
  renderChildList(depth + 2)
  lines.push(`${id(depth + 1)}</${shellTag}>`)
  lines.push(`${id(depth)}</div>`)
  return lines
}
function buildTemplate(context: RenderContext) {
  const lines: string[] = []
  const rootNodes = sortNodes(context.childrenMap.__root__ || [], context.input.layoutMode, null)
  lines.push('<template>')
  lines.push('  <div class="lc-page">')
  lines.push(`    <div class="lc-page__canvas lc-page__canvas--${context.input.layoutMode}">`)
  if (!rootNodes.length) {
    lines.push('      <div class="lc-empty">鐢诲竷涓虹┖锛岃浠庡乏渚ф嫋鍏ョ粍浠躲€?/div>')
  } else {
    rootNodes.forEach((node) => {
      lines.push(...renderNode(node, context, 3))
    })
  }
  lines.push('    </div>')
  lines.push('  </div>')
  lines.push('</template>')
  return lines.join('\n')
}

function buildScript(context: RenderContext) {
  const lines: string[] = []
  const needTabs = Object.keys(context.tabDefaults).length > 0
  const needCharts = context.chartBindings.length > 0
  const needPagedTables = context.pagedTableBindings.length > 0

  if (needTabs || needCharts || needPagedTables) {
    const imports = new Set<string>()
    if (needTabs) imports.add('reactive')
    if (needCharts || needPagedTables) {
      imports.add('ref')
      imports.add('onMounted')
    }
    if (needCharts) {
      imports.add('onBeforeUnmount')
    }
    lines.push(`import { ${Array.from(imports).join(', ')} } from 'vue'`)
  }
  if (needCharts) {
    lines.push("import * as echarts from 'echarts'")
  }
  if (needPagedTables) {
    lines.push("import axios from 'axios'")
  }
  if (needTabs) {
    lines.push('')
    lines.push(
      `const tabState = reactive<Record<string, string>>(${JSON.stringify(context.tabDefaults, null, 2)})`
    )
  }
  if (needPagedTables) {
    lines.push('')
    lines.push('const toSafeIntValue = (value: any, fallback: number, min = 0) => {')
    lines.push('  const valueNum = Number(value)')
    lines.push('  if (!Number.isFinite(valueNum)) return fallback')
    lines.push('  return Math.max(min, Math.round(valueNum))')
    lines.push('}')
    lines.push('')
    lines.push('const parseJsonValue = (rawValue: any, fallback: any = {}) => {')
    lines.push("  if (rawValue === null || typeof rawValue === 'undefined') return fallback")
    lines.push("  if (typeof rawValue === 'string') {")
    lines.push('    const trimmed = rawValue.trim()')
    lines.push('    if (!trimmed) return fallback')
    lines.push('    try {')
    lines.push('      return JSON.parse(trimmed)')
    lines.push('    } catch {')
    lines.push('      return fallback')
    lines.push('    }')
    lines.push('  }')
    lines.push("  if (typeof rawValue === 'object') return rawValue")
    lines.push('  return fallback')
    lines.push('}')
    lines.push('')
    lines.push('const normalizePathSegments = (pathExpr: string, rootToken: string) => {')
    lines.push("  const normalizedPath = String(pathExpr || '').trim()")
    lines.push('  if (!normalizedPath) return [] as string[]')
    lines.push(
      "  const unwrapped = normalizedPath.startsWith('${') && normalizedPath.endsWith('}')"
    )
    lines.push('    ? normalizedPath.slice(2, -1).trim()')
    lines.push('    : normalizedPath')
    lines.push(
      '  const withoutRoot = unwrapped.startsWith(`${rootToken}.`) ? unwrapped.slice(rootToken.length + 1) : unwrapped'
    )
    lines.push(
      "  return withoutRoot.replace(/\\[(\\d+)\\]/g, '.$1').split('.').map((segment) => segment.trim()).filter(Boolean)"
    )
    lines.push('}')
    lines.push('')
    lines.push("const getByPath = (source: any, pathExpr: string, rootToken = 'obj') => {")
    lines.push('  const segments = normalizePathSegments(pathExpr, rootToken)')
    lines.push('  if (!segments.length) return source')
    lines.push('  return segments.reduce((currentValue: any, segment: string) => {')
    lines.push(
      "    if (currentValue === null || typeof currentValue === 'undefined') return undefined"
    )
    lines.push('    if (Array.isArray(currentValue)) {')
    lines.push('      const index = Number(segment)')
    lines.push('      if (!Number.isInteger(index) || index < 0) return undefined')
    lines.push('      return currentValue[index]')
    lines.push('    }')
    lines.push("    if (typeof currentValue !== 'object') return undefined")
    lines.push('    return currentValue[segment]')
    lines.push('  }, source)')
    lines.push('}')
    lines.push('')
    lines.push(
      'const resolveTemplateScopeValue = (expression: string, scope: { row: any; obj: any }) => {'
    )
    lines.push("  const normalizedExpr = String(expression || '').trim()")
    lines.push("  if (!normalizedExpr) return ''")
    lines.push(
      "  const cleanExpr = normalizedExpr.startsWith('${') && normalizedExpr.endsWith('}')"
    )
    lines.push('    ? normalizedExpr.slice(2, -1).trim()')
    lines.push('    : normalizedExpr')
    lines.push(
      "  if (cleanExpr === 'row' || cleanExpr.startsWith('row.')) return getByPath(scope.row, cleanExpr, 'row')"
    )
    lines.push(
      "  if (cleanExpr === 'obj' || cleanExpr.startsWith('obj.')) return getByPath(scope.obj, cleanExpr, 'obj')"
    )
    lines.push("  return getByPath(scope.obj, cleanExpr, 'obj')")
    lines.push('}')
    lines.push('')
    lines.push('const evaluateTemplateValue = (template: any, scope: { row: any; obj: any }) => {')
    lines.push("  if (typeof template !== 'string') return template")
    lines.push('  const trimmed = template.trim()')
    lines.push("  if (!trimmed) return ''")
    lines.push('  const fullExprMatch = trimmed.match(/^\\$\\{([^}]+)\\}$/)')
    lines.push('  if (fullExprMatch) {')
    lines.push('    const resolved = resolveTemplateScopeValue(fullExprMatch[1], scope)')
    lines.push("    return typeof resolved === 'undefined' ? '' : resolved")
    lines.push('  }')
    lines.push('  return template.replace(/\\$\\{([^}]+)\\}/g, (_, expression: string) => {')
    lines.push('    const resolved = resolveTemplateScopeValue(expression, scope)')
    lines.push("    if (resolved === null || typeof resolved === 'undefined') return ''")
    lines.push('    return String(resolved)')
    lines.push('  })')
    lines.push('}')

    context.pagedTableBindings.forEach((binding, index) => {
      const rawProps = binding.node.props || {}
      const fallbackColumns = String(rawProps.columns || '')
      const columnSchema = parsePagedTableColumnSchema(rawProps.columnSchema, fallbackColumns)
      const fallbackPageSize = Math.max(1, toSafeInt(rawProps.pageSize, 10, 1, 9999))
      const fallbackCurrentPage = Math.max(1, toSafeInt(rawProps.currentPage, 1, 1, 9999))
      const configLiteral = {
        dataSourceType: String(rawProps.dataSourceType || 'SELF').toUpperCase(),
        demoData: rawProps.demoData,
        restUrl: String(rawProps.restUrl || '').trim(),
        restMethod: String(rawProps.restMethod || 'GET')
          .trim()
          .toUpperCase(),
        restBody: rawProps.restBody,
        pageParamKey: String(rawProps.pageParamKey || 'current').trim() || 'current',
        sizeParamKey: String(rawProps.sizeParamKey || 'size').trim() || 'size',
        recordsPath: String(rawProps.recordsPath || 'obj.data.records'),
        totalPath: String(rawProps.totalPath || 'obj.data.total'),
        sizePath: String(rawProps.sizePath || 'obj.data.size'),
        currentPath: String(rawProps.currentPath || 'obj.data.current'),
        pagesPath: String(rawProps.pagesPath || 'obj.data.pages')
      }
      const applyFn = `applyPagedTable${index + 1}Payload`

      lines.push('')
      lines.push(`const ${binding.columnsVar} = ${JSON.stringify(columnSchema, null, 2)}`)
      lines.push(`const ${binding.configVar} = ${JSON.stringify(configLiteral, null, 2)}`)
      lines.push(`const ${binding.rowsVar} = ref<Array<Record<string, any>>>([])`)
      lines.push(`const ${binding.totalVar} = ref(0)`)
      lines.push(`const ${binding.sizeVar} = ref(${fallbackPageSize})`)
      lines.push(`const ${binding.currentVar} = ref(${fallbackCurrentPage})`)
      lines.push(`const ${binding.loadingVar} = ref(false)`)
      lines.push(`const ${binding.mapRowsFn} = (records: any[], payload: any) => {`)
      lines.push('  return records.map((rowItem: any) => {')
      lines.push('    const rowResult: Record<string, any> = {}')
      lines.push(`    ${binding.columnsVar}.forEach((column) => {`)
      lines.push(
        '      rowResult[column.key] = evaluateTemplateValue(column.valueExpr, { row: rowItem, obj: payload })'
      )
      lines.push('    })')
      lines.push('    return rowResult')
      lines.push('  })')
      lines.push('}')
      lines.push(`const ${applyFn} = (payload: any) => {`)
      lines.push(
        `  const recordsCandidate = getByPath(payload, ${binding.configVar}.recordsPath, 'obj')`
      )
      lines.push('  const records = Array.isArray(recordsCandidate) ? recordsCandidate : []')
      lines.push(`  ${binding.rowsVar}.value = ${binding.mapRowsFn}(records, payload)`)
      lines.push(
        `  const totalCandidate = getByPath(payload, ${binding.configVar}.totalPath, 'obj')`
      )
      lines.push(`  const sizeCandidate = getByPath(payload, ${binding.configVar}.sizePath, 'obj')`)
      lines.push(
        `  const currentCandidate = getByPath(payload, ${binding.configVar}.currentPath, 'obj')`
      )
      lines.push(`  ${binding.totalVar}.value = toSafeIntValue(totalCandidate, records.length, 0)`)
      lines.push(
        `  ${binding.sizeVar}.value = Math.max(1, toSafeIntValue(sizeCandidate, ${binding.sizeVar}.value, 1))`
      )
      lines.push(
        `  ${binding.currentVar}.value = Math.max(1, toSafeIntValue(currentCandidate, ${binding.currentVar}.value, 1))`
      )
      lines.push('}')
      lines.push(`const ${binding.fetchFn} = async () => {`)
      lines.push('  const params: Record<string, any> = {')
      lines.push(`    [${binding.configVar}.pageParamKey]: ${binding.currentVar}.value,`)
      lines.push(`    [${binding.configVar}.sizeParamKey]: ${binding.sizeVar}.value`)
      lines.push('  }')
      lines.push(`  ${binding.loadingVar}.value = true`)
      lines.push('  try {')
      lines.push('    let payload: any = {}')
      lines.push(
        `    const sourceType = String(${binding.configVar}.dataSourceType || 'SELF').toUpperCase()`
      )
      lines.push(`    const restUrl = String(${binding.configVar}.restUrl || '').trim()`)
      lines.push("    if (sourceType === 'REST' && restUrl) {")
      lines.push(
        `      const method = String(${binding.configVar}.restMethod || 'GET').toUpperCase()`
      )
      lines.push("      if (method === 'GET') {")
      lines.push('        const response = await axios.get(restUrl, { params })')
      lines.push('        payload = response?.data')
      lines.push('      } else {')
      lines.push(`        const requestBody = parseJsonValue(${binding.configVar}.restBody, {})`)
      lines.push(
        `        requestBody[${binding.configVar}.pageParamKey] = ${binding.currentVar}.value`
      )
      lines.push(
        `        requestBody[${binding.configVar}.sizeParamKey] = ${binding.sizeVar}.value`
      )
      lines.push('        const response = await axios({')
      lines.push('          url: restUrl,')
      lines.push('          method,')
      lines.push('          data: requestBody')
      lines.push('        })')
      lines.push('        payload = response?.data')
      lines.push('      }')
      lines.push('    } else {')
      lines.push(`      payload = parseJsonValue(${binding.configVar}.demoData, {})`)
      lines.push('    }')
      lines.push(`    ${applyFn}(payload)`)
      lines.push('  } catch (error) {')
      lines.push("    console.error('获取数据失败：', error)")
      lines.push(`    ${binding.rowsVar}.value = []`)
      lines.push(`    ${binding.totalVar}.value = 0`)
      lines.push('  } finally {')
      lines.push(`    ${binding.loadingVar}.value = false`)
      lines.push('  }')
      lines.push('}')
      lines.push(`const ${binding.onSizeChangeFn} = (val: number) => {`)
      lines.push(
        `  ${binding.sizeVar}.value = Math.max(1, toSafeIntValue(val, ${binding.sizeVar}.value, 1))`
      )
      lines.push(`  ${binding.currentVar}.value = 1`)
      lines.push(`  void ${binding.fetchFn}()`)
      lines.push('}')
      lines.push(`const ${binding.onCurrentChangeFn} = (val: number) => {`)
      lines.push(
        `  ${binding.currentVar}.value = Math.max(1, toSafeIntValue(val, ${binding.currentVar}.value, 1))`
      )
      lines.push(`  void ${binding.fetchFn}()`)
      lines.push('}')
    })
  }
  if (needCharts) {
    context.chartBindings.forEach((binding) => {
      lines.push('')
      lines.push(`const ${binding.refVar} = ref<HTMLElement | null>(null)`)
      lines.push(`let ${binding.insVar}: echarts.ECharts | null = null`)
      lines.push(`const ${binding.optVar} = ${resolveChartOptionCode(binding.node)}`)
      lines.push(`const ${binding.initFn} = () => {`)
      lines.push(`  if (!${binding.refVar}.value) return`)
      lines.push(`  ${binding.insVar} = echarts.init(${binding.refVar}.value)`)
      lines.push(`  ${binding.insVar}.setOption(${binding.optVar}, true)`)
      lines.push('}')
    })
    lines.push('')
    lines.push('const resizeCharts = () => {')
    context.chartBindings.forEach((binding) => {
      lines.push(`  ${binding.insVar}?.resize()`)
    })
    lines.push('}')
  }

  if (needCharts || needPagedTables) {
    lines.push('')
    lines.push('onMounted(() => {')
    if (needCharts) {
      context.chartBindings.forEach((binding) => {
        lines.push(`  ${binding.initFn}()`)
      })
      lines.push("  window.addEventListener('resize', resizeCharts)")
    }
    if (needPagedTables) {
      context.pagedTableBindings.forEach((binding) => {
        lines.push(`  void ${binding.fetchFn}()`)
      })
    }
    lines.push('})')
  }

  if (needCharts) {
    lines.push('')
    lines.push('onBeforeUnmount(() => {')
    lines.push("  window.removeEventListener('resize', resizeCharts)")
    context.chartBindings.forEach((binding) => {
      lines.push(`  ${binding.insVar}?.dispose()`)
      lines.push(`  ${binding.insVar} = null`)
    })
    lines.push('})')
  }

  if (!lines.length) {
    return '<script setup lang="ts">\n// Generated from low-code canvas. Add business logic here if needed.\n</script>'
  }
  return `<script setup lang="ts">\n${lines.join('\n')}\n</script>`
}

function buildStyle(context: RenderContext) {
  const lines: string[] = []
  lines.push('<style scoped>')
  lines.push(
    `.lc-page { width: 100%; min-height: 100vh; box-sizing: border-box; padding: 16px; background: ${context.input.canvasBackground || '#ffffff'}; }`
  )
  lines.push(
    '.lc-page__canvas { position: relative; width: min(1440px, 100%); min-height: calc(100vh - 32px); margin: 0 auto; border-radius: 12px; overflow: auto; background: #ffffff; }'
  )
  lines.push(
    `.lc-page__canvas--grid9 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(${Math.max(1, n(context.input.gridRows, 3, 1, 20))}, minmax(160px, 1fr)); gap: 12px; padding: 14px; align-content: start; }`
  )
  lines.push(
    '.lc-empty { width: 100%; min-height: 200px; display: flex; align-items: center; justify-content: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 12px; background: rgba(255, 255, 255, 0.85); }'
  )
  lines.push('.lc-empty--slot { min-height: 120px; font-size: 12px; border-style: dashed; }')

  lines.push('.lc-node { box-sizing: border-box; min-width: 0; }')
  lines.push(
    '.lc-layout { width: 100%; height: 100%; display: flex; gap: var(--gap, 0px); padding: var(--pad, 0px); overflow: hidden; box-sizing: border-box; }'
  )
  lines.push(
    '.lc-layout--row { flex-direction: row; flex-wrap: var(--wrap, wrap); justify-content: var(--justify, flex-start); align-items: var(--align, stretch); }'
  )
  lines.push('.lc-layout--row > .lc-node { flex: 1 1 var(--min-item-width, 180px); }')
  lines.push(
    '.lc-layout--column, .lc-layout--container, .lc-layout--sidebar, .lc-layout--card { flex-direction: column; justify-content: var(--justify, flex-start); align-items: var(--align, stretch); }'
  )
  lines.push(
    '.lc-layout--header, .lc-layout--footer { flex-direction: row; justify-content: var(--justify, space-between); align-items: var(--align, center); }'
  )
  lines.push(
    '.lc-layout--grid { display: grid; grid-template-columns: repeat(var(--grid-desktop, 4), minmax(0, 1fr)); grid-template-rows: repeat(var(--grid-rows, 3), minmax(0, 1fr)); gap: var(--gap, 0px); }'
  )
  lines.push('.lc-layout--free { position: relative; display: block; }')

  lines.push(
    '.lc-card { width: 100%; height: 100%; border-radius: var(--radius, 12px); overflow: hidden; }'
  )
  lines.push('.lc-card__title { font-weight: 600; color: #1f2937; }')
  lines.push('.lc-card--layout :deep(.el-card__header) { padding: 10px 14px; }')
  lines.push('.lc-card--layout :deep(.el-card__body) { height: calc(100% - 44px); padding: 0; }')

  lines.push('.lc-tabs { width: 100%; height: 100%; }')
  lines.push('.lc-tabs :deep(.el-tabs__content) { height: calc(100% - 42px); }')
  lines.push('.lc-tabs :deep(.el-tab-pane) { height: 100%; }')
  lines.push(
    '.lc-tab-pane { width: 100%; height: 100%; position: relative; box-sizing: border-box; padding: 0; }'
  )

  lines.push('.lc-node__text { display: block; width: 100%; line-height: 1.6; color: inherit; }')
  lines.push(
    '.lc-node__chart, .lc-node__image, .lc-node__date, .lc-node__table { width: 100%; height: 100%; }'
  )
  lines.push(
    '.lc-node__paged-table { width: 100%; height: 100%; display: flex; flex-direction: column; gap: 8px; min-height: 0; }'
  )
  lines.push(
    '.lc-node__paged-pagination { display: flex; align-items: center; justify-content: flex-end; min-height: 30px; }'
  )
  lines.push('.lc-node__card { width: 100%; height: 100%; }')
  lines.push('.lc-node__card-title { font-weight: 600; color: #1f2937; }')
  lines.push('.lc-node__card-body { color: #475569; line-height: 1.6; white-space: pre-wrap; }')
  lines.push(
    '.lc-node__img-ph { width: 100%; min-height: 120px; display: flex; align-items: center; justify-content: center; border-radius: 10px; border: 1px dashed #cbd5e1; color: #64748b; background: #fff; }'
  )
  lines.push('.lc-node__divider { margin: 0; }')
  lines.push('.lc-node__spacer { width: 100%; }')
  lines.push(
    '.lc-node__border { width: 100%; height: 100%; border: 1px solid currentColor; border-radius: 10px; display: flex; flex-direction: column; overflow: hidden; }'
  )
  lines.push(
    '.lc-node__border-title { padding: 8px 10px; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(148, 163, 184, 0.4); }'
  )
  lines.push('.lc-node__border-body { flex: 1; }')
  lines.push(
    '.lc-node__deco { width: 100%; min-height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(14, 165, 233, 0.1)); color: #334155; font-size: 12px; }'
  )

  context.input.nodes
    .filter((node) => node.visible !== false)
    .forEach((node) => {
      const cls = getNodeClass(node.id, context)
      const parentNode = node.parentId ? context.nodeMap.get(node.parentId) || null : null
      const isAbs = parentNode
        ? parentNode.type === 'layoutFree' || parentNode.type === 'layoutTabs'
        : context.input.layoutMode === 'free'
      const size = resolveSize(node, parentNode)

      lines.push(`.${cls} {`)
      if (isAbs) {
        lines.push('  position: absolute;')
        lines.push(`  left: ${Math.max(0, n(node.x, 0))}px;`)
        lines.push(`  top: ${Math.max(0, n(node.y, 0))}px;`)
        lines.push(`  width: ${size.width};`)
        lines.push(`  height: ${size.height};`)
        lines.push(`  z-index: ${Math.max(1, n(node.zIndex, 1))};`)
      } else {
        lines.push('  position: relative;')
        lines.push(`  width: ${size.width};`)
        lines.push(`  min-height: ${size.height};`)
      }

      if (
        !parentNode &&
        context.input.layoutMode === 'grid9' &&
        typeof node.gridCell === 'number'
      ) {
        lines.push(`  grid-column: ${(node.gridCell % 3) + 1};`)
        lines.push(`  grid-row: ${Math.floor(node.gridCell / 3) + 1};`)
      }

      if (LAYOUT_TYPES.has(node.type)) {
        lines.push(`  --gap: ${n(node.props?.gap, 0)}px;`)
        lines.push(`  --pad: ${n(node.props?.padding, 0)}px;`)

        if (node.type === 'layoutRow') {
          lines.push(`  --justify: ${String(node.props?.justify || 'flex-start')};`)
          lines.push(`  --align: ${String(node.props?.align || 'stretch')};`)
          lines.push(`  --wrap: ${node.props?.wrap === false ? 'nowrap' : 'wrap'};`)
          lines.push(`  --min-item-width: ${n(node.props?.minItemWidth, 180, 80, 800)}px;`)
        }

        if (
          node.type === 'layoutColumn' ||
          node.type === 'layoutContainer' ||
          node.type === 'layoutHeader' ||
          node.type === 'layoutFooter'
        ) {
          lines.push(`  --justify: ${String(node.props?.justify || 'flex-start')};`)
          lines.push(`  --align: ${String(node.props?.align || 'stretch')};`)
        }

        if (node.type === 'layoutGrid') {
          lines.push(`  --grid-desktop: ${n(node.props?.columnsDesktop, 4, 1, 24)};`)
          lines.push(`  --grid-tablet: ${n(node.props?.columnsTablet, 2, 1, 24)};`)
          lines.push(`  --grid-mobile: ${n(node.props?.columnsMobile, 1, 1, 24)};`)
          lines.push(`  --grid-rows: ${n(node.props?.rows, 3, 1, 24)};`)
        }
      }

      if (node.type === 'layoutHeader' || node.type === 'layoutFooter') {
        lines.push(`  min-height: ${n(node.props?.height, node.height, 40, 400)}px;`)
      }

      if (node.type === 'layoutSidebar') {
        lines.push(`  width: ${n(node.props?.sidebarWidth, node.width, 120, 520)}px;`)
      }

      if (node.style?.color) lines.push(`  color: ${String(node.style.color)};`)
      if (node.style?.backgroundColor)
        lines.push(`  background-color: ${String(node.style.backgroundColor)};`)
      if (node.style?.fontSize) lines.push(`  font-size: ${n(node.style.fontSize, 14)}px;`)
      if (node.style?.fontWeight) lines.push(`  font-weight: ${String(node.style.fontWeight)};`)
      if (node.style?.borderRadius !== undefined) {
        const radius = `${n(node.style.borderRadius, 0)}px`
        lines.push(`  border-radius: ${radius};`)
        lines.push(`  --radius: ${radius};`)
      }
      lines.push('}')
    })

  lines.push('@media (max-width: 1100px) {')
  lines.push(
    '  .lc-layout--grid { grid-template-columns: repeat(var(--grid-tablet, 2), minmax(0, 1fr)); }'
  )
  lines.push('}')
  lines.push('@media (max-width: 760px) {')
  lines.push('  .lc-page { padding: 10px; }')
  lines.push('  .lc-page__canvas { min-height: calc(100vh - 20px); border-radius: 10px; }')
  lines.push('  .lc-layout--row { flex-direction: column; }')
  lines.push(
    '  .lc-layout--grid { grid-template-columns: repeat(var(--grid-mobile, 1), minmax(0, 1fr)); }'
  )
  lines.push('}')

  lines.push('</style>')
  return lines.join('\n')
}
export function generateVueSourceFromDsl(input: GeneratorInput) {
  const simplePagedTableSource = tryGenerateSimplePagedTableSource(input)
  if (simplePagedTableSource) {
    return simplePagedTableSource
  }

  const simpleFormPageSource = tryGenerateSimpleFormPageSource(input)
  if (simpleFormPageSource) {
    return simpleFormPageSource
  }

  const simpleCrudPageSource = tryGenerateSimpleCrudPageSource(input)
  if (simpleCrudPageSource) {
    return simpleCrudPageSource
  }

  const semanticLayoutPageSource = tryGenerateSemanticLayoutPageSource(input)
  if (semanticLayoutPageSource) {
    return semanticLayoutPageSource
  }

  const nodes = input.nodes.filter((node) => node.visible !== false).map((node) => ({ ...node }))
  const context: RenderContext = {
    input,
    nodeMap: new Map(nodes.map((node) => [node.id, node])),
    childrenMap: groupChildren(nodes),
    nodeClassMap: buildNodeClassMap(nodes),
    chartBindings: [],
    pagedTableBindings: [],
    tabDefaults: {}
  }
  const template = buildTemplate(context)
  const script = buildScript(context)
  const style = buildStyle(context)
  return `${template}\n\n${script}\n\n${style}\n`
}
