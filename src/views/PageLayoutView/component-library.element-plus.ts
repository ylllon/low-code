import type {
  CanvasComponentNode,
  ComponentPropEditorType,
  ComponentPropSchema,
  LibraryComponentMeta
} from './component-library.types'
import {
  elementPlusAutoComponentLibraryList,
  elementPlusAutoRenderBindingList,
  type ElementPlusAutoRenderBinding
} from './component-library.element-plus.generated'

const autoComponentMetaMap: Record<string, LibraryComponentMeta> =
  elementPlusAutoComponentLibraryList.reduce(
    (accumulator, item) => {
      accumulator[item.type] = item
      return accumulator
    },
    {} as Record<string, LibraryComponentMeta>
  )

const autoBindingMap: Record<string, ElementPlusAutoRenderBinding> =
  elementPlusAutoRenderBindingList.reduce(
    (accumulator, item) => {
      accumulator[item.type] = item
      return accumulator
    },
    {} as Record<string, ElementPlusAutoRenderBinding>
  )

const autoEditorMap: Record<
  string,
  Record<string, ComponentPropEditorType>
> = elementPlusAutoComponentLibraryList.reduce(
  (accumulator, item) => {
    const schemaEditorMap = (item.propSchema || []).reduce(
      (schemaAccumulator, schemaItem) => {
        schemaAccumulator[schemaItem.key] = schemaItem.editor
        return schemaAccumulator
      },
      {} as Record<string, ComponentPropEditorType>
    )

    accumulator[item.type] = schemaEditorMap
    return accumulator
  },
  {} as Record<string, Record<string, ComponentPropEditorType>>
)

function parseDelimitedList(rawValue: any, fallback: string[] = []) {
  if (Array.isArray(rawValue)) {
    const normalized = rawValue.map((item) => String(item).trim()).filter(Boolean)
    if (normalized.length) {
      return normalized
    }
    return fallback
  }

  if (typeof rawValue !== 'string') {
    return fallback
  }

  const normalized = rawValue
    .split(/\n|\||,/g)
    .map((item) => item.trim())
    .filter(Boolean)

  return normalized.length ? normalized : fallback
}

function parseJsonValue(rawValue: any) {
  if (typeof rawValue !== 'string') {
    return rawValue
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return undefined
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return rawValue
    }
  }

  return rawValue
}

function normalizeSwitchValue(rawValue: any) {
  if (typeof rawValue === 'boolean') {
    return rawValue
  }
  if (typeof rawValue === 'number') {
    return rawValue !== 0
  }
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  return Boolean(rawValue)
}

function normalizeNumberValue(rawValue: any) {
  const valueNumber = Number(rawValue)
  if (!Number.isFinite(valueNumber)) {
    return undefined
  }
  return valueNumber
}

function normalizeRuntimePropValue(rawValue: any, editor: ComponentPropEditorType | undefined) {
  if (editor === 'switch') {
    return normalizeSwitchValue(rawValue)
  }
  if (editor === 'number') {
    return normalizeNumberValue(rawValue)
  }
  if (editor === 'json') {
    return parseJsonValue(rawValue)
  }
  return rawValue
}

function buildInternalPropSet(binding: ElementPlusAutoRenderBinding | null) {
  const internalPropSet = new Set<string>()

  if (!binding) {
    return internalPropSet
  }

  if (binding.slotTextProp) {
    internalPropSet.add(binding.slotTextProp)
  }
  if (binding.optionItemsProp) {
    internalPropSet.add(binding.optionItemsProp)
  }
  if (binding.tableColumnKeysProp) {
    internalPropSet.add(binding.tableColumnKeysProp)
  }

  return internalPropSet
}

function getNodeBinding(type: string) {
  return autoBindingMap[type] || null
}

function getNodePropSchema(type: string): ComponentPropSchema[] {
  return autoComponentMetaMap[type]?.propSchema || []
}

function getNodeEditorMap(type: string) {
  return autoEditorMap[type] || {}
}

function getNodeDefaultProps(type: string) {
  return autoComponentMetaMap[type]?.defaultProps || {}
}

