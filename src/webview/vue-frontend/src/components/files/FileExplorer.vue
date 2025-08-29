<template>
  <div class="file-explorer h-full flex flex-col bg-white dark:bg-gray-900">
    <!-- Header with search and actions -->
    <div class="file-explorer-header p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          File Explorer
        </h2>
        <div class="flex items-center space-x-2">
          <button
            @click="refreshTree"
            :disabled="isLoading"
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            title="Refresh"
          >
            <svg class="w-4 h-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            @click="showCreateDialog = true"
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Create File/Folder"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
        <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Filter options -->
      <div v-if="showFilters" class="mt-3 flex flex-wrap gap-2">
        <select
          v-model="filterOptions.sortBy"
          @change="applyFilters"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="name">Sort by Name</option>
          <option value="modified">Sort by Modified</option>
          <option value="size">Sort by Size</option>
          <option value="type">Sort by Type</option>
        </select>
        <select
          v-model="filterOptions.sortOrder"
          @change="applyFilters"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
        <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input
            v-model="filterOptions.showHidden"
            @change="applyFilters"
            type="checkbox"
            class="mr-1"
          >
          Show Hidden
        </label>
      </div>

      <div class="flex items-center justify-between mt-2">
        <button
          @click="showFilters = !showFilters"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {{ showFilters ? 'Hide Filters' : 'Show Filters' }}
        </button>
        
        <!-- Debug button -->
        <button
          @click="testConnection"
          :disabled="isLoading"
          class="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          title="Test WebSocket Connection"
        >
          🔧 Debug
        </button>
      </div>
    </div>

    <!-- File tree -->
    <div class="file-tree flex-1 overflow-auto">
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
      class="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-48"
      @click.stop
    >
      <button
        v-if="contextMenu.node?.type === 'file'"
        @click="openFile(contextMenu.node)"
        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Open File
      </button>
      <button
        @click="showRenameDialog = true; closeContextMenu()"
        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Rename
      </button>
      <button
        @click="copyPath(contextMenu.node?.path)"
        class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Copy Path
      </button>
      <hr class="my-1 border-gray-200 dark:border-gray-600">
      <button
        @click="deleteNode(contextMenu.node)"
        class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        Delete
      </button>
    </div>

    <!-- Create dialog -->
    <div v-if="showCreateDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Create New</h3>
        <div class="space-y-4">
          <div class="flex space-x-4">
            <label class="flex items-center">
              <input v-model="createType" type="radio" value="file" class="mr-2">
              <span class="text-gray-700 dark:text-gray-300">File</span>
            </label>
            <label class="flex items-center">
              <input v-model="createType" type="radio" value="directory" class="mr-2">
              <span class="text-gray-700 dark:text-gray-300">Folder</span>
            </label>
          </div>
          <input
            v-model="createName"
            @keyup.enter="handleCreate"
            type="text"
            :placeholder="`${createType === 'file' ? 'File' : 'Folder'} name`"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            ref="createInput"
          >
        </div>
        <div class="flex justify-end space-x-3 mt-6">
          <button
            @click="showCreateDialog = false; createName = ''"
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            @click="handleCreate"
            :disabled="!createName.trim()"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Rename dialog -->
    <div v-if="showRenameDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Rename</h3>
        <input
          v-model="renameName"
          @keyup.enter="handleRename"
          type="text"
          placeholder="New name"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          ref="renameInput"
        >
        <div class="flex justify-end space-x-3 mt-6">
          <button
            @click="showRenameDialog = false; renameName = ''"
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            @click="handleRename"
            :disabled="!renameName.trim()"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
import { connectionService } from '../../services/connection'
import { useConnectionStore } from '../../stores/connection'
import type { FileSystemNode, FileFilterOptions } from '../../types/filesystem'
import FileTree from './FileTree.vue'
import NotificationToast from '../common/NotificationToast.vue'

// Composables
const fileSystem = useFileSystem()
const connectionStore = useConnectionStore()

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
}

.file-tree {
  min-height: 0; /* Allow flex child to shrink */
}
</style>