<template>
  <div 
    v-if="showIndicator"
    class="offline-indicator"
    :class="[
      `offline-indicator-${type}`,
      { 
        'offline-indicator-mobile': isMobile,
        'offline-indicator-persistent': isPersistent,
        'offline-indicator-animated': animated
      }
    ]"
  >
    <div class="offline-indicator-content">
      <!-- Status icon -->
      <div class="offline-indicator-icon">
        <svg 
          v-if="type === 'offline'"
          class="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
          />
        </svg>
        
        <svg 
          v-else-if="type === 'cached'"
          class="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M5 12l5 5L20 7"
          />
        </svg>
        
        <svg 
          v-else-if="type === 'syncing'"
          class="w-4 h-4 animate-spin" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        
        <svg 
          v-else-if="type === 'error'"
          class="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      
      <!-- Status message -->
      <div class="offline-indicator-message">
        <span class="offline-indicator-title">{{ title }}</span>
        <span 
          v-if="subtitle" 
          class="offline-indicator-subtitle"
        >
          {{ subtitle }}
        </span>
      </div>
      
      <!-- Action button -->
      <button 
        v-if="showAction"
        @click="handleAction"
        class="offline-indicator-action"
        :disabled="actionDisabled"
      >
        {{ actionLabel }}
      </button>
      
      <!-- Close button -->
      <button 
        v-if="showClose"
        @click="$emit('close')"
        class="offline-indicator-close"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- Progress bar for syncing -->
    <div 
      v-if="type === 'syncing' && showProgress"
      class="offline-indicator-progress"
    >
      <div 
        class="offline-indicator-progress-bar"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'

interface Props {
  type: 'offline' | 'cached' | 'syncing' | 'error'
  title?: string
  subtitle?: string
  showAction?: boolean
  actionLabel?: string
  actionDisabled?: boolean
  showClose?: boolean
  showProgress?: boolean
  progress?: number
  isPersistent?: boolean
  animated?: boolean
}

interface Emits {
  (e: 'action'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  showAction: false,
  actionLabel: 'Retry',
  actionDisabled: false,
  showClose: true,
  showProgress: false,
  progress: 0,
  isPersistent: false,
  animated: true
})

const emit = defineEmits<Emits>()

// Composables
const breakpoints = useBreakpoints()

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const showIndicator = computed(() => {
  return props.type !== 'cached' || props.isPersistent
})

const defaultTitles = {
  offline: 'You\'re offline',
  cached: 'Showing cached content',
  syncing: 'Syncing...',
  error: 'Connection error'
}

const defaultSubtitles = {
  offline: 'Some features may be limited',
  cached: 'Content may not be up to date',
  syncing: 'Updating content',
  error: 'Failed to load content'
}

const title = computed(() => {
  return props.title || defaultTitles[props.type]
})

const subtitle = computed(() => {
  return props.subtitle || defaultSubtitles[props.type]
})

// Methods
const handleAction = () => {
  if (!props.actionDisabled) {
    emit('action')
  }
}
</script>

<style scoped>
.offline-indicator {
  position: relative;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  transition: all 0.2s ease-in-out;
}

.offline-indicator-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.offline-indicator-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.offline-indicator-message {
  flex: 1;
  min-width: 0;
}

.offline-indicator-title {
  display: block;
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25;
}

.offline-indicator-subtitle {
  display: block;
  font-size: 0.75rem;
  line-height: 1.25;
  opacity: 0.7;
  margin-top: 0.125rem;
}

.offline-indicator-action {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.offline-indicator-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.offline-indicator-close {
  flex-shrink: 0;
  padding: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s ease-in-out;
}

.offline-indicator-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 0 0 0.5rem 0.5rem;
  overflow: hidden;
}

.offline-indicator-progress-bar {
  height: 100%;
  background: currentColor;
  transition: width 0.3s ease-in-out;
  border-radius: inherit;
}

/* Type-specific styles */
.offline-indicator-offline {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.offline-indicator-offline .offline-indicator-action {
  background: #dc2626;
  color: white;
}

.offline-indicator-offline .offline-indicator-action:hover:not(:disabled) {
  background: #b91c1c;
}

.offline-indicator-offline .offline-indicator-close:hover {
  background: rgba(220, 38, 38, 0.1);
}

.offline-indicator-cached {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #0369a1;
}

.offline-indicator-cached .offline-indicator-action {
  background: #0369a1;
  color: white;
}

.offline-indicator-cached .offline-indicator-action:hover:not(:disabled) {
  background: #0284c7;
}

.offline-indicator-cached .offline-indicator-close:hover {
  background: rgba(3, 105, 161, 0.1);
}

.offline-indicator-syncing {
  background: #fffbeb;
  border-color: #fed7aa;
  color: #d97706;
}

.offline-indicator-syncing .offline-indicator-action {
  background: #d97706;
  color: white;
}

.offline-indicator-syncing .offline-indicator-action:hover:not(:disabled) {
  background: #b45309;
}

.offline-indicator-syncing .offline-indicator-close:hover {
  background: rgba(217, 119, 6, 0.1);
}

.offline-indicator-error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.offline-indicator-error .offline-indicator-action {
  background: #dc2626;
  color: white;
}

.offline-indicator-error .offline-indicator-action:hover:not(:disabled) {
  background: #b91c1c;
}

.offline-indicator-error .offline-indicator-close:hover {
  background: rgba(220, 38, 38, 0.1);
}

/* Mobile optimizations */
.offline-indicator-mobile {
  padding: 1rem;
  margin: 0.75rem 0;
  border-radius: 0.75rem;
}

.offline-indicator-mobile .offline-indicator-content {
  gap: 1rem;
}

.offline-indicator-mobile .offline-indicator-title {
  font-size: 1rem;
}

.offline-indicator-mobile .offline-indicator-subtitle {
  font-size: 0.875rem;
}

.offline-indicator-mobile .offline-indicator-action {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  min-height: 2.5rem; /* 40px minimum touch target */
}

.offline-indicator-mobile .offline-indicator-close {
  padding: 0.5rem;
  min-width: 2.5rem;
  min-height: 2.5rem;
}

/* Persistent indicator */
.offline-indicator-persistent {
  position: sticky;
  top: 0;
  z-index: 10;
  margin: 0;
  border-radius: 0;
  border-left: none;
  border-right: none;
}

/* Animations */
.offline-indicator-animated {
  animation: offline-indicator-slide-in 0.3s ease-out;
}

@keyframes offline-indicator-slide-in {
  from {
    opacity: 0;
    transform: translateY(-1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .offline-indicator {
    background: #374151;
    border-color: #4b5563;
  }
  
  .offline-indicator-offline {
    background: #450a0a;
    border-color: #7f1d1d;
    color: #fca5a5;
  }
  
  .offline-indicator-cached {
    background: #0c4a6e;
    border-color: #075985;
    color: #7dd3fc;
  }
  
  .offline-indicator-syncing {
    background: #451a03;
    border-color: #78350f;
    color: #fbbf24;
  }
  
  .offline-indicator-error {
    background: #450a0a;
    border-color: #7f1d1d;
    color: #fca5a5;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .offline-indicator {
    border-width: 2px;
  }
  
  .offline-indicator-action {
    border-width: 2px;
    border-color: currentColor;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .offline-indicator-animated {
    animation: none;
  }
  
  .offline-indicator-progress-bar {
    transition: none;
  }
  
  .offline-indicator-icon svg {
    animation: none;
  }
}

/* Performance optimizations */
.offline-indicator {
  contain: layout style paint;
}

.offline-indicator-progress-bar {
  will-change: width;
}
</style>