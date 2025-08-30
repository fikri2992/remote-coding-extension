<template>
  <div class="layout-demo p-6 space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        Adaptive Layout Management Demo
      </h2>
      
      <!-- Current Layout State -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Current Breakpoint</h3>
          <p class="text-lg font-mono text-blue-600 dark:text-blue-400">
            {{ layout.breakpoints.current.value }}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ layout.breakpoints.width.value }}px × {{ layout.breakpoints.height.value }}px
          </p>
        </div>
        
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Layout Mode</h3>
          <p class="text-lg font-mono text-green-600 dark:text-green-400">
            {{ layout.state.currentMode }}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Navigation: {{ layout.state.currentNavigation }}
          </p>
        </div>
        
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Header State</h3>
          <p class="text-lg font-mono text-purple-600 dark:text-purple-400">
            {{ layout.state.headerState }}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Search: {{ layout.state.searchExpanded ? 'Expanded' : 'Collapsed' }}
          </p>
        </div>
      </div>

      <!-- Layout Controls -->
      <div class="space-y-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Layout Controls</h3>
        
        <div class="flex flex-wrap gap-3">
          <button
            @click="layout.toggleHeader()"
            :disabled="!layout.isCollapsibleHeader"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Toggle Header
          </button>
          
          <button
            @click="layout.toggleSearch()"
            :disabled="!layout.isCollapsibleSearch"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Toggle Search
          </button>
          
          <button
            @click="layout.toggleSidebar()"
            class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Toggle Sidebar
          </button>
          
          <button
            v-if="layout.breakpoints.isMobile.value"
            @click="layout.showOverlay()"
            class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Show Overlay
          </button>
        </div>
      </div>

      <!-- Orientation and Safe Area Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Orientation</h3>
          <p class="text-lg font-mono text-indigo-600 dark:text-indigo-400">
            {{ layout.breakpoints.orientation.value }}
          </p>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            <p>Changed: {{ layout.state.orientationChanged ? 'Yes' : 'No' }}</p>
            <p>Transitioning: {{ layout.state.isTransitioning ? 'Yes' : 'No' }}</p>
          </div>
        </div>
        
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Safe Area</h3>
          <div class="text-sm font-mono text-gray-700 dark:text-gray-300 space-y-1">
            <p>Top: {{ layout.breakpoints.safeArea.value.top }}px</p>
            <p>Bottom: {{ layout.breakpoints.safeArea.value.bottom }}px</p>
            <p>Left: {{ layout.breakpoints.safeArea.value.left }}px</p>
            <p>Right: {{ layout.breakpoints.safeArea.value.right }}px</p>
          </div>
        </div>
      </div>

      <!-- Layout Classes Preview -->
      <div class="mt-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Applied Layout Classes</h3>
        <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <code class="text-sm text-gray-800 dark:text-gray-200 break-all">
            {{ layout.layoutClasses.join(' ') }}
          </code>
        </div>
      </div>

      <!-- Configuration Preview -->
      <div class="mt-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Current Configuration</h3>
        <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <pre class="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">{{ JSON.stringify(layout.currentLayoutConfig, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLayout } from '../../composables/useLayout'

// Initialize layout system
const layout = useLayout({
  enableAnimations: true,
  preserveState: true,
  autoCollapse: true
})
</script>

<style scoped>
.layout-demo {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Ensure proper contrast in dark mode */
@media (prefers-color-scheme: dark) {
  .layout-demo {
    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
  }
}
</style>