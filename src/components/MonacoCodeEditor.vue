<script setup lang="ts">
import loader from '@monaco-editor/loader'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type * as Monaco from 'monaco-editor'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: string
    theme?: string
    readOnly?: boolean
  }>(),
  {
    language: 'plaintext',
    theme: 'vs',
    readOnly: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'editor-ready'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let monacoInstance: typeof Monaco | null = null
let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null
let disposed = false
let suppressModelEmit = false

/**
 * 初始化 Monaco 编辑器实例。
 * 说明：使用 @monaco-editor/loader，可避免在业务组件中处理复杂加载流程。
 */
async function initEditor() {
  if (!containerRef.value) {
    return
  }

  const monaco = await loader.init()
  if (disposed || !containerRef.value) {
    return
  }

  monacoInstance = monaco
  monaco.editor.setTheme(props.theme)

  editorInstance = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    automaticLayout: true,
    wordWrap: 'on',
    tabSize: 2,
    minimap: {
      enabled: false
    },
    fontSize: 13,
    lineNumbersMinChars: 3,
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    formatOnPaste: true,
    formatOnType: true,
    folding: true
  })

  editorInstance.onDidChangeModelContent(() => {
    if (!editorInstance || suppressModelEmit) {
      return
    }

    emit('update:modelValue', editorInstance.getValue())
  })

  emit('editor-ready')
}

function layout() {
  editorInstance?.layout()
}

function focus() {
  editorInstance?.focus()
}

defineExpose({
  layout,
  focus
})

watch(
  () => props.modelValue,
  (nextValue) => {
    if (!editorInstance) {
      return
    }

    const currentValue = editorInstance.getValue()
    if (currentValue === nextValue) {
      return
    }

    suppressModelEmit = true
    editorInstance.setValue(nextValue)
    suppressModelEmit = false
  }
)

watch(
  () => props.language,
  (language) => {
    if (!editorInstance || !monacoInstance || !language) {
      return
    }

    const model = editorInstance.getModel()
    if (!model) {
      return
    }

    monacoInstance.editor.setModelLanguage(model, language)
  }
)

watch(
  () => props.theme,
  (theme) => {
    if (!monacoInstance) {
      return
    }

    monacoInstance.editor.setTheme(theme)
  }
)

watch(
  () => props.readOnly,
  (readOnly) => {
    editorInstance?.updateOptions({
      readOnly
    })
  }
)

onMounted(() => {
  void initEditor()
})

onUnmounted(() => {
  disposed = true
  editorInstance?.dispose()
  editorInstance = null
})
</script>

<template>
  <div ref="containerRef" class="monaco-editor-wrapper"></div>
</template>

<style scoped>
.monaco-editor-wrapper {
  width: 100%;
  height: 100%;
}
</style>

