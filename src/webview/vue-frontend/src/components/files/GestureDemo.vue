<template>
  <div class="gesture-demo p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
      Touch Gesture Demo
    </h3>

    <!-- Gesture status display -->
    <div class="mb-4 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
      <div class="text-sm text-gray-600 dark:text-gray-300">
        <div>Active: {{ gestureStatus.isActive ? 'Yes' : 'No' }}</div>
        <div>Gestures: {{ gestureStatus.activeGestures.join(', ') || 'None' }}</div>
        <div>Scale: {{ gestureStatus.currentScale.toFixed(2) }}</div>
        <div>Pull Distance: {{ gestureStatus.pullRefreshDistance.toFixed(0) }}px</div>
        <div>Density: {{ fileGestureStatus.currentDensity }}</div>
      </div>
    </div>

    <!-- File list demo -->
    <div ref="gestureArea"
      class="gesture-enabled file-list-demo bg-white dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden"
      :class="`file-list-${fileGestureStatus.currentDensity}`">
      <!-- Pull refresh indicator -->
      <div class="pull-refresh-indicator" :class="{ active: gestureStatus.pullRefreshDistance > 0 }"
        :style="{ transform: `translateX(-50%) translateY(${Math.min(gestureStatus.pullRefreshDistance, 80)}px)` }">
        <div class="pull-refresh-icon" :class="{ spinning: fileGestureStatus.isRefreshing }">
          {{ fileGestureStatus.isRefreshing ? '⟳' : '↓' }}
        </div>
        <div class="pull-refresh-text">
          {{ fileGestureStatus.isRefreshing ? 'Refreshing...' : 'Pull to refresh' }}
        </div>
      </div>

      <!-- Demo file items -->
      <div v-for="file in demoFiles" :key="file.path"
        class="file-item-gesture file-item border-b border-gray-200 dark:border-gray-600 last:border-b-0" :class="{
          'file-item-selected': fileGestures?.isFileSelected?.(file.path) || false
        }" :data-file-path="file.path" :data-file-name="file.name" :data-file-type="file.type"
        @click="handleFileClick(file)">
        <!-- Swipe actions left -->
        <div class="swipe-actions swipe-actions-left" v-if="fileGestures?.isFileRevealed?.(file.path) || false"
          :style="{ width: '80px' }">
          <div class="swipe-action-button" @click="handleAction('delete', file)">
            <div class="swipe-action-icon">🗑️</div>
            <div>Delete</div>
          </div>
        </div>

        <!-- Swipe actions right -->
        <div class="swipe-actions swipe-actions-right" v-if="fileGestures?.isFileRevealed?.(file.path) || false"
          :style="{ width: '160px' }">
          <div class="swipe-action-button" @click="handleAction('share', file)">
            <div class="swipe-action-icon">📤</div>
            <div>Share</div>
          </div>
          <div class="swipe-action-button" @click="handleAction('preview', file)">
            <div class="swipe-action-icon">👁️</div>
            <div>Preview</div>
          </div>
        </div>

        <!-- File content -->
        <div class="file-content flex items-center p-3 relative z-10 bg-white dark:bg-gray-700">
          <div class="file-icon mr-3 text-xl">
            {{ file.type === 'directory' ? '📁' : getFileIcon(file.name) }}
          </div>
          <div class="file-info flex-1">
            <div class="file-name font-medium text-gray-900 dark:text-white">
              {{ file.name }}
            </div>
            <div class="file-meta text-sm text-gray-500 dark:text-gray-400">
              {{ file.type === 'file' ? formatFileSize(file.size) : 'Folder' }}
            </div>
          </div>
          <div class="file-actions">
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              @click.stop="showContextMenu(file, $event)">
              ⋮
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <div v-if="contextMenu.show" class="context-menu-gesture" :style="{
      left: contextMenu.x + 'px',
      top: contextMenu.y + 'px'
    }" @click.stop>
      <div class="context-menu-item" @click="handleAction('open', contextMenu.file)">
        <div class="context-menu-item-icon">📂</div>
        Open
      </div>
      <div class="context-menu-item" @click="handleAction('rename', contextMenu.file)">
        <div class="context-menu-item-icon">✏️</div>
        Rename
      </div>
      <div class="context-menu-item" @click="handleAction('copy', contextMenu.file)">
        <div class="context-menu-item-icon">📋</div>
        Copy
      </div>
      <div class="context-menu-item destructive" @click="handleAction('delete', contextMenu.file)">
        <div class="context-menu-item-icon">🗑️</div>
        Delete
      </div>
    </div>

    <!-- Action feedback -->
    <div v-if="actionFeedback.show"
      class="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      {{ actionFeedback.message }}
    </div>

    <!-- Instructions -->
    <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">Try these gestures:</h4>
      <ul class="text-sm text-blue-700 dark:text-blue-200 space-y-1">
        <li>• Swipe left/right on files for actions</li>
        <li>• Pinch to zoom for density control</li>
        <li>• Pull down from top to refresh</li>
        <li>• Long press for context menu</li>
        <li>• Tap to select files</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useGestures } from '../../composables/useGestures'
