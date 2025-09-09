# File Caching Implementation Plan

## Overview
Implement a robust caching system for file content and directory trees to provide instant navigation between files and improve user experience. This will eliminate loading delays when users navigate back and forth between files they've already viewed.

## Current Pain Points
1. **Repeated file requests** - Same file content fetched multiple times
2. **Directory tree re-fetching** - File browser reloads on every navigation
3. **Slow navigation** - Users wait for network requests when switching between files
4. **Poor offline experience** - No cached content available when connection is poor
5. **Unnecessary server load** - Duplicate requests for unchanged files

## Caching Strategy

### 1. Multi-Level Cache Architecture

#### **Level 1: In-Memory Cache (React Context)**
- **Purpose:** Instant access for current session
- **Scope:** Component-level state management
- **Lifetime:** Until page refresh or component unmount
- **Storage:** JavaScript objects in memory

#### **Level 2: Browser Storage Cache (IndexedDB)**
- **Purpose:** Persistent cache across sessions
- **Scope:** Cross-session persistence
- **Lifetime:** Configurable TTL (Time To Live)
- **Storage:** IndexedDB for large file content

#### **Level 3: HTTP Cache Headers**
- **Purpose:** Browser-level caching
- **Scope:** Network request optimization
- **Lifetime:** Server-controlled via headers
- **Storage:** Browser HTTP cache

### 2. Cache Key Strategy

```typescript
interface CacheKey {
  type: 'file' | 'directory';
  path: string;
  lastModified?: number; // File modification timestamp
  etag?: string;         // Server-provided ETag
}

// Examples:
// file:/src/components/App.tsx:1699123456789
// directory:/src/components:1699123456789
```

### 3. Enhanced Cache Invalidation Strategy

#### **Tiered Time-Based Invalidation**
- **Active Files:** 1 second TTL (currently viewed/edited)
- **Recent Files:** 30 seconds TTL (recently accessed)
- **Stale Files:** 5 minutes TTL (infrequently accessed)
- **Directory Trees:** 2 minutes default TTL

#### **Robust Event-Based Invalidation**
- **Resilient File System Watchers:** Auto-retry, debounced, error recovery
- **Hierarchical Invalidation:** File change → invalidate file + parent + ancestor directories
- **Cross-Tab Synchronization:** Broadcast invalidation events across tabs
- **Manual Refresh:** User-triggered cache clear
- **Version-Based:** Server sends version/etag changes

#### **Bulk Operation Handling**
- **Git Operations:** Branch switch → clear all cache; commit → selective invalidation
- **Package Operations:** npm/yarn operations → invalidate package.json + node_modules
- **Build Processes:** Build events → invalidate output directories
- **File Moves/Renames:** Recursive invalidation of source and target paths

#### **Size-Based Eviction**
- **LRU (Least Recently Used):** Remove oldest accessed items
- **Size Limits:** Max 50MB total cache, 5MB per file
- **Count Limits:** Max 100 files, 20 directories

## Implementation Plan

### Phase 1: Core Cache Infrastructure

#### 1.1 Create Cache Context Provider
**File:** `src/webview/react-frontend/src/contexts/FileCacheContext.tsx`

```typescript
interface FileCacheContextType {
  // File operations
  getFile: (path: string) => Promise<FileContent | null>;
  setFile: (path: string, content: FileContent) => void;
  
  // Directory operations
  getDirectory: (path: string) => Promise<DirectoryContent | null>;
  setDirectory: (path: string, content: DirectoryContent) => void;
  
  // Cache management
  clearCache: () => void;
  getCacheStats: () => CacheStats;
  invalidatePath: (path: string) => void;
  invalidateHierarchy: (path: string) => void;
}
```

#### 1.2 Create Cache Storage Layer
**File:** `src/webview/react-frontend/src/lib/cache/FileCache.ts`

```typescript
class FileCache {
  private memoryCache: Map<string, CacheEntry>;
  private indexedDB: IDBDatabase;
  
  async get(key: string): Promise<CacheEntry | null>;
  async set(key: string, value: CacheEntry): Promise<void>;
  async invalidate(key: string): Promise<void>;
  async invalidateHierarchy(path: string): Promise<void>;
  async clear(): Promise<void>;
}
```

