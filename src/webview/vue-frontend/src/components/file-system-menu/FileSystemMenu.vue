<template>
  <div class="file-system-menu h-full flex bg-white dark:bg-gray-900">
    <!-- Connection Status Banner -->
    <div 
      v-if="!isConnected" 
      class="absolute top-0 left-0 right-0 z-50 bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {{ connectionStatusMessage }}
          </span>
        </div>
        <button
          v-if="canReconnect"
          @click="handleReconnect"
          class="text-sm bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
        >
          Reconnect
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex flex-1" :class="{ 'pt-12': !isConnected }">
      <!-- File Tree Panel with Error Boundary -->
      <ErrorBoundary
        :fallback-component="TreePanelErrorFallback"
        @error="handleTreePanelError"
      >
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
            @open-in-editor="handleOpenInEditor"
          />
        </div>
      </ErrorBoundary>

      <!-- Resize Handle -->
      <div
        class="resize-handle w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
        @mousedown="startResize"
        :class="{ 'opacity-50 cursor-not-allowed': !isConnected }"
      ></div>

      <!-- File Preview Panel with Error Boundary -->
      <ErrorBoundary
        :fallback-component="PreviewPanelErrorFallback"
        @error="handlePreviewPanelError"
      >
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
      </ErrorBoundary>
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

    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 bg-white dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center z-40"
    >
      <div class="text-center">
        <LoadingSpinner class="w-8 h-8 mx-auto mb-2" />
        <p class="text-sm text-gray-600 dark:text-gray-400">Loading file system...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFileSystemMenuStore } from '../../stores/fileSystemMenu'
import { useConnectionStore, useUIStore } from '../../stores'
import { captureError, createAppError } from '../../services/error-handler'
import type { FileSystemMenuProps, ContextMenuEvent, ContextMenuAction } from './types'

import FileTreePanel from './FileTreePanel.vue'
import FilePreviewPanel from './FilePreviewPanel.vue'
import ContextMenu from './ContextMenu.vue'
import ErrorBoundary from '../common/ErrorBoundary.vue'
import LoadingSpinner from '../common/LoadingSpinner.vue'

// Props
const props = withDefaults(defineProps<FileSystemMenuProps>(), {
  initialPath: '.',
  showPreview: true,
  allowMultiSelect: false,
  height: '100%'
})

// Composables
const fileSystemMenuStore = useFileSystemMenuStore()
const connectionStore = useConnectionStore()
const uiStore = useUIStore()

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
const isConnected = computed(() => connectionStore.isConnected)
const isLoading = computed(() => fileSystemMenuStore.isLoading)
const canReconnect = computed(() => connectionStore.canReconnect)

const connectionStatusMessage = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connecting':
      return 'Connecting to VS Code...'
    case 'reconnecting':
      return `Reconnecting... (attempt ${connectionStore.reconnectAttempts})`
    case 'disconnected':
      return 'Disconnected from VS Code. Some features may not work.'
    case 'error':
      return 'Connection error. Please check VS Code extension.'
    default:
      return 'Not connected to VS Code'
  }
})

const contextMenuActions = computed((): ContextMenuAction[] => {
  const node = contextMenu.value.node
  if (!node) return []

  const baseActions: ContextMenuAction[] = [
    {
      id: 'copy-path',
      label: 'Copy Path',
      icon: 'copy',
      shortcut: 'Ctrl+C',
      disabled: !isConnected.value
    },
    {
      id: 'copy-relative-path',
      label: 'Copy Relative Path',
      icon: 'copy',
      disabled: !isConnected.value
    }
  ]

  if (node.type === 'file') {
    baseActions.push(
      {
        id: 'copy-content',
        label: 'Copy File Content',
        icon: 'file-text',
        shortcut: 'Ctrl+Shift+C',
        disabled: !isConnected.value
      },
      { id: 'separator-1', separator: true, label: '', icon: '' },
      {
        id: 'open-editor',
        label: 'Open in Editor',
        icon: 'edit',
        shortcut: 'Enter',
        disabled: !isConnected.value
      },
      {
        id: 'reveal-explorer',
        label: 'Reveal in Explorer',
        icon: 'folder-open',
        disabled: !isConnected.value
      }
    )
  } else {
    baseActions.push(
      { id: 'separator-1', separator: true, label: '', icon: '' },
      {
        id: 'reveal-explorer',
        label: 'Reveal in Explorer',
        icon: 'folder-open',
        disabled: !isConnected.value
      }
    )
  }

  return baseActions
})

