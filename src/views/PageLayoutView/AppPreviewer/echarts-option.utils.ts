import type { EChartsCoreOption } from 'echarts'
import type { CanvasComponentNode } from '@/views/PageLayoutView/component-library'

export type ChartNodeType = 'barChart' | 'lineChart' | 'pieChart' | 'gaugeChart' | 'customChart'

interface ChartDataItem {
  name: string
  value: number
}

interface ChartOptionBuildInput {
  chartType: ChartNodeType
  titleText?: any
  demoData?: any
  maxValue?: any
  chartOption?: any
}

interface ChartOptionErrorLocation {
  line: number | null
  column: number | null
}

interface JsParseResult {
  value: unknown
  error: unknown
  location: ChartOptionErrorLocation
}

export interface ChartOptionValidationResult {
  valid: boolean
  mode: 'empty' | 'json' | 'js' | 'invalid'
  message: string
  line: number | null
  column: number | null
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'unknown error')
}

function toLineColumnByIndex(text: string, index: number): ChartOptionErrorLocation {
  const safeIndex = Math.max(0, Math.min(index, text.length))
  const before = text.slice(0, safeIndex)
  const line = before.split('\n').length
  const lastBreak = before.lastIndexOf('\n')
  const column = safeIndex - lastBreak
  return {
    line,
    column
  }
}

function parseJsonErrorLocation(text: string, error: unknown): ChartOptionErrorLocation {
  const message = getErrorMessage(error)

  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1]) || null,
      column: Number(lineColumnMatch[2]) || null
    }
  }

  const positionMatch = message.match(/position\s+(\d+)/i)
  if (positionMatch) {
    const index = Number(positionMatch[1])
    if (Number.isFinite(index)) {
      return toLineColumnByIndex(text, index)
    }
  }

  return {
    line: null,
    column: null
  }
}

function parseFunctionStackLocation(error: unknown): ChartOptionErrorLocation {
  const stackText = error instanceof Error && typeof error.stack === 'string' ? error.stack : ''
  const stackMatch = stackText.match(/<anonymous>:(\d+):(\d+)/)

  if (!stackMatch) {
    return {
      line: null,
      column: null
    }
  }

  const wrappedLine = Number(stackMatch[1])
  const wrappedColumn = Number(stackMatch[2])

  if (!Number.isFinite(wrappedLine) || !Number.isFinite(wrappedColumn)) {
    return {
      line: null,
      column: null
    }
  }

  return {
    // Wrapped source has two prelude lines before user text.
    line: Math.max(1, wrappedLine - 2),
    column: Math.max(1, wrappedColumn)
  }
}

function parseJsObjectExpression(rawValue: string): JsParseResult {
  const wrappedSource = `"use strict";\nreturn (\n${rawValue}\n)`

  try {
    const fn = new Function(wrappedSource)
    return {
      value: fn(),
      error: null,
      location: { line: null, column: null }
    }
  } catch (error) {
    return {
      value: null,
      error,
      location: parseFunctionStackLocation(error)
    }
  }
}

export function isChartNodeType(type: string): type is ChartNodeType {
  return type === 'barChart' || type === 'lineChart' || type === 'pieChart' || type === 'gaugeChart' || type === 'customChart'
}

export function isCustomChartNodeType(type: string): type is 'customChart' {
  return type === 'customChart'
}

function toChartNodeType(type: string): ChartNodeType {
  return isChartNodeType(type) ? type : 'barChart'
}

export function parseChartDemoData(rawValue: any): ChartDataItem[] {
  if (typeof rawValue === 'string' && rawValue.trim()) {
    try {
      const parsed = JSON.parse(rawValue)
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item: any, index: number) => {
            if (typeof item === 'number') {
              return {
                name: `Category ${index + 1}`,
                value: item
              }
            }

            return {
              name: item?.name ? String(item.name) : `Category ${index + 1}`,
              value: Number(item?.value || 0)
            }
          })
          .filter((item: ChartDataItem) => Number.isFinite(item.value))

        if (normalized.length) {
          return normalized
        }
      }
    } catch {
      // Ignore invalid JSON and fallback to defaults.
    }
  }

  return [
    { name: 'Mon', value: 32 },
    { name: 'Tue', value: 45 },
    { name: 'Wed', value: 28 },
    { name: 'Thu', value: 57 },
    { name: 'Fri', value: 39 }
  ]
}

export function parseCustomChartOption(rawValue: any): EChartsCoreOption | null {
  if (typeof rawValue !== 'string') {
    return null
  }

  const text = rawValue.trim()
  if (!text) {
    return null
  }

  try {
    const parsedJson = JSON.parse(text)
    if (isPlainObject(parsedJson)) {
      return parsedJson as EChartsCoreOption
    }
  } catch {
    // Continue with JS object expression parsing.
  }

  const jsParsed = parseJsObjectExpression(text)
  if (isPlainObject(jsParsed.value)) {
    return jsParsed.value as EChartsCoreOption
  }

  return null
}

