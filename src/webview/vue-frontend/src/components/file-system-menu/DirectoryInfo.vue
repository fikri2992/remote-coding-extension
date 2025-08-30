<template>
  <div class="directory-info h-full flex flex-col">
    <!-- Header -->
    <div class="directory-info-header p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">
          Directory Information
        </h4>
        <button
          @click="copyPath"
          class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
        >
          Copy Path
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="directory-info-content flex-1 overflow-auto p-4">
      <!-- Directory Icon -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-lg mb-3">
          <svg class="w-8 h-8 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">
          {{ metadata.name }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Directory
        </p>
      </div>

      <!-- Directory Statistics -->
      <div class="space-y-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Contents
          </h4>
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {{ directoryStats.fileCount }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Files
              </div>
            </div>
            <div class="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div class="text-2xl font-bold text-green-600 dark:text-green-400">
                {{ directoryStats.directoryCount }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Folders
              </div>
            </div>
          </div>
          <div class="mt-4 text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ formatFileSize(directoryStats.totalSize) }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total Size
            </div>
          </div>
        </div>

        <!-- Directory Details -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Directory Details
          </h4>
          <dl class="space-y-2">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Modified:</dt>
              <dd class="text-sm text-gray-900 dark:text-white">
                {{ formatDate(metadata.modified) }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Created:</dt>
              <dd class="text-sm text-gray-900 dark:text-white">
                {{ formatDate(metadata.created) }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500 dark:text-gray-400">Items:</dt>
              <dd class="text-sm text-gray-900 dark:text-white">
                {{ directoryStats.totalItems }} total
              </dd>
            </div>
          </dl>
        </div>

        <!-- Permissions (if available) -->
        <div v-if="metadata.permissions" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Permissions
          </h4>
          <div class="flex space-x-4">
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" :class="metadata.permissions.readable ? 'text-green-500' : 'text-gray-400'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 12a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.522 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm" :class="metadata.permissions.readable ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
                Read
              </span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" :class="metadata.permissions.writable ? 'text-green-500' : 'text-gray-400'" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              <span class="text-sm" :class="metadata.permissions.writable ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
                Write
              </span>
            </div>
            <div class="flex items-center">
              <svg class="w-4 h-4 mr-2" :class="metadata.permissions.executable ? 'text-green-500' : 'text-gray-400'" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm" :class="metadata.permissions.executable ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'">
                Execute
              </span>
            </div>
          </div>
        </div>

        <!-- File Type Breakdown (if showDetails is true) -->
        <div v-if="showDetails && fileTypeBreakdown.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            File Types
          </h4>
          <div class="space-y-2">
            <div
              v-for="fileType in fileTypeBreakdown"
              :key="fileType.extension"
              class="flex items-center justify-between py-1"
            >
              <div class="flex items-center">
                <div class="w-3 h-3 rounded-full mr-2" :style="{ backgroundColor: fileType.color }"></div>
                <span class="text-sm text-gray-900 dark:text-white">
                  {{ fileType.extension || 'No extension' }}
                </span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ fileType.count }}
                </span>
                <span class="text-xs text-gray-400 dark:text-gray-500">
                  ({{ Math.round((fileType.count / directoryStats.fileCount) * 100) }}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Path Information -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Location
          </h4>
          <div class="space-y-2">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400 mb-1">Full Path:</dt>
              <dd class="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded break-all">
                {{ metadata.path }}
              </dd>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Actions
          </h4>
          <div class="flex flex-wrap gap-2">
            <button
              @click="copyPath"
              class="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              Copy Path
            </button>
            <button
              @click="copyRelativePath"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Copy Relative Path
            </button>
            <button
              @click="revealInExplorer"
              class="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800"
            >
              Reveal in Explorer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileMetadata } from './types'

// Props
interface DirectoryInfoProps {
  metadata: FileMetadata
  showDetails?: boolean
}

const props = withDefaults(defineProps<DirectoryInfoProps>(), {
  showDetails: true
})

// Emits
const emit = defineEmits<{
  'copy-path': [path: string]
  'copy-relative-path': [path: string]
  'reveal-in-explorer': [path: string]
}>()

// Mock directory statistics (in real implementation, this would come from the file system)
const directoryStats = computed(() => ({
  fileCount: 42,
  directoryCount: 8,
  totalItems: 50,
  totalSize: 1024 * 1024 * 15.7 // ~15.7 MB
}))

// Mock file type breakdown (in real implementation, this would be calculated from directory contents)
const fileTypeBreakdown = computed(() => [
  { extension: '.js', count: 15, color: '#f7df1e' },
  { extension: '.ts', count: 12, color: '#3178c6' },
  { extension: '.vue', count: 8, color: '#4fc08d' },
  { extension: '.json', count: 4, color: '#00d084' },
  { extension: '.md', count: 2, color: '#083fa1' },
  { extension: '', count: 1, color: '#6b7280' }
])

// Methods
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const copyPath = async () => {
  try {
    await navigator.clipboard.writeText(props.metadata.path)
    emit('copy-path', props.metadata.path)
  } catch (error) {
    console.error('Failed to copy path:', error)
  }
}

const copyRelativePath = async () => {
  try {
    // Extract relative path (this would need to be calculated based on workspace root)
    const relativePath = props.metadata.path.replace(/^.*\//, './')
    await navigator.clipboard.writeText(relativePath)
    emit('copy-relative-path', relativePath)
  } catch (error) {
    console.error('Failed to copy relative path:', error)
  }
}

const revealInExplorer = () => {
  emit('reveal-in-explorer', props.metadata.path)
}
</script>

<style scoped>
.directory-info {
  min-height: 0;
}

.directory-info-content {
  min-height: 0;
}

/* Scrollbar styling */
.directory-info-content::-webkit-scrollbar {
  width: 8px;
}

.directory-info-content::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.directory-info-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.directory-info-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark .directory-info-content::-webkit-scrollbar-track {
  background: #1e293b;
}

.dark .directory-info-content::-webkit-scrollbar-thumb {
  background: #475569;
}

.dark .directory-info-content::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>