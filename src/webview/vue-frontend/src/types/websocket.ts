export interface WebSocketMessage {
  type: 'command' | 'response' | 'broadcast' | 'status'
  id?: string
  command?: string
  args?: any[]
  data?: any
  error?: string
  timestamp: number
}

export interface CommandMessage extends WebSocketMessage {
  type: 'command'
  command: string
  args?: any[]
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
