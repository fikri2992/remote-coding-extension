<template>
  <div 
    class="file-explorer adaptive-layout h-full bg-white dark:bg-gray-900" 
    :class="layout.layoutClasses"
    :style="layout.layoutStyles"
  >
    <!-- Adaptive Header -->
    <CollapsibleHeader
      class="layout-grid-area-header"
      title="File Explorer"
      :title-icon="FolderIcon"
      :show-search="true"
      :show-filters="showFilters"
      :show-progress="isLoading"
      :progress-indeterminate="true"
      @search="handleSearch"
      @menu-click="handleMenuClick"
    >
      <template #actions>
        <button
          @click="refreshTree"
          :disabled="isLoading"
          class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 rounded-lg transition-colors"
          title="Refresh"
        >
          <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button
          @click="showCreateDialog = true"
          class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
          title="Create File/Folder"
        >
          <PlusIcon class="w-5 h-5" />
        </button>
      </template>

      <template #filters>
        <select
          v-model="filterOptions.sortBy"
          @change="applyFilters"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="name">Sort by Name</option>
          <option value="modified">Sort by Modified</option>
          <option value="size">Sort by Size</option>
          <option value="type">Sort by Type</option>
        </select>
        <select
          v-model="filterOptions.sortOrder"
          @change="applyFilters"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
        <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input
            v-model="filterOptions.showHidden"
            @change="applyFilters"
            type="checkbox"
            class="mr-2 w-4 h-4"
          >
          Show Hidden
        </label>
        
        <div class="flex items-center gap-2 ml-auto">
          <button
            @click="showFilters = !showFilters"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded"
          >
            {{ showFilters ? 'Hide' : 'Show' }} Filters
          </button>
          
          <button
            @click="showPerformanceDebug = !showPerformanceDebug"
            class="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            title="Performance Debug"
          >
            📊
          </button>
          
          <button
            @click="testConnection"
            :disabled="isLoading"
            class="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 transition-colors"
            title="Debug Connection"
          >
            🔧
          </button>
          
          <select
            v-model="fileDensity"
            @change="changeDensity(fileDensity)"
            class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600"
            title="File List Density"
          >
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="comfortable">Comfortable</option>
          </select>
          
          <button
            @click="showGestureDemo = !showGestureDemo"
            class="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            title="Gesture Demo"
          >
            👆
          </button>
        </div>
      </template>
    </CollapsibleHeader>

    <!-- File tree with gesture support -->
    <div 
      ref="fileTreeElement"
      class="file-tree layout-grid-area-main overflow-auto gesture-enabled file-list-normal"
      :class="[`file-list-${fileDensity}`]"
    >
      <!-- Pull refresh indicator -->
      <div 
        class="pull-refresh-indicator"
        :class="{ active: fileGestures.state.currentDensity !== 'normal' }"
        v-if="isMobile"
      >
        <div 
          class="pull-refresh-icon"
          :class="{ spinning: fileGestures.isRefreshing }"
        >
          {{ fileGestures.isRefreshing ? '⟳' : '↓' }}
        </div>
        <div class="pull-refresh-text">
          {{ fileGestures.isRefreshing ? 'Refreshing...' : 'Pull to refresh' }}
        </div>
      </div>

      <FileTree
        ref="fileTreeRef"
        :nodes="displayedNodes"
        :selected-path="selectedPath"
        :loading-paths="loadingPaths"
        :density="fileDensity"
        :progressive-loading="progressiveLoading"
        :page-size="pageSize"
        :preload-distance="preloadDistance"
        :show-skeletons="showSkeletons"
        :momentum-scrolling="momentumScrolling"
        :cache-enabled="cacheEnabled"
        :cache-size="cacheSize"
        @select="handleNodeSelect"
        @expand="handleNodeExpand"
        @collapse="handleNodeCollapse"
        @context-menu="handleContextMenu"
        @load-more="handleLoadMore"
        @scroll="handleTreeScroll"
        @visible-range-change="handleVisibleRangeChange"
        @swipe-action="handleSwipeAction"
      />
    </div>

    <!-- Desktop Context menu -->
    <div
      v-if="contextMenu.show && !isMobile"
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

    <!-- Mobile Context Menu -->
    <MobileContextMenu
      v-model="mobileContextMenu.show"
      :file="mobileContextMenu.node"
      :actions="contextMenuActions"
      @action="handleMobileContextAction"
      @close="closeMobileContextMenu"
    />

    <!-- Mobile Confirmation Dialog -->
    <MobileConfirmationDialog
      v-model="confirmationDialog.show"
      :title="confirmationDialog.title"
      :message="confirmationDialog.message"
      :details="confirmationDialog.details"
      :file="confirmationDialog.file"
      :type="confirmationDialog.type"
      :destructive="confirmationDialog.destructive"
      :destructive-warning="confirmationDialog.destructiveWarning"
      :require-confirmation="confirmationDialog.requireConfirmation"
      :confirmation-text="confirmationDialog.confirmationText"
      :loading="confirmationDialog.loading"
      @confirm="handleConfirmationConfirm"
      @cancel="handleConfirmationCancel"
    />

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

    <!-- Performance Debug Panel -->
    <div v-if="showPerformanceDebug" class="mobile:col-span-full tablet:col-span-2 desktop:col-span-3 mt-4">
      <PerformanceDebugPanel />
    </div>

    <!-- Gesture Demo -->
    <div v-if="showGestureDemo" class="mobile:col-span-full tablet:col-span-2 desktop:col-span-3 mt-4">
      <GestureDemo />
    </div>

    <!-- Adaptive Navigation -->
    <AdaptiveNavigation
      :current-route="'/files'"
      @navigate="handleNavigation"
      @action="handleNavigationAction"
    />

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
import { useFileGestures } from '../../composables/useFileGestures'
import { useLayout } from '../../composables/useLayout'
import { connectionService } from '../../services/connection'
import { useConnectionStore } from '../../stores/connection'
import type { FileSystemNode, FileFilterOptions } from '../../types/filesystem'
import type { FileGestureAction } from '../../composables/useFileGestures'
import FileTree from './FileTree.vue'
import NotificationToast from '../common/NotificationToast.vue'
import GestureDemo from './GestureDemo.vue'
import PerformanceDebugPanel from './PerformanceDebugPanel.vue'
import MobileContextMenu from './MobileContextMenu.vue'
import MobileConfirmationDialog from './MobileConfirmationDialog.vue'
import CollapsibleHeader from '../layout/CollapsibleHeader.vue'
import AdaptiveNavigation from '../layout/AdaptiveNavigation.vue'
import { 
  FolderIcon, 
  ArrowPathIcon, 
  PlusIcon 
} from '@heroicons/vue/24/outline'

