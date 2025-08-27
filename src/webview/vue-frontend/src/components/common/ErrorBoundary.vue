<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-container">
      <div class="error-icon">
        <svg 
          class="w-12 h-12" 
          :class="getIconClass()" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            :d="getIconPath()" 
          />
        </svg>
      </div>
      
      <div class="error-content">
        <h2 class="error-title">{{ displayTitle }}</h2>
        <p class="error-message">{{ displayMessage }}</p>
        
        <!-- Custom recovery actions -->
        <div v-if="customRecoveryActions.length > 0" class="recovery-actions">
          <h3 class="recovery-title">Try these solutions:</h3>
          <div class="recovery-list">
            <button
              v-for="action in customRecoveryActions"
              :key="action.label"
              @click="executeRecoveryAction(action)"
              class="recovery-action"
              :class="{ 'recovery-primary': action.primary }"
              :disabled="!!executingAction"
            >
              <LoadingSpinner v-if="executingAction === action.label" size="sm" />
              <span>{{ action.label }}</span>
            </button>
          </div>
        </div>
        
        <!-- Technical details -->
        <div v-if="showDetails && errorDetails" class="error-details">
          <details class="mt-4">
            <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Show technical details
            </summary>
            <div class="error-stack-container">
              <pre class="error-stack">{{ errorDetails }}</pre>
              <button @click="copyErrorDetails" class="copy-button">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
          </details>
        </div>
        
        <!-- Error metadata -->
        <div v-if="showDetails && errorMetadata" class="error-metadata">
          <details class="mt-2">
            <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              Error context
            </summary>
            <div class="metadata-content">
              <div v-for="(value, key) in errorMetadata" :key="key" class="metadata-item">
                <span class="metadata-key">{{ key }}:</span>
                <span class="metadata-value">{{ formatMetadataValue(value) }}</span>
              </div>
            </div>
          </details>
        </div>
        
        <!-- Default actions -->
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
            v-if="showReport && canReport"
            @click="reportError"
            class="btn-outline"
            :disabled="reporting"
          >
            <LoadingSpinner v-if="reporting" size="sm" />
            <span v-else>Report Issue</span>
          </button>
          
          <button
            v-if="showExport"
            @click="exportDebugData"
            class="btn-outline"
          >
            Export Debug Data
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured, provide } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'
import { captureError } from '../../services/error-handler'
import { debugService } from '../../services/debug'
import type { ErrorRecoveryAction } from '../../types/errors'
import { AppError } from '../../types/errors'

interface Props {
  title?: string
  message?: string
  showDetails?: boolean
  showReload?: boolean
  showReport?: boolean
  showExport?: boolean
  onRetry?: () => void | Promise<void>
  onReport?: (error: Error) => void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  showDetails: true,
  showReload: true,
  showReport: true,
  showExport: import.meta.env.DEV
})

const emit = defineEmits<{
  error: [error: Error, info: string]
  retry: []
  report: [error: Error]
}>()

const hasError = ref(false)
const errorDetails = ref<string>('')
const errorMetadata = ref<Record<string, any> | null>(null)
const retrying = ref(false)
const reporting = ref(false)
const executingAction = ref<string | null>(null)
const currentError = ref<Error | AppError | null>(null)
const errorInfo = ref<string>('')

// Computed properties for display
const displayTitle = computed(() => {
  if (currentError.value instanceof AppError) {
    return currentError.value.userFriendly.title
  }
  return props.title
})

const displayMessage = computed(() => {
  if (currentError.value instanceof AppError) {
    return currentError.value.userFriendly.message
  }
  return props.message
})

const customRecoveryActions = computed(() => {
  if (currentError.value instanceof AppError) {
    return currentError.value.userFriendly.recoveryActions || []
  }
  return []
})

const canReport = computed(() => {
  if (currentError.value instanceof AppError) {
    return currentError.value.userFriendly.reportable !== false
  }
  return true
})

// Provide error boundary context to child components
provide('errorBoundary', {
  reportError: (error: Error) => {
    handleError(error, 'Component Error')
  }
})

onErrorCaptured((error: Error, instance, info: string) => {
  handleError(error, info, instance)
  return false // Prevent the error from propagating further
})

const handleError = (error: Error | AppError, info: string, instance?: any) => {
  console.error('Error caught by ErrorBoundary:', error)
  console.error('Error info:', info)
  
  hasError.value = true
  currentError.value = error
  errorInfo.value = info
  
  // Build error details
  const stackTrace = error.stack || 'No stack trace available'
  const componentName = instance?.$options.name || instance?.$options.__name || 'Unknown'
  
  errorDetails.value = `${error.name}: ${error.message}\n\nStack trace:\n${stackTrace}\n\nComponent: ${componentName}\nError info: ${info}`
  
  // Build error metadata
  errorMetadata.value = {
    component: componentName,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...(error instanceof AppError ? {
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      context: error.context
    } : {})
  }
  
  // Capture error with error handler service
  captureError(error, {
    context: {
      component: componentName,
      action: 'error_boundary_capture'
    }
  })
  
  emit('error', error, info)
}

