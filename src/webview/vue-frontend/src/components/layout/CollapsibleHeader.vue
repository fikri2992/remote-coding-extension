<template>
  <header 
    :class="headerClasses"
    :style="headerStyles"
    class="collapsible-header bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-all duration-300"
  >
    <!-- Header Content Container -->
    <div class="header-content px-4 py-3 md:px-6 md:py-4">
      <!-- Main Header Row -->
      <div class="flex items-center justify-between mb-3">
        <!-- Title and Menu Button -->
        <div class="flex items-center space-x-3">
          <!-- Mobile Menu Button -->
          <button
            v-if="showMenuButton"
            @click="handleMenuClick"
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg md:hidden"
            aria-label="Toggle menu"
          >
            <Bars3Icon v-if="!menuOpen" class="w-6 h-6" />
            <XMarkIcon v-else class="w-6 h-6" />
          </button>

          <!-- Title -->
          <div class="flex items-center space-x-2">
            <component 
              v-if="titleIcon" 
              :is="titleIcon" 
              class="w-6 h-6 text-blue-600 dark:text-blue-400" 
            />
            <h1 
              :class="[
                'font-semibold text-gray-900 dark:text-white transition-all duration-300',
                layout.state.headerState === 'collapsed' ? 'text-lg' : 'text-xl md:text-2xl'
              ]"
            >
              {{ title }}
            </h1>
          </div>
        </div>

        <!-- Header Actions -->
        <div class="flex items-center space-x-2">
          <!-- Custom Actions Slot -->
          <slot name="actions" />

          <!-- Collapse Toggle Button -->
          <button
            v-if="layout.isCollapsibleHeader"
            @click="layout.toggleHeader()"
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
            :aria-label="layout.state.headerState === 'expanded' ? 'Collapse header' : 'Expand header'"
          >
            <ChevronUpIcon 
              v-if="layout.state.headerState === 'expanded'" 
              class="w-5 h-5 transition-transform duration-300" 
            />
            <ChevronDownIcon 
              v-else 
              class="w-5 h-5 transition-transform duration-300" 
            />
          </button>
        </div>
      </div>

      <!-- Collapsible Content -->
      <div 
        v-if="hasCollapsibleContent"
        :class="[
          'collapsible-content transition-all duration-300 overflow-hidden',
          layout.state.headerState === 'expanded' ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        ]"
      >
        <!-- Search Bar -->
        <div 
          v-if="showSearch"
          class="search-container mb-4"
        >
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
              type="text"
              :placeholder="searchPlaceholder"
              :class="[
                'w-full pl-10 pr-10 py-2 md:py-3 text-sm md:text-base border border-gray-300 dark:border-gray-600 rounded-lg',
                'bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200',
                searchFocused ? 'ring-2 ring-blue-500 border-transparent' : ''
              ]"
            >
            
            <!-- Search Icon -->
            <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            
            <!-- Clear Button -->
            <button
              v-if="searchQuery"
              @click="clearSearch"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>

          <!-- Search Suggestions -->
          <div 
            v-if="searchSuggestions.length > 0 && searchFocused"
            class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            <button
              v-for="(suggestion, index) in searchSuggestions"
              :key="index"
              @click="selectSuggestion(suggestion)"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>

        <!-- Filter Controls -->
        <div 
          v-if="showFilters && layout.state.headerState === 'expanded'"
          class="filter-controls flex flex-wrap gap-3 mb-4"
        >
          <slot name="filters" />
        </div>

        <!-- Additional Content Slot -->
        <div v-if="$slots.content" class="additional-content">
          <slot name="content" />
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div 
      v-if="showProgress"
      class="progress-bar h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden"
    >
      <div 
        :class="[
          'h-full bg-blue-600 transition-all duration-300',
          progressIndeterminate ? 'animate-pulse' : ''
        ]"
        :style="{ width: `${progressValue}%` }"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue'
