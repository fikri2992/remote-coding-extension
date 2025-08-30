<template>
  <div 
    class="skeleton-file-item"
    :class="[
      `skeleton-density-${density}`,
      { 'skeleton-mobile': isMobile }
    ]"
    :style="{ height: itemHeight + 'px' }"
  >
    <div class="skeleton-content">
      <!-- File icon skeleton -->
      <div 
        class="skeleton-icon"
        :class="{ 'skeleton-folder': isFolder }"
      ></div>
      
      <!-- File name skeleton -->
      <div class="skeleton-text-container">
        <div 
          class="skeleton-text skeleton-name"
          :style="{ width: nameWidth }"
        ></div>
        
        <!-- File details skeleton (size, date) -->
        <div 
          v-if="showDetails"
          class="skeleton-text skeleton-details"
          :style="{ width: detailsWidth }"
        ></div>
      </div>
      
      <!-- Action buttons skeleton -->
      <div 
        v-if="showActions"
        class="skeleton-actions"
      >
        <div class="skeleton-action-button"></div>
        <div class="skeleton-action-button"></div>
      </div>
    </div>
    
    <!-- Loading indicator overlay -->
    <div 
      v-if="showLoadingOverlay"
      class="skeleton-loading-overlay"
    >
      <div class="skeleton-spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBreakpoints } from '../../composables/useBreakpoints'

interface Props {
  density?: 'compact' | 'normal' | 'comfortable'
  isFolder?: boolean
  showDetails?: boolean
  showActions?: boolean
  showLoadingOverlay?: boolean
  level?: number
}

const props = withDefaults(defineProps<Props>(), {
  density: 'normal',
  isFolder: false,
  showDetails: true,
  showActions: false,
  showLoadingOverlay: false,
  level: 0
})

// Composables
const breakpoints = useBreakpoints()

// Computed
const isMobile = computed(() => breakpoints.isMobile.value)

const itemHeight = computed(() => {
  switch (props.density) {
    case 'compact':
      return isMobile.value ? 40 : 28
    case 'comfortable':
      return isMobile.value ? 56 : 40
    default: // normal
      return isMobile.value ? 48 : 32
  }
})

const nameWidth = computed(() => {
  // Randomize width for more realistic skeleton
  const baseWidths = ['60%', '75%', '45%', '80%', '55%']
  const index = Math.floor(Math.random() * baseWidths.length)
  return baseWidths[index]
})

const detailsWidth = computed(() => {
  const baseWidths = ['40%', '35%', '50%', '30%']
  const index = Math.floor(Math.random() * baseWidths.length)
  return baseWidths[index]
})
</script>

<style scoped>
.skeleton-file-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  position: relative;
  overflow: hidden;
}

.skeleton-content {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.75rem;
}

.skeleton-icon {
  width: 1.25rem;
  height: 1.25rem;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 0.25rem;
  flex-shrink: 0;
}

.skeleton-icon.skeleton-folder {
  border-radius: 0.125rem;
}

.skeleton-text-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.skeleton-text {
  height: 0.75rem;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 0.25rem;
}

.skeleton-name {
  height: 1rem;
}

.skeleton-details {
  height: 0.625rem;
  opacity: 0.7;
}

.skeleton-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.skeleton-action-button {
  width: 1.5rem;
  height: 1.5rem;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 0.25rem;
}

.skeleton-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.skeleton-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: skeleton-spin 1s linear infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes skeleton-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* Density variations */
.skeleton-density-compact {
  padding: 0.25rem 0.75rem;
}

.skeleton-density-compact .skeleton-icon {
  width: 1rem;
  height: 1rem;
}

.skeleton-density-compact .skeleton-text {
  height: 0.625rem;
}

.skeleton-density-compact .skeleton-name {
  height: 0.75rem;
}

.skeleton-density-comfortable {
  padding: 0.75rem 1.25rem;
}

.skeleton-density-comfortable .skeleton-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.skeleton-density-comfortable .skeleton-text {
  height: 0.875rem;
}

.skeleton-density-comfortable .skeleton-name {
  height: 1.125rem;
}

/* Mobile optimizations */
.skeleton-mobile {
  padding: 0.75rem 1rem;
  min-height: 3rem; /* 48px minimum touch target */
}

.skeleton-mobile .skeleton-content {
  gap: 1rem;
}

.skeleton-mobile .skeleton-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.skeleton-mobile .skeleton-actions {
  gap: 0.75rem;
}

.skeleton-mobile .skeleton-action-button {
  width: 2rem;
  height: 2rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .skeleton-file-item {
    border-bottom-color: #374151;
  }
  
  .skeleton-icon,
  .skeleton-text,
  .skeleton-action-button {
    background: linear-gradient(
      90deg,
      #374151 25%,
      #4b5563 50%,
      #374151 75%
    );
  }
  
  .skeleton-loading-overlay {
    background: rgba(31, 41, 55, 0.8);
  }
  
  .skeleton-spinner {
    border-color: #4b5563;
    border-top-color: #60a5fa;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .skeleton-icon,
  .skeleton-text,
  .skeleton-action-button {
    background: linear-gradient(
      90deg,
      #d1d5db 25%,
      #9ca3af 50%,
      #d1d5db 75%
    );
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton-icon,
  .skeleton-text,
  .skeleton-action-button {
    animation: none;
    background: #f0f0f0;
  }
  
  @media (prefers-color-scheme: dark) {
    .skeleton-icon,
    .skeleton-text,
    .skeleton-action-button {
      background: #374151;
    }
  }
  
  .skeleton-spinner {
    animation: none;
    border: 2px solid #9ca3af;
  }
}

/* Performance optimizations */
.skeleton-file-item {
  contain: layout style paint;
  will-change: transform;
}

.skeleton-icon,
.skeleton-text,
.skeleton-action-button {
  contain: layout style paint;
}
</style>