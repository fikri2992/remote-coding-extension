<template>
  <div 
    class="layout-test adaptive-layout"
    :class="layout.layoutClasses"
    :style="layout.layoutStyles"
  >
    <!-- Test Header -->
    <CollapsibleHeader
      class="layout-grid-area-header"
      title="Layout Test"
      :show-search="true"
      :show-filters="true"
      @search="handleSearch"
      @menu-click="handleMenuClick"
    >
      <template #actions>
        <button
          @click="toggleTestMode"
          class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {{ testMode ? 'Exit Test' : 'Test Mode' }}
        </button>
      </template>

      <template #filters>
        <select class="px-3 py-2 border rounded-lg">
          <option>Test Filter 1</option>
          <option>Test Filter 2</option>
        </select>
      </template>
    </CollapsibleHeader>

    <!-- Test Main Content -->
    <main class="layout-grid-area-main p-6 overflow-auto">
      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Layout System Test</h2>
          
          <!-- Breakpoint Test -->
          <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">Breakpoint Detection</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div 
                v-for="breakpoint in ['mobile', 'tablet', 'desktop']"
                :key="breakpoint"
                :class="[
                  'p-4 rounded-lg border-2 transition-all duration-300',
                  layout.breakpoints.current.value === breakpoint
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                ]"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium capitalize">{{ breakpoint }}</span>
                  <span 
                    v-if="layout.breakpoints.current.value === breakpoint"
                    class="text-green-600 dark:text-green-400"
                  >
                    ✓ Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Layout Mode Test -->
          <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">Layout Modes</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="mode in layoutModes"
                :key="mode"
                @click="testLayoutMode(mode)"
                :class="[
                  'px-4 py-2 rounded-lg border transition-colors',
                  layout.state.currentMode === mode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
              >
                {{ mode }}
              </button>
            </div>
          </div>

          <!-- Navigation Pattern Test -->
          <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">Navigation Patterns</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="pattern in navigationPatterns"
                :key="pattern"
                @click="testNavigationPattern(pattern)"
                :class="[
                  'px-4 py-2 rounded-lg border transition-colors',
                  layout.state.currentNavigation === pattern
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                ]"
              >
                {{ pattern }}
              </button>
            </div>
          </div>

          <!-- Transition Test -->
          <div class="mb-6">
            <h3 class="text-lg font-medium mb-3">Transition Tests</h3>
            <div class="flex flex-wrap gap-2">
              <button
                @click="testOrientationChange"
                class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Simulate Orientation Change
              </button>
              <button
                @click="testBreakpointChange"
                class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Simulate Breakpoint Change
              </button>
              <button
                @click="testStatePreservation"
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Test State Preservation
              </button>
            </div>
          </div>

          <!-- Current State Display -->
          <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 class="font-medium mb-2">Current Layout State</h4>
            <pre class="text-sm overflow-x-auto">{{ JSON.stringify(layoutState, null, 2) }}</pre>
          </div>
        </div>

        <!-- Test Content Blocks -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            v-for="i in 6"
            :key="i"
            class="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 class="text-lg font-medium mb-2">Test Block {{ i }}</h3>
            <p class="text-gray-600 dark:text-gray-400">
              This is test content block {{ i }} to demonstrate responsive layout behavior.
            </p>
            <div class="mt-4 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg"></div>
          </div>
        </div>
      </div>
    </main>

    <!-- Test Navigation -->
    <AdaptiveNavigation
      :items="testNavigationItems"
      :current-route="currentRoute"
      @navigate="handleNavigation"
      @action="handleNavigationAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLayout } from '../../composables/useLayout'
import CollapsibleHeader from './CollapsibleHeader.vue'
import AdaptiveNavigation from './AdaptiveNavigation.vue'
import type { NavigationItem } from './AdaptiveNavigation.vue'
import type { LayoutMode, NavigationPattern } from '../../composables/useLayout'
import { 
  HomeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  CommandLineIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/vue/24/outline'

// Initialize layout system
const layout = useLayout({
  enableAnimations: true,
  preserveState: true,
  autoCollapse: true
})

// Test state
const testMode = ref(false)
const currentRoute = ref('/test')

// Test data
const layoutModes: LayoutMode[] = ['single-column', 'two-column', 'three-column', 'sidebar', 'overlay', 'split']
const navigationPatterns: NavigationPattern[] = ['top', 'bottom', 'sidebar', 'overlay']

const testNavigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: HomeIcon,
    route: '/home'
  },
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
    route: '/chat',
    badge: 3
  }
]

// Computed properties
const layoutState = computed(() => ({
  breakpoint: layout.breakpoints.current.value,
  orientation: layout.breakpoints.orientation.value,
  layoutMode: layout.state.currentMode,
  navigation: layout.state.currentNavigation,
  headerState: layout.state.headerState,
  searchExpanded: layout.state.searchExpanded,
  sidebarVisible: layout.state.sidebarVisible,
  overlayVisible: layout.state.overlayVisible,
  isTransitioning: layout.state.isTransitioning,
  orientationChanged: layout.state.orientationChanged,
  safeArea: layout.breakpoints.safeArea.value,
  dimensions: {
    width: layout.breakpoints.width.value,
    height: layout.breakpoints.height.value
  }
}))

// Methods
const toggleTestMode = () => {
  testMode.value = !testMode.value
}

const handleSearch = (query: string) => {
  console.log('Search:', query)
}

const handleMenuClick = () => {
  if (layout.isNavigationPattern('sidebar')) {
    layout.toggleSidebar()
  } else if (layout.isNavigationPattern('overlay')) {
    layout.showOverlay()
  }
}

const testLayoutMode = (mode: LayoutMode) => {
  // Temporarily update configuration for testing
  const newConfig = { ...layout.config }
  newConfig[layout.breakpoints.current.value].mode = mode
  layout.updateConfiguration(newConfig)
}

const testNavigationPattern = (pattern: NavigationPattern) => {
  // Temporarily update configuration for testing
  const newConfig = { ...layout.config }
  newConfig[layout.breakpoints.current.value].navigation = pattern
  layout.updateConfiguration(newConfig)
}

const testOrientationChange = () => {
  // Simulate orientation change by triggering layout update
  layout.updateLayout()
}

const testBreakpointChange = () => {
  // Simulate breakpoint change
  const breakpoints = ['mobile', 'tablet', 'desktop'] as const
  const currentIndex = breakpoints.indexOf(layout.breakpoints.current.value)
  const nextIndex = (currentIndex + 1) % breakpoints.length
  const nextBreakpoint = breakpoints[nextIndex]
  
  layout.updateLayout(nextBreakpoint)
}

const testStatePreservation = async () => {
  // Test state preservation during layout changes
  await layout.preserveCurrentState()
  
  // Change layout
  testBreakpointChange()
  
  // Restore state after a delay
  setTimeout(async () => {
    await layout.restorePreservedState()
  }, 1000)
}

const handleNavigation = (item: NavigationItem) => {
  currentRoute.value = item.route || '/test'
  console.log('Navigate to:', item.route)
}

const handleNavigationAction = (item: NavigationItem) => {
  console.log('Navigation action:', item.id)
}
</script>

<style scoped>
.layout-test {
  min-height: 100vh;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
}

@media (prefers-color-scheme: dark) {
  .layout-test {
    background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
  }
}

/* Test-specific styles */
.layout-test pre {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.75rem;
  line-height: 1.4;
}

/* Transition visualization */
.layout-test.layout-transitioning {
  position: relative;
}

.layout-test.layout-transitioning::before {
  content: 'Transitioning...';
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  z-index: 9999;
  pointer-events: none;
}
</style>