import { useLayout } from '../../composables/useLayout'
import { 
  Bars3Icon, 
  XMarkIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline'

interface Props {
  title?: string
  titleIcon?: Component
  showSearch?: boolean
  searchPlaceholder?: string
  searchSuggestions?: string[]
  showFilters?: boolean
  showMenuButton?: boolean
  menuOpen?: boolean
  showProgress?: boolean
  progressValue?: number
  progressIndeterminate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'File Explorer',
  showSearch: true,
  searchPlaceholder: 'Search files and folders...',
  searchSuggestions: () => [],
  showFilters: false,
  showMenuButton: true,
  menuOpen: false,
  showProgress: false,
  progressValue: 0,
  progressIndeterminate: false
})

const emit = defineEmits<{
  search: [query: string]
  searchFocus: []
  searchBlur: []
  menuClick: []
  suggestionSelect: [suggestion: string]
}>()

// Composables
const layout = useLayout()

// Local state
const searchQuery = ref('')
const searchFocused = ref(false)

// Computed properties
const headerClasses = computed(() => {
  const classes: string[] = []
  
  // Header state classes
  classes.push(`header-${layout.state.headerState}`)
  
  // Breakpoint classes
  classes.push(`breakpoint-${layout.breakpoints.current.value}`)
  
  // Transition classes
  if (layout.state.isTransitioning) {
    classes.push('transitioning')
  }
  
  return classes
})

const headerStyles = computed(() => {
  const styles: Record<string, string> = {}
  
  // Safe area support
  styles.paddingTop = `env(safe-area-inset-top, ${layout.breakpoints.safeArea.value.top}px)`
  
  // Transition styles
  styles.transition = 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
  
  return styles
})

const hasCollapsibleContent = computed(() => {
  return props.showSearch || props.showFilters || !!slots.content
})

// Methods
const handleSearchInput = () => {
  emit('search', searchQuery.value)
}

const handleSearchFocus = () => {
  searchFocused.value = true
  emit('searchFocus')
}

const handleSearchBlur = () => {
  // Delay blur to allow suggestion clicks
  setTimeout(() => {
    searchFocused.value = false
    emit('searchBlur')
  }, 200)
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('search', '')
}

const selectSuggestion = (suggestion: string) => {
  searchQuery.value = suggestion
  searchFocused.value = false
  emit('search', suggestion)
  emit('suggestionSelect', suggestion)
}

const handleMenuClick = () => {
  emit('menuClick')
}

// Watch for external search query changes
watch(() => props.searchPlaceholder, () => {
  // Reset search when placeholder changes (indicates context change)
  searchQuery.value = ''
})

// Slots
const slots = defineSlots<{
  actions?: () => any
  filters?: () => any
  content?: () => any
}>()
</script>

<style scoped>
.collapsible-header {
  /* Ensure header is above other content */
  position: relative;
  z-index: 30;
}

.header-content {
  /* Smooth transitions for all header content */
  transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.collapsible-content {
  /* Smooth height transitions */
  transition: max-height 300ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.search-container {
  position: relative;
}

.progress-bar {
  /* Progress bar animation */
  position: relative;
  overflow: hidden;
}

.progress-bar .animate-pulse {
  animation: progress-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes progress-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Header state variations */
.header-collapsed .header-content {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.header-expanded .header-content {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

/* Responsive adjustments */
@media (max-width: 767px) {
  .header-content {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  .search-container input {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Touch-friendly button sizing */
.header-content button {
  min-height: 44px;
  min-width: 44px;
}

/* Focus styles for accessibility */
.header-content button:focus,
.search-container input:focus {
  outline: 2px solid theme('colors.blue.500');
  outline-offset: 2px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .collapsible-header,
  .collapsible-header * {
    transition: none !important;
    animation: none !important;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .collapsible-header {
    border-color: theme('colors.gray.700');
  }
}
</style>