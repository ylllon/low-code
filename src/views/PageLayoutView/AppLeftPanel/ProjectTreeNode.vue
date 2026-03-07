<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ContextMenu.vue'
import type {
  CreateFileInDirectoryFn,
  DeleteUnsavedFileNodeFn,
  LoadDirectoryFn,
  ProjectNode,
  SelectFileNodeFn
} from '@/views/PageLayoutView/AppLeftPanel/project-tree.types'

defineOptions({
  name: 'ProjectTreeNode'
})

const props = withDefaults(
  defineProps<{
    node: ProjectNode
    level?: number
    loadDirectory: LoadDirectoryFn
    createFileNode: CreateFileInDirectoryFn
    deleteUnsavedFileNode: DeleteUnsavedFileNodeFn
    selectFileNode: SelectFileNodeFn
    activeFilePath: string
  }>(),
  {
    level: 0
  }
)

const isDirectory = computed(() => props.node.type === 'directory')
const isUnsavedFile = computed(() => props.node.type === 'file' && !!props.node.isUnsaved)
const isLowCodeGeneratedFile = computed(() => props.node.type === 'file' && !!props.node.isLowCodeGenerated)
const isActiveFile = computed(() => props.node.type === 'file' && props.activeFilePath === props.node.relativePath)
const hasChildren = computed(() => (props.node.children?.length || 0) > 0)

// 保持目录默认收起，避免首次渲染即触发大量读取。
const defaultOpen = computed(() => false)

// 目录本身的 details 节点引用，用于创建文件后自动展开。
const detailsRef = ref<HTMLDetailsElement | null>(null)

// 新建页面弹窗状态。
const createDialogVisible = ref(false)
const newPageFileName = ref('')
const newPageError = ref('')
const newPageInputRef = ref<any>(null)

// 右键菜单状态（定位点由鼠标坐标驱动）。
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuItems = computed<ContextMenuItem[]>(() => {
  if (isDirectory.value) {
    return [
      {
        key: 'create-page',
        label: '新建页面'
      }
    ]
  }

  if (isUnsavedFile.value) {
    return [
      {
        key: 'delete-unsaved-file',
        label: '删除未保存文件'
      }
    ]
  }

  return []
})

/**
 * 目录节点展开时触发懒加载。
 * 注意使用 currentTarget，保证拿到当前 details 节点本身。
 */
async function onDirectoryToggle(event: Event) {
  if (!isDirectory.value) {
    return
  }

  const detailsElement = event.currentTarget as HTMLDetailsElement
  if (!detailsElement.open) {
    return
  }

  await props.loadDirectory(props.node)
}

/**
 * 打开右键菜单。
 * 菜单以鼠标坐标为锚点，ContextMenu 内部会自动做边界裁剪。
 */
function openContextMenu(event: MouseEvent) {
  if (!contextMenuItems.value.length) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const menuOffset = 8
  contextMenuX.value = event.clientX + menuOffset
  contextMenuY.value = event.clientY + menuOffset
  contextMenuVisible.value = true
}

/**
 * 处理右键菜单命令。
 */
function handleContextMenuSelect(item: ContextMenuItem) {
  if (item.key === 'create-page') {
    openCreatePageDialog()
    return
  }

  if (item.key === 'delete-unsaved-file') {
    void removeUnsavedFileNode()
  }
}

/**
 * 打开“新建页面”弹窗。
 */
function openCreatePageDialog() {
  newPageFileName.value = ''
  newPageError.value = ''
  createDialogVisible.value = true

  nextTick(() => {
    newPageInputRef.value?.focus?.()
  })
}

/**
 * 新建页面：在当前目录节点下追加一个文件节点。
 * 这里只更新前端树节点，不会写入磁盘。
 */