// Error Fallback Components
const TreePanelErrorFallback = {
  template: `
    <div class="h-full flex items-center justify-center p-4">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 1v6m8-6v6" />
        </svg>
        <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">File Tree Error</h3>
        <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">Unable to load file tree</p>
        <button
          @click="$emit('retry')"
          class="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  `
}

const PreviewPanelErrorFallback = {
  template: `
    <div class="h-full flex items-center justify-center p-4">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">Preview Error</h3>
        <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">Unable to load file preview</p>
        <button
          @click="$emit('retry')"
          class="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  `
}

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

const handleOpenInEditor = async (path: string) => {
  if (!isConnected.value) {
    uiStore.addNotification('Not connected to VS Code', 'warning')
    return
  }

  try {
    await fileSystemMenuStore.openInEditor(path)
  } catch (error) {
    console.error('Failed to open file in editor:', error)
    // Error notification is already handled in the store
  }
}

const handleReconnect = async () => {
  try {
    await connectionStore.connect(connectionStore.serverUrl)
  } catch (error) {
    console.error('Failed to reconnect:', error)
    uiStore.addNotification('Failed to reconnect to VS Code', 'error')
  }
}

const handleTreePanelError = (error: Error, errorInfo: any) => {
  const appError = createAppError(
    `File Tree Panel Error: ${error.message}`,
    'ui',
    'medium',
    {
      component: 'FileTreePanel',
      action: 'tree_panel_error',
      errorInfo
    },
    {
      title: 'File Tree Error',
      message: 'The file tree panel encountered an error. You can try refreshing or continue using other features.',
      reportable: true
    }
  )
  
  captureError(appError)
}

const handlePreviewPanelError = (error: Error, errorInfo: any) => {
  const appError = createAppError(
    `File Preview Panel Error: ${error.message}`,
    'ui',
    'medium',
    {
      component: 'FilePreviewPanel',
      action: 'preview_panel_error',
      errorInfo
    },
    {
      title: 'File Preview Error',
      message: 'The file preview panel encountered an error. You can try selecting a different file or continue browsing.',
      reportable: true
    }
  )
  
  captureError(appError)
}

// Resize functionality
const startResize = (event: MouseEvent) => {
  if (!isConnected.value) return // Disable resize when disconnected
  
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
  try {
    // Load persisted split pane size
    splitPaneSize.value = fileSystemMenuStore.splitPaneSize

    // Set up keyboard event listeners
    document.addEventListener('keydown', handleKeydown)

    // Initialize file system menu
    await fileSystemMenuStore.initialize(props.initialPath)
  } catch (error) {
    console.error('Failed to initialize file system menu:', error)
    
    const appError = createAppError(
      `File System Menu Initialization Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ui',
      'high',
      {
        component: 'FileSystemMenu',
        action: 'initialization_error',
        additionalData: { initialPath: props.initialPath }
      },
      {
        title: 'Initialization Error',
        message: 'Failed to initialize the file system menu. Please try refreshing the page.',
        reportable: true,
        recoveryActions: [
          {
            label: 'Refresh Page',
            action: () => window.location.reload(),
            primary: true
          }
        ]
      }
    )
    
    captureError(appError)
    uiStore.addNotification('Failed to initialize file system menu', 'error', false)
  }
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