import { ErrorThrottler } from '../error-throttler'

describe('ErrorThrottler', () => {
  let throttler: ErrorThrottler

  beforeEach(() => {
    throttler = new ErrorThrottler({
      timeWindowMs: 1000, // 1 second for testing
      maxErrorsPerWindow: 2,
      suppressDuplicates: true
    })
  })

  test('should allow first error occurrence', () => {
    const error = new Error('Test error')
    const errorKey = throttler.generateErrorKey(error)
    
    const shouldShow = throttler.shouldShowError(errorKey, 'medium')
    expect(shouldShow).toBe(true)
  })

  test('should allow errors within limit', () => {
    const error = new Error('Test error')
    const errorKey = throttler.generateErrorKey(error)
    
    // First error
    expect(throttler.shouldShowError(errorKey, 'medium')).toBe(true)
    // Second error (within limit)
    expect(throttler.shouldShowError(errorKey, 'medium')).toBe(true)
    // Third error (exceeds limit)
    expect(throttler.shouldShowError(errorKey, 'medium')).toBe(false)
  })

  test('should always show critical errors', () => {
    const error = new Error('Critical error')
    const errorKey = throttler.generateErrorKey(error)
    
    // Even after exceeding limit, critical errors should show
    throttler.shouldShowError(errorKey, 'medium') // 1
    throttler.shouldShowError(errorKey, 'medium') // 2
    throttler.shouldShowError(errorKey, 'medium') // 3 (suppressed)
    
    expect(throttler.shouldShowError(errorKey, 'critical')).toBe(true)
  })

  test('should reset window after time passes', async () => {
    const error = new Error('Test error')
    const errorKey = throttler.generateErrorKey(error)
    
    // Exceed limit
    throttler.shouldShowError(errorKey, 'medium') // 1
    throttler.shouldShowError(errorKey, 'medium') // 2
    expect(throttler.shouldShowError(errorKey, 'medium')).toBe(false) // 3 (suppressed)
    
    // Wait for window to reset (simulate time passing)
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    // Should allow error again
    expect(throttler.shouldShowError(errorKey, 'medium')).toBe(true)
  })

  test('should generate consistent error keys', () => {
    const error1 = new Error('Same message')
    const error2 = new Error('Same message')
    
    const key1 = throttler.generateErrorKey(error1)
    const key2 = throttler.generateErrorKey(error2)
    
    expect(key1).toBe(key2)
  })

  test('should generate different keys for different errors', () => {
    const error1 = new Error('Message 1')
    const error2 = new Error('Message 2')
    
    const key1 = throttler.generateErrorKey(error1)
    const key2 = throttler.generateErrorKey(error2)
    
    expect(key1).not.toBe(key2)
  })

  test('should provide accurate statistics', () => {
    const error = new Error('Test error')
    const errorKey = throttler.generateErrorKey(error)
    
    // Generate some errors
    throttler.shouldShowError(errorKey, 'medium') // 1
    throttler.shouldShowError(errorKey, 'medium') // 2
    throttler.shouldShowError(errorKey, 'medium') // 3 (suppressed)
    throttler.shouldShowError(errorKey, 'medium') // 4 (suppressed)
    
    const stats = throttler.getErrorStats()
    expect(stats.total).toBe(4)
    expect(stats.suppressed).toBe(2)
    expect(stats.active).toBe(1)
  })

  test('should reset throttling correctly', () => {
    const error = new Error('Test error')
    const errorKey = throttler.generateErrorKey(error)
    
    // Exceed limit
    throttler.shouldShowError(errorKey, 'medium')
    throttler.shouldShowError(errorKey, 'medium')
    throttler.shouldShowError(errorKey, 'medium') // suppressed
    
    // Reset throttling
    throttler.resetThrottling()
    
    // Should allow error again
    expect(throttler.shouldShowError(errorKey, 'medium')).toBe(true)
  })
})