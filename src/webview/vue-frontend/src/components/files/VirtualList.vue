<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :class="{
      'mobile-optimized': isMobile,
      'loading': isLoading,
      'momentum-scrolling': momentumScrolling
    }"
    :style="{ height: containerHeight + 'px' }"
    @scroll="handleScroll"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <!-- Progressive loading indicator -->
    <div 
      v-if="showLoadingIndicator" 
      class="loading-indicator"
      :class="{ 'skeleton-mode': showSkeletons }"
    >
      <div class="loading-spinner" v-if="!showSkeletons">
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <span class="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    </div>

    <div
      class="virtual-list-spacer"
      :style="{ height: totalHeight + 'px' }"
    >
      <!-- Skeleton screens during loading -->
      <div 
        v-if="showSkeletons && skeletonItems.length > 0"
        class="skeleton-container"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="(skeleton, index) in skeletonItems"
          :key="`skeleton-${startIndex + index}`"
          class="skeleton-item"
          :style="{ height: getItemHeight(skeleton) + 'px' }"
        >
          <div class="skeleton-content">
            <div class="skeleton-line skeleton-line-primary"></div>
            <div class="skeleton-line skeleton-line-secondary"></div>
          </div>
        </div>
      </div>

      <!-- Actual content -->
      <div
        v-else
        class="virtual-list-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <slot
          v-for="(item, index) in visibleItems"
          :key="getItemKey(item, startIndex + index)"
          :item="item"
          :index="startIndex + index"
          :is-loading="loadingItems.has(getItemKey(item, startIndex + index))"
        />
      </div>
    </div>

    <!-- Intersection observer targets for progressive loading -->
    <div
      ref="topSentinel"
      class="intersection-sentinel top-sentinel"
      :style="{ transform: `translateY(${Math.max(0, offsetY - dynamicItemHeight)}px)` }"
    ></div>
    <div
      ref="bottomSentinel"
      class="intersection-sentinel bottom-sentinel"
      :style="{ transform: `translateY(${offsetY + visibleHeight + dynamicItemHeight}px)` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'
import { useVirtualScrollCache } from '../../composables/useVirtualScrollCache'
import { useIntersectionObserver } from '../../composables/useIntersectionObserver'
import { virtualScrollPerformanceMonitor } from '../../utils/virtual-scroll-performance'

interface Props {
  items: any[]
  itemHeight: number | 'dynamic'
  containerHeight: number
  overscan?: number
  keyField?: string
  progressiveLoading?: boolean
  pageSize?: number
  preloadDistance?: number
  showSkeletons?: boolean
  momentumScrolling?: boolean
  cacheEnabled?: boolean
  cacheSize?: number
}

interface Emits {
  (e: 'load-more', direction: 'up' | 'down'): void
  (e: 'scroll', scrollTop: number, direction: 'up' | 'down'): void
  (e: 'visible-range-change', startIndex: number, endIndex: number): void
}

const props = withDefaults(defineProps<Props>(), {
  overscan: 5,
  keyField: 'path',
  progressiveLoading: true,
  pageSize: 50,
  preloadDistance: 200,
  showSkeletons: true,
  momentumScrolling: true,
  cacheEnabled: true,
  cacheSize: 1000
})

const emit = defineEmits<Emits>()

// Composables
const breakpoints = useBreakpoints()
const cache = useVirtualScrollCache(props.cacheSize || 1000)

// State
const containerRef = ref<HTMLElement>()
const topSentinel = ref<HTMLElement>()
const bottomSentinel = ref<HTMLElement>()
const scrollTop = ref(0)
const isLoading = ref(false)
const loadingItems = ref(new Set<string | number>())
const lastScrollTop = ref(0)
const scrollDirection = ref<'up' | 'down'>('down')
const itemHeights = ref(new Map<string | number, number>())
const isScrolling = ref(false)
const scrollTimeout = ref<number>()

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const dynamicItemHeight = computed(() => {
  return typeof props.itemHeight === 'number' ? props.itemHeight : 48
})

