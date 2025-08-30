interface PerformanceMetrics {
  scrollEvents: number
  renderTime: number
  memoryUsage: number
  cacheHitRate: number
  visibleItems: number
  totalItems: number
  lastUpdate: number
}

interface ScrollPerformanceOptions {
  sampleInterval?: number
  maxSamples?: number
  enableMemoryTracking?: boolean
  enableRenderTracking?: boolean
}

export class VirtualScrollPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    scrollEvents: 0,
    renderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    visibleItems: 0,
    totalItems: 0,
    lastUpdate: Date.now()
  }

  private samples: PerformanceMetrics[] = []
  private options: Required<ScrollPerformanceOptions>
  private isMonitoring = false
  private intervalId: number | null = null
  private renderStartTime = 0

  constructor(options: ScrollPerformanceOptions = {}) {
    this.options = {
      sampleInterval: options.sampleInterval || 1000, // 1 second
      maxSamples: options.maxSamples || 60, // Keep 1 minute of samples
      enableMemoryTracking: options.enableMemoryTracking ?? true,
      enableRenderTracking: options.enableRenderTracking ?? true
    }
  }

  start(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.intervalId = window.setInterval(() => {
      this.collectSample()
    }, this.options.sampleInterval)
  }

  stop(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  recordScrollEvent(): void {
    this.metrics.scrollEvents++
  }

  startRenderMeasurement(): void {
    if (this.options.enableRenderTracking) {
      this.renderStartTime = performance.now()
    }
  }

  endRenderMeasurement(): void {
    if (this.options.enableRenderTracking && this.renderStartTime > 0) {
      const renderTime = performance.now() - this.renderStartTime
      this.metrics.renderTime = renderTime
      this.renderStartTime = 0
    }
  }

  updateCacheMetrics(hitRate: number): void {
    this.metrics.cacheHitRate = hitRate
  }

  updateItemCounts(visible: number, total: number): void {
    this.metrics.visibleItems = visible
    this.metrics.totalItems = total
  }

  private collectSample(): void {
    // Update memory usage if supported and enabled
    if (this.options.enableMemoryTracking && 'memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024 // MB
    }

    // Update timestamp
    this.metrics.lastUpdate = Date.now()

    // Store sample
    this.samples.push({ ...this.metrics })

    // Limit samples
    if (this.samples.length > this.options.maxSamples) {
      this.samples.shift()
    }

    // Reset counters
    this.metrics.scrollEvents = 0
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getSamples(): PerformanceMetrics[] {
    return [...this.samples]
  }

  getAverageMetrics(sampleCount = 10): Partial<PerformanceMetrics> {
    const recentSamples = this.samples.slice(-sampleCount)
    if (recentSamples.length === 0) return {}

    const averages = recentSamples.reduce(
      (acc, sample) => ({
        scrollEvents: acc.scrollEvents + sample.scrollEvents,
        renderTime: acc.renderTime + sample.renderTime,
        memoryUsage: acc.memoryUsage + sample.memoryUsage,
        cacheHitRate: acc.cacheHitRate + sample.cacheHitRate,
        visibleItems: acc.visibleItems + sample.visibleItems,
        totalItems: acc.totalItems + sample.totalItems
      }),
      {
        scrollEvents: 0,
        renderTime: 0,
        memoryUsage: 0,
        cacheHitRate: 0,
        visibleItems: 0,
        totalItems: 0
      }
    )

    const count = recentSamples.length
    return {
      scrollEvents: Math.round(averages.scrollEvents / count),
      renderTime: Math.round((averages.renderTime / count) * 100) / 100,
      memoryUsage: Math.round((averages.memoryUsage / count) * 100) / 100,
      cacheHitRate: Math.round((averages.cacheHitRate / count) * 100) / 100,
      visibleItems: Math.round(averages.visibleItems / count),
      totalItems: Math.round(averages.totalItems / count)
    }
  }

  getPerformanceReport(): string {
    const current = this.getMetrics()
    const averages = this.getAverageMetrics()

    return `
Virtual Scroll Performance Report
================================
Current Metrics:
- Scroll Events/sec: ${current.scrollEvents}
- Render Time: ${current.renderTime.toFixed(2)}ms
- Memory Usage: ${current.memoryUsage.toFixed(2)}MB
- Cache Hit Rate: ${(current.cacheHitRate * 100).toFixed(1)}%
- Visible Items: ${current.visibleItems}/${current.totalItems}

Average Metrics (last 10 samples):
- Scroll Events/sec: ${averages.scrollEvents || 0}
- Render Time: ${averages.renderTime || 0}ms
- Memory Usage: ${averages.memoryUsage || 0}MB
- Cache Hit Rate: ${((averages.cacheHitRate || 0) * 100).toFixed(1)}%
- Visible Items: ${averages.visibleItems || 0}/${averages.totalItems || 0}

Performance Status: ${this.getPerformanceStatus()}
    `.trim()
  }

  private getPerformanceStatus(): string {
    const current = this.getMetrics()
    
    // Check for performance issues
    const issues: string[] = []
    
    if (current.renderTime > 16) {
      issues.push('High render time (>16ms)')
    }
    
    if (current.memoryUsage > 100) {
      issues.push('High memory usage (>100MB)')
    }
    
    if (current.cacheHitRate < 0.8) {
      issues.push('Low cache hit rate (<80%)')
    }
    
    if (current.scrollEvents > 60) {
      issues.push('High scroll event frequency (>60/sec)')
    }
    
    if (issues.length === 0) {
      return '✅ Good'
    } else if (issues.length <= 2) {
      return `⚠️ Fair (${issues.join(', ')})`
    } else {
      return `❌ Poor (${issues.join(', ')})`
    }
  }

  exportMetrics(): string {
    return JSON.stringify({
      current: this.getMetrics(),
      samples: this.getSamples(),
      averages: this.getAverageMetrics(),
      timestamp: new Date().toISOString()
    }, null, 2)
  }

  reset(): void {
    this.metrics = {
      scrollEvents: 0,
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      visibleItems: 0,
      totalItems: 0,
      lastUpdate: Date.now()
    }
    this.samples = []
  }
}

// Singleton instance for global use
export const virtualScrollPerformanceMonitor = new VirtualScrollPerformanceMonitor()

// Utility functions for mobile-specific optimizations
export const mobileOptimizations = {
  // Detect if device has limited memory
  isLowMemoryDevice(): boolean {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.jsHeapSizeLimit < 1024 * 1024 * 1024 // Less than 1GB
    }
    return false
  },

  // Detect if device has slow CPU
  isSlowDevice(): boolean {
    return navigator.hardwareConcurrency <= 2
  },

  // Get recommended settings for current device
  getRecommendedSettings(): {
    pageSize: number
    cacheSize: number
    preloadDistance: number
    showSkeletons: boolean
    momentumScrolling: boolean
  } {
    const isLowMemory = this.isLowMemoryDevice()
    const isSlow = this.isSlowDevice()
    
    return {
      pageSize: isLowMemory ? 20 : isSlow ? 30 : 50,
      cacheSize: isLowMemory ? 500 : 1000,
      preloadDistance: isSlow ? 100 : 200,
      showSkeletons: !isSlow, // Disable skeletons on slow devices
      momentumScrolling: true // Always enable for better UX
    }
  },

  // Optimize settings based on current performance
  optimizeForPerformance(currentMetrics: PerformanceMetrics): Partial<{
    pageSize: number
    cacheSize: number
    preloadDistance: number
    showSkeletons: boolean
  }> {
    const optimizations: any = {}
    
    // If render time is high, reduce page size
    if (currentMetrics.renderTime > 16) {
      optimizations.pageSize = Math.max(10, Math.floor(currentMetrics.visibleItems * 0.8))
    }
    
    // If memory usage is high, reduce cache size
    if (currentMetrics.memoryUsage > 100) {
      optimizations.cacheSize = Math.max(100, Math.floor(currentMetrics.totalItems * 0.1))
    }
    
    // If cache hit rate is low, increase preload distance
    if (currentMetrics.cacheHitRate < 0.6) {
      optimizations.preloadDistance = 300
    }
    
    // If scroll events are too frequent, disable skeletons
    if (currentMetrics.scrollEvents > 60) {
      optimizations.showSkeletons = false
    }
    
    return optimizations
  }
}