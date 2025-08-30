<template>
  <div class="file-explorer h-full responsive-grid file-explorer-grid bg-white dark:bg-gray-900 pt-safe" :class="{ 'mobile-layout': isMobile, 'tablet-layout': isTablet }">
    <!-- Header with search and actions -->
    <div class="file-explorer-header mobile:col-span-full tablet:col-span-2 desktop:col-span-3 p-safe border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-responsive font-semibold text-gray-900 dark:text-white">
          File Explorer
        </h2>
        <div class="flex items-center gap-2">
          <button
            @click="refreshTree"
            :disabled="isLoading"
            class="touch-friendly mobile-button p-3 md:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 rounded-lg"
            title="Refresh"
          >
            <svg class="w-5 h-5 md:w-4 md:h-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            @click="showCreateDialog = true"
            class="touch-friendly mobile-button p-3 md:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
            title="Create File/Folder"
          >
            <svg class="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="relative">
        <input
          v-model="searchQuery"
          @input="handleSearch"
          type="text"
          placeholder="Search files and folders..."
          class="mobile-input w-full pl-12 pr-12 py-3 md:py-2 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
        <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 md:w-4 md:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-target"
        >
          <svg class="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Filter options -->
      <div v-if="showFilters" class="mt-3 flex flex-col md:flex-row flex-wrap gap-3 md:gap-2">
        <select
          v-model="filterOptions.sortBy"
          @change="applyFilters"
          class="mobile-input text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="name">Sort by Name</option>
          <option value="modified">Sort by Modified</option>
          <option value="size">Sort by Size</option>
          <option value="type">Sort by Type</option>
        </select>
        <select
          v-model="filterOptions.sortOrder"
          @change="applyFilters"
          class="mobile-input text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
        <label class="flex items-center text-base md:text-sm text-gray-700 dark:text-gray-300 touch-target">
          <input
            v-model="filterOptions.showHidden"
            @change="applyFilters"
            type="checkbox"
            class="mr-3 w-5 h-5 md:w-4 md:h-4"
          >
          Show Hidden
        </label>
      </div>

      <div class="flex items-center justify-between mt-3">
        <button
          @click="showFilters = !showFilters"
          class="touch-friendly text-base md:text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 px-3 rounded-lg"
        >
          {{ showFilters ? 'Hide Filters' : 'Show Filters' }}
        </button>
        
        <!-- Debug button -->
        <button
          @click="testConnection"
          :disabled="isLoading"
          class="touch-friendly text-sm md:text-xs px-3 py-2 md:px-2 md:py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
          :title="`Test WebSocket Connection (${currentBreakpoint})`"
        >
          🔧 Debug
        </button>
      </div>
    </div>

    <!-- File tree -->
    <div class="file-tree mobile:col-span-full tablet:col-span-2 desktop:col-span-3 scroll-mobile overflow-auto pb-safe">
      <FileTree
        :nodes="displayedNodes"
        :selected-path="selectedPath"
        :loading-paths="loadingPaths"
        @select="handleNodeSelect"
        @expand="handleNodeExpand"
        @collapse="handleNodeCollapse"
        @context-menu="handleContextMenu"
      />
    </div>

    <!-- Context menu -->
    <div
      v-if="contextMenu.show"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      class="fixed z-modal bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-mobile-lg py-2 min-w-48 md:min-w-40"
      @click.stop
    >
      <button
        v-if="contextMenu.node?.type === 'file'"
        @click="openFile(contextMenu.node)"
        class="touch-friendly w-full text-left px-4 py-3 md:py-2 text-base md:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mx-1"
      >
        Open File
      </button>
      <button
        @click="showRenameDialog = true; closeContextMenu()"
        class="touch-friendly w-full text-left px-4 py-3 md:py-2 text-base md:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mx-1"
      >
        Rename
      </button>
      <button
        @click="copyPath(contextMenu.node?.path)"
        class="touch-friendly w-full text-left px-4 py-3 md:py-2 text-base md:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mx-1"
      >
        Copy Path
      </button>
      <hr class="my-2 border-gray-200 dark:border-gray-600">
      <button
        @click="deleteNode(contextMenu.node)"
        class="touch-friendly w-full text-left px-4 py-3 md:py-2 text-base md:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mx-1"
      >
        Delete
      </button>
    </div>

    <!-- Create dialog -->
    <div v-if="showCreateDialog" class="mobile-modal bg-black bg-opacity-50">
      <div class="mobile-modal-content bg-white dark:bg-gray-800 p-6 w-full max-w-md mx-4">
        <h3 class="text-responsive font-semibold mb-4 text-gray-900 dark:text-white">Create New</h3>
        <div class="space-y-4">
          <div class="flex flex-col md:flex-row gap-4">
            <label class="flex items-center touch-target">
              <input v-model="createType" type="radio" value="file" class="mr-3 w-5 h-5">
              <span class="text-base md:text-sm text-gray-700 dark:text-gray-300">File</span>
            </label>
            <label class="flex items-center touch-target">
              <input v-model="createType" type="radio" value="directory" class="mr-3 w-5 h-5">
              <span class="text-base md:text-sm text-gray-700 dark:text-gray-300">Folder</span>
            </label>
          </div>
          <input
            v-model="createName"
            @keyup.enter="handleCreate"
            type="text"
            :placeholder="`${createType === 'file' ? 'File' : 'Folder'} name`"
            class="mobile-input w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            ref="createInput"
          >
        </div>
        <div class="flex flex-col md:flex-row justify-end gap-3 mt-6">
          <button
            @click="showCreateDialog = false; createName = ''"
            class="mobile-button touch-friendly px-6 py-3 md:px-4 md:py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            @click="handleCreate"
            :disabled="!createName.trim()"
            class="mobile-button touch-friendly px-6 py-3 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Rename dialog -->
    <div v-if="showRenameDialog" class="mobile-modal bg-black bg-opacity-50">
      <div class="mobile-modal-content bg-white dark:bg-gray-800 p-6 w-full max-w-md mx-4">
        <h3 class="text-responsive font-semibold mb-4 text-gray-900 dark:text-white">Rename</h3>
        <input
          v-model="renameName"
          @keyup.enter="handleRename"
          type="text"
          placeholder="New name"
          class="mobile-input w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          ref="renameInput"
        >
        <div class="flex flex-col md:flex-row justify-end gap-3 mt-6">
          <button
            @click="showRenameDialog = false; renameName = ''"
            class="mobile-button touch-friendly px-6 py-3 md:px-4 md:py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600"
          >
            Cancel
          </button>
          <button
            @click="handleRename"
            :disabled="!renameName.trim()"
            class="mobile-button touch-friendly px-6 py-3 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Rename
          </button>
        </div>
      </div>
    </div>

    <!-- Notification toast -->
    <NotificationToast
      v-if="notification.show"
      :message="notification.message"
      :type="notification.type"
      @close="notification.show = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useFileSystem } from '../../composables/useFileSystem'
