<template>
  <footer class="bg-white border-t border-secondary-200 px-6 py-3 mt-auto">
    <div class="flex items-center justify-between text-sm text-secondary-600">
      <!-- Left side - Status info -->
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <span>Server:</span>
          <span class="font-mono text-xs">
            {{ connectionStore.serverUrl || 'Not connected' }}
          </span>
        </div>
        
        <div v-if="connectionStore.isConnected" class="flex items-center gap-2">
          <span>Latency:</span>
          <span class="font-mono text-xs">{{ connectionStore.latency }}ms</span>
        </div>
        
        <div class="flex items-center gap-2">
          <span>View:</span>
          <span class="capitalize">{{ uiStore.activeView }}</span>
        </div>
      </div>

      <!-- Right side - App info -->
      <div class="flex items-center gap-4">
        <span>Vue.js Frontend v1.0.0</span>
        <span>•</span>
        <span>{{ new Date().getFullYear() }} Web Automation Tunnel</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useUIStore, useConnectionStore } from '../../stores'

const uiStore = useUIStore()
const connectionStore = useConnectionStore()
</script>