<template>
  <div 
    ref="containerRef"
    class="mobile-swipe-container"
    :class="{ 'swipe-revealed': isRevealed }"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <!-- Left swipe actions -->
    <div 
      v-if="leftActions.length > 0"
      class="swipe-actions swipe-actions-left"
      :style="{ transform: `translateX(${leftActionsTransform}px)` }"
    >
      <button
        v-for="action in leftActions"
        :key="action.type"
        class="swipe-action-button touch-friendly"
        :style="{ backgroundColor: action.color }"
        @click="executeAction(action)"
        :aria-label="action.label"
      >
        <span class="swipe-action-icon">{{ action.icon }}</span>
        <span class="swipe-action-label">{{ action.label }}</span>
      </button>
    </div>

    <!-- Right swipe actions -->
    <div 
      v-if="rightActions.length > 0"
      class="swipe-actions swipe-actions-right"
      :style="{ transform: `translateX(${rightActionsTransform}px)` }"
    >
      <button
        v-for="action in rightActions"
        :key="action.type"
        class="swipe-action-button touch-friendly"
        :style="{ backgroundColor: action.color }"
        @click="executeAction(action)"
        :aria-label="action.label"
      >
        <span class="swipe-action-icon">{{ action.icon }}</span>
        <span class="swipe-action-label">{{ action.label }}</span>
      </button>
    </div>

    <!-- Main content -->
    <div 
      class="swipe-content"
      :style="{ transform: `translateX(${contentTransform}px)` }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FileGestureAction } from '../../composables/useFileGestures'

interface Props {
  leftActions?: FileGestureAction[]
  rightActions?: FileGestureAction[]
  swipeThreshold?: number
  maxSwipeDistance?: number
  snapBackDuration?: number
  hapticFeedback?: boolean
}

interface Emits {
  (e: 'action', action: FileGestureAction): void
  (e: 'swipe-start'): void
  (e: 'swipe-end'): void
  (e: 'reveal-change', revealed: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  swipeThreshold: 60,
  maxSwipeDistance: 120,
  snapBackDuration: 250,
  hapticFeedback: true
})

// Ensure arrays are always defined
const leftActions = computed(() => props.leftActions || [])
const rightActions = computed(() => props.rightActions || [])

const emit = defineEmits<Emits>()

// State
const containerRef = ref<HTMLElement>()
const isRevealed = ref(false)
const swipeDistance = ref(0)
const isSwipeActive = ref(false)
const swipeDirection = ref<'left' | 'right' | null>(null)

// Touch tracking
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchCurrentX = ref(0)
const lastTouchTime = ref(0)

// Computed
const contentTransform = computed(() => {
  if (!isSwipeActive.value) return 0
  
  // Apply resistance when swiping beyond threshold
  const distance = swipeDistance.value
  const threshold = props.swipeThreshold
  const maxDistance = props.maxSwipeDistance
  
  if (Math.abs(distance) <= threshold) {
    return distance
  }
  
  // Apply elastic resistance beyond threshold
  const excess = Math.abs(distance) - threshold
  const resistance = 1 - Math.min(excess / (maxDistance - threshold), 0.8)
  const sign = distance > 0 ? 1 : -1
  
  return sign * (threshold + excess * resistance)
})

const leftActionsTransform = computed(() => {
  if (swipeDirection.value !== 'right' || swipeDistance.value <= 0) return -props.maxSwipeDistance
  
  const progress = Math.min(swipeDistance.value / props.swipeThreshold, 1)
  return -props.maxSwipeDistance + (progress * props.maxSwipeDistance)
})

const rightActionsTransform = computed(() => {
  if (swipeDirection.value !== 'left' || swipeDistance.value >= 0) return props.maxSwipeDistance
  
  const progress = Math.min(Math.abs(swipeDistance.value) / props.swipeThreshold, 1)
  return props.maxSwipeDistance - (progress * props.maxSwipeDistance)
})

// Methods
const triggerHapticFeedback = async (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (!props.hapticFeedback) return
  
  try {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 50
      }
      navigator.vibrate(patterns[type])
    }
  } catch (error) {
    // Haptic feedback not supported, fail silently
  }
}

const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length !== 1) return
  
  const touch = event.touches[0]!
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchCurrentX.value = touch.clientX
  lastTouchTime.value = Date.now()
  
  isSwipeActive.value = true
  emit('swipe-start')
}

