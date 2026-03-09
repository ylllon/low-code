<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { CanvasComponentNode } from '@/views/PageLayoutView/component-library'
import {
  buildPagedTableRows,
  mapPagedTablePayload,
  parsePagedTableColumnSchema,
  toSafeInt,
  tryParseJson
} from '@/views/PageLayoutView/AppPreviewer/paged-table.utils'

const props = defineProps<{
  node: CanvasComponentNode
}>()

interface PagedTableState {
  rows: Array<Record<string, any>>
  total: number
  size: number
  current: number
  pages: number
  loading: boolean
  errorMessage: string
}

const tableState = reactive<PagedTableState>({
  rows: [],
  total: 0,
  size: 10,
  current: 1,
  pages: 1,
  loading: false,
  errorMessage: ''
})

const responseMapping = computed(() => {
  const rawProps = props.node.props || {}
  return {
    recordsPath: String(rawProps.recordsPath || 'obj.data.records'),
    totalPath: String(rawProps.totalPath || 'obj.data.total'),
    sizePath: String(rawProps.sizePath || 'obj.data.size'),
    currentPath: String(rawProps.currentPath || 'obj.data.current'),
    pagesPath: String(rawProps.pagesPath || 'obj.data.pages')
  }
})

const columnSchema = computed(() => {
  const rawProps = props.node.props || {}
  return parsePagedTableColumnSchema(rawProps.columnSchema, String(rawProps.columns || ''))
})

const tableColumns = computed(() => {
  return columnSchema.value.map((column) => {
    return {
      key: column.key,
      label: column.label,
      minWidth: Number.isFinite(Number(column.minWidth)) ? Number(column.minWidth) : 96
    }
  })
})

const pageSizeOptions = computed(() => {
  const rawValue = props.node.props?.pageSizeOptions
  if (typeof rawValue !== 'string') {
    return [10, 20, 50, 100]
  }

  const parsedList = rawValue
    .split(/\||,|\s+/g)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.round(item))

  return parsedList.length ? Array.from(new Set(parsedList)) : [10, 20, 50, 100]
})

const paginationLayout = computed(() => {
  return String(props.node.props?.paginationLayout || 'total, sizes, prev, pager, next')
})

function resolveSourceType() {
  return String(props.node.props?.dataSourceType || 'SELF').toUpperCase()
}

function parseRequestBody(rawValue: any) {
  const parsed = tryParseJson(rawValue)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return { ...parsed }
  }
  return {}
}

function buildRestRequestConfig(targetPage: number, targetSize: number) {
  const restUrl = String(props.node.props?.restUrl || '').trim()
  const restMethod = String(props.node.props?.restMethod || 'GET').trim().toUpperCase()
  const pageParamKey = String(props.node.props?.pageParamKey || 'current').trim() || 'current'
  const sizeParamKey = String(props.node.props?.sizeParamKey || 'size').trim() || 'size'
  const requestUrl = new URL(restUrl, window.location.origin)
  const requestInit: RequestInit = {
    method: restMethod
  }

  if (restMethod === 'GET') {
    requestUrl.searchParams.set(pageParamKey, String(targetPage))
    requestUrl.searchParams.set(sizeParamKey, String(targetSize))
  } else {
    const body = parseRequestBody(props.node.props?.restBody)
    body[pageParamKey] = targetPage
    body[sizeParamKey] = targetSize
    requestInit.headers = {
      'Content-Type': 'application/json'
    }
    requestInit.body = JSON.stringify(body)
  }

  return {
    url: requestUrl.toString(),
    requestInit
  }
}

