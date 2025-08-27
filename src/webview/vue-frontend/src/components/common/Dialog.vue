<template>
  <Modal
    v-model="isOpen"
    :title="title"
    :size="size"
    :closable="closable"
    :close-on-overlay="closeOnOverlay"
    :close-on-escape="closeOnEscape"
    :loading="loading"
    :persistent="persistent"
    show-footer
    :show-cancel="showCancel"
    :show-confirm="showConfirm"
    :cancel-text="cancelText"
    :confirm-text="confirmText"
    @close="handleClose"
    @cancel="handleCancel"
    @confirm="handleConfirm"
  >
    <template #title>
      <slot name="title" />
    </template>
    
    <div class="dialog-content">
      <!-- Icon -->
      <div v-if="icon || type" class="dialog-icon" :class="iconColorClass">
        <slot name="icon">
          <div class="w-6 h-6" v-html="iconComponent"></div>
        </slot>
      </div>
      
      <!-- Message -->
      <div class="dialog-message">
        <p v-if="message" class="dialog-text">{{ message }}</p>
        <slot />
      </div>
    </div>
    
    <template #footer>
      <slot name="footer" />
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'

interface Props {
  modelValue: boolean
  title?: string
  message?: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'question'
  icon?: string
  size?: 'sm' | 'md' | 'lg'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEscape?: boolean
  showCancel?: boolean
  showConfirm?: boolean
  cancelText?: string
  confirmText?: string
  loading?: boolean
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  message: '',
  type: 'info',
  size: 'sm',
  closable: true,
  closeOnOverlay: true,
  closeOnEscape: true,
  showCancel: true,
  showConfirm: true,
  cancelText: 'Cancel',
  confirmText: 'OK',
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

watch(() => props.modelValue, (value) => {
  isOpen.value = value
})

watch(isOpen, (value) => {
  emit('update:modelValue', value)
})



const iconColorClass = computed(() => {
  const colorMap = {
    info: 'text-blue-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    question: 'text-blue-500'
  }
  
  return colorMap[props.type] || 'text-blue-500'
})

const handleClose = () => {
  emit('close')
}

const handleCancel = () => {
  emit('cancel')
}

const handleConfirm = () => {
  emit('confirm')
}

// Simple icon component that renders SVG based on type
const iconComponent = computed(() => {
  const iconSvgs = {
    info: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    warning: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>`,
    error: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    question: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
  }
  
  return iconSvgs[props.type] || iconSvgs.info
})
</script>

<style scoped>
.dialog-content {
  @apply flex gap-4;
}

.dialog-icon {
  @apply flex-shrink-0 mt-1;
}

.dialog-message {
  @apply flex-1;
}

.dialog-text {
  @apply text-gray-700 leading-relaxed;
}
</style>