<template>
  <div class="loading-state-manager">
    <!-- Offline Indicator -->
    <OfflineIndicator
      v-if="offlineState.isOffline"
      type="offline"
      :title="offlineTitle"
      :subtitle="offlineSubtitle"
      :show-action="true"
      :action-label="offlineActionLabel"
      :action-disabled="isRetrying"
      @action="handleOfflineAction"
      @close="dismissOfflineIndicator"
    />
    
    <!-- Cached Content Indicator -->
    <OfflineIndicator
      v-else-if="showCachedIndicator"
      type="cached"
      :title="cachedTitle"
      :subtitle="cachedSubtitle"
      :show-close="true"
      :is-persistent="false"
      @close="dismissCachedIndicator"
    />
    
    <!-- Syncing Indicator -->
    <OfflineIndicator
      v-else-if="loadingState.isLoading && showSyncIndicator"
      type="syncing"
      :title="syncTitle"
      :subtitle="syncSubtitle"
      :show-progress="true"
      :progress="loadingProgress"
      :show-close="false"
      :is-persistent="true"
    />
    
    <!-- Error Indicator -->
    <OfflineIndicator
      v-else-if="hasErrors"
      type="error"
      :title="errorTitle"
      :subtitle="errorSubtitle"
      :show-action="true"
      :action-label="errorActionLabel"
      :action-disabled="isRetrying"
      @action="handleErrorAction"
      @close="dismissErrorIndicator"
    />
    
    <!-- Loading Progress Bar -->
    <div 
      v-if="showProgressBar"
      class="loading-progress-container"
    >
      <div class="loading-progress-bar">
        <div 
          class="loading-progress-fill"
          :style="{ width: `${loadingProgress}%` }"
        ></div>
      </div>
      <div class="loading-progress-text">
        {{ progressText }}
      </div>
    </div>
    
    <!-- Skeleton Container -->
    <div 
      v-if="showSkeletons && skeletonCount > 0"
      class="skeleton-container"
    >
      <SkeletonFileItem
        v-for="index in skeletonCount"
        :key="`skeleton-${index}`"
        :density="density"
        :is-folder="Math.random() > 0.7"
        :show-details="!isMobile"
        :show-actions="false"
        :level="Math.floor(Math.random() * 3)"
      />
    </div>
    
    <!-- Loading Statistics (Debug Mode) -->
    <div 
      v-if="showDebugStats && debugMode"
      class="loading-debug-stats"
    >
      <h4 class="debug-stats-title">Loading Statistics</h4>
      <div class="debug-stats-grid">
        <div class="debug-stat">
          <span class="debug-stat-label">Total Requests:</span>
          <span class="debug-stat-value">{{ loadingStats.totalRequests }}</span>
        </div>
        <div class="debug-stat">
          <span class="debug-stat-label">Successful:</span>
          <span class="debug-stat-value text-green-600">{{ loadingStats.successfulRequests }}</span>
        </div>
        <div class="debug-stat">
          <span class="debug-stat-label">Failed:</span>
          <span class="debug-stat-value text-red-600">{{ loadingStats.failedRequests }}</span>
        </div>
        <div class="debug-stat">
          <span class="debug-stat-label">Pending:</span>
          <span class="debug-stat-value text-yellow-600">{{ loadingStats.pendingRequests }}</span>
        </div>
        <div class="debug-stat">
          <span class="debug-stat-label">Cache Hit Rate:</span>
          <span class="debug-stat-value">{{ Math.round(loadingStats.cacheHitRate * 100) }}%</span>
        </div>
        <div class="debug-stat">
          <span class="debug-stat-label">Progress:</span>
          <span class="debug-stat-value">{{ Math.round(loadingStats.loadingProgress) }}%</span>
        </div>
      </div>
      
      <!-- Active Requests -->
      <div v-if="loadingState.pendingRequests.size > 0" class="debug-active-requests">
        <h5 class="debug-section-title">Active Requests</h5>
        <div class="debug-request-list">
          <div 
            v-for="[id, request] in loadingState.pendingRequests"
            :key="id"
            class="debug-request-item"
          >
            <span class="debug-request-id">{{ id.slice(-8) }}</span>
            <span class="debug-request-range">{{ request.startIndex }}-{{ request.endIndex }}</span>
            <span class="debug-request-direction">{{ request.direction }}</span>
            <button 
              @click="$emit('cancel-request', id)"
              class="debug-cancel-button"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      
      <!-- Failed Requests -->
      <div v-if="loadingState.failedRequests.size > 0" class="debug-failed-requests">
        <h5 class="debug-section-title">Failed Requests</h5>
        <div class="debug-request-list">
          <div 
            v-for="[id, failure] in loadingState.failedRequests"
            :key="id"
            class="debug-request-item debug-failed-item"
          >
            <span class="debug-request-id">{{ id.slice(-8) }}</span>
            <span class="debug-request-error">{{ failure.error }}</span>
            <span class="debug-request-retries">{{ failure.retryCount }} retries</span>
            <button 
              @click="$emit('retry-request', id)"
              class="debug-retry-button"
              :disabled="failure.retryCount >= 3"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'
