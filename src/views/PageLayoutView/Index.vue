<script setup lang="ts">
import AppLeftPanel from '@/views/PageLayoutView/AppLeftPanel/AppLeftPanel.vue'
import AppPreviewer from '@/views/PageLayoutView/AppPreviewer/AppPreviewer.vue'
import AppRightPanel from '@/views/PageLayoutView/AppRightPanel/AppRightPanel.vue'
import { useCoreStore } from '@/core/store'

let userCore = useCoreStore()
console.log(userCore.user?.roles[0])
</script>

<template>
  <div class="layout-wrapper">
    <AppLeftPanel />
    <AppPreviewer />
    <AppRightPanel />
  </div>
</template>

<style scoped>
.layout-wrapper {
  display: flex;
  height: 100%;
}

.layout-setting {
  position: relative;
  z-index: 6;
  width: var(--panel-width);
  box-shadow: var(--color-gray-300) -1px 0 0;
}
</style>
