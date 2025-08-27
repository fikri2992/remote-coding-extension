export interface ChatMessage {
  id: string
  content: string
  type: 'text' | 'file' | 'image' | 'code' | 'system'
  author: ChatUser
  timestamp: number
  edited?: boolean
  editedAt?: number
  replyTo?: string
  reactions?: ChatReaction[]
  attachments?: ChatAttachment[]
  metadata?: ChatMessageMetadata
}

export interface ChatUser {
  id: string
  name: string
  avatar?: string
  status: 'online' | 'away' | 'busy' | 'offline'
  isTyping?: boolean
  lastSeen?: number
}

export interface ChatReaction {
  emoji: string
  users: string[]
  count: number
}

export interface ChatAttachment {
  id: string
  name: string
  type: 'file' | 'image' | 'video' | 'audio'
  size: number
  url: string
  mimeType: string
  thumbnail?: string
}

export interface ChatMessageMetadata {
  codeLanguage?: string
  fileName?: string
  lineNumbers?: boolean
  highlighted?: boolean
  mentions?: string[]
  links?: ChatLink[]
}

export interface ChatLink {
  url: string
  title?: string
  description?: string
  image?: string
}

export interface ChatRoom {
  id: string
  name: string
  description?: string
  type: 'direct' | 'group' | 'channel'
  participants: ChatUser[]
  lastMessage?: ChatMessage
  unreadCount: number
  isArchived: boolean
  createdAt: number
  updatedAt: number
}

export interface TypingIndicator {
  userId: string
  roomId: string
  timestamp: number
}

export interface ChatPresence {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline'
  lastSeen: number
  customStatus?: string
}

export interface ChatNotification {
  id: string
  type: 'message' | 'mention' | 'reaction' | 'join' | 'leave'
  roomId: string
  messageId?: string
  userId: string
  content: string
  timestamp: number
  read: boolean
}

export interface ChatSettings {
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
    mentions: boolean
    directMessages: boolean
  }
  appearance: {
    theme: 'light' | 'dark' | 'auto'
    fontSize: 'small' | 'medium' | 'large'
    showAvatars: boolean
    showTimestamps: boolean
    compactMode: boolean
  }
  privacy: {
    showOnlineStatus: boolean
    showTypingIndicator: boolean
    readReceipts: boolean
  }
}

export interface ChatHistory {
  roomId: string
  messages: ChatMessage[]
  hasMore: boolean
  oldestMessageId?: string
  newestMessageId?: string
}

export interface ChatDraft {
  roomId: string
  content: string
  attachments: ChatAttachment[]
  replyTo?: string
  timestamp: number
}

export interface ChatSearchResult {
  message: ChatMessage
  room: ChatRoom
  highlights: string[]
  context: ChatMessage[]
}

export interface ChatStats {
  totalMessages: number
  totalRooms: number
  activeUsers: number
  messagesPerDay: number
  mostActiveRoom: string
  favoriteEmojis: string[]
}

// WebSocket message types for chat
export interface ChatWebSocketMessage {
  type: 'chat_message' | 'chat_typing' | 'chat_presence' | 'chat_reaction' | 'chat_join' | 'chat_leave'
  roomId: string
  userId: string
  data: any
  timestamp: number
}

export interface ChatMessageWebSocketMessage extends ChatWebSocketMessage {
  type: 'chat_message'
  data: ChatMessage
}

export interface ChatTypingWebSocketMessage extends ChatWebSocketMessage {
  type: 'chat_typing'
  data: {
    isTyping: boolean
    user: ChatUser
  }
}

export interface ChatPresenceWebSocketMessage extends ChatWebSocketMessage {
  type: 'chat_presence'
  data: ChatPresence
}

export interface ChatReactionWebSocketMessage extends ChatWebSocketMessage {
  type: 'chat_reaction'
  data: {
    messageId: string
    reaction: ChatReaction
    action: 'add' | 'remove'
  }
}

export type ChatStatus = 'idle' | 'connecting' | 'connected' | 'sending' | 'error'

export interface ChatComposableState {
  status: ChatStatus
  currentUser: ChatUser | null
  rooms: ChatRoom[]
  activeRoomId: string | null
  messages: Map<string, ChatMessage[]>
  typingUsers: Map<string, ChatUser[]>
  onlineUsers: ChatUser[]
  notifications: ChatNotification[]
  drafts: Map<string, ChatDraft>
  settings: ChatSettings
}