import { useBreakpoints } from '../../composables/useBreakpoints'
import { connectionService } from '../../services/connection'
import { useConnectionStore } from '../../stores/connection'
import type { FileSystemNode, FileFilterOptions } from '../../types/filesystem'
import FileTree from './FileTree.vue'
import NotificationToast from '../common/NotificationToast.vue'

// Composables
const fileSystem = useFileSystem()
const connectionStore = useConnectionStore()
const breakpoints = useBreakpoints()

// State
const searchQuery = ref('')
const showFilters = ref(false)
const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const createType = ref<'file' | 'directory'>('file')
const createName = ref('')
const renameName = ref('')
const createInput = ref<HTMLInputElement>()
const renameInput = ref<HTMLInputElement>()

const filterOptions = ref<FileFilterOptions>({
  showHidden: false,
  sortBy: 'name',
  sortOrder: 'asc'
})

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  node: null as FileSystemNode | null
})

const notification = ref({
  show: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'error' | 'warning'
})

// Computed
const displayedNodes = computed(() => {
  let nodes = Array.from(fileSystem.fileTree.value.nodes.values())
    .filter(node => !node.parent) // Only root nodes

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    nodes = nodes.filter(node => 
      node.name.toLowerCase().includes(query) ||
      node.path.toLowerCase().includes(query)
    )
  }

  // Apply other filters
  return fileSystem.filterNodes(filterOptions.value).filter(node => 
    nodes.some(n => n.path === node.path)
  )
})

