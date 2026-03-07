<script setup lang="ts">
import { computed, ref } from 'vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ContextMenu.vue'
import type { CanvasComponentNode } from '@/views/PageLayoutView/component-library'
import { LOW_CODE_COMPONENT_MIME_TYPE, componentLibraryMap } from '@/views/PageLayoutView/component-library'
import EChartsNodeRenderer from '@/views/PageLayoutView/AppPreviewer/EChartsNodeRenderer.vue'

defineOptions({
  name: 'CanvasNodeCard'
})

const props = withDefaults(
  defineProps<{
    node: CanvasComponentNode
    selected?: boolean
    selectedNodeId?: string
    draggable?: boolean
    nested?: boolean
    nodeChildrenMap?: Record<string, CanvasComponentNode[]>
  }>(),
  {
    selected: false,
    selectedNodeId: '',
    draggable: false,
    nested: false,
    nodeChildrenMap: () => ({})
  }
)

const emit = defineEmits<{
  (e: 'select', nodeId: string): void
  (e: 'remove', nodeId: string): void
  (e: 'pointer-down', event: PointerEvent, nodeId: string): void
  (e: 'resize-start', event: PointerEvent, nodeId: string, direction: ResizeHandleDirection): void
  (e: 'drop-to-layout', event: DragEvent, layoutNodeId: string): void
  (e: 'layout-tab-change', layoutNodeId: string, activeTab: number): void
}>()

type ResizeHandleDirection = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

interface TableColumnMeta {
  label: string
  prop: string
}

type NodeSizeMode = 'fixed' | 'responsive'

const childNodes = computed(() => {
  const rawChildren = props.nodeChildrenMap[props.node.id] || []
  return [...rawChildren].sort((left, right) => {
    if (left.zIndex === right.zIndex) {
      return left.id.localeCompare(right.id)
    }
    return left.zIndex - right.zIndex
  })
})

const isNodeSelected = computed(() => {
  return props.selected || props.selectedNodeId === props.node.id
})

const isLayoutNode = computed(() => {
  return Boolean(componentLibraryMap[props.node.type]?.canAcceptChildren)
})

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const layoutDropActive = ref(false)

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  return [
    {
      key: 'delete-node',
      label: '删除组件'
    }
  ]
})