async function confirmCreatePage() {
  if (!isDirectory.value) {
    return
  }

  const fileName = newPageFileName.value.trim()
  if (!fileName) {
    newPageError.value = '请输入文件名称'
    return
  }

  // 基础非法字符拦截，避免生成无效文件名。
  if (/[\\/:*?"<>|]/.test(fileName)) {
    newPageError.value = '文件名不能包含 \\/:*?"<>| 这些字符'
    return
  }

  const createResult = await props.createFileNode(props.node, fileName)
  if (!createResult.ok) {
    newPageError.value = createResult.message || '创建失败'
    return
  }

  // 创建成功后自动展开目录，方便用户立即看到新节点。
  if (detailsRef.value && !detailsRef.value.open) {
    detailsRef.value.open = true
  }

  createDialogVisible.value = false
}

/**
 * 弹窗关闭时清理输入和错误提示。
 */
function onCreateDialogClosed() {
  newPageFileName.value = ''
  newPageError.value = ''
}

/**
 * 删除未落盘文件节点（仅删除前端临时树节点）。
 */
async function removeUnsavedFileNode() {
  if (!isUnsavedFile.value) {
    return
  }

  await props.deleteUnsavedFileNode(props.node)
}

/**
 * 文件节点右键处理：
 * - 未落盘文件：打开自定义菜单（支持删除）
 * - 已落盘文件：保留浏览器默认右键行为
 */
function onFileContextMenu(event: MouseEvent) {
  if (!isUnsavedFile.value) {
    return
  }

  openContextMenu(event)
}

/**
 * 点击文件节点，通知外层刷新中间编辑器内容。
 */
function onFileClick() {
  if (props.node.type !== 'file') {
    return
  }

  props.selectFileNode(props.node)
}
</script>

<template>
  <li class="tree-node">
    <template v-if="isDirectory">
      <details ref="detailsRef" :open="defaultOpen" class="tree-directory" @toggle="onDirectoryToggle">
        <summary class="tree-summary" :title="node.relativePath">
          <!--
            目录右键菜单：
            1) @contextmenu.prevent.stop 禁止浏览器默认菜单
            2) 由通用 ContextMenu 组件负责菜单显示与关闭行为
          -->
          <span class="directory-trigger" @contextmenu.prevent.stop="openContextMenu">
            <span class="expand-arrow" aria-hidden="true"></span>
            <span class="folder-icon" aria-hidden="true"></span>
            <span class="node-label directory">{{ node.name }}</span>
            <span v-if="node.loading" class="node-status">读取中...</span>
          </span>
        </summary>

        <div v-if="node.loadError" class="node-error">{{ node.loadError }}</div>

        <!-- 展开目录但尚未返回 children 时，显示轻量骨架屏占位 -->
        <div v-if="node.loading" class="skeleton-list" aria-hidden="true">
          <div
            v-for="index in 3"
            :key="`${node.relativePath}-skeleton-${index}`"
            class="skeleton-row"
          >
            <span class="skeleton-icon"></span>
            <span class="skeleton-line"></span>
          </div>
        </div>

        <ul v-else-if="hasChildren" class="tree-children">
          <ProjectTreeNode
            v-for="child in node.children"
            :key="child.relativePath"
            :node="child"
            :level="level + 1"
            :load-directory="loadDirectory"
            :create-file-node="createFileNode"
            :delete-unsaved-file-node="deleteUnsavedFileNode"
            :select-file-node="selectFileNode"
            :active-file-path="activeFilePath"
          />
        </ul>

        <div v-else-if="node.loaded && !node.loading" class="empty-directory">空目录</div>

        <div v-if="node.truncated" class="truncate-hint">目录过深或子项过多，已截断展示</div>
      </details>

      <ContextMenu
        v-model:visible="contextMenuVisible"
        :x="contextMenuX"
        :y="contextMenuY"
        :items="contextMenuItems"
        @select="handleContextMenuSelect"
      />

      <el-dialog
        v-model="createDialogVisible"
        title="新建页面"
        width="420px"
        append-to-body
        @closed="onCreateDialogClosed"
      >
        <el-input
          ref="newPageInputRef"
          v-model.trim="newPageFileName"
          placeholder="请输入文件名称，例如 HomePage.vue"
          @keyup.enter="confirmCreatePage"
        />
        <p v-if="newPageError" class="dialog-error">{{ newPageError }}</p>

        <template #footer>
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmCreatePage">确认</el-button>
        </template>
      </el-dialog>
    </template>

    <div
      v-else
      class="tree-file-row"
      :class="{ unsaved: isUnsavedFile, generated: isLowCodeGeneratedFile, active: isActiveFile }"
      :title="node.relativePath"
      @click="onFileClick"
      @contextmenu="onFileContextMenu"
    >
      <span class="file-icon" aria-hidden="true"></span>
      <span class="node-label file">{{ node.name }}</span>
      <span v-if="isLowCodeGeneratedFile" class="generated-badge">低码</span>
      <span v-if="isUnsavedFile" class="unsaved-badge">未保存</span>
    </div>

    <ContextMenu
      v-if="isUnsavedFile"
      v-model:visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :items="contextMenuItems"
      @select="handleContextMenuSelect"
    />
  </li>
