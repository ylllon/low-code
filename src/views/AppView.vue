<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppNavigator from '@/components/AppNavigator.vue'
</script>

<template>
  <div class="app-wrapper">
    <header>
      <AppNavigator msg="Hello" />
    </header>
    <main>
      <!-- routerView用来渲染匹配上的路由对应的 页面组件-->
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-wrapper {
  position: fixed;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

main {
  height: calc(100% - 48px);
}
</style>