const selectedPath = computed(() => fileSystem.fileTree.value.selectedPath)
const loadingPaths = computed(() => fileSystem.fileTree.value.loadingPaths)
const isLoading = computed(() => fileSystem.isLoading.value)

// Responsive state
const isMobile = computed(() => breakpoints.isMobile.value)
const isTablet = computed(() => breakpoints.isTablet.value)
const currentBreakpoint = computed(() => breakpoints.current.value)

// Methods
const refreshTree = async () => {
  try {
    await fileSystem.refreshFileTree()
    showNotification('File tree refreshed', 'success')
  } catch (error) {
    showNotification('Failed to refresh file tree', 'error')
  }
}

const handleSearch = () => {
  // Search is handled by computed property
}

const clearSearch = () => {
  searchQuery.value = ''
}

const applyFilters = () => {
  // Filters are applied by computed property
}

const handleNodeSelect = (node: FileSystemNode) => {
  fileSystem.selectNode(node.path)
}

const handleNodeExpand = async (node: FileSystemNode) => {
  try {
    await fileSystem.expandNode(node.path)
  } catch (error) {
    showNotification('Failed to expand folder', 'error')
  }
}

const handleNodeCollapse = (node: FileSystemNode) => {
  fileSystem.collapseNode(node.path)
}

const handleContextMenu = (event: { node: FileSystemNode; x: number; y: number }) => {
  contextMenu.value = {
    show: true,
    x: event.x,
    y: event.y,
    node: event.node
  }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
}

const openFile = (node: FileSystemNode) => {
  // Emit event to parent or use router to open file
  // For now, just select the node
  handleNodeSelect(node)
  closeContextMenu()
}

const copyPath = async (path?: string) => {
  if (!path) return
  
  try {
    await navigator.clipboard.writeText(path)
    showNotification('Path copied to clipboard', 'success')
  } catch (error) {
    showNotification('Failed to copy path', 'error')
  }
  closeContextMenu()
}

const handleCreate = async () => {
  if (!createName.value.trim()) return

  const basePath = selectedPath.value || '/'
  const newPath = `${basePath}/${createName.value.trim()}`

  try {
    if (createType.value === 'file') {
      await fileSystem.createFile(newPath)
      showNotification('File created successfully', 'success')
    } else {
      await fileSystem.createDirectory(newPath)
      showNotification('Folder created successfully', 'success')
    }
    
    showCreateDialog.value = false
    createName.value = ''
  } catch (error) {
    showNotification(`Failed to create ${createType.value}`, 'error')
  }
}

const handleRename = async () => {
  if (!renameName.value.trim() || !contextMenu.value.node) return

  const oldPath = contextMenu.value.node.path
  const parentPath = fileSystem.getParentPath(oldPath)
  const newPath = `${parentPath}/${renameName.value.trim()}`

  try {
    await fileSystem.renameFile(oldPath, newPath)
    showNotification('Renamed successfully', 'success')
    showRenameDialog.value = false
    renameName.value = ''
  } catch (error) {
    showNotification('Failed to rename', 'error')
  }
}

const deleteNode = async (node: FileSystemNode | null) => {
  if (!node) return

  if (!confirm(`Are you sure you want to delete "${node.name}"?`)) {
    closeContextMenu()
    return
  }

  try {
    if (node.type === 'file') {
      await fileSystem.deleteFile(node.path)
    } else {
      await fileSystem.deleteDirectory(node.path, true)
    }
    showNotification('Deleted successfully', 'success')
  } catch (error) {
    showNotification('Failed to delete', 'error')
  }
  closeContextMenu()
}