async function fetchPagedPayloadFromRest(targetPage: number, targetSize: number) {
  const restUrl = String(props.node.props?.restUrl || '').trim()
  if (!restUrl) {
    throw new Error('REST URL is empty.')
  }

  const requestConfig = buildRestRequestConfig(targetPage, targetSize)
  const response = await fetch(requestConfig.url, requestConfig.requestInit)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

function resolveLocalPayload() {
  const parsed = tryParseJson(props.node.props?.demoData)
  if (Array.isArray(parsed)) {
    return parsed
  }
  if (parsed && typeof parsed === 'object') {
    return parsed
  }
  return {
    code: 200,
    message: 'Success',
    data: {
      records: [],
      total: 0,
      size: tableState.size,
      current: tableState.current,
      pages: 1
    }
  }
}

function applyPayload(rawPayload: any, fallbackPage: number, fallbackSize: number) {
  const mapped = mapPagedTablePayload(rawPayload, responseMapping.value, fallbackPage, fallbackSize)
  const normalizedColumns = columnSchema.value
  tableState.rows = buildPagedTableRows(mapped.records, normalizedColumns, rawPayload)
  tableState.total = mapped.total
  tableState.size = Math.max(1, mapped.size)
  tableState.current = Math.max(1, mapped.current)
  tableState.pages = Math.max(1, mapped.pages)
}

async function loadPagedData(targetPage?: number) {
  const configuredSize = Math.max(1, toSafeInt(props.node.props?.pageSize, 10, 1))
  const fallbackSize = Math.max(1, toSafeInt(tableState.size, configuredSize, 1))
  const nextPage = Math.max(1, toSafeInt(targetPage, toSafeInt(props.node.props?.currentPage, tableState.current, 1), 1))

  tableState.loading = true
  tableState.errorMessage = ''

  try {
    const sourceType = resolveSourceType()
    const payload =
      sourceType === 'REST'
        ? await fetchPagedPayloadFromRest(nextPage, fallbackSize)
        : resolveLocalPayload()
    applyPayload(payload, nextPage, fallbackSize)
  } catch (error: any) {
    tableState.errorMessage = error?.message || 'Failed to load paged table data.'
    tableState.rows = []
    tableState.total = 0
    tableState.pages = 1
  } finally {
    tableState.loading = false
  }
}

function onCurrentChange(nextPage: number) {
  void loadPagedData(nextPage)
}

function onSizeChange(nextSize: number) {
  const normalizedSize = Math.max(1, Number(nextSize) || 10)
  tableState.size = normalizedSize
  void loadPagedData(1)
}

const reloadFingerprint = computed(() => {
  return JSON.stringify({
    dataSourceType: props.node.props?.dataSourceType || 'SELF',
    demoData: props.node.props?.demoData || '',
    restUrl: props.node.props?.restUrl || '',
    restMethod: props.node.props?.restMethod || 'GET',
    restBody: props.node.props?.restBody || '',
    recordsPath: responseMapping.value.recordsPath,
    totalPath: responseMapping.value.totalPath,
    sizePath: responseMapping.value.sizePath,
    currentPath: responseMapping.value.currentPath,
    pagesPath: responseMapping.value.pagesPath,
    pageParamKey: props.node.props?.pageParamKey || 'current',
    sizeParamKey: props.node.props?.sizeParamKey || 'size',
    columnSchema: props.node.props?.columnSchema || '',
    columns: props.node.props?.columns || '',
    pageSize: props.node.props?.pageSize || '',
    currentPage: props.node.props?.currentPage || '',
    pageSizeOptions: props.node.props?.pageSizeOptions || '',
    paginationLayout: props.node.props?.paginationLayout || ''
  })
})

watch(
  reloadFingerprint,
  () => {
    tableState.size = Math.max(1, toSafeInt(props.node.props?.pageSize, tableState.size || 10, 1))
    tableState.current = Math.max(1, toSafeInt(props.node.props?.currentPage, tableState.current || 1, 1))
    void loadPagedData()
  },
  {
    immediate: true
  }
)
</script>

<template>
  <div class="paged-table-node">
    <el-alert
      v-if="tableState.errorMessage"
      type="warning"
      :closable="false"
      :title="`分页数据加载失败：${tableState.errorMessage}`"
      class="paged-table-alert"
    />

    <el-table
      :data="tableState.rows"
      border
      stripe
      size="small"
      height="100%"
      v-loading="tableState.loading"
      class="paged-table-grid"
    >
      <el-table-column
        v-for="column in tableColumns"
        :key="column.key"
        :prop="column.key"
        :label="column.label"
        :min-width="column.minWidth"
        show-overflow-tooltip
      />
    </el-table>

    <div class="paged-table-pagination">
      <el-pagination
        :current-page="tableState.current"
        :page-size="tableState.size"
        :total="tableState.total"
        :layout="paginationLayout"
        :page-sizes="pageSizeOptions"
        small
        @current-change="onCurrentChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.paged-table-node {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.paged-table-alert {
  margin-bottom: 0;
}

.paged-table-grid {
  flex: 1;
  min-height: 80px;
}

.paged-table-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 30px;
}
</style>
