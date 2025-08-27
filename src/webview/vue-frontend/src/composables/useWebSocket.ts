import { ref, onUnmounted, type Ref } from 'vue'
import type { 
  WebSocketMessage, 
  ConnectionStatus, 
  QueuedMessage, 
  ConnectionHealth, 
  WebSocketConfig,
  PingMessage,
  PongMessage
} from '../types/websocket'
import { 
  WS_RECONNECT_INTERVAL, 
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_HEARTBEAT_INTERVAL,
  WS_MESSAGE_TIMEOUT,
  WS_MAX_QUEUE_SIZE,
  WS_PING_TIMEOUT,
  WS_HEALTH_CHECK_INTERVAL,
  WS_MAX_CONSECUTIVE_FAILURES
} from '../utils/constants'
import { 
  isValidWebSocketMessage, 
  isValidPingMessage, 
  isValidPongMessage,
  createValidationError 
} from '../utils/websocket-validator'

export interface WebSocketComposable {
  // State
  isConnected: Ref<boolean>
  connectionStatus: Ref<ConnectionStatus>
  lastMessage: Ref<WebSocketMessage | null>
  health: Ref<ConnectionHealth>
  queueSize: Ref<number>

  // Methods
  connect: (url: string, config?: Partial<WebSocketConfig>) => Promise<void>
  disconnect: () => void
  sendMessage: (message: WebSocketMessage) => Promise<void>
  sendMessageWithResponse: (message: WebSocketMessage, timeout?: number) => Promise<any>
  clearQueue: () => void
  getConnectionInfo: () => { url: string | null; config: WebSocketConfig | null }

  // Event handlers
  onMessage: (callback: (message: WebSocketMessage) => void) => void
  onConnect: (callback: () => void) => void
  onDisconnect: (callback: () => void) => void
  onError: (callback: (error: Error) => void) => void
  onHealthChange: (callback: (health: ConnectionHealth) => void) => void
}

