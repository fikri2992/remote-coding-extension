<template>
  <teleport to="body">
    <transition name="bottom-sheet" appear>
      <div 
        v-if="modelValue" 
        class="bottom-sheet-overlay"
        @click="handleOverlayClick"
        @touchstart="handleOverlayTouchStart"
      >
        <div
          ref="sheetRef"
          class="bottom-sheet-container"
          :class="{ 'sheet-dragging': isDragging }"
          :style="{ transform: `translateY(${sheetTransform}px)` }"
          @click.stop
          @touchstart="handleSheetTouchStart"
          @touchmove="handleSheetTouchMove"
          @touchend="handleSheetTouchEnd"
          @touchcancel="handleSheetTouchCancel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <!-- Drag handle -->
          <div class="bottom-sheet-handle">
            <div class="handle-bar"></div>
          </div>

          <!-- Header -->
          <div v-if="title || file" class="bottom-sheet-header">
            <div class="header-content">
              <div v-if="file" class="file-info">
                <div class="file-icon">
                  <svg
                    v-if="file.type === 'directory'"
                    class="w-6 h-6 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <svg
                    v-else
                    class="w-6 h-6 text-gray-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="file-details">
                  <h3 :id="titleId" class="file-name">{{ file.name }}</h3>
                  <p class="file-path">{{ file.path }}</p>
                </div>
              </div>
              <h3 v-else-if="title" :id="titleId" class="sheet-title">{{ title }}</h3>
            </div>
            
            <button
              v-if="closable"
              @click="close"
              class="close-button touch-friendly"
              aria-label="Close menu"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Actions -->
          <div class="bottom-sheet-content">
            <div class="action-grid">
              <button
                v-for="action in actions"
                :key="action.type"
                class="action-button touch-friendly"
                :class="{ 'destructive': action.type === 'delete' }"
                @click="handleAction(action)"
                :disabled="loading || false"
              >
                <div class="action-icon" :style="{ color: action.color }">
                  {{ action.icon }}
                </div>
                <span class="action-label">{{ action.label }}</span>
              </button>
            </div>

            <!-- Custom content slot -->
            <div v-if="$slots['default']" class="custom-content">
              <slot />
            </div>
          </div>

          <!-- Safe area padding for devices with home indicator -->
          <div class="safe-area-bottom"></div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { FileSystemNode } from '../../types/filesystem'
import type { FileGestureAction } from '../../composables/useFileGestures'

interface Props {
  modelValue: boolean
  title?: string
  file?: FileSystemNode
  actions?: FileGestureAction[]
  closable?: boolean
  closeOnOverlay?: boolean
  loading?: boolean
  hapticFeedback?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'action', action: FileGestureAction): void
  (e: 'close'): void
  (e: 'opened'): void
  (e: 'closed'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  actions: () => [],
  closable: true,
  closeOnOverlay: true,
  loading: false,
  hapticFeedback: true
})

const emit = defineEmits<Emits>()

// State
const sheetRef = ref<HTMLElement>()
const isDragging = ref(false)
const dragStartY = ref(0)
const dragCurrentY = ref(0)
const sheetHeight = ref(0)
const sheetTransform = ref(0)
const dragVelocity = ref(0)
const lastDragTime = ref(0)

// Computed
const titleId = computed(() => `bottom-sheet-title-${Math.random().toString(36).substr(2, 9)}`)

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

const measureSheetHeight = async () => {
  await nextTick()
  if (sheetRef.value) {
    sheetHeight.value = sheetRef.value.offsetHeight
  }
}

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !isDragging.value) {
    close()
  }
}

const handleOverlayTouchStart = (event: TouchEvent) => {
  // Prevent overlay touch from interfering with sheet dragging
  if (sheetRef.value?.contains(event.target as Node)) {
    return
  }
  
  if (props.closeOnOverlay) {
    close()
  }
}

