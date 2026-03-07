<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MonacoCodeEditor from '@/components/MonacoCodeEditor.vue'
import CanvasNodeCard from '@/views/PageLayoutView/AppPreviewer/CanvasNodeCard.vue'
import { generateVueSourceFromDsl } from '@/views/PageLayoutView/AppPreviewer/vue-source-generator'
import type { ProjectNode } from '@/views/PageLayoutView/AppLeftPanel/project-tree.types'
import {
  LOW_CODE_COMPONENT_MIME_TYPE,
  buildCanvasNodeFromType,
  componentLibraryMap,
  type CanvasComponentNode
} from '@/views/PageLayoutView/component-library'
import {
  addDesignerNode,
  commitDesignerRevision,
  designerState,
  exportDesignerSchemaPayload,
  findFirstAvailableGridCell,
  loadDesignerSchemaPayload,
  removeDesignerNode,
  resetDesignerState,
  selectDesignerNode,
  setDesignerCanvasSize,
  updateDesignerNode
} from '@/views/PageLayoutView/dsl-designer.store'
import type { ProjectPreviewState } from '@/views/PageLayoutView/project-preview.types'

type CenterTab = 'canvas' | 'source' | 'dsl'
type PreviewControlAction = 'start' | 'stop'

interface DragContext {
  nodeId: string
  pointerId: number
  offsetX: number
  offsetY: number
  scopeLeft: number
  scopeTop: number
  scopeWidth: number
  scopeHeight: number
  snapEnabled: boolean
  scopeNodeId: string
  scopeCanvasX: number
  scopeCanvasY: number
}

type ResizeHandleDirection = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

interface ResizeContext {
  nodeId: string
  pointerId: number
  direction: ResizeHandleDirection
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  scopeWidth: number
  scopeHeight: number
}

interface DragScope {
  left: number
  top: number
  width: number
  height: number
  snapEnabled: boolean
  scopeNodeId: string
  scopeCanvasX: number
  scopeCanvasY: number
}

interface RulerMark {
  value: number
  major: boolean
}

type NodeSizeMode = 'fixed' | 'responsive'

const props = defineProps<{
  selectedFileNode: ProjectNode | null
  projectPreview: ProjectPreviewState
}>()

const SNAP_THRESHOLD = 6
const LOW_CODE_DSL_SIDECAR_SUFFIX = '.lowcode.dsl.json'
const ROOT_DRAG_SCOPE_ID = '__canvas__'

const activeCenterTab = ref<CenterTab>('canvas')
const sourceCode = ref('')
const sourceLanguage = ref('plaintext')
const sourceLoading = ref(false)
const sourceError = ref('')
const sourceInfo = ref('')
const sourceDirty = ref(false)
const draftSaveFileHandle = ref<FileSystemFileHandle | null>(null)
const draftSaveDirectoryHandle = ref<FileSystemDirectoryHandle | null>(null)
const draftSaveFileName = ref('LowCodePage.vue')

const canvasContentRef = ref<HTMLElement | null>(null)
const editorRef = ref<InstanceType<typeof MonacoCodeEditor> | null>(null)
const dslEditorRef = ref<InstanceType<typeof MonacoCodeEditor> | null>(null)

const canvasWidth = ref(0)
const canvasHeight = ref(0)

const dragContext = ref<DragContext | null>(null)
const resizeContext = ref<ResizeContext | null>(null)
const snapGuideX = ref<number | null>(null)
const snapGuideY = ref<number | null>(null)

const runtimePreviewVisible = ref(false)
const runtimeFrameKey = ref(0)

const hasSelectedFile = computed(() => props.selectedFileNode?.type === 'file')
const selectedFilePath = computed(() => props.selectedFileNode?.relativePath || '')
const selectedFileIsLowCodeGenerated = computed(() => {
  return Boolean(props.selectedFileNode?.type === 'file' && props.selectedFileNode.isLowCodeGenerated)
})
const canEditCanvas = computed(() => {
  if (!hasSelectedFile.value) {
    return true
  }
  return selectedFileIsLowCodeGenerated.value
})
const sourceWritable = computed(() => {
  return Boolean(props.selectedFileNode?.type === 'file' && props.selectedFileNode.fileHandle && !props.selectedFileNode.isUnsaved)
})
const hasDraftSaveTarget = computed(() => Boolean(draftSaveFileHandle.value))
const shouldPersistDslSidecar = computed(() => {
  if (!hasSelectedFile.value) {
    return true
  }
  return selectedFileIsLowCodeGenerated.value
})
const sourcePathDisplay = computed(() => {
  if (selectedFilePath.value) {
    return selectedFilePath.value
  }
  if (hasDraftSaveTarget.value) {
    return `草稿保存目标：${draftSaveFileName.value}`
  }
  return '未选择文件。你可以先编辑画布，保存时再选择目录。'
})
const dslPreviewCode = computed(() => {
  return JSON.stringify(exportDesignerSchemaPayload(), null, 2)
})

const visibleNodes = computed(() => {
  return designerState.nodes.filter((node) => node.visible !== false)
})

const rootVisibleNodes = computed(() => {
  return visibleNodes.value.filter((node) => !node.parentId)
})

const nodeChildrenMap = computed<Record<string, CanvasComponentNode[]>>(() => {
  const map: Record<string, CanvasComponentNode[]> = {}
  visibleNodes.value.forEach((node) => {
    if (!node.parentId) {
      return
    }
    if (!map[node.parentId]) {
      map[node.parentId] = []
    }
    map[node.parentId].push(node)
  })
  Object.keys(map).forEach((parentId) => {
    map[parentId].sort((left, right) => {
      if (left.zIndex === right.zIndex) {
        return left.id.localeCompare(right.id)
      }
      return left.zIndex - right.zIndex
    })
  })
  return map
})

const gridCellNodes = computed<Array<CanvasComponentNode | null>>(() => {
  const cells = Array.from({ length: 9 }).map(() => null) as Array<CanvasComponentNode | null>

  rootVisibleNodes.value.forEach((node) => {
    if (typeof node.gridCell !== 'number') {
      return
    }
    if (node.gridCell < 0 || node.gridCell > 8) {
      return
    }
    if (!cells[node.gridCell]) {
      cells[node.gridCell] = node
    }
  })

  return cells
})

const gridOverflowCount = computed(() => {
  if (designerState.layoutMode !== 'grid9') {
    return 0
  }

  return rootVisibleNodes.value.filter((node) => {
    return typeof node.gridCell !== 'number' || node.gridCell < 0 || node.gridCell > 8
  }).length
})

const showRuler = computed(() => {
  return activeCenterTab.value === 'canvas' && designerState.layoutMode === 'free'
})

const horizontalRulerMarks = computed(() => buildRulerMarks(canvasWidth.value))
const verticalRulerMarks = computed(() => buildRulerMarks(canvasHeight.value))
const gridContainerStyle = computed<Record<string, string>>(() => {
  const rows = Number.isFinite(designerState.gridRows) ? Math.min(Math.max(Math.round(designerState.gridRows), 1), 20) : 3
  return {
    '--lc-grid9-rows': String(rows)
  }
})

let resizeObserver: ResizeObserver | null = null
let activeFileKey = ''
let applyingSourceToDesigner = false
let applyingDesignerToSource = false

function buildRulerMarks(length: number): RulerMark[] {
  const marks: RulerMark[] = []
  const normalizedLength = Math.max(0, Math.round(length))

  for (let value = 0; value <= normalizedLength; value += 10) {
    marks.push({
      value,
      major: value % 50 === 0
    })
  }

  return marks
}

function clamp(value: number, minValue: number, maxValue: number) {
  if (maxValue < minValue) {
    return minValue
  }
  return Math.min(Math.max(value, minValue), maxValue)
}

function detectSourceLanguage(fileName: string) {
  const normalized = fileName.toLowerCase()
  if (normalized.endsWith('.vue')) {
    return 'html'
  }
  if (normalized.endsWith('.ts') || normalized.endsWith('.tsx')) {
    return 'typescript'
  }
  if (normalized.endsWith('.js') || normalized.endsWith('.jsx') || normalized.endsWith('.mjs') || normalized.endsWith('.cjs')) {
    return 'javascript'
  }
  if (normalized.endsWith('.json')) {
    return 'json'
  }
  if (normalized.endsWith('.css') || normalized.endsWith('.less') || normalized.endsWith('.scss')) {
    return 'css'
  }
  if (normalized.endsWith('.md')) {
    return 'markdown'
  }
  return 'plaintext'
}