// Composables
const fileSystem = useFileSystem()
const connectionStore = useConnectionStore()
const breakpoints = useBreakpoints()
const layout = useLayout({
  enableAnimations: true,
  preserveState: true,
  autoCollapse: true
})

// Gesture system
const fileTreeElement = ref<HTMLElement | null>(null)

// State
const searchQuery = ref('')
const showFilters = ref(false)
const showCreateDialog = ref(false)
const showRenameDialog = ref(false)
const showGestureDemo = ref(false)
const showPerformanceDebug = ref(false)
const createType = ref<'file' | 'directory'>('file')
const createName = ref('')
const renameName = ref('')
const createInput = ref<HTMLInputElement>()
const renameInput = ref<HTMLInputElement>()
const fileTreeRef = ref<InstanceType<typeof FileTree>>()

// Virtual scrolling and mobile optimization state
const fileDensity = ref<'compact' | 'normal' | 'comfortable'>('normal')
const progressiveLoading = ref(true)
const pageSize = ref(50)
const preloadDistance = ref(200)
const showSkeletons = ref(true)
const momentumScrolling = ref(true)
const cacheEnabled = ref(true)
const cacheSize = ref(1000)
const isLoadingMore = ref(false)
const visibleRange = ref({ start: 0, end: 0 })

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

const mobileContextMenu = ref({
  show: false,
  node: null as FileSystemNode | null
})

