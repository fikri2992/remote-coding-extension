<template>
  <div class="loading-spinner" :class="containerClass">
    <div class="spinner" :class="spinnerClass">
      <div class="spinner-circle" :class="circleClass"></div>
    </div>
    <p v-if="message" class="loading-message" :class="messageClass">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'white'
  message?: string
  overlay?: boolean
  center?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'primary',
  message: '',
  overlay: false,
  center: false
})

const containerClass = computed(() => {
  const classes = []
  
  if (props.overlay) {
    classes.push('loading-overlay')
  }
  
  if (props.center) {
    classes.push('loading-center')
  }
  
  return classes
})

const spinnerClass = computed(() => {
  const sizeClasses = {
    sm: 'spinner-sm',
    md: 'spinner-md',
    lg: 'spinner-lg',
    xl: 'spinner-xl'
  }
  return sizeClasses[props.size]
})

const circleClass = computed(() => {
  const colorClasses = {
    primary: 'circle-primary',
    secondary: 'circle-secondary',
    success: 'circle-success',
    warning: 'circle-warning',
    error: 'circle-error',
    white: 'circle-white'
  }
  return colorClasses[props.color]
})

const messageClass = computed(() => {
  const colorClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    white: 'text-white'
  }
  return colorClasses[props.color]
})
</script>

<style scoped>
.loading-spinner {
  @apply flex flex-col items-center justify-center gap-3;
}

.loading-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 z-50;
}

.loading-center {
  @apply min-h-32;
}

.spinner {
  @apply relative;
}

.spinner-sm {
  @apply w-4 h-4;
}

.spinner-md {
  @apply w-8 h-8;
}

.spinner-lg {
  @apply w-12 h-12;
}

.spinner-xl {
  @apply w-16 h-16;
}

.spinner-circle {
  @apply w-full h-full rounded-full border-2 border-solid;
  animation: spin 1s linear infinite;
}

.circle-primary {
  @apply border-blue-200 border-t-blue-600;
}

.circle-secondary {
  @apply border-gray-200 border-t-gray-600;
}

.circle-success {
  @apply border-green-200 border-t-green-600;
}

.circle-warning {
  @apply border-yellow-200 border-t-yellow-600;
}

.circle-error {
  @apply border-red-200 border-t-red-600;
}

.circle-white {
  @apply border-white border-opacity-30 border-t-white;
}

.loading-message {
  @apply text-sm font-medium;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>