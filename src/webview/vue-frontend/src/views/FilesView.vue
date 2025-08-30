<template>
  <div class="files-view h-full bg-gray-50 dark:bg-gray-900">
    <!-- Error Boundary for File System Menu -->
    <ErrorBoundary
      :fallback-component="FileSystemErrorFallback"
      @error="handleFileSystemError"
    >
      <!-- File System Menu Integration -->
      <FileSystemMenu
        :initial-path="workspacePath"
        :show-preview="true"
        :allow-multi-select="false"
        height="100%"
        class="h-full"
      />
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionStore, useUIStore } from '../stores'
import { captureError, createAppError } from '../services/error-handler'
import ErrorBoundary from '../components/common/ErrorBoundary.vue'
import FileSystemMenu from '../components/file-system-menu/FileSystemMenu.vue'

// Composables
const connectionStore = useConnectionStore()
const uiStore = useUIStore()

// State
const workspacePath = ref<string>('.')

// Computed
const isConnected = computed(() => connectionStore.isConnected)

// Error Fallback Component
const FileSystemErrorFallback = {
  template: `
    <div class="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div class="text-center p-8 max-w-md">
        <div class="mb-4">
          <svg class="w-16 h-16 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          File System Error
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          The file system menu encountered an error and couldn't load properly.
        </p>
        <div class="space-y-2">
          <button
            @click="handleRetry"
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
          <button
            @click="handleReportError"
            class="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  `,
  methods: {
    handleRetry() {
      window.location.reload()
    },
    handleReportError() {
      // This would typically open a bug report dialog or redirect to an issue tracker
      console.log('Error reporting requested')
    }
  }
}

// Methods
const handleFileSystemError = (error: Error, errorInfo: any) => {
  // Capture the error with enhanced context
  const appError = createAppError(
    `File System Menu Error: ${error.message}`,
    'ui',
    'high',
    {
      component: 'FilesView',
      action: 'file_system_menu_error',
      errorInfo,
      additionalData: {
        connectionStatus: connectionStore.connectionStatus,
        isConnected: isConnected.value
      }
    },
    {
      title: 'File System Menu Error',
      message: 'The file system menu encountered an error. You can try refreshing the page or report this issue.',
      showTechnicalDetails: import.meta.env.DEV,
      reportable: true,
      recoveryActions: [
        {
          label: 'Refresh Page',
          action: () => window.location.reload(),
          primary: true
        },
        {
          label: 'Switch to Basic View',
          action: () => {
            // This would switch to a basic file view fallback
            console.log('Switching to basic view')
          }
        }
      ]
    }
  )
  
  captureError(appError)
  
  // Show user notification
  uiStore.addNotification(
    'File system menu encountered an error. Please try refreshing the page.',
    'error',
    false, // Don't auto-close
    0
  )
}

// Lifecycle
onMounted(() => {
  // Set workspace path from connection store or default
  workspacePath.value = '.' // Default workspace path
})
</script>

<style scoped>
.files-view {
  min-height: 100vh;
}
</style>
