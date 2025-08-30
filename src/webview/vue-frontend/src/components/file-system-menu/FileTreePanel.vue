<template>
  <div class="file-tree-panel h-full flex flex-col bg-white dark:bg-gray-900">
    <!-- Header -->
    <div class="file-tree-header p-3 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white">
          Files
        </h3>
        <button
          @click="$emit('refresh')"
          :disabled="isLoading"
          class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          title="Refresh"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative">
        <input
          ref="searchInput"
          :value="searchQuery"
          @input="handleSearchInput"
          @keydown="handleSearchKeydown"
          type="text"
          placeholder="Search files..."
          class="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
        <svg class="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <button
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Search Results Count -->
      <div v-if="isSearchActive && searchResults.length > 0" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {{ searchResults.length }} result{{ searchResults.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- File Tree -->
    <div class="file-tree-content flex-1 overflow-auto">
      <div v-if="isSearchActive && searchResults.length === 0 && searchQuery" class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        No files found matching "{{ searchQuery }}"
      </div>
      
      <div v-else-if="displayedNodes.length === 0" class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        No files to display
      </div>
      
      <div v-else class="file-tree-nodes">
        <FileTreeNode
          v-for="node in displayedNodes"
          :key="node.path"
          :node="node"
          :level="0"
          :is-selected="selectedPath === node.path"
          :is-expanded="expandedPaths.has(node.path)"
          :is-loading="loadingPaths.has(node.path)"
          :search-query="isSearchActive ? searchQuery : undefined"
          @select="$emit('select', $event)"
          @expand="$emit('expand', $event)"
          @collapse="$emit('collapse', $event)"
          @context-menu="$emit('context-menu', $event)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="file-tree-footer p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
      <div class="flex justify-between items-center">
        <span>{{ totalFiles }} files, {{ totalDirectories }} folders</span>
        <span v-if="!isConnected" class="text-red-500">Disconnected</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { FileTreePanelProps } from './types'
import type { FileSystemNode } from '../../types/filesystem'
import FileTreeNode from './FileTreeNode.vue'

// Props
const props = defineProps<FileTreePanelProps>()

// Emits
const emit = defineEmits<{
  select: [path: string]
  expand: [path: string]
  collapse: [path: string]
  search: [query: string]
  'context-menu': [event: { node: FileSystemNode; x: number; y: number }]
  refresh: []
}>()

// Refs
const searchInput = ref<HTMLInputElement>()

// Computed
const isSearchActive = computed(() => props.searchQuery.trim().length > 0)

const searchResults = computed(() => {
  if (!isSearchActive.value) return []
  
  const query = props.searchQuery.toLowerCase()
  const allNodes = Array.from(props.fileTree.values())
  
  return allNodes.filter(node => {
    return node.name.toLowerCase().includes(query) ||
           node.path.toLowerCase().includes(query)
  })
})

const displayedNodes = computed(() => {
  if (isSearchActive.value) {
    return searchResults.value
  }
  
  // Show root nodes and their expanded children
  const rootNodes = Array.from(props.fileTree.values())
    .filter(node => !node.parent || node.parent === '')
    .sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  
  return rootNodes
})

const totalFiles = computed(() => {
  return Array.from(props.fileTree.values()).filter(node => node.type === 'file').length
})

const totalDirectories = computed(() => {
  return Array.from(props.fileTree.values()).filter(node => node.type === 'directory').length
})

const isLoading = computed(() => props.loadingPaths.size > 0)
const isConnected = computed(() => true) // TODO: Get from connection store

// Methods
const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('search', target.value)
}

const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    clearSearch()
  } else if (event.key === 'Enter' && searchResults.value.length > 0) {
    // Select first search result
    const firstResult = searchResults.value[0]
    if (firstResult) {
      emit('select', firstResult.path)
    }
  }
}

const clearSearch = () => {
  emit('search', '')
}

const focusSearch = async () => {
  await nextTick()
  searchInput.value?.focus()
}

// Expose methods for parent component
defineExpose({
  focusSearch
})
</script>

<style scoped>
.file-tree-panel {
  min-height: 0;
}

.file-tree-content {
  min-height: 0;
}

.file-tree-nodes {
  padding: 0.25rem 0;
}
</style>