const confirmationDialog = ref({
  show: false,
  title: '',
  message: '',
  details: '',
  file: null as FileSystemNode | null,
  type: 'warning' as 'info' | 'success' | 'warning' | 'error' | 'question',
  destructive: false,
  destructiveWarning: '',
  requireConfirmation: false,
  confirmationText: '',
  loading: false,
  action: null as (() => Promise<void>) | null
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

// Context menu actions for mobile
const contextMenuActions = computed(() => {
  const node = mobileContextMenu.value.node
  if (!node) return []

  const actions: FileGestureAction[] = []

  // Open action for files
  if (node.type === 'file') {
    actions.push({
      type: 'preview',
      icon: '👁️',
      color: '#10b981',
      label: 'Open File'
    })
  }

  // Rename action
  actions.push({
    type: 'rename',
    icon: '✏️',
    color: '#f59e0b',
    label: 'Rename'
  })

  // Copy path action
  actions.push({
    type: 'copy',
    icon: '📋',
    color: '#6b7280',
    label: 'Copy Path'
  })

  // Share action
  actions.push({
    type: 'share',
    icon: '📤',
    color: '#3b82f6',
    label: 'Share'
  })

  // Delete action
  actions.push({
    type: 'delete',
    icon: '🗑️',
    color: '#ef4444',
    label: 'Delete',
    haptic: { type: 'medium' }
  })

  return actions
})

// Methods
const refreshTree = async () => {
  try {
    await fileSystem.refreshFileTree()
    showNotification('File tree refreshed', 'success')
  } catch (error) {
    showNotification('Failed to refresh file tree', 'error')
  }
}

const handleSearch = (query: string) => {
  searchQuery.value = query
}

const handleMenuClick = () => {
  if (layout.isNavigationPattern('sidebar')) {
    layout.toggleSidebar()
  } else if (layout.isNavigationPattern('overlay')) {
    layout.showOverlay()
  }
}

const handleNavigation = (item: any) => {
  // Handle navigation to different views
  console.log('Navigate to:', item.route)
}

const handleNavigationAction = (item: any) => {
  // Handle navigation actions
  console.log('Navigation action:', item.id)
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
  if (isMobile.value) {
    // Use mobile context menu
    mobileContextMenu.value = {
      show: true,
      node: event.node
    }
  } else {
    // Use desktop context menu
    contextMenu.value = {
      show: true,
      x: event.x,
      y: event.y,
      node: event.node
    }
  }
}

const closeContextMenu = () => {
  contextMenu.value.show = false
}

const closeMobileContextMenu = () => {
  mobileContextMenu.value.show = false
  mobileContextMenu.value.node = null
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

  if (isMobile.value) {
    // Use mobile confirmation dialog
    showConfirmationDialog({
      title: 'Delete File',
      message: `Are you sure you want to delete "${node.name}"?`,
      details: 'This action cannot be undone.',
      file: node,
      type: 'warning',
      destructive: true,
      destructiveWarning: 'This will permanently delete the file from your system.',
      requireConfirmation: node.type === 'directory',
      confirmationText: 'DELETE',
      action: async () => {
        if (node.type === 'file') {
          await fileSystem.deleteFile(node.path)
        } else {
          await fileSystem.deleteDirectory(node.path, true)
        }
        showNotification('Deleted successfully', 'success')
      }
    })
  } else {
    // Use desktop confirmation
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
  }
  
  closeContextMenu()
  closeMobileContextMenu()
}

const handleMobileContextAction = async (action: FileGestureAction) => {
  const node = mobileContextMenu.value.node
  if (!node) return

  closeMobileContextMenu()

  switch (action.type) {
    case 'preview':
      openFile(node)
      break
    case 'rename':
      showRenameDialog.value = true
      contextMenu.value.node = node
      break
    case 'copy':
      await copyPath(node.path)
      break
    case 'share':
      await shareFile(node)
      break
    case 'delete':
      await deleteNode(node)
      break
    default:
      showNotification(`${action.label}: ${node.name}`, 'info')
  }
}

const shareFile = async (node: FileSystemNode) => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: node.name,
        text: `File: ${node.name}`,
        url: node.path
      })
      showNotification('File shared successfully', 'success')
    } else {
      // Fallback to copying path
      await copyPath(node.path)
      showNotification('File path copied (share not supported)', 'info')
    }
  } catch (error) {
    showNotification('Failed to share file', 'error')
  }
}

