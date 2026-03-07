import type { ComponentPropOption, LibraryComponentMeta } from './component-library.types'

const INPUT_SHARED_STYLE = {
  color: '#1f2937',
  backgroundColor: '#ffffff',
  borderRadius: 8,
  fontSize: 14
}

const CHART_DATA_DEFAULTS = {
  dataSourceType: 'SELF',
  demoData:
    '[{"name":"Mon","value":32},{"name":"Tue","value":45},{"name":"Wed","value":28},{"name":"Thu","value":57},{"name":"Fri","value":39}]',
  staticDataKey: '',
  restUrl: '',
  restMethod: 'GET',
  restBody: '{\n  "page": 1\n}',
  dataScript: 'return resp'
}

const LAYOUT_SHARED_STYLE = {
  borderRadius: 0,
  backgroundColor: 'transparent'
}

const LAYOUT_JUSTIFY_OPTIONS: ComponentPropOption[] = [
  { label: '左对齐', value: 'flex-start' },
  { label: '居中', value: 'center' },
  { label: '两端对齐', value: 'space-between' },
  { label: '平均分布', value: 'space-around' },
  { label: '等距分布', value: 'space-evenly' }
]

const LAYOUT_ALIGN_OPTIONS: ComponentPropOption[] = [
  { label: '拉伸', value: 'stretch' },
  { label: '顶部', value: 'flex-start' },
  { label: '居中', value: 'center' },
  { label: '底部', value: 'flex-end' }
]

