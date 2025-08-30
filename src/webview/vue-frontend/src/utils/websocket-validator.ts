import type { 
  WebSocketMessage, 
  CommandMessage, 
  ResponseMessage, 
  BroadcastMessage, 
  StatusMessage, 
  PingMessage, 
  PongMessage,
  MobileGestureMessage,
  MobileLayoutMessage,
  MobilePreviewMessage,
  MobileHapticMessage,
  MobileSyncMessage
} from '../types/websocket'

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
  const validTypes = [
    'command', 'response', 'broadcast', 'status', 'ping', 'pong',
    'chat_message', 'chat_typing', 'chat_presence', 'chat_reaction', 
    'chat_join_room', 'chat_leave_room', 'chat_create_room', 
    'chat_edit_message', 'chat_delete_message', 'chat_add_reaction', 
    'chat_remove_reaction', 'chat_load_history', 'chat_search', 'chat_mark_read',
    'mobile_gesture', 'mobile_layout', 'mobile_preview', 'mobile_haptic', 'mobile_sync'
  ]
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
 * Validate if an object is a valid mobile gesture message
 */
export function isValidMobileGestureMessage(obj: any): obj is MobileGestureMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'mobile_gesture') {
    return false
  }
  
  const data = obj.data
  return data && 
    typeof data.gestureType === 'string' &&
    typeof data.target === 'string' &&
    data.coordinates &&
    typeof data.coordinates.x === 'number' &&
    typeof data.coordinates.y === 'number'
}

/**
 * Validate if an object is a valid mobile layout message
 */
export function isValidMobileLayoutMessage(obj: any): obj is MobileLayoutMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'mobile_layout') {
    return false
  }
  
  const data = obj.data
  return data &&
    typeof data.breakpoint === 'string' &&
    typeof data.orientation === 'string' &&
    data.viewportSize &&
    typeof data.viewportSize.width === 'number' &&
    typeof data.viewportSize.height === 'number'
}

/**
 * Validate if an object is a valid mobile preview message
 */
export function isValidMobilePreviewMessage(obj: any): obj is MobilePreviewMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'mobile_preview') {
    return false
  }
  
  const data = obj.data
  return data &&
    typeof data.path === 'string' &&
    typeof data.previewType === 'string' &&
    typeof data.action === 'string'
}

/**
 * Validate if an object is a valid mobile haptic message
 */
export function isValidMobileHapticMessage(obj: any): obj is MobileHapticMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'mobile_haptic') {
    return false
  }
  
  const data = obj.data
  return data &&
    typeof data.type === 'string' &&
    typeof data.trigger === 'string'
}

/**
 * Validate if an object is a valid mobile sync message
 */
export function isValidMobileSyncMessage(obj: any): obj is MobileSyncMessage {
  if (!isValidWebSocketMessage(obj) || obj.type !== 'mobile_sync') {
    return false
  }
  
  const data = obj.data
  return data &&
    typeof data.syncType === 'string' &&
    typeof data.timestamp === 'number'
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