const handleTouchMove = (event: TouchEvent) => {
  if (!isSwipeActive.value || event.touches.length !== 1) return
  
  event.preventDefault()
  
  const touch = event.touches[0]!
  touchCurrentX.value = touch.clientX
  
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  
  // Only process horizontal swipes
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    return
  }
  
  swipeDistance.value = deltaX
  
  // Determine swipe direction
  if (Math.abs(deltaX) > 10) {
    swipeDirection.value = deltaX > 0 ? 'right' : 'left'
  }
  
  // Trigger haptic feedback at threshold
  if (Math.abs(deltaX) >= props.swipeThreshold && !isRevealed.value) {
    triggerHapticFeedback('light')
    isRevealed.value = true
    emit('reveal-change', true)
  }
}

const handleTouchEnd = (_event: TouchEvent) => {
  if (!isSwipeActive.value) return
  
  const deltaX = touchCurrentX.value - touchStartX.value
  const deltaTime = Date.now() - lastTouchTime.value
  const velocity = Math.abs(deltaX) / deltaTime
  
  // Determine if swipe should trigger action
  const shouldTrigger = Math.abs(deltaX) >= props.swipeThreshold || velocity > 0.5
  
  if (shouldTrigger) {
    const actions = deltaX > 0 ? leftActions.value : rightActions.value
    
    if (actions.length === 1) {
      // Single action - execute immediately
      executeAction(actions[0]!)
    } else if (actions.length > 1) {
      // Multiple actions - keep revealed for selection
      triggerHapticFeedback('medium')
      return
    }
  }
  
  // Snap back to original position
  snapBack()
}

const handleTouchCancel = () => {
  snapBack()
}

const snapBack = () => {
  isSwipeActive.value = false
  swipeDistance.value = 0
  swipeDirection.value = null
  
  if (isRevealed.value) {
    isRevealed.value = false
    emit('reveal-change', false)
  }
  
  emit('swipe-end')
}

const executeAction = async (action: FileGestureAction) => {
  // Trigger haptic feedback
  if (action.haptic) {
    const hapticType = action.haptic.type === 'selection' || action.haptic.type === 'impact' || action.haptic.type === 'notification' 
      ? 'medium' 
      : action.haptic.type
    await triggerHapticFeedback(hapticType)
  }
  
  emit('action', action)
  snapBack()
}

// Handle clicks outside to close revealed actions
const handleClickOutside = (event: Event) => {
  if (isRevealed.value && containerRef.value && !containerRef.value.contains(event.target as Node)) {
    snapBack()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Expose methods for parent components
defineExpose({
  snapBack,
  isRevealed: computed(() => isRevealed.value)
})
</script>

<style scoped>
.mobile-swipe-container {
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.swipe-actions {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  z-index: 1;
  min-width: 120px;
}

.swipe-actions-left {
  left: 0;
  justify-content: flex-start;
  padding-left: 0.5rem;
}

.swipe-actions-right {
  right: 0;
  justify-content: flex-end;
  padding-right: 0.5rem;
}

.swipe-action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0.5rem;
  margin: 0 0.25rem;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.swipe-action-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.swipe-action-button:active {
  transform: scale(0.95);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.swipe-action-icon {
  font-size: 1.25rem;
  margin-bottom: 0.125rem;
  line-height: 1;
}

.swipe-action-label {
  font-size: 0.625rem;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.swipe-content {
  position: relative;
  z-index: 2;
  background: inherit;
  transition: transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  will-change: transform;
}

.swipe-revealed .swipe-content {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Touch-friendly sizing */
.touch-friendly {
  min-width: 44px;
  min-height: 44px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .swipe-action-button {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  .swipe-action-button:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
  }
  
  .swipe-revealed .swipe-content {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .swipe-action-button {
    border: 2px solid rgba(255, 255, 255, 0.3);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .swipe-action-button,
  .swipe-content {
    transition: none;
  }
}

/* Landscape orientation adjustments */
@media (orientation: landscape) and (max-height: 500px) {
  .swipe-action-button {
    min-width: 40px;
    min-height: 40px;
    padding: 0.375rem;
  }
  
  .swipe-action-icon {
    font-size: 1rem;
  }
  
  .swipe-action-label {
    font-size: 0.5rem;
  }
}
</style>