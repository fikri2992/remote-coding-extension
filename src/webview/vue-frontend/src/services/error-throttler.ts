import type { ErrorSeverity } from '../types/errors'

interface ThrottleEntry {
  count: number
  firstOccurrence: number
  lastOccurrence: number
  suppressed: boolean
}

interface ErrorThrottlerConfig {
  timeWindowMs: number
  maxErrorsPerWindow: number
  suppressDuplicates: boolean
}

export class ErrorThrottler {
  private throttleMap = new Map<string, ThrottleEntry>()
  private config: ErrorThrottlerConfig

  constructor(config: Partial<ErrorThrottlerConfig> = {}) {
    this.config = {
      timeWindowMs: 5000, // 5 seconds
      maxErrorsPerWindow: 1,
      suppressDuplicates: true,
      ...config
    }
  }

  /**
   * Check if an error should be shown based on throttling rules
   */
  shouldShowError(errorKey: string, severity: ErrorSeverity): boolean {
    const now = Date.now()
    const entry = this.throttleMap.get(errorKey)

    // Critical errors always show (but still get tracked)
    if (severity === 'critical') {
      this.recordError(errorKey, now)
      return true
    }

    if (!entry) {
      // First occurrence of this error
      this.recordError(errorKey, now)
      return true
    }

    // Check if we're outside the time window
    if (now - entry.firstOccurrence > this.config.timeWindowMs) {
      // Reset the window
      this.throttleMap.set(errorKey, {
        count: 1,
        firstOccurrence: now,
        lastOccurrence: now,
        suppressed: false
      })
      return true
    }

    // We're within the time window
    entry.count++
    entry.lastOccurrence = now

    // Check if we've exceeded the limit
    if (entry.count > this.config.maxErrorsPerWindow) {
      entry.suppressed = true
      return false
    }

    return true
  }

  /**
   * Record an error occurrence
   */
  recordError(errorKey: string, timestamp: number): void {
    const existing = this.throttleMap.get(errorKey)
    
    if (!existing) {
      this.throttleMap.set(errorKey, {
        count: 1,
        firstOccurrence: timestamp,
        lastOccurrence: timestamp,
        suppressed: false
      })
    } else {
      existing.count++
      existing.lastOccurrence = timestamp
    }
  }

  /**
   * Generate a unique key for an error
   */
  generateErrorKey(error: Error, context?: Record<string, any>): string {
    const message = error.message || 'Unknown error'
    const stack = error.stack || ''
    const firstStackLine = stack.split('\n')[1] || ''
    const contextKey = context ? JSON.stringify(context) : ''
    
    // Create a simple hash-like key
    return btoa(`${message}:${firstStackLine}:${contextKey}`).substr(0, 16)
  }

  /**
   * Reset throttling for a specific error or all errors
   */
  resetThrottling(errorKey?: string): void {
    if (errorKey) {
      this.throttleMap.delete(errorKey)
    } else {
      this.throttleMap.clear()
    }
  }

  /**
   * Get statistics about throttled errors
   */
  getErrorStats(): { total: number; suppressed: number; active: number } {
    let total = 0
    let suppressed = 0
    let active = 0

    for (const entry of this.throttleMap.values()) {
      total += entry.count
      if (entry.suppressed) {
        suppressed += entry.count - this.config.maxErrorsPerWindow
      }
      active++
    }

    return { total, suppressed, active }
  }

  /**
   * Clean up old entries outside the time window
   */
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.throttleMap.entries()) {
      if (now - entry.lastOccurrence > this.config.timeWindowMs * 2) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.throttleMap.delete(key))
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorThrottlerConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Create singleton instance
export const errorThrottler = new ErrorThrottler()

// Auto-cleanup every 30 seconds
setInterval(() => {
  errorThrottler.cleanup()
}, 30000)