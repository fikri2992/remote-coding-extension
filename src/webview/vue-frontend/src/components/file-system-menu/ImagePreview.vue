<template>
  <div class="image-preview h-full flex flex-col">
    <!-- Header -->
    <div v-if="showMetadata" class="image-preview-header p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center space-x-2">
          <span class="text-gray-600 dark:text-gray-400">Image</span>
          <span class="text-gray-400 dark:text-gray-500">•</span>
          <span class="text-gray-600 dark:text-gray-400" v-if="imageInfo.width && imageInfo.height">
            {{ imageInfo.width }} × {{ imageInfo.height }}
          </span>
          <span class="text-gray-400 dark:text-gray-500" v-if="imageInfo.width && imageInfo.height">•</span>
          <span class="text-gray-600 dark:text-gray-400">{{ getFileExtension(alt) }}</span>
        </div>
        <div class="flex items-center space-x-2">
          <button
            v-if="canZoom"
            @click="resetZoom"
            :disabled="zoomLevel === 1"
            class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            @click="downloadImage"
            class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            Download
          </button>
        </div>
      </div>
    </div>

    <!-- Image Container -->
    <div class="image-container flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 relative">
      <div class="image-wrapper p-4 flex items-center justify-center min-h-full">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center">
          <svg class="animate-spin w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400">Loading image...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="hasError" class="text-center">
          <svg class="w-12 h-12 text-red-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p class="text-sm text-red-600 dark:text-red-400 mb-2">Failed to load image</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ alt }}</p>
        </div>

        <!-- Image -->
        <div v-else class="image-display relative">
          <img
            ref="imageElement"
            :src="src"
            :alt="alt"
            :style="imageStyles"
            @load="handleImageLoad"
            @error="handleImageError"
            @wheel="handleWheel"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @mouseleave="handleMouseUp"
            class="max-w-none cursor-grab active:cursor-grabbing transition-transform duration-200"
            :class="{ 'cursor-zoom-in': canZoomIn, 'cursor-zoom-out': canZoomOut }"
            @click="handleImageClick"
          />

          <!-- Zoom Controls -->
          <div v-if="canZoom && !isLoading && !hasError" class="zoom-controls absolute top-4 right-4 flex flex-col space-y-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
            <button
              @click="zoomIn"
              :disabled="zoomLevel >= maxZoom"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              @click="zoomOut"
              :disabled="zoomLevel <= minZoom"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
              </svg>
            </button>
            <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              @click="fitToContainer"
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              title="Fit to Container"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>

          <!-- Zoom Level Indicator -->
          <div v-if="canZoom && zoomLevel !== 1 && !isLoading && !hasError" class="zoom-indicator absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {{ Math.round(zoomLevel * 100) }}%
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ImagePreviewProps } from './types'

// Props
const props = withDefaults(defineProps<ImagePreviewProps>(), {
  showMetadata: true
})

// State
const imageElement = ref<HTMLImageElement>()
const isLoading = ref(true)
const hasError = ref(false)
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartPanX = ref(0)
const dragStartPanY = ref(0)

const imageInfo = ref({
  width: 0,
  height: 0,
  naturalWidth: 0,
  naturalHeight: 0
})

// Constants
const minZoom = 0.1
const maxZoom = 5
const zoomStep = 0.2

// Computed
const canZoom = computed(() => imageInfo.value.naturalWidth > 0 && imageInfo.value.naturalHeight > 0)

const canZoomIn = computed(() => zoomLevel.value < maxZoom)

const canZoomOut = computed(() => zoomLevel.value > minZoom)

const imageStyles = computed(() => {
  const styles: Record<string, string> = {
    transform: `scale(${zoomLevel.value}) translate(${panX.value}px, ${panY.value}px)`,
    transformOrigin: 'center center'
  }

  if (props.maxWidth) {
    styles['maxWidth'] = typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth
  }

  if (props.maxHeight) {
    styles['maxHeight'] = typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight
  }

  return styles
})

// Methods
const handleImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement
  isLoading.value = false
  hasError.value = false
  
  imageInfo.value = {
    width: img.width,
    height: img.height,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight
  }
}

const handleImageError = () => {
  isLoading.value = false
  hasError.value = true
}

const handleWheel = (event: WheelEvent) => {
  if (!canZoom.value) return
  
  event.preventDefault()
  
  const delta = event.deltaY > 0 ? -zoomStep : zoomStep
  const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomLevel.value + delta))
  
  if (newZoom !== zoomLevel.value) {
    zoomLevel.value = newZoom
  }
}

const handleImageClick = (event: MouseEvent) => {
  if (!canZoom.value) return
  
  if (event.detail === 2) { // Double click
    if (zoomLevel.value === 1) {
      zoomLevel.value = 2
    } else {
      resetZoom()
    }
  }
}

const handleMouseDown = (event: MouseEvent) => {
  if (!canZoom.value || zoomLevel.value <= 1) return
  
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragStartPanX.value = panX.value
  dragStartPanY.value = panY.value
  
  event.preventDefault()
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - dragStartX.value
  const deltaY = event.clientY - dragStartY.value
  
  panX.value = dragStartPanX.value + deltaX / zoomLevel.value
  panY.value = dragStartPanY.value + deltaY / zoomLevel.value
}

const handleMouseUp = () => {
  isDragging.value = false
}

const zoomIn = () => {
  if (canZoomIn.value) {
    zoomLevel.value = Math.min(maxZoom, zoomLevel.value + zoomStep)
  }
}

const zoomOut = () => {
  if (canZoomOut.value) {
    zoomLevel.value = Math.max(minZoom, zoomLevel.value - zoomStep)
  }
}

const resetZoom = () => {
  zoomLevel.value = 1
  panX.value = 0
  panY.value = 0
}

const fitToContainer = () => {
  if (!imageElement.value || !canZoom.value) return
  
  const container = imageElement.value.parentElement
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const scaleX = containerRect.width / imageInfo.value.naturalWidth
  const scaleY = containerRect.height / imageInfo.value.naturalHeight
  
  zoomLevel.value = Math.min(scaleX, scaleY, 1)
  panX.value = 0
  panY.value = 0
}

const downloadImage = () => {
  const link = document.createElement('a')
  link.href = props.src
  link.download = props.alt || 'image'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(lastDot + 1).toUpperCase() : 'IMAGE'
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const handleKeydown = (event: KeyboardEvent) => {
  if (!canZoom.value) return
  
  switch (event.key) {
    case '+':
    case '=':
      event.preventDefault()
      zoomIn()
      break
    case '-':
      event.preventDefault()
      zoomOut()
      break
    case '0':
      event.preventDefault()
      resetZoom()
      break
    case 'f':
    case 'F':
      event.preventDefault()
      fitToContainer()
      break
  }
}
</script>

<style scoped>
.image-preview {
  min-height: 0;
}

.image-container {
  min-height: 0;
}

.image-wrapper {
  min-height: 100%;
}

.zoom-controls {
  backdrop-filter: blur(8px);
}

/* Custom cursor styles */
.cursor-zoom-in {
  cursor: zoom-in;
}

.cursor-zoom-out {
  cursor: zoom-out;
}

.cursor-grab {
  cursor: grab;
}

.cursor-grabbing {
  cursor: grabbing;
}

/* Scrollbar styling */
.image-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.image-container::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.image-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.image-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark .image-container::-webkit-scrollbar-track {
  background: #1e293b;
}

.dark .image-container::-webkit-scrollbar-thumb {
  background: #475569;
}

.dark .image-container::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>