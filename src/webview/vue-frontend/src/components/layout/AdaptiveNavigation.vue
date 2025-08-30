<template>
  <nav 
    v-if="shouldShowNavigation"
    :class="navigationClasses"
    :style="navigationStyles"
    class="adaptive-navigation"
  >
    <!-- Bottom Navigation for Mobile -->
    <div 
      v-if="layout.isNavigationPattern('bottom')"
      class="bottom-navigation fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 pb-safe"
    >
      <div class="flex items-center justify-around px-2 py-2">
        <button
          v-for="item in navigationItems"
          :key="item.id"
          @click="handleNavigationClick(item)"
          :class="[
            'flex flex-col items-center justify-center p-3 rounded-lg transition-colors duration-200',
            item.active 
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          ]"
          :aria-label="item.label"
        >
          <component 
            :is="item.icon" 
            class="w-6 h-6 mb-1"
            :class="{ 'animate-pulse': item.loading }"
          />
          <span class="text-xs font-medium">{{ item.label }}</span>
          <div 
            v-if="item.badge"
            class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
          >
            {{ item.badge }}
          </div>
        </button>
      </div>
    </div>

    <!-- Sidebar Navigation for Tablet/Desktop -->
    <aside
      v-else-if="layout.isNavigationPattern('sidebar')"
      :class="[
        'sidebar-navigation fixed left-0 top-0 bottom-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300',
        layout.shouldShowSidebar ? 'translate-x-0' : '-translate-x-full'
      ]"
      :style="{ width: sidebarWidth }"
    >
      <!-- Sidebar Header -->
      <div class="sidebar-header p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            File Explorer
          </h2>
          <button
            v-if="breakpoints.isTablet"
            @click="layout.hideSidebar()"
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
            aria-label="Close sidebar"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Sidebar Content -->
      <div class="sidebar-content flex-1 overflow-y-auto p-4">
        <nav class="space-y-2">
          <button
            v-for="item in sidebarItems"
            :key="item.id"
            @click="handleNavigationClick(item)"
            :class="[
              'w-full flex items-center px-3 py-2 text-left rounded-lg transition-colors duration-200',
              item.active 
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            ]"
          >
            <component 
              :is="item.icon" 
              class="w-5 h-5 mr-3"
              :class="{ 'animate-pulse': item.loading }"
            />
            <span class="font-medium">{{ item.label }}</span>
            <div 
              v-if="item.badge"
              class="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
            >
              {{ item.badge }}
            </div>
          </button>
        </nav>
      </div>
    </aside>

    <!-- Overlay Navigation for Mobile -->
    <div
      v-else-if="layout.isNavigationPattern('overlay')"
      :class="[
        'overlay-navigation fixed inset-0 z-50 transition-opacity duration-300',
        layout.state.overlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      ]"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black bg-opacity-50"
        @click="layout.hideOverlay()"
      />
      
      <!-- Overlay Content -->
      <div 
        :class="[
          'absolute right-0 top-0 bottom-0 w-80 max-w-[80vw] bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300',
          layout.state.overlayVisible ? 'translate-x-0' : 'translate-x-full'
        ]"
      >
        <!-- Overlay Header -->
        <div class="overlay-header p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Navigation
            </h2>
            <button
              @click="layout.hideOverlay()"
              class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
              aria-label="Close navigation"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Overlay Content -->
        <div class="overlay-content flex-1 overflow-y-auto p-4">
          <nav class="space-y-2">
            <button
              v-for="item in overlayItems"
              :key="item.id"
              @click="handleNavigationClick(item)"
              :class="[
                'w-full flex items-center px-3 py-3 text-left rounded-lg transition-colors duration-200',
                item.active 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              ]"
            >
              <component 
                :is="item.icon" 
                class="w-6 h-6 mr-3"
                :class="{ 'animate-pulse': item.loading }"
              />
              <span class="font-medium text-base">{{ item.label }}</span>
              <div 
                v-if="item.badge"
                class="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
              >
                {{ item.badge }}
              </div>
            </button>
          </nav>
        </div>
      </div>
    </div>

    <!-- Sidebar Backdrop for Tablet -->
    <div
      v-if="layout.isNavigationPattern('sidebar') && breakpoints.isTablet && layout.shouldShowSidebar"
      class="fixed inset-0 bg-black bg-opacity-50 z-30"
      @click="layout.hideSidebar()"
    />
  </nav>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useLayout } from '../../composables/useLayout'
