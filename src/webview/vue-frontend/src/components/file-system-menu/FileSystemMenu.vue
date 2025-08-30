<template>
  <div class="file-system-menu h-full flex bg-white dark:bg-gray-900">
    <!-- File Tree Panel -->
    <div 
      class="file-tree-panel border-r border-gray-200 dark:border-gray-700"
      :style="{ width: splitPaneSize + 'px' }"
    >
      <FileTreePanel
        :search-query="searchQuery"
        :selected-path="selectedPath"
        :expanded-paths="expandedPaths"
        :loading-paths="loadingPaths"
        :file-tree="fileTree"
        @select="handleNodeSelect"
        @expand="handleNodeExpand"
        @collapse="handleNodeCollapse"
        @search="handleSearch"
        @context-menu="handleContextMenu"
      />
    </div>

    <!-- Resize Handle -->
    <div
      class="resize-handle w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize"
      @mousedown="startResize"
    ></div>

    <!-- File Preview Panel -->
    <div class="file-preview-panel flex-1 min-w-0">
      <FilePreviewPanel
        :selected-path="selectedPath"
        :preview-content="previewContent"
        :loading="previewLoading"
        :error="previewError"
        :visible="previewVisible"
        @toggle-preview="togglePreview"
      />
    </div>

    <!-- Context Menu -->
    <ContextMenu
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :node="contextMenu.node"
      :actions="contextMenuActions"
      @action="handleContextAction"
      @close="closeContextMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFileSystemMenuStore } from '../../stores/fileSystemMenu'
import { useFileSystem } from '../../composables/useFileSystem'
import type { FileSystemMenuProps, ContextMenuEvent, ContextMenuAction } from './types'

import FileTreePanel from './FileTreePanel.vue'
import FilePreviewPanel from './FilePreviewPanel.vue'
import ContextMenu from './ContextMenu.vue'

// Props
const props = withDefaults(defineProps<FileSystemMenuProps>(), {
  initialPath: '.',
  showPreview: true,
  allowMultiSelect: false,
  height: '100%'
})

// Composables
const fileSystemMenuStore = useFileSystemMenuStore()
const fileSystem = useFileSystem()

// State
const splitPaneSize = ref(300)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

// Computed
const searchQuery = computed(() => fileSystemMenuStore.searchQuery)
const selectedPath = computed(() => fileSystemMenuStore.selectedPath)
const expandedPaths = computed(() => fileSystemMenuStore.expandedPaths)
const loadingPaths = computed(() => fileSystemMenuStore.loadingPaths)
const fileTree = computed(() => fileSystemMenuStore.fileTree)
const previewContent = computed(() => fileSystemMenuStore.previewContent)
const previewLoading = computed(() => fileSystemMenuStore.previewLoading)
const previewError = computed(() => fileSystemMenuStore.previewError)
const previewVisible = computed(() => fileSystemMenuStore.previewVisible)
const contextMenu = computed(() => fileSystemMenuStore.contextMenu)

const contextMenuActions = computed((): ContextMenuAction[] => {
  const node = contextMenu.value.node
  if (!node) return []

  const baseActions: ContextMenuAction[] = [
    {
      id: 'copy-path',
      label: 'Copy Path',
      icon: 'copy',
      shortcut: 'Ctrl+C'
    },
    {
      id: 'copy-relative-path',
      label: 'Copy Relative Path',
      icon: 'copy'
    }
  ]

  if (node.type === 'file') {
    baseActions.push(
      {
        id: 'copy-content',
        label: 'Copy File Content',
        icon: 'file-text',
        shortcut: 'Ctrl+Shift+C'
      },
      { id: 'separator-1', separator: true },
      {
        id: 'open-editor',
        label: 'Open in Editor',
        icon: 'edit',
        shortcut: 'Enter'
      },
      {
        id: 'reveal-explorer',
        label: 'Reveal in Explorer',
        icon: 'folder-open'
      }
    )
  } else {
    baseActions.push(
      { id: 'separator-1', separator: true },
      {
        id: 'reveal-explorer',
        label: 'Reveal in Explorer',
        icon: 'folder-open'
      }
    )
  }

  return baseActions
})

// Methods
const handleNodeSelect = (path: string) => {
  fileSystemMenuStore.selectNode(path)
}

const handleNodeExpand = (path: string) => {
  fileSystemMenuStore.expandNode(path)
}

const handleNodeCollapse = (path: string) => {
  fileSystemMenuStore.collapseNode(path)
}

const handleSearch = (query: string) => {
  fileSystemMenuStore.setSearchQuery(query)
}

const handleContextMenu = (event: ContextMenuEvent) => {
  fileSystemMenuStore.showContextMenu(event.x, event.y, event.node)
}

const handleContextAction = (actionId: string) => {
  fileSystemMenuStore.executeContextAction(actionId)
  closeContextMenu()
}

const closeContextMenu = () => {
  fileSystemMenuStore.hideContextMenu()
}

const togglePreview = () => {
  fileSystemMenuStore.togglePreview()
}

// Resize functionality
const startResize = (event: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = event.clientX
  resizeStartWidth.value = splitPaneSize.value
  
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing.value) return
  
  const deltaX = event.clientX - resizeStartX.value
  const newWidth = Math.max(200, Math.min(600, resizeStartWidth.value + deltaX))
  splitPaneSize.value = newWidth
  
  // Persist the size
  fileSystemMenuStore.setSplitPaneSize(newWidth)
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'c') {
    event.preventDefault()
    if (selectedPath.value) {
      fileSystemMenuStore.copyPath(selectedPath.value)
    }
  } else if (event.ctrlKey && event.shiftKey && event.key === 'C') {
    event.preventDefault()
    if (selectedPath.value) {
      fileSystemMenuStore.copyFileContent(selectedPath.value)
    }
  } else if (event.key === 'Enter' && selectedPath.value) {
    event.preventDefault()
    fileSystemMenuStore.openInEditor(selectedPath.value)
  } else if (event.key === ' ' && selectedPath.value) {
    event.preventDefault()
    togglePreview()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (contextMenu.value.show) {
      closeContextMenu()
    }
  } else if (event.ctrlKey && event.key === 'f') {
    event.preventDefault()
    // Focus search input - will be handled by FileTreePanel
  }
}

// Lifecycle
onMounted(async () => {
  // Load persisted split pane size
  splitPaneSize.value = fileSystemMenuStore.splitPaneSize

  // Set up keyboard event listeners
  document.addEventListener('keydown', handleKeydown)

  // Initialize file system menu
  await fileSystemMenuStore.initialize(props.initialPath)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.file-system-menu {
  min-height: 0;
}

.file-tree-panel {
  min-width: 200px;
  max-width: 600px;
}

.file-preview-panel {
  min-width: 300px;
}

.resize-handle {
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background-color: #3b82f6;
}
</style>