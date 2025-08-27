<template>
  <teleport to="body">
    <transition name="modal" appear>
      <div v-if="modelValue" class="modal-overlay" @click="handleOverlayClick">
        <div
          class="modal-container"
          :class="modalSizeClass"
          @click.stop
          role="dialog"
          :aria-labelledby="titleId"
          :aria-describedby="contentId"
          aria-modal="true"
        >
          <!-- Header -->
          <div v-if="showHeader" class="modal-header">
            <div class="modal-title-section">
              <h2 v-if="title" :id="titleId" class="modal-title">{{ title }}</h2>
              <slot name="title" />
            </div>
            
            <button
              v-if="closable"
              @click="close"
              class="modal-close-btn"
              aria-label="Close modal"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <!-- Content -->
          <div :id="contentId" class="modal-content" :class="contentClass">
            <slot />
          </div>
          
          <!-- Footer -->
          <div v-if="showFooter" class="modal-footer">
            <slot name="footer">
              <div class="modal-default-footer">
                <button
                  v-if="showCancel"
                  @click="cancel"
                  class="btn-secondary"
                  :disabled="loading || false"
                >
                  {{ cancelText }}
                </button>
                <button
                  v-if="showConfirm"
                  @click="confirm"
                  class="btn-primary"
                  :disabled="loading || false"
                >
                  <LoadingSpinner v-if="loading" size="sm" color="white" />
                  <span v-else>{{ confirmText }}</span>
                </button>
              </div>
            </slot>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import LoadingSpinner from './LoadingSpinner.vue'

interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  showHeader?: boolean
  showFooter?: boolean
  showCancel?: boolean
  showConfirm?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  persistent?: boolean
  contentClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  closable: true,
  closeOnOverlay: true,
  closeOnEscape: true,
  showHeader: true,
  showFooter: false,
  showCancel: true,
  showConfirm: true,
  cancelText: 'Cancel',
  confirmText: 'Confirm',
  loading: false,
  persistent: false,
  contentClass: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  cancel: []
  confirm: []
  opened: []
  closed: []
}>()

const titleId = computed(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`)
const contentId = computed(() => `modal-content-${Math.random().toString(36).substr(2, 9)}`)

const modalSizeClass = computed(() => {
  const sizeClasses = {
    sm: 'modal-sm',
    md: 'modal-md',
    lg: 'modal-lg',
    xl: 'modal-xl',
    full: 'modal-full'
  }
  return sizeClasses[props.size]
})

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !props.persistent) {
    close()
  }
}

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.closeOnEscape && !props.persistent) {
    close()
  }
}

const close = () => {
  if (props.loading && props.persistent) return
  
  emit('update:modelValue', false)
  emit('close')
}

const cancel = () => {
  emit('cancel')
  if (!props.persistent) {
    close()
  }
}

const confirm = () => {
  emit('confirm')
}

// Handle body scroll lock
const lockBodyScroll = () => {
  document.body.style.overflow = 'hidden'
}

const unlockBodyScroll = () => {
  document.body.style.overflow = ''
}

// Watch for modal open/close
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    lockBodyScroll()
    emit('opened')
  } else {
    unlockBodyScroll()
    emit('closed')
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  if (props.modelValue) {
    lockBodyScroll()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  unlockBodyScroll()
})
</script>

<style scoped>
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50;
}

.modal-container {
  @apply bg-white rounded-lg shadow-xl max-h-full flex flex-col;
}

.modal-sm {
  @apply w-full max-w-sm;
}

.modal-md {
  @apply w-full max-w-md;
}

.modal-lg {
  @apply w-full max-w-2xl;
}

.modal-xl {
  @apply w-full max-w-4xl;
}

.modal-full {
  @apply w-full h-full max-w-none rounded-none;
}

.modal-header {
  @apply flex items-center justify-between p-6 border-b border-gray-200;
}

.modal-title-section {
  @apply flex-1;
}

.modal-title {
  @apply text-lg font-semibold text-gray-900;
}

.modal-close-btn {
  @apply p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded;
}

.modal-content {
  @apply flex-1 p-6 overflow-y-auto;
}

.modal-footer {
  @apply p-6 border-t border-gray-200;
}

.modal-default-footer {
  @apply flex justify-end gap-3;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-20;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed;
}

/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9) translateY(-20px);
}
</style>