#### 1.3 Create Cache Entry Types
**File:** `src/webview/react-frontend/src/lib/cache/types.ts`

```typescript
interface CacheEntry {
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

interface FileContent {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
  mimeType?: string;
  encoding?: string;
}

interface DirectoryContent {
  path: string;
  children: FileNode[];
  totalCount: number;
  hasMore: boolean;
}
```

### Phase 2: Cache Integration

#### 2.1 Update FileViewerPage with Caching
**Changes to:** `src/webview/react-frontend/src/pages/FileViewerPage.tsx`

```typescript
const FileViewerPage: React.FC = () => {
  const { getFile, setFile } = useFileCache();
  
  const loadFile = async (path: string) => {
    // 1. Check cache first
    const cached = await getFile(path);
    if (cached && !isCacheExpired(cached)) {
      setContent(cached.content);
      setMeta(cached.meta);
      setLoading(false);
      return;
    }
    
    // 2. Fetch from server if not cached or expired
    setLoading(true);
    const result = await fetchFileFromServer(path);
    
    // 3. Cache the result
    await setFile(path, result);
    
    setContent(result.content);
    setMeta(result.meta);
    setLoading(false);
  };
};
```

#### 2.2 Update FilesPage with Directory Caching
**Changes to:** `src/webview/react-frontend/src/pages/FilesPage.tsx`

```typescript
const FilesPage: React.FC = () => {
  const { getDirectory, setDirectory } = useFileCache();
  
  const loadDirectory = async (path: string) => {
    // 1. Check cache first
    const cached = await getDirectory(path);
    if (cached && !isCacheExpired(cached)) {
      setNodes(cached.children);
      setLoading(false);
      return;
    }
    
    // 2. Fetch from server if not cached or expired
    setLoading(true);
    const result = await fetchDirectoryFromServer(path);
    
    // 3. Cache the result
    await setDirectory(path, result);
    
    setNodes(result.children);
    setLoading(false);
  };
};
```

### Phase 3: Enhanced Cache Invalidation

#### 3.1 Robust File System Watcher
**File:** `src/webview/react-frontend/src/lib/cache/RobustFileWatcher.ts`

```typescript
class RobustFileWatcher {
  private watchers: Map<string, FSWatcher>;
  private retryQueue: Set<string>;
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private broadcastChannel: BroadcastChannel;
  
  async setupWatcher(path: string): Promise<void> {
    try {
      const watcher = fs.watch(path, { recursive: true }, 
        this.debounceHandler(path, this.handleFileChange));
      this.watchers.set(path, watcher);
    } catch (error) {
      this.scheduleRetry(path);
    }
  }
  
  private debounceHandler(path: string, handler: (event: string, filename: string) => void) {
    return (event: string, filename: string) => {
      clearTimeout(this.debounceTimers.get(path));
      this.debounceTimers.set(path, setTimeout(() => handler(event, filename), 100));
    };
  }
  
  private handleFileChange(event: string, filename: string): void {
    const fullPath = path.join(path.dirname(filename), filename);
    this.invalidateHierarchy(fullPath);
    this.broadcastInvalidation(fullPath);
  }
  
  private broadcastInvalidation(path: string): void {
    this.broadcastChannel.postMessage({
      type: 'invalidate',
      path,
      timestamp: Date.now()
    });
  }
}
```

#### 3.2 Cross-Tab Synchronization
**File:** `src/webview/react-frontend/src/lib/cache/CrossTabSync.ts`

```typescript
class CrossTabSync {
  private broadcastChannel: BroadcastChannel;
  
  constructor() {
    this.broadcastChannel = new BroadcastChannel('cache-invalidation');
    this.broadcastChannel.onmessage = this.handleBroadcast.bind(this);
  }
  
  private handleBroadcast(event: MessageEvent): void {
    if (event.data.type === 'invalidate') {
      this.invalidateLocalCache(event.data.path);
    }
  }
  
  broadcastInvalidation(path: string): void {
    this.broadcastChannel.postMessage({
      type: 'invalidate',
      path,
      timestamp: Date.now()
    });
  }
}
```

#### 3.3 Bulk Operation Handler
**File:** `src/webview/react-frontend/src/lib/cache/BulkOperationHandler.ts`