import OfflineIndicator from './OfflineIndicator.vue'
import SkeletonFileItem from './SkeletonFileItem.vue'

interface LoadingState {
  isLoading: boolean
  loadingItems: Set<string>
  pendingRequests: Map<string, any>
  completedRequests: Set<string>
  failedRequests: Map<string, { error: string; timestamp: number; retryCount: number }>
  totalItems: number
  loadedItems: number
}

interface OfflineState {
  isOffline: boolean
  lastOnlineTime: number
  queuedRequests: any[]
  offlineCache: Map<string, any[]>
}

interface LoadingStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  pendingRequests: number
  cacheHitRate: number
  loadingProgress: number
}

interface Props {
  loadingState: LoadingState
  offlineState: OfflineState
  loadingStats: LoadingStats
  loadingProgress: number
  showSkeletons: boolean
  skeletonCount: number
  density?: 'compact' | 'normal' | 'comfortable'
  debugMode?: boolean
  showProgressBar?: boolean
  showSyncIndicator?: boolean
  showCachedIndicator?: boolean
  showDebugStats?: boolean
}

interface Emits {
  (e: 'retry-connection'): void
  (e: 'cancel-request', requestId: string): void
  (e: 'retry-request', requestId: string): void
  (e: 'dismiss-offline'): void
  (e: 'dismiss-cached'): void
  (e: 'dismiss-error'): void
}

const props = withDefaults(defineProps<Props>(), {
  density: 'normal',
  debugMode: false,
  showProgressBar: true,
  showSyncIndicator: true,
  showCachedIndicator: true,
  showDebugStats: false
})

const emit = defineEmits<Emits>()

// Composables
const breakpoints = useBreakpoints()

// State
const isRetrying = ref(false)
const dismissedIndicators = ref(new Set<string>())

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const hasErrors = computed(() => {
  return props.loadingStats.failedRequests > 0 && 
         !dismissedIndicators.value.has('error')
})

const offlineTitle = computed(() => {
  if (props.offlineState.queuedRequests.length > 0) {
    return `You're offline (${props.offlineState.queuedRequests.length} queued)`
  }
  return "You're offline"
})

const offlineSubtitle = computed(() => {
  // const lastOnline = new Date(props.offlineState.lastOnlineTime) // Unused
  const timeSince = Date.now() - props.offlineState.lastOnlineTime
  
  if (timeSince < 60000) { // Less than 1 minute
    return 'Just went offline'
  } else if (timeSince < 3600000) { // Less than 1 hour
    const minutes = Math.floor(timeSince / 60000)
    return `Offline for ${minutes} minute${minutes > 1 ? 's' : ''}`
  } else {
    const hours = Math.floor(timeSince / 3600000)
    return `Offline for ${hours} hour${hours > 1 ? 's' : ''}`
  }
})

const offlineActionLabel = computed(() => {
  return isRetrying.value ? 'Retrying...' : 'Retry Connection'
})

const cachedTitle = computed(() => {
  const cacheSize = Array.from(props.offlineState.offlineCache.values())
    .reduce((total, items) => total + items.length, 0)
  return `Showing cached content (${cacheSize} items)`
})

const cachedSubtitle = computed(() => {
  return 'Content may not be up to date'
})

const syncTitle = computed(() => {
  const pendingCount = props.loadingState.pendingRequests.size
  if (pendingCount > 1) {
    return `Loading content (${pendingCount} requests)`
  }
  return 'Loading content'
})

const syncSubtitle = computed(() => {
  const loadedItems = props.loadingState.loadedItems
  const totalItems = props.loadingState.totalItems
  
  if (totalItems > 0) {
    return `${loadedItems} of ${totalItems} items loaded`
  }
  return 'Please wait...'
})

const errorTitle = computed(() => {
  const failedCount = props.loadingStats.failedRequests
  if (failedCount > 1) {
    return `Failed to load content (${failedCount} errors)`
  }
  return 'Failed to load content'
})

const errorSubtitle = computed(() => {
  return 'Check your connection and try again'
})

const errorActionLabel = computed(() => {
  return isRetrying.value ? 'Retrying...' : 'Retry'
})

