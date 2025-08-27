import { ref, onUnmounted, type Ref } from 'vue'
import type { WebSocketMessage, ConnectionStatus } from '../types/websocket'
import { WS_RECONNECT_INTERVAL, WS_MAX_RECONNECT_ATTEMPTS } from '../utils/constants'

export interface WebSocketComposable {
  // State
  isConnected: Ref<boolean>
  connectionStatus: Ref<ConnectionStatus>
  lastMessage: Ref<WebSocketMessage | null>
  
  // Methods
  connect: (url: string) => Promise<void>
  disconnect: () => void
  sendMessage: (message: WebSocketMessage) => void
  
  // Event handlers
  onMessage: (callback: (message: WebSocketMessage) => void) => void
  onConnect: (callback: () => void) => void
  onDisconnect: (callback: () => void) => void
}

export function useWebSocket(): WebSocketComposable {
  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const lastMessage = ref<WebSocketMessage | null>(null)
  const reconnectAttempts = ref(0)
  const reconnectTimer = ref<NodeJS.Timeout | null>(null)
  
  // Event callbacks
  const messageCallbacks = ref<Array<(message: WebSocketMessage) => void>>([])
  const connectCallbacks = ref<Array<() => void>>([])
  const disconnectCallbacks = ref<Array<() => void>>([])

  const connect = async (url: string): Promise<void> => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      return
    }

    connectionStatus.value = 'connecting'
    
    try {
      socket.value = new WebSocket(url)
      
      socket.value.onopen = () => {
        isConnected.value = true
        connectionStatus.value = 'connected'
        reconnectAttempts.value = 0
        
        // Clear any existing reconnect timer
        if (reconnectTimer.value) {
          clearTimeout(reconnectTimer.value)
          reconnectTimer.value = null
        }
        
        // Trigger connect callbacks
        connectCallbacks.value.forEach(callback => callback())
      }
      
      socket.value.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          lastMessage.value = message
          
          // Trigger message callbacks
          messageCallbacks.value.forEach(callback => callback(message))
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      socket.value.onclose = () => {
        isConnected.value = false
        connectionStatus.value = 'disconnected'
        
        // Trigger disconnect callbacks
        disconnectCallbacks.value.forEach(callback => callback())
        
        // Attempt to reconnect if not manually disconnected
        if (reconnectAttempts.value < WS_MAX_RECONNECT_ATTEMPTS) {
          attemptReconnect(url)
        }
      }
      
      socket.value.onerror = (error) => {
        console.error('WebSocket error:', error)
        connectionStatus.value = 'error'
      }
      
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      connectionStatus.value = 'error'
      throw error
    }
  }

  const disconnect = (): void => {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }
    
    reconnectAttempts.value = WS_MAX_RECONNECT_ATTEMPTS // Prevent reconnection
    
    if (socket.value) {
      socket.value.close()
      socket.value = null
    }
    
    isConnected.value = false
    connectionStatus.value = 'disconnected'
  }

  const sendMessage = (message: WebSocketMessage): void => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected')
      return
    }
    
    try {
      socket.value.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
    }
  }

  const attemptReconnect = (url: string): void => {
    if (reconnectAttempts.value >= WS_MAX_RECONNECT_ATTEMPTS) {
      connectionStatus.value = 'error'
      return
    }
    
    reconnectAttempts.value++
    connectionStatus.value = 'reconnecting'
    
    reconnectTimer.value = setTimeout(() => {
      connect(url).catch(() => {
        // Connection failed, will try again if under limit
      })
    }, WS_RECONNECT_INTERVAL)
  }

  // Event handler registration
  const onMessage = (callback: (message: WebSocketMessage) => void): void => {
    messageCallbacks.value.push(callback)
  }

  const onConnect = (callback: () => void): void => {
    connectCallbacks.value.push(callback)
  }

  const onDisconnect = (callback: () => void): void => {
    disconnectCallbacks.value.push(callback)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    // State
    isConnected,
    connectionStatus,
    lastMessage,
    
    // Methods
    connect,
    disconnect,
    sendMessage,
    
    // Event handlers
    onMessage,
    onConnect,
    onDisconnect
  }
}