import { ref, computed, onUnmounted, watch, type Ref } from 'vue'
import type {
  ChatMessage,
  ChatUser,
  ChatRoom,
  ChatAttachment,
  ChatDraft,
  ChatSettings,
  ChatNotification,
  ChatHistory,
  ChatSearchResult,
  ChatStats,
  ChatStatus,
  ChatMessageWebSocketMessage,
  ChatTypingWebSocketMessage,
  ChatPresenceWebSocketMessage,
  ChatReactionWebSocketMessage
} from '../types/chat'
import { useWebSocket } from './useWebSocket'
import {
  CHAT_TYPING_TIMEOUT,
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_MAX_ATTACHMENTS,
  CHAT_HISTORY_PAGE_SIZE,
  CHAT_MAX_NOTIFICATIONS,
  CHAT_MAX_DRAFT_AGE,
  STORAGE_KEYS
} from '../utils/constants'

export interface ChatComposable {
  // State
  status: Ref<ChatStatus>
  currentUser: Ref<ChatUser | null>
  rooms: Ref<ChatRoom[]>
  activeRoomId: Ref<string | null>
  activeRoom: Ref<ChatRoom | null>
  messages: Ref<Map<string, ChatMessage[]>>
  typingUsers: Ref<Map<string, ChatUser[]>>
  onlineUsers: Ref<ChatUser[]>
  notifications: Ref<ChatNotification[]>
  unreadCount: Ref<number>
  drafts: Ref<Map<string, ChatDraft>>
  settings: Ref<ChatSettings>
  stats: Ref<ChatStats>

  // Methods
  connect: (userId: string, userInfo: Partial<ChatUser>) => Promise<void>
  disconnect: () => void
  sendMessage: (roomId: string, content: string, attachments?: ChatAttachment[], replyTo?: string) => Promise<ChatMessage>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  addReaction: (messageId: string, emoji: string) => Promise<void>
  removeReaction: (messageId: string, emoji: string) => Promise<void>
  
  // Room management
  joinRoom: (roomId: string) => Promise<void>
  leaveRoom: (roomId: string) => Promise<void>
  createRoom: (name: string, type: 'direct' | 'group' | 'channel', participants?: string[]) => Promise<ChatRoom>
  setActiveRoom: (roomId: string | null) => void
  
  // Typing indicators
  startTyping: (roomId: string) => void
  stopTyping: (roomId: string) => void
  
  // Presence
  updatePresence: (status: 'online' | 'away' | 'busy' | 'offline', customStatus?: string) => Promise<void>
  
  // History and search
  loadHistory: (roomId: string, before?: string) => Promise<ChatHistory>
  searchMessages: (query: string, roomId?: string) => Promise<ChatSearchResult[]>
  
  // Drafts
  saveDraft: (roomId: string, content: string, attachments?: ChatAttachment[], replyTo?: string) => void
  getDraft: (roomId: string) => ChatDraft | null
  clearDraft: (roomId: string) => void
  
  // Notifications
  markAsRead: (roomId: string, messageId?: string) => Promise<void>
  clearNotifications: (roomId?: string) => void
  
  // Settings
  updateSettings: (settings: Partial<ChatSettings>) => void
  
  // File handling
  uploadFile: (file: File, roomId: string) => Promise<ChatAttachment>
  
  // Utility
  formatMessage: (content: string) => string
  getMentions: (content: string) => string[]
  getActiveRoomMessages: () => ChatMessage[]
}