const showNotification = (message: string, type: 'info' | 'success' | 'error' | 'warning') => {
  notification.value = { show: true, message, type }
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

const testConnection = async () => {
  console.log('🔧 Debug: Testing WebSocket connection...')
  
  // Log connection status
  console.log('Connection Status:', {
    isConnected: connectionService.isConnected,
    connectionStatus: connectionStore.connectionStatus,
    serverUrl: connectionStore.serverUrl,
    lastError: connectionStore.lastError
  })
  
  // Test WebSocket directly
  const webSocket = connectionService.getWebSocket()
  console.log('WebSocket State:', {
    isConnected: webSocket.isConnected.value,
    connectionStatus: webSocket.connectionStatus.value,
    health: webSocket.health.value,
    queueSize: webSocket.queueSize.value
  })
  
  // Try to send a simple test message
  try {
    console.log('🧪 Sending test message...')
    const result = await webSocket.sendMessageWithResponse({
      type: 'command',
      command: 'test.ping',
      args: [],
      timestamp: Date.now()
    }, 5000)
    
    console.log('✅ Test message response:', result)
    showNotification('WebSocket connection test successful', 'success')
  } catch (error) {
    console.error('❌ Test message failed:', error)
    showNotification(`WebSocket test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  }
  
  // Try to load file tree with detailed logging
  try {
    console.log('📁 Testing file tree loading...')
    await fileSystem.loadFileTree('.')
    showNotification('File tree test successful', 'success')
  } catch (error) {
    console.error('❌ File tree test failed:', error)
    showNotification(`File tree test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  }
}

// Watchers
watch(showCreateDialog, async (show) => {
  if (show) {
    await nextTick()
    createInput.value?.focus()
  }
})

watch(showRenameDialog, async (show) => {
  if (show && contextMenu.value.node) {
    renameName.value = contextMenu.value.node.name
    await nextTick()
    renameInput.value?.focus()
    renameInput.value?.select()
  }
})

// Close context menu on click outside
const handleClickOutside = () => {
  if (contextMenu.value.show) {
    closeContextMenu()
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  
  try {
    await fileSystem.loadFileTree()
  } catch (error) {
    showNotification('Failed to load file tree', 'error')
  }
})
</script>

<style scoped>
.file-explorer {
  min-height: 0; /* Allow flex child to shrink */
  /* Mobile-first responsive grid */
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}

@media (min-width: 768px) {
  .file-explorer {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

@media (min-width: 1024px) {
  .file-explorer {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

.file-explorer-header {
  /* Ensure header spans full width on all breakpoints */
  grid-column: 1 / -1;
}

.file-tree {
  min-height: 0; /* Allow flex child to shrink */
  /* Mobile-optimized scrolling */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Mobile-specific responsive adjustments */
@media (max-width: 767px) {
  .file-explorer {
    padding: 0;
  }
  
  .file-explorer-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  
  .file-tree {
    padding: 0.5rem;
  }
}

/* Tablet adjustments */
@media (min-width: 768px) and (max-width: 1023px) {
  .file-explorer {
    padding: 0.5rem;
  }
}

/* Desktop adjustments */
@media (min-width: 1024px) {
  .file-explorer {
    padding: 1rem;
  }
}

/* Safe area support */
@supports (padding: env(safe-area-inset-top)) {
  .file-explorer {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}

/* Touch-friendly hover states */
@media (hover: none) and (pointer: coarse) {
  .touch-friendly:hover {
    /* Remove hover effects on touch devices */
    background-color: initial;
    color: initial;
  }
  
  .touch-friendly:active {
    /* Add active state for touch feedback */
    transform: scale(0.98);
    opacity: 0.8;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .file-explorer-header {
    border-bottom-width: 2px;
  }
  
  .mobile-input,
  .mobile-button {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .mobile-modal-content {
    animation: none;
  }
  
  .touch-friendly:active {
    transform: none;
  }
}
</style>