function buildDefaultSourceTemplate(fileName: string) {
  const normalized = fileName.toLowerCase()
  if (normalized.endsWith('.vue')) {
    return `<template>
  <div class="page-root"></div>
</template>

<${'script'} setup lang="ts">
</${'script'}>

<style scoped>
.page-root {
  width: 100%;
  min-height: 100%;
}
</style>
`
  }

  if (normalized.endsWith('.json')) {
    return `{
}
`
  }

  return ''
}

const LEGACY_LOW_CODE_DSL_BLOCK_RE = /<lowcode-dsl[\s\S]*?<\/lowcode-dsl>/gi
const LEGACY_LOW_CODE_SCRIPT_MARKER_LINE_RE = /^\s*(?:<!--\s*)?@low-code-generated(?:\s*-->)?\s*$/gim

function stripLegacyLowCodeMarkers(rawSource: string) {
  const hasDslBlock = /<lowcode-dsl[\s\S]*?<\/lowcode-dsl>/i.test(rawSource)
  const hasScriptMarker = /@low-code-generated/i.test(rawSource)
  let cleaned = rawSource.replace(LEGACY_LOW_CODE_DSL_BLOCK_RE, '')
  cleaned = cleaned.replace(LEGACY_LOW_CODE_SCRIPT_MARKER_LINE_RE, '')
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trimEnd()

  if (cleaned && rawSource.endsWith('\n')) {
    cleaned += '\n'
  }

  return {
    cleanedSource: cleaned,
    removedLegacyMarkers: hasDslBlock || hasScriptMarker
  }
}

async function readFileTextByNode(fileNode: ProjectNode) {
  if (fileNode.fileHandle) {
    const file = await fileNode.fileHandle.getFile()
    return await file.text()
  }

  if (fileNode.isUnsaved) {
    return buildDefaultSourceTemplate(fileNode.name)
  }

  return ''
}

function dispatchPreviewControl(action: PreviewControlAction) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('low-code:preview-control', {
      detail: {
        action
      }
    })
  )
}

function getSelectedWritableFileHandle() {
  const fileNode = props.selectedFileNode
  if (!fileNode || fileNode.type !== 'file' || !fileNode.fileHandle || fileNode.isUnsaved) {
    return null
  }

  const fileKey = `${fileNode.relativePath}::${fileNode.name}`
  if (fileKey !== activeFileKey) {
    return null
  }

  return fileNode.fileHandle
}

function normalizeVueFileName(rawValue: string) {
  const normalized = String(rawValue || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
  if (!normalized) {
    return ''
  }
  return normalized.toLowerCase().endsWith('.vue') ? normalized : `${normalized}.vue`
}

function toLowCodeDslSidecarName(fileName: string) {
  if (/\.vue$/i.test(fileName)) {
    return fileName.replace(/\.vue$/i, LOW_CODE_DSL_SIDECAR_SUFFIX)
  }
  return `${fileName}${LOW_CODE_DSL_SIDECAR_SUFFIX}`
}

function normalizeLowCodeDslPayload(rawPayload: any) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return null
  }

  const candidate = rawPayload.payload && typeof rawPayload.payload === 'object' ? rawPayload.payload : rawPayload
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  return {
    layoutMode: candidate.layoutMode,
    canvasBackground: candidate.canvasBackground,
    gridRows: candidate.gridRows,
    nodes: Array.isArray(candidate.nodes) ? candidate.nodes : []
  }
}

async function readLowCodeDslPayload(fileNode: ProjectNode) {
  if (fileNode.type !== 'file') {
    return null
  }

  const parentDirectoryHandle = fileNode.parentDirectoryHandle
  if (!parentDirectoryHandle) {
    return null
  }

  try {
    const sidecarHandle = await parentDirectoryHandle.getFileHandle(toLowCodeDslSidecarName(fileNode.name))
    const sidecarFile = await sidecarHandle.getFile()
    const rawText = await sidecarFile.text()
    const parsed = JSON.parse(rawText)
    return normalizeLowCodeDslPayload(parsed)
  } catch {
    return null
  }
}

function isUserCancelError(error: any) {
  return Boolean(
    error === 'cancel' ||
      error === 'close' ||
      error?.action === 'cancel' ||
      error?.action === 'close' ||
      error?.name === 'AbortError'
  )
}

interface RequestedFileTarget {
  fileHandle: FileSystemFileHandle
  directoryHandle: FileSystemDirectoryHandle
  fileName: string
}

async function requestNewFileHandleByPrompt(defaultFileName: string): Promise<RequestedFileTarget> {
  const suggestedName = normalizeVueFileName(defaultFileName) || 'LowCodePage.vue'
  const { value } = await ElMessageBox.prompt('请输入新的 Vue 文件名', '保存源码', {
    inputValue: suggestedName,
    inputPlaceholder: '示例：DashboardPage.vue',
    confirmButtonText: '下一步：选择文件夹',
    cancelButtonText: '取消'
  })

  const fileName = normalizeVueFileName(value)
  if (!fileName) {
    throw new Error('文件名不能为空。')
  }

  const runtimeWindow = window as any
  if (typeof runtimeWindow.showDirectoryPicker !== 'function') {
    throw new Error('当前浏览器不支持目录选择，请在 Chromium 内核浏览器中操作。')
  }

  const directoryHandle = await runtimeWindow.showDirectoryPicker()
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true })
  draftSaveFileHandle.value = fileHandle
  draftSaveDirectoryHandle.value = directoryHandle
  draftSaveFileName.value = fileName

  return {
    fileHandle,
    directoryHandle,
    fileName
  }
}

async function persistLowCodeDslSidecar(directoryHandle: FileSystemDirectoryHandle | null, fileName: string) {
  if (!directoryHandle) {
    throw new Error('未选择可写目录，无法保存 DSL Sidecar 文件。')
  }

  const sidecarHandle = await directoryHandle.getFileHandle(toLowCodeDslSidecarName(fileName), { create: true })
  const writable = await sidecarHandle.createWritable()
  await writable.write(
    JSON.stringify(
      {
        schemaVersion: '1.0.0',
        savedAt: new Date().toISOString(),
        sourceFileName: fileName,
        payload: exportDesignerSchemaPayload()
      },
      null,
      2
    )
  )
  await writable.close()
}

async function persistSourceToFile(fileHandle: FileSystemFileHandle) {
  try {
    const sanitizeResult = stripLegacyLowCodeMarkers(sourceCode.value)
    const sourceToWrite = sanitizeResult.cleanedSource
    if (sourceToWrite !== sourceCode.value) {
      sourceCode.value = sourceToWrite
    }

    const writable = await fileHandle.createWritable()
    await writable.write(sourceToWrite)
    await writable.close()
    sourceDirty.value = false
    sourceError.value = ''
    sourceInfo.value = `源码已保存（${new Date().toLocaleTimeString()}）`
  } catch (error: any) {
    sourceError.value = error?.message || '保存源码失败，请检查文件权限后重试。'
    throw error
  }
}

function syncCanvasSize() {
  const contentElement = canvasContentRef.value
  if (!contentElement) {
    return
  }

  const width = Math.max(0, Math.round(contentElement.clientWidth))
  const height = Math.max(0, Math.round(contentElement.clientHeight))

  canvasWidth.value = width
  canvasHeight.value = height
  setDesignerCanvasSize(width, height, { skipRevision: true })
}

function setupCanvasResizeObserver() {
  if (typeof ResizeObserver === 'undefined') {
    return
  }
  if (!canvasContentRef.value) {
    return
  }

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    syncCanvasSize()
  })
  resizeObserver.observe(canvasContentRef.value)
}

function teardownCanvasResizeObserver() {
  resizeObserver?.disconnect()
  resizeObserver = null
}