function toCssUnit(value: any) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`
  }

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  return undefined
}

function toNumber(value: any, fallback: number, minValue = 0) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }
  return Math.max(minValue, Math.round(num))
}

function resolveNodeSizeMode(node: CanvasComponentNode): NodeSizeMode {
  return node.props?.sizeMode === 'responsive' ? 'responsive' : 'fixed'
}

function resolveNodeSizePercent(node: CanvasComponentNode, key: 'widthPercent' | 'heightPercent', fallback = 100) {
  const rawValue = Number(node.props?.[key])
  if (!Number.isFinite(rawValue)) {
    return Math.min(Math.max(Math.round(fallback), 1), 100)
  }
  return Math.min(Math.max(Math.round(rawValue), 1), 100)
}

function resolveNodeSizeCss(node: CanvasComponentNode) {
  if (resolveNodeSizeMode(node) === 'fixed') {
    return {
      widthCss: `${Math.max(1, Math.round(node.width))}px`,
      heightCss: `${Math.max(1, Math.round(node.height))}px`
    }
  }

  const fallbackWidthPercent = node.width > 0 ? 100 : 100
  const fallbackHeightPercent = node.height > 0 ? 100 : 100
  const widthPercent = resolveNodeSizePercent(node, 'widthPercent', fallbackWidthPercent)
  const heightPercent = resolveNodeSizePercent(node, 'heightPercent', fallbackHeightPercent)

  return {
    widthCss: `${widthPercent}%`,
    heightCss: `${heightPercent}%`
  }
}

/**
 * 构建节点外层样式。
 * 这里只做“尺寸与基础样式承接”，不再给节点加额外卡片框。
 */
function buildNodeShellStyle(node: CanvasComponentNode) {
  return {
    color: node.style?.color,
    backgroundColor: node.style?.backgroundColor,
    fontSize: toCssUnit(node.style?.fontSize),
    fontWeight: node.style?.fontWeight,
    borderRadius: toCssUnit(node.style?.borderRadius)
  }
}

function resolveLayoutContainerClass(node: CanvasComponentNode) {
  if (node.type === 'layoutFree') {
    return 'layout-free-shell'
  }
  if (node.type === 'layoutColumn') {
    return 'layout-column-shell'
  }
  if (node.type === 'layoutGrid') {
    return 'layout-grid-shell'
  }
  if (node.type === 'layoutTabs') {
    return 'layout-tabs-shell'
  }
  if (node.type === 'layoutHeader') {
    return 'layout-header-shell'
  }
  if (node.type === 'layoutSidebar') {
    return 'layout-sidebar-shell'
  }
  if (node.type === 'layoutFooter') {
    return 'layout-footer-shell'
  }
  return 'layout-row-shell'
}

function buildLayoutContainerStyle(node: CanvasComponentNode) {
  const gap = toNumber(node.props?.gap, 0)
  const padding = toNumber(node.props?.padding, 0)
  const justify = String(node.props?.justify || 'flex-start')
  const align = String(node.props?.align || 'stretch')
  const wrap = node.props?.wrap !== false

  if (node.type === 'layoutColumn') {
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      justifyContent: justify,
      alignItems: align
    }
  }

  if (node.type === 'layoutGrid') {
    const desktopColumns = toNumber(node.props?.columnsDesktop, 4, 1)
    const tabletColumns = toNumber(node.props?.columnsTablet, 2, 1)
    const mobileColumns = toNumber(node.props?.columnsMobile, 1, 1)
    const rows = toNumber(node.props?.rows, 3, 1)
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      '--lc-grid-columns-desktop': desktopColumns,
      '--lc-grid-columns-tablet': tabletColumns,
      '--lc-grid-columns-mobile': mobileColumns,
      // 行数交由 CSS 变量驱动，避免固定 3 行导致空白空间过大。
      '--lc-grid-rows': rows
    } as Record<string, string | number>
  }

  if (node.type === 'layoutContainer') {
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      justifyContent: justify,
      alignItems: align,
      flexDirection: 'column'
    }
  }

  if (node.type === 'layoutFree') {
    return {
      padding: `${padding}px`
    }
  }

  if (node.type === 'layoutTabs') {
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      flexDirection: 'column'
    }
  }

  if (node.type === 'layoutCard') {
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      flexDirection: 'column',
      border: '1px solid rgba(148, 163, 184, 0.3)'
    }
  }

  if (node.type === 'layoutHeader') {
    const headerHeight = toNumber(node.props?.height, 80, 40)
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      justifyContent: justify,
      alignItems: align,
      minHeight: `${headerHeight}px`
    }
  }

  if (node.type === 'layoutSidebar') {
    const sidebarWidth = toNumber(node.props?.sidebarWidth, 260, 120)
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      width: `${sidebarWidth}px`,
      flexDirection: 'column',
      alignItems: 'stretch'
    }
  }

  if (node.type === 'layoutFooter') {
    const footerHeight = toNumber(node.props?.height, 72, 40)
    return {
      gap: `${gap}px`,
      padding: `${padding}px`,
      justifyContent: justify,
      alignItems: align,
      minHeight: `${footerHeight}px`
    }
  }

  return {
    gap: `${gap}px`,
    padding: `${padding}px`,
    justifyContent: justify,
    alignItems: align,
    flexWrap: wrap ? 'wrap' : 'nowrap'
  }
}

function buildLayoutChildStyle(layoutNode: CanvasComponentNode, childNode: CanvasComponentNode) {
  const sizeMode = resolveNodeSizeMode(childNode)
  const sizeCss = resolveNodeSizeCss(childNode)

  if (layoutNode.type === 'layoutRow') {
    if (sizeMode === 'responsive') {
      return {
        flex: `0 0 ${sizeCss.widthCss}`,
        maxWidth: sizeCss.widthCss,
        minHeight: sizeCss.heightCss
      }
    }
    return {
      flex: '0 0 auto',
      width: sizeCss.widthCss,
      maxWidth: '100%',
      minHeight: sizeCss.heightCss
    }
  }

  if (
    layoutNode.type === 'layoutColumn' ||
    layoutNode.type === 'layoutContainer' ||
    layoutNode.type === 'layoutCard' ||
    layoutNode.type === 'layoutSidebar'
  ) {
    return {
      width: sizeCss.widthCss,
      maxWidth: '100%',
      minHeight: sizeCss.heightCss
    }
  }

  if (layoutNode.type === 'layoutHeader' || layoutNode.type === 'layoutFooter') {
    if (sizeMode === 'responsive') {
      return {
        flex: `0 0 ${sizeCss.widthCss}`,
        maxWidth: sizeCss.widthCss,
        minHeight: sizeCss.heightCss
      }
    }
    return {
      flex: '0 0 auto',
      width: sizeCss.widthCss,
      maxWidth: '100%',
      minHeight: sizeCss.heightCss
    }
  }

  return {
    minWidth: '0',
    minHeight: sizeCss.heightCss
  }
}

function buildLayoutFreeChildStyle(node: CanvasComponentNode) {
  const sizeCss = resolveNodeSizeCss(node)
  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: sizeCss.widthCss,
    height: sizeCss.heightCss,
    zIndex: `${Math.max(1, Number(node.zIndex || 1))}`
  }
}

function parseOptionList(rawOptions: any) {
  if (typeof rawOptions !== 'string') {
    return ['选项1', '选项2']
  }

  const normalizedOptions = rawOptions
    .split(/\n|\||,/g)
    .map((item) => item.trim())
    .filter(Boolean)

  return normalizedOptions.length ? normalizedOptions : ['选项1', '选项2']
}

function parseTabsList(rawTabs: any) {
  const tabList = parseOptionList(rawTabs)
  return tabList.length ? tabList : ['选项卡1', '选项卡2']
}

function resolveTabIndex(node: CanvasComponentNode, tabCount: number) {
  const rawValue = Number(node.props?.tabIndex)
  const normalized = Number.isFinite(rawValue) ? Math.round(rawValue) : 0
  return Math.min(Math.max(normalized, 0), Math.max(0, tabCount - 1))
}

const tabsList = computed(() => {
  if (props.node.type !== 'layoutTabs') {
    return []
  }
  return parseTabsList(props.node.props?.tabs)
})

const activeLayoutTabIndex = computed(() => {
  if (props.node.type !== 'layoutTabs') {
    return 0
  }
  const tabCount = Math.max(1, tabsList.value.length)
  const rawValue = Number(props.node.props?.activeTab || 0)
  const normalized = Number.isFinite(rawValue) ? Math.round(rawValue) : 0
  return Math.min(Math.max(normalized, 0), tabCount - 1)
})

const activeTabsChildren = computed(() => {
  if (props.node.type !== 'layoutTabs') {
    return []
  }

  const tabCount = Math.max(1, tabsList.value.length)
  return childNodes.value.filter((childNode) => {
    return resolveTabIndex(childNode, tabCount) === activeLayoutTabIndex.value
  })
})

function resolveLayoutCardTitle(node: CanvasComponentNode) {
  return String(node.props?.cardTitle || node.title || '').trim()
}

function buildTableColumns(node: CanvasComponentNode): TableColumnMeta[] {
  const columnText = typeof node.props?.columns === 'string' ? node.props.columns : '姓名|角色'
  const columnLabels = columnText
    .split(/\||,|\n/g)
    .map((item: string) => item.trim())
    .filter(Boolean)

  const normalizedLabels = columnLabels.length ? columnLabels : ['列1', '列2']
  return normalizedLabels.map((label, index) => {
    return {
      label,
      prop: `col_${index}`
    }
  })
}

function buildTableRows(node: CanvasComponentNode) {
  const sourceType = String(node.props?.dataSourceType || 'SELF').toUpperCase()

  if (sourceType === 'SELF') {
    const rawValue = node.props?.demoData
    if (typeof rawValue === 'string' && rawValue.trim()) {
      try {
        const parsed = JSON.parse(rawValue)
        if (Array.isArray(parsed) && parsed.length && typeof parsed[0] === 'object') {
          return parsed
        }
      } catch {
        // Ignore invalid JSON and fallback to mock rows.
      }
    }
  }

  const columns = buildTableColumns(node)
  const rowCount = Math.max(1, Math.min(20, Number(node.props?.rows) || 3))

  return Array.from({ length: rowCount }).map((_, rowIndex) => {
    const row: Record<string, string> = {}

    columns.forEach((column, colIndex) => {
      row[column.prop] = `数据${rowIndex + 1}-${colIndex + 1}`
    })

    return row
  })
}

function onPointerDown(event: PointerEvent) {
  emit('select', props.node.id)

  if (!props.draggable || event.button !== 0) {
    return
  }

  emit('pointer-down', event, props.node.id)
}

function onSelectNode() {
  emit('select', props.node.id)
}

function onRemoveNode() {
  emit('remove', props.node.id)
}

function onLayoutDragOver(event: DragEvent) {
  if (!isLayoutNode.value) {
    return
  }
  if (!event.dataTransfer) {
    return
  }

  const hasComponentPayload =
    event.dataTransfer.types.includes(LOW_CODE_COMPONENT_MIME_TYPE) || event.dataTransfer.types.includes('text/plain')

  if (!hasComponentPayload) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'copy'
  layoutDropActive.value = true
}

function onLayoutDragEnter(event: DragEvent) {
  if (!isLayoutNode.value) {
    return
  }
  if (!event.dataTransfer) {
    return
  }
  const hasComponentPayload =
    event.dataTransfer.types.includes(LOW_CODE_COMPONENT_MIME_TYPE) || event.dataTransfer.types.includes('text/plain')
  if (!hasComponentPayload) {
    return
  }
  event.preventDefault()
  layoutDropActive.value = true
}

function onLayoutDragLeave(event: DragEvent) {
  if (!isLayoutNode.value) {
    return
  }
  const target = event.currentTarget as HTMLElement | null
  const nextTarget = event.relatedTarget as Node | null
  if (target && nextTarget && target.contains(nextTarget)) {
    return
  }
  layoutDropActive.value = false
}

function onLayoutDrop(event: DragEvent) {
  if (!isLayoutNode.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  layoutDropActive.value = false
  emit('drop-to-layout', event, props.node.id)
}

function onLayoutFreeChildResizeStart(event: PointerEvent, childNodeId: string, direction: ResizeHandleDirection) {
  emit('select', childNodeId)
  emit('resize-start', event, childNodeId, direction)
}

function onLayoutTabHeaderClick(tabIndex: number) {
  if (props.node.type !== 'layoutTabs') {
    return
  }
  emit('select', props.node.id)
  emit('layout-tab-change', props.node.id, tabIndex)
}

/**
 * 节点右键菜单：固定提供删除操作。
 * 菜单定位在鼠标右下方，避免遮挡鼠标与组件内容。
 */
function openNodeContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  emit('select', props.node.id)

  const menuOffset = 8
  contextMenuX.value = event.clientX + menuOffset
  contextMenuY.value = event.clientY + menuOffset
  contextMenuVisible.value = true
}

function handleContextMenuSelect(item: ContextMenuItem) {
  if (item.key === 'delete-node') {
    onRemoveNode()
  }
}
</script>

<template>
  <div
    class="canvas-node-shell"
    :class="{ selected: isNodeSelected, nested }"
    :style="buildNodeShellStyle(node)"
    @pointerdown.stop="onPointerDown"
    @click.stop="onSelectNode"
    @contextmenu.prevent.stop="openNodeContextMenu"
  >
    <template v-if="isLayoutNode">
      <div
        class="layout-node-shell"
        :class="[resolveLayoutContainerClass(node), { 'drop-active': layoutDropActive }]"
        :style="buildLayoutContainerStyle(node)"
        :data-layout-node-id="node.id"
        :data-layout-scope-id="node.type === 'layoutFree' ? node.id : undefined"
        @dragenter="onLayoutDragEnter"
        @dragleave="onLayoutDragLeave"
        @dragover="onLayoutDragOver"
        @drop="onLayoutDrop"
      >
        <div v-if="node.type === 'layoutCard' && resolveLayoutCardTitle(node)" class="layout-card-header-preview">
          {{ resolveLayoutCardTitle(node) }}
        </div>
        <div v-if="node.type === 'layoutTabs'" class="layout-tabs-header-preview">
          <span
            v-for="(tabLabel, tabIndex) in tabsList"
            :key="`${node.id}-${tabLabel}-${tabIndex}`"
            class="layout-tab-pill"
            :class="{ active: tabIndex === activeLayoutTabIndex }"
            @click.stop="onLayoutTabHeaderClick(tabIndex)"
          >
            {{ tabLabel }}
          </span>
        </div>
        <template v-if="node.type === 'layoutFree'">
          <template v-if="childNodes.length">
            <div
              v-for="childNode in childNodes"
              :key="childNode.id"
              class="layout-free-child-item"
              :class="{ selected: selectedNodeId === childNode.id, locked: childNode.locked }"
              :style="buildLayoutFreeChildStyle(childNode)"
            >
              <CanvasNodeCard
                :node="childNode"
                :selected-node-id="selectedNodeId"
                :draggable="!childNode.locked"
                :nested="true"
                :node-children-map="nodeChildrenMap"
                @select="emit('select', $event)"
                @remove="emit('remove', $event)"
                @pointer-down="(event, nodeId) => emit('pointer-down', event, nodeId)"
                @resize-start="(event, nodeId, direction) => emit('resize-start', event, nodeId, direction)"
                @drop-to-layout="(event, layoutNodeId) => emit('drop-to-layout', event, layoutNodeId)"
                @layout-tab-change="(layoutNodeId, activeTab) => emit('layout-tab-change', layoutNodeId, activeTab)"
              />

              <template v-if="!childNode.locked && selectedNodeId === childNode.id">
                <button
                  class="layout-free-resize-handle top-left"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'nw')"
                ></button>
                <button
                  class="layout-free-resize-handle top-center"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'n')"
                ></button>
                <button
                  class="layout-free-resize-handle top-right"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'ne')"
                ></button>
                <button
                  class="layout-free-resize-handle middle-left"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'w')"
                ></button>
                <button
                  class="layout-free-resize-handle middle-right"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'e')"
                ></button>
                <button
                  class="layout-free-resize-handle bottom-left"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'sw')"
                ></button>
                <button
                  class="layout-free-resize-handle bottom-center"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 's')"
                ></button>
                <button
                  class="layout-free-resize-handle bottom-right"
                  type="button"
                  @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'se')"
                ></button>
              </template>

              <div v-if="childNode.locked" class="layout-free-lock-mask">已锁定</div>
            </div>
          </template>
        </template>

        <template v-else-if="node.type === 'layoutTabs'">
          <div
            class="layout-tabs-content-preview"
            :data-layout-scope-id="node.id"
            @dragenter="onLayoutDragEnter"
            @dragleave="onLayoutDragLeave"
            @dragover="onLayoutDragOver"
            @drop="onLayoutDrop"
          >
            <template v-if="activeTabsChildren.length">
              <div
                v-for="childNode in activeTabsChildren"
                :key="childNode.id"
                class="layout-free-child-item"
                :class="{ selected: selectedNodeId === childNode.id, locked: childNode.locked }"
                :style="buildLayoutFreeChildStyle(childNode)"
              >
                <CanvasNodeCard
                  :node="childNode"
                  :selected-node-id="selectedNodeId"
                  :draggable="!childNode.locked"
                  :nested="true"
                  :node-children-map="nodeChildrenMap"
                  @select="emit('select', $event)"
                  @remove="emit('remove', $event)"
                  @pointer-down="(event, nodeId) => emit('pointer-down', event, nodeId)"
                  @resize-start="(event, nodeId, direction) => emit('resize-start', event, nodeId, direction)"
                  @drop-to-layout="(event, layoutNodeId) => emit('drop-to-layout', event, layoutNodeId)"
                  @layout-tab-change="(layoutNodeId, activeTab) => emit('layout-tab-change', layoutNodeId, activeTab)"
                />

                <template v-if="!childNode.locked && selectedNodeId === childNode.id">
                  <button
                    class="layout-free-resize-handle top-left"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'nw')"
                  ></button>
                  <button
                    class="layout-free-resize-handle top-center"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'n')"
                  ></button>
                  <button
                    class="layout-free-resize-handle top-right"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'ne')"
                  ></button>
                  <button
                    class="layout-free-resize-handle middle-left"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'w')"
                  ></button>
                  <button
                    class="layout-free-resize-handle middle-right"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'e')"
                  ></button>
                  <button
                    class="layout-free-resize-handle bottom-left"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'sw')"
                  ></button>
                  <button
                    class="layout-free-resize-handle bottom-center"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 's')"
                  ></button>
                  <button
                    class="layout-free-resize-handle bottom-right"
                    type="button"
                    @pointerdown.stop.prevent="onLayoutFreeChildResizeStart($event, childNode.id, 'se')"
                  ></button>
                </template>

                <div v-if="childNode.locked" class="layout-free-lock-mask">已锁定</div>
              </div>
            </template>
          </div>
        </template>

        <template v-else-if="childNodes.length">
          <div
            v-for="childNode in childNodes"
            :key="childNode.id"
            class="layout-child-item"
            :style="buildLayoutChildStyle(node, childNode)"
          >
            <CanvasNodeCard
              :node="childNode"
              :selected-node-id="selectedNodeId"
              :draggable="false"
              :nested="true"
              :node-children-map="nodeChildrenMap"
              @select="emit('select', $event)"
              @remove="emit('remove', $event)"
              @pointer-down="(event, nodeId) => emit('pointer-down', event, nodeId)"
              @resize-start="(event, nodeId, direction) => emit('resize-start', event, nodeId, direction)"
              @drop-to-layout="(event, layoutNodeId) => emit('drop-to-layout', event, layoutNodeId)"
              @layout-tab-change="(layoutNodeId, activeTab) => emit('layout-tab-change', layoutNodeId, activeTab)"
            />
          </div>
        </template>
      </div>
    </template>

    <template v-else-if="node.type === 'text'">
      <span class="mock-text">{{ node.props.text || node.title }}</span>
    </template>

    <template v-else-if="node.type === 'button'">
      <el-button :type="node.props.buttonType || 'primary'" size="small">
        {{ node.props.text || '按钮' }}
      </el-button>
    </template>

    <template v-else-if="node.type === 'input'">
      <el-input
        :model-value="String(node.props.value || '')"
        :placeholder="node.props.placeholder || '请输入内容'"
        size="small"
        disabled
      />
    </template>

    <template v-else-if="node.type === 'select'">
      <el-select :model-value="''" :placeholder="node.props.placeholder || '请选择'" size="small" disabled>
        <el-option
          v-for="optionLabel in parseOptionList(node.props.options)"
          :key="optionLabel"
          :label="optionLabel"
          :value="optionLabel"
        />
      </el-select>
    </template>

    <template v-else-if="node.type === 'switch'">
      <el-switch
        :model-value="Boolean(node.props.checked)"
        :active-text="node.props.activeText || '开启'"
        :inactive-text="node.props.inactiveText || '关闭'"
        disabled
      />
    </template>

    <template v-else-if="node.type === 'datePicker'">
      <el-date-picker
        model-value=""
        :type="node.props.pickerType || 'date'"
        :placeholder="node.props.placeholder || '请选择日期'"
        disabled
      />
    </template>

    <template v-else-if="node.type === 'barChart'">
      <EChartsNodeRenderer
        chart-type="barChart"
        :title-text="String(node.props.titleText || '柱状图')"
        :demo-data="String(node.props.demoData || '')"
      />
    </template>

    <template v-else-if="node.type === 'lineChart'">
      <EChartsNodeRenderer
        chart-type="lineChart"
        :title-text="String(node.props.titleText || '折线图')"
        :demo-data="String(node.props.demoData || '')"
      />
    </template>

    <template v-else-if="node.type === 'pieChart'">
      <EChartsNodeRenderer
        chart-type="pieChart"
        :title-text="String(node.props.titleText || '饼图')"
        :demo-data="String(node.props.demoData || '')"
      />
    </template>

    <template v-else-if="node.type === 'gaugeChart'">
      <EChartsNodeRenderer
        chart-type="gaugeChart"
        :title-text="String(node.props.titleText || '仪表盘')"
        :demo-data="String(node.props.demoData || '')"
        :max-value="Number(node.props.maxValue || 100)"
      />
    </template>

    <template v-else-if="node.type === 'customChart'">
      <EChartsNodeRenderer
        chart-type="customChart"
        :chart-option="String(node.props.chartOption || '')"
      />
    </template>

    <template v-else-if="node.type === 'table'">
      <el-table :data="buildTableRows(node)" border size="small" height="100%">
        <el-table-column
          v-for="column in buildTableColumns(node)"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          min-width="80"
        />
      </el-table>
    </template>

    <template v-else-if="node.type === 'image'">
      <el-image v-if="node.props.src" :src="node.props.src" :fit="node.props.fit || 'cover'" class="mock-image" />
      <div v-else class="mock-image-placeholder">图片占位（可在右侧配置图片地址）</div>
    </template>

    <template v-else-if="node.type === 'card'">
      <el-card class="mock-card" shadow="never">
        <template #header>
          {{ node.props.title || node.title }}
        </template>
        <span>{{ node.props.content || '卡片正文内容' }}</span>
      </el-card>
    </template>

    <template v-else-if="node.type === 'divider'">
      <el-divider v-if="node.props.direction === 'vertical'" direction="vertical" class="divider-preview vertical" />
      <el-divider v-else class="divider-preview" />
    </template>

    <template v-else-if="node.type === 'spacer'">
      <div class="spacer-preview">留白</div>
    </template>

    <template v-else-if="node.type === 'borderBox'">
      <div class="border-box-preview">
        <span class="border-title">{{ node.props.borderTitle || '边框容器' }}</span>
      </div>
    </template>

    <template v-else-if="node.type === 'decorationLine'">
      <div class="decoration-line-preview">
        <span>{{ node.props.text || '装饰分割线' }}</span>
      </div>
    </template>

    <template v-else>
      <span class="mock-text">{{ componentLibraryMap[node.type]?.name || node.type }}</span>
    </template>
  </div>

  <ContextMenu
    v-model:visible="contextMenuVisible"
    :x="contextMenuX"
    :y="contextMenuY"
    :items="contextMenuItems"
    @select="handleContextMenuSelect"
  />
</template>

<style scoped>
.canvas-node-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
}

.canvas-node-shell.nested {
  min-height: 0;
}

.canvas-node-shell.selected {
  outline: 1px solid var(--el-color-primary, #409eff);
  outline-offset: -1px;
  box-shadow: inset 0 0 0 2px rgb(64 158 255 / 18%);
}

.layout-node-shell {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: 1px solid var(--el-border-color-light, #dcdfe6);
  background: transparent;
  display: flex;
  align-content: flex-start;
  overflow: auto;
}

.layout-free-shell {
  position: relative;
  display: block;
  overflow: hidden;
  border-style: dashed;
  background: transparent;
}

.layout-node-shell.drop-active {
  border-color: var(--el-color-primary, #409eff);
  background: transparent;
}

.layout-node-shell.drop-active::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed var(--el-color-primary, #409eff);
  pointer-events: none;
  z-index: 14;
}

.layout-row-shell {
  display: flex;
  flex-direction: row;
}

.layout-column-shell {
  display: flex;
  flex-direction: column;
}

.layout-grid-shell {
  display: grid;
  grid-template-columns: repeat(var(--lc-grid-columns-desktop, 4), minmax(0, 1fr));
  grid-template-rows: repeat(var(--lc-grid-rows, 3), minmax(0, 1fr));
  align-content: stretch;
}

.layout-card-header-preview {
  width: 100%;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  background: var(--el-fill-color-light, #f5f7fa);
}

.layout-tabs-header-preview {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
  background: var(--el-fill-color-light, #f5f7fa);
}

.layout-tab-pill {
  padding: 8px 12px;
  border-radius: 0;
  font-size: 12px;
  color: var(--el-text-color-regular, #606266);
  background: var(--el-fill-color, #f0f2f5);
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  border-bottom-color: transparent;
  cursor: pointer;
  user-select: none;
}

.layout-tab-pill.active {
  color: var(--el-color-primary, #409eff);
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-bottom-color: transparent;
}

.layout-tabs-shell {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layout-tabs-content-preview {
  position: relative;
  flex: 1;
  min-height: 132px;
  overflow: hidden;
  background: transparent;
}

.layout-header-shell {
  display: flex;
  flex-direction: row;
}

.layout-sidebar-shell {
  display: flex;
  flex-direction: column;
}

.layout-footer-shell {
  display: flex;
  flex-direction: row;
}

.layout-child-item {
  min-height: 0;
  min-width: 0;
}

.layout-free-child-item {
  position: absolute;
}

.layout-free-child-item.selected {
  outline: 1px solid var(--el-color-primary, #409eff);
  outline-offset: -1px;
}

.layout-free-child-item.locked {
  cursor: not-allowed;
}

.layout-free-resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1px solid var(--el-color-primary, #409eff);
  background: #fff;
  border-radius: 1px;
  padding: 0;
  margin: 0;
  z-index: 20;
}

.layout-free-resize-handle.top-left {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}

.layout-free-resize-handle.top-center {
  left: calc(50% - 5px);
  top: 0;
  cursor: ns-resize;
}

.layout-free-resize-handle.top-right {
  right: 0;
  top: 0;
  cursor: nesw-resize;
}

.layout-free-resize-handle.middle-left {
  left: 0;
  top: calc(50% - 5px);
  cursor: ew-resize;
}

.layout-free-resize-handle.middle-right {
  right: 0;
  top: calc(50% - 5px);
  cursor: ew-resize;
}

.layout-free-resize-handle.bottom-left {
  left: 0;
  bottom: 0;
  cursor: nesw-resize;
}

.layout-free-resize-handle.bottom-center {
  left: calc(50% - 5px);
  bottom: 0;
  cursor: ns-resize;
}

.layout-free-resize-handle.bottom-right {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
}

.layout-free-lock-mask {
  position: absolute;
  right: 6px;
  top: 6px;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  font-size: 11px;
  color: #92400e;
  background: rgb(251 191 36 / 22%);
  border: 1px solid rgb(251 191 36 / 42%);
  pointer-events: none;
  z-index: 12;
}

.mock-text {
  color: var(--lc-color-text-1);
  line-height: var(--lc-line-height-normal);
}

.mock-image {
  width: 100%;
  height: 100%;
  border-radius: var(--lc-radius-sm);
}

.mock-image-placeholder {
  width: 100%;
  height: 100%;
  border-radius: var(--lc-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--lc-spacing-2);
  font-size: var(--lc-font-size-sm);
  color: var(--lc-color-text-3);
  border: 1px dashed #93c5fd;
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
}

.mock-card {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.border-box-preview {
  width: 100%;
  height: 100%;
  border-radius: var(--lc-radius-sm);
  border: 2px solid #38bdf8;
  box-shadow: inset 0 0 0 1px rgb(56 189 248 / 35%);
  background: linear-gradient(135deg, rgb(15 23 42 / 95%) 0%, rgb(30 41 59 / 90%) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.border-title {
  color: #bae6fd;
  font-size: 13px;
  font-weight: var(--lc-font-weight-semibold);
}

.decoration-line-preview {
  width: 100%;
  height: 100%;
  border-radius: var(--lc-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6d28d9;
  font-weight: var(--lc-font-weight-semibold);
  background: repeating-linear-gradient(
    90deg,
    rgb(124 58 237 / 20%) 0,
    rgb(124 58 237 / 20%) 10px,
    rgb(124 58 237 / 6%) 10px,
    rgb(124 58 237 / 6%) 20px
  );
}

.divider-preview {
  width: 100%;
  margin: 0;
  border-color: var(--el-border-color, #dcdfe6);
}

.divider-preview.vertical {
  min-height: 100%;
  margin: 0 auto;
}

.spacer-preview {
  width: 100%;
  height: 100%;
  border: 1px dashed var(--el-border-color, #dcdfe6);
  background: var(--el-fill-color-lighter, #f5f7fa);
  color: var(--el-text-color-placeholder, #a8abb2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

@media (max-width: 1280px) {
  .layout-grid-shell {
    grid-template-columns: repeat(var(--lc-grid-columns-tablet, 2), minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .layout-grid-shell {
    grid-template-columns: repeat(var(--lc-grid-columns-mobile, 1), minmax(0, 1fr));
  }
}
</style>
