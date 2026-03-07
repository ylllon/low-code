<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'

export interface ContextMenuItem {
  key: string
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    x: number
    y: number
    items: ContextMenuItem[]
    minWidth?: number
    closeOnSelect?: boolean
  }>(),
  {
    minWidth: 130,
    closeOnSelect: true
  }
)

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', item: ContextMenuItem): void
  (e: 'close'): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const menuLeft = ref(0)
const menuTop = ref(0)

/**
 * 将菜单定位到传入坐标，并做视口边界裁剪。
 * 这样可以保证菜单始终在可视区域内，不会被窗口边缘截断。
 */
function updateMenuPosition() {
  if (typeof window === 'undefined') {
    return
  }

  const viewportPadding = 8
  const width = menuRef.value?.offsetWidth || props.minWidth
  const height = menuRef.value?.offsetHeight || 40

  const maxLeft = window.innerWidth - width - viewportPadding
  const maxTop = window.innerHeight - height - viewportPadding

  menuLeft.value = Math.min(props.x, Math.max(viewportPadding, maxLeft))
  menuTop.value = Math.min(props.y, Math.max(viewportPadding, maxTop))
}

function closeMenu() {
  emit('update:visible', false)
  emit('close')
}

// 点击菜单项时向外抛出事件；根据配置决定是否自动关闭菜单。
function handleMenuItemClick(item: ContextMenuItem) {
  if (item.disabled) {
    return
  }

  emit('select', item)
  if (props.closeOnSelect) {
    closeMenu()
  }
}

// 在捕获阶段监听全局点击，支持“点击空白区域关闭”。
function onGlobalPointerDown(event: PointerEvent) {
  if (!props.visible) {
    return
  }

  const menuEl = menuRef.value
  if (!menuEl) {
    closeMenu()
    return
  }

  if (!menuEl.contains(event.target as Node)) {
    closeMenu()
  }
}

// Esc 关闭，和常见桌面应用交互保持一致。
function onGlobalKeydown(event: KeyboardEvent) {
  if (!props.visible) {
    return
  }
  if (event.key === 'Escape') {
    closeMenu()
  }
}

// 页面滚动时关闭菜单，避免锚点位置和视觉位置不一致。
function onGlobalScroll() {
  if (!props.visible) {
    return
  }
  closeMenu()
}

function bindGlobalListeners() {
  window.addEventListener('pointerdown', onGlobalPointerDown, true)
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('scroll', onGlobalScroll, true)
}

function unbindGlobalListeners() {
  window.removeEventListener('pointerdown', onGlobalPointerDown, true)
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('scroll', onGlobalScroll, true)
}

// 根据 visible 生命周期管理全局监听，避免内存泄漏。
watch(
  () => props.visible,
  (visible) => {
    if (typeof window === 'undefined') {
      return
    }

    if (visible) {
      bindGlobalListeners()
      nextTick(() => updateMenuPosition())
      return
    }

    unbindGlobalListeners()
  }
)

// 坐标或菜单内容变化时，重新计算定位（例如菜单高度变化）。
watch(
  () => [props.x, props.y, props.items.length],
  () => {
    if (!props.visible) {
      return
    }
    nextTick(() => updateMenuPosition())
  }
)

onUnmounted(() => {
  if (typeof window === 'undefined') {
    return
  }
  unbindGlobalListeners()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="context-menu"
      :style="{ left: `${menuLeft}px`, top: `${menuTop}px`, minWidth: `${minWidth}px` }"
      @contextmenu.prevent.stop
    >
      <button
        v-for="item in items"
        :key="item.key"
        class="context-menu-item"
        :class="{ disabled: item.disabled }"
        type="button"
        :disabled="item.disabled"
        @click.stop="handleMenuItemClick(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 3000;
  padding: 6px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--color-gray-300);
  box-shadow:
    0 8px 24px rgb(31 35 41 / 14%),
    0 2px 8px rgb(31 35 41 / 10%);
}

.context-menu-item {
  width: 100%;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-gray-900);
  font-size: var(--font-size-small);
  text-align: left;
  padding: 0 10px;
  cursor: pointer;
}

.context-menu-item:hover:not(.disabled) {
  background: rgb(101 146 183 / 12%);
  color: var(--color-primary);
}

.context-menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
