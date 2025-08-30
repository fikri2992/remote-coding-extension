import { ref, onUnmounted } from 'vue'

interface CacheItem {
  data: any
  timestamp: number
  accessCount: number
  lastAccessed: number
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number
  cleanupInterval?: number
}

export function useVirtualScrollCache(
  maxSize = 1000,
  options: CacheOptions = {}
) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default TTL
    cleanupInterval = 60 * 1000 // 1 minute cleanup interval
  } = options

  const cache = ref(new Map<string | number, CacheItem>())
  const stats = ref({
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0
  })

  let cleanupTimer: number | null = null

  // LRU eviction policy
  const evictLRU = () => {
    if (cache.value.size <= maxSize) return

    const entries = Array.from(cache.value.entries())
    
    // Sort by access count (ascending) and last accessed time (ascending)
    entries.sort((a, b) => {
      const [, itemA] = a
      const [, itemB] = b
      
      // First sort by access count
      if (itemA.accessCount !== itemB.accessCount) {
        return itemA.accessCount - itemB.accessCount
      }
      
      // Then by last accessed time
      return itemA.lastAccessed - itemB.lastAccessed
    })

    // Remove oldest/least used items
    const itemsToRemove = entries.length - maxSize
    for (let i = 0; i < itemsToRemove; i++) {
      const entry = entries[i]
      if (entry) {
        const [key] = entry
        cache.value.delete(key)
        stats.value.evictions++
      }
    }

    stats.value.size = cache.value.size
  }

  // TTL cleanup
  const cleanupExpired = () => {
    const now = Date.now()
    const expired: (string | number)[] = []

    cache.value.forEach((item, key) => {
      if (now - item.timestamp > ttl) {
        expired.push(key)
      }
    })

    expired.forEach(key => {
      cache.value.delete(key)
      stats.value.evictions++
    })

    stats.value.size = cache.value.size
  }

  // Start cleanup timer
  const startCleanup = () => {
    if (cleanupTimer) return

    cleanupTimer = window.setInterval(() => {
      cleanupExpired()
      evictLRU()
    }, cleanupInterval)
  }

  // Stop cleanup timer
  const stopCleanup = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = null
    }
  }

  const get = (key: string | number): any => {
    const item = cache.value.get(key)
    
    if (!item) {
      stats.value.misses++
      return null
    }

    // Check TTL
    if (Date.now() - item.timestamp > ttl) {
      cache.value.delete(key)
      stats.value.misses++
      stats.value.evictions++
      stats.value.size = cache.value.size
      return null
    }

    // Update access statistics
    item.accessCount++
    item.lastAccessed = Date.now()
    
    stats.value.hits++
    return item.data
  }

  const set = (key: string | number, data: any): void => {
    const now = Date.now()
    
    // Update existing item
    if (cache.value.has(key)) {
      const item = cache.value.get(key)!
      item.data = data
      item.timestamp = now
      item.lastAccessed = now
      item.accessCount++
      return
    }

    // Add new item
    cache.value.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    })

    stats.value.size = cache.value.size

    // Trigger eviction if needed
    if (cache.value.size > maxSize) {
      evictLRU()
    }
  }

  const has = (key: string | number): boolean => {
    const item = cache.value.get(key)
    if (!item) return false

    // Check TTL
    if (Date.now() - item.timestamp > ttl) {
      cache.value.delete(key)
      stats.value.evictions++
      stats.value.size = cache.value.size
      return false
    }

    return true
  }

  const remove = (key: string | number): boolean => {
    const deleted = cache.value.delete(key)
    if (deleted) {
      stats.value.size = cache.value.size
    }
    return deleted
  }

  const clear = (): void => {
    cache.value.clear()
    stats.value.size = 0
    stats.value.hits = 0
    stats.value.misses = 0
    stats.value.evictions = 0
  }

  const cleanup = (): void => {
    cleanupExpired()
    evictLRU()
  }

  const getStats = () => {
    const hitRate = stats.value.hits + stats.value.misses > 0 
      ? stats.value.hits / (stats.value.hits + stats.value.misses) 
      : 0

    return {
      ...stats.value,
      hitRate: Math.round(hitRate * 100) / 100,
      maxSize
    }
  }

  const preload = (items: Array<{ key: string | number; data: any }>) => {
    items.forEach(({ key, data }) => {
      if (!has(key)) {
        set(key, data)
      }
    })
  }

  const warmup = (keys: (string | number)[], dataLoader: (key: string | number) => Promise<any>) => {
    return Promise.all(
      keys.map(async (key) => {
        if (!has(key)) {
          try {
            const data = await dataLoader(key)
            set(key, data)
          } catch (error) {
            console.warn(`Failed to warm up cache for key ${key}:`, error)
          }
        }
      })
    )
  }

  // Start cleanup on creation
  startCleanup()

  // Cleanup on unmount
  onUnmounted(() => {
    stopCleanup()
    clear()
  })

  return {
    get,
    set,
    has,
    remove,
    clear,
    cleanup,
    getStats,
    preload,
    warmup,
    cache: cache.value,
    stats: stats.value
  }
}