import { useFileGestures } from '../../composables/useFileGestures'
import type { FileSystemNode } from '../../types/filesystem'
import type { FileGestureAction } from '../../composables/useFileGestures'

// Demo data
const demoFiles: FileSystemNode[] = [
  {
    path: '/src',
    name: 'src',
    type: 'directory',
    modified: new Date(),
    created: new Date(),
    parent: ''
  },
  {
    path: '/package.json',
    name: 'package.json',
    type: 'file',
    size: 1024,
    modified: new Date(),
    created: new Date(),
    parent: ''
  },
  {
    path: '/README.md',
    name: 'README.md',
    type: 'file',
    size: 2048,
    modified: new Date(),
    created: new Date(),
    parent: ''
  },
  {
    path: '/tsconfig.json',
    name: 'tsconfig.json',
    type: 'file',
    size: 512,
    modified: new Date(),
    created: new Date(),
    parent: ''
  },
  {
    path: '/vite.config.ts',
    name: 'vite.config.ts',
    type: 'file',
    size: 768,
    modified: new Date(),
    created: new Date(),
    parent: ''
  }
]

// Refs
const gestureArea = ref<HTMLElement | null>(null)

// State
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  file: null as FileSystemNode | null
})

const actionFeedback = reactive({
  show: false,
  message: ''
})

// Initialize gesture systems (will be set up in onMounted)
const gestures = ref<ReturnType<typeof useGestures> | null>(null)
const fileGestures = ref<ReturnType<typeof useFileGestures> | null>(null)

// Safe computed properties for template
const gestureStatus = computed(() => ({
  isActive: gestures.value?.isActive || false,
  activeGestures: gestures.value?.activeGestures || [],
  currentScale: gestures.value?.currentScale || 1,
  pullRefreshDistance: gestures.value?.pullRefreshDistance || 0
}))

const fileGestureStatus = computed(() => ({
  currentDensity: fileGestures.value?.state?.currentDensity || 'normal',
  isRefreshing: fileGestures.value?.isRefreshing || false
}))

// Event handlers
function handleFileClick(file: FileSystemNode): void {
  fileGestures.value?.selectFile?.(file.path)
  showActionFeedback(`Selected: ${file.name}`)
}

function handleFileAction(action: FileGestureAction, file: FileSystemNode): void {
  showActionFeedback(`${action.label}: ${file.name}`)

  // Hide any revealed actions
  fileGestures.value?.hideRevealedActions?.()
}

function handleDensityChange(density: 'compact' | 'normal' | 'comfortable'): void {
  showActionFeedback(`Density changed to: ${density}`)
}

async function handleRefresh(): Promise<void> {
  // Simulate refresh delay
  await new Promise(resolve => setTimeout(resolve, 1500))
  showActionFeedback('Files refreshed!')
}

function handleContextMenuGesture(file: FileSystemNode, position: { x: number; y: number }): void {
  contextMenu.show = true
  contextMenu.x = position.x
  contextMenu.y = position.y
  contextMenu.file = file
}

function showContextMenu(file: FileSystemNode, event: MouseEvent): void {
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.file = file
}

function handleAction(action: string, file: FileSystemNode | null): void {
  if (!file) return

  showActionFeedback(`${action}: ${file.name}`)
  contextMenu.show = false
}

function showActionFeedback(message: string): void {
  actionFeedback.message = message
  actionFeedback.show = true

  setTimeout(() => {
    actionFeedback.show = false
  }, 2000)
}

// Utility functions
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'js':
    case 'ts':
      return '📄'
    case 'json':
      return '⚙️'
    case 'md':
      return '📝'
    case 'css':
      return '🎨'
    case 'html':
      return '🌐'
    default:
      return '📄'
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B'

  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

// Close context menu on outside click
function handleClickOutside(): void {
  contextMenu.show = false
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)

  // Initialize gesture systems after element is available
  gestures.value = useGestures({
    element: gestureArea.value,
    config: {
      debugMode: true
    }
  })

  fileGestures.value = useFileGestures(
    gestureArea.value,
    {
      refreshEnabled: true,
      contextMenuEnabled: true
    },
    {
      onFileAction: handleFileAction,
      onDensityChange: handleDensityChange,
      onRefresh: handleRefresh,
      onContextMenu: handleContextMenuGesture
    }
  )
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Import gesture styles */
@import '../../styles/gestures.css';

.file-list-demo {
  max-height: 400px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.file-item {
  position: relative;
  transition: transform 0.2s ease;
  cursor: pointer;
}

.file-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.file-item:active {
  transform: scale(0.98);
}

.file-content {
  transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
</style>