async function loadSelectedFile(fileNode: ProjectNode | null) {
  sourceError.value = ''
  sourceInfo.value = ''
  sourceDirty.value = false

  if (!fileNode || fileNode.type !== 'file') {
    activeFileKey = ''
    sourceLoading.value = false
    sourceLanguage.value = 'html'
    applyingSourceToDesigner = true
    resetDesignerState({ skipRevision: true })
    applyingSourceToDesigner = false
    sourceCode.value = generateVueSourceFromDsl({
      layoutMode: designerState.layoutMode,
      gridRows: designerState.gridRows,
      canvasBackground: designerState.canvasBackground,
      nodes: designerState.nodes
    })
    return
  }

  activeFileKey = `${fileNode.relativePath}::${fileNode.name}`
  sourceLoading.value = true
  sourceLanguage.value = detectSourceLanguage(fileNode.name)
  let removedLegacyMarkers = false

  try {
    const rawText = await readFileTextByNode(fileNode)
    const sanitizeResult = stripLegacyLowCodeMarkers(rawText)
    sourceCode.value = sanitizeResult.cleanedSource
    removedLegacyMarkers = sanitizeResult.removedLegacyMarkers

    applyingSourceToDesigner = true
    try {
      if (fileNode.isLowCodeGenerated) {
        const dslPayload = await readLowCodeDslPayload(fileNode)
        if (dslPayload) {
          loadDesignerSchemaPayload(dslPayload, { skipRevision: true })
          sourceInfo.value = '已从 Sidecar DSL 恢复画布结构。'
        } else {
          resetDesignerState({ skipRevision: true })
          sourceInfo.value = '未找到 Sidecar DSL，已重置画布结构。'
        }
      } else {
        resetDesignerState({ skipRevision: true })
        sourceInfo.value = '当前文件不是低代码生成文件，已切换到源码模式。'
        if (activeCenterTab.value === 'canvas') {
          activeCenterTab.value = 'source'
        }
      }
    } finally {
      applyingSourceToDesigner = false
    }

    if (removedLegacyMarkers) {
      sourceDirty.value = true
      sourceInfo.value = sourceInfo.value
        ? `${sourceInfo.value} 检测到旧版 <lowcode-dsl> 标记，已从源码视图移除，请保存写回文件。`
        : '检测到旧版 <lowcode-dsl> 标记，已从源码视图移除，请保存写回文件。'
    }
  } catch (error: any) {
    sourceError.value = error?.message || '读取文件失败，请确认文件内容后重试。'
    sourceCode.value = ''
    applyingSourceToDesigner = true
    resetDesignerState({ skipRevision: true })
    applyingSourceToDesigner = false
  } finally {
    sourceLoading.value = false
    nextTick(() => {
      editorRef.value?.layout()
      syncCanvasSize()
    })
  }
}
function onSaveSourceManually() {
  const saveAction = async () => {
    let targetFileHandle = getSelectedWritableFileHandle()
    let targetDirectoryHandle: FileSystemDirectoryHandle | null = null
    let targetFileName = normalizeVueFileName(props.selectedFileNode?.name || draftSaveFileName.value) || 'LowCodePage.vue'

    if (targetFileHandle && props.selectedFileNode?.type === 'file') {
      targetDirectoryHandle = props.selectedFileNode.parentDirectoryHandle || null
      targetFileName = props.selectedFileNode.name
    }

    if (!targetFileHandle) {
      const shouldCreateNewFile = hasSelectedFile.value || !draftSaveFileHandle.value
      if (shouldCreateNewFile) {
        const defaultFileName = normalizeVueFileName(props.selectedFileNode?.name || draftSaveFileName.value) || 'LowCodePage.vue'
        const target = await requestNewFileHandleByPrompt(defaultFileName)
        targetFileHandle = target.fileHandle
        targetDirectoryHandle = target.directoryHandle
        targetFileName = target.fileName
      } else {
        targetFileHandle = draftSaveFileHandle.value
        targetDirectoryHandle = draftSaveDirectoryHandle.value
        targetFileName = draftSaveFileName.value
      }
    }

    if (!targetFileHandle) {
      throw new Error('未找到可写入的目标文件，请先选择保存位置。')
    }

    await persistSourceToFile(targetFileHandle)

    let sidecarErrorMessage = ''
    if (shouldPersistDslSidecar.value) {
      try {
        await persistLowCodeDslSidecar(targetDirectoryHandle, targetFileName)
      } catch (error: any) {
        sidecarErrorMessage = error?.message || '保存 DSL Sidecar 失败。'
      }
    }

    if (sidecarErrorMessage) {
      sourceInfo.value = `源码已保存，但 DSL Sidecar 保存失败：${sidecarErrorMessage}`
      ElMessage.warning(sourceInfo.value)
      return
    }

    ElMessage.success('源码保存成功。')
  }

  void saveAction().catch((error: any) => {
    if (isUserCancelError(error)) {
      return
    }
    sourceError.value = error?.message || '保存源码失败，请检查后重试。'
    ElMessage.error(sourceError.value)
  })
}
function onSourceCodeChange(nextValue: string) {
  sourceCode.value = nextValue
  if (applyingDesignerToSource) {
    return
  }

  sourceDirty.value = true
  sourceError.value = ''
  sourceInfo.value = '源码已修改，尚未保存。'
}

function ensureCanvasEditable(showTip = true) {
  if (canEditCanvas.value) {
    return true
  }
  if (showTip) {
    ElMessage.warning('当前文件不可视化编辑，请切换到低代码生成文件或先新建画布。')
  }
  return false
}

function onCanvasDragOver(event: DragEvent) {
  if (!canEditCanvas.value) {
    return
  }

  if (!event.dataTransfer) {
    return
  }

  if (!event.dataTransfer.types.includes(LOW_CODE_COMPONENT_MIME_TYPE)) {
    return
  }

  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function resolveDraggedComponentType(event: DragEvent) {
  if (!event.dataTransfer) {
    return ''
  }

  const rawPayload = event.dataTransfer.getData(LOW_CODE_COMPONENT_MIME_TYPE)
  if (rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload)
      return String(parsed?.type || '').trim()
    } catch {
      // ignore
    }
  }

  return String(event.dataTransfer.getData('text/plain') || '').trim()
}

function resolveLayoutDropScopeElement(event: DragEvent, layoutNodeId: string) {
  const target = event.target as HTMLElement | null
  if (!target) {
    return null
  }

  const scopedElement = target.closest(`[data-layout-scope-id="${layoutNodeId}"]`) as HTMLElement | null
  if (scopedElement) {
    return scopedElement
  }

  return target.closest(`[data-layout-node-id="${layoutNodeId}"]`) as HTMLElement | null
}

function resolveNextLayoutChildZIndex(layoutNodeId: string) {
  const maxZIndex = designerState.nodes
    .filter((node) => node.parentId === layoutNodeId)
    .reduce((maxValue, node) => Math.max(maxValue, Number(node.zIndex || 0)), 0)
  return maxZIndex + 1
}

function resolveLayoutTabsCount(layoutNode: CanvasComponentNode) {
  const tabsText = typeof layoutNode.props?.tabs === 'string' ? layoutNode.props.tabs : ''
  const tabs = tabsText
    .split(/\n|\||,/g)
    .map((item: string) => item.trim())
    .filter(Boolean)
  return Math.max(1, tabs.length)
}

