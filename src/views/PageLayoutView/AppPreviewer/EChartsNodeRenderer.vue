<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ECharts } from 'echarts'
import * as echarts from 'echarts'
import { resolveChartOption } from '@/views/PageLayoutView/AppPreviewer/echarts-option.utils'

const props = defineProps<{
  chartType: 'barChart' | 'lineChart' | 'pieChart' | 'gaugeChart' | 'customChart'
  titleText?: string
  demoData?: string
  maxValue?: number
  chartOption?: string
}>()

const containerRef = ref<HTMLElement | null>(null)
let chartInstance: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const chartOption = computed(() => {
  return resolveChartOption({
    chartType: props.chartType,
    titleText: props.titleText,
    demoData: props.demoData,
    maxValue: props.maxValue,
    chartOption: props.chartOption
  })
})

function ensureChartInstance() {
  if (!containerRef.value) {
    return
  }

  if (!chartInstance) {
    chartInstance = echarts.init(containerRef.value)
  }
}

function renderChart() {
  ensureChartInstance()
  if (!chartInstance) {
    return
  }

  chartInstance.setOption(chartOption.value, true)
}

function resizeChart() {
  chartInstance?.resize()
}

onMounted(() => {
  renderChart()

  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeChart()
    })
    resizeObserver.observe(containerRef.value)
  }
})

watch(chartOption, () => {
  nextTick(() => {
    renderChart()
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null

  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<template>
  <div ref="containerRef" class="echarts-node-renderer"></div>
</template>

<style scoped>
.echarts-node-renderer {
  width: 100%;
  height: 100%;
}
</style>
