/**
 * Performance monitoring utilities for the File System Menu
 */

interface PerformanceMetric {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any> | undefined
}

interface PerformanceReport {
  metrics: PerformanceMetric[]
  summary: {
    totalDuration: number
    averageDuration: number
    slowestOperation: string
    fastestOperation: string
  }
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map()
  private completedMetrics: PerformanceMetric[] = []
  private enabled: boolean = import.meta.env.DEV

  constructor() {
    // Enable performance monitoring in development
    if (this.enabled) {
      console.log('Performance monitoring enabled')
    }
  }

  /**
   * Start measuring a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata
    }

    this.metrics.set(name, metric)
  }

  /**
   * End measuring a performance metric
   */
  end(name: string, additionalMetadata?: Record<string, any>): number | null {
    if (!this.enabled) return null

    const metric = this.metrics.get(name)
    if (!metric) {
      console.warn(`Performance metric "${name}" was not started`)
      return null
    }

    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime

    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata }
    }

    this.completedMetrics.push(metric)
    this.metrics.delete(name)

    // Log slow operations
    if (metric.duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${metric.duration.toFixed(2)}ms`)
    }

    return metric.duration
  }

  /**
   * Measure a function execution time
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(name, metadata)
    
    try {
      const result = await fn()
      this.end(name, { success: true })
      return result
    } catch (error) {
      this.end(name, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
  }

  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    if (this.completedMetrics.length === 0) {
      return {
        metrics: [],
        summary: {
          totalDuration: 0,
          averageDuration: 0,
          slowestOperation: '',
          fastestOperation: ''
        }
      }
    }

    const totalDuration = this.completedMetrics.reduce(
      (sum, metric) => sum + (metric.duration || 0),
      0
    )

    const averageDuration = totalDuration / this.completedMetrics.length

    const sortedByDuration = [...this.completedMetrics]
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))

    return {
      metrics: [...this.completedMetrics],
      summary: {
        totalDuration,
        averageDuration,
        slowestOperation: sortedByDuration[0]?.name || '',
        fastestOperation: sortedByDuration[sortedByDuration.length - 1]?.name || ''
      }
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear()
    this.completedMetrics = []
  }

  /**
   * Log performance report to console
   */
  logReport(): void {
    if (!this.enabled) return

    const report = this.getReport()
    
    if (report.metrics.length === 0) {
      console.log('No performance metrics recorded')
      return
    }

    console.group('Performance Report')
    console.log('Summary:', report.summary)
    console.table(
      report.metrics.map(m => ({
        name: m.name,
        duration: m.duration ? `${m.duration.toFixed(2)}ms` : 'N/A',
        metadata: JSON.stringify(m.metadata || {})
      }))
    )
    console.groupEnd()
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }
}

// File System specific performance metrics
export class FileSystemPerformanceMonitor extends PerformanceMonitor {
  /**
   * Measure file tree loading performance
   */
  async measureFileTreeLoad<T>(
    path: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.measure(
      'file-tree-load',
      fn,
      { path, operation: 'load-tree' }
    )
  }

  /**
   * Measure file content loading performance
   */
  async measureFileContentLoad<T>(
    path: string,
    fileSize: number,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.measure(
      'file-content-load',
      fn,
      { path, fileSize, operation: 'load-content' }
    )
  }

  /**
   * Measure search performance
   */
  async measureSearch<T>(
    query: string,
    resultCount: number,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.measure(
      'file-search',
      fn,
      { query, resultCount, operation: 'search' }
    )
  }

  /**
   * Measure directory expansion performance
   */
  async measureDirectoryExpansion<T>(
    path: string,
    childCount: number,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.measure(
      'directory-expansion',
      fn,
      { path, childCount, operation: 'expand-directory' }
    )
  }

  /**
   * Measure WebSocket operation performance
   */
  async measureWebSocketOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.measure(
      'websocket-operation',
      fn,
      { operation, transport: 'websocket' }
    )
  }
}

// Memory usage monitoring
export class MemoryMonitor {
  private enabled: boolean = import.meta.env.DEV

  /**
   * Get current memory usage
   */
  getMemoryUsage(): any | null {
    if (!this.enabled || !('memory' in performance)) {
      return null
    }

    return (performance as any).memory
  }

  /**
   * Log memory usage
   */
  logMemoryUsage(label?: string): void {
    if (!this.enabled) return

    const memory = this.getMemoryUsage()
    if (!memory) {
      console.log('Memory monitoring not available')
      return
    }

    const formatBytes = (bytes: number) => {
      const mb = bytes / (1024 * 1024)
      return `${mb.toFixed(2)} MB`
    }

    console.log(
      `Memory Usage${label ? ` (${label})` : ''}:`,
      {
        used: formatBytes(memory.usedJSHeapSize),
        total: formatBytes(memory.totalJSHeapSize),
        limit: formatBytes(memory.jsHeapSizeLimit)
      }
    )
  }

  /**
   * Monitor memory usage over time
   */
  startMemoryMonitoring(intervalMs: number = 5000): () => void {
    if (!this.enabled) return () => {}

    const interval = setInterval(() => {
      this.logMemoryUsage('Periodic Check')
    }, intervalMs)

    return () => clearInterval(interval)
  }
}

// Bundle size analysis
export class BundleAnalyzer {
  private enabled: boolean = import.meta.env.DEV

  /**
   * Analyze loaded modules
   */
  analyzeLoadedModules(): void {
    if (!this.enabled) return

    const modules = Array.from(document.querySelectorAll('script[src]'))
      .map(script => (script as HTMLScriptElement).src)
      .filter(src => src.includes('assets'))

    console.group('Loaded JavaScript Modules')
    modules.forEach(src => {
      console.log(src.split('/').pop())
    })
    console.groupEnd()
  }

  /**
   * Analyze CSS files
   */
  analyzeLoadedCSS(): void {
    if (!this.enabled) return

    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => (link as HTMLLinkElement).href)

    console.group('Loaded CSS Files')
    stylesheets.forEach(href => {
      console.log(href.split('/').pop())
    })
    console.groupEnd()
  }

  /**
   * Full bundle analysis
   */
  analyzeBundleSize(): void {
    if (!this.enabled) return

    console.group('Bundle Analysis')
    this.analyzeLoadedModules()
    this.analyzeLoadedCSS()
    console.groupEnd()
  }
}

// Global instances
export const performanceMonitor = new FileSystemPerformanceMonitor()
export const memoryMonitor = new MemoryMonitor()
export const bundleAnalyzer = new BundleAnalyzer()

// Development helpers
if (import.meta.env.DEV) {
  // Make available globally for debugging
  ;(window as any).performanceMonitor = performanceMonitor
  ;(window as any).memoryMonitor = memoryMonitor
  ;(window as any).bundleAnalyzer = bundleAnalyzer

  // Auto-log performance report on page unload
  window.addEventListener('beforeunload', () => {
    performanceMonitor.logReport()
  })
}

export default {
  performanceMonitor,
  memoryMonitor,
  bundleAnalyzer
}