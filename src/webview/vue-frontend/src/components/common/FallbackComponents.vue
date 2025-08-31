<template>
  <div>
    <!-- Automation View Error Fallback -->
    <div v-if="type === 'automation'" class="automation-error-fallback">
      <div class="error-container">
        <div class="error-icon">
          <svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="error-title">Automation Panel Error</h2>
        <p class="error-message">
          The automation panel encountered an error and couldn't load properly. 
          You can try refreshing or continue using other features.
        </p>
        <div class="error-actions">
          <button @click="$emit('retry')" class="btn-primary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Loading
          </button>
          <button @click="$emit('reload')" class="btn-secondary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload Page
          </button>
        </div>
        <div class="error-info">
          <p class="text-sm text-gray-600">
            Other features like file browsing and terminal should still work normally.
          </p>
        </div>
      </div>
    </div>

    <!-- File System Menu Error Fallback -->
    <div v-else-if="type === 'file-system'" class="file-system-error-fallback">
      <div class="error-container">
        <div class="error-icon">
          <svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
          </svg>
        </div>
        <h2 class="error-title">File System Error</h2>
        <p class="error-message">
          The file system browser encountered an error and couldn't load properly. 
          This might be due to connection issues or file access problems.
        </p>
        <div class="error-actions">
          <button @click="$emit('retry')" class="btn-primary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry Loading
          </button>
          <button @click="$emit('connect')" class="btn-secondary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            Check Connection
          </button>
        </div>
        <div class="error-info">
          <p class="text-sm text-gray-600">
            Try connecting to VS Code or check if the workspace folder is accessible.
          </p>
        </div>
      </div>
    </div>

    <!-- Generic Component Error Fallback -->
    <div v-else class="generic-error-fallback">
      <div class="error-container">
        <div class="error-icon">
          <svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 class="error-title">Component Error</h3>
        <p class="error-message">
          This component encountered an error and couldn't load properly.
        </p>
        <div class="error-actions">
          <button @click="$emit('retry')" class="btn-primary">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  type?: 'automation' | 'file-system' | 'generic'
  error?: Error
  errorInfo?: any
}

withDefaults(defineProps<Props>(), {
  type: 'generic'
})

defineEmits<{
  retry: []
  reload: []
  connect: []
}>()
</script>

<style scoped>
.automation-error-fallback,
.file-system-error-fallback,
.generic-error-fallback {
  @apply min-h-96 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-800;
}

.error-container {
  @apply max-w-md w-full text-center;
}

.error-icon {
  @apply flex justify-center mb-4;
}

.error-title {
  @apply text-xl font-semibold text-gray-900 dark:text-white mb-2;
}

.error-message {
  @apply text-gray-600 dark:text-gray-300 leading-relaxed mb-6;
}

.error-actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center mb-4;
}

.error-info {
  @apply mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors;
}
</style>