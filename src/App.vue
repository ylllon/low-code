<script setup lang="ts">
import { RouterView } from 'vue-router'
if (import.meta.hot) {
  import.meta.hot.send('log', { msg: '11ccc!' })
}
</script>

<template>
  <RouterView />
</template>