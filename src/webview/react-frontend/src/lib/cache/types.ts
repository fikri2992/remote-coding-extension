export interface CacheKey {
  type: 'file' | 'directory';
  path: string;
  lastModified?: number;
  etag?: string;
}

export interface CacheEntry {
  key: string;
  data: FileContent | DirectoryContent;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
  size: number;
  etag?: string;
  lastModified?: string;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
  mimeType?: string;
  encoding?: string;
}

export interface DirectoryContent {
  path: string;
  children: FileNode[];
  totalCount: number;
  hasMore: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
}

export interface CacheStats {
  cachedFiles: number;
  totalSize: number;
  hitRate: number;
  memoryEntries: number;
  persistentEntries: number;
}

export interface CacheConfig {
  // TTL settings (in milliseconds)
  activeFileTTL: number;    // Default: 1 second
  recentFileTTL: number;    // Default: 30 seconds
  staleFileTTL: number;     // Default: 5 minutes
  directoryTTL: number;     // Default: 2 minutes
  
  // Size limits
  maxCacheSize: number;     // Default: 50MB
  maxFileSize: number;      // Default: 5MB
  maxFiles: number;         // Default: 100
  
  // Behavior
  enablePrefetch: boolean;     // Default: true
  enableOfflineMode: boolean;  // Default: true
  enableCrossTabSync: boolean; // Default: true
  enableFileWatcher: boolean;  // Default: true
  
  // Performance
  compressionEnabled: boolean; // Default: true
  indexedDBEnabled: boolean;   // Default: true
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  activeFileTTL: 1000,        // 1 second
  recentFileTTL: 30000,       // 30 seconds
  staleFileTTL: 300000,       // 5 minutes
  directoryTTL: 120000,       // 2 minutes
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  maxFileSize: 5 * 1024 * 1024,   // 5MB
  maxFiles: 100,
  enablePrefetch: true,
  enableOfflineMode: true,
  enableCrossTabSync: true,
  enableFileWatcher: true,
  compressionEnabled: true,
  indexedDBEnabled: true,
};