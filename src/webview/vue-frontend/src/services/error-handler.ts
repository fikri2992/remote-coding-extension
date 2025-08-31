import { ref, reactive } from 'vue'
import type { 
  ErrorReport, 
  ErrorContext, 
  Breadcrumb, 
  ErrorHandlerConfig,
  ErrorSeverity,
  ErrorCategory,
  UserFriendlyError
} from '../types/errors'
import { AppError } from '../types/errors'
import { errorThrottler } from './error-throttler'

class ErrorHandlerService {
  private config: ErrorHandlerConfig
  private breadcrumbs: Breadcrumb[] = []
  private errorReports: ErrorReport[] = []
  private sessionId: string
  private circuitBreakerCount = 0
  private circuitBreakerResetTime = 0
  private readonly CIRCUIT_BREAKER_THRESHOLD = 10
  private readonly CIRCUIT_BREAKER_RESET_INTERVAL = 30000 // 30 seconds
  
  public isInitialized = ref(false)
  public stats = reactive({
    totalErrors: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>
  })

  constructor() {
    this.sessionId = this.generateSessionId()
    this.config = this.getDefaultConfig()
  }

  public initialize(config?: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config }
    this.setupGlobalHandlers()
    this.addBreadcrumb('system', 'Error handler initialized', 'info')
    this.isInitialized.value = true
  }

  private getDefaultConfig(): ErrorHandlerConfig {
    return {
      enableConsoleLogging: import.meta.env.DEV,
      enableErrorReporting: !import.meta.env.DEV,
      enableUserNotifications: true,
      maxBreadcrumbs: 50,
      ignoredErrors: [
        /ResizeObserver loop limit exceeded/,
        /Non-Error promise rejection captured/,
        'Script error.'
      ],
      beforeSend: (errorReport) => {
        // Filter out ignored errors
        const shouldIgnore = this.config.ignoredErrors.some(pattern => {
          if (pattern instanceof RegExp) {
            return pattern.test(errorReport.error.message)
          }
          return errorReport.error.message.includes(pattern)
        })
        
        if (shouldIgnore) {
          return null
        }

        // Apply throttling for user notifications
        const errorKey = errorThrottler.generateErrorKey(errorReport.error, errorReport.context)
        const shouldShow = errorThrottler.shouldShowError(errorKey, errorReport.severity)
        
        if (!shouldShow) {
          // Still log and report, but don't show user notification
          return { ...errorReport, suppressUserNotification: true } as any
        }

        return errorReport
      }
    }
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      
      this.captureError(error, {
        category: 'unknown',
        severity: 'high',
        context: { action: 'unhandled_promise_rejection' }
      })
    })

    // Handle global errors
    window.addEventListener('error', (event) => {
      const error = event.error || new Error(event.message)
      this.captureError(error, {
        category: 'unknown',
        severity: 'high',
        context: { 
          action: 'global_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement
        const error = new Error(`Resource failed to load: ${target.tagName}`)
        this.captureError(error, {
          category: 'network',
          severity: 'medium',
          context: { 
            action: 'resource_load_error',
            element: target.tagName,
            src: (target as any).src || (target as any).href
          }
        })
      }
    }, true)
  }

  public captureError(
    error: Error | AppError,
    options: {
      category?: ErrorCategory
      severity?: ErrorSeverity
      context?: Partial<ErrorContext>
      fingerprint?: string
    } = {}
  ): string {
    // Circuit breaker to prevent infinite error loops
    const now = Date.now()
    if (now > this.circuitBreakerResetTime) {
      this.circuitBreakerCount = 0
      this.circuitBreakerResetTime = now + this.CIRCUIT_BREAKER_RESET_INTERVAL
    }

    this.circuitBreakerCount++
    if (this.circuitBreakerCount > this.CIRCUIT_BREAKER_THRESHOLD) {
      console.warn('Error handler circuit breaker activated - too many errors in short time')
      return 'circuit-breaker-active'
    }

    const errorReport = this.createErrorReport(error, options)
    let processedReport = errorReport
    
    if (this.config.beforeSend) {
      const result = this.config.beforeSend(errorReport)
      if (!result) {
        return errorReport.id // Error was filtered out
      }
      processedReport = result
    }

    this.errorReports.push(processedReport)
    this.updateStats(processedReport)

    if (this.config.enableConsoleLogging) {
      this.logToConsole(processedReport)
    }

    if (this.config.enableErrorReporting) {
      this.sendToReportingService(processedReport)
    }

    // Check if user notifications should be shown (respecting throttling)
    const shouldShowNotification = this.config.enableUserNotifications && 
      error instanceof AppError && 
      !(processedReport as any).suppressUserNotification

    if (shouldShowNotification) {
      this.showUserNotification(error)
    }

    return errorReport.id
  }

  private createErrorReport(
    error: Error | AppError,
    options: {
      category?: ErrorCategory
      severity?: ErrorSeverity
      context?: Partial<ErrorContext>
      fingerprint?: string
    }
  ): ErrorReport {
    const context: ErrorContext = {
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      ...options.context
    }

    const category = error instanceof AppError 
      ? error.category 
      : options.category || 'unknown'
    
    const severity = error instanceof AppError 
      ? error.severity 
      : options.severity || 'medium'

    return {
      id: this.generateErrorId(),
      error,
      context,
      severity,
      category,
      fingerprint: options.fingerprint || this.generateFingerprint(error),
      breadcrumbs: [...this.breadcrumbs]
    }
  }

  public addBreadcrumb(
    category: string,
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    const breadcrumb: Breadcrumb = {
      timestamp: new Date(),
      category,
      message,
      level,
      data
    }

    this.breadcrumbs.push(breadcrumb)

    // Keep only the most recent breadcrumbs
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs)
    }
  }

  private updateStats(errorReport: ErrorReport): void {
    this.stats.totalErrors++
    
    this.stats.errorsByCategory[errorReport.category] = 
      (this.stats.errorsByCategory[errorReport.category] || 0) + 1
    
    this.stats.errorsBySeverity[errorReport.severity] = 
      (this.stats.errorsBySeverity[errorReport.severity] || 0) + 1
  }

  private logToConsole(errorReport: ErrorReport): void {
    const { error, context, severity, category } = errorReport
    
    console.group(`🚨 Error [${severity.toUpperCase()}] - ${category}`)
    console.error('Error:', error)
    console.log('Context:', context)
    console.log('Breadcrumbs:', errorReport.breadcrumbs)
    console.groupEnd()
  }

  private async sendToReportingService(errorReport: ErrorReport): Promise<void> {
    if (!this.config.reportingEndpoint) {
      return
    }

    try {
      await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: errorReport.id,
          message: errorReport.error.message,
          stack: errorReport.error.stack,
          category: errorReport.category,
          severity: errorReport.severity,
          context: errorReport.context,
          breadcrumbs: errorReport.breadcrumbs,
          fingerprint: errorReport.fingerprint
        })
      })
    } catch (reportingError) {
      console.error('Failed to send error report:', reportingError)
    }
  }

  private showUserNotification(error: AppError): void {
    // This will be handled by the UI store
    const event = new CustomEvent('app-error', {
      detail: { error }
    })
    window.dispatchEvent(event)
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateFingerprint(error: Error): string {
    const message = error.message || 'Unknown error'
    const stack = error.stack || ''
    const firstStackLine = stack.split('\n')[1] || ''
    return btoa(`${message}:${firstStackLine}`).substr(0, 16)
  }

  public getErrorReports(): ErrorReport[] {
    return [...this.errorReports]
  }

  public clearErrorReports(): void {
    this.errorReports = []
    this.stats.totalErrors = 0
    this.stats.errorsByCategory = {
      network: 0,
      validation: 0,
      authentication: 0,
      permission: 0,
      websocket: 0,
      filesystem: 0,
      git: 0,
      terminal: 0,
      ui: 0,
      unknown: 0
    }
    this.stats.errorsBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
  }

  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs]
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbs = []
  }

  public resetCircuitBreaker(): void {
    this.circuitBreakerCount = 0
    this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_RESET_INTERVAL
  }

  public getThrottlingStats(): { total: number; suppressed: number; active: number } {
    return errorThrottler.getErrorStats()
  }

  public resetThrottling(): void {
    errorThrottler.resetThrottling()
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandlerService()

// Export convenience functions
export const captureError = (error: Error | AppError, options?: Parameters<typeof errorHandler.captureError>[1]) => {
  return errorHandler.captureError(error, options)
}

export const addBreadcrumb = (category: string, message: string, level?: Parameters<typeof errorHandler.addBreadcrumb>[2], data?: Record<string, any>) => {
  errorHandler.addBreadcrumb(category, message, level, data)
}

export const createAppError = (
  message: string,
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium',
  context: Partial<ErrorContext> = {},
  userFriendly?: Partial<UserFriendlyError>,
  recoverable = true
) => {
  return new AppError(message, category, severity, context, userFriendly, recoverable)
}

export const resetCircuitBreaker = () => {
  errorHandler.resetCircuitBreaker()
}

export const getThrottlingStats = () => {
  return errorHandler.getThrottlingStats()
}

export const resetThrottling = () => {
  errorHandler.resetThrottling()
}