const totalHeight = computed(() => {
  if (typeof props.itemHeight === 'number') {
    return props.items.length * props.itemHeight
  }
  
  // Calculate total height for dynamic heights
  let height = 0
  for (let i = 0; i < props.items.length; i++) {
    const key = getItemKey(props.items[i], i)
    height += itemHeights.value.get(key) || dynamicItemHeight.value
  }
  return height
})

const startIndex = computed(() => {
  if (typeof props.itemHeight === 'number') {
    const index = Math.floor(scrollTop.value / props.itemHeight) - props.overscan
    return Math.max(0, index)
  }
  
  // Calculate start index for dynamic heights
  let currentHeight = 0
  let index = 0
  
  for (let i = 0; i < props.items.length; i++) {
    const key = getItemKey(props.items[i], i)
    const height = itemHeights.value.get(key) || dynamicItemHeight.value
    
    if (currentHeight + height > scrollTop.value - (props.overscan * dynamicItemHeight.value)) {
      index = i
      break
    }
    currentHeight += height
  }
  
  return Math.max(0, index)
})

const endIndex = computed(() => {
  if (typeof props.itemHeight === 'number') {
    const visibleCount = Math.ceil(props.containerHeight / props.itemHeight)
    const index = startIndex.value + visibleCount + props.overscan * 2
    return Math.min(props.items.length - 1, index)
  }
  
  // Calculate end index for dynamic heights
  let currentHeight = 0
  let index = startIndex.value
  
  // Calculate height up to start index
  for (let i = 0; i < startIndex.value; i++) {
    const key = getItemKey(props.items[i], i)
    currentHeight += itemHeights.value.get(key) || dynamicItemHeight.value
  }
  
  const targetHeight = scrollTop.value + props.containerHeight + (props.overscan * dynamicItemHeight.value)
  
  for (let i = startIndex.value; i < props.items.length; i++) {
    const key = getItemKey(props.items[i], i)
    const height = itemHeights.value.get(key) || dynamicItemHeight.value
    
    if (currentHeight > targetHeight) {
      index = i
      break
    }
    currentHeight += height
    index = i
  }
  
  return Math.min(props.items.length - 1, index)
})

const visibleItems = computed(() => {
  const items = props.items.slice(startIndex.value, endIndex.value + 1)
  
  // Use cache if enabled
  if (props.cacheEnabled) {
    return items.map(item => {
      const key = getItemKey(item, props.items.indexOf(item))
      const cached = cache.get(key)
      return cached || item
    })
  }
  
  return items
})

const offsetY = computed(() => {
  if (typeof props.itemHeight === 'number') {
    return startIndex.value * props.itemHeight
  }
  
  // Calculate offset for dynamic heights
  let offset = 0
  for (let i = 0; i < startIndex.value; i++) {
    const key = getItemKey(props.items[i], i)
    offset += itemHeights.value.get(key) || dynamicItemHeight.value
  }
  return offset
})

const visibleHeight = computed(() => {
  let height = 0
  for (let i = startIndex.value; i <= endIndex.value; i++) {
    if (i < props.items.length) {
      const key = getItemKey(props.items[i], i)
      height += itemHeights.value.get(key) || dynamicItemHeight.value
    }
  }
  return height
})

const showLoadingIndicator = computed(() => {
  return isLoading.value && !props.showSkeletons
})

const skeletonItems = computed(() => {
  if (!props.showSkeletons || !isLoading.value) return []
  
  const count = Math.ceil(props.containerHeight / dynamicItemHeight.value)
  return Array.from({ length: count }, (_, i) => ({
    id: `skeleton-${i}`,
    type: 'skeleton'
  }))
})

