<script setup lang="ts">
import { computed } from 'vue'
import type { CanvasComponentNode } from '@/views/PageLayoutView/component-library'
import {
  resolveElementPlusAutoBinding,
  resolveElementPlusAutoRuntimeProps,
  resolveElementPlusAutoSlotText,
  resolveElementPlusAutoOptionItems,
  resolveElementPlusAutoTableColumnKeys,
  resolveElementPlusAutoTableData
} from '@/views/PageLayoutView/component-library.element-plus'

const props = defineProps<{
  node: CanvasComponentNode
}>()

const nodeBinding = computed(() => resolveElementPlusAutoBinding(props.node.type))
const runtimeProps = computed(() => resolveElementPlusAutoRuntimeProps(props.node))
const slotText = computed(() => resolveElementPlusAutoSlotText(props.node))
const optionItems = computed(() => resolveElementPlusAutoOptionItems(props.node))
const tableData = computed(() => resolveElementPlusAutoTableData(runtimeProps.value))
const tableColumnKeys = computed(() => resolveElementPlusAutoTableColumnKeys(props.node, runtimeProps.value))

const tableRuntimeProps = computed(() => {
  return {
    ...runtimeProps.value,
    data: tableData.value
  }
})
</script>

<template>
  <div class="auto-element-node">
    <template v-if="nodeBinding">
      <component
        :is="nodeBinding.tag"
        v-if="nodeBinding.tag === 'el-select'"
        v-bind="runtimeProps"
        class="auto-element-component"
      >
        <el-option
          v-for="(optionLabel, optionIndex) in optionItems"
          :key="`${node.id}-${optionLabel}-${optionIndex}`"
          :label="optionLabel"
          :value="optionLabel"
        />
      </component>

      <component
        :is="nodeBinding.tag"
        v-else-if="nodeBinding.tag === 'el-table'"
        v-bind="tableRuntimeProps"
        class="auto-element-component auto-element-component--table"
      >
        <el-table-column
          v-for="(columnKey, columnIndex) in tableColumnKeys"
          :key="`${node.id}-${columnKey}-${columnIndex}`"
          :prop="columnKey"
          :label="columnKey"
          min-width="96"
          show-overflow-tooltip
        />
      </component>

      <component :is="nodeBinding.tag" v-else v-bind="runtimeProps" class="auto-element-component">
        <template v-if="slotText">{{ slotText }}</template>
      </component>
    </template>

    <span v-else class="auto-element-fallback">{{ node.type }}</span>
  </div>
</template>

<style scoped>
.auto-element-node {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
}

.auto-element-component {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.auto-element-component--table {
  height: 100%;
}

.auto-element-fallback {
  color: var(--lc-color-text-3);
  font-size: var(--lc-font-size-sm);
}
</style>