import { useBreakpoints } from '../../composables/useBreakpoints'
import { 
  FolderIcon, 
  DocumentIcon, 
  MagnifyingGlassIcon, 
  CommandLineIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

export interface NavigationItem {
  id: string
  label: string
  icon: Component
  active?: boolean
  badge?: number | string
  loading?: boolean
  route?: string
  action?: () => void
}

interface Props {
  items?: NavigationItem[]
  currentRoute?: string
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  currentRoute: ''
})

const emit = defineEmits<{
  navigate: [item: NavigationItem]
  action: [item: NavigationItem]
}>()

// Composables
const layout = useLayout()
const breakpoints = useBreakpoints()

// Default navigation items
const defaultItems: NavigationItem[] = [
  {
    id: 'files',
    label: 'Files',
    icon: FolderIcon,
    route: '/files'
  },
  {
    id: 'search',
    label: 'Search',
    icon: MagnifyingGlassIcon,
    route: '/search'
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: CommandLineIcon,
    route: '/terminal'
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: ChatBubbleLeftRightIcon,
    route: '/chat'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Cog6ToothIcon,
    route: '/settings'
  }
]

// Computed properties
const navigationItems = computed(() => {
  const items = props.items.length > 0 ? props.items : defaultItems
  return items.map(item => ({
    ...item,
    active: item.route === props.currentRoute || item.active
  }))
})

const sidebarItems = computed(() => navigationItems.value)
const overlayItems = computed(() => navigationItems.value)

const shouldShowNavigation = computed(() => {
  return layout.shouldShowBottomNavigation.value || 
         layout.shouldShowSidebar.value || 
         layout.state.overlayVisible
})

const navigationClasses = computed(() => {
  const classes: string[] = []
  
  if (layout.isNavigationPattern('bottom')) {
    classes.push('bottom-nav')
  } else if (layout.isNavigationPattern('sidebar')) {
    classes.push('sidebar-nav')
  } else if (layout.isNavigationPattern('overlay')) {
    classes.push('overlay-nav')
  }
  
  if (layout.state.isTransitioning) {
    classes.push('transitioning')
  }
  
  return classes
})

const navigationStyles = computed(() => {
  const styles: Record<string, string> = {}
  
  // Apply safe area padding for bottom navigation
  if (layout.isNavigationPattern('bottom')) {
    styles.paddingBottom = `env(safe-area-inset-bottom, ${breakpoints.safeArea.value.bottom}px)`
  }
  
  return styles
})

const sidebarWidth = computed(() => {
  return layout.currentLayoutConfig.value.sidebarWidth || '280px'
})

// Methods
const handleNavigationClick = (item: NavigationItem) => {
  // Close overlay/sidebar on mobile after selection
  if (breakpoints.isMobile.value) {
    if (layout.isNavigationPattern('overlay')) {
      layout.hideOverlay()
    } else if (layout.isNavigationPattern('sidebar') && breakpoints.isTablet.value) {
      layout.hideSidebar()
    }
  }
  
  // Execute action or emit navigation event
  if (item.action) {
    item.action()
    emit('action', item)
  } else {
    emit('navigate', item)
  }
}
</script>

<style scoped>
.adaptive-navigation {
  /* Base navigation styles */
  --nav-transition-duration: 300ms;
  --nav-transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

.bottom-navigation {
  /* Ensure bottom navigation is above other content */
  box-shadow: 0 -1px 3px 0 rgba(0, 0, 0, 0.1), 0 -1px 2px 0 rgba(0, 0, 0, 0.06);
}

.sidebar-navigation {
  /* Sidebar shadow */
  box-shadow: 1px 0 3px 0 rgba(0, 0, 0, 0.1), 1px 0 2px 0 rgba(0, 0, 0, 0.06);
}

.overlay-navigation .overlay-content {
  /* Overlay shadow */
  box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1), -2px 0 4px -1px rgba(0, 0, 0, 0.06);
}

/* Transition animations */
.transitioning * {
  transition: all var(--nav-transition-duration) var(--nav-transition-easing);
}

/* Safe area support */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Touch-friendly button sizing */
@media (max-width: 767px) {
  .bottom-navigation button {
    min-height: 44px;
    min-width: 44px;
  }
  
  .overlay-navigation button {
    min-height: 48px;
  }
}

/* Hover effects for non-touch devices */
@media (hover: hover) {
  .bottom-navigation button:hover,
  .sidebar-navigation button:hover,
  .overlay-navigation button:hover {
    transform: translateY(-1px);
  }
}

/* Focus styles for accessibility */
.bottom-navigation button:focus,
.sidebar-navigation button:focus,
.overlay-navigation button:focus {
  outline: 2px solid theme('colors.blue.500');
  outline-offset: 2px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .adaptive-navigation,
  .adaptive-navigation * {
    transition: none !important;
    animation: none !important;
  }
}
</style>