</template>

<style scoped>
.tree-node {
  list-style: none;
}

.tree-directory {
  margin: 2px 0;
}

.tree-summary {
  cursor: pointer;
  user-select: none;
  padding: 3px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tree-summary::-webkit-details-marker {
  display: none;
}

.expand-arrow {
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 6px solid var(--color-gray-700);
  transition: transform 0.15s ease;
  transform-origin: 30% 50%;
}

.tree-directory[open] > .tree-summary .expand-arrow {
  transform: rotate(90deg);
}

.directory-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.folder-icon {
  position: relative;
  width: 14px;
  height: 10px;
  border: 1px solid #8aa4bc;
  border-radius: 2px;
  background: #d9ecff;
  flex-shrink: 0;
}

.folder-icon::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 1px;
  width: 7px;
  height: 4px;
  border: 1px solid #8aa4bc;
  border-bottom: none;
  border-radius: 2px 2px 0 0;
  background: #e7f3ff;
}

.node-status {
  font-size: 12px;
  color: var(--color-gray-700);
}

.node-error {
  padding: 2px 0 2px 18px;
  font-size: 12px;
  color: #d93025;
}

.tree-children {
  margin: 0;
  padding: 0 0 0 16px;
}

.tree-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  border-radius: 6px;
}

.tree-file-row.unsaved {
  background: rgb(255 243 219 / 60%);
  padding: 4px 6px;
}

.tree-file-row.generated:not(.unsaved) {
  background: rgb(59 130 246 / 9%);
  padding: 4px 6px;
}

.tree-file-row.active {
  background: rgb(101 146 183 / 14%);
  padding: 4px 6px;
}

.file-icon {
  position: relative;
  width: 10px;
  height: 12px;
  border: 1px solid #8fa4b8;
  border-radius: 2px;
  background: #f4f8fc;
  flex-shrink: 0;
}

.file-icon::before {
  content: '';
  position: absolute;
  right: -1px;
  top: -1px;
  width: 4px;
  height: 4px;
  border-top: 1px solid #8fa4b8;
  border-right: 1px solid #8fa4b8;
  background: #fff;
  transform: translate(0, 0);
}

.node-label {
  font-size: var(--font-size-small);
  line-height: 1.5;
  color: var(--color-gray-800);
  word-break: break-all;
}

.node-label.directory {
  color: var(--color-gray-900);
  font-weight: var(--font-weight-bold);
}

.tree-file-row.unsaved .node-label.file {
  color: #a45f00;
  font-weight: 600;
}

.tree-file-row.unsaved .file-icon {
  border-color: #d5a95b;
  background: #fff3d6;
}

.tree-file-row.generated:not(.unsaved) .node-label.file {
  color: #0f4ba8;
  font-weight: 600;
}

.tree-file-row.generated:not(.unsaved) .file-icon {
  border-color: #83a8df;
  background: #e9f2ff;
}

.generated-badge {
  margin-left: auto;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  border-radius: 999px;
  font-size: 11px;
  color: #0a4a9a;
  background: #deecff;
  border: 1px solid #a7c7f5;
}

.unsaved-badge {
  margin-left: 6px;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  border-radius: 999px;
  font-size: 11px;
  color: #a45f00;
  background: #ffe7ba;
  border: 1px solid #f5c77b;
}

.empty-directory,
.truncate-hint {
  padding: 2px 0 2px 18px;
  font-size: 12px;
  color: var(--color-gray-700);
}

.skeleton-list {
  padding: 4px 0 4px 18px;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.skeleton-icon {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    rgb(222 228 236 / 90%) 0%,
    rgb(243 246 250 / 100%) 45%,
    rgb(222 228 236 / 90%) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-wave 1.1s linear infinite;
}

.skeleton-line {
  width: 120px;
  max-width: 75%;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgb(222 228 236 / 90%) 0%,
    rgb(243 246 250 / 100%) 45%,
    rgb(222 228 236 / 90%) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-wave 1.1s linear infinite;
}

.dialog-error {
  margin-top: 8px;
  color: #d93025;
  font-size: 12px;
}

@keyframes skeleton-wave {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
</style>
