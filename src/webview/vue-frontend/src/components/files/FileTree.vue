<template>
  <div class="file-tree" :class="{ 'mobile-optimized': isMobile }">
    <VirtualList
      ref="virtualListRef"
      :items="visibleNodes"
      :item-height="itemHeight"
      :container-height="containerHeight"
      :progressive-loading="progressiveLoading"
      :page-size="pageSize"
      :preload-distance="preloadDistance"
      :show-skeletons="showSkeletons"
      :momentum-scrolling="momentumScrolling"
      :cache-enabled="cacheEnabled"
      :cache-size="cacheSize"
      :load-function="loadFunction"
      :base-path="basePath"
      :enable-smart-preloading="enableSmartPreloading"
      v-slot="{ item, isLoading: itemLoading }"
      class="h-full"
      @load-more="handleLoadMore"
      @scroll="handleScroll"
      @visible-range-change="handleVisibleRangeChange"
      @loading-state-change="handleLoadingStateChange"
      @offline-state-change="handleOfflineStateChange"
    >
      <FileTreeNode
        :key="item.path"
        :node="item"
        :level="item.level || 0"
        :is-selected="selectedPath === item.path"
        :is-loading="(loadingPaths?.has(item.path) || false) || itemLoading"
        :density="density"
        @select="$emit('select', item)"
        @expand="$emit('expand', item)"
        @collapse="$emit('collapse', item)"
        @context-menu="$emit('context-menu', $event)"
        @height-change="handleNodeHeightChange"
        @swipe-action="(action: import('../../composables/useFileGestures').FileGestureAction, node: FileSystemNode) => $emit('swipe-action', action, node)"
      />
    </VirtualList>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'
import type { FileSystemNode } from '../../types/filesystem'
import FileTreeNode from './FileTreeNode.vue'
import VirtualList from './VirtualList.vue'

interface Props {
  nodes: FileSystemNode[]
  selectedPath?: string | null
  loadingPaths?: Set<string>
  density?: 'compact' | 'normal' | 'comfortable'
  progressiveLoading?: boolean
  pageSize?: number
  preloadDistance?: number
  showSkeletons?: boolean
  momentumScrolling?: boolean
  cacheEnabled?: boolean
  cacheSize?: number
  loadFunction?: (path: string, startIndex: number, endIndex: number, signal?: AbortSignal) => Promise<FileSystemNode[]>
  basePath?: string
  enableSmartPreloading?: boolean
  showLoadingState?: boolean
}

interface Emits {
  (e: 'select', node: FileSystemNode): void
  (e: 'expand', node: FileSystemNode): void
  (e: 'collapse', node: FileSystemNode): void
  (e: 'context-menu', event: { node: FileSystemNode; x: number; y: number }): void
  (e: 'load-more', direction: 'up' | 'down', currentNodes: FileSystemNode[]): void
  (e: 'scroll', scrollTop: number, direction: 'up' | 'down'): void
  (e: 'visible-range-change', startIndex: number, endIndex: number, visibleNodes: FileSystemNode[]): void
  (e: 'swipe-action', action: import('../../composables/useFileGestures').FileGestureAction, node: FileSystemNode): void
  (e: 'loading-state-change', isLoading: boolean, loadingStats: any): void
  (e: 'offline-state-change', isOffline: boolean, offlineState: any): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedPath: null,
  loadingPaths: () => new Set(),
  density: 'normal',
  progressiveLoading: true,
  pageSize: 50,
  preloadDistance: 200,
  showSkeletons: true,
  momentumScrolling: true,
  cacheEnabled: true,
  cacheSize: 1000,
  basePath: '/',
  enableSmartPreloading: true,
  showLoadingState: true
})

const emit = defineEmits<Emits>()

// Composables
const breakpoints = useBreakpoints()

// State
const containerHeight = ref(400)
const virtualListRef = ref<InstanceType<typeof VirtualList>>()
const nodeHeights = ref(new Map<string, number>())
const isLoadingMore = ref(false)

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const itemHeight = computed(() => {
  switch (props.density) {
    case 'compact':
      return isMobile.value ? 40 : 28
    case 'comfortable':
      return isMobile.value ? 56 : 40
    default: // normal
      return isMobile.value ? 48 : 32
  }
})

