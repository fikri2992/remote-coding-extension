<template>
  <div class="files-view h-full flex bg-gray-50 dark:bg-gray-900">
    <!-- Left panel - File Explorer -->
    <div class="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <FileExplorer
        @file-select="handleFileSelect"
        @search-toggle="showSearch = !showSearch"
      />
      
      <!-- Search panel -->
      <div v-if="showSearch" class="border-t border-gray-200 dark:border-gray-700">
        <FileSearch
          @close="showSearch = false"
          @select="handleSearchResult"
        />
      </div>
    </div>

    <!-- Right panel - File Viewer -->
    <div class="flex-1 flex flex-col">
      <FileViewer
        :file-path="selectedFilePath"
      />
    </div>

    <!-- Floating search button -->
    <button
      v-if="!showSearch"
      @click="showSearch = true"
      class="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-10"
      title="Advanced Search"
    >
      <svg class="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileSystemNode, FileSearchResult } from '../types/filesystem'
import FileExplorer from '../components/files/FileExplorer.vue'
import FileViewer from '../components/files/FileViewer.vue'
import FileSearch from '../components/files/FileSearch.vue'

// State
const selectedFilePath = ref<string | null>(null)
const showSearch = ref(false)

// Methods
const handleFileSelect = (node: FileSystemNode) => {
  if (node.type === 'file') {
    selectedFilePath.value = node.path
  }
}

const handleSearchResult = (result: FileSearchResult) => {
  if (result.type === 'file') {
    selectedFilePath.value = result.path
    showSearch.value = false
  }
}
</script>

<style scoped>
.files-view {
  min-height: 100vh;
}
</style>