const getIconClass = () => {
  if (currentError.value instanceof AppError) {
    const severityClasses = {
      low: 'text-yellow-500',
      medium: 'text-orange-500',
      high: 'text-red-500',
      critical: 'text-red-600'
    }
    return severityClasses[currentError.value.severity]
  }
  return 'text-red-500'
}

const getIconPath = () => {
  if (currentError.value instanceof AppError) {
    const categoryIcons = {
      network: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
      validation: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
      authentication: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      permission: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728',
      websocket: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
      filesystem: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      git: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
      terminal: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      ui: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
      unknown: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
    }
    return categoryIcons[currentError.value.category] || categoryIcons.unknown
  }
  return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
}

const executeRecoveryAction = async (action: ErrorRecoveryAction) => {
  if (executingAction.value) return
  
  executingAction.value = action.label
  
  try {
    await action.action()
    
    // If action succeeds, reset error state
    hasError.value = false
    errorDetails.value = ''
    errorMetadata.value = null
    currentError.value = null
    errorInfo.value = ''
  } catch (actionError) {
    console.error('Recovery action failed:', actionError)
    captureError(actionError as Error, {
      context: { action: 'recovery_action_failed', recoveryAction: action.label }
    })
  } finally {
    executingAction.value = null
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
    errorMetadata.value = null
    currentError.value = null
    errorInfo.value = ''
    
    emit('retry')
  } catch (error) {
    console.error('Retry failed:', error)
    captureError(error as Error, {
      context: { action: 'error_boundary_retry_failed' }
    })
  } finally {
    retrying.value = false
  }
}

const reload = () => {
  window.location.reload()
}

const reportError = async () => {
  if (!currentError.value || reporting.value) return
  
  reporting.value = true
  
  try {
    if (props.onReport) {
      props.onReport(currentError.value)
    }
    
    emit('report', currentError.value)
    
    // Show success notification
    const event = new CustomEvent('app-notification', {
      detail: {
        type: 'success',
        message: 'Error report sent successfully. Thank you for helping us improve!'
      }
    })
    window.dispatchEvent(event)
  } catch (error) {
    console.error('Error reporting failed:', error)
    
    const event = new CustomEvent('app-notification', {
      detail: {
        type: 'error',
        message: 'Failed to send error report. Please try again later.'
      }
    })
    window.dispatchEvent(event)
  } finally {
    reporting.value = false
  }
}

const copyErrorDetails = async () => {
  try {
    await navigator.clipboard.writeText(errorDetails.value)
    
    const event = new CustomEvent('app-notification', {
      detail: {
        type: 'success',
        message: 'Error details copied to clipboard'
      }
    })
    window.dispatchEvent(event)
  } catch (error) {
    console.error('Failed to copy error details:', error)
  }
}

const exportDebugData = () => {
  const debugData = debugService.exportDebugData()
  const blob = new Blob([debugData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `debug-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const formatMetadataValue = (value: any): string => {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Expose methods for parent components
defineExpose({
  retry,
  reload,
  reportError,
  exportDebugData,
  hasError: () => hasError.value
})
</script>

<style scoped>
.error-boundary {
  @apply min-h-96 flex items-center justify-center p-6;
}

.error-container {
  @apply max-w-2xl w-full text-center;
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

.recovery-actions {
  @apply text-left bg-blue-50 p-4 rounded-lg;
}

.recovery-title {
  @apply text-sm font-medium text-blue-900 mb-3;
}

.recovery-list {
  @apply space-y-2;
}

.recovery-action {
  @apply w-full px-3 py-2 text-sm bg-white border border-blue-200 text-blue-700 rounded hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2;
}

.recovery-primary {
  @apply bg-blue-600 text-white border-blue-600 hover:bg-blue-700;
}

.error-details {
  @apply text-left;
}

.error-stack-container {
  @apply relative mt-2;
}

.error-stack {
  @apply p-3 bg-gray-100 rounded text-xs text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap pr-12;
}

.copy-button {
  @apply absolute top-2 right-2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none;
}

.error-metadata {
  @apply text-left;
}

.metadata-content {
  @apply mt-2 p-3 bg-gray-50 rounded text-xs space-y-1;
}

.metadata-item {
  @apply flex gap-2;
}

.metadata-key {
  @apply font-medium text-gray-600 min-w-20;
}

.metadata-value {
  @apply text-gray-800 break-all;
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
  @apply px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2;
}
</style>