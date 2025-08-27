<template>
  <div
    :class="[
      'file-tree-node flex items-center px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
      {
        'bg-blue-100 dark:bg-blue-900/30': isSelected,
        'text-blue-700 dark:text-blue-300': isSelected
      }
    ]"
    :style="{ paddingLeft: `${level * 16 + 8}px` }"
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
</template>

<script setup lang="ts">
// No imports needed for this component
import type { FileSystemNode } from '../../types/filesystem'

interface Props {
  node: FileSystemNode
  level: number
  isSelected: boolean
  isLoading: boolean
  showDetails?: boolean
}

interface Emits {
  (e: 'select', node: FileSystemNode): void
  (e: 'expand', node: FileSystemNode): void
  (e: 'collapse', node: FileSystemNode): void
  (e: 'context-menu', event: { node: FileSystemNode; x: number; y: number }): void
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false
})

const emit = defineEmits<Emits>()

// Methods
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
</script>

<style scoped>
.file-tree-node {
  min-height: 32px;
}
</style>