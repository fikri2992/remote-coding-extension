<template>
  <Dialog
    v-model="isOpen"
    :title="title"
    :message="message"
    :type="type"
    size="sm"
    :closable="!persistent"
    :close-on-overlay="!persistent"
    :close-on-escape="!persistent"
    :loading="loading"
    :persistent="persistent"
    :show-cancel="showCancel"
    :show-confirm="true"
    :cancel-text="cancelText"
    :confirm-text="confirmText"
    @close="handleClose"
    @cancel="handleCancel"
    @confirm="handleConfirm"
  >
    <template v-if="$slots['icon']" #icon>
      <slot name="icon" />
    </template>
    
    <div v-if="details || $slots['default']" class="confirmation-details">
      <p v-if="details" class="text-sm text-gray-600 mt-2">{{ details }}</p>
      <slot />
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
          v-model="confirmationInput"
          type="text"
          class="input-field"
          :placeholder="confirmationText || ''"
          @keyup.enter="handleConfirm"
        />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from './Dialog.vue'

interface Props {
  modelValue: boolean
  title?: string
  message?: string
  details?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  destructive?: boolean
  destructiveWarning?: string
  requireConfirmation?: boolean
  confirmationText?: string
  showCancel?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  persistent?: boolean
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
  persistent: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  cancel: []
  confirm: []
}>()

const isOpen = ref(props.modelValue)
const confirmationInput = ref('')

watch(() => props.modelValue, (value) => {
  isOpen.value = value
  if (value) {
    confirmationInput.value = ''
  }
})

watch(isOpen, (value) => {
  emit('update:modelValue', value)
})

const canConfirm = computed(() => {
  if (!props.requireConfirmation) return true
  return confirmationInput.value === props.confirmationText
})

const handleClose = () => {
  emit('close')
}

const handleCancel = () => {
  emit('cancel')
}

const handleConfirm = () => {
  if (!canConfirm.value) return
  emit('confirm')
}

// Expose confirmation state for parent components
defineExpose({
  canConfirm,
  confirmationInput: () => confirmationInput.value
})
</script>

<style scoped>
.confirmation-details {
  @apply mt-3;
}

.destructive-warning {
  @apply mt-4 space-y-4;
}

.warning-box {
  @apply flex gap-3 p-3 bg-red-50 border border-red-200 rounded-md;
}

.warning-content {
  @apply flex-1;
}

.warning-title {
  @apply text-sm font-medium text-red-800;
}

.warning-text {
  @apply text-sm text-red-700 mt-1;
}

.confirmation-input {
  @apply space-y-2;
}

.input-label {
  @apply block text-sm font-medium text-gray-700;
}

.input-field {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500;
}

.input-field:focus {
  @apply ring-red-500 border-red-500;
}
</style>