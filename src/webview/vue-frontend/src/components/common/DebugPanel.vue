<template>
  <div
    v-if="isVisible"
    class="fixed bottom-4 left-4 bg-black bg-opacity-90 text-white p-4 rounded-lg shadow-lg max-w-md z-50"
  >
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold">Debug Panel</h3>
      <button
        @click="toggleVisibility"
        class="text-white hover:text-gray-300 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <div class="space-y-2 text-xs font-mono">
      <div>
        <span class="text-gray-400">Screen:</span>
        <span class="ml-2">{{ windowWidth }}px</span>
        <span class="ml-2 text-gray-400">
          ({{ windowWidth < 768 ? 'Mobile' : windowWidth < 1024 ? 'Tablet' : 'Desktop' }})
        </span>
      </div>
      
      <div>
        <span class="text-gray-400">Sidebar:</span>
        <span class="ml-2">{{ uiStore.sidebarCollapsed ? 'Collapsed' : 'Expanded' }}</span>
      </div>
      
      <div>
        <span class="text-gray-400">Theme:</span>
        <span class="ml-2 capitalize">{{ uiStore.theme }}</span>
      </div>
      
      <div>
        <span class="text-gray-400">View:</span>
        <span class="ml-2 capitalize">{{ uiStore.activeView }}</span>
      </div>
      
      <div>
        <span class="text-gray-400">Connection:</span>
        <span 
          class="ml-2 capitalize" 
          :class="{
            'text-green-400': connectionStore.connectionStatus === 'connected',
            'text-yellow-400': connectionStore.connectionStatus === 'connecting',
            'text-red-400': connectionStore.connectionStatus === 'disconnected'
          }"
        >
          {{ connectionStore.connectionStatus }}
        </span>
      </div>
      
      <div v-if="connectionStore.isConnected">
        <span class="text-gray-400">Latency:</span>
        <span class="ml-2">{{ connectionStore.latency }}ms</span>
      </div>
    </div>
    
    <div class="mt-3 pt-2 border-t border-gray-600">
      <button
        @click="uiStore.toggleTheme"
        class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mr-2 transition-colors"
      >
        Toggle Theme
      </button>
      <button
        @click="uiStore.toggleSidebar"
        class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
      >
        Toggle Sidebar
      </button>
    </div>
  </div>
  
  <!-- Toggle button when panel is hidden -->
  <button
    v-else
    @click="toggleVisibility"
    class="fixed bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded-full shadow-lg z-50 hover:bg-opacity-90 transition-all"
    title="Show Debug Panel"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUIStore, useConnectionStore } from '../../stores'

const uiStore = useUIStore()
const connectionStore = useConnectionStore()

const isVisible = ref(false)
const windowWidth = ref(window.innerWidth)

const toggleVisibility = () => {
  isVisible.value = !isVisible.value
}

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', updateWindowWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>