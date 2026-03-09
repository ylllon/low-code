import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()
const WEB_TYPES_PATH = path.join(PROJECT_ROOT, 'node_modules', 'element-plus', 'web-types.json')
const OUTPUT_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'views',
  'PageLayoutView',
  'component-library.element-plus.generated.ts'
)

const PRESET_COMPONENTS = [
  {
    tag: 'el-button',
    type: 'epButton',
    name: 'EP Button',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Pointer',
    color: '#2563eb',
    icon: 'BT',
    defaultWidth: 168,
    defaultHeight: 56,
    defaultProps: {
      type: 'primary',
      size: 'default',
      slotText: 'Primary Button'
    },
    slotTextProp: 'slotText'
  },
  {
    tag: 'el-link',
    type: 'epLink',
    name: 'EP Link',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Document',
    color: '#2563eb',
    icon: 'LK',
    defaultWidth: 180,
    defaultHeight: 44,
    defaultProps: {
      type: 'primary',
      underline: true,
      slotText: 'View Details'
    },
    slotTextProp: 'slotText'
  },
  {
    tag: 'el-input',
    type: 'epInput',
    name: 'EP Input',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'EditPen',
    color: '#4f46e5',
    icon: 'IN',
    defaultWidth: 280,
    defaultHeight: 64,
    defaultProps: {
      placeholder: 'Please input',
      'model-value': ''
    }
  },
  {
    tag: 'el-input-number',
    type: 'epInputNumber',
    name: 'EP InputNumber',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'EditPen',
    color: '#4f46e5',
    icon: 'NM',
    defaultWidth: 220,
    defaultHeight: 64,
    defaultProps: {
      'model-value': 6,
      min: 0,
      max: 100,
      step: 1
    }
  },
  {
    tag: 'el-select',
    type: 'epSelect',
    name: 'EP Select',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'ArrowDown',
    color: '#4f46e5',
    icon: 'SE',
    defaultWidth: 280,
    defaultHeight: 64,
    defaultProps: {
      placeholder: 'Please select',
      optionItems: 'Option A|Option B|Option C'
    },
    optionItemsProp: 'optionItems'
  },
  {
    tag: 'el-cascader',
    type: 'epCascader',
    name: 'EP Cascader',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Operation',
    color: '#4f46e5',
    icon: 'CS',
    defaultWidth: 300,
    defaultHeight: 64,
    defaultProps: {
      placeholder: 'Please select',
      options: [
        {
          value: 'guide',
          label: 'Guide',
          children: [
            {
              value: 'design',
              label: 'Design'
            }
          ]
        }
      ]
    }
  },
  {
    tag: 'el-date-picker',
    type: 'epDatePicker',
    name: 'EP DatePicker',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Calendar',
    color: '#4f46e5',
    icon: 'DP',
    defaultWidth: 280,
    defaultHeight: 64,
    defaultProps: {
      type: 'date',
      placeholder: 'Pick a date'
    }
  },
  {
    tag: 'el-time-picker',
    type: 'epTimePicker',
    name: 'EP TimePicker',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Calendar',
    color: '#4f46e5',
    icon: 'TP',
    defaultWidth: 280,
    defaultHeight: 64,
    defaultProps: {
      placeholder: 'Pick a time'
    }
  },
  {
    tag: 'el-time-select',
    type: 'epTimeSelect',
    name: 'EP TimeSelect',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Calendar',
    color: '#4f46e5',
    icon: 'TS',
    defaultWidth: 280,
    defaultHeight: 64,
    defaultProps: {
      start: '08:00',
      step: '00:30',
      end: '18:00',
      placeholder: 'Pick a time'
    }
  },
  {
    tag: 'el-switch',
    type: 'epSwitch',
    name: 'EP Switch',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'SwitchFilled',
    color: '#4f46e5',
    icon: 'SW',
    defaultWidth: 220,
    defaultHeight: 56,
    defaultProps: {
      'model-value': true,
      'active-text': 'On',
      'inactive-text': 'Off'
    }
  },
  {
    tag: 'el-slider',
    type: 'epSlider',
    name: 'EP Slider',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Operation',
    color: '#4f46e5',
    icon: 'SL',
    defaultWidth: 300,
    defaultHeight: 56,
    defaultProps: {
      'model-value': 32,
      max: 100,
      step: 1
    }
  },
  {
    tag: 'el-rate',
    type: 'epRate',
    name: 'EP Rate',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Operation',
    color: '#4f46e5',
    icon: 'RT',
    defaultWidth: 260,
    defaultHeight: 56,
    defaultProps: {
      'model-value': 3
    }
  },
  {
    tag: 'el-color-picker',
    type: 'epColorPicker',
    name: 'EP ColorPicker',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'Operation',
    color: '#4f46e5',
    icon: 'CP',
    defaultWidth: 220,
    defaultHeight: 56,
    defaultProps: {
      'model-value': '#409eff'
    }
  },
  {
    tag: 'el-checkbox',
    type: 'epCheckbox',
    name: 'EP Checkbox',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'SwitchFilled',
    color: '#4f46e5',
    icon: 'CB',
    defaultWidth: 200,
    defaultHeight: 48,
    defaultProps: {
      'model-value': true,
      label: 'Checkbox'
    }
  },
  {
    tag: 'el-radio',
    type: 'epRadio',
    name: 'EP Radio',
    category: 'Element Plus / Form',
    previewType: 'form',
    iconKey: 'SwitchFilled',
    color: '#4f46e5',
    icon: 'RD',
    defaultWidth: 200,
    defaultHeight: 48,
    defaultProps: {
      'model-value': 'A',
      label: 'A'
    }
  },
  {
    tag: 'el-tag',
    type: 'epTag',
    name: 'EP Tag',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Grid',
    color: '#0f766e',
    icon: 'TG',
    defaultWidth: 160,
    defaultHeight: 44,
    defaultProps: {
      type: 'success',
      effect: 'light',
      slotText: 'Tag'
    },
    slotTextProp: 'slotText'
  },
  {
    tag: 'el-alert',
    type: 'epAlert',
    name: 'EP Alert',
    category: 'Element Plus / Feedback',
    previewType: 'data',
    iconKey: 'Document',
    color: '#b45309',
    icon: 'AL',
    defaultWidth: 320,
    defaultHeight: 76,
    defaultProps: {
      title: 'This is an alert',
      type: 'info',
      'show-icon': true,
      closable: false
    }
  },
  {
    tag: 'el-progress',
    type: 'epProgress',
    name: 'EP Progress',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Histogram',
    color: '#0f766e',
    icon: 'PG',
    defaultWidth: 300,
    defaultHeight: 56,
    defaultProps: {
      percentage: 56,
      'stroke-width': 10
    }
  },
  {
    tag: 'el-badge',
    type: 'epBadge',
    name: 'EP Badge',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Grid',
    color: '#0f766e',
    icon: 'BD',
    defaultWidth: 180,
    defaultHeight: 56,
    defaultProps: {
      value: 8,
      'is-dot': false,
      slotText: 'Message'
    },
    slotTextProp: 'slotText'
  },
  {
    tag: 'el-avatar',
    type: 'epAvatar',
    name: 'EP Avatar',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Picture',
    color: '#0f766e',
    icon: 'AV',
    defaultWidth: 120,
    defaultHeight: 120,
    defaultProps: {
      size: 56
    }
  },
  {
    tag: 'el-empty',
    type: 'epEmpty',
    name: 'EP Empty',
    category: 'Element Plus / Feedback',
    previewType: 'data',
    iconKey: 'Picture',
    color: '#b45309',
    icon: 'EM',
    defaultWidth: 320,
    defaultHeight: 220,
    defaultProps: {
      description: 'No Data'
    }
  },
  {
    tag: 'el-result',
    type: 'epResult',
    name: 'EP Result',
    category: 'Element Plus / Feedback',
    previewType: 'data',
    iconKey: 'Document',
    color: '#b45309',
    icon: 'RS',
    defaultWidth: 360,
    defaultHeight: 240,
    defaultProps: {
      icon: 'success',
      title: 'Success',
      'sub-title': 'Editable in the right panel'
    }
  },
  {
    tag: 'el-statistic',
    type: 'epStatistic',
    name: 'EP Statistic',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'TrendCharts',
    color: '#0f766e',
    icon: 'ST',
    defaultWidth: 220,
    defaultHeight: 88,
    defaultProps: {
      title: 'DAU',
      value: 12345
    }
  },
  {
    tag: 'el-pagination',
    type: 'epPagination',
    name: 'EP Pagination',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Grid',
    color: '#0f766e',
    icon: 'PN',
    defaultWidth: 360,
    defaultHeight: 64,
    defaultProps: {
      total: 120,
      'page-size': 10,
      layout: 'prev, pager, next'
    }
  },
  {
    tag: 'el-table',
    type: 'epTable',
    name: 'EP Table',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Grid',
    color: '#0f766e',
    icon: 'TB',
    defaultWidth: 420,
    defaultHeight: 260,
    defaultProps: {
      border: true,
      stripe: true,
      data: [
        { name: 'Alice', role: 'Operator' },
        { name: 'Bob', role: 'Developer' }
      ],
      columnKeys: 'name|role'
    },
    tableColumnKeysProp: 'columnKeys'
  },
  {
    tag: 'el-card',
    type: 'epCard',
    name: 'EP Card',
    category: 'Element Plus / Container',
    previewType: 'container',
    iconKey: 'Postcard',
    color: '#0ea5e9',
    icon: 'CD',
    defaultWidth: 340,
    defaultHeight: 220,
    defaultProps: {
      header: 'Card Header',
      shadow: 'never',
      slotText: 'Card Content'
    },
    slotTextProp: 'slotText'
  },
  {
    tag: 'el-divider',
    type: 'epDivider',
    name: 'EP Divider',
    category: 'Element Plus / Container',
    previewType: 'container',
    iconKey: 'Minus',
    color: '#0ea5e9',
    icon: 'DV',
    defaultWidth: 320,
    defaultHeight: 36,
    defaultProps: {
      direction: 'horizontal',
      'content-position': 'center',
      slotText: 'Divider'
    },
    slotTextProp: 'slotText'
  },
  {
    tag: 'el-segmented',
    type: 'epSegmented',
    name: 'EP Segmented',
    category: 'Element Plus / Data',
    previewType: 'data',
    iconKey: 'Operation',
    color: '#0f766e',
    icon: 'SG',
    defaultWidth: 260,
    defaultHeight: 56,
    defaultProps: {
      options: ['Day', 'Week', 'Month'],
      'model-value': 'Day'
    }
  }
]

