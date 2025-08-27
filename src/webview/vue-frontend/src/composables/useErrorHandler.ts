import { ref, onErrorCaptured, inject } from 'vue'
import { captureError, addBreadcrumb, createAppError } from '../services/error-handler'
import type { AppError, ErrorCategory, ErrorSeverity, ErrorRecoveryAction } from '../types/errors'

export interface UseErrorHandlerOptions {
  component?: string
  enableBoundary?: boolean
  onError?: (error: Error | AppError) => void
  recoveryActions?: ErrorRecoveryAction[]
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { component, enableBoundary = false, onError, recoveryActions = [] } = options
  
  const hasError = ref(false)
  const currentError = ref<Error | AppError | null>(null)
  const isRecovering = ref(false)
  
  // Try to get error boundary context if available
  const errorBoundary = inject('errorBoundary', null) as any
  
  // Error capture function
  const captureComponentError = (
    error: Error | string,
    category: ErrorCategory = 'ui',
    severity: ErrorSeverity = 'medium',
    context: Record<string, any> = {},
    userFriendlyOptions?: Partial<AppError['userFriendly']>
  ) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error
    
    const appError = createAppError(
      errorObj.message,
      category,
      severity,
      {
        component: component || 'Unknown',
        ...context
      },
      {
        recoveryActions,
        ...userFriendlyOptions
      }
    )
    
    currentError.value = appError
    hasError.value = true
    
    // Add breadcrumb
    addBreadcrumb(
      'error',
      `Error in ${component || 'component'}: ${errorObj.message}`,
      'error',
      { category, severity, context }
    )
    
    // Capture with global error handler
    const errorId = captureError(appError)
    
    // Call custom error handler if provided
    if (onError) {
      onError(appError)
    }
    
    // Report to error boundary if available
    if (errorBoundary && errorBoundary.reportError) {
      errorBoundary.reportError(appError)
    }
    
    return errorId
  }
  
  // Async operation wrapper with error handling
  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    errorMessage: string = 'Operation failed',
    category: ErrorCategory = 'unknown',
    severity: ErrorSeverity = 'medium'
  ): Promise<T | null> => {
    try {
      addBreadcrumb('operation', `Starting: ${errorMessage}`, 'info')
      const result = await operation()
      addBreadcrumb('operation', `Completed: ${errorMessage}`, 'info')
      return result
    } catch (error) {
      captureComponentError(
        error as Error,
        category,
        severity,
        { operation: errorMessage }
      )
      return null
    }
  }
  
  // Recovery function
  const recover = async (action?: () => Promise<void> | void) => {
    if (isRecovering.value) return
    
    isRecovering.value = true
    
    try {
      if (action) {
        await action()
      }
      
      // Reset error state
      hasError.value = false
      currentError.value = null
      
      addBreadcrumb('recovery', `Component ${component || 'unknown'} recovered from error`, 'info')
    } catch (recoveryError) {
      captureComponentError(
        recoveryError as Error,
        'ui',
        'high',
        { action: 'error_recovery' },
        {
          title: 'Recovery Failed',
          message: 'Failed to recover from the previous error. Please try refreshing the page.',
          reportable: true
        }
      )
    } finally {
      isRecovering.value = false
    }
  }
  
  // Clear error state
  const clearError = () => {
    hasError.value = false
    currentError.value = null
  }
  
  // Set up error boundary if enabled
  if (enableBoundary) {
    onErrorCaptured((error: Error, instance, info: string) => {
      captureComponentError(
        error,
        'ui',
        'high',
        { 
          errorInfo: info,
          componentInstance: instance?.$options.name || 'Unknown'
        },
        {
          title: 'Component Error',
          message: 'An error occurred in this component. It will try to recover automatically.',
          showTechnicalDetails: import.meta.env.DEV
        }
      )
      return false // Prevent error from propagating
    })
  }
  
  // Network error helper
  const handleNetworkError = (
    error: Error,
    operation: string,
    severity: ErrorSeverity = 'medium'
  ) => {
    const isOffline = !navigator.onLine
    const isTimeout = error.message.includes('timeout') || error.name === 'TimeoutError'
    const isNetworkError = error.message.includes('fetch') || error.message.includes('network')
    
    let category: ErrorCategory = 'network'
    let userMessage = 'A network error occurred. Please check your connection and try again.'
    
    if (isOffline) {
      userMessage = 'You appear to be offline. Please check your internet connection.'
      severity = 'high'
    } else if (isTimeout) {
      userMessage = 'The request timed out. Please try again.'
    } else if (isNetworkError) {
      userMessage = 'Unable to connect to the server. Please try again later.'
    }
    
    return captureComponentError(
      error,
      category,
      severity,
      { operation, isOffline, isTimeout, isNetworkError },
      {
        title: 'Connection Error',
        message: userMessage,
        recoveryActions: [
          {
            label: 'Retry',
            action: async () => {
              // This should be implemented by the calling component
              console.log('Retry action triggered')
            },
            primary: true
          },
          ...(isOffline ? [] : [
            {
              label: 'Check Connection',
              action: () => {
                window.open('https://www.google.com', '_blank')
              }
            }
          ])
        ]
      }
    )
  }
  
  // Validation error helper
  const handleValidationError = (
    field: string,
    message: string,
    value?: any
  ) => {
    return captureComponentError(
      new Error(`Validation failed for ${field}: ${message}`),
      'validation',
      'low',
      { field, value },
      {
        title: 'Invalid Input',
        message: `${field}: ${message}`,
        showTechnicalDetails: false,
        reportable: false
      }
    )
  }
  
  // Permission error helper
  const handlePermissionError = (
    action: string,
    resource?: string
  ) => {
    return captureComponentError(
      new Error(`Permission denied for ${action}${resource ? ` on ${resource}` : ''}`),
      'permission',
      'medium',
      { action, resource },
      {
        title: 'Permission Denied',
        message: `You don't have permission to ${action}${resource ? ` ${resource}` : ''}.`,
        showTechnicalDetails: false,
        reportable: false
      }
    )
  }
  
  return {
    // State
    hasError,
    currentError,
    isRecovering,
    
    // Methods
    captureError: captureComponentError,
    withErrorHandling,
    recover,
    clearError,
    
    // Specialized error handlers
    handleNetworkError,
    handleValidationError,
    handlePermissionError,
    
    // Utilities
    addBreadcrumb: (message: string, level: 'debug' | 'info' | 'warning' | 'error' = 'info', data?: any) => {
      addBreadcrumb(component || 'component', message, level, data)
    }
  }
}

// Convenience function for quick error reporting
export function reportError(
  error: Error | string,
  component?: string,
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium'
) {
  const errorObj = typeof error === 'string' ? new Error(error) : error
  
  return captureError(createAppError(
    errorObj.message,
    category,
    severity,
    { component: component || 'Unknown' }
  ))
}

// Global error reporting function for use outside of components
export function reportGlobalError(
  error: Error | string,
  context: Record<string, any> = {},
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium'
) {
  const errorObj = typeof error === 'string' ? new Error(error) : error
  
  return captureError(createAppError(
    errorObj.message,
    category,
    severity,
    context
  ))
}