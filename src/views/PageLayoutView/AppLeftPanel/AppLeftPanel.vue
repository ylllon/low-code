<script setup lang="ts">
import { ref } from 'vue'
import OutlineDrawer from '@/views/PageLayoutView/AppLeftPanel/OutlineDrawer.vue'
import BlocksDrawer from '@/views/PageLayoutView/AppLeftPanel/BlocksDrawer.vue'
import type { ProjectNode } from '@/views/PageLayoutView/AppLeftPanel/project-tree.types'
import type { ProjectPreviewState } from '@/views/PageLayoutView/project-preview.types'

type LeftTab = 'project' | 'components'

const activeTab = ref<LeftTab>('project')
const emit = defineEmits<{
  (e: 'file-select', fileNode: ProjectNode | null): void
  (e: 'project-preview-change', previewState: ProjectPreviewState): void
}>()

const tabs: Array<{ key: LeftTab; label: string }> = [
  {
    key: 'project',
    label: '项目源码目录'
  },
  {
    key: 'components',
    label: '组件库'
  }
]
</script>

<template>
  <div class="app-left-panel-wrapper">
    <div class="left-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="left-tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="left-tab-content tiny-scrollbar">
      <OutlineDrawer
        v-show="activeTab === 'project'"
        @file-select="emit('file-select', $event)"
        @project-preview-change="emit('project-preview-change', $event)"
      />
      <BlocksDrawer v-show="activeTab === 'components'" />
    </div>
  </div>
</template>

<style scoped>
.app-left-panel-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  border-right: 1px solid var(--color-gray-300);
  background-color: var(--color-white);
}

.left-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--color-gray-300);
  background-color: var(--color-gray-100);
}

.left-tab-btn {
  height: 34px;
  border: 1px solid var(--color-gray-300);
  border-radius: 8px;
  background-color: var(--color-white);
  color: var(--color-gray-800);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all 0.2s ease;
}

.left-tab-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.left-tab-btn.active {
  border-color: var(--color-primary);
  background-color: rgb(101 146 183 / 10%);
  color: var(--color-primary);
}

.left-tab-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}
</style>