const handleSheetTouchStart = (event: TouchEvent) => {
  if (event.touches.length !== 1) return
  
  const touch = event.touches[0]!
  dragStartY.value = touch.clientY
  dragCurrentY.value = touch.clientY
  lastDragTime.value = Date.now()
  isDragging.value = true
  
  // Only allow dragging from the handle area or header
  const target = event.target as HTMLElement
  const isHandle = target.closest('.bottom-sheet-handle')
  const isHeader = target.closest('.bottom-sheet-header')
  
  if (!isHandle && !isHeader) {
    isDragging.value = false
  }
}

const handleSheetTouchMove = (event: TouchEvent) => {
  if (!isDragging.value || event.touches.length !== 1) return
  
  event.preventDefault()
  
  const touch = event.touches[0]!
  const deltaY = touch.clientY - dragStartY.value
  const now = Date.now()
  const timeDelta = now - lastDragTime.value
  
  // Calculate velocity
  if (timeDelta > 0) {
    dragVelocity.value = (touch.clientY - dragCurrentY.value) / timeDelta
  }
  
  dragCurrentY.value = touch.clientY
  lastDragTime.value = now
  
  // Only allow downward dragging
  if (deltaY > 0) {
    // Apply resistance as user drags further
    const resistance = Math.max(0.1, 1 - (deltaY / sheetHeight.value) * 0.5)
    sheetTransform.value = deltaY * resistance
  } else {
    sheetTransform.value = 0
  }
}

const handleSheetTouchEnd = () => {
  if (!isDragging.value) return
  
  const dragDistance = sheetTransform.value
  const dragThreshold = sheetHeight.value * 0.3
  const velocityThreshold = 0.5
  
  // Determine if sheet should be dismissed
  const shouldDismiss = dragDistance > dragThreshold || dragVelocity.value > velocityThreshold
  
  if (shouldDismiss) {
    triggerHapticFeedback('light')
    close()
  } else {
    // Snap back to original position
    sheetTransform.value = 0
  }
  
  isDragging.value = false
  dragVelocity.value = 0
}

const handleSheetTouchCancel = () => {
  isDragging.value = false
  sheetTransform.value = 0
  dragVelocity.value = 0
}

const handleAction = async (action: FileGestureAction) => {
  if (props.loading) return
  
  // Trigger haptic feedback
  if (action.haptic) {
    const hapticType = action.haptic.type === 'selection' || action.haptic.type === 'impact' || action.haptic.type === 'notification' 
      ? 'medium' 
      : action.haptic.type
    await triggerHapticFeedback(hapticType)
  }
  
  emit('action', action)
  
  // Close sheet after action (always close for now)
  close()
}

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.modelValue) {
    close()
  }
}

// Handle body scroll lock
const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.width = '100%'
}

const unlockBodyScroll = () => {
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.width = ''
}

// Watch for modal open/close
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    lockBodyScroll()
    await measureSheetHeight()
    emit('opened')
  } else {
    unlockBodyScroll()
    sheetTransform.value = 0
    emit('closed')
  }
})

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  if (props.modelValue) {
    lockBodyScroll()
    measureSheetHeight()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  unlockBodyScroll()
})
</script>

<style scoped>
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  touch-action: none;
}

.bottom-sheet-container {
  width: 100%;
  max-width: 100vw;
  background: white;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  will-change: transform;
}

.sheet-dragging {
  transition: none;
}

.bottom-sheet-handle {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0 0.5rem 0;
  cursor: grab;
}

.sheet-dragging .bottom-sheet-handle {
  cursor: grabbing;
}