// Methods
const handleScroll = (event: Event) => {
  // Record scroll event for performance monitoring
  virtualScrollPerformanceMonitor.recordScrollEvent()
  virtualScrollPerformanceMonitor.startRenderMeasurement()
  
  const target = event.target as HTMLElement
  const newScrollTop = target.scrollTop
  
  // Update scroll direction
  scrollDirection.value = newScrollTop > lastScrollTop.value ? 'down' : 'up'
  lastScrollTop.value = newScrollTop
  scrollTop.value = newScrollTop
  
  // Set scrolling state
  isScrolling.value = true
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  scrollTimeout.value = window.setTimeout(() => {
    isScrolling.value = false
    virtualScrollPerformanceMonitor.endRenderMeasurement()
  }, 150)
  
  // Emit scroll event
  emit('scroll', newScrollTop, scrollDirection.value)
  
  // Handle momentum scrolling on mobile
  if (isMobile.value && props.momentumScrolling) {
    handleMomentumScroll(target)
  }
}

const handleMomentumScroll = (element: HTMLElement) => {
  // Apply CSS for smooth momentum scrolling
  ;(element.style as any).webkitOverflowScrolling = 'touch'
  element.style.overscrollBehavior = 'contain'
}

const handleTouchStart = () => {
  if (isMobile.value) {
    isScrolling.value = true
  }
}

const handleTouchEnd = () => {
  if (isMobile.value) {
    // Delay to allow momentum scrolling to continue
    setTimeout(() => {
      if (!isScrolling.value) {
        handleScrollEnd()
      }
    }, 100)
  }
}

const handleScrollEnd = () => {
  // Trigger any cleanup or optimization after scrolling ends
  if (props.cacheEnabled) {
    cache.cleanup()
  }
}

const getItemKey = (item: any, index: number): string | number => {
  if (props.keyField && item[props.keyField] !== undefined) {
    return item[props.keyField]
  }
  return item.path || item.id || index
}

const getItemHeight = (item: any): number => {
  if (typeof props.itemHeight === 'number') {
    return props.itemHeight
  }
  
  const key = getItemKey(item, props.items.indexOf(item))
  return itemHeights.value.get(key) || dynamicItemHeight.value
}

const setItemHeight = (key: string | number, height: number) => {
  itemHeights.value.set(key, height)
}

const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
  if (!containerRef.value) return
  
  let targetScrollTop = 0
  
  if (typeof props.itemHeight === 'number') {
    targetScrollTop = index * props.itemHeight
  } else {
    // Calculate scroll position for dynamic heights
    for (let i = 0; i < index; i++) {
      const key = getItemKey(props.items[i], i)
      targetScrollTop += itemHeights.value.get(key) || dynamicItemHeight.value
    }
  }
  
  containerRef.value.scrollTo({
    top: targetScrollTop,
    behavior
  })
}

const scrollToItem = (item: any, behavior: ScrollBehavior = 'smooth') => {
  const index = props.items.findIndex(i => 
    props.keyField ? i[props.keyField] === item[props.keyField] : i === item
  )
  if (index >= 0) {
    scrollToIndex(index, behavior)
  }
}

const loadMore = (direction: 'up' | 'down') => {
  if (isLoading.value) return
  
  isLoading.value = true
  emit('load-more', direction)
}

const setLoading = (loading: boolean) => {
  isLoading.value = loading
}

const addLoadingItem = (key: string | number) => {
  loadingItems.value.add(key)
}

const removeLoadingItem = (key: string | number) => {
  loadingItems.value.delete(key)
}

const cacheItem = (key: string | number, item: any) => {
  if (props.cacheEnabled) {
    cache.set(key, item)
  }
}

// Intersection Observer for progressive loading
const { observe: observeTop, unobserve: unobserveTop } = useIntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && props.progressiveLoading) {
        loadMore('up')
      }
    })
  },
  { rootMargin: `${props.preloadDistance}px` }
)

const { observe: observeBottom, unobserve: unobserveBottom } = useIntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && props.progressiveLoading) {
        loadMore('down')
      }
    })
  },
  { rootMargin: `${props.preloadDistance}px` }
)

// Watchers
watch(() => props.containerHeight, () => {
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop
  }
})

