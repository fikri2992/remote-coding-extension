import { ref, computed, onUnmounted, watch } from 'vue'
// import { useIntersectionObserver } from './useIntersectionObserver' // Unused for now
import { useVirtualScrollCache } from './useVirtualScrollCache'
import type { FileSystemNode } from '../types/filesystem'

interface ProgressiveLoadingOptions {
  pageSize?: number
  preloadDistance?: number
  maxConcurrentRequests?: number
  cacheSize?: number
  cacheTTL?: number
  enableSmartPreloading?: boolean
  preloadThreshold?: number
  scrollVelocityThreshold?: number
  debounceMs?: number
}

interface LoadingRequest {
  id: string
  path: string
  direction: 'up' | 'down'
  startIndex: number
  endIndex: number
  priority: number
  timestamp: number
  abortController: AbortController
}

interface LoadingState {
  isLoading: boolean
  loadingItems: Set<string>
  pendingRequests: Map<string, LoadingRequest>
  completedRequests: Set<string>
  failedRequests: Map<string, { error: string; timestamp: number; retryCount: number }>
  totalItems: number
  loadedItems: number
}

interface ScrollBehavior {
  velocity: number
  direction: 'up' | 'down'
  acceleration: number
  isScrolling: boolean
  lastScrollTime: number
  scrollDistance: number
}

interface OfflineState {
  isOffline: boolean
  lastOnlineTime: number
  queuedRequests: LoadingRequest[]
  offlineCache: Map<string, FileSystemNode[]>
}

