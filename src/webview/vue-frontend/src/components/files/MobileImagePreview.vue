<template>
  <div class="mobile-image-preview relative w-full h-full overflow-hidden bg-black">
    <!-- Image Container -->
    <div
      ref="imageContainer"
      class="image-container absolute inset-0 flex items-center justify-center"
      :style="containerStyle"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @wheel="handleWheel"
    >
      <img
        ref="imageElement"
        :src="imageDataUrl"
        :alt="fileName"
        class="max-w-none max-h-none"
        :style="imageStyle"
        @load="handleImageLoad"
        @error="handleImageError"
        @dragstart.prevent
      />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
      <div class="text-white text-center">
        <svg class="w-8 h-8 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <p>Loading image...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="absolute inset-0 flex items-center justify-center">
      <div class="text-white text-center p-4">
        <svg class="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-lg font-semibold mb-2">Failed to load image</h3>
        <p class="text-gray-300">{{ error }}</p>
      </div>
    </div>

    <!-- Zoom Controls -->
    <div
      v-if="!isLoading && !error"
      class="zoom-controls absolute bottom-4 right-4 flex flex-col space-y-2 bg-black bg-opacity-60 rounded-lg p-2"
    >
      <button
        @click="zoomIn"
        :disabled="scale >= maxScale"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Zoom in"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      
      <button
        @click="resetZoom"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded text-xs"
        aria-label="Reset zoom"
      >
        {{ Math.round(scale * 100) }}%
      </button>
      
      <button
        @click="zoomOut"
        :disabled="scale <= minScale"
        class="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Zoom out"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
        </svg>
      </button>
    </div>

    <!-- Image Info -->
    <div
      v-if="imageInfo && !isLoading && !error"
      class="image-info absolute top-4 left-4 bg-black bg-opacity-60 text-white text-sm rounded-lg px-3 py-2"
    >
      {{ imageInfo.width }} × {{ imageInfo.height }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useHapticFeedback } from '../../composables/useHapticFeedback'
import type { GestureComposable } from '../../types/gestures'

interface Props {
  filePath?: string | null
  fileContent?: string | null
  gestures?: GestureComposable
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Composables
const haptic = useHapticFeedback()

// Refs
const imageContainer = ref<HTMLElement | null>(null)
const imageElement = ref<HTMLImageElement | null>(null)

// State
const isLoading = ref(true)
const error = ref<string | null>(null)
const imageDataUrl = ref<string | null>(null)
const imageInfo = ref<{ width: number; height: number } | null>(null)

// Transform state
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const rotation = ref(0)

// Gesture state
const isGesturing = ref(false)
const lastTouchDistance = ref(0)
const lastTouchCenter = ref({ x: 0, y: 0 })
const initialTouchCenter = ref({ x: 0, y: 0 })
const initialScale = ref(1)
const initialTranslate = ref({ x: 0, y: 0 })

// Configuration
const minScale = 0.5
const maxScale = 5.0
const zoomStep = 0.5
const panSensitivity = 1.0
const doubleTapZoomLevel = 2.0

// Computed
const fileName = computed(() => {
  if (!props.filePath) return ''
  return props.filePath.split('/').pop() || ''
})

const containerStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  transformOrigin: 'center center',
  transition: isGesturing.value ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
}))

const imageStyle = computed(() => {
  if (!imageInfo.value) return {}
  
  // Calculate initial fit-to-screen size
  const containerWidth = window.innerWidth
  const containerHeight = window.innerHeight - 120 // Account for header
  
  const scaleToFitWidth = containerWidth / imageInfo.value.width
  const scaleToFitHeight = containerHeight / imageInfo.value.height
  const scaleToFit = Math.min(scaleToFitWidth, scaleToFitHeight, 1)
  
  return {
    width: `${imageInfo.value.width}px`,
    height: `${imageInfo.value.height}px`,
    transform: `scale(${scaleToFit})`
  }
})

// Methods
const loadImage = async () => {
  if (!props.filePath || !props.fileContent) return

  isLoading.value = true
  error.value = null

  try {
    // For now, create a data URL from the file content
    // In a real implementation, you'd handle different image formats properly
    const extension = props.filePath.split('.').pop()?.toLowerCase()
    const mimeType = getMimeType(extension || '')
    
    // Convert base64 content to data URL
    imageDataUrl.value = `data:${mimeType};base64,${btoa(props.fileContent)}`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load image'
  } finally {
    isLoading.value = false
  }
}

const getMimeType = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon'
  }
  return mimeTypes[extension] || 'image/png'
}

const handleImageLoad = () => {
  if (!imageElement.value) return

  imageInfo.value = {
    width: imageElement.value.naturalWidth,
    height: imageElement.value.naturalHeight
  }

  isLoading.value = false
  resetTransform()
}

const handleImageError = () => {
  error.value = 'Failed to load image'
  isLoading.value = false
}

// Transform methods
const resetTransform = () => {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
  rotation.value = 0
}

const resetZoom = () => {
  resetTransform()
  haptic.light()
}

const zoomIn = () => {
  const newScale = Math.min(scale.value + zoomStep, maxScale)
  if (newScale !== scale.value) {
    scale.value = newScale
    haptic.light()
  }
}

const zoomOut = () => {
  const newScale = Math.max(scale.value - zoomStep, minScale)
  if (newScale !== scale.value) {
    scale.value = newScale
    haptic.light()
  }
}