function onDropToLayout(event: DragEvent, layoutNodeId: string) {
  if (!ensureCanvasEditable()) {
    return
  }

  const componentType = resolveDraggedComponentType(event)
  if (!componentType) {
    return
  }

  const layoutNode = designerState.nodes.find((node) => node.id === layoutNodeId)
  if (!layoutNode || !componentLibraryMap[layoutNode.type]?.canAcceptChildren) {
    ElMessage.warning('布局容器不可用。')
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const draftNode = buildCanvasNodeFromType(componentType)
  const patch: Partial<Omit<CanvasComponentNode, 'id' | 'type'>> = {
    parentId: layoutNodeId,
    gridCell: null,
    zIndex: resolveNextLayoutChildZIndex(layoutNodeId)
  }

  if (layoutNode.type === 'layoutFree' || layoutNode.type === 'layoutTabs') {
    const scopeElement = resolveLayoutDropScopeElement(event, layoutNodeId)
    if (scopeElement) {
      const scopeRect = scopeElement.getBoundingClientRect()
      const maxX = Math.max(0, Math.round(scopeRect.width) - draftNode.width)
      const maxY = Math.max(0, Math.round(scopeRect.height) - draftNode.height)
      patch.x = clamp(Math.round(event.clientX - scopeRect.left - draftNode.width / 2), 0, maxX)
      patch.y = clamp(Math.round(event.clientY - scopeRect.top - draftNode.height / 2), 0, maxY)
    } else {
      patch.x = 0
      patch.y = 0
    }
  } else {
    patch.x = 0
    patch.y = 0
  }

  if (layoutNode.type === 'layoutTabs') {
    const tabsCount = resolveLayoutTabsCount(layoutNode)
    const rawActiveTab = Number(layoutNode.props?.activeTab)
    const activeTab = Number.isFinite(rawActiveTab) ? Math.round(rawActiveTab) : 0
    const tabIndex = clamp(activeTab, 0, Math.max(0, tabsCount - 1))
    patch.props = {
      tabIndex
    }
  }

  const result = addDesignerNode(buildCanvasNodeFromType(componentType, patch))
  if (!result.ok) {
    ElMessage.warning(result.message || '向布局容器添加组件失败。')
  }
}

function onLayoutTabChange(layoutNodeId: string, activeTab: number) {
  if (!ensureCanvasEditable(false)) {
    return
  }

  const normalizedTab = Math.max(0, Math.round(activeTab))
  const result = updateDesignerNode(layoutNodeId, {
    props: {
      activeTab: normalizedTab
    }
  })
  if (!result.ok) {
    ElMessage.warning(result.message || '切换选项卡失败。')
  }
}

function onCanvasDrop(event: DragEvent) {
  if (!ensureCanvasEditable()) {
    return
  }

  const componentType = resolveDraggedComponentType(event)
  if (!componentType) {
    return
  }

  event.preventDefault()

  if (designerState.layoutMode === 'grid9') {
    const gridCell = findFirstAvailableGridCell()
    if (typeof gridCell !== 'number') {
      ElMessage.warning('9宫格布局已满，请先删除已有组件再继续添加。')
      return
    }

    const result = addDesignerNode(
      buildCanvasNodeFromType(componentType, {
        gridCell
      })
    )

    if (!result.ok) {
      ElMessage.warning(result.message || '添加组件失败，请重试。')
    }
    return
  }

  const contentRect = canvasContentRef.value?.getBoundingClientRect()
  if (!contentRect) {
    return
  }

  const draftNode = buildCanvasNodeFromType(componentType)
  const maxX = Math.max(0, canvasWidth.value - draftNode.width)
  const maxY = Math.max(0, canvasHeight.value - draftNode.height)

  const dropX = clamp(Math.round(event.clientX - contentRect.left - draftNode.width / 2), 0, maxX)
  const dropY = clamp(Math.round(event.clientY - contentRect.top - draftNode.height / 2), 0, maxY)

  const result = addDesignerNode(
    buildCanvasNodeFromType(componentType, {
      x: dropX,
      y: dropY
    })
  )

  if (!result.ok) {
    ElMessage.warning(result.message || '添加组件失败，请重试。')
  }
}

function onSelectNode(nodeId: string) {
  if (!ensureCanvasEditable()) {
    return
  }
  selectDesignerNode(nodeId)
}

function onRemoveNode(nodeId: string) {
  if (!ensureCanvasEditable()) {
    return
  }
  removeDesignerNode(nodeId)
}

function onCanvasBlankPointerDown(event: PointerEvent) {
  if (!ensureCanvasEditable(false)) {
    return
  }
  if (event.target === canvasContentRef.value) {
    selectDesignerNode('')
  }
}

function buildFreeNodeStyle(node: CanvasComponentNode) {
  const sizeMode = resolveNodeSizeMode(node)
  let widthCss = `${node.width}px`
  let heightCss = `${node.height}px`

  if (sizeMode === 'responsive') {
    const parentSize = resolveNodeParentSize(node)
    const fallbackWidth = (node.width / Math.max(1, parentSize.width)) * 100
    const fallbackHeight = (node.height / Math.max(1, parentSize.height)) * 100
    const widthPercent = resolveNodeSizePercent(node, 'widthPercent', fallbackWidth)
    const heightPercent = resolveNodeSizePercent(node, 'heightPercent', fallbackHeight)

    widthCss = `${widthPercent}%`
    heightCss = `${heightPercent}%`
  }

  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: widthCss,
    height: heightCss,
    zIndex: `${Math.max(1, Number(node.zIndex || 1))}`
  }
}

function resolveNodeSizeMode(node: CanvasComponentNode): NodeSizeMode {
  return node.props?.sizeMode === 'responsive' ? 'responsive' : 'fixed'
}

function resolveNodeSizePercent(
  node: CanvasComponentNode,
  key: 'widthPercent' | 'heightPercent',
  fallbackPercent = 100
) {
  const rawValue = Number(node.props?.[key])
  if (!Number.isFinite(rawValue)) {
    return clamp(Math.round(fallbackPercent), 1, 100)
  }
  return clamp(Math.round(rawValue), 1, 100)
}

function resolveNodeParentSize(node: CanvasComponentNode) {
  if (!node.parentId) {
    return {
      width: Math.max(1, canvasWidth.value || node.width),
      height: Math.max(1, canvasHeight.value || node.height)
    }
  }

  const parentNode = designerState.nodes.find((item) => item.id === node.parentId)
  return {
    width: Math.max(1, parentNode?.width || canvasWidth.value || node.width),
    height: Math.max(1, parentNode?.height || canvasHeight.value || node.height)
  }
}

function resolveNodeVisualSizeInScope(node: CanvasComponentNode, scopeWidth: number, scopeHeight: number) {
  if (resolveNodeSizeMode(node) !== 'responsive') {
    return {
      width: Math.max(1, Math.round(node.width)),
      height: Math.max(1, Math.round(node.height))
    }
  }

  const fallbackWidthPercent = (Math.max(1, Number(node.width || 1)) / Math.max(1, scopeWidth)) * 100
  const fallbackHeightPercent = (Math.max(1, Number(node.height || 1)) / Math.max(1, scopeHeight)) * 100
  const widthPercent = resolveNodeSizePercent(node, 'widthPercent', fallbackWidthPercent)
  const heightPercent = resolveNodeSizePercent(node, 'heightPercent', fallbackHeightPercent)

  return {
    width: clamp(Math.round((Math.max(1, scopeWidth) * widthPercent) / 100), 1, Math.max(1, scopeWidth)),
    height: clamp(Math.round((Math.max(1, scopeHeight) * heightPercent) / 100), 1, Math.max(1, scopeHeight))
  }
}

function resolveNodeDragScope(node: CanvasComponentNode): DragScope | null {
  const contentRect = canvasContentRef.value?.getBoundingClientRect()
  if (!contentRect) {
    return null
  }

  if (!node.parentId) {
    return {
      left: contentRect.left,
      top: contentRect.top,
      width: Math.max(1, Math.round(contentRect.width)),
      height: Math.max(1, Math.round(contentRect.height)),
      snapEnabled: true,
      scopeNodeId: ROOT_DRAG_SCOPE_ID,
      scopeCanvasX: 0,
      scopeCanvasY: 0
    }
  }

  const parentNode = designerState.nodes.find((item) => item.id === node.parentId)
  if (!parentNode || (parentNode.type !== 'layoutFree' && parentNode.type !== 'layoutTabs')) {
    return null
  }

  const scopeElement = canvasContentRef.value?.querySelector(`[data-layout-scope-id="${node.parentId}"]`) as HTMLElement | null
  if (!scopeElement) {
    return null
  }
  const scopeRect = scopeElement.getBoundingClientRect()
  return {
    left: scopeRect.left,
    top: scopeRect.top,
    width: Math.max(1, Math.round(scopeRect.width)),
    height: Math.max(1, Math.round(scopeRect.height)),
    snapEnabled: true,
    scopeNodeId: node.parentId,
    scopeCanvasX: Math.max(0, Math.round(scopeRect.left - contentRect.left)),
    scopeCanvasY: Math.max(0, Math.round(scopeRect.top - contentRect.top))
  }
}

function buildResponsiveSizePatch(node: CanvasComponentNode, width: number, height: number, parentWidth: number, parentHeight: number) {
  if (resolveNodeSizeMode(node) !== 'responsive') {
    return {}
  }
  const widthPercent = clamp(Math.round((width / Math.max(1, parentWidth)) * 100), 1, 100)
  const heightPercent = clamp(Math.round((height / Math.max(1, parentHeight)) * 100), 1, 100)
  return {
    props: {
      widthPercent,
      heightPercent
    }
  }
}

interface ResponsiveChildResizeDraft {
  node: CanvasComponentNode
  widthPercent: number
  heightPercent: number
  nextX: number
  nextY: number
  nextWidth: number
  nextHeight: number
}

