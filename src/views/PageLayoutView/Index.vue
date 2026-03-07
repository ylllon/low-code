<script setup lang="ts">
import { ref } from 'vue'
import AppLeftPanel from '@/views/PageLayoutView/AppLeftPanel/AppLeftPanel.vue'
import AppPreviewer from '@/views/PageLayoutView/AppPreviewer/AppPreviewer.vue'
import AppRightPanel from '@/views/PageLayoutView/AppRightPanel/AppRightPanel.vue'
import type { ProjectNode } from '@/views/PageLayoutView/AppLeftPanel/project-tree.types'
import {
  defaultProjectPreviewState,
  type ProjectPreviewState
} from '@/views/PageLayoutView/project-preview.types'

const selectedFileNode = ref<ProjectNode | null>(null)
const projectPreviewState = ref<ProjectPreviewState>({
  ...defaultProjectPreviewState
})

function onFileSelect(fileNode: ProjectNode | null) {
  selectedFileNode.value = fileNode
}

function onProjectPreviewChange(previewState: ProjectPreviewState) {
  projectPreviewState.value = {
    ...previewState
  }
}
</script>

<template>
  <div class="layout-wrapper">
    <div class="layout-column layout-left">
      <AppLeftPanel @file-select="onFileSelect" @project-preview-change="onProjectPreviewChange" />
    </div>
    <div class="layout-column layout-center">
      <AppPreviewer :selected-file-node="selectedFileNode" :project-preview="projectPreviewState" />
    </div>
    <div class="layout-column layout-right">
      <AppRightPanel :selected-file-node="selectedFileNode" />
    </div>
  </div>
</template>

<style scoped>
.layout-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
}

.layout-column {
  height: 100%;
  min-width: 0;
}

.layout-left {
  flex: 0 0 22%;
  max-width: 22%;
}

.layout-center {
  flex: 0 0 56%;
  max-width: 56%;
}

.layout-right {
  flex: 0 0 22%;
  max-width: 22%;
}
</style>
