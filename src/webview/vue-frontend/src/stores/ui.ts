import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NotificationItem, LoadingState } from '../types/common'

export type ViewType = 'automation' | 'files' | 'git' | 'terminal' | 'chat'
export type ThemeType = 'light' | 'dark' | 'auto'

export const useUIStore = defineStore('ui', () => {
  // State
  const sidebarCollapsed = ref(false)
  const activeView = ref<ViewType>('automation')
  const theme = ref<ThemeType>('light')
  const loading = ref<LoadingState>({ isLoading: false })
  const notifications = ref<NotificationItem[]>([])
  const modalStack = ref<string[]>([])
  const sidebarWidth = ref(280)
  const panelHeight = ref(300)
  const isFullscreen = ref(false)

  // Getters
  const hasNotifications = computed(() => notifications.value.length > 0)
  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.autoClose).length
  )
  const isLoading = computed(() => loading.value.isLoading)
  const loadingMessage = computed(() => loading.value.message)
  const hasActiveModal = computed(() => modalStack.value.length > 0)
  const activeModal = computed(() => 
    modalStack.value.length > 0 ? modalStack.value[modalStack.value.length - 1] : null
  )

  // Actions
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    sidebarCollapsed.value = collapsed
  }

  const setActiveView = (view: ViewType) => {
    activeView.value = view
  }

  const setTheme = (newTheme: ThemeType) => {
    theme.value = newTheme
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const toggleTheme = () => {
    const themes: ThemeType[] = ['light', 'dark', 'auto']
    const currentIndex = themes.indexOf(theme.value)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    if (nextTheme) {
      setTheme(nextTheme)
    }
  }

  const setLoading = (isLoading: boolean, message?: string, progress?: number) => {
    loading.value = { 
      isLoading, 
      ...(message !== undefined && { message }),
      ...(progress !== undefined && { progress })
    }
  }

  // Notification throttling state
  const notificationThrottleMap = ref<Map<string, { count: number; lastShown: number }>>(new Map())
  const THROTTLE_WINDOW_MS = 3000 // 3 seconds
  const MAX_SAME_NOTIFICATIONS = 1 // Only allow 1 of the same notification per window

  const addNotification = (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    autoClose = true,
    duration = 5000
  ) => {
    // Create throttle key based on message and type
    const throttleKey = `${type}:${message}`
    const now = Date.now()
    const existing = notificationThrottleMap.value.get(throttleKey)

    // Check if we should throttle this notification
    if (existing) {
      // If within throttle window and already shown max times, skip
      if (now - existing.lastShown < THROTTLE_WINDOW_MS && existing.count >= MAX_SAME_NOTIFICATIONS) {
        console.debug(`Throttled notification: ${message}`)
        return null // Return null to indicate throttled
      }
      
      // If outside window, reset counter
      if (now - existing.lastShown >= THROTTLE_WINDOW_MS) {
        existing.count = 0
      }
    }

    // Update throttle tracking
    notificationThrottleMap.value.set(throttleKey, {
      count: (existing?.count || 0) + 1,
      lastShown: now
    })

    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const notification: NotificationItem = {
      id,
      message,
      type,
      timestamp: new Date(),
      autoClose
    }
    
    notifications.value.push(notification)

    // Auto-remove if specified
    if (autoClose) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }

    // Clean up old throttle entries periodically
    if (notificationThrottleMap.value.size > 50) {
      cleanupThrottleMap()
    }

    return id
  }

  const cleanupThrottleMap = () => {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    for (const [key, entry] of notificationThrottleMap.value.entries()) {
      if (now - entry.lastShown > THROTTLE_WINDOW_MS * 2) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => notificationThrottleMap.value.delete(key))
  }

  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearAllNotifications = () => {
    notifications.value = []
  }

  const openModal = (modalId: string) => {
    if (!modalStack.value.includes(modalId)) {
      modalStack.value.push(modalId)
    }
  }

  const closeModal = (modalId?: string) => {
    if (modalId) {
      const index = modalStack.value.indexOf(modalId)
      if (index > -1) {
        modalStack.value.splice(index, 1)
      }
    } else {
      // Close top modal
      modalStack.value.pop()
    }
  }

  const closeAllModals = () => {
    modalStack.value = []
  }

  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = Math.max(200, Math.min(600, width))
  }

  const setPanelHeight = (height: number) => {
    panelHeight.value = Math.max(200, Math.min(800, height))
  }

  const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value
  }

  const reset = () => {
    sidebarCollapsed.value = false
    activeView.value = 'automation'
    loading.value = { isLoading: false }
    notifications.value = []
    modalStack.value = []
    sidebarWidth.value = 280
    panelHeight.value = 300
    isFullscreen.value = false
  }

  return {
    // State
    sidebarCollapsed,
    activeView,
    theme,
    loading,
    notifications,
    modalStack,
    sidebarWidth,
    panelHeight,
    isFullscreen,
    // Getters
    hasNotifications,
    unreadNotifications,
    isLoading,
    loadingMessage,
    hasActiveModal,
    activeModal,
    // Actions
    toggleSidebar,
    setSidebarCollapsed,
    setActiveView,
    setTheme,
    toggleTheme,
    setLoading,
    addNotification,
    removeNotification,
    clearAllNotifications,
    openModal,
    closeModal,
    closeAllModals,
    setSidebarWidth,
    setPanelHeight,
    toggleFullscreen,
    reset
  }
})