function buildResponsiveChildrenResizePatches(
  layoutNodeId: string,
  startWidth: number,
  startHeight: number,
  nextWidth: number,
  nextHeight: number
) {
  const normalizedStartWidth = Math.max(1, Math.round(startWidth))
  const normalizedStartHeight = Math.max(1, Math.round(startHeight))
  const normalizedNextWidth = Math.max(1, Math.round(nextWidth))
  const normalizedNextHeight = Math.max(1, Math.round(nextHeight))
  const scaleX = normalizedNextWidth / normalizedStartWidth
  const scaleY = normalizedNextHeight / normalizedStartHeight

  const drafts: ResponsiveChildResizeDraft[] = designerState.nodes
    .filter((node) => {
      return node.parentId === layoutNodeId && node.visible !== false && resolveNodeSizeMode(node) === 'responsive'
    })
    .map((node) => {
      const fallbackWidthPercent = (Math.max(1, Number(node.width || 1)) / normalizedStartWidth) * 100
      const fallbackHeightPercent = (Math.max(1, Number(node.height || 1)) / normalizedStartHeight) * 100
      const widthPercent = resolveNodeSizePercent(node, 'widthPercent', fallbackWidthPercent)
      const heightPercent = resolveNodeSizePercent(node, 'heightPercent', fallbackHeightPercent)

      const nextChildWidth = clamp(
        Math.round((normalizedNextWidth * widthPercent) / 100),
        1,
        Math.max(1, normalizedNextWidth)
      )
      const nextChildHeight = clamp(
        Math.round((normalizedNextHeight * heightPercent) / 100),
        1,
        Math.max(1, normalizedNextHeight)
      )
      const nextChildX = clamp(
        Math.round(node.x * scaleX),
        0,
        Math.max(0, normalizedNextWidth - nextChildWidth)
      )
      const nextChildY = clamp(
        Math.round(node.y * scaleY),
        0,
        Math.max(0, normalizedNextHeight - nextChildHeight)
      )

      return {
        node,
        widthPercent,
        heightPercent,
        nextX: nextChildX,
        nextY: nextChildY,
        nextWidth: nextChildWidth,
        nextHeight: nextChildHeight
      }
    })

  if (!drafts.length) {
    return []
  }

  const sortedDrafts = [...drafts].sort((left, right) => {
    if (left.node.y === right.node.y) {
      return left.node.x - right.node.x
    }
    return left.node.y - right.node.y
  })

  const rowTolerance = SNAP_THRESHOLD + 2
  const rowGroups: ResponsiveChildResizeDraft[][] = []
  sortedDrafts.forEach((draft) => {
    const currentRow = rowGroups[rowGroups.length - 1]
    if (!currentRow) {
      rowGroups.push([draft])
      return
    }
    const baselineY = currentRow[0].node.y
    if (Math.abs(draft.node.y - baselineY) <= rowTolerance) {
      currentRow.push(draft)
      return
    }
    rowGroups.push([draft])
  })

  let previousRowBottom = 0
  let previousOriginalRowBottom = 0
  rowGroups.forEach((rowGroup, rowIndex) => {
    rowGroup.sort((left, right) => left.node.x - right.node.x)

    const rowOriginalTop = rowGroup[0].node.y
    const rowOriginalBottom = rowGroup.reduce((maxValue, draft) => {
      return Math.max(maxValue, draft.node.y + draft.node.height)
    }, rowOriginalTop)

    let rowTop = clamp(
      Math.round(rowOriginalTop * scaleY),
      0,
      Math.max(0, normalizedNextHeight - 1)
    )
    if (rowIndex > 0) {
      const originalRowGap = Math.max(0, rowOriginalTop - previousOriginalRowBottom)
      const preservedRowGap = originalRowGap <= SNAP_THRESHOLD ? 0 : Math.max(0, Math.round(originalRowGap * scaleY))
      rowTop = Math.max(rowTop, previousRowBottom + preservedRowGap)
    } else {
      rowTop = Math.max(rowTop, previousRowBottom)
    }

    let rowBottom = rowTop

    rowGroup.forEach((draft, index) => {
      const maxX = Math.max(0, normalizedNextWidth - draft.nextWidth)
      const maxY = Math.max(0, normalizedNextHeight - draft.nextHeight)
      let candidateX = 0
      let candidateY =
        rowTop + Math.max(0, Math.round((draft.node.y - rowOriginalTop) * scaleY))

      if (index === 0) {
        candidateX = clamp(Math.round(draft.node.x * scaleX), 0, maxX)
      } else {
        const previousDraft = rowGroup[index - 1]
        const originalGapX = draft.node.x - (previousDraft.node.x + previousDraft.node.width)
        const preservedGapX = originalGapX <= SNAP_THRESHOLD ? 0 : Math.max(0, Math.round(originalGapX * scaleX))
        candidateX = previousDraft.nextX + previousDraft.nextWidth + preservedGapX
      }

      if (candidateX + draft.nextWidth > normalizedNextWidth && index > 0) {
        candidateX = 0
        candidateY = rowBottom
      }

      draft.nextX = clamp(candidateX, 0, maxX)
      draft.nextY = clamp(candidateY, 0, maxY)
      rowBottom = Math.max(rowBottom, draft.nextY + draft.nextHeight)
    })

    previousRowBottom = Math.max(previousRowBottom, rowBottom)
    previousOriginalRowBottom = Math.max(previousOriginalRowBottom, rowOriginalBottom)
  })

  return sortedDrafts
    .map((draft) => {
      const changed =
        draft.nextX !== draft.node.x ||
        draft.nextY !== draft.node.y ||
        draft.nextWidth !== draft.node.width ||
        draft.nextHeight !== draft.node.height

      if (!changed) {
        return null
      }

      return {
        nodeId: draft.node.id,
        patch: {
          x: draft.nextX,
          y: draft.nextY,
          width: draft.nextWidth,
          height: draft.nextHeight,
          props: {
            widthPercent: draft.widthPercent,
            heightPercent: draft.heightPercent
          }
        } as Partial<CanvasComponentNode>
      }
    })
    .filter(Boolean) as Array<{ nodeId: string; patch: Partial<CanvasComponentNode> }>
}

function buildScopeReferenceLines(
  draggingNode: CanvasComponentNode,
  scopeNodeId: string,
  scopeWidth: number,
  scopeHeight: number
) {
  const xLines = [0, scopeWidth / 2, scopeWidth]
  const yLines = [0, scopeHeight / 2, scopeHeight]

  const siblingNodes = designerState.nodes.filter((node) => {
    if (node.id === draggingNode.id || node.visible === false) {
      return false
    }

    if (scopeNodeId === ROOT_DRAG_SCOPE_ID) {
      return !node.parentId
    }

    return node.parentId === scopeNodeId
  })

  siblingNodes.forEach((node) => {
    const size = resolveNodeVisualSizeInScope(node, scopeWidth, scopeHeight)
    xLines.push(node.x, node.x + size.width / 2, node.x + size.width)
    yLines.push(node.y, node.y + size.height / 2, node.y + size.height)
  })

  return {
    xLines,
    yLines
  }
}

function computeSnappedPosition(
  node: CanvasComponentNode,
  rawX: number,
  rawY: number,
  scopeNodeId: string,
  scopeWidth: number,
  scopeHeight: number
) {
  const size = resolveNodeVisualSizeInScope(node, scopeWidth, scopeHeight)
  const maxX = Math.max(0, scopeWidth - size.width)
  const maxY = Math.max(0, scopeHeight - size.height)

  let nextX = clamp(rawX, 0, maxX)
  let nextY = clamp(rawY, 0, maxY)
  let guideX: number | null = null
  let guideY: number | null = null

  const { xLines, yLines } = buildScopeReferenceLines(node, scopeNodeId, scopeWidth, scopeHeight)
  let minDiffX = SNAP_THRESHOLD + 1
  let minDiffY = SNAP_THRESHOLD + 1

  xLines.forEach((line) => {
    const alignedCandidates = [line, line - size.width / 2, line - size.width]
    alignedCandidates.forEach((candidate) => {
      const bounded = clamp(Math.round(candidate), 0, maxX)
      const diff = Math.abs(bounded - nextX)
      if (diff <= SNAP_THRESHOLD && diff < minDiffX) {
        minDiffX = diff
        nextX = bounded
        guideX = line
      }
    })
  })

  yLines.forEach((line) => {
    const alignedCandidates = [line, line - size.height / 2, line - size.height]
    alignedCandidates.forEach((candidate) => {
      const bounded = clamp(Math.round(candidate), 0, maxY)
      const diff = Math.abs(bounded - nextY)
      if (diff <= SNAP_THRESHOLD && diff < minDiffY) {
        minDiffY = diff
        nextY = bounded
        guideY = line
      }
    })
  })

  return {
    x: nextX,
    y: nextY,
    guideX,
    guideY
  }
}

