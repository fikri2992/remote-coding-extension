<template>
  <div class="file-search bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
    <!-- Search header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Advanced Search
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Search input -->
      <div class="relative mb-4">
        <input
          v-model="searchOptions.query"
          @keyup.enter="performSearch"
          type="text"
          placeholder="Search for files and content..."
          class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
        <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <!-- Search options -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input v-model="searchOptions.caseSensitive" type="checkbox" class="mr-2">
          Case sensitive
        </label>
        <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input v-model="searchOptions.useRegex" type="checkbox" class="mr-2">
          Use regex
        </label>
        <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input v-model="searchOptions.includeFiles" type="checkbox" class="mr-2">
          Include files
        </label>
        <label class="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <input v-model="searchOptions.includeDirectories" type="checkbox" class="mr-2">
          Include directories
        </label>
      </div>

      <!-- Include/exclude patterns -->
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Include patterns (comma-separated)
          </label>
          <input
            v-model="includePatterns"
            type="text"
            placeholder="*.js, *.ts, *.vue"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Exclude patterns (comma-separated)
          </label>
          <input
            v-model="excludePatterns"
            type="text"
            placeholder="node_modules, *.log, .git"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
        </div>
      </div>

      <!-- Search button -->
      <button
        @click="performSearch"
        :disabled="!searchOptions.query.trim() || isSearching"
        class="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ isSearching ? 'Searching...' : 'Search' }}
      </button>
    </div>    <!-
- Search results -->
    <div v-if="searchResults.length > 0 || hasSearched" class="search-results max-h-96 overflow-auto">
      <!-- Results header -->
      <div class="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ searchResults.length }} results found
          </span>
          <button
            v-if="searchResults.length > 0"
            @click="clearResults"
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- No results -->
      <div v-if="searchResults.length === 0 && hasSearched" class="p-8 text-center text-gray-500 dark:text-gray-400">
        <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p>No results found for "{{ searchOptions.query }}"</p>
      </div>

      <!-- Results list -->
      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="result in searchResults"
          :key="result.path"
          @click="selectResult(result)"
          class="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
        >
          <div class="flex items-center space-x-3">
            <!-- File icon -->
            <svg
              v-if="result.type === 'file'"
              class="w-4 h-4 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
            </svg>
            <svg
              v-else
              class="w-4 h-4 text-yellow-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ result.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ result.path }}
              </p>
            </div>

            <!-- Match score -->
            <div v-if="result.score" class="text-xs text-gray-500 dark:text-gray-400">
              {{ Math.round(result.score * 100) }}%
            </div>
          </div>

          <!-- Content matches -->
          <div v-if="result.matches && result.matches.length > 0" class="mt-2 ml-7">
            <div
              v-for="match in result.matches.slice(0, 3)"
              :key="`${match.line}-${match.column}`"
              class="text-xs text-gray-600 dark:text-gray-400 mb-1"
            >
              <span class="text-gray-500 dark:text-gray-500">Line {{ match.line }}:</span>
              <span class="ml-2 font-mono">{{ match.text }}</span>
            </div>
            <div v-if="result.matches.length > 3" class="text-xs text-gray-500 dark:text-gray-400">
              +{{ result.matches.length - 3 }} more matches
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template><script
 setup lang="ts">
import { ref, watch } from 'vue'
import { useFileSystem } from '../../composables/useFileSystem'
import type { FileSearchOptions, FileSearchResult } from '../../types/filesystem'

interface Emits {
  (e: 'close'): void
  (e: 'select', result: FileSearchResult): void
}

const emit = defineEmits<Emits>()

// Composables
const fileSystem = useFileSystem()

// State
const isSearching = ref(false)
const hasSearched = ref(false)
const searchResults = ref<FileSearchResult[]>([])
const includePatterns = ref('')
const excludePatterns = ref('')

const searchOptions = ref<FileSearchOptions>({
  query: '',
  includeFiles: true,
  includeDirectories: false,
  caseSensitive: false,
  useRegex: false,
  maxResults: 100
})

// Methods
const performSearch = async () => {
  if (!searchOptions.value.query.trim()) return

  isSearching.value = true
  hasSearched.value = true

  try {
    // Parse patterns
    const includePatternsList = includePatterns.value
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
    
    const excludePatternsList = excludePatterns.value
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)

    const options: FileSearchOptions = {
      ...searchOptions.value
    }
    
    if (includePatternsList.length > 0) {
      options.includePatterns = includePatternsList
    }
    
    if (excludePatternsList.length > 0) {
      options.excludePatterns = excludePatternsList
    }

    searchResults.value = await fileSystem.searchFiles(options)
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const clearResults = () => {
  searchResults.value = []
  hasSearched.value = false
}

const selectResult = (result: FileSearchResult) => {
  emit('select', result)
}

// Watch for Enter key in search input
watch(() => searchOptions.value.query, (newQuery) => {
  if (!newQuery.trim()) {
    clearResults()
  }
})
</script>

<style scoped>
.search-results {
  min-height: 0;
}
</style>