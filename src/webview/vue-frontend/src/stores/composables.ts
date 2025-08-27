import { computed } from 'vue'
import { useConnectionStore } from './connection'
import { useWorkspaceStore } from './workspace'
import { useUIStore } from './ui'
import { useSettingsStore } from './settings'

/**
 * Composable that provides access to all stores with common patterns
 */
export function useStores() {
  const connectionStore = useConnectionStore()
  const workspaceStore = useWorkspaceStore()
  const uiStore = useUIStore()
  const settingsStore = useSettingsStore()

  return {
    connection: connectionStore,
    workspace: workspaceStore,
    ui: uiStore,
    settings: settingsStore
  }
}

/**
 * Composable for application-wide state and actions
 */
export function useAppState() {
  const { connection, workspace, ui, settings } = useStores()

  // Combined state getters
  const isReady = computed(() => 
    connection.isConnected && workspace.hasWorkspace
  )

  const appStatus = computed(() => {
    if (!connection.isConnected) return 'disconnected'
    if (!workspace.hasWorkspace) return 'no-workspace'
    if (ui.isLoading) return 'loading'
    return 'ready'
  })

  const hasErrors = computed(() => 
    connection.hasError || ui.notifications.some(n => n.type === 'error')
  )

  // Combined actions
  const initializeApp = async () => {
    ui.setLoading(true, 'Initializing application...')
    
    try {
      // Load settings first
      await settings.loadFromStorage()
      
      // Connect to server
      const serverUrl = `ws://localhost:${settings.serverConfig.websocketPort}`
      await connection.connect(serverUrl)
      
      ui.addNotification('Application initialized successfully', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      ui.addNotification(`Failed to initialize: ${message}`, 'error', false)
      throw error
    } finally {
      ui.setLoading(false)
    }
  }

  const resetApp = () => {
    connection.disconnect()
    workspace.reset()
    ui.reset()
    // Don't reset settings as they should persist
  }

  const saveAppState = async () => {
    try {
      await settings.saveToStorage()
      ui.addNotification('Settings saved successfully', 'success')
      return true
    } catch (error) {
      ui.addNotification('Failed to save settings', 'error')
      return false
    }
  }

  return {
    // State
    isReady,
    appStatus,
    hasErrors,
    // Actions
    initializeApp,
    resetApp,
    saveAppState,
    // Store access
    stores: { connection, workspace, ui, settings }
  }
}

/**
 * Composable for managing notifications across stores
 */
export function useNotifications() {
  const ui = useUIStore()

  const notify = {
    success: (message: string, autoClose = true) => 
      ui.addNotification(message, 'success', autoClose),
    
    error: (message: string, autoClose = false) => 
      ui.addNotification(message, 'error', autoClose),
    
    warning: (message: string, autoClose = true) => 
      ui.addNotification(message, 'warning', autoClose),
    
    info: (message: string, autoClose = true) => 
      ui.addNotification(message, 'info', autoClose)
  }

  return {
    notify,
    notifications: ui.notifications,
    hasNotifications: ui.hasNotifications,
    clearAll: ui.clearAllNotifications,
    remove: ui.removeNotification
  }
}

/**
 * Composable for managing loading states across the application
 */
export function useLoadingState() {
  const ui = useUIStore()

  const withLoading = async <T>(
    operation: () => Promise<T>,
    message?: string
  ): Promise<T> => {
    ui.setLoading(true, message)
    try {
      return await operation()
    } finally {
      ui.setLoading(false)
    }
  }

  return {
    isLoading: ui.isLoading,
    loadingMessage: ui.loadingMessage,
    setLoading: ui.setLoading,
    withLoading
  }
}

/**
 * Composable for theme management
 */
export function useTheme() {
  const ui = useUIStore()

  const applyTheme = (theme: 'light' | 'dark' | 'auto') => {
    ui.setTheme(theme)
    
    // Apply CSS custom properties based on theme
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      // Auto theme - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      root.classList.toggle('light', !prefersDark)
    }
  }

  return {
    currentTheme: ui.theme,
    setTheme: applyTheme,
    toggleTheme: ui.toggleTheme
  }
}