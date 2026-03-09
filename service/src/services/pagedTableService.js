// Mock paged-table data service for low-code pagination testing.
// This module is intentionally dependency-free and deterministic.

const TOTAL_MOCK_ROWS = 137

const STATUS_POOL = ['enabled', 'disabled', 'pending']
const DEPARTMENT_POOL = ['Product', 'Engineering', 'Operations', 'Sales', 'Support']

function clampInteger(rawValue, fallback, minValue, maxValue) {
  const valueNum = Number(rawValue)
  if (!Number.isFinite(valueNum)) {
    return fallback
  }
  return Math.min(Math.max(Math.round(valueNum), minValue), maxValue)
}

function normalizeString(rawValue, fallback = '') {
  const text = typeof rawValue === 'string' ? rawValue.trim() : ''
  return text || fallback
}

function normalizePath(pathText) {
  return String(pathText || '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function setByPath(target, pathText, value) {
  const segments = normalizePath(pathText)
  if (!segments.length) {
    return
  }

  let current = target
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1
    if (isLast) {
      current[segment] = value
      return
    }
    if (!current[segment] || typeof current[segment] !== 'object' || Array.isArray(current[segment])) {
      current[segment] = {}
    }
    current = current[segment]
  })
}

function getQueryValue(query, aliases, fallback) {
  for (const alias of aliases) {
    if (typeof query[alias] !== 'undefined' && query[alias] !== null && String(query[alias]).trim()) {
      return query[alias]
    }
  }
  return fallback
}

function buildMockRow(index) {
  const id = index + 1
  return {
    id,
    name: `User-${id}`,
    age: 20 + (id % 21),
    email: `user${id}@example.com`,
    department: DEPARTMENT_POOL[id % DEPARTMENT_POOL.length],
    status: STATUS_POOL[id % STATUS_POOL.length],
    score: 60 + (id % 41),
    createdAt: `2026-01-${String((id % 28) + 1).padStart(2, '0')}`
  }
}

const MOCK_DATASET = Array.from({ length: TOTAL_MOCK_ROWS }).map((_, index) => buildMockRow(index))

function filterDataset(dataset, keyword) {
  const normalizedKeyword = normalizeString(keyword).toLowerCase()
  if (!normalizedKeyword) {
    return dataset
  }

  return dataset.filter((row) => {
    return Object.values(row).some((value) => String(value).toLowerCase().includes(normalizedKeyword))
  })
}

function buildPagedData(query) {
  const requestedCurrent = clampInteger(getQueryValue(query, ['current', 'page', 'pageNum'], 1), 1, 1, 100000)
  const requestedSize = clampInteger(getQueryValue(query, ['size', 'pageSize', 'limit'], 10), 10, 1, 200)
  const keyword = getQueryValue(query, ['keyword', 'search'], '')
  const filteredDataset = filterDataset(MOCK_DATASET, keyword)
  const total = filteredDataset.length
  const pages = Math.max(1, Math.ceil(total / requestedSize))
  const current = Math.min(Math.max(1, requestedCurrent), pages)
  const start = (current - 1) * requestedSize
  const records = filteredDataset.slice(start, start + requestedSize)

  return {
    records,
    total,
    size: requestedSize,
    current,
    pages
  }
}

function buildPagedTableResponse(query = {}) {
  const pagedData = buildPagedData(query)

  const recordsKey = normalizeString(getQueryValue(query, ['recordsKey'], 'records'), 'records')
  const totalKey = normalizeString(getQueryValue(query, ['totalKey'], 'total'), 'total')
  const sizeKey = normalizeString(getQueryValue(query, ['sizeKey'], 'size'), 'size')
  const currentKey = normalizeString(getQueryValue(query, ['currentKey'], 'current'), 'current')
  const pagesKey = normalizeString(getQueryValue(query, ['pagesKey'], 'pages'), 'pages')

  const dataPath = normalizeString(getQueryValue(query, ['dataPath'], 'data'), 'data')
  const codeKey = normalizeString(getQueryValue(query, ['codeKey'], 'code'), 'code')
  const messageKey = normalizeString(getQueryValue(query, ['messageKey'], 'message'), 'message')

  const businessCode = clampInteger(getQueryValue(query, ['code'], 200), 200, -999999, 999999)
  const message = normalizeString(getQueryValue(query, ['message'], 'Success'), 'Success')

  const body = {}
  body[codeKey] = businessCode
  body[messageKey] = message

  const payload = {}
  payload[recordsKey] = pagedData.records
  payload[totalKey] = pagedData.total
  payload[sizeKey] = pagedData.size
  payload[currentKey] = pagedData.current
  payload[pagesKey] = pagedData.pages

  setByPath(body, dataPath, payload)

  return body
}

module.exports = {
  buildPagedTableResponse
}
