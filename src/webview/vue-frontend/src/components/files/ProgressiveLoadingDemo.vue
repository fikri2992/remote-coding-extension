<template>
  <div class="progressive-loading-demo">
    <div class="demo-header">
      <h3 class="demo-title">Progressive Loading Demo</h3>
      <div class="demo-controls">
        <button 
          @click="toggleDemo"
          class="demo-button"
          :class="{ active: isDemoActive }"
        >
          {{ isDemoActive ? 'Stop Demo' : 'Start Demo' }}
        </button>
        <button 
          @click="simulateOffline"
          class="demo-button"
          :class="{ active: isOfflineSimulated }"
        >
          {{ isOfflineSimulated ? 'Go Online' : 'Go Offline' }}
        </button>
        <button 
          @click="clearCache"
          class="demo-button"
        >
          Clear Cache
        </button>
        <button 
          @click="toggleDebugMode"
          class="demo-button"
          :class="{ active: debugMode }"
        >
          Debug Mode
        </button>
      </div>
    </div>

    <!-- Loading State Manager -->
    <LoadingStateManager
      v-if="isDemoActive"
      :loading-state="loadingState"
      :offline-state="offlineState"
      :loading-stats="loadingStats"
      :loading-progress="loadingProgress"
      :show-skeletons="showSkeletons"
      :skeleton-count="skeletonCount"
      :density="density"
      :debug-mode="debugMode"
      :show-debug-stats="debugMode"
      @retry-connection="handleRetryConnection"
      @cancel-request="handleCancelRequest"
      @retry-request="handleRetryRequest"
      @dismiss-offline="handleDismissOffline"
      @dismiss-cached="handleDismissCached"
      @dismiss-error="handleDismissError"
    />

    <!-- Demo File List -->
    <div v-if="isDemoActive" class="demo-file-list">
      <VirtualList
        ref="virtualListRef"
        :items="demoItems"
        :item-height="itemHeight"
        :container-height="400"
        :progressive-loading="true"
        :page-size="20"
        :preload-distance="100"
        :show-skeletons="showSkeletons"
        :momentum-scrolling="true"
        :cache-enabled="true"
        :cache-size="500"
        :load-function="loadDemoItems"
        :base-path="'/demo'"
        :enable-smart-preloading="true"
        :max-concurrent-requests="2"
        :scroll-velocity-threshold="50"
        v-slot="{ item, isLoading: itemLoading }"
        @loading-state-change="handleLoadingStateChange"
        @offline-state-change="handleOfflineStateChange"
        @scroll="handleScroll"
        @visible-range-change="handleVisibleRangeChange"
      >
        <div 
          class="demo-file-item"
          :class="{ 
            'demo-file-loading': itemLoading,
            [`demo-density-${density}`]: true
          }"
        >
          <div class="demo-file-icon">
            {{ item.type === 'directory' ? '📁' : '📄' }}
          </div>
          <div class="demo-file-info">
            <div class="demo-file-name">{{ item.name }}</div>
            <div class="demo-file-details">
              {{ item.size ? formatFileSize(item.size) : '' }}
              {{ item.modified ? ' • ' + formatDate(item.modified) : '' }}
            </div>
          </div>
          <div v-if="itemLoading" class="demo-file-spinner">
            <div class="spinner"></div>
          </div>
        </div>
      </VirtualList>
    </div>

    <!-- Demo Statistics -->
    <div v-if="isDemoActive && debugMode" class="demo-stats">
      <h4 class="demo-stats-title">Demo Statistics</h4>
      <div class="demo-stats-grid">
        <div class="demo-stat">
          <span class="demo-stat-label">Total Items:</span>
          <span class="demo-stat-value">{{ demoItems.length }}</span>
        </div>
        <div class="demo-stat">
          <span class="demo-stat-label">Visible Range:</span>
          <span class="demo-stat-value">{{ visibleRange.start }}-{{ visibleRange.end }}</span>
        </div>
        <div class="demo-stat">
          <span class="demo-stat-label">Scroll Position:</span>
          <span class="demo-stat-value">{{ scrollPosition }}px</span>
        </div>
        <div class="demo-stat">
          <span class="demo-stat-label">Scroll Direction:</span>
          <span class="demo-stat-value">{{ scrollDirection }}</span>
        </div>
        <div class="demo-stat">
          <span class="demo-stat-label">Loading Requests:</span>
          <span class="demo-stat-value">{{ loadingRequestCount }}</span>
        </div>
        <div class="demo-stat">
          <span class="demo-stat-label">Cache Size:</span>
          <span class="demo-stat-value">{{ cacheSize }}</span>
        </div>
      </div>
    </div>

    <!-- Demo Configuration -->
    <div class="demo-config">
      <h4 class="demo-config-title">Configuration</h4>
      <div class="demo-config-grid">
        <div class="demo-config-item">
          <label class="demo-config-label">Density:</label>
          <select v-model="density" class="demo-config-select">
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </div>
        <div class="demo-config-item">
          <label class="demo-config-label">Show Skeletons:</label>
          <input v-model="showSkeletons" type="checkbox" class="demo-config-checkbox">
        </div>
        <div class="demo-config-item">
          <label class="demo-config-label">Simulate Slow Network:</label>
          <input v-model="simulateSlowNetwork" type="checkbox" class="demo-config-checkbox">
        </div>
        <div class="demo-config-item">
          <label class="demo-config-label">Error Rate (%):</label>
          <input v-model="errorRate" type="range" min="0" max="50" class="demo-config-range">
          <span class="demo-config-value">{{ errorRate }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'
import VirtualList from './VirtualList.vue'
import LoadingStateManager from './LoadingStateManager.vue'
import type { FileSystemNode } from '../../types/filesystem'

// Composables
const breakpoints = useBreakpoints()

// State
const isDemoActive = ref(false)
const isOfflineSimulated = ref(false)
const debugMode = ref(false)
const density = ref<'compact' | 'normal' | 'comfortable'>('normal')
const showSkeletons = ref(true)
const simulateSlowNetwork = ref(false)
const errorRate = ref(10)

const demoItems = ref<FileSystemNode[]>([])
const loadingState = ref({
  isLoading: false,
  loadingItems: new Set<string>(),
  pendingRequests: new Map(),
  completedRequests: new Set<string>(),
  failedRequests: new Map(),
  totalItems: 1000,
  loadedItems: 0
})

const offlineState = ref({
  isOffline: false,
  lastOnlineTime: Date.now(),
  queuedRequests: [],
  offlineCache: new Map()
})

const loadingStats = ref({
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  pendingRequests: 0,
  cacheHitRate: 0,
  loadingProgress: 0
})

const loadingProgress = ref(0)
const skeletonCount = ref(0)
const visibleRange = ref({ start: 0, end: 0 })
const scrollPosition = ref(0)
const scrollDirection = ref<'up' | 'down'>('down')
const loadingRequestCount = ref(0)
const cacheSize = ref(0)

const virtualListRef = ref<InstanceType<typeof VirtualList>>()

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const itemHeight = computed(() => {
  switch (density.value) {
    case 'compact':
      return isMobile.value ? 40 : 28
    case 'comfortable':
      return isMobile.value ? 56 : 40
    default: // normal
      return isMobile.value ? 48 : 32
  }
})

// Methods
const generateDemoItem = (index: number): FileSystemNode => {
  const isDirectory = Math.random() > 0.7
  const name = isDirectory 
    ? `Folder ${index + 1}`
    : `File ${index + 1}.${['txt', 'js', 'ts', 'vue', 'md', 'json'][Math.floor(Math.random() * 6)]}`
  
  return {
    path: `/demo/${name}`,
    name,
    type: isDirectory ? 'directory' : 'file',
    size: isDirectory ? 0 : Math.floor(Math.random() * 1000000),
    modified: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    created: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    parent: '/demo'
  }
}

const loadDemoItems = async (
  _path: string,
  startIndex: number,
  endIndex: number,
  signal?: AbortSignal
): Promise<FileSystemNode[]> => {
  // Simulate network delay
  const delay = simulateSlowNetwork.value ? 1000 + Math.random() * 2000 : 100 + Math.random() * 300
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Check if request was cancelled
      if (signal?.aborted) {
        reject(new Error('Request cancelled'))
        return
      }
      
      // Simulate offline state
      if (isOfflineSimulated.value) {
        reject(new Error('Network unavailable'))
        return
      }
      
      // Simulate random errors
      if (Math.random() * 100 < errorRate.value) {
        reject(new Error('Simulated network error'))
        return
      }
      
      // Generate demo items
      const items: FileSystemNode[] = []
      for (let i = startIndex; i <= endIndex; i++) {
        items.push(generateDemoItem(i))
      }
      
      resolve(items)
    }, delay)
    
    // Handle cancellation
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      reject(new Error('Request cancelled'))
    })
  })
}

