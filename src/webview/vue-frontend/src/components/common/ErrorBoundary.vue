<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-container">
      <div class="error-icon">
        <svg class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <div class="error-content">
        <h2 class="error-title">{{ title }}</h2>
        <p class="error-message">{{ message }}</p>
        
        <div v-if="showDetails && errorDetails" class="error-details">
          <details class="mt-4">
            <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              Show technical details
            </summary>
            <pre class="error-stack">{{ errorDetails }}</pre>
          </details>
        </div>
        
        <div class="error-actions">
          <button
            @click="retry"
            class="btn-primary"
            :disabled="retrying"
          >
            <LoadingSpinner v-if="retrying" size="sm" color="white" />
            <span v-else>Try Again</span>
          </button>
          
          <button
            v-if="showReload"
            @click="reload"
            class="btn-secondary"
          >
            Reload Page
          </button>
          
          <button
            v-if="showReport"
            @click="reportError"
            class="btn-outline"
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, provide } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  title?: string
  message?: string
  showDetails?: boolean
  showReload?: boolean
  showReport?: boolean
  onRetry?: () => void | Promise<void>
  onReport?: (error: Error) => void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  showDetails: true,
  showReload: true,
  showReport: false
})

const emit = defineEmits<{
  error: [error: Error, info: string]
  retry: []
  report: [error: Error]
}>()

const hasError = ref(false)
const errorDetails = ref<string>('')
const retrying = ref(false)
const currentError = ref<Error | null>(null)

// Provide error boundary context to child components
provide('errorBoundary', {
  reportError: (error: Error) => {
    handleError(error, 'Component Error')
  }
})

onErrorCaptured((error: Error, _instance, info: string) => {
  handleError(error, info)
  return false // Prevent the error from propagating further
})

const handleError = (error: Error, info: string) => {
  console.error('Error caught by ErrorBoundary:', error)
  console.error('Error info:', info)
  
  hasError.value = true
  currentError.value = error
  errorDetails.value = `${error.name}: ${error.message}\n\nStack trace:\n${error.stack || 'No stack trace available'}\n\nComponent info: ${info}`
  
  emit('error', error, info)
  
  // Report to error tracking service if available
  if ((window as any).errorReporter) {
    (window as any).errorReporter.captureException(error, {
      tags: { component: 'ErrorBoundary' },
      extra: { info }
    })
  }
}

const retry = async () => {
  if (retrying.value) return
  
  retrying.value = true
  
  try {
    if (props.onRetry) {
      await props.onRetry()
    }
    
    // Reset error state
    hasError.value = false
    errorDetails.value = ''
    currentError.value = null
    
    emit('retry')
  } catch (error) {
    console.error('Retry failed:', error)
    // Keep error state if retry fails
  } finally {
    retrying.value = false
  }
}

const reload = () => {
  window.location.reload()
}

const reportError = () => {
  if (currentError.value) {
    if (props.onReport) {
      props.onReport(currentError.value)
    }
    emit('report', currentError.value)
  }
}

// Expose methods for parent components
defineExpose({
  retry,
  reload,
  reportError,
  hasError: () => hasError.value
})
</script>

<style scoped>
.error-boundary {
  @apply min-h-96 flex items-center justify-center p-6;
}

.error-container {
  @apply max-w-md w-full text-center;
}

.error-icon {
  @apply flex justify-center mb-4;
}

.error-content {
  @apply space-y-4;
}

.error-title {
  @apply text-xl font-semibold text-gray-900;
}

.error-message {
  @apply text-gray-600 leading-relaxed;
}

.error-details {
  @apply text-left;
}

.error-stack {
  @apply mt-2 p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap;
}

.error-actions {
  @apply flex flex-col sm:flex-row gap-3 justify-center mt-6;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-24;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2;
}

.btn-outline {
  @apply px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}
</style>