export function useChat(): ChatComposable {
  const webSocket = useWebSocket()
  
  // State
  const status = ref<ChatStatus>('idle')
  const currentUser = ref<ChatUser | null>(null)
  const rooms = ref<ChatRoom[]>([])
  const activeRoomId = ref<string | null>(null)
  const messages = ref<Map<string, ChatMessage[]>>(new Map())
  const typingUsers = ref<Map<string, ChatUser[]>>(new Map())
  const onlineUsers = ref<ChatUser[]>([])
  const notifications = ref<ChatNotification[]>([])
  const drafts = ref<Map<string, ChatDraft>>(new Map())
  const typingTimeouts = ref<Map<string, NodeJS.Timeout>>(new Map())
  
  // Settings with defaults
  const settings = ref<ChatSettings>({
    notifications: {
      enabled: true,
      sound: true,
      desktop: true,
      mentions: true,
      directMessages: true
    },
    appearance: {
      theme: 'auto',
      fontSize: 'medium',
      showAvatars: true,
      showTimestamps: true,
      compactMode: false
    },
    privacy: {
      showOnlineStatus: true,
      showTypingIndicator: true,
      readReceipts: true
    }
  })

  const stats = ref<ChatStats>({
    totalMessages: 0,
    totalRooms: 0,
    activeUsers: 0,
    messagesPerDay: 0,
    mostActiveRoom: '',
    favoriteEmojis: []
  })

  // Computed
  const activeRoom = computed(() => {
    if (!activeRoomId.value) return null
    return rooms.value.find(room => room.id === activeRoomId.value) || null
  })

  const unreadCount = computed(() => {
    return rooms.value.reduce((total, room) => total + room.unreadCount, 0)
  })

  // Load settings from localStorage
  const loadSettings = (): void => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHAT_SETTINGS)
      if (saved) {
        const parsed = JSON.parse(saved)
        settings.value = { ...settings.value, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load chat settings:', error)
    }
  }

  // Save settings to localStorage
  const saveSettings = (): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT_SETTINGS, JSON.stringify(settings.value))
    } catch (error) {
      console.warn('Failed to save chat settings:', error)
    }
  }

  // Load drafts from localStorage
  const loadDrafts = (): void => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHAT_DRAFTS)
      if (saved) {
        const parsed = JSON.parse(saved)
        const now = Date.now()
        
        // Filter out old drafts
        const validDrafts = new Map<string, ChatDraft>()
        for (const [roomId, draft] of Object.entries(parsed)) {
          const draftData = draft as ChatDraft
          if (now - draftData.timestamp < CHAT_MAX_DRAFT_AGE) {
            validDrafts.set(roomId, draftData)
          }
        }
        
        drafts.value = validDrafts
      }
    } catch (error) {
      console.warn('Failed to load chat drafts:', error)
    }
  }

  // Save drafts to localStorage
  const saveDrafts = (): void => {
    try {
      const draftsObj = Object.fromEntries(drafts.value)
      localStorage.setItem(STORAGE_KEYS.CHAT_DRAFTS, JSON.stringify(draftsObj))
    } catch (error) {
      console.warn('Failed to save chat drafts:', error)
    }
  }

  // Connection management
  const connect = async (userId: string, userInfo: Partial<ChatUser>): Promise<void> => {
    if (status.value === 'connected') return

    status.value = 'connecting'

    try {
      // Set current user
      currentUser.value = {
        id: userId,
        name: userInfo.name || 'Unknown User',
        ...(userInfo.avatar && { avatar: userInfo.avatar }),
        status: 'online'
      }

      // Load persisted data
      loadSettings()
      loadDrafts()

      // Connect to WebSocket
      await webSocket.connect('/ws/chat')

      // Set up message handlers
      webSocket.onMessage((message) => {
        handleWebSocketMessage(message)
      })

      status.value = 'connected'
    } catch (error) {
      status.value = 'error'
      console.error('Failed to connect to chat:', error)
      throw error
    }
  }

  const disconnect = (): void => {
    status.value = 'idle'
    currentUser.value = null
    rooms.value = []
    activeRoomId.value = null
    messages.value.clear()
    typingUsers.value.clear()
    onlineUsers.value = []
    notifications.value = []
    
    // Clear typing timeouts
    typingTimeouts.value.forEach(timeout => clearTimeout(timeout))
    typingTimeouts.value.clear()
    
    webSocket.disconnect()
  }

  // WebSocket message handling
  const handleWebSocketMessage = (message: any): void => {
    try {
      switch (message.type) {
        case 'chat_message':
          handleChatMessage(message as ChatMessageWebSocketMessage)
          break
        case 'chat_typing':
          handleTypingIndicator(message as ChatTypingWebSocketMessage)
          break
        case 'chat_presence':
          handlePresenceUpdate(message as ChatPresenceWebSocketMessage)
          break
        case 'chat_reaction':
          handleReactionUpdate(message as ChatReactionWebSocketMessage)
          break
        default:
          console.warn('Unknown chat message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  const handleChatMessage = (message: ChatMessageWebSocketMessage): void => {
    const { roomId, data: chatMessage } = message
    
    if (!messages.value.has(roomId)) {
      messages.value.set(roomId, [])
    }
    
    const roomMessages = messages.value.get(roomId)!
    
    // Check if message already exists (avoid duplicates)
    const existingIndex = roomMessages.findIndex(m => m.id === chatMessage.id)
    if (existingIndex >= 0) {
      // Update existing message (for edits)
      roomMessages[existingIndex] = chatMessage
    } else {
      // Add new message in chronological order
      const insertIndex = roomMessages.findIndex(m => m.timestamp > chatMessage.timestamp)
      if (insertIndex >= 0) {
        roomMessages.splice(insertIndex, 0, chatMessage)
      } else {
        roomMessages.push(chatMessage)
      }
    }

    // Update room's last message and unread count
    const room = rooms.value.find(r => r.id === roomId)
    if (room) {
      room.lastMessage = chatMessage
      room.updatedAt = chatMessage.timestamp
      
      // Increment unread count if not active room and not from current user
      if (activeRoomId.value !== roomId && chatMessage.author.id !== currentUser.value?.id) {
        room.unreadCount++
      }
    }

    // Create notification if needed
    if (chatMessage.author.id !== currentUser.value?.id) {
      createNotification(roomId, chatMessage)
    }
  }

  const handleTypingIndicator = (message: ChatTypingWebSocketMessage): void => {
    const { roomId, data } = message
    const { isTyping, user } = data
    
    if (!typingUsers.value.has(roomId)) {
      typingUsers.value.set(roomId, [])
    }
    
    const roomTypingUsers = typingUsers.value.get(roomId)!
    const existingIndex = roomTypingUsers.findIndex(u => u.id === user.id)
    
    if (isTyping) {
      if (existingIndex === -1) {
        roomTypingUsers.push(user)
      }
    } else {
      if (existingIndex >= 0) {
        roomTypingUsers.splice(existingIndex, 1)
      }
    }
  }

  const handlePresenceUpdate = (message: ChatPresenceWebSocketMessage): void => {
    const { data: presence } = message
    
    // Update user in online users list
    const existingIndex = onlineUsers.value.findIndex(u => u.id === presence.userId)
    
    if (presence.status === 'offline') {
      if (existingIndex >= 0) {
        onlineUsers.value.splice(existingIndex, 1)
      }
    } else {
      const user: ChatUser = {
        id: presence.userId,
        name: '', // Will be filled from room participants
        status: presence.status,
        lastSeen: presence.lastSeen
      }
      
      if (existingIndex >= 0) {
        onlineUsers.value[existingIndex] = { ...onlineUsers.value[existingIndex], ...user }
      } else {
        onlineUsers.value.push(user)
      }
    }

    // Update user status in all rooms
    rooms.value.forEach(room => {
      const participant = room.participants.find(p => p.id === presence.userId)
      if (participant) {
        participant.status = presence.status
        participant.lastSeen = presence.lastSeen
      }
    })
  }

  const handleReactionUpdate = (message: ChatReactionWebSocketMessage): void => {
    const { roomId, data } = message
    const { messageId, reaction, action } = data
    
    const roomMessages = messages.value.get(roomId)
    if (!roomMessages) return
    
    const messageIndex = roomMessages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return
    
    const chatMessage = roomMessages[messageIndex]
    if (!chatMessage) return
    
    if (!chatMessage.reactions) {
      chatMessage.reactions = []
    }
    
    const reactionIndex = chatMessage.reactions.findIndex(r => r.emoji === reaction.emoji)
    
    if (action === 'add') {
      if (reactionIndex >= 0) {
        chatMessage.reactions[reactionIndex] = reaction
      } else {
        chatMessage.reactions.push(reaction)
      }
    } else if (action === 'remove') {
      if (reactionIndex >= 0) {
        if (reaction.count <= 0) {
          chatMessage.reactions.splice(reactionIndex, 1)
        } else {
          chatMessage.reactions[reactionIndex] = reaction
        }
      }
    }
  }

  // Message operations
  const sendMessage = async (
    roomId: string,
    content: string,
    attachments: ChatAttachment[] = [],
    replyTo?: string
  ): Promise<ChatMessage> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    if (content.length > CHAT_MAX_MESSAGE_LENGTH) {
      throw new Error(`Message too long. Maximum ${CHAT_MAX_MESSAGE_LENGTH} characters allowed.`)
    }

    if (attachments.length > CHAT_MAX_ATTACHMENTS) {
      throw new Error(`Too many attachments. Maximum ${CHAT_MAX_ATTACHMENTS} allowed.`)
    }

    const message: ChatMessage = {
      id: generateMessageId(),
      content: content.trim(),
      type: attachments.length > 0 ? 'file' : 'text',
      author: currentUser.value,
      timestamp: Date.now(),
      ...(attachments.length > 0 && { attachments }),
      ...(replyTo && { replyTo }),
      metadata: {
        mentions: getMentions(content)
      }
    }

    try {
      status.value = 'sending'
      
      // Send via WebSocket
      await webSocket.sendMessage({
        type: 'chat_message',
        roomId,
        data: message,
        timestamp: Date.now()
      })

      // Clear draft after successful send
      clearDraft(roomId)
      
      status.value = 'connected'
      return message
    } catch (error) {
      status.value = 'error'
      console.error('Failed to send message:', error)
      throw error
    }
  }

  const editMessage = async (messageId: string, content: string): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      await webSocket.sendMessage({
        type: 'chat_edit_message',
        data: {
          messageId,
          content: content.trim(),
          editedAt: Date.now()
        },
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to edit message:', error)
      throw error
    }
  }

  const deleteMessage = async (messageId: string): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      await webSocket.sendMessage({
        type: 'chat_delete_message',
        data: { messageId },
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to delete message:', error)
      throw error
    }
  }

  const addReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      await webSocket.sendMessage({
        type: 'chat_add_reaction',
        data: {
          messageId,
          emoji,
          userId: currentUser.value.id
        },
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to add reaction:', error)
      throw error
    }
  }

  const removeReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      await webSocket.sendMessage({
        type: 'chat_remove_reaction',
        data: {
          messageId,
          emoji,
          userId: currentUser.value.id
        },
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to remove reaction:', error)
      throw error
    }
  }

  // Room management
  const joinRoom = async (roomId: string): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      await webSocket.sendMessage({
        type: 'chat_join_room',
        data: { roomId, userId: currentUser.value.id },
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to join room:', error)
      throw error
    }
  }

  const leaveRoom = async (roomId: string): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      await webSocket.sendMessage({
        type: 'chat_leave_room',
        data: { roomId, userId: currentUser.value.id },
        timestamp: Date.now()
      })
      
      // Clean up local state
      messages.value.delete(roomId)
      typingUsers.value.delete(roomId)
      
      if (activeRoomId.value === roomId) {
        activeRoomId.value = null
      }
      
      const roomIndex = rooms.value.findIndex(r => r.id === roomId)
      if (roomIndex >= 0) {
        rooms.value.splice(roomIndex, 1)
      }
    } catch (error) {
      console.error('Failed to leave room:', error)
      throw error
    }
  }

  const createRoom = async (
    name: string,
    type: 'direct' | 'group' | 'channel',
    participants: string[] = []
  ): Promise<ChatRoom> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      const response = await webSocket.sendMessageWithResponse({
        type: 'chat_create_room',
        data: {
          name,
          type,
          participants: [...participants, currentUser.value.id],
          createdBy: currentUser.value.id
        },
        timestamp: Date.now()
      })

      return response.data as ChatRoom
    } catch (error) {
      console.error('Failed to create room:', error)
      throw error
    }
  }

  const setActiveRoom = (roomId: string | null): void => {
    activeRoomId.value = roomId
    
    // Mark room as read when activated
    if (roomId) {
      markAsRead(roomId)
    }
  }

  // Typing indicators
  let typingDebounceTimeout: NodeJS.Timeout | null = null

  const startTyping = (roomId: string): void => {
    if (!currentUser.value || !settings.value.privacy.showTypingIndicator) return

    // Clear existing timeout
    if (typingDebounceTimeout) {
      clearTimeout(typingDebounceTimeout)
    }

    // Send typing indicator
    webSocket.sendMessage({
      type: 'chat_typing',
      roomId,
      data: {
        isTyping: true,
        user: currentUser.value
      },
      timestamp: Date.now()
    }).catch(error => {
      console.error('Failed to send typing indicator:', error)
    })

    // Auto-stop typing after timeout
    typingDebounceTimeout = setTimeout(() => {
      stopTyping(roomId)
    }, CHAT_TYPING_TIMEOUT)
  }

  const stopTyping = (roomId: string): void => {
    if (!currentUser.value) return

    if (typingDebounceTimeout) {
      clearTimeout(typingDebounceTimeout)
      typingDebounceTimeout = null
    }

    webSocket.sendMessage({
      type: 'chat_typing',
      roomId,
      data: {
        isTyping: false,
        user: currentUser.value
      },
      timestamp: Date.now()
    }).catch(error => {
      console.error('Failed to stop typing indicator:', error)
    })
  }

  // Presence management
  const updatePresence = async (
    status: 'online' | 'away' | 'busy' | 'offline',
    customStatus?: string
  ): Promise<void> => {
    if (!currentUser.value) {
      throw new Error('User not connected')
    }

    try {
      currentUser.value.status = status
      
      await webSocket.sendMessage({
        type: 'chat_presence',
        data: {
          userId: currentUser.value.id,
          status,
          customStatus,
          lastSeen: Date.now()
        },
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Failed to update presence:', error)
      throw error
    }
  }

  // History and search
  const loadHistory = async (roomId: string, before?: string): Promise<ChatHistory> => {
    try {
      const response = await webSocket.sendMessageWithResponse({
        type: 'chat_load_history',
        data: {
          roomId,
          before,
          limit: CHAT_HISTORY_PAGE_SIZE
        },
        timestamp: Date.now()
      })

      const history = response.data as ChatHistory
      
      // Merge with existing messages
      if (messages.value.has(roomId)) {
        const existingMessages = messages.value.get(roomId)!
        const mergedMessages = [...history.messages, ...existingMessages]
        
        // Remove duplicates and sort by timestamp
        const uniqueMessages = mergedMessages.filter((message, index, arr) => 
          arr.findIndex(m => m.id === message.id) === index
        ).sort((a, b) => a.timestamp - b.timestamp)
        
        messages.value.set(roomId, uniqueMessages)
      } else {
        messages.value.set(roomId, history.messages)
      }

      return history
    } catch (error) {
      console.error('Failed to load history:', error)
      throw error
    }
  }

  const searchMessages = async (query: string, roomId?: string): Promise<ChatSearchResult[]> => {
    try {
      const response = await webSocket.sendMessageWithResponse({
        type: 'chat_search',
        data: {
          query,
          roomId,
          limit: 50
        },
        timestamp: Date.now()
      })

      return response.data as ChatSearchResult[]
    } catch (error) {
      console.error('Failed to search messages:', error)
      throw error
    }
  }

  // Draft management
  const saveDraft = (
    roomId: string,
    content: string,
    attachments: ChatAttachment[] = [],
    replyTo?: string
  ): void => {
    if (!content.trim() && attachments.length === 0) {
      clearDraft(roomId)
      return
    }

    const draft: ChatDraft = {
      roomId,
      content: content.trim(),
      attachments,
      ...(replyTo && { replyTo }),
      timestamp: Date.now()
    }

    drafts.value.set(roomId, draft)
    saveDrafts()
  }

  const getDraft = (roomId: string): ChatDraft | null => {
    return drafts.value.get(roomId) || null
  }

  const clearDraft = (roomId: string): void => {
    drafts.value.delete(roomId)
    saveDrafts()
  }

  // Notification management
  const createNotification = (roomId: string, message: ChatMessage): void => {
    if (!settings.value.notifications.enabled) return

    const room = rooms.value.find(r => r.id === roomId)
    if (!room) return

    // Check if should notify based on settings
    const shouldNotify = 
      (room.type === 'direct' && settings.value.notifications.directMessages) ||
      (message.metadata?.mentions?.includes(currentUser.value?.id || '') && settings.value.notifications.mentions) ||
      settings.value.notifications.enabled

    if (!shouldNotify) return

    const notification: ChatNotification = {
      id: generateNotificationId(),
      type: message.metadata?.mentions?.includes(currentUser.value?.id || '') ? 'mention' : 'message',
      roomId,
      messageId: message.id,
      userId: message.author.id,
      content: message.content,
      timestamp: message.timestamp,
      read: false
    }

    notifications.value.unshift(notification)
    
    // Limit notifications
    if (notifications.value.length > CHAT_MAX_NOTIFICATIONS) {
      notifications.value = notifications.value.slice(0, CHAT_MAX_NOTIFICATIONS)
    }

    // Show browser notification if enabled
    if (settings.value.notifications.desktop && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`${message.author.name} in ${room.name}`, {
          body: message.content,
          ...(message.author.avatar && { icon: message.author.avatar })
        })
      }
    }
  }

  const markAsRead = async (roomId: string, messageId?: string): Promise<void> => {
    try {
      // Update room unread count
      const room = rooms.value.find(r => r.id === roomId)
      if (room) {
        room.unreadCount = 0
      }

      // Mark notifications as read
      notifications.value.forEach(notification => {
        if (notification.roomId === roomId) {
          if (!messageId || notification.messageId === messageId) {
            notification.read = true
          }
        }
      })

      // Send read receipt if enabled
      if (settings.value.privacy.readReceipts && currentUser.value) {
        await webSocket.sendMessage({
          type: 'chat_mark_read',
          data: {
            roomId,
            messageId,
            userId: currentUser.value.id,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const clearNotifications = (roomId?: string): void => {
    if (roomId) {
      notifications.value = notifications.value.filter(n => n.roomId !== roomId)
    } else {
      notifications.value = []
    }
  }

  // Settings management
  const updateSettings = (newSettings: Partial<ChatSettings>): void => {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()
  }

  // File handling
  const uploadFile = async (file: File, roomId: string): Promise<ChatAttachment> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('roomId', roomId)

      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const attachment = await response.json() as ChatAttachment
      return attachment
    } catch (error) {
      console.error('Failed to upload file:', error)
      throw error
    }
  }

  // Utility functions
  const formatMessage = (content: string): string => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
  }

  const getMentions = (content: string): string[] => {
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match[1]) {
        mentions.push(match[1])
      }
    }

    return mentions
  }

  const getActiveRoomMessages = (): ChatMessage[] => {
    if (!activeRoomId.value) return []
    return messages.value.get(activeRoomId.value) || []
  }

  const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  const generateNotificationId = (): string => {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  // Cleanup on unmount
  onUnmounted(() => {
    // Clear all timeouts
    typingTimeouts.value.forEach(timeout => clearTimeout(timeout))
    if (typingDebounceTimeout) {
      clearTimeout(typingDebounceTimeout)
    }
    
    // Disconnect if connected
    if (status.value === 'connected') {
      disconnect()
    }
  })

  // Watch for settings changes
  watch(settings, () => {
    saveSettings()
  }, { deep: true })

  // Watch for draft changes
  watch(drafts, () => {
    saveDrafts()
  }, { deep: true })

  return {
    // State
    status,
    currentUser,
    rooms,
    activeRoomId,
    activeRoom,
    messages,
    typingUsers,
    onlineUsers,
    notifications,
    unreadCount,
    drafts,
    settings,
    stats,

    // Methods
    connect,
    disconnect,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    
    // Room management
    joinRoom,
    leaveRoom,
    createRoom,
    setActiveRoom,
    
    // Typing indicators
    startTyping,
    stopTyping,
    
    // Presence
    updatePresence,
    
    // History and search
    loadHistory,
    searchMessages,
    
    // Drafts
    saveDraft,
    getDraft,
    clearDraft,
    
    // Notifications
    markAsRead,
    clearNotifications,
    
    // Settings
    updateSettings,
    
    // File handling
    uploadFile,
    
    // Utility
    formatMessage,
    getMentions,
    getActiveRoomMessages
  }
}
 