const GROUP_ORDER = 7
const PREVIEW_STYLE = {
  color: '#1f2937',
  backgroundColor: '#ffffff',
  borderRadius: 8,
  fontSize: 14
}

function normalizeText(rawText) {
  if (!rawText) {
    return ''
  }

  return String(rawText)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isValidPropName(name) {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)
}

function normalizeTypeTokens(rawType) {
  if (!Array.isArray(rawType)) {
    return []
  }

  return rawType
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim()
      }
      if (item && typeof item === 'object') {
        if (typeof item.name === 'string') {
          return item.name
        }
        return 'object'
      }
      return ''
    })
    .filter(Boolean)
}

function extractLiteralValue(rawValue) {
  const value = rawValue.trim()
  if (!value) {
    return undefined
  }

  const stringMatch = value.match(/^'(.*)'$/) || value.match(/^"(.*)"$/)
  if (stringMatch) {
    return stringMatch[1]
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value)
  }

  return undefined
}

function parseEnumOptions(typeTokens) {
  const optionValues = []

  typeTokens.forEach((token) => {
    const segments = token.includes('|') ? token.split('|') : [token]
    segments.forEach((segment) => {
      const literal = extractLiteralValue(segment)
      if (typeof literal === 'undefined') {
        return
      }
      if (typeof literal === 'string' && (literal === 'true' || literal === 'false')) {
        return
      }
      optionValues.push(literal)
    })
  })

  const uniqueValues = []
  const seenValues = new Set()

  optionValues.forEach((value) => {
    const token = `${typeof value}:${String(value)}`
    if (!seenValues.has(token)) {
      seenValues.add(token)
      uniqueValues.push(value)
    }
  })

  if (uniqueValues.length < 2 || uniqueValues.length > 14) {
    return []
  }

  return uniqueValues.map((value) => ({
    label: String(value || '(empty)'),
    value
  }))
}