const showConfirmationDialog = (options: {
  title: string
  message: string
  details?: string
  file?: FileSystemNode | null
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  destructive?: boolean
  destructiveWarning?: string
  requireConfirmation?: boolean
  confirmationText?: string
  action: () => Promise<void>
}) => {
  confirmationDialog.value = {
    show: true,
    title: options.title,
    message: options.message,
    details: options.details || '',
    file: options.file || null,
    type: options.type || 'question',
    destructive: options.destructive || false,
    destructiveWarning: options.destructiveWarning || '',
    requireConfirmation: options.requireConfirmation || false,
    confirmationText: options.confirmationText || 'CONFIRM',
    loading: false,
    action: options.action
  }
}

const handleConfirmationConfirm = async () => {
  if (!confirmationDialog.value.action) return

  confirmationDialog.value.loading = true
  
  try {
    await confirmationDialog.value.action()
    confirmationDialog.value.show = false
  } catch (error) {
    showNotification('Action failed', 'error')
  } finally {
    confirmationDialog.value.loading = false
  }
}

const handleConfirmationCancel = () => {
  confirmationDialog.value.show = false
  confirmationDialog.value.action = null
}

const handleSwipeAction = async (action: FileGestureAction, node: FileSystemNode) => {
  switch (action.type) {
    case 'delete':
      await deleteNode(node)
      break
    case 'rename':
      showRenameDialog.value = true
      contextMenu.value.node = node
      break
    case 'share':
      await shareFile(node)
      break
    case 'preview':
      openFile(node)
      break
    case 'copy':
      await copyPath(node.path)
      break
    default:
      showNotification(`${action.label}: ${node.name}`, 'info')
  }
}

const showNotification = (message: string, type: 'info' | 'success' | 'error' | 'warning') => {
  notification.value = { show: true, message, type }
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

// Gesture handlers (declared early to avoid hoisting issues)
const handleFileGestureAction = async (action: FileGestureAction, file: FileSystemNode) => {
  try {
    switch (action.type) {
      case 'delete':
        if (action.confirmRequired && !confirm(`Are you sure you want to delete "${file.name}"?`)) {
          return
        }
        if (file.type === 'file') {
          await fileSystem.deleteFile(file.path)
        } else {
          await fileSystem.deleteDirectory(file.path, true)
        }
        showNotification(`${file.name} deleted successfully`, 'success')
        break
        
      case 'rename':
        // This would typically open a rename dialog
        showNotification(`Rename ${file.name}`, 'info')
        showRenameDialog.value = true
        contextMenu.value.node = file
        break
        
      case 'share':
        // Copy path to clipboard as a simple share action
        await copyPath(file.path)
        showNotification(`${file.name} path copied`, 'success')
        break
        
      case 'preview':
        // This would typically open a preview modal
        showNotification(`Preview ${file.name}`, 'info')
        break
        
      default:
        showNotification(`${action.label}: ${file.name}`, 'info')
    }
  } catch (error) {
    showNotification(`Failed to ${action.label.toLowerCase()} ${file.name}`, 'error')
  }
}

const handleDensityChange = (density: 'compact' | 'normal' | 'comfortable') => {
  showNotification(`File list density: ${density}`, 'info')
  // Apply density class to file tree
  if (fileTreeElement.value) {
    fileTreeElement.value.className = fileTreeElement.value.className
      .replace(/file-list-(compact|normal|comfortable)/g, '')
      + ` file-list-${density}`
  }
}

const handleGestureRefresh = async () => {
  try {
    await refreshTree()
  } catch (error) {
    showNotification('Failed to refresh file tree', 'error')
  }
}

const handleGestureContextMenu = (file: FileSystemNode, position: { x: number; y: number }) => {
  contextMenu.value = {
    show: true,
    x: position.x,
    y: position.y,
    node: file
  }
}

const changeDensity = (density: 'compact' | 'normal' | 'comfortable') => {
  fileDensity.value = density
  showNotification(`File list density: ${density}`, 'info')
}

const testConnection = async () => {
  try {
    // Test WebSocket connection
    showNotification(`Testing connection on ${currentBreakpoint.value}`, 'info')
  } catch (error) {
    showNotification('Connection test failed', 'error')
  }
}
}

