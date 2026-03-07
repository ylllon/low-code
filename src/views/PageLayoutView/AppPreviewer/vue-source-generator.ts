import type { CanvasComponentNode, CanvasLayoutMode } from '@/views/PageLayoutView/component-library'
import { buildDefaultChartOption, parseCustomChartOption } from '@/views/PageLayoutView/AppPreviewer/echarts-option.utils'

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

interface RenderContext {
  input: GeneratorInput
  nodeMap: Map<string, CanvasComponentNode>
  childrenMap: Record<string, CanvasComponentNode[]>
  nodeClassMap: Record<string, string>
  chartBindings: ChartBinding[]
  tabDefaults: Record<string, string>
}

const CHART_TYPES = new Set(['barChart', 'lineChart', 'pieChart', 'gaugeChart', 'customChart'])
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

function buildChartOption(node: CanvasComponentNode) {
  const chartType = (
    node.type === 'lineChart' || node.type === 'pieChart' || node.type === 'gaugeChart' || node.type === 'customChart'
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

  const rawChartOption = typeof node.props?.chartOption === 'string' ? node.props.chartOption.trim() : ''
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

function sortNodes(nodes: CanvasComponentNode[], layoutMode: CanvasLayoutMode, parentType: string | null) {
  return [...nodes].sort((left, right) => {
    if (!parentType && layoutMode === 'grid9') {
      const leftCell = typeof left.gridCell === 'number' ? left.gridCell : Number.POSITIVE_INFINITY
      const rightCell = typeof right.gridCell === 'number' ? right.gridCell : Number.POSITIVE_INFINITY
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
    lines.push(`${id(depth + 1)}<span class="lc-node__text">${escHtml(String(node.props?.text || node.title || '\u6587\u672c'))}</span>`)
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
    lines.push(`${id(depth + 2)}<el-option v-for="option in ${JSON.stringify(options)}" :key="option" :label="option" :value="option" />`)
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
    lines.push(`${id(depth + 1)}<el-table class="lc-node__table" :data='${JSON.stringify(rows)}' border stripe height="100%">`)
    lines.push(
      `${id(depth + 2)}<el-table-column v-for="col in ${JSON.stringify(columns)}" :key="col" :prop="col" :label="col" min-width="120" show-overflow-tooltip />`
    )
    lines.push(`${id(depth + 1)}</el-table>`)
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
    lines.push(`${id(depth + 1)}<el-divider class="lc-node__divider" direction="${dir === 'vertical' ? 'vertical' : 'horizontal'}" />`)
  } else if (node.type === 'spacer') {
    lines.push(`${id(depth + 1)}<div class="lc-node__spacer" style="height: ${n(node.props?.space, node.height, 4, 400)}px;"></div>`)
  } else if (node.type === 'borderBox') {
    lines.push(`${id(depth + 1)}<div class="lc-node__border">`)
    lines.push(`${id(depth + 2)}<div class="lc-node__border-title">${escHtml(String(node.props?.borderTitle || '鍒嗗尯鏍囬'))}</div>`)
    lines.push(`${id(depth + 2)}<div class="lc-node__border-body"></div>`)
    lines.push(`${id(depth + 1)}</div>`)
  } else if (node.type === 'decorationLine') {
    lines.push(`${id(depth + 1)}<div class="lc-node__deco"><span>${escHtml(String(node.props?.text || '瑁呴グ鍒嗗壊'))}</span></div>`)
  } else {
    lines.push(`${id(depth + 1)}<span class="lc-node__text">${escHtml(String(node.title || node.type))}</span>`)
  }

  lines.push(`${id(depth)}</div>`)
  return lines
}
function renderLayoutNode(node: CanvasComponentNode, context: RenderContext, depth: number): string[] {
  const cls = getNodeClass(node.id, context)
  const children = sortNodes(context.childrenMap[node.id] || [], context.input.layoutMode, node.type)
  const lines: string[] = []

  const renderChildList = (nextDepth: number, list: CanvasComponentNode[] = children) => {
    if (!list.length) {
      lines.push(`${id(nextDepth)}<div class="lc-empty lc-empty--slot">鍙湪姝ゅ尯鍩熸嫋鍏ョ粍浠?/div>`)
      return
    }
    list.forEach((child) => {
      lines.push(...renderNode(child, context, nextDepth))
    })
  }

  if (node.type === 'layoutTabs') {
    const tabs = parseList(node.props?.tabs, ['閫夐」鍗?', '閫夐」鍗?'])
    context.tabDefaults[node.id] = String(n(node.props?.activeTab, 0, 0, Math.max(0, tabs.length - 1)))
    lines.push(`${id(depth)}<div class="lc-node ${cls}">`)
    lines.push(`${id(depth + 1)}<el-tabs v-model="tabState['${escHtml(node.id)}']" class="lc-tabs">`)
    tabs.forEach((tab, index) => {
      const paneNodes = children.filter((child) => n(child.props?.tabIndex, 0, 0, Math.max(0, tabs.length - 1)) === index)
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
  lines.push(`${id(depth + 1)}<${shellTag} class="lc-layout ${layoutClassMap[node.type] || 'lc-layout--container'}">`)
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

  if (needTabs || needCharts) {
    const imports = new Set<string>()
    if (needTabs) imports.add('reactive')
    if (needCharts) {
      imports.add('ref')
      imports.add('onMounted')
      imports.add('onBeforeUnmount')
    }
    lines.push(`import { ${Array.from(imports).join(', ')} } from 'vue'`)
  }
  if (needCharts) {
    lines.push("import * as echarts from 'echarts'")
  }
  if (needTabs) {
    lines.push('')
    lines.push(`const tabState = reactive<Record<string, string>>(${JSON.stringify(context.tabDefaults, null, 2)})`)
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
    lines.push('')
    lines.push('onMounted(() => {')
    context.chartBindings.forEach((binding) => {
      lines.push(`  ${binding.initFn}()`)
    })
    lines.push("  window.addEventListener('resize', resizeCharts)")
    lines.push('})')
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
    return '<script setup lang="ts">\n// 鐢变綆浠ｇ爜鐢诲竷鐢熸垚锛屽彲鍦ㄦ琛ュ厖涓氬姟閫昏緫銆俓n</script>'
  }
  return `<script setup lang="ts">\n${lines.join('\n')}\n</script>`
}

function buildStyle(context: RenderContext) {
  const lines: string[] = []
  lines.push('<style scoped>')
  lines.push(`.lc-page { width: 100%; min-height: 100vh; box-sizing: border-box; padding: 16px; background: ${context.input.canvasBackground || '#ffffff'}; }`)
  lines.push('.lc-page__canvas { position: relative; width: min(1440px, 100%); min-height: calc(100vh - 32px); margin: 0 auto; border-radius: 12px; overflow: auto; background: #ffffff; }')
  lines.push(`.lc-page__canvas--grid9 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(${Math.max(1, n(context.input.gridRows, 3, 1, 20))}, minmax(160px, 1fr)); gap: 12px; padding: 14px; align-content: start; }`)
  lines.push('.lc-empty { width: 100%; min-height: 200px; display: flex; align-items: center; justify-content: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 12px; background: rgba(255, 255, 255, 0.85); }')
  lines.push('.lc-empty--slot { min-height: 120px; font-size: 12px; border-style: dashed; }')

  lines.push('.lc-node { box-sizing: border-box; min-width: 0; }')
  lines.push('.lc-layout { width: 100%; height: 100%; display: flex; gap: var(--gap, 0px); padding: var(--pad, 0px); overflow: hidden; box-sizing: border-box; }')
  lines.push('.lc-layout--row { flex-direction: row; flex-wrap: var(--wrap, wrap); justify-content: var(--justify, flex-start); align-items: var(--align, stretch); }')
  lines.push('.lc-layout--row > .lc-node { flex: 1 1 var(--min-item-width, 180px); }')
  lines.push('.lc-layout--column, .lc-layout--container, .lc-layout--sidebar, .lc-layout--card { flex-direction: column; justify-content: var(--justify, flex-start); align-items: var(--align, stretch); }')
  lines.push('.lc-layout--header, .lc-layout--footer { flex-direction: row; justify-content: var(--justify, space-between); align-items: var(--align, center); }')
  lines.push('.lc-layout--grid { display: grid; grid-template-columns: repeat(var(--grid-desktop, 4), minmax(0, 1fr)); grid-template-rows: repeat(var(--grid-rows, 3), minmax(0, 1fr)); gap: var(--gap, 0px); }')
  lines.push('.lc-layout--free { position: relative; display: block; }')

  lines.push('.lc-card { width: 100%; height: 100%; border-radius: var(--radius, 12px); overflow: hidden; }')
  lines.push('.lc-card__title { font-weight: 600; color: #1f2937; }')
  lines.push('.lc-card--layout :deep(.el-card__header) { padding: 10px 14px; }')
  lines.push('.lc-card--layout :deep(.el-card__body) { height: calc(100% - 44px); padding: 0; }')

  lines.push('.lc-tabs { width: 100%; height: 100%; }')
  lines.push('.lc-tabs :deep(.el-tabs__content) { height: calc(100% - 42px); }')
  lines.push('.lc-tabs :deep(.el-tab-pane) { height: 100%; }')
  lines.push('.lc-tab-pane { width: 100%; height: 100%; position: relative; box-sizing: border-box; padding: 0; }')

  lines.push('.lc-node__text { display: block; width: 100%; line-height: 1.6; color: inherit; }')
  lines.push('.lc-node__chart, .lc-node__image, .lc-node__date, .lc-node__table { width: 100%; height: 100%; }')
  lines.push('.lc-node__card { width: 100%; height: 100%; }')
  lines.push('.lc-node__card-title { font-weight: 600; color: #1f2937; }')
  lines.push('.lc-node__card-body { color: #475569; line-height: 1.6; white-space: pre-wrap; }')
  lines.push('.lc-node__img-ph { width: 100%; min-height: 120px; display: flex; align-items: center; justify-content: center; border-radius: 10px; border: 1px dashed #cbd5e1; color: #64748b; background: #fff; }')
  lines.push('.lc-node__divider { margin: 0; }')
  lines.push('.lc-node__spacer { width: 100%; }')
  lines.push('.lc-node__border { width: 100%; height: 100%; border: 1px solid currentColor; border-radius: 10px; display: flex; flex-direction: column; overflow: hidden; }')
  lines.push('.lc-node__border-title { padding: 8px 10px; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(148, 163, 184, 0.4); }')
  lines.push('.lc-node__border-body { flex: 1; }')
  lines.push('.lc-node__deco { width: 100%; min-height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(14, 165, 233, 0.1)); color: #334155; font-size: 12px; }')

  context.input.nodes
    .filter((node) => node.visible !== false)
    .forEach((node) => {
      const cls = getNodeClass(node.id, context)
      const parentNode = node.parentId ? context.nodeMap.get(node.parentId) || null : null
      const isAbs = parentNode ? parentNode.type === 'layoutFree' || parentNode.type === 'layoutTabs' : context.input.layoutMode === 'free'
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

      if (!parentNode && context.input.layoutMode === 'grid9' && typeof node.gridCell === 'number') {
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

        if (node.type === 'layoutColumn' || node.type === 'layoutContainer' || node.type === 'layoutHeader' || node.type === 'layoutFooter') {
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
      if (node.style?.backgroundColor) lines.push(`  background-color: ${String(node.style.backgroundColor)};`)
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
  lines.push('  .lc-layout--grid { grid-template-columns: repeat(var(--grid-tablet, 2), minmax(0, 1fr)); }')
  lines.push('}')
  lines.push('@media (max-width: 760px) {')
  lines.push('  .lc-page { padding: 10px; }')
  lines.push('  .lc-page__canvas { min-height: calc(100vh - 20px); border-radius: 10px; }')
  lines.push('  .lc-layout--row { flex-direction: column; }')
  lines.push('  .lc-layout--grid { grid-template-columns: repeat(var(--grid-mobile, 1), minmax(0, 1fr)); }')
  lines.push('}')

  lines.push('</style>')
  return lines.join('\n')
}
export function generateVueSourceFromDsl(input: GeneratorInput) {
  const nodes = input.nodes.filter((node) => node.visible !== false).map((node) => ({ ...node }))
  const context: RenderContext = {
    input,
    nodeMap: new Map(nodes.map((node) => [node.id, node])),
    childrenMap: groupChildren(nodes),
    nodeClassMap: buildNodeClassMap(nodes),
    chartBindings: [],
    tabDefaults: {}
  }
  const template = buildTemplate(context)
  const script = buildScript(context)
  const style = buildStyle(context)
  return `${template}\n\n${script}\n\n${style}\n`
}






