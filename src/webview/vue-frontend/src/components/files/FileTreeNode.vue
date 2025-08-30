<template>
  <MobileSwipeActions
    :left-actions="leftSwipeActions"
    :right-actions="rightSwipeActions"
    :haptic-feedback="hapticFeedback"
    @action="handleSwipeAction"
  >
    <div
      ref="nodeRef"
      :class="[
        'file-tree-node file-item-gesture flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
        `density-${density}`,
        {
          'bg-blue-100 dark:bg-blue-900/30': isSelected,
          'text-blue-700 dark:text-blue-300': isSelected,
          'loading-state': isLoading
        }
      ]"
      :style="{ 
        paddingLeft: `${level * indentSize + baseIndent}px`,
        minHeight: `${minHeight}px`
      }"
      :data-file-path="node.path"
      :data-file-name="node.name"
      :data-file-type="node.type"
      @click="handleClick"
      @contextmenu="handleContextMenu"
    >
    <!-- Expand/collapse button -->
    <button
      v-if="node.type === 'directory'"
      @click.stop="handleToggle"
      class="flex-shrink-0 w-4 h-4 mr-1 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      <svg
        v-if="isLoading"
        class="w-3 h-3 animate-spin"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <svg
        v-else
        :class="{ 'rotate-90': node.isExpanded }"
        class="w-3 h-3 transition-transform"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
    <div v-else class="w-4 h-4 mr-1"></div>

    <!-- File/folder icon -->
    <div class="flex-shrink-0 w-4 h-4 mr-2 flex items-center justify-center">
      <svg
        v-if="node.type === 'directory'"
        :class="node.isExpanded ? 'text-blue-500' : 'text-yellow-500'"
        class="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path v-if="node.isExpanded" d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        <path v-else d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
      <svg
        v-else
        :class="getFileIconClass()"
        class="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
      </svg>
    </div>

    <!-- File/folder name -->
    <span class="flex-1 truncate text-sm">
      {{ node.name }}
    </span>

    <!-- File size (for files only) -->
    <span
      v-if="node.type === 'file' && node.size !== undefined"
      class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 ml-2"
    >
      {{ formatFileSize(node.size) }}
    </span>

    <!-- Modified date -->
    <span
      v-if="showDetails"
      class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 ml-2"
    >
      {{ formatDate(node.modified) }}
    </span>
    </div>
  </MobileSwipeActions>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'

import MobileSwipeActions from './MobileSwipeActions.vue'
import type { FileSystemNode } from '../../types/filesystem'
import type { FileGestureAction } from '../../composables/useFileGestures'

interface Props {
  node: FileSystemNode
  level: number
  isSelected: boolean
  isLoading: boolean
  showDetails?: boolean
  density?: 'compact' | 'normal' | 'comfortable'
  enableSwipeActions?: boolean
  hapticFeedback?: boolean
}

interface Emits {
  (e: 'select', node: FileSystemNode): void
  (e: 'expand', node: FileSystemNode): void
  (e: 'collapse', node: FileSystemNode): void
  (e: 'context-menu', event: { node: FileSystemNode; x: number; y: number }): void
  (e: 'height-change', nodeId: string, height: number): void
  (e: 'swipe-action', action: FileGestureAction, node: FileSystemNode): void
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false,
  density: 'normal',
  enableSwipeActions: true,
  hapticFeedback: true
})

const emit = defineEmits<Emits>()

// Composables
const breakpoints = useBreakpoints()

// State
const nodeRef = ref<HTMLElement>()
const lastHeight = ref(0)

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const indentSize = computed(() => {
  switch (props.density) {
    case 'compact':
      return isMobile.value ? 12 : 12
    case 'comfortable':
      return isMobile.value ? 20 : 16
    default: // normal
      return isMobile.value ? 16 : 16
  }
})

const baseIndent = computed(() => {
  switch (props.density) {
    case 'compact':
      return isMobile.value ? 8 : 8
    case 'comfortable':
      return isMobile.value ? 16 : 12
    default: // normal
      return isMobile.value ? 12 : 8
  }
})