const toggleDemo = () => {
  isDemoActive.value = !isDemoActive.value
  
  if (isDemoActive.value) {
    // Initialize demo with some items
    demoItems.value = Array.from({ length: 50 }, (_, i) => generateDemoItem(i))
    loadingState.value.loadedItems = 50
  } else {
    // Clean up
    demoItems.value = []
    loadingState.value = {
      isLoading: false,
      loadingItems: new Set(),
      pendingRequests: new Map(),
      completedRequests: new Set(),
      failedRequests: new Map(),
      totalItems: 1000,
      loadedItems: 0
    }
  }
}

const simulateOffline = () => {
  isOfflineSimulated.value = !isOfflineSimulated.value
  offlineState.value.isOffline = isOfflineSimulated.value
  
  if (isOfflineSimulated.value) {
    offlineState.value.lastOnlineTime = Date.now()
  }
}

const clearCache = () => {
  if (virtualListRef.value) {
    // Clear virtual list cache
    const stats = virtualListRef.value.getLoadingStats()
    if (stats) {
      cacheSize.value = 0
    }
  }
}

const toggleDebugMode = () => {
  debugMode.value = !debugMode.value
}

const handleLoadingStateChange = (isLoading: boolean, stats: any) => {
  loadingState.value.isLoading = isLoading
  if (stats) {
    loadingStats.value = stats
    loadingProgress.value = stats.loadingProgress
    loadingRequestCount.value = stats.pendingRequests
  }
}

