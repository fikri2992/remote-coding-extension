import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ConnectionStatus } from '../types/websocket'

export interface ConnectionState {
  isConnected: boolean
  serverUrl: string
  connectionId: string | null
  lastConnected: Date | null
  reconnectAttempts: number
  latency: number
}

export const useConnectionStore = defineStore('connection', () => {
  // State
  const isConnected = ref(false)
  const serverUrl = ref('')
  const connectionId = ref<string | null>(null)
  const lastConnected = ref<Date | null>(null)
  const reconnectAttempts = ref(0)
  const latency = ref(0)
  const connectionStatus = ref<ConnectionStatus>('disconnected')

  // Getters - keeping computed for backward compatibility
  const status = computed(() => connectionStatus.value)

  // Actions
  const connect = async (url: string) => {
    serverUrl.value = url
    connectionStatus.value = 'connecting'
    // Connection logic will be implemented in WebSocket composable
  }

  const disconnect = () => {
    isConnected.value = false
    connectionId.value = null
    connectionStatus.value = 'disconnected'
  }

  const setConnectionStatus = (status: ConnectionStatus) => {
    connectionStatus.value = status
  }

  const updateLatency = (newLatency: number) => {
    latency.value = newLatency
  }

  const resetReconnectAttempts = () => {
    reconnectAttempts.value = 0
  }

  return {
    // State
    isConnected,
    serverUrl,
    connectionId,
    lastConnected,
    reconnectAttempts,
    latency,
    connectionStatus: status,
    // Actions
    connect,
    disconnect,
    updateLatency,
    resetReconnectAttempts,
    setConnectionStatus
  }
})