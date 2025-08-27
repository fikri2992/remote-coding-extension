<template>
  <div class="file-viewer h-full flex flex-col bg-white dark:bg-gray-900">
    <!-- Header -->
    <div class="file-viewer-header flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
          </svg>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ fileName }}
          </h2>
        </div>
        <span v-if="fileSize" class="text-sm text-gray-500 dark:text-gray-400">
          {{ formatFileSize(fileSize) }}
        </span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          v-if="canEdit"
          @click="toggleEditMode"
          :class="[
            'px-3 py-1 text-sm rounded-lg transition-colors',
            isEditing 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          ]"
        >
          {{ isEditing ? 'View' : 'Edit' }}
        </button>
        <button
          v-if="isEditing"
          @click="saveFile"
          :disabled="!hasChanges || isSaving"
          class="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSaving ? 'Saving...' : 'Save' }}
        </button>
        <button
          @click="refreshFile"
          :disabled="isLoading"
          class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          title="Refresh"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="file-content flex-1 overflow-hidden">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <div class="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Loading file...</span>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex items-center justify-center h-full">
        <div class="text-center">
          <svg class="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Failed to load file
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            {{ error }}
          </p>
          <button
            @click="refreshFile"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- No file selected -->
      <div v-else-if="!filePath" class="flex items-center justify-center h-full">
        <div class="text-center text-gray-500 dark:text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-lg">Select a file to view its contents</p>
        </div>
      </div>

      <!-- File content -->
      <div v-else-if="fileContent !== null" class="h-full">
        <!-- Binary file -->
        <div v-if="isBinaryFile" class="flex items-center justify-center h-full">
          <div class="text-center text-gray-500 dark:text-gray-400">
            <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-lg mb-2">Binary file</p>
            <p class="text-sm">Cannot display binary content</p>
            <button
              @click="downloadFile"
              class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Download File
            </button>
          </div>
        </div>

        <!-- Image file -->
        <div v-else-if="isImageFile" class="flex items-center justify-center h-full p-4">
          <img
            :src="imageDataUrl || ''"
            :alt="fileName"
            class="max-w-full max-h-full object-contain"
            @error="handleImageError"
          />
        </div>

        <!-- Text file - Edit mode -->
        <textarea
          v-else-if="isEditing"
          v-model="editContent"
          class="w-full h-full p-4 font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-none resize-none focus:outline-none"
          :style="{ tabSize: 2 }"
          @input="handleContentChange"
        />

        <!-- Text file - View mode -->
        <div v-else class="h-full overflow-auto">
          <pre
            class="p-4 font-mono text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words"
            :style="{ tabSize: 2 }"
          >{{ fileContent }}</pre>
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div v-if="filePath && !isLoading && !error" class="status-bar flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
      <div class="flex items-center space-x-4">
        <span>{{ fileLanguage || 'Plain Text' }}</span>
        <span v-if="encoding">{{ encoding.toUpperCase() }}</span>
        <span v-if="lineCount">{{ lineCount }} lines</span>
      </div>
      <div class="flex items-center space-x-4">
        <span v-if="lastModified">
          Modified: {{ formatDate(lastModified) }}
        </span>
        <span v-if="hasChanges" class="text-orange-600 dark:text-orange-400">
          Unsaved changes
        </span>
      </div>
    </div>

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
import { ref, computed, watch, onMounted } from 'vue'
import { useFileSystem } from '../../composables/useFileSystem'
import type { FileContent } from '../../types/filesystem'
import NotificationToast from '../common/NotificationToast.vue'

interface Props {
  filePath?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  filePath: null
})

// Composables
const fileSystem = useFileSystem()

// State
const fileContent = ref<string | null>(null)
const editContent = ref('')
const originalContent = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const isEditing = ref(false)
const error = ref<string | null>(null)
const fileSize = ref<number | null>(null)
const encoding = ref<string | null>(null)
const fileLanguage = ref<string | null>(null)
const lastModified = ref<Date | null>(null)
const imageDataUrl = ref<string | null>(null)

