<template>
  <teleport to="body">
    <transition name="mobile-dialog" appear>
      <div 
        v-if="modelValue" 
        class="mobile-dialog-overlay"
        @click="handleOverlayClick"
      >
        <div
          class="mobile-dialog-container"
          :class="{ 'destructive': destructive }"
          @click.stop
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="messageId"
        >
          <!-- Icon -->
          <div class="dialog-icon">
            <div 
              class="icon-container"
              :class="iconClass"
            >
              <svg
                v-if="type === 'warning' || destructive"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <svg
                v-else-if="type === 'error'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg
                v-else-if="type === 'success'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg
                v-else-if="type === 'info'"
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <svg
                v-else
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <!-- Content -->
          <div class="dialog-content">
            <h3 :id="titleId" class="dialog-title">{{ title }}</h3>
            <p :id="messageId" class="dialog-message">{{ message }}</p>
            
            <!-- Additional details -->
            <div v-if="details" class="dialog-details">
              <p class="details-text">{{ details }}</p>
            </div>

            <!-- File info if provided -->
            <div v-if="file" class="file-info">
              <div class="file-preview">
                <div class="file-icon">
                  <svg
                    v-if="file.type === 'directory'"
                    class="w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <svg
                    v-else
                    class="w-5 h-5 text-gray-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="file-details">
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-path">{{ file.path }}</span>
                </div>
              </div>
            </div>

            <!-- Destructive action warning -->
            <div v-if="destructive" class="destructive-warning">
              <div class="warning-box">
                <svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div class="warning-content">
                  <p class="warning-title">This action cannot be undone</p>
                  <p v-if="destructiveWarning" class="warning-text">{{ destructiveWarning }}</p>
                </div>
              </div>
              
              <!-- Confirmation input for destructive actions -->
              <div v-if="requireConfirmation" class="confirmation-input">
                <label class="input-label">
                  Type <strong>{{ confirmationText }}</strong> to confirm:
                </label>
                <input
                  ref="confirmationInputRef"
                  v-model="confirmationInput"
                  type="text"
                  class="input-field touch-friendly"
                  :placeholder="confirmationText || ''"
                  @keyup.enter="handleConfirm"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="dialog-actions">
            <button
              v-if="showCancel"
              @click="handleCancel"
              :disabled="loading || false"
              class="action-button secondary touch-friendly"
            >
              {{ cancelText }}
            </button>
            <button
              @click="handleConfirm"
              :disabled="loading || !canConfirm"
              class="action-button primary touch-friendly"
              :class="{ 'destructive': destructive }"
            >
              <div v-if="loading" class="loading-spinner"></div>
              <span v-else>{{ confirmText }}</span>
            </button>
          </div>

          <!-- Safe area padding -->
          <div class="safe-area-bottom"></div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { FileSystemNode } from '../../types/filesystem'

interface Props {
  modelValue: boolean
  title?: string
  message?: string
  details?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  file?: FileSystemNode
  destructive?: boolean
  destructiveWarning?: string
  requireConfirmation?: boolean
  confirmationText?: string
  showCancel?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  closeOnOverlay?: boolean
  hapticFeedback?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  details: '',
  type: 'question',
  destructive: false,
  destructiveWarning: '',
  requireConfirmation: false,
  confirmationText: 'DELETE',
  showCancel: true,
  cancelText: 'Cancel',
  confirmText: 'Confirm',
  loading: false,
  closeOnOverlay: true,
  hapticFeedback: true
})

const emit = defineEmits<Emits>()

// State
const confirmationInput = ref('')
const confirmationInputRef = ref<HTMLInputElement>()

// Computed
const titleId = computed(() => `mobile-dialog-title-${Math.random().toString(36).substr(2, 9)}`)
const messageId = computed(() => `mobile-dialog-message-${Math.random().toString(36).substr(2, 9)}`)

const iconClass = computed(() => {
  const classes = ['icon-base']
  
  switch (props.type) {
    case 'success':
      classes.push('icon-success')
      break
    case 'warning':
      classes.push('icon-warning')
      break
    case 'error':
      classes.push('icon-error')
      break
    case 'info':
      classes.push('icon-info')
      break
    default:
      classes.push('icon-question')
  }
  
  if (props.destructive) {
    classes.push('icon-destructive')
  }
  
  return classes
})

const canConfirm = computed(() => {
  if (props.loading) return false
  if (!props.requireConfirmation) return true
  return confirmationInput.value === props.confirmationText
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

const handleOverlayClick = () => {
  if (props.closeOnOverlay && !props.loading) {
    handleCancel()
  }
}

const handleConfirm = async () => {
  if (!canConfirm.value) return
  
  await triggerHapticFeedback(props.destructive ? 'heavy' : 'medium')
  emit('confirm')
}

const handleCancel = async () => {
  if (props.loading) return
  
  await triggerHapticFeedback('light')
  emit('cancel')
  emit('update:modelValue', false)
  emit('close')
}

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.modelValue && !props.loading) {
    handleCancel()
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

// Watch for dialog open/close
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    lockBodyScroll()
    confirmationInput.value = ''
    
    // Focus confirmation input if required
    if (props.requireConfirmation) {
      await nextTick()
      confirmationInputRef.value?.focus()
    }
  } else {
    unlockBodyScroll()
  }
})