function teardownDragListeners() {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
}

function onNodePointerDown(event: PointerEvent, nodeId: string) {
  if (!ensureCanvasEditable()) {
    return
  }

  if (event.button !== 0) {
    return
  }

  const node = designerState.nodes.find((item) => item.id === nodeId)
  if (!node || node.locked) {
    return
  }

  if (designerState.layoutMode !== 'free' && !node.parentId) {
    return
  }

  const scope = resolveNodeDragScope(node)
  if (!scope) {
    return
  }

  selectDesignerNode(nodeId)
  dragContext.value = {
    nodeId,
    pointerId: event.pointerId,
    offsetX: event.clientX - scope.left - node.x,
    offsetY: event.clientY - scope.top - node.y,
    scopeLeft: scope.left,
    scopeTop: scope.top,
    scopeWidth: scope.width,
    scopeHeight: scope.height,
    snapEnabled: scope.snapEnabled,
    scopeNodeId: scope.scopeNodeId,
    scopeCanvasX: scope.scopeCanvasX,
    scopeCanvasY: scope.scopeCanvasY
  }

  resizeContext.value = null
  snapGuideX.value = null
  snapGuideY.value = null
  teardownDragListeners()
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
}

function onNodeResizeStart(event: PointerEvent, nodeId: string, direction: ResizeHandleDirection) {
  if (!ensureCanvasEditable()) {
    return
  }
  if (event.button !== 0) {
    return
  }

  const node = designerState.nodes.find((item) => item.id === nodeId)
  if (!node || node.locked) {
    return
  }

  const scope = resolveNodeDragScope(node)
  if (!scope) {
    return
  }

  selectDesignerNode(nodeId)
  dragContext.value = null
  snapGuideX.value = null
  snapGuideY.value = null
  resizeContext.value = {
    nodeId,
    pointerId: event.pointerId,
    direction,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: node.x,
    startY: node.y,
    startWidth: node.width,
    startHeight: node.height,
    scopeWidth: scope.width,
    scopeHeight: scope.height
  }

  teardownDragListeners()
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
}

function onWindowPointerMove(event: PointerEvent) {
  if (!ensureCanvasEditable(false)) {
    dragContext.value = null
    resizeContext.value = null
    teardownDragListeners()
    return
  }

  const activeResize = resizeContext.value
  if (activeResize && event.pointerId === activeResize.pointerId) {
    const node = designerState.nodes.find((item) => item.id === activeResize.nodeId)
    if (!node) {
      return
    }

    const diffX = event.clientX - activeResize.startClientX
    const diffY = event.clientY - activeResize.startClientY
    const hasWest = activeResize.direction.includes('w')
    const hasEast = activeResize.direction.includes('e')
    const hasNorth = activeResize.direction.includes('n')
    const hasSouth = activeResize.direction.includes('s')

    let nextX = activeResize.startX
    let nextY = activeResize.startY
    let nextWidth = activeResize.startWidth
    let nextHeight = activeResize.startHeight

    if (hasEast) {
      nextWidth += diffX
    }
    if (hasSouth) {
      nextHeight += diffY
    }
    if (hasWest) {
      nextWidth -= diffX
      nextX += diffX
    }
    if (hasNorth) {
      nextHeight -= diffY
      nextY += diffY
    }

    const minWidth = 40
    const minHeight = 28

    if (nextX < 0) {
      if (hasWest) {
        nextWidth += nextX
      }
      nextX = 0
    }
    if (nextY < 0) {
      if (hasNorth) {
        nextHeight += nextY
      }
      nextY = 0
    }

    if (nextX + nextWidth > activeResize.scopeWidth) {
      if (hasEast) {
        nextWidth = activeResize.scopeWidth - nextX
      } else if (hasWest) {
        nextX = activeResize.scopeWidth - nextWidth
      }
    }
    if (nextY + nextHeight > activeResize.scopeHeight) {
      if (hasSouth) {
        nextHeight = activeResize.scopeHeight - nextY
      } else if (hasNorth) {
        nextY = activeResize.scopeHeight - nextHeight
      }
    }

    if (nextWidth < minWidth) {
      if (hasWest) {
        nextX -= minWidth - nextWidth
      }
      nextWidth = minWidth
    }
    if (nextHeight < minHeight) {
      if (hasNorth) {
        nextY -= minHeight - nextHeight
      }
      nextHeight = minHeight
    }

    nextX = clamp(Math.round(nextX), 0, Math.max(0, activeResize.scopeWidth - minWidth))
    nextY = clamp(Math.round(nextY), 0, Math.max(0, activeResize.scopeHeight - minHeight))
    nextWidth = clamp(Math.round(nextWidth), minWidth, Math.max(minWidth, activeResize.scopeWidth - nextX))
    nextHeight = clamp(Math.round(nextHeight), minHeight, Math.max(minHeight, activeResize.scopeHeight - nextY))

    const shouldReflowResponsiveChildren = node.type === 'layoutFree' || node.type === 'layoutTabs'
    const responsiveChildrenResizePatches = shouldReflowResponsiveChildren
      ? buildResponsiveChildrenResizePatches(
          node.id,
          activeResize.startWidth,
          activeResize.startHeight,
          nextWidth,
          nextHeight
        )
      : []

    const result = updateDesignerNode(
      node.id,
      {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        ...buildResponsiveSizePatch(node, nextWidth, nextHeight, activeResize.scopeWidth, activeResize.scopeHeight)
      },
      {
        skipRevision: true
      }
    )

    if (!result.ok) {
      return
    }

    responsiveChildrenResizePatches.forEach((childPatch) => {
      updateDesignerNode(childPatch.nodeId, childPatch.patch, {
        skipRevision: true
      })
    })
    return
  }

  const context = dragContext.value
  if (!context || event.pointerId !== context.pointerId) {
    return
  }

  const node = designerState.nodes.find((item) => item.id === context.nodeId)
  if (!node) {
    return
  }

  const rawX = Math.round(event.clientX - context.scopeLeft - context.offsetX)
  const rawY = Math.round(event.clientY - context.scopeTop - context.offsetY)
  const visualSize = resolveNodeVisualSizeInScope(node, context.scopeWidth, context.scopeHeight)
  const maxX = Math.max(0, context.scopeWidth - visualSize.width)
  const maxY = Math.max(0, context.scopeHeight - visualSize.height)
  const nextX = clamp(rawX, 0, maxX)
  const nextY = clamp(rawY, 0, maxY)
  const snapped = context.snapEnabled
    ? computeSnappedPosition(node, nextX, nextY, context.scopeNodeId, context.scopeWidth, context.scopeHeight)
    : {
        x: nextX,
        y: nextY,
        guideX: null as number | null,
        guideY: null as number | null
      }

  const result = updateDesignerNode(
    context.nodeId,
    {
      x: snapped.x,
      y: snapped.y
    },
    {
      skipRevision: true
    }
  )

  if (!result.ok) {
    return
  }

  snapGuideX.value = snapped.guideX === null ? null : context.scopeCanvasX + snapped.guideX
  snapGuideY.value = snapped.guideY === null ? null : context.scopeCanvasY + snapped.guideY
}

function onWindowPointerUp(event: PointerEvent) {
  const activeDrag = dragContext.value
  const activeResize = resizeContext.value
  const isDragPointer = Boolean(activeDrag && event.pointerId === activeDrag.pointerId)
  const isResizePointer = Boolean(activeResize && event.pointerId === activeResize.pointerId)
  if (!isDragPointer && !isResizePointer) {
    return
  }

  dragContext.value = null
  resizeContext.value = null
  snapGuideX.value = null
  snapGuideY.value = null
  teardownDragListeners()
  if (canEditCanvas.value) {
    commitDesignerRevision()
  }
}

function openRuntimePreview() {
  if (props.projectPreview.status !== 'running' || !props.projectPreview.previewUrl) {
    ElMessage.warning('预览服务未运行或预览地址为空，请先启动预览。')
    return
  }

  runtimePreviewVisible.value = true
  runtimeFrameKey.value += 1
}

function closeRuntimePreview() {
  runtimePreviewVisible.value = false
  dispatchPreviewControl('stop')
}

