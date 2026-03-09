export interface PagedTableColumnSchemaItem {
  key: string
  label: string
  valueExpr: string
  minWidth?: number
}

export interface PagedTablePathMapping {
  recordsPath: string
  totalPath: string
  sizePath: string
  currentPath: string
  pagesPath: string
}

export interface PagedTableMappedResult {
  records: any[]
  total: number
  size: number
  current: number
  pages: number
}

function isObjectRecord(input: any): input is Record<string, any> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input)
}

export function toSafeInt(value: any, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const valueNum = Number(value)
  if (!Number.isFinite(valueNum)) {
    return fallback
  }
  return Math.min(Math.max(Math.round(valueNum), min), max)
}

export function tryParseJson(rawValue: any) {
  if (typeof rawValue !== 'string') {
    return rawValue
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return rawValue
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return rawValue
  }
}

function normalizePathExpression(pathExpr: string, rootToken: string) {
  const trimmed = String(pathExpr || '').trim()
  if (!trimmed) {
    return []
  }

  const unwrapped =
    trimmed.startsWith('${') && trimmed.endsWith('}') ? trimmed.slice(2, -1).trim() : trimmed
  const withoutRoot = unwrapped.startsWith(`${rootToken}.`)
    ? unwrapped.slice(rootToken.length + 1)
    : unwrapped

  return withoutRoot
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function resolveValueByPath(rootValue: any, pathExpr: string, rootToken = 'obj') {
  const segments = normalizePathExpression(pathExpr, rootToken)
  if (!segments.length) {
    return rootValue
  }

  return segments.reduce((currentValue, segment) => {
    if (currentValue === null || typeof currentValue === 'undefined') {
      return undefined
    }
    if (Array.isArray(currentValue)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0) {
        return undefined
      }
      return currentValue[index]
    }
    if (typeof currentValue !== 'object') {
      return undefined
    }
    return (currentValue as Record<string, any>)[segment]
  }, rootValue)
}

function resolveValueFromScope(pathExpr: string, scope: Record<string, any>) {
  const expr = String(pathExpr || '').trim()
  if (!expr) {
    return ''
  }

  const unwrapped = expr.startsWith('${') && expr.endsWith('}') ? expr.slice(2, -1).trim() : expr
  if (unwrapped.startsWith('row.') || unwrapped === 'row') {
    return resolveValueByPath(scope.row, unwrapped, 'row')
  }
  if (unwrapped.startsWith('obj.') || unwrapped === 'obj') {
    return resolveValueByPath(scope.obj, unwrapped, 'obj')
  }

  // Backward compatible: if caller writes "data.records" treat it as obj path.
  return resolveValueByPath(scope.obj, unwrapped, 'obj')
}

export function evaluateTemplateValue(template: any, scope: { row: any; obj: any }) {
  if (typeof template !== 'string') {
    return template
  }

  const trimmed = template.trim()
  if (!trimmed) {
    return ''
  }

  const fullExprMatch = trimmed.match(/^\$\{([^}]+)\}$/)
  if (fullExprMatch) {
    const resolved = resolveValueFromScope(fullExprMatch[1], scope)
    return typeof resolved === 'undefined' ? '' : resolved
  }

  return template.replace(/\$\{([^}]+)\}/g, (_, expression) => {
    const resolved = resolveValueFromScope(expression, scope)
    if (resolved === null || typeof resolved === 'undefined') {
      return ''
    }
    return String(resolved)
  })
}

function fallbackFieldKey(index: number) {
  return `col_${index + 1}`
}

function normalizeLabelToFieldKey(label: string, index: number) {
  const normalized = String(label || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
  return normalized || fallbackFieldKey(index)
}

function parseDelimitedText(rawValue: any) {
  if (typeof rawValue !== 'string') {
    return []
  }
  return rawValue
    .split(/\n|\||,/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function parsePagedTableColumnSchema(rawValue: any, fallbackColumnsText = ''): PagedTableColumnSchemaItem[] {
  const parsed = tryParseJson(rawValue)
  if (Array.isArray(parsed) && parsed.length) {
    const rows = parsed
      .filter((item) => isObjectRecord(item))
      .map((item, index) => {
        const label = String(item.label || item.key || `Column ${index + 1}`).trim()
        const key = String(item.key || normalizeLabelToFieldKey(label, index)).trim()
        const valueExpr = String(item.valueExpr || item.value || `\${row.${key}}`).trim()
        const minWidth = Number(item.minWidth)
        return {
          key: key || fallbackFieldKey(index),
          label: label || `Column ${index + 1}`,
          valueExpr: valueExpr || `\${row.${key || fallbackFieldKey(index)}}`,
          minWidth: Number.isFinite(minWidth) ? Math.max(60, Math.round(minWidth)) : undefined
        }
      })

    if (rows.length) {
      return rows
    }
  }

  const fallbackColumns = parseDelimitedText(fallbackColumnsText)
  if (fallbackColumns.length) {
    return fallbackColumns.map((label, index) => {
      const key = normalizeLabelToFieldKey(label, index)
      return {
        key,
        label,
        valueExpr: `\${row.${key}}`
      }
    })
  }

  return [
    {
      key: 'id',
      label: 'ID',
      valueExpr: '${row.id}'
    },
    {
      key: 'name',
      label: 'Name',
      valueExpr: '${row.name}'
    }
  ]
}

export function mapPagedTablePayload(
  rawPayload: any,
  mapping: PagedTablePathMapping,
  fallbackCurrent: number,
  fallbackSize: number
): PagedTableMappedResult {
  const payload = rawPayload
  if (Array.isArray(payload)) {
    const total = payload.length
    const normalizedSize = Math.max(1, fallbackSize || total || 10)
    const normalizedCurrent = Math.max(1, fallbackCurrent || 1)
    const pages = Math.max(1, Math.ceil(total / normalizedSize))
    return {
      records: payload,
      total,
      size: normalizedSize,
      current: normalizedCurrent,
      pages
    }
  }

  const recordsCandidate = resolveValueByPath(payload, mapping.recordsPath, 'obj')
  const records = Array.isArray(recordsCandidate) ? recordsCandidate : []
  const totalCandidate = resolveValueByPath(payload, mapping.totalPath, 'obj')
  const sizeCandidate = resolveValueByPath(payload, mapping.sizePath, 'obj')
  const currentCandidate = resolveValueByPath(payload, mapping.currentPath, 'obj')
  const pagesCandidate = resolveValueByPath(payload, mapping.pagesPath, 'obj')

  const total = toSafeInt(totalCandidate, records.length, 0)
  const size = Math.max(1, toSafeInt(sizeCandidate, fallbackSize || records.length || 10, 1))
  const current = Math.max(1, toSafeInt(currentCandidate, fallbackCurrent || 1, 1))
  const pages = Math.max(1, toSafeInt(pagesCandidate, Math.ceil(total / size) || 1, 1))

  return {
    records,
    total,
    size,
    current,
    pages
  }
}

export function buildPagedTableRows(records: any[], columns: PagedTableColumnSchemaItem[], rawPayload: any) {
  return records.map((rowItem) => {
    const rowResult: Record<string, any> = {}
    columns.forEach((column) => {
      rowResult[column.key] = evaluateTemplateValue(column.valueExpr, {
        row: rowItem,
        obj: rawPayload
      })
    })
    return rowResult
  })
}

