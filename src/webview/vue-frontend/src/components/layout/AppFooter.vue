<template>
  <footer class="bg-white dark:bg-secondary-800 border-t border-secondary-200 dark:border-secondary-700 px-4 sm:px-6 py-2 sm:py-3 mt-auto">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-secondary-600 dark:text-secondary-400">
      <!-- Status info -->
      <div class="flex flex-wrap items-center gap-3 sm:gap-6">
        <!-- Server Status -->
        <div class="flex items-center gap-2">
          <span class="hidden sm:inline">Server:</span>
          <span class="sm:hidden">Srv:</span>
          <span class="font-mono text-xs truncate max-w-32 sm:max-w-none" :title="connectionStore.serverUrl || 'Not connected'">
            {{ connectionStore.serverUrl || 'Not connected' }}
          </span>
        </div>
        
        <!-- Latency (only show when connected) -->
        <div v-if="connectionStore.isConnected" class="flex items-center gap-2">
          <span class="hidden sm:inline">Latency:</span>
          <span class="sm:hidden">Lat:</span>
          <span class="font-mono text-xs">{{ connectionStore.latency }}ms</span>
        </div>
        
        <!-- Current View -->
        <div class="flex items-center gap-2">
          <span class="hidden sm:inline">View:</span>
          <span class="sm:hidden">View:</span>
          <span class="capitalize">{{ uiStore.activeView }}</span>
        </div>
      </div>

      <!-- App info -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4 text-xs">
        <span class="font-medium">Vue.js Frontend v1.0.0</span>
        <span class="hidden sm:inline">•</span>
        <span class="text-secondary-500 dark:text-secondary-500">{{ new Date().getFullYear() }} Web Automation Tunnel</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useUIStore, useConnectionStore } from '../../stores'

const uiStore = useUIStore()
const connectionStore = useConnectionStore()
</script>