function inferEditor(propName, typeTokens, enumOptions) {
  const normalized = typeTokens.map((token) => token.toLowerCase())
  const normalizedPropName = propName.toLowerCase()
  const hasBoolean = normalized.includes('boolean')
  const hasNumber = normalized.includes('number')
  const hasString = normalized.includes('string')
  const hasObjectLike = normalized.some((token) => {
    return (
      token.includes('object') ||
      token.includes('array') ||
      token.includes('record') ||
      token.includes('map') ||
      token.includes('function') ||
      token.includes('{') ||
      token.includes('component')
    )
  })
  const hasComplexCustomToken = normalized.some((token) => {
    return (
      !token.includes('string') &&
      !token.includes('number') &&
      !token.includes('boolean') &&
      !token.includes('null') &&
      !token.includes('undefined') &&
      !token.includes("'")
    )
  })

  if (enumOptions.length) {
    return 'select'
  }

  if (
    normalizedPropName === 'data' ||
    normalizedPropName === 'options' ||
    normalizedPropName === 'model' ||
    normalizedPropName === 'rules' ||
    normalizedPropName === 'columns' ||
    normalizedPropName.endsWith('-options') ||
    normalizedPropName.endsWith('-list') ||
    normalizedPropName.endsWith('-map')
  ) {
    return 'json'
  }

  if (propName.endsWith('modifiers') || hasObjectLike) {
    return 'json'
  }

  if (hasComplexCustomToken && !hasString && !hasNumber && !hasBoolean) {
    return 'json'
  }

  if (hasBoolean && !hasNumber && !hasString) {
    return 'switch'
  }

  if (hasNumber && !hasString && !hasBoolean) {
    return 'number'
  }

  return 'input'
}