```typescript
class BulkOperationHandler {
  handleGitOperation(operation: string, paths?: string[]): void {
    switch (operation) {
      case 'checkout':
        this.clearAllCache();
        break;
      case 'commit':
        paths?.forEach(path => this.invalidateHierarchy(path));
        break;
      case 'merge':
        this.clearAllCache();
        break;
    }
  }
  
  handlePackageOperation(operation: string): void {
    switch (operation) {
      case 'install':
      case 'update':
        this.invalidatePath('package.json');
        this.invalidatePath('node_modules');
        this.invalidatePath('package-lock.json');
        break;
    }
  }
}
```

### Phase 4: User Experience Enhancements

#### 4.1 Cache Status Indicators
**Component:** `CacheStatusIndicator.tsx`

```typescript
const CacheStatusIndicator: React.FC = () => {
  const { getCacheStats } = useFileCache();
  const stats = getCacheStats();
  
  return (
    <div className="cache-status">
      <span className={cn(
        "cache-indicator",
        stats.hitRate > 0.8 ? "text-green-500" : "text-yellow-500"
      )}>
        📦 {stats.cachedFiles} files cached ({Math.round(stats.hitRate * 100)}% hit rate)
      </span>
    </div>
  );
};
```

#### 4.2 Cache Management UI
**Component:** `CacheManagementPanel.tsx`

```typescript
const CacheManagementPanel: React.FC = () => {
  const { clearCache, getCacheStats } = useFileCache();
  
  return (
    <div className="cache-management">
      <h3>Cache Management</h3>
      <div className="cache-stats">
        <p>Cached Files: {stats.cachedFiles}</p>
        <p>Cache Size: {formatBytes(stats.totalSize)}</p>
        <p>Hit Rate: {Math.round(stats.hitRate * 100)}%</p>
      </div>
      <button onClick={clearCache}>Clear Cache</button>
    </div>
  );
};
```

## Configuration Options

### User-Configurable Settings
**File:** `src/webview/react-frontend/src/lib/cache/CacheConfig.ts`

```typescript
interface CacheConfig {
  // TTL settings
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
```

## Implementation Timeline

### Week 1: Core Infrastructure
- [ ] Create cache context and provider
- [ ] Implement in-memory cache layer
- [ ] Create cache entry types and interfaces
- [ ] Basic cache operations (get, set, clear)

### Week 2: Enhanced Invalidation
- [ ] Implement robust file system watcher
- [ ] Add cross-tab synchronization
- [ ] Create bulk operation handler
- [ ] Add hierarchical invalidation

### Week 3: Component Integration
- [ ] Update FileViewerPage with caching
- [ ] Update FilesPage with directory caching
- [ ] Add cache status indicators
- [ ] Implement cache management UI

### Week 4: Advanced Features
- [ ] Add prefetching strategies
- [ ] Implement offline support
- [ ] Add compression support
- [ ] Performance testing and optimization

## Success Metrics

### Performance Metrics
- **Cache Hit Rate:** Target >85% for frequently accessed files
- **Load Time Reduction:** Target 95% reduction for cached files
- **Network Requests:** Target 70% reduction in file requests
- **Invalidation Latency:** <100ms for file changes

### User Experience Metrics
- **Navigation Speed:** Instant (<50ms) for cached files
- **Real-time Sync:** <1 second delay for file changes
- **Cross-tab Consistency:** 100% sync across tabs
- **Error Recovery:** Graceful fallback when cache fails

## Risk Mitigation

### 1. Cache Invalidation Failures
- **Risk:** Stale data due to missed file system events
- **Mitigation:** Tiered TTL, retry mechanisms, manual refresh options

### 2. Race Conditions
- **Risk:** Inconsistent state during concurrent operations
- **Mitigation:** Proper locking, atomic operations, event ordering

### 3. Resource Management
- **Risk:** File watchers consuming excessive resources
- **Mitigation:** Debouncing, lazy initialization, cleanup on unmount

### 4. Network Resilience
- **Risk:** Lost invalidation events due to network issues
- **Mitigation:** Event queuing, retry logic, fallback polling

---

**Priority:** High  
**Complexity:** Medium  
**Impact:** High (significantly improves user experience)  
**Dependencies:** WebSocket connection fix (completed)