// Initialize gesture system after handlers are declared
const fileGestures = useFileGestures(
  fileTreeElement.value,
  {
    refreshEnabled: true,
    contextMenuEnabled: true,
    swipeActions: {
      left: [
        {
          type: 'delete',
          icon: '🗑️',
          color: '#ef4444',
          label: 'Delete',
          haptic: { type: 'medium' },
          confirmRequired: true
        }
      ],
      right: [
        {
          type: 'share',
          icon: '📤',
          color: '#3b82f6',
          label: 'Share',
          haptic: { type: 'light' }
        },
        {
          type: 'preview',
          icon: '👁️',
          color: '#10b981',
          label: 'Preview',
          haptic: { type: 'light' }
        }
      ]
    }
  },
  {
    onFileAction: handleFileGestureAction,
    onDensityChange: handleDensityChange,
    onRefresh: handleGestureRefresh,
    onContextMenu: handleGestureContextMenu
  }
)



// Virtual scrolling and mobile optimization handlers
const handleLoadMore = async (direction: 'up' | 'down', currentNodes: FileSystemNode[]) => {
  if (isLoadingMore.value) return
  
  isLoadingMore.value = true
  
  try {
    // In a real implementation, this would load more data from the server
    // For now, we'll just simulate loading more data
    console.log(`Loading more files in direction: ${direction}`, currentNodes.length)
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // In practice, you would:
    // 1. Determine the parent directory to load more from
    // 2. Send a request to load more files/directories
    // 3. Update the file tree with new data
    
    showNotification(`Loaded more files (${direction})`, 'info')
  } catch (error) {
    showNotification('Failed to load more files', 'error')
  } finally {
    isLoadingMore.value = false
    if (fileTreeRef.value) {
      fileTreeRef.value.setLoading(false)
    }
  }
}

const handleTreeScroll = (_scrollTop: number, _direction: 'up' | 'down') => {
  // Handle scroll events for performance monitoring or other features
  // This could be used for analytics or scroll position persistence
}

const handleVisibleRangeChange = (startIndex: number, endIndex: number, visibleNodes: FileSystemNode[]) => {
  visibleRange.value = { start: startIndex, end: endIndex }
  
  // Preload file metadata for visible nodes if needed
  if (cacheEnabled.value) {
    visibleNodes.forEach(node => {
      if (fileTreeRef.value) {
        fileTreeRef.value.cacheNode(node)
      }
    })
  }
}

const changeDensity = (newDensity: 'compact' | 'normal' | 'comfortable') => {
  fileDensity.value = newDensity
  showNotification(`File list density: ${newDensity}`, 'info')
  
  // Persist density preference
  try {
    localStorage.setItem('file-explorer-density', newDensity)
  } catch (error) {
    console.warn('Failed to persist density preference:', error)
  }
}

// Removed unused function scrollToSelectedNode

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
  if (webSocket) {
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
  } else {
    console.warn('⚠️ WebSocket not available')
    showNotification('WebSocket not initialized', 'warning')
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
  if (mobileContextMenu.value.show) {
    closeMobileContextMenu()
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  
  // Load persisted density preference
  try {
    const savedDensity = localStorage.getItem('file-explorer-density')
    if (savedDensity && ['compact', 'normal', 'comfortable'].includes(savedDensity)) {
      fileDensity.value = savedDensity as 'compact' | 'normal' | 'comfortable'
    }
  } catch (error) {
    console.warn('Failed to load density preference:', error)
  }
  
  // Adjust settings for mobile
  if (isMobile.value) {
    pageSize.value = 30 // Smaller page size for mobile
    preloadDistance.value = 150 // Smaller preload distance
    showSkeletons.value = true // Always show skeletons on mobile
  }
  
  try {
    await fileSystem.loadFileTree()
  } catch (error) {
    showNotification('Failed to load file tree', 'error')
  }
})
</script>

<style scoped>
/* Import gesture styles */
@import '../../styles/gestures.css';

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