export function validateChartOptionInput(rawValue: any): ChartOptionValidationResult {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return {
      valid: true,
      mode: 'empty',
      message: '当前未覆盖，使用默认 option。',
      line: null,
      column: null
    }
  }

  const text = rawValue.trim()

  try {
    const parsedJson = JSON.parse(text)
    if (isPlainObject(parsedJson)) {
      return {
        valid: true,
        mode: 'json',
        message: 'JSON 语法校验通过。',
        line: null,
        column: null
      }
    }

    return {
      valid: false,
      mode: 'invalid',
      message: 'Option 必须是对象（不能是数组或基础类型）。',
      line: null,
      column: null
    }
  } catch (jsonError) {
    const jsonErrorLocation = parseJsonErrorLocation(text, jsonError)
    const jsParsed = parseJsObjectExpression(text)

    if (isPlainObject(jsParsed.value)) {
      return {
        valid: true,
        mode: 'js',
        message: 'JS 对象表达式语法校验通过。',
        line: null,
        column: null
      }
    }

    if (jsParsed.value !== null) {
      return {
        valid: false,
        mode: 'invalid',
        message: 'Option 必须返回对象（不能是数组或基础类型）。',
        line: null,
        column: null
      }
    }

    const jsMessage = getErrorMessage(jsParsed.error)
    const line = jsParsed.location.line ?? jsonErrorLocation.line
    const column = jsParsed.location.column ?? jsonErrorLocation.column

    return {
      valid: false,
      mode: 'invalid',
      message: jsMessage || getErrorMessage(jsonError),
      line,
      column
    }
  }
}

export function buildDefaultChartOption(input: Omit<ChartOptionBuildInput, 'chartOption'>): EChartsCoreOption {
  const titleText = String(input.titleText || '图表')
  const chartData = parseChartDemoData(input.demoData)

  if (input.chartType === 'customChart') {
    return {
      backgroundColor: 'transparent',
      title: {
        text: '自定义图表',
        left: 'center',
        top: 4
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          type: 'bar',
          data: [32, 45, 28, 57, 39]
        }
      ]
    }
  }

  if (input.chartType === 'barChart') {
    return {
      backgroundColor: 'transparent',
      animation: true,
      title: {
        text: titleText,
        left: 'center',
        top: 2,
        textStyle: {
          color: '#334155',
          fontSize: 12,
          fontWeight: 600
        }
      },
      grid: {
        top: 28,
        left: 20,
        right: 10,
        bottom: 18
      },
      xAxis: {
        type: 'category',
        data: chartData.map((item) => item.name),
        axisLabel: {
          color: '#64748b',
          fontSize: 10
        },
        axisLine: {
          lineStyle: {
            color: '#cbd5e1'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 10
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        }
      },
      series: [
        {
          type: 'bar',
          data: chartData.map((item) => item.value),
          barWidth: '45%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: '#3b82f6'
          }
        }
      ]
    }
  }

  if (input.chartType === 'lineChart') {
    return {
      backgroundColor: 'transparent',
      animation: true,
      title: {
        text: titleText,
        left: 'center',
        top: 2,
        textStyle: {
          color: '#334155',
          fontSize: 12,
          fontWeight: 600
        }
      },
      grid: {
        top: 28,
        left: 20,
        right: 10,
        bottom: 18
      },
      xAxis: {
        type: 'category',
        data: chartData.map((item) => item.name),
        axisLabel: {
          color: '#64748b',
          fontSize: 10
        },
        axisLine: {
          lineStyle: {
            color: '#cbd5e1'
          }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#64748b',
          fontSize: 10
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        }
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: chartData.map((item) => item.value),
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#2563eb',
            width: 3
          },
          itemStyle: {
            color: '#2563eb'
          },
          areaStyle: {
            color: 'rgba(37, 99, 235, 0.14)'
          }
        }
      ]
    }
  }

  if (input.chartType === 'pieChart') {
    return {
      backgroundColor: 'transparent',
      animation: true,
      title: {
        text: titleText,
        left: 'center',
        top: 2,
        textStyle: {
          color: '#334155',
          fontSize: 12,
          fontWeight: 600
        }
      },
      tooltip: {
        trigger: 'item'
      },
      series: [
        {
          type: 'pie',
          radius: ['38%', '68%'],
          center: ['50%', '60%'],
          label: {
            show: false
          },
          data: chartData
        }
      ]
    }
  }

  const maxValue = Math.max(1, Number(input.maxValue || 100))
  const currentValue = Number(chartData[0]?.value || 0)

  return {
    backgroundColor: 'transparent',
    animation: true,
    title: {
      text: titleText,
      left: 'center',
      top: 2,
      textStyle: {
        color: '#334155',
        fontSize: 12,
        fontWeight: 600
      }
    },
    series: [
      {
        type: 'gauge',
        center: ['50%', '62%'],
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: maxValue,
        progress: {
          show: true,
          width: 10
        },
        axisLine: {
          lineStyle: {
            width: 10
          }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        pointer: {
          show: false
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#334155',
          fontSize: 15,
          offsetCenter: [0, '24%']
        },
        data: [{ value: Math.max(0, Math.min(maxValue, currentValue)) }]
      }
    ]
  }
}

export function resolveChartOption(input: ChartOptionBuildInput): EChartsCoreOption {
  if (input.chartType === 'customChart') {
    return parseCustomChartOption(input.chartOption) ?? buildDefaultChartOption(input)
  }
  return buildDefaultChartOption(input)
}

export function buildDefaultChartOptionFromNode(node: CanvasComponentNode): EChartsCoreOption {
  return buildDefaultChartOption({
    chartType: toChartNodeType(node.type),
    titleText: node.props?.titleText,
    demoData: node.props?.demoData,
    maxValue: node.props?.maxValue
  })
}

export function resolveChartOptionFromNode(node: CanvasComponentNode): EChartsCoreOption {
  return resolveChartOption({
    chartType: toChartNodeType(node.type),
    titleText: node.props?.titleText,
    demoData: node.props?.demoData,
    maxValue: node.props?.maxValue,
    chartOption: node.props?.chartOption
  })
}

export function resolveChartOptionEditorText(node: CanvasComponentNode) {
  const rawOptionText = typeof node.props?.chartOption === 'string' ? node.props.chartOption : ''
  if (rawOptionText.trim()) {
    return rawOptionText
  }

  return JSON.stringify(buildDefaultChartOptionFromNode(node), null, 2)
}
