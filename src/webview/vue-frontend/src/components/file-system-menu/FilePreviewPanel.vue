<template>
  <div class="file-preview-panel h-full flex flex-col bg-white dark:bg-gray-900">
    <!-- Header -->
    <div class="preview-header p-3 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-900 dark:text-white">
          Preview
        </h3>
        <button
          @click="$emit('toggle-preview')"
          class="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          :title="visible ? 'Hide Preview' : 'Show Preview'"
        >
          <svg v-if="visible" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-1.415-1.414M14.12 14.12l1.415 1.415M14.12 14.12L15.536 15.536M14.12 14.12l1.414 1.414" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>
      
      <!-- File path -->
      <div v-if="selectedPath && visible" class="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
        {{ selectedPath }}
      </div>
    </div>

    <!-- Content -->
    <div v-if="visible" class="preview-content flex-1 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="h-full flex items-center justify-center">
        <div class="text-center">
          <svg class="animate-spin w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="h-full flex items-center justify-center">
        <div class="text-center p-4">
          <svg class="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p class="text-sm text-red-600 dark:text-red-400 mb-2">Preview Error</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ error }}</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!selectedPath" class="h-full flex items-center justify-center">
        <div class="text-center p-4">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400">Select a file to preview</p>
        </div>
      </div>

      <!-- Preview Content -->
      <div v-else-if="previewContent" class="h-full overflow-auto">
        <!-- Text Preview -->
        <TextPreview
          v-if="previewContent.type === 'text'"
          :content="previewContent.content || ''"
          :language="previewContent.language || 'text'"
          :path="previewContent.path"
          :max-lines="1000"
          :show-line-numbers="true"
        />

        <!-- Image Preview -->
        <ImagePreview
          v-else-if="previewContent.type === 'image'"
          :src="getImageSrc()"
          :alt="previewContent.metadata.name"
          :show-metadata="true"
        />

        <!-- Binary File Info -->
        <BinaryFileInfo
          v-else-if="previewContent.type === 'binary'"
          :metadata="previewContent.metadata"
          :show-details="true"
        />

        <!-- Directory Info -->
        <DirectoryInfo
          v-else-if="previewContent.type === 'directory'"
          :metadata="previewContent.metadata"
          :show-details="true"
        />
      </div>
    </div>

    <!-- Collapsed State -->
    <div v-else class="preview-collapsed flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
      <div class="text-center p-4">
        <svg class="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <p class="text-xs text-gray-500 dark:text-gray-400">Preview hidden</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FilePreviewPanelProps } from './types'

import TextPreview from './TextPreview.vue'
import ImagePreview from './ImagePreview.vue'
import BinaryFileInfo from './BinaryFileInfo.vue'
import DirectoryInfo from './DirectoryInfo.vue'

// Props
const props = defineProps<FilePreviewPanelProps>()

// Emits
const emit = defineEmits<{
  'toggle-preview': []
}>()

// Computed
const previewContent = computed(() => props.previewContent)

// Methods
const getImageSrc = (): string => {
  // This would need to be implemented to serve images through the WebSocket or HTTP server
  // For now, return a placeholder
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="100" text-anchor="middle" fill="%236b7280">Image</text></svg>`
}
</script>

<style scoped>
.file-preview-panel {
  min-height: 0;
}

.preview-content {
  min-height: 0;
}

.preview-collapsed {
  border-left: 2px dashed #e5e7eb;
}

.dark .preview-collapsed {
  border-left-color: #374151;
}
</style>