import type { WebSocketMessage, CommandMessage, ResponseMessage, BroadcastMessage, StatusMessage, PingMessage, PongMessage } from '../types/websocket'

/**
 * Validates if an object is a valid WebSocket message
 */
export function isValidWebSocketMessage(obj: any): obj is WebSocketMessage {
  if (!obj || typeof obj !== 'object') {
    return false
  }

  // Check required fields
  if (!obj.type || typeof obj.type !== 'string') {
    return false
  }

  if (!obj.timestamp || typeof obj.timestamp !== 'number') {
    return false
  }

  // Validate message type
  const validTypes = ['command', 'response', 'broadcast', 'status', 'ping', 'pong']
  if (!validTypes.includes(obj.type)) {
    return false
  }

  return true
}

/**
 * Validates a command message
 */
export function isValidCommandMessage(obj: any): obj is CommandMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'command') {
    return false
  }

  return typeof obj.command === 'string' && obj.command.length > 0
}

/**
 * Validates a response message
 */
export function isValidResponseMessage(obj: any): obj is ResponseMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'response') {
    return false
  }

  return typeof obj.id === 'string' && obj.id.length > 0
}

/**
 * Validates a broadcast message
 */
export function isValidBroadcastMessage(obj: any): obj is BroadcastMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'broadcast') {
    return false
  }

  return obj.data !== undefined
}

/**
 * Validates a status message
 */
export function isValidStatusMessage(obj: any): obj is StatusMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'status') {
    return false
  }

  return obj.data && typeof obj.data === 'object' &&
    typeof obj.data.connected === 'boolean' &&
    typeof obj.data.clientCount === 'number' &&
    typeof obj.data.serverTime === 'number'
}

/**
 * Validates a ping message
 */
export function isValidPingMessage(obj: any): obj is PingMessage {
  return isValidWebSocketMessage(obj) && obj.type === 'ping'
}

/**
 * Validates a pong message
 */
export function isValidPongMessage(obj: any): obj is PongMessage {
  return isValidWebSocketMessage(obj) && obj.type === 'pong'
}

/**
 * Creates a standardized error for invalid messages
 */
export function createValidationError(message: string, receivedData?: any): Error {
  const error = new Error(`WebSocket message validation failed: ${message}`)
  if (receivedData) {
    console.warn('Invalid message data:', receivedData)
  }
  return error
}