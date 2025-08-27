export interface WebSocketMessage {
  type: 'command' | 'response' | 'broadcast' | 'status' | 'ping' | 'pong' | 
        'chat_message' | 'chat_typing' | 'chat_presence' | 'chat_reaction' | 
        'chat_join_room' | 'chat_leave_room' | 'chat_create_room' | 
        'chat_edit_message' | 'chat_delete_message' | 'chat_add_reaction' | 
        'chat_remove_reaction' | 'chat_load_history' | 'chat_search' | 'chat_mark_read'
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
}

export interface PingMessage extends WebSocketMessage {
  type: 'ping'
  timestamp: number
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong'
  timestamp: number
}