function isSameRuntimePropValue(leftValue: any, rightValue: any): boolean {
  if (leftValue === rightValue) {
    return true
  }

  if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
    if (
      !Array.isArray(leftValue) ||
      !Array.isArray(rightValue) ||
      leftValue.length !== rightValue.length
    ) {
      return false
    }
    return leftValue.every((item, index) => isSameRuntimePropValue(item, rightValue[index]))
  }

  if (leftValue && rightValue && typeof leftValue === 'object' && typeof rightValue === 'object') {
    const leftKeys = Object.keys(leftValue)
    const rightKeys = Object.keys(rightValue)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }
    return leftKeys.every((key) => isSameRuntimePropValue(leftValue[key], rightValue[key]))
  }

  return false
}

function resolveElementPlusAutoProps(
  node: CanvasComponentNode,
  options: { omitDefaultProps?: boolean } = {}
) {
  if (!isElementPlusAutoComponentType(node.type)) {
    return {}
  }

  const editorMap = getNodeEditorMap(node.type)
  const binding = getNodeBinding(node.type)
  const internalPropSet = buildInternalPropSet(binding)
  const defaultProps = getNodeDefaultProps(node.type)
  const runtimeProps: Record<string, any> = {}

  Object.entries(node.props || {}).forEach(([key, value]) => {
    if (internalPropSet.has(key)) {
      return
    }

    const editor = editorMap[key]
    const normalizedValue = normalizeRuntimePropValue(value, editor)
    if (typeof normalizedValue === 'undefined') {
      return
    }

    if (options.omitDefaultProps) {
      const normalizedDefaultValue = normalizeRuntimePropValue(defaultProps[key], editor)
      if (isSameRuntimePropValue(normalizedValue, normalizedDefaultValue)) {
        return
      }
    }

    runtimeProps[key] = normalizedValue
  })

  return runtimeProps
}

export const elementPlusAutoLibraryList = elementPlusAutoComponentLibraryList

export function isElementPlusAutoComponentType(type: string) {
  return Boolean(autoComponentMetaMap[type])
}

export function resolveElementPlusAutoBinding(type: string) {
  return getNodeBinding(type)
}

export function resolveElementPlusAutoTag(type: string) {
  return getNodeBinding(type)?.tag || ''
}

export function resolveElementPlusAutoRuntimeProps(node: CanvasComponentNode) {
  return resolveElementPlusAutoProps(node)
}

export function resolveElementPlusAutoSourceProps(node: CanvasComponentNode) {
  return resolveElementPlusAutoProps(node, { omitDefaultProps: true })
}

export function resolveElementPlusAutoSlotText(node: CanvasComponentNode) {
  const binding = getNodeBinding(node.type)
  if (!binding?.slotTextProp) {
    return ''
  }

  const rawValue = node.props?.[binding.slotTextProp]
  if (rawValue === null || typeof rawValue === 'undefined') {
    return ''
  }

  return String(rawValue)
}

export function resolveElementPlusAutoOptionItems(node: CanvasComponentNode) {
  const binding = getNodeBinding(node.type)
  if (!binding?.optionItemsProp) {
    return []
  }

  const fallbackItems = ['Option A', 'Option B']
  return parseDelimitedList(node.props?.[binding.optionItemsProp], fallbackItems)
}

export function resolveElementPlusAutoTableColumnKeys(
  node: CanvasComponentNode,
  runtimeProps: Record<string, any>
) {
  const binding = getNodeBinding(node.type)
  if (binding?.tableColumnKeysProp) {
    const customColumns = parseDelimitedList(node.props?.[binding.tableColumnKeysProp], [])
    if (customColumns.length) {
      return customColumns
    }
  }

  const tableData = runtimeProps.data
  if (
    Array.isArray(tableData) &&
    tableData.length &&
    typeof tableData[0] === 'object' &&
    tableData[0]
  ) {
    const derivedColumns = Object.keys(tableData[0]).filter(Boolean)
    if (derivedColumns.length) {
      return derivedColumns
    }
  }

  return ['col_1', 'col_2']
}

export function resolveElementPlusAutoTableData(runtimeProps: Record<string, any>) {
  const rawData = runtimeProps.data
  if (Array.isArray(rawData)) {
    return rawData
  }
  return []
}

export function resolveElementPlusAutoPropSchema(type: string) {
  return getNodePropSchema(type)
}
