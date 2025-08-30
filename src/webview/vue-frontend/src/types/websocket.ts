export interface WebSocketMessage {
  type: 'command' | 'response' | 'broadcast' | 'status' | 'ping' | 'pong' | 
        'chat_message' | 'chat_typing' | 'chat_presence' | 'chat_reaction' | 
        'chat_join_room' | 'chat_leave_room' | 'chat_create_room' | 
        'chat_edit_message' | 'chat_delete_message' | 'chat_add_reaction' | 
        'chat_remove_reaction' | 'chat_load_history' | 'chat_search' | 'chat_mark_read' |
        'mobile_gesture' | 'mobile_layout' | 'mobile_preview' | 'mobile_haptic' | 'mobile_sync'
  id?: string
  command?: string
  args?: any[] | undefined
  data?: any
  error?: string
  timestamp: number
  roomId?: string
  userId?: string
}

export interface CommandMessage extends WebSocketMessage {
  type: 'command'
  command: string
  args?: any[] | undefined
}

export interface ResponseMessage extends WebSocketMessage {
  type: 'response'
  id: string
  data?: any
  error?: string
}

export interface BroadcastMessage extends WebSocketMessage {
  type: 'broadcast'
  data: any
}

export interface StatusMessage extends WebSocketMessage {
  type: 'status'
  data: {
    connected: boolean
    clientCount: number
    serverTime: number
  }
}

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error'

export interface QueuedMessage {
  message: WebSocketMessage
  timestamp: number
  retryCount: number
  resolve?: (value: any) => void
  reject?: (error: any) => void
}

export interface ConnectionHealth {
  latency: number
  lastPingTime: number
  lastPongTime: number
  isHealthy: boolean
  consecutiveFailures: number
}

export interface WebSocketConfig {
  url: string
  maxReconnectAttempts: number
  reconnectInterval: number
  heartbeatInterval: number
  messageTimeout: number
  maxQueueSize: number
  // Mobile-specific configuration
  mobile?: {
    bandwidthAware: boolean
    adaptiveRetry: boolean
    gestureReporting: boolean
    layoutSync: boolean
    hapticFeedback: boolean
    connectionQualityThreshold: number // 0-1, below which to enable bandwidth-aware mode
    maxRetryBackoff: number // Maximum backoff time in ms
    priorityMessageTypes: string[] // Message types that bypass queue limits
  }
}

export interface MobileConnectionState {
  isMobile: boolean
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor'
  bandwidth: {
    downlink?: number // Mbps
    effectiveType?: '2g' | '3g' | '4g' | 'slow-2g'
    rtt?: number // Round trip time in ms
  }
  batteryLevel?: number // 0-1
  isLowPowerMode?: boolean
  networkType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
}

export interface PingMessage extends WebSocketMessage {
  type: 'ping'
  timestamp: number
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong'
  timestamp: number
}

// Mobile-specific message types
export interface MobileGestureMessage extends WebSocketMessage {
  type: 'mobile_gesture'
  data: {
    gestureType: 'swipe' | 'pinch' | 'pan' | 'tap' | 'longpress' | 'pullrefresh'
    target: string // File path or element identifier
    coordinates: { x: number; y: number }
    velocity?: { x: number; y: number }
    scale?: number
    direction?: 'left' | 'right' | 'up' | 'down'
    distance?: number
    duration?: number
    metadata?: Record<string, any>
  }
}

export interface MobileLayoutMessage extends WebSocketMessage {
  type: 'mobile_layout'
  data: {
    breakpoint: 'mobile' | 'tablet' | 'desktop'
    orientation: 'portrait' | 'landscape'
    safeArea: { top: number; bottom: number; left: number; right: number }
    viewportSize: { width: number; height: number }
    preferences: {
      layout: 'list' | 'grid' | 'compact'
      density: number
      theme: 'light' | 'dark' | 'auto'
    }
  }
}

export interface MobilePreviewMessage extends WebSocketMessage {
  type: 'mobile_preview'
  data: {
    path: string
    previewType: 'image' | 'code' | 'markdown' | 'text'
    action: 'open' | 'close' | 'navigate'
    metadata?: {
      zoom?: number
      position?: { x: number; y: number }
      lineNumber?: number
      selection?: { start: number; end: number }
    }
  }
}

export interface MobileHapticMessage extends WebSocketMessage {
  type: 'mobile_haptic'
  data: {
    type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification'
    pattern?: number[]
    trigger: string // What triggered the haptic feedback
  }
}

export interface MobileSyncMessage extends WebSocketMessage {
  type: 'mobile_sync'
  data: {
    syncType: 'layout_state' | 'gesture_preferences' | 'cache_invalidation' | 'connection_quality'
    payload: any
    clientId?: string
    timestamp: number
  }
}