const zoomToPoint = (newScale: number, centerX: number, centerY: number) => {
  const boundedScale = Math.max(minScale, Math.min(maxScale, newScale))
  
  if (boundedScale === scale.value) return

  // Calculate new translation to keep the zoom centered on the touch point
  const scaleRatio = boundedScale / scale.value
  const newTranslateX = centerX - (centerX - translateX.value) * scaleRatio
  const newTranslateY = centerY - (centerY - translateY.value) * scaleRatio

  scale.value = boundedScale
  translateX.value = newTranslateX
  translateY.value = newTranslateY

  constrainPan()
}

const constrainPan = () => {
  if (!imageInfo.value) return

  const containerWidth = window.innerWidth
  const containerHeight = window.innerHeight - 120
  
  const imageWidth = imageInfo.value.width * scale.value
  const imageHeight = imageInfo.value.height * scale.value

  // Calculate maximum translation bounds
  const maxTranslateX = Math.max(0, (imageWidth - containerWidth) / 2)
  const maxTranslateY = Math.max(0, (imageHeight - containerHeight) / 2)

  translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX.value))
  translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY.value))
}

// Touch event handlers
const handleTouchStart = (event: TouchEvent) => {
  event.preventDefault()
  
  if (event.touches.length === 1) {
    // Single touch - prepare for pan
    const touch = event.touches[0]!
    lastTouchCenter.value = { x: touch.clientX, y: touch.clientY }
    initialTouchCenter.value = { x: touch.clientX, y: touch.clientY }
    initialTranslate.value = { x: translateX.value, y: translateY.value }
  } else if (event.touches.length === 2) {
    // Two touches - prepare for pinch/zoom
    isGesturing.value = true
    
    const touch1 = event.touches[0]!
    const touch2 = event.touches[1]!
    
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
    
    const centerX = (touch1.clientX + touch2.clientX) / 2
    const centerY = (touch1.clientY + touch2.clientY) / 2
    
    lastTouchDistance.value = distance
    lastTouchCenter.value = { x: centerX, y: centerY }
    initialScale.value = scale.value
    initialTranslate.value = { x: translateX.value, y: translateY.value }
  }
}

const handleTouchMove = (event: TouchEvent) => {
  event.preventDefault()
  
  if (event.touches.length === 1 && !isGesturing.value) {
    // Single touch - pan
    const touch = event.touches[0]!
    const deltaX = (touch.clientX - lastTouchCenter.value.x) * panSensitivity
    const deltaY = (touch.clientY - lastTouchCenter.value.y) * panSensitivity
    
    translateX.value = initialTranslate.value.x + (touch.clientX - initialTouchCenter.value.x)
    translateY.value = initialTranslate.value.y + (touch.clientY - initialTouchCenter.value.y)
    
    constrainPan()
    
    lastTouchCenter.value = { x: touch.clientX, y: touch.clientY }
  } else if (event.touches.length === 2) {
    // Two touches - pinch/zoom
    const touch1 = event.touches[0]!
    const touch2 = event.touches[1]!
    
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
    
    const centerX = (touch1.clientX + touch2.clientX) / 2
    const centerY = (touch1.clientY + touch2.clientY) / 2
    
    if (lastTouchDistance.value > 0) {
      const scaleChange = distance / lastTouchDistance.value
      const newScale = initialScale.value * scaleChange
      
      zoomToPoint(newScale, centerX, centerY)
    }
    
    lastTouchDistance.value = distance
    lastTouchCenter.value = { x: centerX, y: centerY }
  }
}

const handleTouchEnd = (event: TouchEvent) => {
  if (event.touches.length === 0) {
    isGesturing.value = false
    lastTouchDistance.value = 0
    
    // Check for double tap
    const now = Date.now()
    const timeSinceLastTap = now - (handleTouchEnd as any).lastTapTime || 0
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      const touch = event.changedTouches[0]!
      handleDoubleTap(touch.clientX, touch.clientY)
    }
    
    ;(handleTouchEnd as any).lastTapTime = now
  }
}

const handleDoubleTap = (x: number, y: number) => {
  if (scale.value > 1) {
    // Zoom out to fit
    resetZoom()
  } else {
    // Zoom in to double tap point
    zoomToPoint(doubleTapZoomLevel, x, y)
  }
  
  haptic.medium()
}

// Mouse wheel support for desktop
const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.max(minScale, Math.min(maxScale, scale.value + delta))
  
  zoomToPoint(newScale, event.clientX, event.clientY)
}

// Watchers
watch(() => props.filePath, () => {
  if (props.filePath) {
    loadImage()
  }
})

watch(() => props.fileContent, () => {
  if (props.fileContent) {
    loadImage()
  }
})

// Lifecycle
onMounted(() => {
  if (props.filePath && props.fileContent) {
    loadImage()
  }
})

onUnmounted(() => {
  // Cleanup
})
</script>

<style scoped>
.mobile-image-preview {
  /* Prevent overscroll */
  overscroll-behavior: none;
  
  /* Hardware acceleration */
  transform: translateZ(0);
  will-change: transform;
}

.image-container {
  /* Smooth transforms */
  will-change: transform;
}

.image-container img {
  /* Prevent image dragging */
  pointer-events: none;
  
  /* Smooth rendering */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.zoom-controls {
  /* Safe area support */
  bottom: max(1rem, env(safe-area-inset-bottom));
  right: max(1rem, env(safe-area-inset-right));
}

.image-info {
  /* Safe area support */
  top: max(1rem, env(safe-area-inset-top));
  left: max(1rem, env(safe-area-inset-left));
}

/* Prevent text selection during gestures */
.mobile-image-preview * {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
</style>