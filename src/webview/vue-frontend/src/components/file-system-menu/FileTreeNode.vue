<template>
  <div class="file-tree-node">
    <!-- Main node -->
    <div
      :class="nodeClasses"
      :style="{ paddingLeft: (level * 16 + 8) + 'px' }"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      @contextmenu="handleContextMenu"
      @keydown="handleKeydown"
      :tabindex="isSelected ? 0 : -1"
      :aria-selected="isSelected"
      :aria-expanded="node.type === 'directory' ? isExpanded : false"
      :aria-level="level + 1"
      role="treeitem"
    >
      <!-- Expand/Collapse Icon -->
      <div class="expand-icon w-4 h-4 flex items-center justify-center">
        <button
          v-if="node.type === 'directory'"
          @click.stop="handleToggle"
          class="w-3 h-3 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          :aria-label="isExpanded ? 'Collapse' : 'Expand'"
        >
          <svg
            class="w-3 h-3 transition-transform duration-150"
            :class="{ 'rotate-90': isExpanded }"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        <div v-else class="w-3 h-3"></div>
      </div>

      <!-- Loading Spinner -->
      <div v-if="isLoading" class="loading-spinner w-4 h-4 mr-2">
        <svg class="animate-spin w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- File/Directory Icon -->
      <div v-else class="file-icon w-4 h-4 mr-2 flex items-center justify-center">
        <component :is="iconComponent" class="w-3.5 h-3.5" :class="iconClasses" />
      </div>

      <!-- File Name -->
      <span class="file-name flex-1 truncate text-sm" :class="nameClasses">
        <template v-if="searchQuery">
          <span v-html="highlightedName"></span>
        </template>
        <template v-else>
          {{ node.name }}
        </template>
      </span>

      <!-- File Size (for files) -->
      <span v-if="node.type === 'file' && node.size !== undefined" class="file-size text-xs text-gray-500 dark:text-gray-400 ml-2">
        {{ formatFileSize(node.size) }}
      </span>
    </div>

    <!-- Children (for expanded directories) -->
    <div v-if="node.type === 'directory' && isExpanded && node.children" class="children">
      <FileTreeNode
        v-for="child in sortedChildren"
        :key="child.path"
        :node="child"
        :level="level + 1"
        :is-selected="false"
        :is-expanded="false"
        :is-loading="false"
        v-bind="searchQuery ? { 'search-query': searchQuery } : {}"
        @select="$emit('select', $event)"
        @expand="$emit('expand', $event)"
        @collapse="$emit('collapse', $event)"
        @context-menu="$emit('context-menu', $event)"
        @open-in-editor="$emit('open-in-editor', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileTreeNodeProps } from './types'
import type { FileSystemNode } from '../../types/filesystem'

// Props
const props = withDefaults(defineProps<FileTreeNodeProps>(), {
  level: 0,
  isSelected: false,
  isExpanded: false,
  isLoading: false
})

// Emits
const emit = defineEmits<{
  select: [path: string]
  expand: [path: string]
  collapse: [path: string]
  'context-menu': [event: { node: FileSystemNode; x: number; y: number }]
  'open-in-editor': [path: string]
}>()

// Computed
const nodeClasses = computed(() => [
  'file-tree-node-content',
  'flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150',
  {
    'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100': props.isSelected,
    'text-gray-900 dark:text-gray-100': !props.isSelected
  }
])

const iconComponent = computed(() => {
  if (props.node.type === 'directory') {
    return props.isExpanded ? 'FolderOpenIcon' : 'FolderIcon'
  }
  
  // Determine file icon based on extension
  const extension = getFileExtension(props.node.name)
  switch (extension) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return 'CodeIcon'
    case 'json':
      return 'DocumentTextIcon'
    case 'md':
    case 'txt':
      return 'DocumentIcon'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return 'PhotoIcon'
    case 'css':
    case 'scss':
    case 'less':
      return 'SwatchIcon'
    default:
      return 'DocumentIcon'
  }
})

const iconClasses = computed(() => {
  if (props.node.type === 'directory') {
    return props.isExpanded 
      ? 'text-blue-500 dark:text-blue-400' 
      : 'text-yellow-500 dark:text-yellow-400'
  }
  
  const extension = getFileExtension(props.node.name)
  switch (extension) {
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
      return 'text-yellow-500 dark:text-yellow-400'
    case 'json':
      return 'text-green-500 dark:text-green-400'
    case 'md':
      return 'text-blue-500 dark:text-blue-400'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return 'text-purple-500 dark:text-purple-400'
    case 'css':
    case 'scss':
    case 'less':
      return 'text-pink-500 dark:text-pink-400'
    default:
      return 'text-gray-500 dark:text-gray-400'
  }
})

