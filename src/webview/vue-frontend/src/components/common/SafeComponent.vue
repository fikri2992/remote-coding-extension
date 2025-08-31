<template>
  <ErrorBoundary
    :title="title"
    :message="message"
    :show-details="showDetails"
    :show-reload="showReload"
    :show-report="showReport"
    :on-retry="onRetry"
    @error="handleError"
    @retry="handleRetry"
  >
    <slot />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import ErrorBoundary from './ErrorBoundary.vue'
import { captureError, createAppError } from '../../services/error-handler'
import type { ErrorCategory, ErrorSeverity } from '../../types/errors'

interface Props {
  componentName?: string
  title?: string
  message?: string
  category?: ErrorCategory
  severity?: ErrorSeverity
  showDetails?: boolean
  showReload?: boolean
  showReport?: boolean
  onRetry?: () => void | Promise<void>
  onError?: (error: Error, errorInfo: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  componentName: 'Unknown Component',
  title: 'Component Error',
  message: 'This component encountered an error and couldn\'t load properly.',
  category: 'ui',
  severity: 'medium',
  showDetails: true,
  showReload: true,
  showReport: true
})

const emit = defineEmits<{
  error: [error: Error, errorInfo: any]
  retry: []
}>()

const handleError = (error: Error, errorInfo: any) => {
  const appError = createAppError(
    `${props.componentName} Error: ${error.message}`,
    props.category,
    props.severity,
    {
      component: props.componentName,
      action: 'safe_component_error',
      errorInfo
    },
    {
      title: props.title,
      message: props.message,
      reportable: true,
      recoveryActions: props.onRetry ? [
        {
          label: 'Retry Component',
          action: props.onRetry,
          primary: true
        }
      ] : []
    }
  )
  
  captureError(appError)
  
  // Call custom error handler if provided
  if (props.onError) {
    props.onError(error, errorInfo)
  }
  
  emit('error', error, errorInfo)
}

const handleRetry = () => {
  if (props.onRetry) {
    props.onRetry()
  }
  emit('retry')
}
</script>