.handle-bar {
  width: 36px;
  height: 4px;
  background: #d1d5db;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.bottom-sheet-handle:hover .handle-bar,
.sheet-dragging .handle-bar {
  background: #9ca3af;
}

.bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-icon {
  flex-shrink: 0;
}

.file-details {
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  truncate: true;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-button {
  flex-shrink: 0;
  padding: 0.5rem;
  margin: -0.5rem -0.5rem -0.5rem 0.5rem;
  color: #6b7280;
  background: none;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-button:hover {
  color: #374151;
  background: #f3f4f6;
}

.close-button:active {
  transform: scale(0.95);
}

.bottom-sheet-content {
  flex: 1;
  padding: 1rem 1.5rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  min-height: 80px;
  text-align: center;
}

.action-button:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-button:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-button.destructive {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.action-button.destructive:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.action-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  line-height: 1;
}

.action-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  line-height: 1.2;
}

.destructive .action-label {
  color: #dc2626;
}

.custom-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f3f4f6;
}

.safe-area-bottom {
  height: env(safe-area-inset-bottom, 0);
  min-height: 1rem;
}

.touch-friendly {
  min-width: 44px;
  min-height: 44px;
}

/* Transition animations */
.bottom-sheet-enter-active,
.bottom-sheet-leave-active {
  transition: opacity 0.3s ease;
}

.bottom-sheet-enter-active .bottom-sheet-container,
.bottom-sheet-leave-active .bottom-sheet-container {
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.bottom-sheet-enter-from,
.bottom-sheet-leave-to {
  opacity: 0;
}

.bottom-sheet-enter-from .bottom-sheet-container,
.bottom-sheet-leave-to .bottom-sheet-container {
  transform: translateY(100%);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .bottom-sheet-container {
    background: #1f2937;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
  }
  
  .handle-bar {
    background: #4b5563;
  }
  
  .bottom-sheet-handle:hover .handle-bar,
  .sheet-dragging .handle-bar {
    background: #6b7280;
  }
  
  .bottom-sheet-header {
    border-bottom-color: #374151;
  }
  
  .file-name,
  .sheet-title {
    color: #f9fafb;
  }
  
  .file-path {
    color: #9ca3af;
  }
  
  .close-button {
    color: #9ca3af;
  }
  
  .close-button:hover {
    color: #d1d5db;
    background: #374151;
  }
  
  .action-button {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }
  
  .action-button:hover {
    background: #4b5563;
    border-color: #6b7280;
  }
  
  .action-button.destructive {
    background: #7f1d1d;
    border-color: #991b1b;
    color: #fca5a5;
  }
  
  .action-button.destructive:hover {
    background: #991b1b;
    border-color: #b91c1c;
  }
  
  .action-label {
    color: #f9fafb;
  }
  
  .destructive .action-label {
    color: #fca5a5;
  }
  
  .custom-content {
    border-top-color: #374151;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .bottom-sheet-container {
    border: 2px solid currentColor;
  }
  
  .action-button {
    border-width: 2px;
  }
  
  .action-button.destructive {
    border-color: #dc2626;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .bottom-sheet-container,
  .action-button,
  .close-button {
    transition: none;
  }
  
  .bottom-sheet-enter-active,
  .bottom-sheet-leave-active,
  .bottom-sheet-enter-active .bottom-sheet-container,
  .bottom-sheet-leave-active .bottom-sheet-container {
    transition: none;
  }
}

/* Landscape orientation adjustments */
@media (orientation: landscape) and (max-height: 500px) {
  .bottom-sheet-container {
    max-height: 90vh;
    border-radius: 12px 12px 0 0;
  }
  
  .action-grid {
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
    gap: 0.75rem;
  }
  
  .action-button {
    min-height: 70px;
    padding: 0.75rem 0.5rem;
  }
  
  .action-icon {
    font-size: 1.25rem;
    margin-bottom: 0.375rem;
  }
  
  .action-label {
    font-size: 0.75rem;
  }
}

/* Large screens - center the sheet */
@media (min-width: 768px) {
  .bottom-sheet-overlay {
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  
  .bottom-sheet-container {
    max-width: 480px;
    border-radius: 16px;
    max-height: 70vh;
  }
  
  .action-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>