const nameClasses = computed(() => [
  {
    'font-medium': props.isSelected,
    'text-gray-900 dark:text-gray-100': !props.isSelected,
    'text-blue-900 dark:text-blue-100': props.isSelected
  }
])

const highlightedName = computed(() => {
  if (!props.searchQuery) return props.node.name
  
  const query = props.searchQuery.toLowerCase()
  const name = props.node.name
  const lowerName = name.toLowerCase()
  
  const index = lowerName.indexOf(query)
  if (index === -1) return name
  
  const before = name.substring(0, index)
  const match = name.substring(index, index + query.length)
  const after = name.substring(index + query.length)
  
  return `${before}<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">${match}</mark>${after}`
})

const sortedChildren = computed(() => {
  if (!props.node.children) return []
  
  return [...props.node.children].sort((a, b) => {
    // Directories first, then files
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
})

// Methods
const handleClick = () => {
  emit('select', props.node.path)
}

const handleDoubleClick = () => {
  if (props.node.type === 'directory') {
    handleToggle()
  } else {
    // Double-click on file opens it in VS Code editor
    emit('open-in-editor', props.node.path)
  }
}

const handleToggle = () => {
  if (props.node.type !== 'directory') return
  
  if (props.isExpanded) {
    emit('collapse', props.node.path)
  } else {
    emit('expand', props.node.path)
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

const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleClick()
      break
    case 'ArrowRight':
      event.preventDefault()
      if (props.node.type === 'directory' && !props.isExpanded) {
        emit('expand', props.node.path)
      }
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (props.node.type === 'directory' && props.isExpanded) {
        emit('collapse', props.node.path)
      }
      break
  }
}

const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : ''
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<script lang="ts">
// Icon components (simplified SVG icons)
import { defineComponent, h } from 'vue'

const FolderIcon = defineComponent({
  name: 'FolderIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      d: 'M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z'
    })
  ])
})

const FolderOpenIcon = defineComponent({
  name: 'FolderOpenIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      fillRule: 'evenodd',
      d: 'M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z',
      clipRule: 'evenodd'
    }),
    h('path', {
      d: 'M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z'
    })
  ])
})

const DocumentIcon = defineComponent({
  name: 'DocumentIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      fillRule: 'evenodd',
      d: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z',
      clipRule: 'evenodd'
    })
  ])
})

const DocumentTextIcon = defineComponent({
  name: 'DocumentTextIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      fillRule: 'evenodd',
      d: 'M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z',
      clipRule: 'evenodd'
    })
  ])
})

const CodeIcon = defineComponent({
  name: 'CodeIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      fillRule: 'evenodd',
      d: 'M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z',
      clipRule: 'evenodd'
    })
  ])
})

const PhotoIcon = defineComponent({
  name: 'PhotoIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      fillRule: 'evenodd',
      d: 'M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z',
      clipRule: 'evenodd'
    })
  ])
})

const SwatchIcon = defineComponent({
  name: 'SwatchIcon',
  render: () => h('svg', {
    fill: 'currentColor',
    viewBox: '0 0 20 20'
  }, [
    h('path', {
      fillRule: 'evenodd',
      d: 'M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zM3 15a1 1 0 011-1h1a1 1 0 110 2H4a1 1 0 01-1-1zm6-11a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z',
      clipRule: 'evenodd'
    })
  ])
})

// Register components globally for this component
export default {
  components: {
    FolderIcon,
    FolderOpenIcon,
    DocumentIcon,
    DocumentTextIcon,
    CodeIcon,
    PhotoIcon,
    SwatchIcon
  }
}
</script>

<style scoped>
.file-tree-node-content {
  min-height: 24px;
}

.expand-icon {
  flex-shrink: 0;
}

.file-icon {
  flex-shrink: 0;
}

.file-name {
  min-width: 0;
}

.loading-spinner {
  flex-shrink: 0;
}

.children {
  border-left: 1px solid transparent;
}

/* Focus styles for accessibility */
.file-tree-node-content:focus {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

/* Highlight search matches */
:deep(mark) {
  background-color: #fef3c7;
  padding: 0 2px;
  border-radius: 2px;
}

:deep(.dark mark) {
  background-color: #92400e;
  color: #fef3c7;
}
</style>