const handleOfflineStateChange = (isOffline: boolean, state: any) => {
  offlineState.value.isOffline = isOffline
  if (state) {
    offlineState.value = state
  }
}

const handleScroll = (scrollTop: number, direction: 'up' | 'down') => {
  scrollPosition.value = scrollTop
  scrollDirection.value = direction
}

const handleVisibleRangeChange = (startIndex: number, endIndex: number) => {
  visibleRange.value = { start: startIndex, end: endIndex }
}

const handleRetryConnection = () => {
  isOfflineSimulated.value = false
  offlineState.value.isOffline = false
}

const handleCancelRequest = (requestId: string) => {
  if (virtualListRef.value) {
    virtualListRef.value.cancelRequest(requestId)
  }
}

const handleRetryRequest = (requestId: string) => {
  if (virtualListRef.value) {
    virtualListRef.value.retryFailedRequest(requestId)
  }
}

const handleDismissOffline = () => {
  // Handle offline indicator dismissal
}

const handleDismissCached = () => {
  // Handle cached indicator dismissal
}

const handleDismissError = () => {
  // Handle error indicator dismissal
}

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString()
}

// Cleanup
onUnmounted(() => {
  if (virtualListRef.value) {
    virtualListRef.value.cancelAllRequests()
  }
})
</script>

<style scoped>
.progressive-loading-demo {
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.demo-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.demo-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.demo-button {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.demo-button:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.demo-button.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.demo-file-list {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 1rem 0;
}

.demo-file-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  gap: 0.75rem;
  transition: background-color 0.15s ease-in-out;
}

.demo-file-item:hover {
  background: #f9fafb;
}

.demo-file-item:last-child {
  border-bottom: none;
}

.demo-file-loading {
  opacity: 0.6;
  background: #f3f4f6;
}

.demo-file-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.demo-file-info {
  flex: 1;
  min-width: 0;
}

.demo-file-name {
  font-weight: 500;
  color: #374151;
  truncate: true;
}

.demo-file-details {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.125rem;
}

.demo-file-spinner {
  flex-shrink: 0;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.demo-density-compact {
  padding: 0.5rem 0.75rem;
}

.demo-density-comfortable {
  padding: 1rem 1.25rem;
}

.demo-stats,
.demo-config {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
}

.demo-stats-title,
.demo-config-title {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.demo-stats-grid,
.demo-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.demo-stat,
.demo-config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.demo-stat-label,
.demo-config-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.demo-stat-value {
  font-weight: 500;
  color: #374151;
}

.demo-config-select,
.demo-config-range {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.demo-config-checkbox {
  width: 1rem;
  height: 1rem;
}

.demo-config-value {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 0.5rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .progressive-loading-demo {
    background: #374151;
    border-color: #4b5563;
  }
  
  .demo-title {
    color: #f3f4f6;
  }
  
  .demo-button {
    background: #4b5563;
    border-color: #6b7280;
    color: #f3f4f6;
  }
  
  .demo-button:hover {
    background: #6b7280;
  }
  
  .demo-file-item {
    border-bottom-color: #4b5563;
  }
  
  .demo-file-item:hover {
    background: #4b5563;
  }
  
  .demo-file-loading {
    background: #4b5563;
  }
  
  .demo-file-name {
    color: #f3f4f6;
  }
  
  .demo-file-details {
    color: #9ca3af;
  }
  
  .demo-stats,
  .demo-config {
    background: #4b5563;
    border-color: #6b7280;
  }
  
  .demo-stats-title,
  .demo-config-title,
  .demo-stat-value {
    color: #f3f4f6;
  }
  
  .demo-stat-label,
  .demo-config-label,
  .demo-config-value {
    color: #9ca3af;
  }
  
  .demo-config-select {
    background: #374151;
    border-color: #6b7280;
    color: #f3f4f6;
  }
}

/* Mobile optimizations */
@media (max-width: 767px) {
  .progressive-loading-demo {
    padding: 0.75rem;
  }
  
  .demo-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .demo-controls {
    justify-content: center;
  }
  
  .demo-stats-grid,
  .demo-config-grid {
    grid-template-columns: 1fr;
  }
  
  .demo-file-item {
    padding: 1rem;
  }
}
</style>