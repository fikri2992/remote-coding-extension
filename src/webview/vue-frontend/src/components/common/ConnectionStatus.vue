<template>
  <div class="connection-status flex items-center space-x-2 text-sm">
    <!-- Connection Status Indicator -->
    <div class="flex items-center space-x-1">
      <div 
        class="w-2 h-2 rounded-full transition-colors duration-300"
        :class="statusColor"
      ></div>
      <span class="text-gray-600 dark:text-gray-300">{{ statusText }}</span>
    </div>
    
    <!-- Latency (when connected) -->
    <div v-if="connectionStore.isConnected && connectionStore.latency > 0" class="text-gray-500 text-xs">
      {{ connectionStore.latency }}ms
    </div>
    
    <!-- Error message (when error) -->
    <div v-if="connectionStore.hasError && connectionStore.lastError" class="text-red-500 text-xs max-w-xs truncate">
      {{ connectionStore.lastError }}
    </div>
    
    <!-- Reconnect attempts (when reconnecting) -->
    <div v-if="connectionStore.isReconnecting" class="text-yellow-500 text-xs">
      Attempt {{ connectionStore.reconnectAttempts }}/{{ connectionStore.maxReconnectAttempts }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '../../stores/connection'

const connectionStore = useConnectionStore()

const statusColor = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
    case 'reconnecting':
      return 'bg-yellow-500 animate-pulse'
    case 'disconnected':
      return 'bg-gray-400'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
})

const statusText = computed(() => {
  switch (connectionStore.connectionStatus) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting...'
    case 'reconnecting':
      return 'Reconnecting...'
    case 'disconnected':
      return 'Disconnected'
    case 'error':
      return 'Connection Error'
    default:
      return 'Unknown'
  }
})
</script>

<style scoped>
.connection-status {
  font-family: 'Inter', system-ui, sans-serif;
}
</style>