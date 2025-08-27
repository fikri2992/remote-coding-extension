<template>
  <div class="error-demo p-6 bg-white rounded-lg shadow-sm border">
    <h3 class="text-lg font-semibold mb-4">Error Handling Demo</h3>
    <p class="text-gray-600 mb-6">
      This component demonstrates the error handling and debugging infrastructure.
      Try the buttons below to see different types of errors and recovery mechanisms.
    </p>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <!-- Error Type Demos -->
      <div class="space-y-3">
        <h4 class="font-medium text-gray-800">Error Types</h4>
        
        <button
          @click="triggerUIError"
          class="demo-btn bg-red-100 text-red-700 hover:bg-red-200"
        >
          UI Error (High Severity)
        </button>
        
        <button
          @click="triggerNetworkError"
          class="demo-btn bg-orange-100 text-orange-700 hover:bg-orange-200"
        >
          Network Error
        </button>
        
        <button
          @click="triggerValidationError"
          class="demo-btn bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
        >
          Validation Error
        </button>
        
        <button
          @click="triggerPermissionError"
          class="demo-btn bg-purple-100 text-purple-700 hover:bg-purple-200"
        >
          Permission Error
        </button>
      </div>
      
      <!-- Recovery Demos -->
      <div class="space-y-3">
        <h4 class="font-medium text-gray-800">Recovery Actions</h4>
        
        <button
          @click="triggerRecoverableError"
          class="demo-btn bg-blue-100 text-blue-700 hover:bg-blue-200"
        >
          Recoverable Error
        </button>
        
        <button
          @click="triggerAsyncError"
          class="demo-btn bg-green-100 text-green-700 hover:bg-green-200"
          :disabled="isLoading"
        >
          <LoadingSpinner v-if="isLoading" size="sm" />
          <span v-else>Async Operation Error</span>
        </button>
        
        <button
          @click="triggerCriticalError"
          class="demo-btn bg-red-200 text-red-800 hover:bg-red-300"
        >
          Critical Error
        </button>
        
        <button
          @click="addBreadcrumb('Manual breadcrumb added', 'info')"
          class="demo-btn bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          Add Breadcrumb
        </button>
      </div>
    </div>
    
    <!-- Error State Display -->
    <div v-if="hasError" class="error-state p-4 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex items-center justify-between mb-2">
        <h5 class="font-medium text-red-800">Current Error</h5>
        <button
          @click="clearError"
          class="text-red-600 hover:text-red-800"
        >
          Clear
        </button>
      </div>
      <p class="text-red-700 text-sm">{{ currentError?.message }}</p>
      <div v-if="currentError instanceof AppError" class="mt-2 text-xs text-red-600">
        Category: {{ currentError.category }} | Severity: {{ currentError.severity }}
      </div>
    </div>
    
    <!-- Debug Info -->
    <div class="mt-6 p-4 bg-gray-50 rounded-lg">
      <h5 class="font-medium text-gray-800 mb-2">Debug Information</h5>
      <div class="text-sm text-gray-600 space-y-1">
        <div>Error Handler Initialized: {{ errorHandler.isInitialized.value ? 'Yes' : 'No' }}</div>
        <div>Debug Service Enabled: {{ debugService.isEnabled.value ? 'Yes' : 'No' }}</div>
        <div>Total Errors: {{ errorHandler.stats.totalErrors }}</div>
        <div>Development Mode: {{ isDevelopment ? 'Yes' : 'No' }}</div>
      </div>
      
      <div class="mt-3">
        <button
          @click="exportDebugData"
          class="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
        >
          Export Debug Data
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useErrorHandler } from '../../composables/useErrorHandler'
import { errorHandler } from '../../services/error-handler'
import { debugService } from '../../services/debug'
import { AppError } from '../../types/errors'
import LoadingSpinner from './LoadingSpinner.vue'

const isDevelopment = computed(() => import.meta.env.DEV)

const {
  hasError,
  currentError,
  isRecovering,
  captureError,
  withErrorHandling,

  clearError,
  handleNetworkError,
  handleValidationError,
  handlePermissionError,
  addBreadcrumb
} = useErrorHandler({
  component: 'ErrorHandlingDemo',
  enableBoundary: true,
  recoveryActions: [
    {
      label: 'Reset Demo',
      action: async () => {
        clearError()
        addBreadcrumb('Demo reset successfully', 'info')
      },
      primary: true
    }
  ]
})

const isLoading = computed(() => isRecovering.value)

const triggerUIError = () => {
  captureError(
    new Error('This is a simulated UI error'),
    'ui',
    'high',
    { demoAction: 'ui_error_trigger' },
    {
      title: 'UI Component Error',
      message: 'This is a demonstration of how UI errors are handled with recovery options.',
      recoveryActions: [
        {
          label: 'Refresh Component',
          action: async () => {
            addBreadcrumb('Component refreshed via recovery action', 'info')
            clearError()
          },
          primary: true
        },
        {
          label: 'Reset State',
          action: async () => {
            addBreadcrumb('State reset via recovery action', 'info')
            clearError()
          }
        }
      ]
    }
  )
}

const triggerNetworkError = () => {
  const networkError = new Error('Failed to fetch data from server')
  networkError.name = 'NetworkError'
  handleNetworkError(networkError, 'demo_network_request', 'medium')
}

const triggerValidationError = () => {
  handleValidationError('email', 'Invalid email format provided', 'invalid@email')
}

const triggerPermissionError = () => {
  handlePermissionError('delete file', 'important-document.txt')
}

const triggerRecoverableError = () => {
  captureError(
    new Error('This error can be recovered from'),
    'unknown',
    'medium',
    { recoverable: true },
    {
      title: 'Recoverable Error',
      message: 'This error demonstrates automatic recovery mechanisms.',
      recoveryActions: [
        {
          label: 'Auto Recover',
          action: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate recovery
            addBreadcrumb('Auto recovery completed', 'info')
            clearError()
          },
          primary: true
        }
      ]
    }
  )
}

const triggerAsyncError = async () => {
  await withErrorHandling(
    async () => {
      // Simulate async operation that fails
      await new Promise(resolve => setTimeout(resolve, 1000))
      throw new Error('Async operation failed')
    },
    'Demo async operation',
    'network',
    'medium'
  )
}

const triggerCriticalError = () => {
  captureError(
    new Error('This is a critical system error'),
    'unknown',
    'critical',
    { demoAction: 'critical_error_trigger' },
    {
      title: 'Critical System Error',
      message: 'A critical error has occurred. This demonstrates how critical errors are handled differently.',
      reportable: true,
      showTechnicalDetails: true,
      recoveryActions: [
        {
          label: 'Emergency Reset',
          action: async () => {
            addBreadcrumb('Emergency reset performed', 'warning')
            clearError()
          },
          primary: true
        },
        {
          label: 'Contact Support',
          action: () => {
            window.open('mailto:support@example.com?subject=Critical Error Report', '_blank')
          }
        }
      ]
    }
  )
}

const exportDebugData = () => {
  const debugData = debugService.exportDebugData()
  const blob = new Blob([debugData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `error-demo-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  addBreadcrumb('Debug data exported', 'info')
}
</script>

<style scoped>
.demo-btn {
  @apply w-full px-4 py-2 text-sm font-medium rounded-md border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2;
}

.error-state {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>