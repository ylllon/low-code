<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import {
  ArrowDown,
  Calendar,
  Crop,
  Document,
  EditPen,
  Grid,
  Histogram,
  Menu,
  Minus,
  Odometer,
  Operation,
  PieChart,
  Picture,
  Pointer,
  Postcard,
  Rank,
  SwitchFilled,
  TrendCharts
} from '@element-plus/icons-vue'
import {
  componentLibraryList,
  LOW_CODE_COMPONENT_MIME_TYPE,
  type LibraryComponentMeta
} from '@/views/PageLayoutView/component-library'

const componentList = componentLibraryList
const draggingType = ref('')
const keyword = ref('')

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

const iconComponentMap: Record<string, Component> = {
  Document,
  Pointer,
  EditPen,
  ArrowDown,
  SwitchFilled,
  Calendar,
  Histogram,
  TrendCharts,
  PieChart,
  Odometer,
  Grid,
  Menu,
  Rank,
  Operation,
  Postcard,
  Picture,
  Crop,
  Minus
}

function resolveIconComponent(componentMeta: LibraryComponentMeta) {
  return iconComponentMap[componentMeta.iconKey] || Grid
}

function formatCategoryTag(componentMeta: LibraryComponentMeta) {
  if (componentMeta.previewType === 'layout') {
    return '布局'
  }
  if (componentMeta.previewType === 'chart') {
    return '图表'
  }
  if (componentMeta.previewType === 'form') {
    return '表单'
  }
  if (componentMeta.previewType === 'data') {
    return '数据'
  }
  if (componentMeta.previewType === 'container') {
    return '容器'
  }
  if (componentMeta.previewType === 'decoration') {
    return '装饰'
  }
  return '基础'
}

/**
 * 组件库按类别分组，并支持关键字过滤。
 * 分组顺序由 groupOrder 控制，组内按 name 排序，保持视觉稳定。
 */
const groupedComponentList = computed(() => {
  const categoryMap = new Map<string, LibraryComponentMeta[]>()

  componentList
    .filter((item) => {
      if (!normalizedKeyword.value) {
        return true
      }

      return (
        item.name.toLowerCase().includes(normalizedKeyword.value) ||
        item.type.toLowerCase().includes(normalizedKeyword.value) ||
        item.description.toLowerCase().includes(normalizedKeyword.value)
      )
    })
    .forEach((item) => {
      const currentGroup = categoryMap.get(item.category) || []
      currentGroup.push(item)
      categoryMap.set(item.category, currentGroup)
    })

  return Array.from(categoryMap.entries())
    .map(([category, list]) => {
      const sortedList = [...list].sort((left, right) => left.name.localeCompare(right.name))
      return {
        category,
        list: sortedList,
        order: sortedList[0]?.groupOrder || 99
      }
    })
    .sort((left, right) => left.order - right.order || left.category.localeCompare(right.category))
})

/**
 * 拖拽开始时写入 DataTransfer，供中间画布读取。
 */
function onDragStart(event: DragEvent, componentMeta: LibraryComponentMeta) {
  draggingType.value = componentMeta.type

  if (!event.dataTransfer) {
    return
  }

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(LOW_CODE_COMPONENT_MIME_TYPE, JSON.stringify(componentMeta))
  event.dataTransfer.setData('text/plain', componentMeta.type)
}

function onDragEnd() {
  draggingType.value = ''
}
</script>

<template>
  <div class="blocks-drawer-wrapper lc-shell">
    <h3 class="drawer-title lc-panel-title">组件库</h3>
    <p class="drawer-subtitle lc-panel-subtitle">按分类浏览组件，拖拽到画布快速搭建页面。</p>

    <el-input v-model="keyword" class="keyword-input" size="small" clearable placeholder="搜索组件（名称/类型）" />

    <div class="category-list">
      <section v-for="group in groupedComponentList" :key="group.category" class="category-section">
        <h4 class="category-title">{{ group.category }} · {{ group.list.length }}</h4>

        <div class="blocks-list">
          <div
            v-for="componentMeta in group.list"
            :key="componentMeta.type"
            class="blocks-item lc-card lc-card-hoverable"
            :class="{ dragging: draggingType === componentMeta.type }"
            draggable="true"
            @dragstart="onDragStart($event, componentMeta)"
            @dragend="onDragEnd"
          >
            <div class="block-top-row">
              <div class="block-icon-wrapper" :style="{ backgroundColor: componentMeta.color }">
                <el-icon class="block-icon">
                  <component :is="resolveIconComponent(componentMeta)" />
                </el-icon>
              </div>
              <span class="block-preview-tag lc-tag">{{ formatCategoryTag(componentMeta) }}</span>
            </div>

            <span class="block-name">{{ componentMeta.name }}</span>
            <span class="block-type">{{ componentMeta.type }}</span>
            <span class="block-desc">{{ componentMeta.description }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.blocks-drawer-wrapper {
  width: 100%;
}

.drawer-title {
  margin-bottom: 6px;
}

.drawer-subtitle {
  margin-bottom: 10px;
}

.keyword-input {
  margin-bottom: 12px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.category-section {
  width: 100%;
}

.category-title {
  margin-bottom: 8px;
  font-size: var(--lc-font-size-sm);
  font-weight: var(--lc-font-weight-bold);
  color: var(--lc-color-text-2);
}

.blocks-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.blocks-item {
  display: flex;
  flex-direction: column;
  border-radius: var(--lc-radius-md);
  padding: 10px;
  cursor: grab;
  user-select: none;
}

.blocks-item.dragging {
  opacity: 0.7;
  transform: scale(0.98);
}

.block-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.block-icon-wrapper {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--color-white);
}

.block-icon {
  font-size: 17px;
}

.block-preview-tag {
  color: var(--lc-color-text-2);
  background: var(--lc-color-bg-subtle);
}

.block-name {
  font-size: var(--lc-font-size-sm);
  font-weight: var(--lc-font-weight-semibold);
  color: var(--lc-color-text-1);
}

.block-type {
  margin-top: 2px;
  font-size: var(--lc-font-size-xs);
  color: var(--lc-color-text-3);
}

.block-desc {
  margin-top: 4px;
  font-size: var(--lc-font-size-xs);
  line-height: 1.4;
  color: var(--lc-color-text-3);
}
</style>