const progressText = computed(() => {
  const progress = Math.round(props.loadingProgress)
  const pendingCount = props.loadingState.pendingRequests.size
  
  if (pendingCount > 0) {
    return `Loading... ${progress}% (${pendingCount} active)`
  }
  return `Loading... ${progress}%`
})

// Methods
const handleOfflineAction = async () => {
  if (isRetrying.value) return
  
  isRetrying.value = true
  try {
    emit('retry-connection')
    // Wait a bit to show the retry state
    await new Promise(resolve => setTimeout(resolve, 1000))
  } finally {
    isRetrying.value = false
  }
}

const handleErrorAction = async () => {
  if (isRetrying.value) return
  
  isRetrying.value = true
  try {
    // Retry all failed requests
    for (const [id] of props.loadingState.failedRequests) {
      emit('retry-request', id)
    }
    // Wait a bit to show the retry state
    await new Promise(resolve => setTimeout(resolve, 1000))
  } finally {
    isRetrying.value = false
  }
}

const dismissOfflineIndicator = () => {
  dismissedIndicators.value.add('offline')
  emit('dismiss-offline')
}

const dismissCachedIndicator = () => {
  dismissedIndicators.value.add('cached')
  emit('dismiss-cached')
}

const dismissErrorIndicator = () => {
  dismissedIndicators.value.add('error')
  emit('dismiss-error')
}
</script>

<style scoped>
.loading-state-manager {
  position: relative;
}

.loading-progress-container {
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}

.loading-progress-bar {
  width: 100%;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  border-radius: inherit;
  transition: width 0.3s ease-in-out;
  position: relative;
}

.loading-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: progress-shimmer 2s infinite;
}

.loading-progress-text {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

.skeleton-container {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  margin: 0.5rem 0;
}

.loading-debug-stats {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.75rem;
}

.debug-stats-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #374151;
}

.debug-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.debug-stat {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
}

.debug-stat-label {
  color: #6b7280;
}

.debug-stat-value {
  font-weight: 500;
  color: #374151;
}

.debug-section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
  color: #374151;
}

.debug-request-list {
  space-y: 0.25rem;
}

.debug-request-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.debug-request-item:last-child {
  border-bottom: none;
}

.debug-request-id {
  font-family: monospace;
  background: #e5e7eb;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
}

.debug-request-range,
.debug-request-direction {
  font-size: 0.625rem;
  color: #6b7280;
}

.debug-request-error {
  flex: 1;
  font-size: 0.625rem;
  color: #dc2626;
  truncate: true;
}

.debug-request-retries {
  font-size: 0.625rem;
  color: #f59e0b;
}

.debug-cancel-button,
.debug-retry-button {
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  border-radius: 0.25rem;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.debug-cancel-button {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.debug-cancel-button:hover {
  background: #fee2e2;
}

.debug-retry-button {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #0369a1;
}

.debug-retry-button:hover:not(:disabled) {
  background: #e0f2fe;
}

.debug-retry-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.debug-failed-item {
  background: #fef2f2;
  border-radius: 0.25rem;
  padding: 0.375rem;
  margin: 0.25rem 0;
}

@keyframes progress-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .loading-progress-container {
    background: #374151;
    border-color: #4b5563;
  }
  
  .loading-progress-bar {
    background: #4b5563;
  }
  
  .loading-progress-text {
    color: #9ca3af;
  }
  
  .skeleton-container {
    border-color: #4b5563;
  }
  
  .loading-debug-stats {
    background: #374151;
    border-color: #4b5563;
  }
  
  .debug-stats-title,
  .debug-section-title,
  .debug-stat-value {
    color: #f3f4f6;
  }
  
  .debug-stat-label {
    color: #9ca3af;
  }
  
  .debug-request-id {
    background: #4b5563;
    color: #f3f4f6;
  }
  
  .debug-request-range,
  .debug-request-direction {
    color: #9ca3af;
  }
  
  .debug-failed-item {
    background: #450a0a;
  }
}

/* Mobile optimizations */
@media (max-width: 767px) {
  .loading-progress-container {
    padding: 1rem;
    margin: 0.75rem 0;
  }
  
  .loading-debug-stats {
    padding: 1rem;
    font-size: 0.8125rem;
  }
  
  .debug-stats-grid {
    grid-template-columns: 1fr;
  }
  
  .debug-request-item {
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  
  .debug-cancel-button,
  .debug-retry-button {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .loading-progress-fill {
    transition: none;
  }
  
  .loading-progress-fill::after {
    animation: none;
  }
}

/* Performance optimizations */
.loading-state-manager {
  contain: layout style paint;
}

.loading-progress-fill {
  will-change: width;
}
</style>