// Lifecycle
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
.mobile-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.mobile-dialog-container {
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-dialog-container.destructive {
  border: 2px solid #fecaca;
}

.dialog-icon {
  display: flex;
  justify-content: center;
  padding: 1.5rem 1.5rem 1rem 1.5rem;
}

.icon-container {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-base {
  transition: all 0.2s;
}

.icon-success {
  background: #d1fae5;
  color: #059669;
}

.icon-warning,
.icon-destructive {
  background: #fef3c7;
  color: #d97706;
}

.icon-error {
  background: #fee2e2;
  color: #dc2626;
}

.icon-info {
  background: #dbeafe;
  color: #2563eb;
}

.icon-question {
  background: #f3f4f6;
  color: #6b7280;
}

.dialog-content {
  padding: 0 1.5rem 1rem 1.5rem;
  text-align: center;
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.75rem 0;
  line-height: 1.3;
}

.dialog-message {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.dialog-details {
  margin-bottom: 1rem;
}

.details-text {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
  line-height: 1.4;
}

.file-info {
  margin: 1rem 0;
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
}

.file-icon {
  flex-shrink: 0;
}

.file-details {
  min-width: 0;
  flex: 1;
}

.file-name {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.destructive-warning {
  margin-top: 1rem;
  text-align: left;
}

.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.warning-content {
  flex: 1;
}

.warning-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #dc2626;
  margin: 0 0 0.25rem 0;
}

.warning-text {
  font-size: 0.875rem;
  color: #b91c1c;
  margin: 0;
  line-height: 1.4;
}

.confirmation-input {
  margin-top: 1rem;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.input-field {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #111827;
  transition: all 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #f3f4f6;
}

.action-button {
  flex: 1;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 48px;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.action-button.secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.action-button.secondary:hover:not(:disabled) {
  background: #e5e7eb;
  border-color: #9ca3af;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-button.secondary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.action-button.primary {
  background: #3b82f6;
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.action-button.primary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.action-button.primary.destructive {
  background: #dc2626;
}

.action-button.primary.destructive:hover:not(:disabled) {
  background: #b91c1c;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.safe-area-bottom {
  height: env(safe-area-inset-bottom, 0);
}

.touch-friendly {
  min-width: 44px;
  min-height: 44px;
}

/* Transition animations */
.mobile-dialog-enter-active,
.mobile-dialog-leave-active {
  transition: opacity 0.3s ease;
}

.mobile-dialog-enter-active .mobile-dialog-container,
.mobile-dialog-leave-active .mobile-dialog-container {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mobile-dialog-enter-from,
.mobile-dialog-leave-to {
  opacity: 0;
}

.mobile-dialog-enter-from .mobile-dialog-container,
.mobile-dialog-leave-to .mobile-dialog-container {
  transform: scale(0.9) translateY(20px);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mobile-dialog-container {
    background: #1f2937;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }
  
  .mobile-dialog-container.destructive {
    border-color: #991b1b;
  }
  
  .dialog-title {
    color: #f9fafb;
  }
  
  .dialog-message {
    color: #d1d5db;
  }
  
  .details-text {
    color: #9ca3af;
  }
  
  .file-info {
    background: #374151;
    border-color: #4b5563;
  }
  
  .file-name {
    color: #f9fafb;
  }
  
  .file-path {
    color: #9ca3af;
  }
  
  .warning-box {
    background: #7f1d1d;
    border-color: #991b1b;
  }
  
  .warning-title {
    color: #fca5a5;
  }
  
  .warning-text {
    color: #f87171;
  }
  
  .input-label {
    color: #d1d5db;
  }
  
  .input-field {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }
  
  .input-field:focus {
    border-color: #dc2626;
    box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
  }
  
  .dialog-actions {
    border-top-color: #374151;
  }
  
  .action-button.secondary {
    background: #374151;
    color: #d1d5db;
    border-color: #4b5563;
  }
  
  .action-button.secondary:hover:not(:disabled) {
    background: #4b5563;
    border-color: #6b7280;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .mobile-dialog-container {
    border: 2px solid currentColor;
  }
  
  .action-button {
    border: 2px solid currentColor;
  }
  
  .input-field {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .mobile-dialog-container,
  .action-button,
  .input-field,
  .icon-base {
    transition: none;
  }
  
  .mobile-dialog-enter-active,
  .mobile-dialog-leave-active,
  .mobile-dialog-enter-active .mobile-dialog-container,
  .mobile-dialog-leave-active .mobile-dialog-container {
    transition: none;
  }
  
  .loading-spinner {
    animation: none;
  }
}

/* Landscape orientation adjustments */
@media (orientation: landscape) and (max-height: 500px) {
  .mobile-dialog-container {
    max-height: 95vh;
  }
  
  .dialog-icon {
    padding: 1rem 1.5rem 0.5rem 1.5rem;
  }
  
  .icon-container {
    width: 40px;
    height: 40px;
  }
  
  .dialog-content {
    padding: 0 1.5rem 0.75rem 1.5rem;
  }
  
  .dialog-actions {
    padding: 0.75rem 1.5rem;
  }
}

/* Large screens */
@media (min-width: 768px) {
  .mobile-dialog-container {
    max-width: 480px;
  }
}
</style>