export function useWebSocket(): WebSocketComposable {
  const socket = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const lastMessage = ref<WebSocketMessage | null>(null)
  const reconnectAttempts = ref(0)
  const reconnectTimer = ref<NodeJS.Timeout | null>(null)
  const heartbeatTimer = ref<NodeJS.Timeout | null>(null)
  const healthCheckTimer = ref<NodeJS.Timeout | null>(null)
  const currentUrl = ref<string | null>(null)
  const currentConfig = ref<WebSocketConfig | null>(null)

  // Message queue for offline/reconnection scenarios
  const messageQueue = ref<QueuedMessage[]>([])
  const queueSize = ref(0)
  const pendingResponses = ref<Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>>(new Map())

  // Health monitoring
  const health = ref<ConnectionHealth>({
    latency: 0,
    lastPingTime: 0,
    lastPongTime: 0,
    isHealthy: true,
    consecutiveFailures: 0
  })

  // Event callbacks
  const messageCallbacks = ref<Array<(message: WebSocketMessage) => void>>([])
  const connectCallbacks = ref<Array<() => void>>([])
  const disconnectCallbacks = ref<Array<() => void>>([])
  const errorCallbacks = ref<Array<(error: Error) => void>>([])
  const healthCallbacks = ref<Array<(health: ConnectionHealth) => void>>([])

  const defaultConfig: WebSocketConfig = {
    url: '',
    maxReconnectAttempts: WS_MAX_RECONNECT_ATTEMPTS,
    reconnectInterval: WS_RECONNECT_INTERVAL,
    heartbeatInterval: WS_HEARTBEAT_INTERVAL,
    messageTimeout: WS_MESSAGE_TIMEOUT,
    maxQueueSize: WS_MAX_QUEUE_SIZE
  }

  const connect = async (url: string, config?: Partial<WebSocketConfig>): Promise<void> => {
    if (socket.value?.readyState === WebSocket.OPEN) {
      return
    }

    currentUrl.value = url
    currentConfig.value = { ...defaultConfig, ...config, url }
    connectionStatus.value = 'connecting'

    try {
      socket.value = new WebSocket(url)

      socket.value.onopen = () => {
        isConnected.value = true
        connectionStatus.value = 'connected'
        reconnectAttempts.value = 0
        health.value.consecutiveFailures = 0
        health.value.isHealthy = true

        // Clear any existing timers
        clearTimers()

        // Start health monitoring
        startHealthMonitoring()

        // Process queued messages
        processMessageQueue()

        // Trigger connect callbacks
        connectCallbacks.value.forEach(callback => {
          try {
            callback()
          } catch (error) {
            console.error('Error in connect callback:', error)
          }
        })
      }

      socket.value.onmessage = event => {
        try {
          const parsedMessage = JSON.parse(event.data)
          
          if (!isValidWebSocketMessage(parsedMessage)) {
            const error = createValidationError('Invalid message format', parsedMessage)
            triggerErrorCallbacks(error)
            return
          }

          const message = parsedMessage as WebSocketMessage
          lastMessage.value = message

          // Handle ping/pong for health monitoring
          if (isValidPingMessage(message)) {
            handlePingMessage(message)
            return
          }

          if (isValidPongMessage(message)) {
            handlePongMessage(message)
            return
          }

          // Handle response messages
          if (message.type === 'response' && message.id) {
            const pending = pendingResponses.value.get(message.id)
            if (pending) {
              clearTimeout(pending.timeout)
              pendingResponses.value.delete(message.id)
              
              if (message.error) {
                pending.reject(new Error(message.error))
              } else {
                pending.resolve(message.data)
              }
              return
            }
          }

          // Trigger message callbacks
          messageCallbacks.value.forEach(callback => {
            try {
              callback(message)
            } catch (error) {
              console.error('Error in message callback:', error)
            }
          })
        } catch (error) {
          const validationError = createValidationError('Failed to parse message', event.data)
          triggerErrorCallbacks(validationError)
        }
      }

      socket.value.onclose = (event) => {
        isConnected.value = false
        connectionStatus.value = 'disconnected'
        clearTimers()

        // Trigger disconnect callbacks
        disconnectCallbacks.value.forEach(callback => {
          try {
            callback()
          } catch (error) {
            console.error('Error in disconnect callback:', error)
          }
        })

        // Attempt to reconnect if not manually disconnected and under retry limit
        if (!event.wasClean && reconnectAttempts.value < (currentConfig.value?.maxReconnectAttempts || WS_MAX_RECONNECT_ATTEMPTS)) {
          attemptReconnect()
        } else if (reconnectAttempts.value >= (currentConfig.value?.maxReconnectAttempts || WS_MAX_RECONNECT_ATTEMPTS)) {
          connectionStatus.value = 'error'
          health.value.isHealthy = false
        }
      }

      socket.value.onerror = (error) => {
        console.error('WebSocket error:', error)
        connectionStatus.value = 'error'
        health.value.consecutiveFailures++
        health.value.isHealthy = false
        
        const wsError = new Error('WebSocket connection error')
        triggerErrorCallbacks(wsError)
        triggerHealthCallbacks()
      }
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      connectionStatus.value = 'error'
      const connectionError = error instanceof Error ? error : new Error('Connection failed')
      triggerErrorCallbacks(connectionError)
      throw connectionError
    }
  }

  const disconnect = (): void => {
    clearTimers()
    clearQueue()
    
    // Clear pending responses
    pendingResponses.value.forEach(({ reject, timeout }) => {
      clearTimeout(timeout)
      reject(new Error('Connection closed'))
    })
    pendingResponses.value.clear()

    reconnectAttempts.value = currentConfig.value?.maxReconnectAttempts || WS_MAX_RECONNECT_ATTEMPTS // Prevent reconnection

    if (socket.value) {
      socket.value.close(1000, 'Manual disconnect')
      socket.value = null
    }

    isConnected.value = false
    connectionStatus.value = 'disconnected'
    currentUrl.value = null
    currentConfig.value = null
  }

  const sendMessage = async (message: WebSocketMessage): Promise<void> => {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now()
    }

    // Validate message
    if (!isValidWebSocketMessage(message)) {
      throw createValidationError('Invalid message format', message)
    }

    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      // Queue message if not connected and queue has space
      if (messageQueue.value.length < (currentConfig.value?.maxQueueSize || WS_MAX_QUEUE_SIZE)) {
        const queuedMessage: QueuedMessage = {
          message,
          timestamp: Date.now(),
          retryCount: 0
        }
        messageQueue.value.push(queuedMessage)
        queueSize.value = messageQueue.value.length
        return
      } else {
        throw new Error('WebSocket is not connected and message queue is full')
      }
    }

    try {
      socket.value.send(JSON.stringify(message))
    } catch (error) {
      const sendError = error instanceof Error ? error : new Error('Failed to send message')
      triggerErrorCallbacks(sendError)
      throw sendError
    }
  }

  const sendMessageWithResponse = async (message: WebSocketMessage, timeout?: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      // Generate unique ID for the message
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      message.id = messageId

      // Set up timeout
      const timeoutMs = timeout || currentConfig.value?.messageTimeout || WS_MESSAGE_TIMEOUT
      const timeoutHandle = setTimeout(() => {
        pendingResponses.value.delete(messageId)
        reject(new Error(`Message timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      // Store pending response
      pendingResponses.value.set(messageId, { resolve, reject, timeout: timeoutHandle })

      // Send message
      sendMessage(message).catch(error => {
        clearTimeout(timeoutHandle)
        pendingResponses.value.delete(messageId)
        reject(error)
      })
    })
  }

  const clearQueue = (): void => {
    messageQueue.value = []
    queueSize.value = 0
  }

  const getConnectionInfo = () => ({
    url: currentUrl.value,
    config: currentConfig.value
  })

  // Private helper functions
  const attemptReconnect = (): void => {
    if (!currentUrl.value || reconnectAttempts.value >= (currentConfig.value?.maxReconnectAttempts || WS_MAX_RECONNECT_ATTEMPTS)) {
      connectionStatus.value = 'error'
      health.value.isHealthy = false
      triggerHealthCallbacks()
      return
    }

    reconnectAttempts.value++
    connectionStatus.value = 'reconnecting'

    // Exponential backoff: base interval * (2 ^ attempts) with jitter
    const baseInterval = currentConfig.value?.reconnectInterval || WS_RECONNECT_INTERVAL
    const backoffMultiplier = Math.pow(2, Math.min(reconnectAttempts.value - 1, 5)) // Cap at 2^5 = 32
    const jitter = Math.random() * 0.3 + 0.85 // 85-115% of calculated time
    const delay = Math.min(baseInterval * backoffMultiplier * jitter, 30000) // Cap at 30 seconds

    reconnectTimer.value = setTimeout(() => {
      if (currentUrl.value) {
        connect(currentUrl.value, currentConfig.value || undefined).catch(() => {
          // Connection failed, will try again if under limit
        })
      }
    }, delay)
  }

  const processMessageQueue = (): void => {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      return
    }

    const messagesToProcess = [...messageQueue.value]
    messageQueue.value = []
    queueSize.value = 0

    messagesToProcess.forEach(queuedMessage => {
      try {
        socket.value?.send(JSON.stringify(queuedMessage.message))
      } catch (error) {
        console.error('Failed to send queued message:', error)
        // Re-queue if there's space
        if (messageQueue.value.length < (currentConfig.value?.maxQueueSize || WS_MAX_QUEUE_SIZE)) {
          queuedMessage.retryCount++
          if (queuedMessage.retryCount < 3) { // Max 3 retries
            messageQueue.value.push(queuedMessage)
          }
        }
      }
    })

    queueSize.value = messageQueue.value.length
  }

  const startHealthMonitoring = (): void => {
    const heartbeatInterval = currentConfig.value?.heartbeatInterval || WS_HEARTBEAT_INTERVAL

    // Send periodic pings
    heartbeatTimer.value = setInterval(() => {
      if (socket.value?.readyState === WebSocket.OPEN) {
        const pingMessage: PingMessage = {
          type: 'ping',
          timestamp: Date.now()
        }
        health.value.lastPingTime = pingMessage.timestamp
        
        try {
          socket.value.send(JSON.stringify(pingMessage))
        } catch (error) {
          console.error('Failed to send ping:', error)
          health.value.consecutiveFailures++
          health.value.isHealthy = false
          triggerHealthCallbacks()
        }
      }
    }, heartbeatInterval)

    // Check health status
    healthCheckTimer.value = setInterval(() => {
      const now = Date.now()
      const timeSinceLastPong = now - health.value.lastPongTime
      const timeSinceLastPing = now - health.value.lastPingTime

      // If we haven't received a pong in a while, mark as unhealthy
      if (timeSinceLastPong > WS_PING_TIMEOUT && timeSinceLastPing < WS_PING_TIMEOUT) {
        health.value.consecutiveFailures++
        if (health.value.consecutiveFailures >= WS_MAX_CONSECUTIVE_FAILURES) {
          health.value.isHealthy = false
          triggerHealthCallbacks()
        }
      }
    }, WS_HEALTH_CHECK_INTERVAL)
  }

  const handlePingMessage = (message: PingMessage): void => {
    // Respond with pong
    const pongMessage: PongMessage = {
      type: 'pong',
      timestamp: message.timestamp
    }

    try {
      socket.value?.send(JSON.stringify(pongMessage))
    } catch (error) {
      console.error('Failed to send pong:', error)
    }
  }

  const handlePongMessage = (message: PongMessage): void => {
    const now = Date.now()
    health.value.lastPongTime = now
    health.value.latency = now - message.timestamp
    health.value.consecutiveFailures = 0
    health.value.isHealthy = true
    triggerHealthCallbacks()
  }

  const clearTimers = (): void => {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value)
      heartbeatTimer.value = null
    }
    if (healthCheckTimer.value) {
      clearInterval(healthCheckTimer.value)
      healthCheckTimer.value = null
    }
  }

  const triggerErrorCallbacks = (error: Error): void => {
    errorCallbacks.value.forEach(callback => {
      try {
        callback(error)
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError)
      }
    })
  }

  const triggerHealthCallbacks = (): void => {
    healthCallbacks.value.forEach(callback => {
      try {
        callback(health.value)
      } catch (error) {
        console.error('Error in health callback:', error)
      }
    })
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

  const onError = (callback: (error: Error) => void): void => {
    errorCallbacks.value.push(callback)
  }

  const onHealthChange = (callback: (health: ConnectionHealth) => void): void => {
    healthCallbacks.value.push(callback)
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
    health,
    queueSize,

    // Methods
    connect,
    disconnect,
    sendMessage,
    sendMessageWithResponse,
    clearQueue,
    getConnectionInfo,

    // Event handlers
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    onHealthChange
  }
}
