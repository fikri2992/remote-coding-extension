import { ref, reactive } from 'vue'
import { errorHandler } from './error-handler'

interface DebugConfig {
  enableVueDevtools: boolean
  enablePerformanceMonitoring: boolean
  enableNetworkLogging: boolean
  enableStateLogging: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any> | undefined
}

interface NetworkLog {
  id: string
  method: string
  url: string
  status?: number
  startTime: number
  endTime?: number
  duration?: number
  requestData?: any
  responseData?: any
  error?: Error | undefined
}

class DebugService {
  private config: DebugConfig
  private performanceMetrics: PerformanceMetric[] = []
  private networkLogs: NetworkLog[] = []
  private originalFetch: typeof fetch

  public isEnabled = ref(false)
  public stats = reactive({
    totalRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    performanceMetrics: 0
  })

  constructor() {
    this.config = this.getDefaultConfig()
    this.originalFetch = window.fetch
  }

  public initialize(config?: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (import.meta.env.DEV) {
      this.setupVueDevtools()
      this.setupNetworkInterception()
      this.setupPerformanceMonitoring()
      this.isEnabled.value = true
      
      // Add debug info to window for console access
      ;(window as any).__DEBUG__ = {
        errorHandler,
        debugService: this,
        getErrorReports: () => errorHandler.getErrorReports(),
        getBreadcrumbs: () => errorHandler.getBreadcrumbs(),
        getPerformanceMetrics: () => this.getPerformanceMetrics(),
        getNetworkLogs: () => this.getNetworkLogs(),
        clearLogs: () => this.clearAllLogs()
      }

      console.log('🔧 Debug mode enabled. Access debug tools via window.__DEBUG__')
    }
  }

  private getDefaultConfig(): DebugConfig {
    return {
      enableVueDevtools: import.meta.env.DEV,
      enablePerformanceMonitoring: import.meta.env.DEV,
      enableNetworkLogging: import.meta.env.DEV,
      enableStateLogging: import.meta.env.DEV,
      logLevel: import.meta.env.DEV ? 'debug' : 'error'
    }
  }

  private setupVueDevtools(): void {
    if (!this.config.enableVueDevtools) return

    // Enable Vue DevTools in development
    if (import.meta.env.DEV && (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__.Vue = (window as any).Vue
    }

    // Add custom DevTools integration
    this.addDevtoolsIntegration()
  }

  private addDevtoolsIntegration(): void {
    // Custom DevTools panel for error tracking
    if ((window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__
      
      hook.on('app:init', (app: any) => {
        // Add custom inspector for errors
        app.config.globalProperties.$debugInfo = {
          errors: () => errorHandler.getErrorReports(),
          breadcrumbs: () => errorHandler.getBreadcrumbs(),
          performance: () => this.getPerformanceMetrics(),
          network: () => this.getNetworkLogs()
        }
      })
    }
  }

  private setupNetworkInterception(): void {
    if (!this.config.enableNetworkLogging) return

    // Intercept fetch requests
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const networkLog = this.createNetworkLog('GET', input.toString())
      
      try {
        const response = await this.originalFetch(input, init)
        this.completeNetworkLog(networkLog, response.status)
        
        if (this.config.logLevel === 'debug') {
          console.log('🌐 Network Request:', {
            method: init?.method || 'GET',
            url: input.toString(),
            status: response.status,
            duration: networkLog.duration
          })
        }
        
        return response
      } catch (error) {
        this.completeNetworkLog(networkLog, 0, error as Error)
        throw error
      }
    }

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    const self = this
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL) {
      (this as any)._debugLog = self.createNetworkLog(method, url.toString())
      return originalOpen.apply(this, arguments as any)
    }

    XMLHttpRequest.prototype.send = function() {
      const networkLog = (this as any)._debugLog
      if (networkLog) {
        this.addEventListener('loadend', () => {
          self.completeNetworkLog(networkLog, this.status)
        })
      }
      return originalSend.apply(this, arguments as any)
    }
  }