export function useProgressiveFileLoading(
  loadFunction: (path: string, startIndex: number, endIndex: number, signal?: AbortSignal) => Promise<FileSystemNode[]>,
  options: ProgressiveLoadingOptions = {}
) {
  const {
    pageSize = 50,
    preloadDistance = 200,
    maxConcurrentRequests = 3,
    cacheSize = 1000,
    cacheTTL = 5 * 60 * 1000, // 5 minutes
    enableSmartPreloading = true,
    preloadThreshold = 0.7, // Start preloading when 70% through current page
    scrollVelocityThreshold = 100, // pixels per second
    debounceMs = 100
  } = options

  // State
  const loadingState = ref<LoadingState>({
    isLoading: false,
    loadingItems: new Set(),
    pendingRequests: new Map(),
    completedRequests: new Set(),
    failedRequests: new Map(),
    totalItems: 0,
    loadedItems: 0
  })

  const scrollBehavior = ref<ScrollBehavior>({
    velocity: 0,
    direction: 'down',
    acceleration: 0,
    isScrolling: false,
    lastScrollTime: 0,
    scrollDistance: 0
  })

  const offlineState = ref<OfflineState>({
    isOffline: !navigator.onLine,
    lastOnlineTime: Date.now(),
    queuedRequests: [],
    offlineCache: new Map()
  })

  const skeletonCount = ref(0)
  const showSkeletons = ref(false)
  const loadingProgress = ref(0)

  // Cache
  const cache = useVirtualScrollCache(cacheSize, { ttl: cacheTTL })

  // Computed
  const isLoadingAny = computed(() => loadingState.value.isLoading || loadingState.value.pendingRequests.size > 0)
  
  const loadingStats = computed(() => ({
    totalRequests: loadingState.value.completedRequests.size + loadingState.value.failedRequests.size,
    successfulRequests: loadingState.value.completedRequests.size,
    failedRequests: loadingState.value.failedRequests.size,
    pendingRequests: loadingState.value.pendingRequests.size,
    cacheHitRate: cache.getStats().hitRate,
    loadingProgress: loadingProgress.value
  }))

  const canPreload = computed(() => {
    return enableSmartPreloading && 
           !offlineState.value.isOffline &&
           loadingState.value.pendingRequests.size < maxConcurrentRequests &&
           scrollBehavior.value.velocity > scrollVelocityThreshold
  })

  // Request management
  let requestIdCounter = 0
  let debounceTimeout: number | null = null

  const generateRequestId = (): string => {
    return `req_${++requestIdCounter}_${Date.now()}`
  }

  const createLoadingRequest = (
    path: string,
    direction: 'up' | 'down',
    startIndex: number,
    endIndex: number,
    priority = 1
  ): LoadingRequest => {
    return {
      id: generateRequestId(),
      path,
      direction,
      startIndex,
      endIndex,
      priority,
      timestamp: Date.now(),
      abortController: new AbortController()
    }
  }

  const cancelRequest = (requestId: string) => {
    const request = loadingState.value.pendingRequests.get(requestId)
    if (request) {
      request.abortController.abort()
      loadingState.value.pendingRequests.delete(requestId)
      
      // Remove loading items for this request
      for (let i = request.startIndex; i <= request.endIndex; i++) {
        loadingState.value.loadingItems.delete(`${request.path}_${i}`)
      }
    }
  }

  const cancelAllRequests = () => {
    loadingState.value.pendingRequests.forEach((request) => {
      request.abortController.abort()
    })
    loadingState.value.pendingRequests.clear()
    loadingState.value.loadingItems.clear()
    loadingState.value.isLoading = false
  }

  const executeLoadingRequest = async (request: LoadingRequest): Promise<FileSystemNode[]> => {
    try {
      // Check cache first
      const cacheKey = `${request.path}_${request.startIndex}_${request.endIndex}`
      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }

      // Add loading items
      for (let i = request.startIndex; i <= request.endIndex; i++) {
        loadingState.value.loadingItems.add(`${request.path}_${i}`)
      }

      // Execute request
      const result = await loadFunction(
        request.path,
        request.startIndex,
        request.endIndex,
        request.abortController.signal
      )

      // Cache result
      cache.set(cacheKey, result)

      // Mark as completed
      loadingState.value.completedRequests.add(request.id)
      loadingState.value.loadedItems += result.length

      // Remove loading items
      for (let i = request.startIndex; i <= request.endIndex; i++) {
        loadingState.value.loadingItems.delete(`${request.path}_${i}`)
      }

      return result

    } catch (error: any) {
      // Handle cancellation
      if (error.name === 'AbortError') {
        return []
      }

      // Track failed request
      const existingFailure = loadingState.value.failedRequests.get(request.id)
      const retryCount = existingFailure ? existingFailure.retryCount + 1 : 1
      
      loadingState.value.failedRequests.set(request.id, {
        error: error.message || 'Unknown error',
        timestamp: Date.now(),
        retryCount
      })

      // Remove loading items
      for (let i = request.startIndex; i <= request.endIndex; i++) {
        loadingState.value.loadingItems.delete(`${request.path}_${i}`)
      }

      throw error
    } finally {
      // Remove from pending requests
      loadingState.value.pendingRequests.delete(request.id)
      
      // Update loading state
      if (loadingState.value.pendingRequests.size === 0) {
        loadingState.value.isLoading = false
        showSkeletons.value = false
      }
    }
  }

  // Smart preloading logic
  const calculatePreloadPriority = (direction: 'up' | 'down', distance: number): number => {
    const directionMultiplier = direction === scrollBehavior.value.direction ? 2 : 1
    const velocityMultiplier = Math.min(scrollBehavior.value.velocity / scrollVelocityThreshold, 3)
    const distanceMultiplier = Math.max(1, 5 - (distance / preloadDistance))
    
    return directionMultiplier * velocityMultiplier * distanceMultiplier
  }

  const shouldPreload = (visibleRange: { start: number; end: number }, totalItems: number): boolean => {
    if (!canPreload.value) return false
    
    const visibleProgress = (visibleRange.end - visibleRange.start) / pageSize
    const isNearEnd = (visibleRange.end / totalItems) > preloadThreshold
    const isNearStart = (visibleRange.start / totalItems) < (1 - preloadThreshold)
    
    return visibleProgress > preloadThreshold || 
           (scrollBehavior.value.direction === 'down' && isNearEnd) ||
           (scrollBehavior.value.direction === 'up' && isNearStart)
  }

  // Main loading functions
  const loadMore = async (
    path: string,
    direction: 'up' | 'down',
    currentRange: { start: number; end: number },
    totalItems: number
  ): Promise<FileSystemNode[]> => {
    // Debounce rapid requests
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }

    return new Promise((resolve, reject) => {
      debounceTimeout = window.setTimeout(async () => {
        try {
          const result = await executeLoadMore(path, direction, currentRange, totalItems)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, debounceMs)
    })
  }

  const executeLoadMore = async (
    path: string,
    direction: 'up' | 'down',
    currentRange: { start: number; end: number },
    totalItems: number
  ): Promise<FileSystemNode[]> => {
    // Check if we're offline
    if (offlineState.value.isOffline) {
      return handleOfflineRequest(path, direction, currentRange)
    }

    // Calculate new range
    let startIndex: number
    let endIndex: number

    if (direction === 'down') {
      startIndex = currentRange.end + 1
      endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1)
    } else {
      endIndex = currentRange.start - 1
      startIndex = Math.max(endIndex - pageSize + 1, 0)
    }

    // Check if we already have this data
    const cacheKey = `${path}_${startIndex}_${endIndex}`
    const cached = cache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Create and execute request
    const request = createLoadingRequest(path, direction, startIndex, endIndex)
    loadingState.value.pendingRequests.set(request.id, request)
    loadingState.value.isLoading = true
    showSkeletons.value = true
    
    // Calculate skeleton count
    skeletonCount.value = endIndex - startIndex + 1

    try {
      const result = await executeLoadingRequest(request)
      
      // Trigger smart preloading if enabled
      if (enableSmartPreloading && shouldPreload(currentRange, totalItems)) {
        triggerSmartPreloading(path, direction, { start: startIndex, end: endIndex }, totalItems)
      }
      
      return result
    } catch (error) {
      console.error('Failed to load more items:', error)
      throw error
    }
  }

  const triggerSmartPreloading = (
    path: string,
    primaryDirection: 'up' | 'down',
    currentRange: { start: number; end: number },
    totalItems: number
  ) => {
    if (loadingState.value.pendingRequests.size >= maxConcurrentRequests) {
      return
    }

    // Preload in the primary scroll direction
    const preloadDirection = primaryDirection
    let preloadStart: number
    let preloadEnd: number

    if (preloadDirection === 'down') {
      preloadStart = currentRange.end + 1
      preloadEnd = Math.min(preloadStart + pageSize - 1, totalItems - 1)
    } else {
      preloadEnd = currentRange.start - 1
      preloadStart = Math.max(preloadEnd - pageSize + 1, 0)
    }

    // Check if preload range is valid and not already cached
    if (preloadStart <= preloadEnd && preloadStart >= 0 && preloadEnd < totalItems) {
      const cacheKey = `${path}_${preloadStart}_${preloadEnd}`
      if (!cache.has(cacheKey)) {
        const priority = calculatePreloadPriority(preloadDirection, 0)
        const preloadRequest = createLoadingRequest(path, preloadDirection, preloadStart, preloadEnd, priority)
        
        loadingState.value.pendingRequests.set(preloadRequest.id, preloadRequest)
        
        // Execute preload request with lower priority
        setTimeout(() => {
          executeLoadingRequest(preloadRequest).catch(error => {
            console.warn('Preload request failed:', error)
          })
        }, 50) // Small delay to prioritize main requests
      }
    }
  }

  // Offline handling
  const handleOfflineRequest = (
    path: string,
    direction: 'up' | 'down',
    currentRange: { start: number; end: number }
  ): FileSystemNode[] => {
    const cached = offlineState.value.offlineCache.get(path)
    if (cached) {
      const startIndex = direction === 'down' ? currentRange.end + 1 : Math.max(currentRange.start - pageSize, 0)
      const endIndex = direction === 'down' ? 
        Math.min(startIndex + pageSize - 1, cached.length - 1) : 
        currentRange.start - 1
      
      return cached.slice(startIndex, endIndex + 1)
    }
    return []
  }

  const cacheForOffline = (path: string, items: FileSystemNode[]) => {
    offlineState.value.offlineCache.set(path, items)
  }

  // Scroll behavior tracking
  const updateScrollBehavior = (scrollTop: number, direction: 'up' | 'down') => {
    const now = Date.now()
    const timeDelta = now - scrollBehavior.value.lastScrollTime
    const scrollDelta = Math.abs(scrollTop - scrollBehavior.value.scrollDistance)
    
    if (timeDelta > 0) {
      const newVelocity = scrollDelta / timeDelta * 1000 // pixels per second
      const acceleration = (newVelocity - scrollBehavior.value.velocity) / timeDelta * 1000
      
      scrollBehavior.value = {
        velocity: newVelocity,
        direction,
        acceleration,
        isScrolling: true,
        lastScrollTime: now,
        scrollDistance: scrollTop
      }
    }
  }

  const stopScrollTracking = () => {
    scrollBehavior.value.isScrolling = false
    scrollBehavior.value.velocity = 0
    scrollBehavior.value.acceleration = 0
  }

  // Progress tracking
  const updateProgress = () => {
    if (loadingState.value.totalItems > 0) {
      loadingProgress.value = (loadingState.value.loadedItems / loadingState.value.totalItems) * 100
    }
  }

  // Network status handling
  const handleOnline = () => {
    offlineState.value.isOffline = false
    offlineState.value.lastOnlineTime = Date.now()
    
    // Process queued requests
    const queuedRequests = [...offlineState.value.queuedRequests]
    offlineState.value.queuedRequests = []
    
    queuedRequests.forEach(request => {
      loadingState.value.pendingRequests.set(request.id, request)
      executeLoadingRequest(request).catch(error => {
        console.error('Failed to execute queued request:', error)
      })
    })
  }

  const handleOffline = () => {
    offlineState.value.isOffline = true
    
    // Cancel pending requests and queue them for later
    loadingState.value.pendingRequests.forEach(request => {
      request.abortController.abort()
      offlineState.value.queuedRequests.push(request)
    })
    loadingState.value.pendingRequests.clear()
  }

  // Retry failed requests
  const retryFailedRequest = async (requestId: string) => {
    const failedRequest = loadingState.value.failedRequests.get(requestId)
    if (!failedRequest || failedRequest.retryCount >= 3) {
      return false
    }

    // Remove from failed requests
    loadingState.value.failedRequests.delete(requestId)

    // Create new request (original request data would need to be stored)
    // This is a simplified retry - in practice, you'd store original request data
    return true
  }

  // Cleanup
  const cleanup = () => {
    cancelAllRequests()
    cache.clear()
    
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }
  }

  // Watchers
  watch(() => loadingState.value.loadedItems, updateProgress)

  // Event listeners
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return {
    // State
    loadingState: computed(() => loadingState.value),
    scrollBehavior: computed(() => scrollBehavior.value),
    offlineState: computed(() => offlineState.value),
    skeletonCount: computed(() => skeletonCount.value),
    showSkeletons: computed(() => showSkeletons.value),
    loadingProgress: computed(() => loadingProgress.value),
    
    // Computed
    isLoadingAny,
    loadingStats,
    canPreload,
    
    // Methods
    loadMore,
    cancelRequest,
    cancelAllRequests,
    updateScrollBehavior,
    stopScrollTracking,
    cacheForOffline,
    retryFailedRequest,
    cleanup,
    
    // Cache methods
    getCachedItem: cache.get,
    setCachedItem: cache.set,
    clearCache: cache.clear,
    getCacheStats: cache.getStats
  }
}