const visibleNodes = computed(() => {
  const result: (FileSystemNode & { level: number })[] = []
  
  const processNodes = (nodes: FileSystemNode[], level = 0) => {
    for (const node of nodes) {
      result.push({ ...node, level })
      
      // Add children if node is expanded
      if (node.isExpanded && node.children && node.children.length > 0) {
        processNodes(node.children, level + 1)
      }
    }
  }
  
  processNodes(props.nodes)
  return result
})

// Methods
const updateContainerHeight = () => {
  const element = document.querySelector('.file-tree')
  if (element) {
    const newHeight = element.clientHeight
    if (newHeight !== containerHeight.value) {
      containerHeight.value = newHeight
    }
  }
}

const handleLoadMore = (direction: 'up' | 'down') => {
  if (isLoadingMore.value) return
  
  isLoadingMore.value = true
  emit('load-more', direction, visibleNodes.value)
  
  // Reset loading state after a timeout to prevent infinite loading
  setTimeout(() => {
    isLoadingMore.value = false
  }, 1000)
}

const handleScroll = (scrollTop: number, direction: 'up' | 'down') => {
  emit('scroll', scrollTop, direction)
}

const handleVisibleRangeChange = (startIndex: number, endIndex: number) => {
  const visibleNodesSlice = visibleNodes.value.slice(startIndex, endIndex + 1)
  emit('visible-range-change', startIndex, endIndex, visibleNodesSlice)
}

const handleLoadingStateChange = (isLoading: boolean, loadingStats: any) => {
  emit('loading-state-change', isLoading, loadingStats)
}

const handleOfflineStateChange = (isOffline: boolean, offlineState: any) => {
  emit('offline-state-change', isOffline, offlineState)
}

const handleNodeHeightChange = (nodeId: string, height: number) => {
  nodeHeights.value.set(nodeId, height)
  
  // Update virtual list if using dynamic heights
  if (virtualListRef.value) {
    virtualListRef.value.setItemHeight(nodeId, height)
  }
}

const scrollToNode = (node: FileSystemNode, behavior: ScrollBehavior = 'smooth') => {
  if (virtualListRef.value) {
    virtualListRef.value.scrollToItem(node, behavior)
  }
}

const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
  if (virtualListRef.value) {
    virtualListRef.value.scrollToIndex(index, behavior)
  }
}

const setLoading = (loading: boolean) => {
  if (virtualListRef.value) {
    virtualListRef.value.setLoading(loading)
  }
}

const cacheNode = (node: FileSystemNode) => {
  if (virtualListRef.value && props.cacheEnabled) {
    virtualListRef.value.cacheItem(node.path, node)
  }
}

// Watchers
watch(() => props.nodes, (newNodes) => {
  // Cache new nodes
  if (props.cacheEnabled) {
    newNodes.forEach(node => {
      cacheNode(node)
    })
  }
}, { deep: true })

watch(() => props.density, () => {
  // Clear height cache when density changes
  nodeHeights.value.clear()
})

// Lifecycle
onMounted(() => {
  updateContainerHeight()
  window.addEventListener('resize', updateContainerHeight)
  
  // Initial caching
  if (props.cacheEnabled) {
    props.nodes.forEach(node => {
      cacheNode(node)
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerHeight)
})

// Expose methods
defineExpose({
  scrollToNode,
  scrollToIndex,
  setLoading,
  cacheNode,
  updateContainerHeight,
  // Progressive loading methods
  cancelAllRequests: () => virtualListRef.value?.cancelAllRequests(),
  cancelRequest: (id: string) => virtualListRef.value?.cancelRequest(id),
  retryFailedRequest: (id: string) => virtualListRef.value?.retryFailedRequest(id),
  getLoadingStats: () => virtualListRef.value?.getLoadingStats(),
  getOfflineState: () => virtualListRef.value?.getOfflineState(),
  cacheForOffline: (path: string, items: FileSystemNode[]) => virtualListRef.value?.cacheForOffline(path, items)
})
</script>

<style scoped>
.file-tree {
  height: 100%;
  overflow: hidden;
  position: relative;
}

.file-tree.mobile-optimized {
  /* Mobile-specific optimizations */
  touch-action: pan-y;
  overscroll-behavior: contain;
}

/* Performance optimizations */
.file-tree {
  contain: layout style paint;
  will-change: scroll-position;
}

/* Responsive adjustments */
@media (max-width: 767px) {
  .file-tree {
    /* Ensure proper touch scrolling on mobile */
    -webkit-overflow-scrolling: touch;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .file-tree {
    border: 2px solid currentColor;
  }
}
</style>