watch(
  () => props.selectedFileNode,
  (fileNode) => {
    void loadSelectedFile(fileNode)
  },
  {
    immediate: true
  }
)

watch(
  () => activeCenterTab.value,
  (tabValue) => {
    if (tabValue === 'source') {
      nextTick(() => {
        editorRef.value?.layout()
        editorRef.value?.focus()
      })
      return
    }

    if (tabValue === 'dsl') {
      nextTick(() => {
        dslEditorRef.value?.layout()
      })
      return
    }

    nextTick(() => {
      syncCanvasSize()
    })
  }
)

watch(
  () => [designerState.layoutMode, activeCenterTab.value],
  () => {
    nextTick(() => {
      syncCanvasSize()
      setupCanvasResizeObserver()
    })
  },
  {
    immediate: true
  }
)

watch(
  () => designerState.revision,
  () => {
    if (applyingSourceToDesigner) {
      return
    }
    if (!canEditCanvas.value) {
      return
    }

    const nextSource = generateVueSourceFromDsl({
      layoutMode: designerState.layoutMode,
      gridRows: designerState.gridRows,
      canvasBackground: designerState.canvasBackground,
      nodes: designerState.nodes
    })

    if (nextSource === sourceCode.value) {
      return
    }

    applyingDesignerToSource = true
    sourceCode.value = nextSource
    applyingDesignerToSource = false
    sourceDirty.value = true
    sourceError.value = ''
    sourceInfo.value = '画布已更新，源码已自动同步（未保存）。'
  }
)

watch(
  () => [props.projectPreview.status, props.projectPreview.previewUrl],
  ([status, previewUrl], previous) => {
    const prevPreviewUrl = previous?.[1] || ''

    if (status === 'running' && previewUrl) {
      runtimePreviewVisible.value = true
      if (previewUrl !== prevPreviewUrl) {
        runtimeFrameKey.value += 1
      }
      return
    }

    if (status !== 'running') {
      runtimePreviewVisible.value = false
    }
  },
  {
    immediate: true
  }
)

onMounted(() => {
  nextTick(() => {
    syncCanvasSize()
    setupCanvasResizeObserver()
  })
})

onBeforeUnmount(() => {
  teardownDragListeners()
  teardownCanvasResizeObserver()
})
</script>

<template>
  <div class="app-previewer-wrapper">
    <header class="previewer-header">
      <div class="file-meta">
        <p class="file-path">{{ sourcePathDisplay }}</p>
        <p class="file-status">
          <span v-if="sourceDirty">源码有未保存更改</span>
          <span v-else-if="sourceInfo">{{ sourceInfo }}</span>
          <span v-else-if="sourceError" class="error-text">{{ sourceError }}</span>
          <span v-else-if="hasSelectedFile && !canEditCanvas">当前文件不可视化编辑，请切换到低代码生成文件。</span>
          <span v-else>画布变化会自动同步到源码，保存后写入文件。</span>
        </p>
      </div>

      <div class="header-actions">
        <el-button-group>
          <el-button :type="activeCenterTab === 'canvas' ? 'primary' : 'default'" size="small" @click="activeCenterTab = 'canvas'">
            画布
          </el-button>
          <el-button :type="activeCenterTab === 'source' ? 'primary' : 'default'" size="small" @click="activeCenterTab = 'source'">
            源码
          </el-button>
          <el-button :type="activeCenterTab === 'dsl' ? 'primary' : 'default'" size="small" @click="activeCenterTab = 'dsl'">
            DSL
          </el-button>
        </el-button-group>
        <el-button size="small" @click="onSaveSourceManually">保存源码</el-button>
        <el-button size="small" :disabled="props.projectPreview.status !== 'running'" @click="openRuntimePreview">
          运行预览
        </el-button>
      </div>
    </header>

    <div class="previewer-body">
      <section v-show="activeCenterTab === 'canvas'" class="canvas-section">
        <template v-if="canEditCanvas">
          <div class="canvas-toolbar">
            <span>当前布局：{{ designerState.layoutMode === 'free' ? '自由布局' : '9宫格布局' }}</span>
            <span>画布尺寸：{{ canvasWidth }} x {{ canvasHeight }}</span>
            <span>吸附阈值：{{ SNAP_THRESHOLD }}px</span>
          </div>

          <div class="canvas-stage">
            <div v-if="showRuler" class="ruler-corner"></div>

            <div v-if="showRuler" class="horizontal-ruler">
              <div
                v-for="mark in horizontalRulerMarks"
                :key="`horizontal-${mark.value}`"
                class="ruler-mark horizontal"
                :class="{ major: mark.major }"
                :style="{ left: `${mark.value}px` }"
              >
                <span class="ruler-line"></span>
                <span v-if="mark.major" class="ruler-label">{{ mark.value }}</span>
              </div>
            </div>

            <div v-if="showRuler" class="vertical-ruler">
              <div
                v-for="mark in verticalRulerMarks"
                :key="`vertical-${mark.value}`"
                class="ruler-mark vertical"
                :class="{ major: mark.major }"
                :style="{ top: `${mark.value}px` }"
              >
                <span class="ruler-line"></span>
                <span v-if="mark.major" class="ruler-label">{{ mark.value }}</span>
              </div>
            </div>

            <div
              ref="canvasContentRef"
              class="canvas-content"
              :class="{
                'with-ruler': showRuler,
                'free-layout': designerState.layoutMode === 'free',
                'grid-layout': designerState.layoutMode === 'grid9'
              }"
              :style="{ background: designerState.canvasBackground }"
              @dragover="onCanvasDragOver"
              @drop="onCanvasDrop"
              @pointerdown="onCanvasBlankPointerDown"
            >
              <template v-if="designerState.layoutMode === 'free'">
                <div
                  v-for="node in rootVisibleNodes"
                  :key="node.id"
                  class="free-node-item"
                  :class="{ selected: designerState.selectedNodeId === node.id, locked: node.locked }"
                  :style="buildFreeNodeStyle(node)"
                >
                  <CanvasNodeCard
                    :node="node"
                    :selected="designerState.selectedNodeId === node.id"
                    :draggable="!node.locked"
                    :selected-node-id="designerState.selectedNodeId"
                    :node-children-map="nodeChildrenMap"
                    @select="onSelectNode"
                    @remove="onRemoveNode"
                    @pointer-down="onNodePointerDown"
                    @resize-start="onNodeResizeStart"
                    @drop-to-layout="onDropToLayout"
                    @layout-tab-change="onLayoutTabChange"
                  />
                  <template v-if="!node.locked && designerState.selectedNodeId === node.id">
                    <button class="free-resize-handle top-left" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'nw')"></button>
                    <button class="free-resize-handle top-center" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'n')"></button>
                    <button class="free-resize-handle top-right" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'ne')"></button>
                    <button class="free-resize-handle middle-left" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'w')"></button>
                    <button class="free-resize-handle middle-right" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'e')"></button>
                    <button class="free-resize-handle bottom-left" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'sw')"></button>
                    <button class="free-resize-handle bottom-center" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 's')"></button>
                    <button class="free-resize-handle bottom-right" type="button" @pointerdown.stop.prevent="onNodeResizeStart($event, node.id, 'se')"></button>
                  </template>
                  <div v-if="node.locked" class="lock-mask">已锁定</div>
                </div>
              </template>

              <template v-else>
                <div class="grid-container" :style="gridContainerStyle">
                  <div
                    v-for="(cellNode, cellIndex) in gridCellNodes"
                    :key="`grid-cell-${cellIndex}`"
                    class="grid-cell"
                    :class="{ selected: cellNode && designerState.selectedNodeId === cellNode.id }"
                  >
                    <span v-if="!cellNode" class="grid-empty-text">网格 {{ cellIndex + 1 }}</span>
                    <CanvasNodeCard
                      v-else
                      :node="cellNode"
                      :selected="designerState.selectedNodeId === cellNode.id"
                      :draggable="false"
                      :selected-node-id="designerState.selectedNodeId"
                      :node-children-map="nodeChildrenMap"
                      @select="onSelectNode"
                      @remove="onRemoveNode"
                      @resize-start="onNodeResizeStart"
                      @drop-to-layout="onDropToLayout"
                      @layout-tab-change="onLayoutTabChange"
                    />
                  </div>
                </div>

                <div v-if="gridOverflowCount > 0" class="grid-overflow-tip">
                  还有 {{ gridOverflowCount }} 个组件未显示。9宫格最多显示 9 个组件，请删除组件或切换为自由布局。
                </div>
              </template>
              <div v-if="snapGuideX !== null" class="snap-line vertical" :style="{ left: `${snapGuideX}px` }"></div>
              <div v-if="snapGuideY !== null" class="snap-line horizontal" :style="{ top: `${snapGuideY}px` }"></div>
            </div>
          </div>
        </template>

        <div v-else class="canvas-readonly-state">
          <el-empty description="当前文件不可视化编辑，请切换到低代码生成文件。" />
        </div>
      </section>

      <section v-show="activeCenterTab === 'source'" class="source-section">
        <div class="source-toolbar">
          <span>语言：{{ sourceLanguage }}</span>
          <span v-if="sourceLoading">正在加载源码...</span>
          <span v-else-if="sourceWritable">当前文件可直接保存。</span>
          <span v-else-if="hasDraftSaveTarget">将保存到草稿文件：{{ draftSaveFileName }}</span>
          <span v-else>尚未选择保存位置，点击“保存源码”后可选择文件夹。</span>
        </div>
        <div class="source-editor-shell">
          <MonacoCodeEditor
            ref="editorRef"
            :model-value="sourceCode"
            :language="sourceLanguage"
            @update:model-value="onSourceCodeChange"
          />
        </div>
      </section>

      <section v-show="activeCenterTab === 'dsl'" class="source-section">
        <div class="source-toolbar">
          <span>DSL 结构（只读）</span>
          <span>布局：{{ designerState.layoutMode === 'free' ? '自由布局' : '9宫格布局' }}</span>
          <span>节点数：{{ designerState.nodes.length }}</span>
        </div>
        <div class="source-editor-shell">
          <MonacoCodeEditor
            ref="dslEditorRef"
            :model-value="dslPreviewCode"
            language="json"
            :read-only="true"
          />
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="runtimePreviewVisible" class="runtime-preview-overlay">
        <header class="runtime-preview-header">
          <div class="runtime-title-wrapper">
            <strong>运行预览</strong>
            <span class="runtime-url">{{ props.projectPreview.previewUrl }}</span>
          </div>
          <button class="runtime-close-btn" type="button" @click="closeRuntimePreview">关闭预览</button>
        </header>
        <iframe :key="runtimeFrameKey" class="runtime-preview-frame" :src="props.projectPreview.previewUrl" />
      </div>
    </Teleport>
  </div>
