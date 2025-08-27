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
  maxReconnectAttempts: number
  reconnectDelay: number
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
  const maxReconnectAttempts = ref(5)
  const reconnectDelay = ref(1000) // Base delay in ms
  const lastError = ref<string | null>(null)

  // Getters
  const status = computed(() => connectionStatus.value)
  const isConnecting = computed(() => connectionStatus.value === 'connecting')
  const isReconnecting = computed(() => connectionStatus.value === 'reconnecting')
  const hasError = computed(() => connectionStatus.value === 'error')
  const canReconnect = computed(() => reconnectAttempts.value < maxReconnectAttempts.value)
  const nextReconnectDelay = computed(() => {
    // Exponential backoff: base delay * 2^attempts
    return Math.min(reconnectDelay.value * Math.pow(2, reconnectAttempts.value), 30000)
  })

  // Actions
  const connect = async (url: string) => {
    serverUrl.value = url
    connectionStatus.value = 'connecting'
    lastError.value = null
    // Connection logic will be implemented in WebSocket composable
  }

  const disconnect = () => {
    isConnected.value = false
    connectionId.value = null
    connectionStatus.value = 'disconnected'
    lastError.value = null
    resetReconnectAttempts()
  }

  const setConnected = (id: string) => {
    isConnected.value = true
    connectionId.value = id
    connectionStatus.value = 'connected'
    lastConnected.value = new Date()
    lastError.value = null
    resetReconnectAttempts()
  }

  const setConnectionStatus = (status: ConnectionStatus, error?: string) => {
    connectionStatus.value = status
    if (error) {
      lastError.value = error
    }
    if (status === 'disconnected' || status === 'error') {
      isConnected.value = false
      connectionId.value = null
    }
  }

  const updateLatency = (newLatency: number) => {
    latency.value = newLatency
  }

  const incrementReconnectAttempts = () => {
    reconnectAttempts.value++
  }

  const resetReconnectAttempts = () => {
    reconnectAttempts.value = 0
  }

  const setReconnectConfig = (maxAttempts: number, baseDelay: number) => {
    maxReconnectAttempts.value = maxAttempts
    reconnectDelay.value = baseDelay
  }

  return {
    // State
    isConnected,
    serverUrl,
    connectionId,
    lastConnected,
    reconnectAttempts,
    latency,
    maxReconnectAttempts,
    reconnectDelay,
    lastError,
    // Getters
    connectionStatus: status,
    isConnecting,
    isReconnecting,
    hasError,
    canReconnect,
    nextReconnectDelay,
    // Actions
    connect,
    disconnect,
    setConnected,
    setConnectionStatus,
    updateLatency,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    setReconnectConfig
  }
})
