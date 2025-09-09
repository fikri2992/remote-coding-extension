import { CacheEntry, CacheConfig, CacheStats, DEFAULT_CACHE_CONFIG } from './types';

export class FileCache {
  private memoryCache = new Map<string, CacheEntry>();
  private indexedDB: IDBDatabase | null = null;
  private config: CacheConfig;
  private dbName = 'kiro-file-cache';
  private dbVersion = 1;
  private storeName = 'cache-entries';
  private hitCount = 0;
  private missCount = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.initIndexedDB();
  }

  private async initIndexedDB(): Promise<void> {
    if (!this.config.indexedDBEnabled || typeof window === 'undefined') {
      return;
    }

    try {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        console.warn('Failed to open IndexedDB for file cache');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('lastAccess', 'lastAccess');
        }
      };

      request.onsuccess = (event) => {
        this.indexedDB = (event.target as IDBOpenDBRequest).result;
      };
    } catch (error) {
      console.warn('IndexedDB not available for file cache:', error);
    }
  }

  private generateKey(path: string, type: 'file' | 'directory'): string {
    return `${type}:${path}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    return (now - entry.timestamp) > entry.ttl;
  }

  private getTTL(path: string, type: 'file' | 'directory'): number {
    if (type === 'directory') {
      return this.config.directoryTTL;
    }
    
    // For files, use tiered TTL based on access patterns
    const memEntry = this.memoryCache.get(this.generateKey(path, type));
    if (memEntry) {
      const timeSinceAccess = Date.now() - memEntry.lastAccess;
      if (timeSinceAccess < 5000) return this.config.activeFileTTL;
      if (timeSinceAccess < 60000) return this.config.recentFileTTL;
    }
    
    return this.config.staleFileTTL;
  }

  /**
   * Return a memory-cached entry immediately, without touching IndexedDB.
   * If allowStale is true, returns even if TTL is expired (for SWR immediate paint).
   */
  peek(path: string, type: 'file' | 'directory', allowStale: boolean = false): CacheEntry | null {
    const key = this.generateKey(path, type);
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (allowStale) return { ...this.updateAccessInfo(entry) };
    if (!this.isExpired(entry)) {
      const updated = this.updateAccessInfo(entry);
      this.memoryCache.set(key, updated);
      return { ...updated };
    }
    return null;
  }

  private updateAccessInfo(entry: CacheEntry): CacheEntry {
    return {
      ...entry,
      lastAccess: Date.now(),
      accessCount: entry.accessCount + 1,
    };
  }

  private async evictLRU(): Promise<void> {
    if (this.memoryCache.size <= this.config.maxFiles) return;

    // Sort by last access time and remove oldest
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccess - b.lastAccess);
    
    const toRemove = entries.slice(0, Math.floor(this.config.maxFiles * 0.2));
    for (const [key] of toRemove) {
      this.memoryCache.delete(key);
    }
  }

  private async evictBySize(): Promise<void> {
    const totalSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    if (totalSize <= this.config.maxCacheSize) return;

    // Remove largest files first, then by LRU
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => {
        if (a.size !== b.size) return b.size - a.size;
        return a.lastAccess - b.lastAccess;
      });
    
    let currentSize = totalSize;
    for (const [key, entry] of entries) {
      if (currentSize <= this.config.maxCacheSize * 0.8) break;
      this.memoryCache.delete(key);
      currentSize -= entry.size;
    }
  }

  async get(path: string, type: 'file' | 'directory'): Promise<CacheEntry | null> {
    const key = this.generateKey(path, type);
    
    // Check memory cache first
    let entry = this.memoryCache.get(key);
    if (entry) {
      if (!this.isExpired(entry)) {
        this.hitCount++;
        entry = this.updateAccessInfo(entry);
        this.memoryCache.set(key, entry);
        return entry;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check IndexedDB if available
    if (this.indexedDB) {
      try {
        const transaction = this.indexedDB.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        
        const result = await new Promise<CacheEntry | null>((resolve) => {
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => resolve(null);
        });

        if (result && !this.isExpired(result)) {
          this.hitCount++;
          const updatedEntry = this.updateAccessInfo(result);
          // Promote to memory cache
          this.memoryCache.set(key, updatedEntry);
          await this.evictLRU();
          return updatedEntry;
        }
      } catch (error) {
        console.warn('Error reading from IndexedDB cache:', error);
      }
    }

    this.missCount++;
    return null;
  }

  async set(path: string, type: 'file' | 'directory', data: any): Promise<void> {
    const key = this.generateKey(path, type);
    const now = Date.now();
    const ttl = this.getTTL(path, type);
    
    // Calculate size (rough estimate)
    const size = JSON.stringify(data).length;
    
    // Skip if file is too large
    if (size > this.config.maxFileSize) {
      console.warn(`File too large for cache: ${path} (${size} bytes)`);
      return;
    }

    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccess: now,
      size,
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);
    
    // Evict if necessary
    await this.evictLRU();
    await this.evictBySize();

    // Store in IndexedDB if available
    if (this.indexedDB) {
      try {
        const transaction = this.indexedDB.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.put(entry);
      } catch (error) {
        console.warn('Error writing to IndexedDB cache:', error);
      }
    }
  }

  async invalidate(path: string, type?: 'file' | 'directory'): Promise<void> {
    if (type) {
      const key = this.generateKey(path, type);
      this.memoryCache.delete(key);
      
      if (this.indexedDB) {
        try {
          const transaction = this.indexedDB.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          store.delete(key);
        } catch (error) {
          console.warn('Error deleting from IndexedDB cache:', error);
        }
      }
    } else {
      // Invalidate both file and directory entries for this path
      await this.invalidate(path, 'file');
      await this.invalidate(path, 'directory');
    }
  }

  async invalidateHierarchy(path: string): Promise<void> {
    const normalizedPath = path.replace(/\\/g, '/');
    
    // Invalidate the path itself
    await this.invalidate(normalizedPath);
    
    // Invalidate all parent directories
    const parts = normalizedPath.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const parentPath = '/' + parts.slice(0, i).join('/');
      await this.invalidate(parentPath, 'directory');
    }
    
    // Invalidate root if not already done
    await this.invalidate('/', 'directory');
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    
    if (this.indexedDB) {
      try {
        const transaction = this.indexedDB.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.clear();
      } catch (error) {
        console.warn('Error clearing IndexedDB cache:', error);
      }
    }
  }

  getCacheStats(): CacheStats {
    const memoryEntries = this.memoryCache.size;
    const totalSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      cachedFiles: memoryEntries,
      totalSize,
      hitRate,
      memoryEntries,
      persistentEntries: 0, // Would need to query IndexedDB for accurate count
    };
  }

  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