const notification = ref({
  show: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'error' | 'warning'
})

// Computed
const fileName = computed(() => {
  if (!props.filePath) return ''
  return fileSystem.getFileName(props.filePath)
})

const fileExtension = computed(() => {
  if (!props.filePath) return ''
  return fileSystem.getFileExtension(props.filePath)
})

const isBinaryFile = computed(() => {
  const binaryExtensions = ['exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'db', 'sqlite']
  return binaryExtensions.includes(fileExtension.value)
})

const isImageFile = computed(() => {
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']
  return imageExtensions.includes(fileExtension.value)
})

const canEdit = computed(() => {
  if (isBinaryFile.value || isImageFile.value) return false
  
  const editableExtensions = [
    'txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'sass', 'less',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'env',
    'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'
  ]
  
  return editableExtensions.includes(fileExtension.value) || !fileExtension.value
})

const hasChanges = computed(() => {
  return isEditing.value && editContent.value !== originalContent.value
})

const lineCount = computed(() => {
  if (!fileContent.value) return 0
  return fileContent.value.split('\n').length
})

// Methods
const loadFile = async () => {
  if (!props.filePath) {
    fileContent.value = null
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const content: FileContent = await fileSystem.readFile(props.filePath)
    
    fileContent.value = content.content
    originalContent.value = content.content
    editContent.value = content.content
    fileSize.value = content.size
    encoding.value = content.encoding || null
    fileLanguage.value = content.language || null
    lastModified.value = content.modified

    // Handle image files
    if (isImageFile.value) {
      await loadImageDataUrl()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load file'
    fileContent.value = null
  } finally {
    isLoading.value = false
  }
}

const loadImageDataUrl = async () => {
  if (!props.filePath || !isImageFile.value) return

  try {
    // For now, we'll use a placeholder. In a real implementation,
    // you'd convert the file content to a data URL
    imageDataUrl.value = `data:image/${fileExtension.value};base64,${btoa(fileContent.value || '')}`
  } catch (err) {
    console.error('Failed to load image data URL:', err)
  }
}

const refreshFile = async () => {
  await loadFile()
  showNotification('File refreshed', 'success')
}

const toggleEditMode = () => {
  if (isEditing.value && hasChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
      return
    }
    editContent.value = originalContent.value
  }
  
  isEditing.value = !isEditing.value
}

const handleContentChange = () => {
  // Content change is handled by v-model and computed hasChanges
}

const saveFile = async () => {
  if (!props.filePath || !hasChanges.value) return

  isSaving.value = true

  try {
    await fileSystem.writeFile(props.filePath, editContent.value, encoding.value || 'utf8')
    
    originalContent.value = editContent.value
    fileContent.value = editContent.value
    lastModified.value = new Date()
    
    showNotification('File saved successfully', 'success')
  } catch (err) {
    showNotification('Failed to save file', 'error')
  } finally {
    isSaving.value = false
  }
}

const downloadFile = () => {
  if (!props.filePath || !fileContent.value) return

  const blob = new Blob([fileContent.value], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const handleImageError = () => {
  showNotification('Failed to load image', 'error')
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatDate = (date: Date): string => {
  return date.toLocaleString()
}

const showNotification = (message: string, type: 'info' | 'success' | 'error' | 'warning') => {
  notification.value = { show: true, message, type }
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

// Watchers
watch(() => props.filePath, async (newPath) => {
  if (newPath) {
    await loadFile()
  } else {
    fileContent.value = null
    isEditing.value = false
  }
}, { immediate: true })

// Handle beforeunload to warn about unsaved changes
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (hasChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})
</script>

<style scoped>
.file-viewer {
  min-height: 0; /* Allow flex child to shrink */
}

.file-content {
  min-height: 0; /* Allow flex child to shrink */
}

/* Custom scrollbar for text content */
.file-content pre::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.file-content pre::-webkit-scrollbar-track {
  background: transparent;
}

.file-content pre::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.file-content pre::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Dark mode scrollbar */
.dark .file-content pre::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.dark .file-content pre::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>