function parseDefaultValue(rawDefault, editor, enumOptions) {
  if (typeof rawDefault === 'undefined' || rawDefault === null) {
    return undefined
  }

  const text = String(rawDefault).trim()
  if (!text) {
    return undefined
  }

  if (text === 'true') {
    return true
  }

  if (text === 'false') {
    return false
  }

  if (text === 'null') {
    return null
  }

  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text)
  }

  if (text === 'Number.MIN_SAFE_INTEGER') {
    return Number.MIN_SAFE_INTEGER
  }

  if (text === 'Number.MAX_SAFE_INTEGER') {
    return Number.MAX_SAFE_INTEGER
  }

  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      return JSON.parse(text)
    } catch {
      if (editor === 'json') {
        return text
      }
      return undefined
    }
  }

  const literal = extractLiteralValue(text)
  if (typeof literal !== 'undefined') {
    return literal
  }

  if (editor === 'select') {
    const option = enumOptions.find((item) => String(item.value) === text)
    if (option) {
      return option.value
    }
  }

  return undefined
}

function toPropLabel(name) {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function buildPlaceholder(description) {
  const text = normalizeText(description)
  if (!text) {
    return undefined
  }
  if (text.length <= 48) {
    return text
  }
  return `${text.slice(0, 46)}...`
}

function buildComponentMetaMap() {
  const webTypes = JSON.parse(fs.readFileSync(WEB_TYPES_PATH, 'utf8'))
  const componentList = webTypes?.contributions?.html?.['vue-components'] || []
  const map = new Map()

  componentList.forEach((item) => {
    if (item && typeof item.name === 'string') {
      map.set(item.name, item)
    }
  })

  return map
}

function buildSchemaFromProps(rawProps, customPropNameSet) {
  const schemaList = []
  const inferredDefaults = {}
  const usedKeys = new Set(customPropNameSet)

  ;(rawProps || []).forEach((prop) => {
    const propName = typeof prop?.name === 'string' ? prop.name.trim() : ''
    if (!propName || !isValidPropName(propName) || usedKeys.has(propName)) {
      return
    }

    usedKeys.add(propName)
    const typeTokens = normalizeTypeTokens(prop.type)
    const enumOptions = parseEnumOptions(typeTokens)
    const editor = inferEditor(propName, typeTokens, enumOptions)
    const placeholder = editor === 'switch' || editor === 'number' || editor === 'select' ? undefined : buildPlaceholder(prop.description)
    const schema = {
      key: propName,
      label: toPropLabel(propName),
      editor
    }

    if (placeholder) {
      schema.placeholder = placeholder
    }

    if (editor === 'select' && enumOptions.length) {
      schema.options = enumOptions
    }

    schemaList.push(schema)

    const parsedDefault = parseDefaultValue(prop.default, editor, enumOptions)
    if (typeof parsedDefault !== 'undefined') {
      inferredDefaults[propName] = parsedDefault
    }
  })

  return {
    schemaList,
    inferredDefaults
  }
}

function buildExtraSchemaForPreset(preset) {
  const schemaList = []
  const customPropNameSet = new Set()

  if (preset.slotTextProp) {
    customPropNameSet.add(preset.slotTextProp)
    schemaList.push({
      key: preset.slotTextProp,
      label: 'Slot Text',
      editor: 'input',
      placeholder: 'Default slot content'
    })
  }

  if (preset.optionItemsProp) {
    customPropNameSet.add(preset.optionItemsProp)
    schemaList.push({
      key: preset.optionItemsProp,
      label: 'Option Items',
      editor: 'textarea',
      placeholder: 'Use line break or | as separator'
    })
  }

  if (preset.tableColumnKeysProp) {
    customPropNameSet.add(preset.tableColumnKeysProp)
    schemaList.push({
      key: preset.tableColumnKeysProp,
      label: 'Column Keys',
      editor: 'input',
      placeholder: 'Example: name|role|status'
    })
  }

  return {
    schemaList,
    customPropNameSet
  }
}

function buildOutput() {
  const componentMetaMap = buildComponentMetaMap()
  const componentList = []
  const bindingList = []
  const unresolvedComponents = []

  PRESET_COMPONENTS.forEach((preset) => {
    const webMeta = componentMetaMap.get(preset.tag)
    if (!webMeta) {
      unresolvedComponents.push(preset.tag)
      return
    }

    const extraSchema = buildExtraSchemaForPreset(preset)
    const propResult = buildSchemaFromProps(webMeta.props, extraSchema.customPropNameSet)
    const editorMap = [...extraSchema.schemaList, ...propResult.schemaList].reduce((accumulator, item) => {
      accumulator[item.key] = item.editor
      return accumulator
    }, {})
    const mergedDefaultProps = {
      ...propResult.inferredDefaults,
      ...(preset.defaultProps || {})
    }
    const defaultProps = Object.entries(mergedDefaultProps).reduce((accumulator, [key, value]) => {
      const editor = editorMap[key]
      if (editor === 'json' && typeof value !== 'string') {
        try {
          accumulator[key] = JSON.stringify(value, null, 2)
        } catch {
          accumulator[key] = String(value)
        }
        return accumulator
      }
      accumulator[key] = value
      return accumulator
    }, {})
    const descriptionFromMeta = normalizeText(webMeta.description)
    const fallbackDescription = `Auto integrated ${preset.tag} with props from Element Plus web-types.`
    const componentMeta = {
      type: preset.type,
      name: preset.name,
      description: descriptionFromMeta || fallbackDescription,
      category: preset.category,
      groupOrder: GROUP_ORDER,
      previewType: preset.previewType,
      iconKey: preset.iconKey,
      color: preset.color,
      icon: preset.icon,
      defaultWidth: preset.defaultWidth,
      defaultHeight: preset.defaultHeight,
      defaultProps,
      defaultStyle: PREVIEW_STYLE,
      propSchema: [...extraSchema.schemaList, ...propResult.schemaList]
    }

    componentList.push(componentMeta)
    bindingList.push({
      type: preset.type,
      tag: preset.tag,
      slotTextProp: preset.slotTextProp || null,
      optionItemsProp: preset.optionItemsProp || null,
      tableColumnKeysProp: preset.tableColumnKeysProp || null
    })
  })

  if (unresolvedComponents.length) {
    console.warn('[generate-element-plus-auto-library] Missing components:', unresolvedComponents.join(', '))
  }

  const fileContent = `import type { LibraryComponentMeta } from './component-library.types'

/**
 * Auto-generated by scripts/generate-element-plus-auto-library.mjs
 * Data source: node_modules/element-plus/web-types.json
 */
export interface ElementPlusAutoRenderBinding {
  type: string
  tag: string
  slotTextProp: string | null
  optionItemsProp: string | null
  tableColumnKeysProp: string | null
}

export const elementPlusAutoComponentLibraryList: LibraryComponentMeta[] = ${JSON.stringify(componentList, null, 2)} as LibraryComponentMeta[]

export const elementPlusAutoRenderBindingList: ElementPlusAutoRenderBinding[] = ${JSON.stringify(bindingList, null, 2)} as ElementPlusAutoRenderBinding[]
`

  fs.writeFileSync(OUTPUT_PATH, fileContent, 'utf8')
  console.log(`[generate-element-plus-auto-library] Generated ${componentList.length} components -> ${OUTPUT_PATH}`)
}

buildOutput()