export const componentLibraryList: LibraryComponentMeta[] = [
  {
    type: 'layoutRow',
    name: '行布局',
    description: '横向流式布局，支持换行和嵌套布局',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Menu',
    color: '#2563eb',
    icon: '↔️',
    defaultWidth: 560,
    defaultHeight: 260,
    defaultProps: {
      gap: 0,
      wrap: true,
      justify: 'flex-start',
      align: 'stretch',
      padding: 0,
      minItemWidth: 180
    },
    defaultStyle: LAYOUT_SHARED_STYLE,
    stateStyles: {
      normal: {
        backgroundColor: '#f8fbff',
        borderColor: '#a5c8ff'
      },
      hover: {
        borderColor: '#2563eb'
      },
      active: {
        borderColor: '#2563eb',
        shadow: '0 0 0 2px rgba(37, 99, 235, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'gap', label: '子项间距', editor: 'number', min: 0, max: 64, step: 1 },
      { key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 64, step: 1 },
      { key: 'wrap', label: '自动换行', editor: 'switch' },
      {
        key: 'justify',
        label: '主轴对齐',
        editor: 'select',
        options: LAYOUT_JUSTIFY_OPTIONS
      },
      {
        key: 'align',
        label: '交叉轴对齐',
        editor: 'select',
        options: LAYOUT_ALIGN_OPTIONS
      },
      { key: 'minItemWidth', label: '子项最小宽度', editor: 'number', min: 80, max: 800, step: 1 }
    ]
  },
  {
    type: 'layoutColumn',
    name: '列布局',
    description: '纵向堆叠布局，适合表单区块和页面骨架',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Rank',
    color: '#0f766e',
    icon: '↕️',
    defaultWidth: 420,
    defaultHeight: 320,
    defaultProps: {
      gap: 0,
      justify: 'flex-start',
      align: 'stretch',
      padding: 0
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#f4fbf9',
        borderColor: '#85d6c2'
      },
      hover: {
        borderColor: '#0f766e'
      },
      active: {
        borderColor: '#0f766e',
        shadow: '0 0 0 2px rgba(15, 118, 110, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'gap', label: '子项间距', editor: 'number', min: 0, max: 64, step: 1 },
      { key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 64, step: 1 },
      {
        key: 'justify',
        label: '主轴对齐',
        editor: 'select',
        options: LAYOUT_JUSTIFY_OPTIONS
      },
      {
        key: 'align',
        label: '交叉轴对齐',
        editor: 'select',
        options: LAYOUT_ALIGN_OPTIONS
      }
    ]
  },
  {
    type: 'layoutGrid',
    name: '响应式网格',
    description: '按设备断点自动切换列数，可继续嵌套布局',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Operation',
    color: '#7c3aed',
    icon: '🔲',
    defaultWidth: 560,
    defaultHeight: 320,
    defaultProps: {
      gap: 0,
      padding: 0,
      columnsDesktop: 4,
      columnsTablet: 2,
      columnsMobile: 1,
      rows: 3
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#f8f6ff',
        borderColor: '#cfb8ff'
      },
      hover: {
        borderColor: '#7c3aed'
      },
      active: {
        borderColor: '#7c3aed',
        shadow: '0 0 0 2px rgba(124, 58, 237, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'gap', label: '网格间距', editor: 'number', min: 0, max: 64, step: 1 },
      { key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 64, step: 1 },
      { key: 'columnsDesktop', label: '桌面列数', editor: 'number', min: 1, max: 12, step: 1 },
      { key: 'columnsTablet', label: '平板列数', editor: 'number', min: 1, max: 8, step: 1 },
      { key: 'columnsMobile', label: '手机列数', editor: 'number', min: 1, max: 4, step: 1 },
      { key: 'rows', label: '行数', editor: 'number', min: 1, max: 20, step: 1 }
    ]
  },
  {
    type: 'layoutContainer',
    name: '容器',
    description: '页面大框架容器，适合组织模块分组',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Box',
    color: '#0ea5e9',
    icon: '📦',
    defaultWidth: 640,
    defaultHeight: 360,
    defaultProps: {
      gap: 0,
      padding: 0,
      justify: 'flex-start',
      align: 'stretch'
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#f8fbff',
        borderColor: '#7dd3fc'
      },
      hover: {
        borderColor: '#0ea5e9'
      },
      active: {
        borderColor: '#0ea5e9',
        shadow: '0 0 0 2px rgba(14, 165, 233, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'gap', label: '子项间距', editor: 'number', min: 0, max: 64, step: 1 },
      { key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 96, step: 1 },
      {
        key: 'justify',
        label: '主轴对齐',
        editor: 'select',
        options: LAYOUT_JUSTIFY_OPTIONS
      },
      {
        key: 'align',
        label: '交叉轴对齐',
        editor: 'select',
        options: LAYOUT_ALIGN_OPTIONS
      }
    ]
  },
  {
    type: 'layoutFree',
    name: '自由布局容器',
    description: '容器内部使用绝对定位，子组件可自由拖拽与缩放，支持套娃',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Crop',
    color: '#1d4ed8',
    icon: '🪟',
    defaultWidth: 560,
    defaultHeight: 360,
    defaultProps: {
      padding: 0
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#f4f8ff',
        borderColor: '#93c5fd'
      },
      hover: {
        borderColor: '#1d4ed8'
      },
      active: {
        borderColor: '#1d4ed8',
        shadow: '0 0 0 2px rgba(29, 78, 216, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [{ key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 64, step: 1 }]
  },
  {
    type: 'layoutCard',
    name: '卡片布局',
    description: '带标题的内容容器，可承载多个子组件',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Postcard',
    color: '#14b8a6',
    icon: '🗃️',
    defaultWidth: 420,
    defaultHeight: 280,
    defaultProps: {
      cardTitle: '',
      gap: 0,
      padding: 0
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff',
        borderColor: '#99f6e4'
      },
      hover: {
        borderColor: '#14b8a6'
      },
      active: {
        borderColor: '#14b8a6',
        shadow: '0 0 0 2px rgba(20, 184, 166, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'cardTitle', label: '标题', editor: 'input', placeholder: '请输入卡片标题' },
      { key: 'gap', label: '子项间距', editor: 'number', min: 0, max: 48, step: 1 },
      { key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 64, step: 1 }
    ]
  },
  {
    type: 'layoutTabs',
    name: '选项卡布局',
    description: '通过选项卡组织多个区域内容',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Tickets',
    color: '#6366f1',
    icon: '🗂',
    defaultWidth: 560,
    defaultHeight: 320,
    defaultProps: {
      tabs: '概览|数据|设置',
      activeTab: 0,
      gap: 0,
      padding: 0
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#eef2ff',
        borderColor: '#c7d2fe'
      },
      hover: {
        borderColor: '#6366f1'
      },
      active: {
        borderColor: '#6366f1',
        shadow: '0 0 0 2px rgba(99, 102, 241, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'tabs', label: '选项卡', editor: 'input', placeholder: '例如：概览|数据|设置' },
      { key: 'activeTab', label: '默认激活', editor: 'number', min: 0, max: 12, step: 1 },
      { key: 'gap', label: '子项间距', editor: 'number', min: 0, max: 48, step: 1 },
      { key: 'padding', label: '容器内边距', editor: 'number', min: 0, max: 64, step: 1 }
    ]
  },
  {
    type: 'layoutHeader',
    name: '顶栏',
    description: '页面顶部区域，适合导航和状态信息',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Top',
    color: '#334155',
    icon: '🔝',
    defaultWidth: 640,
    defaultHeight: 96,
    defaultProps: {
      height: 80,
      padding: 0,
      justify: 'space-between',
      align: 'center'
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1'
      },
      hover: {
        borderColor: '#334155'
      },
      active: {
        borderColor: '#334155',
        shadow: '0 0 0 2px rgba(51, 65, 85, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'height', label: '高度', editor: 'number', min: 48, max: 240, step: 1 },
      { key: 'padding', label: '内边距', editor: 'number', min: 0, max: 64, step: 1 },
      {
        key: 'justify',
        label: '主轴对齐',
        editor: 'select',
        options: LAYOUT_JUSTIFY_OPTIONS
      },
      {
        key: 'align',
        label: '交叉轴对齐',
        editor: 'select',
        options: LAYOUT_ALIGN_OPTIONS
      }
    ]
  },
  {
    type: 'layoutSidebar',
    name: '侧栏',
    description: '页面侧边区域，可放导航、筛选和目录',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'DArrowLeft',
    color: '#0f766e',
    icon: '🧱',
    defaultWidth: 280,
    defaultHeight: 420,
    defaultProps: {
      sidebarWidth: 260,
      gap: 0,
      padding: 0
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ecfeff',
        borderColor: '#99f6e4'
      },
      hover: {
        borderColor: '#0f766e'
      },
      active: {
        borderColor: '#0f766e',
        shadow: '0 0 0 2px rgba(15, 118, 110, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'sidebarWidth', label: '宽度', editor: 'number', min: 120, max: 520, step: 1 },
      { key: 'gap', label: '子项间距', editor: 'number', min: 0, max: 48, step: 1 },
      { key: 'padding', label: '内边距', editor: 'number', min: 0, max: 64, step: 1 }
    ]
  },
  {
    type: 'layoutFooter',
    name: '底栏',
    description: '页面底部区域，适合操作区和版权信息',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Bottom',
    color: '#7c2d12',
    icon: '🔻',
    defaultWidth: 640,
    defaultHeight: 88,
    defaultProps: {
      height: 72,
      padding: 0,
      justify: 'space-between',
      align: 'center'
    },
    defaultStyle: {
      ...LAYOUT_SHARED_STYLE,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#fff7ed',
        borderColor: '#fed7aa'
      },
      hover: {
        borderColor: '#7c2d12'
      },
      active: {
        borderColor: '#7c2d12',
        shadow: '0 0 0 2px rgba(124, 45, 18, 0.18)'
      }
    },
    canAcceptChildren: true,
    propSchema: [
      { key: 'height', label: '高度', editor: 'number', min: 40, max: 180, step: 1 },
      { key: 'padding', label: '内边距', editor: 'number', min: 0, max: 64, step: 1 },
      {
        key: 'justify',
        label: '主轴对齐',
        editor: 'select',
        options: LAYOUT_JUSTIFY_OPTIONS
      },
      {
        key: 'align',
        label: '交叉轴对齐',
        editor: 'select',
        options: LAYOUT_ALIGN_OPTIONS
      }
    ]
  },
  {
    type: 'divider',
    name: '分割线',
    description: '用于区块分隔，可设置方向和颜色',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Minus',
    color: '#64748b',
    icon: '➖',
    defaultWidth: 320,
    defaultHeight: 16,
    defaultProps: {
      direction: 'horizontal',
      thickness: 1
    },
    defaultStyle: {
      color: '#cbd5e1',
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#94a3b8'
      },
      active: {
        borderColor: '#64748b',
        shadow: '0 0 0 2px rgba(100, 116, 139, 0.16)'
      }
    },
    propSchema: [
      {
        key: 'direction',
        label: '方向',
        editor: 'select',
        options: [
          { label: '横向', value: 'horizontal' },
          { label: '纵向', value: 'vertical' }
        ]
      },
      { key: 'thickness', label: '粗细', editor: 'number', min: 1, max: 12, step: 1 }
    ]
  },
  {
    type: 'spacer',
    name: '留白',
    description: '用于控制区域之间的间距',
    category: '布局组件',
    groupOrder: 0,
    previewType: 'layout',
    iconKey: 'Rank',
    color: '#94a3b8',
    icon: '⬜',
    defaultWidth: 320,
    defaultHeight: 24,
    defaultProps: {
      space: 24
    },
    defaultStyle: {
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#cbd5e1'
      },
      active: {
        borderColor: '#94a3b8',
        shadow: '0 0 0 2px rgba(148, 163, 184, 0.16)'
      }
    },
    propSchema: [{ key: 'space', label: '留白高度', editor: 'number', min: 4, max: 200, step: 1 }]
  },
  {
    type: 'text',
    name: '文本',
    description: '展示静态文本内容',
    category: '文本组件',
    groupOrder: 1,
    previewType: 'text',
    iconKey: 'Document',
    color: '#2f82bf',
    icon: '📝',
    defaultWidth: 220,
    defaultHeight: 56,
    defaultProps: {
      text: '这是一个文本组件'
    },
    defaultStyle: {
      color: '#1f2937',
      fontSize: 16,
      fontWeight: 500
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#007aff'
      },
      active: {
        borderColor: '#007aff',
        shadow: '0 0 0 2px rgba(0, 122, 255, 0.18)'
      }
    },
    propSchema: [{ key: 'text', label: '文本内容', editor: 'textarea', placeholder: '请输入文本内容' }]
  },
  {
    type: 'button',
    name: '按钮',
    description: '用于触发点击动作',
    category: '表单组件',
    groupOrder: 2,
    previewType: 'form',
    iconKey: 'Pointer',
    color: '#00a870',
    icon: '🔘',
    defaultWidth: 150,
    defaultHeight: 56,
    defaultProps: {
      text: '立即提交',
      buttonType: 'primary'
    },
    defaultStyle: {
      borderRadius: 8,
      fontSize: 14
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#007aff'
      },
      active: {
        borderColor: '#007aff',
        shadow: '0 0 0 2px rgba(0, 122, 255, 0.18)'
      }
    },
    propSchema: [
      { key: 'text', label: '按钮文案', editor: 'input', placeholder: '请输入按钮文案' },
      {
        key: 'buttonType',
        label: '按钮类型',
        editor: 'select',
        options: [
          { label: '主按钮', value: 'primary' },
          { label: '默认', value: 'default' },
          { label: '成功', value: 'success' },
          { label: '警告', value: 'warning' },
          { label: '危险', value: 'danger' }
        ]
      }
    ]
  },
  {
    type: 'input',
    name: '输入框',
    description: '单行文本输入',
    category: '表单组件',
    groupOrder: 2,
    previewType: 'form',
    iconKey: 'EditPen',
    color: '#5e60ce',
    icon: '⌨️',
    defaultWidth: 260,
    defaultHeight: 64,
    defaultProps: {
      placeholder: '请输入内容',
      value: ''
    },
    defaultStyle: INPUT_SHARED_STYLE,
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#007aff'
      },
      active: {
        borderColor: '#007aff',
        shadow: '0 0 0 2px rgba(0, 122, 255, 0.18)'
      }
    },
    propSchema: [
      { key: 'placeholder', label: '占位提示', editor: 'input', placeholder: '请输入 placeholder' },
      { key: 'value', label: '默认值', editor: 'input', placeholder: '默认输入值' }
    ]
  },
  {
    type: 'select',
    name: '下拉框',
    description: '下拉选项选择',
    category: '表单组件',
    groupOrder: 2,
    previewType: 'form',
    iconKey: 'ArrowDown',
    color: '#5e60ce',
    icon: '🧭',
    defaultWidth: 260,
    defaultHeight: 64,
    defaultProps: {
      placeholder: '请选择',
      options: '选项1|选项2|选项3'
    },
    defaultStyle: INPUT_SHARED_STYLE,
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#007aff'
      },
      active: {
        borderColor: '#007aff',
        shadow: '0 0 0 2px rgba(0, 122, 255, 0.18)'
      }
    },
    propSchema: [
      { key: 'placeholder', label: '占位提示', editor: 'input', placeholder: '请输入 placeholder' },
      {
        key: 'options',
        label: '选项列表',
        editor: 'textarea',
        placeholder: '每行一项，或使用 | 分隔'
      }
    ]
  },
  {
    type: 'switch',
    name: '开关',
    description: '布尔开关切换',
    category: '表单组件',
    groupOrder: 2,
    previewType: 'form',
    iconKey: 'SwitchFilled',
    color: '#5e60ce',
    icon: '🎚️',
    defaultWidth: 180,
    defaultHeight: 56,
    defaultProps: {
      checked: true,
      activeText: '开启',
      inactiveText: '关闭'
    },
    defaultStyle: {
      fontSize: 14,
      color: '#334155'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#007aff'
      },
      active: {
        borderColor: '#007aff',
        shadow: '0 0 0 2px rgba(0, 122, 255, 0.18)'
      }
    },
    propSchema: [
      { key: 'checked', label: '默认开启', editor: 'switch' },
      { key: 'activeText', label: '开启文案', editor: 'input' },
      { key: 'inactiveText', label: '关闭文案', editor: 'input' }
    ]
  },
  {
    type: 'datePicker',
    name: '日期选择',
    description: '日期时间选择器',
    category: '表单组件',
    groupOrder: 2,
    previewType: 'form',
    iconKey: 'Calendar',
    color: '#5e60ce',
    icon: '📅',
    defaultWidth: 260,
    defaultHeight: 64,
    defaultProps: {
      placeholder: '请选择日期',
      pickerType: 'date'
    },
    defaultStyle: INPUT_SHARED_STYLE,
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#007aff'
      },
      active: {
        borderColor: '#007aff',
        shadow: '0 0 0 2px rgba(0, 122, 255, 0.18)'
      }
    },
    propSchema: [
      { key: 'placeholder', label: '占位提示', editor: 'input' },
      {
        key: 'pickerType',
        label: '选择类型',
        editor: 'select',
        options: [
          { label: '日期', value: 'date' },
          { label: '日期时间', value: 'datetime' },
          { label: '日期范围', value: 'daterange' }
        ]
      }
    ]
  },
  {
    type: 'barChart',
    name: '基础柱状图',
    description: '数据可视化柱状图',
    category: '图表组件',
    groupOrder: 3,
    previewType: 'chart',
    iconKey: 'Histogram',
    color: '#0f766e',
    icon: '📶',
    defaultWidth: 360,
    defaultHeight: 220,
    defaultProps: {
      titleText: '销售数据',
      ...CHART_DATA_DEFAULTS
    },
    defaultStyle: {
      borderRadius: 10,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#0ea5a4'
      },
      active: {
        borderColor: '#0ea5a4',
        shadow: '0 0 0 2px rgba(14, 165, 164, 0.2)'
      }
    },
    propSchema: [{ key: 'titleText', label: '图表标题', editor: 'input', placeholder: '请输入图表标题' }],
    supportsDataConfig: true,
    defaultDataMode: 'SELF'
  },
  {
    type: 'lineChart',
    name: '基础折线图',
    description: '趋势变化图表',
    category: '图表组件',
    groupOrder: 3,
    previewType: 'chart',
    iconKey: 'TrendCharts',
    color: '#1d4ed8',
    icon: '📈',
    defaultWidth: 360,
    defaultHeight: 220,
    defaultProps: {
      titleText: '趋势变化',
      ...CHART_DATA_DEFAULTS
    },
    defaultStyle: {
      borderRadius: 10,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#2563eb'
      },
      active: {
        borderColor: '#2563eb',
        shadow: '0 0 0 2px rgba(37, 99, 235, 0.2)'
      }
    },
    propSchema: [{ key: 'titleText', label: '图表标题', editor: 'input', placeholder: '请输入图表标题' }],
    supportsDataConfig: true,
    defaultDataMode: 'SELF'
  },
  {
    type: 'pieChart',
    name: '基础饼图',
    description: '占比数据图表',
    category: '图表组件',
    groupOrder: 3,
    previewType: 'chart',
    iconKey: 'PieChart',
    color: '#b45309',
    icon: '🥧',
    defaultWidth: 320,
    defaultHeight: 220,
    defaultProps: {
      titleText: '分类占比',
      ...CHART_DATA_DEFAULTS
    },
    defaultStyle: {
      borderRadius: 10,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#d97706'
      },
      active: {
        borderColor: '#d97706',
        shadow: '0 0 0 2px rgba(217, 119, 6, 0.2)'
      }
    },
    propSchema: [{ key: 'titleText', label: '图表标题', editor: 'input', placeholder: '请输入图表标题' }],
    supportsDataConfig: true,
    defaultDataMode: 'SELF'
  },
  {
    type: 'gaugeChart',
    name: '仪表盘',
    description: '单值仪表盘',
    category: '图表组件',
    groupOrder: 3,
    previewType: 'chart',
    iconKey: 'Odometer',
    color: '#7c3aed',
    icon: '🧪',
    defaultWidth: 300,
    defaultHeight: 220,
    defaultProps: {
      titleText: '完成率',
      maxValue: 100,
      ...CHART_DATA_DEFAULTS,
      demoData: '[{"name":"完成率","value":72}]'
    },
    defaultStyle: {
      borderRadius: 10,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#7c3aed'
      },
      active: {
        borderColor: '#7c3aed',
        shadow: '0 0 0 2px rgba(124, 58, 237, 0.2)'
      }
    },
    propSchema: [
      { key: 'titleText', label: '图表标题', editor: 'input' },
      { key: 'maxValue', label: '最大值', editor: 'number', min: 1, max: 10000, step: 1 }
    ],
    supportsDataConfig: true,
    defaultDataMode: 'SELF'
  },
  {
    type: 'customChart',
    name: '自定义图表',
    description: '通过完整 ECharts Option 自定义图表',
    category: '图表组件',
    groupOrder: 3,
    previewType: 'chart',
    iconKey: 'DataAnalysis',
    color: '#334155',
    icon: '🧩',
    defaultWidth: 360,
    defaultHeight: 240,
    defaultProps: {
      chartOption:
        '{\n  "backgroundColor": "transparent",\n  "title": {\n    "text": "自定义图表",\n    "left": "center",\n    "top": 4\n  },\n  "tooltip": {\n    "trigger": "axis"\n  },\n  "xAxis": {\n    "type": "category",\n    "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]\n  },\n  "yAxis": {\n    "type": "value"\n  },\n  "series": [\n    {\n      "type": "bar",\n      "data": [32, 45, 28, 57, 39]\n    }\n  ]\n}'
    },
    defaultStyle: {
      borderRadius: 10,
      backgroundColor: 'transparent'
    },
    stateStyles: {
      normal: {
        backgroundColor: 'transparent'
      },
      hover: {
        borderColor: '#475569'
      },
      active: {
        borderColor: '#475569',
        shadow: '0 0 0 2px rgba(71, 85, 105, 0.2)'
      }
    },
    propSchema: [
      {
        key: 'chartOption',
        label: 'ECharts Option',
        editor: 'json',
        placeholder: '请输入 setOption(option) 的完整配置（JSON / JS 对象）'
      }
    ]
  },
  {
    type: 'table',
    name: '数据表格',
    description: '二维表格数据展示',
    category: '数据组件',
    groupOrder: 4,
    previewType: 'data',
    iconKey: 'Grid',
    color: '#f39c12',
    icon: '📊',
    defaultWidth: 360,
    defaultHeight: 220,
    defaultProps: {
      columns: '姓名|角色',
      rows: 3,
      ...CHART_DATA_DEFAULTS,
      demoData:
        '[{"姓名":"王小明","角色":"管理员"},{"姓名":"李小红","角色":"运营"},{"姓名":"张三","角色":"开发"}]'
    },
    defaultStyle: {
      borderRadius: 8
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#f39c12'
      },
      active: {
        borderColor: '#f39c12',
        shadow: '0 0 0 2px rgba(243, 156, 18, 0.22)'
      }
    },
    propSchema: [
      { key: 'columns', label: '列定义', editor: 'input', placeholder: '例如：姓名|角色|状态' },
      { key: 'rows', label: '默认行数', editor: 'number', min: 1, max: 20, step: 1 }
    ],
    supportsDataConfig: true,
    defaultDataMode: 'SELF'
  },
  {
    type: 'card',
    name: '卡片',
    description: '承载分组信息',
    category: '容器组件',
    groupOrder: 5,
    previewType: 'container',
    iconKey: 'Postcard',
    color: '#16a085',
    icon: '🗂️',
    defaultWidth: 320,
    defaultHeight: 180,
    defaultProps: {
      title: '卡片标题',
      content: '这是卡片正文内容，可在属性面板中编辑。'
    },
    defaultStyle: {
      borderRadius: 10
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#16a085'
      },
      active: {
        borderColor: '#16a085',
        shadow: '0 0 0 2px rgba(22, 160, 133, 0.2)'
      }
    },
    propSchema: [
      { key: 'title', label: '标题', editor: 'input' },
      { key: 'content', label: '正文', editor: 'textarea' }
    ]
  },
  {
    type: 'image',
    name: '图片',
    description: '展示图片资源',
    category: '容器组件',
    groupOrder: 5,
    previewType: 'container',
    iconKey: 'Picture',
    color: '#3498db',
    icon: '🖼️',
    defaultWidth: 260,
    defaultHeight: 180,
    defaultProps: {
      src: '',
      fit: 'cover'
    },
    defaultStyle: {
      borderRadius: 10
    },
    stateStyles: {
      normal: {
        backgroundColor: '#ffffff'
      },
      hover: {
        borderColor: '#3498db'
      },
      active: {
        borderColor: '#3498db',
        shadow: '0 0 0 2px rgba(52, 152, 219, 0.2)'
      }
    },
    propSchema: [
      { key: 'src', label: '图片链接', editor: 'input', placeholder: 'https://example.com/image.png' },
      {
        key: 'fit',
        label: '填充方式',
        editor: 'select',
        options: [
          { label: '填充', value: 'cover' },
          { label: '包含', value: 'contain' },
          { label: '拉伸', value: 'fill' }
        ]
      }
    ]
  },
  {
    type: 'borderBox',
    name: '边框容器',
    description: '用于大屏分区边框',
    category: '装饰组件',
    groupOrder: 6,
    previewType: 'decoration',
    iconKey: 'Crop',
    color: '#334155',
    icon: '🧱',
    defaultWidth: 320,
    defaultHeight: 200,
    defaultProps: {
      borderTitle: '分区标题'
    },
    defaultStyle: {
      borderRadius: 10,
      color: '#38bdf8',
      backgroundColor: '#0f172a'
    },
    stateStyles: {
      normal: {
        backgroundColor: '#0f172a'
      },
      hover: {
        borderColor: '#38bdf8'
      },
      active: {
        borderColor: '#38bdf8',
        shadow: '0 0 0 2px rgba(56, 189, 248, 0.2)'
      }
    },
    propSchema: [{ key: 'borderTitle', label: '标题', editor: 'input' }]
  },
  {
    type: 'decorationLine',
    name: '装饰线',
    description: '用于视觉分割与强调',
    category: '装饰组件',
    groupOrder: 6,
    previewType: 'decoration',
    iconKey: 'Minus',
    color: '#7c3aed',
    icon: '✨',
    defaultWidth: 280,
    defaultHeight: 64,
    defaultProps: {
      text: '装饰分割'
    },
    defaultStyle: {
      color: '#7c3aed',
      backgroundColor: '#f8f5ff',
      borderRadius: 8
    },
    stateStyles: {
      normal: {
        backgroundColor: '#f8f5ff'
      },
      hover: {
        borderColor: '#7c3aed'
      },
      active: {
        borderColor: '#7c3aed',
        shadow: '0 0 0 2px rgba(124, 58, 237, 0.2)'
      }
    },
    propSchema: [{ key: 'text', label: '文案', editor: 'input' }]
  }
]