</template>
<style scoped>
.app-previewer-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.previewer-header {
  height: 54px;
  border-bottom: 1px solid var(--color-gray-300);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: linear-gradient(180deg, #f6faff 0%, #ffffff 100%);
}

.file-meta {
  min-width: 0;
}

.file-path {
  font-size: 13px;
  color: #1f2937;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-status {
  margin-top: 3px;
  font-size: 12px;
  color: #6b7280;
}

.error-text {
  color: #d93025;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.previewer-body {
  flex: 1;
  min-height: 0;
}

.empty-file-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-section,
.source-section {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.canvas-toolbar,
.source-toolbar {
  height: 36px;
  border-bottom: 1px dashed var(--color-gray-300);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 12px;
  font-size: 12px;
  color: #4b5563;
}

.canvas-stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.canvas-readonly-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-content {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.canvas-content.with-ruler {
  width: calc(100% - 18px);
  height: calc(100% - 18px);
  margin-left: 18px;
  margin-top: 18px;
}

.canvas-content.free-layout {
  background-image: none;
}

.canvas-content.grid-layout {
  padding: 12px;
}

.ruler-corner {
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 18px;
  border-right: 1px solid var(--color-gray-300);
  border-bottom: 1px solid var(--color-gray-300);
  background: #f5f7fa;
  z-index: 5;
}

.horizontal-ruler {
  position: absolute;
  left: 18px;
  right: 0;
  top: 0;
  height: 18px;
  border-bottom: 1px solid var(--color-gray-300);
  background: #f5f7fa;
  overflow: hidden;
  z-index: 4;
}

.vertical-ruler {
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 0;
  width: 18px;
  border-right: 1px solid var(--color-gray-300);
  background: #f5f7fa;
  overflow: hidden;
  z-index: 4;
}

.ruler-mark {
  position: absolute;
}

.ruler-mark.horizontal {
  top: 0;
}

.ruler-mark.vertical {
  left: 0;
}

.ruler-line {
  position: absolute;
  background: #94a3b8;
}

.horizontal .ruler-line {
  width: 1px;
  height: 6px;
  bottom: 0;
}

.vertical .ruler-line {
  height: 1px;
  width: 6px;
  right: 0;
}

.ruler-mark.major.horizontal .ruler-line {
  height: 10px;
}

.ruler-mark.major.vertical .ruler-line {
  width: 10px;
}

.ruler-label {
  position: absolute;
  color: #64748b;
  font-size: 10px;
  transform-origin: left top;
}

.horizontal .ruler-label {
  left: 2px;
  top: 1px;
}

.vertical .ruler-label {
  right: 2px;
  top: 2px;
  transform: rotate(-90deg) translateX(-100%);
}

.free-node-item {
  position: absolute;
}

.free-node-item.locked {
  cursor: not-allowed;
}

.lock-mask {
  position: absolute;
  right: 6px;
  top: 6px;
  height: 20px;
  line-height: 20px;
  border-radius: 999px;
  padding: 0 8px;
  font-size: 11px;
  color: #92400e;
  background: rgb(251 191 36 / 22%);
  border: 1px solid rgb(251 191 36 / 42%);
  pointer-events: none;
}

.free-resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1px solid #2563eb;
  background: #fff;
  border-radius: 1px;
  padding: 0;
  margin: 0;
  z-index: 18;
}

.free-resize-handle.top-left {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}

.free-resize-handle.top-center {
  left: calc(50% - 5px);
  top: 0;
  cursor: ns-resize;
}

.free-resize-handle.top-right {
  right: 0;
  top: 0;
  cursor: nesw-resize;
}

.free-resize-handle.middle-left {
  left: 0;
  top: calc(50% - 5px);
  cursor: ew-resize;
}

.free-resize-handle.middle-right {
  right: 0;
  top: calc(50% - 5px);
  cursor: ew-resize;
}

.free-resize-handle.bottom-left {
  left: 0;
  bottom: 0;
  cursor: nesw-resize;
}

.free-resize-handle.bottom-center {
  left: calc(50% - 5px);
  bottom: 0;
  cursor: ns-resize;
}

.free-resize-handle.bottom-right {
  right: 0;
  bottom: 0;
  cursor: nwse-resize;
}

.snap-line {
  position: absolute;
  pointer-events: none;
  z-index: 50;
}

.snap-line.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgb(37 99 235 / 78%);
}

.snap-line.horizontal {
  left: 0;
  right: 0;
  height: 1px;
  background: rgb(37 99 235 / 78%);
}

.grid-container {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(var(--lc-grid9-rows, 3), minmax(0, 1fr));
  gap: 10px;
}

.grid-cell {
  border: 1px dashed rgb(100 116 139 / 42%);
  border-radius: 8px;
  background: rgb(255 255 255 / 85%);
  overflow: hidden;
  min-height: 120px;
}

.grid-cell.selected {
  border-color: #2563eb;
  box-shadow: inset 0 0 0 1px rgb(37 99 235 / 22%);
}

.grid-empty-text {
  display: inline-flex;
  margin: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #475569;
  background: rgb(148 163 184 / 16%);
}

.grid-overflow-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #a45f00;
}

.source-editor-shell {
  flex: 1;
  min-height: 0;
}

.runtime-preview-overlay {
  position: fixed;
  left: 0;
  right: 0;
  top: 48px;
  bottom: 0;
  z-index: 4000;
  background: #0b1220;
  display: flex;
  flex-direction: column;
}

.runtime-preview-header {
  height: 46px;
  border-bottom: 1px solid rgb(148 163 184 / 22%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  color: #e2e8f0;
}

.runtime-title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.runtime-title-wrapper strong {
  font-size: 14px;
}

.runtime-url {
  font-size: 12px;
  color: #a5b4fc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.runtime-close-btn {
  height: 30px;
  border: 1px solid rgb(248 113 113 / 42%);
  border-radius: 8px;
  background: rgb(248 113 113 / 12%);
  color: #fecaca;
  padding: 0 12px;
  cursor: pointer;
}

.runtime-preview-frame {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}
</style>