watch([startIndex, endIndex], ([newStart, newEnd], [oldStart, oldEnd]) => {
  if (newStart !== oldStart || newEnd !== oldEnd) {
    emit('visible-range-change', newStart, newEnd)
    
    // Update performance metrics
    virtualScrollPerformanceMonitor.updateItemCounts(newEnd - newStart + 1, props.items.length)
  }
})

// Watch cache performance
watch(() => cache.getStats(), (stats) => {
  virtualScrollPerformanceMonitor.updateCacheMetrics(stats.hitRate)
}, { deep: true })

watch(() => props.items.length, (newLength, oldLength) => {
  // Handle items change - useful for progressive loading
  if (newLength > oldLength && isLoading.value) {
    isLoading.value = false
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()
  
  // Start performance monitoring
  virtualScrollPerformanceMonitor.start()
  
  // Set up intersection observers for progressive loading
  if (props.progressiveLoading) {
    if (topSentinel.value) {
      observeTop(topSentinel.value)
    }
    if (bottomSentinel.value) {
      observeBottom(bottomSentinel.value)
    }
  }
  
  // Initialize scroll position
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop
  }
  
  // Update performance metrics
  virtualScrollPerformanceMonitor.updateItemCounts(visibleItems.value.length, props.items.length)
})

onUnmounted(() => {
  // Stop performance monitoring
  virtualScrollPerformanceMonitor.stop()
  
  if (topSentinel.value) {
    unobserveTop(topSentinel.value)
  }
  if (bottomSentinel.value) {
    unobserveBottom(bottomSentinel.value)
  }
  
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
})

// Expose methods
defineExpose({
  scrollToIndex,
  scrollToItem,
  setItemHeight,
  setLoading,
  addLoadingItem,
  removeLoadingItem,
  cacheItem
})
</script>

<style scoped>
.virtual-list-container {
  overflow: auto;
  position: relative;
  will-change: scroll-position;
}

.virtual-list-container.mobile-optimized {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.virtual-list-container.momentum-scrolling {
  scroll-snap-type: y proximity;
}

.virtual-list-container.loading {
  pointer-events: none;
}

.virtual-list-spacer {
  position: relative;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.skeleton-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.skeleton-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.skeleton-content {
  flex: 1;
  space-y: 0.25rem;
}

.skeleton-line {
  height: 0.75rem;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 0.25rem;
}

.skeleton-line-primary {
  width: 60%;
  margin-bottom: 0.25rem;
}

.skeleton-line-secondary {
  width: 40%;
  height: 0.5rem;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.loading-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
}

.loading-spinner {
  display: flex;
  align-items: center;
  color: #6b7280;
}

.intersection-sentinel {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.top-sentinel {
  top: 0;
}

.bottom-sentinel {
  bottom: 0;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .skeleton-line {
    background: linear-gradient(
      90deg,
      #374151 25%,
      #4b5563 50%,
      #374151 75%
    );
  }
  
  .loading-indicator {
    background: rgba(31, 41, 55, 0.9);
  }
  
  .loading-spinner {
    color: #9ca3af;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .skeleton-line {
    background: linear-gradient(
      90deg,
      #d1d5db 25%,
      #9ca3af 50%,
      #d1d5db 75%
    );
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .virtual-list-container.mobile-optimized {
    scroll-behavior: auto;
  }
  
  .skeleton-line {
    animation: none;
    background: #f0f0f0;
  }
  
  @media (prefers-color-scheme: dark) {
    .skeleton-line {
      background: #374151;
    }
  }
}

/* Mobile-specific optimizations */
@media (max-width: 767px) {
  .virtual-list-container {
    /* Optimize for touch scrolling */
    touch-action: pan-y;
    overscroll-behavior-y: contain;
  }
  
  .skeleton-item {
    padding: 0.75rem 1rem;
    min-height: 3rem; /* 48px minimum touch target */
  }
  
  .loading-indicator {
    padding: 1.5rem;
  }
}

/* Performance optimizations */
.virtual-list-container:not(.loading) .virtual-list-content > * {
  contain: layout style paint;
}

.skeleton-item {
  contain: layout style paint;
}
</style>