const minHeight = computed(() => {
  switch (props.density) {
    case 'compact':
      return isMobile.value ? 40 : 28
    case 'comfortable':
      return isMobile.value ? 56 : 40
    default: // normal
      return isMobile.value ? 48 : 32
  }
})

// Swipe actions configuration
const leftSwipeActions = computed((): FileGestureAction[] => {
  if (!props.enableSwipeActions || !isMobile.value) return []
  
  return [
    {
      type: 'delete',
      icon: '🗑️',
      color: '#ef4444',
      label: 'Delete',
      haptic: { type: 'medium' },
      confirmRequired: true
    }
  ]
})

const rightSwipeActions = computed((): FileGestureAction[] => {
  if (!props.enableSwipeActions || !isMobile.value) return []
  
  const actions: FileGestureAction[] = [
    {
      type: 'share',
      icon: '📤',
      color: '#3b82f6',
      label: 'Share',
      haptic: { type: 'light' }
    }
  ]
  
  // Add preview action for files
  if (props.node.type === 'file') {
    actions.unshift({
      type: 'preview',
      icon: '👁️',
      color: '#10b981',
      label: 'Preview',
      haptic: { type: 'light' }
    })
  }
  
  return actions
})

// Methods
const measureHeight = async () => {
  await nextTick()
  if (nodeRef.value) {
    const height = nodeRef.value.offsetHeight
    if (height !== lastHeight.value) {
      lastHeight.value = height
      emit('height-change', props.node.path, height)
    }
  }
}
const handleClick = () => {
  emit('select', props.node)
}

const handleToggle = () => {
  if (props.node.isExpanded) {
    emit('collapse', props.node)
  } else {
    emit('expand', props.node)
  }
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  emit('context-menu', {
    node: props.node,
    x: event.clientX,
    y: event.clientY
  })
}

const handleSwipeAction = (action: FileGestureAction) => {
  emit('swipe-action', action, props.node)
}

const getFileIconClass = (): string => {
  const extension = props.node.name.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return 'text-yellow-500'
    case 'vue':
      return 'text-green-500'
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'text-blue-500'
    case 'html':
    case 'htm':
      return 'text-orange-500'
    case 'json':
      return 'text-yellow-600'
    case 'md':
    case 'markdown':
      return 'text-gray-600'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return 'text-purple-500'
    case 'pdf':
      return 'text-red-500'
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
      return 'text-gray-500'
    default:
      return 'text-gray-400'
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return `${days} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

// Watchers
watch(() => props.density, measureHeight)
watch(() => props.showDetails, measureHeight)
watch(() => props.node.name, measureHeight)

// Lifecycle
onMounted(() => {
  measureHeight()
})
</script>

<style scoped>
.file-tree-node {
  contain: layout style paint;
  will-change: transform;
}

/* Density variations */
.file-tree-node.density-compact {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.file-tree-node.density-normal {
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
}

.file-tree-node.density-comfortable {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 1rem;
  padding-right: 1rem;
}

/* Loading state */
.file-tree-node.loading-state {
  opacity: 0.7;
  pointer-events: none;
}

.file-tree-node.loading-state::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 25%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 75%
  );
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite;
}

@keyframes loading-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Mobile optimizations */
@media (max-width: 767px) {
  .file-tree-node {
    /* Ensure minimum touch target size */
    min-height: 44px;
    touch-action: manipulation;
  }
  
  .file-tree-node.density-compact {
    min-height: 40px;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
  
  .file-tree-node.density-comfortable {
    min-height: 56px;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .file-tree-node {
    border-bottom: 1px solid currentColor;
  }
  
  .file-tree-node:hover {
    outline: 2px solid currentColor;
    outline-offset: -2px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .file-tree-node {
    transition: none;
  }
  
  .file-tree-node.loading-state::after {
    animation: none;
    background: rgba(255, 255, 255, 0.1);
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .file-tree-node.loading-state::after {
    background: linear-gradient(
      90deg,
      transparent 25%,
      rgba(0, 0, 0, 0.1) 50%,
      transparent 75%
    );
  }
}
</style>