  private createNetworkLog(method: string, url: string): NetworkLog {
    const log: NetworkLog = {
      id: `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method,
      url,
      startTime: performance.now()
    }
    
    this.networkLogs.push(log)
    this.stats.totalRequests++
    
    return log
  }

  private completeNetworkLog(log: NetworkLog, status: number, error?: Error): void {
    log.endTime = performance.now()
    log.duration = log.endTime - log.startTime
    log.status = status
    log.error = error

    if (error || status >= 400) {
      this.stats.failedRequests++
    }

    // Update average response time
    const completedRequests = this.networkLogs.filter(l => l.duration !== undefined)
    this.stats.averageResponseTime = completedRequests.reduce((sum, l) => sum + (l.duration || 0), 0) / completedRequests.length
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return

    // Monitor navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          this.addPerformanceMetric('page_load', navigation.loadEventEnd - navigation.fetchStart, {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint()
          })
        }
      }, 0)
    })

    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming
          this.addPerformanceMetric(`resource_${resource.name}`, resource.duration, {
            type: resource.initiatorType,
            size: resource.transferSize
          })
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  private getFirstPaint(): number | undefined {
    const paintEntries = performance.getEntriesByType('paint')
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')
    return firstPaint?.startTime
  }

  private getFirstContentfulPaint(): number | undefined {
    const paintEntries = performance.getEntriesByType('paint')
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    return firstContentfulPaint?.startTime
  }

  public startPerformanceMetric(name: string, metadata?: Record<string, any>): string {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata
    }
    
    this.performanceMetrics.push(metric)
    this.stats.performanceMetrics++
    
    return `${name}_${this.performanceMetrics.length - 1}`
  }

  public endPerformanceMetric(id: string): void {
    const index = parseInt(id.split('_').pop() || '0')
    const metric = this.performanceMetrics[index]
    
    if (metric && !metric.endTime) {
      metric.endTime = performance.now()
      metric.duration = metric.endTime - metric.startTime
      
      if (this.config.logLevel === 'debug') {
        console.log(`⏱️ Performance: ${metric.name} took ${metric.duration.toFixed(2)}ms`)
      }
    }
  }

  public addPerformanceMetric(name: string, duration: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now() - duration,
      endTime: performance.now(),
      duration,
      metadata
    }
    
    this.performanceMetrics.push(metric)
    this.stats.performanceMetrics++
  }

  public log(level: DebugConfig['logLevel'], message: string, data?: any): void {
    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.config.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    
    if (messageLevelIndex >= currentLevelIndex) {
      const logFn = console[level] || console.log
      logFn(`[${level.toUpperCase()}]`, message, data)
      
      const breadcrumbLevel = level === 'warn' ? 'warning' : level as 'debug' | 'info' | 'error'
      errorHandler.addBreadcrumb('debug', message, breadcrumbLevel, data)
    }
  }

  public getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics]
  }

  public getNetworkLogs(): NetworkLog[] {
    return [...this.networkLogs]
  }

  public clearAllLogs(): void {
    this.performanceMetrics = []
    this.networkLogs = []
    this.stats.totalRequests = 0
    this.stats.failedRequests = 0
    this.stats.averageResponseTime = 0
    this.stats.performanceMetrics = 0
    errorHandler.clearBreadcrumbs()
    errorHandler.clearErrorReports()
  }

  public exportDebugData(): string {
    const debugData = {
      timestamp: new Date().toISOString(),
      errors: errorHandler.getErrorReports(),
      breadcrumbs: errorHandler.getBreadcrumbs(),
      performance: this.getPerformanceMetrics(),
      network: this.getNetworkLogs(),
      stats: {
        error: errorHandler.stats,
        debug: this.stats
      }
    }
    
    return JSON.stringify(debugData, null, 2)
  }
}

// Create singleton instance
export const debugService = new DebugService()

// Export convenience functions
export const startPerformanceMetric = (name: string, metadata?: Record<string, any>) => {
  return debugService.startPerformanceMetric(name, metadata)
}

export const endPerformanceMetric = (id: string) => {
  debugService.endPerformanceMetric(id)
}

export const debugLog = (level: DebugConfig['logLevel'], message: string, data?: any) => {
  debugService.log(level, message, data)
}