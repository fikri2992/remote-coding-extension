import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useMobileWebSocket } from '../composables/useMobileWebSocket'
import { useGestures } from '../composables/useGestures'
import type { GestureEvent, GestureType } from '../types/gestures'
import type { MobileConnectionState } from '../types/websocket'

export interface MobileWebSocketIntegrationOptions {
  element?: HTMLElement | null
  enableGestureReporting?: boolean
  enableLayoutSync?: boolean
  enableHapticFeedback?: boolean
  autoConnect?: boolean
  websocketUrl?: string
}

export interface MobileWebSocketIntegration {
  // WebSocket functionality
  mobileWebSocket: ReturnType<typeof useMobileWebSocket>
  
  // Gesture integration
  gestures: ReturnType<typeof useGestures>
  
  // State
  isConnected: boolean
  connectionState: MobileConnectionState
  
  // Methods
  connect: (url?: string) => Promise<void>
  disconnect: () => void
  enableGestureIntegration: () => void
  disableGestureIntegration: () => void
  syncLayoutState: (layoutData: any) => Promise<void>
  reportFileAction: (action: string, filePath: string, metadata?: any) => Promise<void>
}

export function useMobileWebSocketIntegration(
  options: MobileWebSocketIntegrationOptions = {}
): MobileWebSocketIntegration {
  const {
    element = null,
    enableGestureReporting = true,
    enableLayoutSync = true,
    enableHapticFeedback = true,
    autoConnect = true,
    websocketUrl
  } = options

  // Initialize mobile WebSocket
  const mobileWebSocket = useMobileWebSocket({
    mobile: {
      bandwidthAware: true,
      adaptiveRetry: true,
      gestureReporting: enableGestureReporting,
      layoutSync: enableLayoutSync,
      hapticFeedback: enableHapticFeedback,
      connectionQualityThreshold: 1.0,
      maxRetryBackoff: 30000,
      priorityMessageTypes: ['mobile_haptic', 'mobile_gesture', 'ping', 'pong']
    }
  })

  // Initialize gesture system
  const gestures = useGestures({
    element,
    enabled: enableGestureReporting,
    config: {
      enableHapticFeedback: enableHapticFeedback,
      preventDefaultTouchAction: true
    },
    callbacks: {
      onSwipe: handleGestureEvent,
      onPinch: handleGestureEvent,
      onPan: handleGestureEvent,
      onTap: handleGestureEvent,
      onLongPress: handleGestureEvent,
      onPullRefresh: handleGestureEvent
    }
  })

  // State
  const isConnected = ref(false)
  const gestureIntegrationEnabled = ref(enableGestureReporting)
  const currentFilePath = ref<string>('')
  const layoutState = reactive({
    breakpoint: 'desktop' as 'mobile' | 'tablet' | 'desktop',
    orientation: 'landscape' as 'portrait' | 'landscape',
    viewportSize: { width: window.innerWidth, height: window.innerHeight },
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 }
  })

  // Gesture event handler
  async function handleGestureEvent(event: GestureEvent): Promise<void> {
    if (!gestureIntegrationEnabled.value || !isConnected.value) {
      return
    }

    try {
      // Determine target from gesture event
      const target = getTargetFromGestureEvent(event)
      
      // Send gesture event to VS Code extension
      await mobileWebSocket.sendGestureEvent(event, target, {
        filePath: currentFilePath.value,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        connectionQuality: mobileWebSocket.mobileState.connectionQuality
      })

      // Trigger haptic feedback for certain gestures
      if (enableHapticFeedback) {
        const hapticType = getHapticTypeForGesture(event.type)
        if (hapticType) {
          await mobileWebSocket.sendHapticFeedback(
            hapticType,
            `gesture_${event.type}`,
            getHapticPatternForGesture(event.type)
          )
        }
      }
    } catch (error) {
      console.error('Failed to send gesture event:', error)
    }
  }

  // Utility functions
  function getTargetFromGestureEvent(event: GestureEvent): string {
    // Try to determine file path from gesture target
    const element = event.target
    
    // Look for data attributes that might contain file path
    const filePath = element.getAttribute('data-file-path') ||
                    element.getAttribute('data-path') ||
                    element.closest('[data-file-path]')?.getAttribute('data-file-path') ||
                    element.closest('[data-path]')?.getAttribute('data-path')
    
    if (filePath) {
      return filePath
    }
    
    // Fallback to element class or ID
    return element.className || element.id || 'unknown'
  }

  function getHapticTypeForGesture(gestureType: GestureType): string | null {
    const hapticMap: Record<GestureType, string> = {
      tap: 'light',
      longpress: 'medium',
      swipe: 'light',
      pinch: 'selection',
      pan: 'light',
      pullrefresh: 'medium'
    }
    
    return hapticMap[gestureType] || null
  }

  function getHapticPatternForGesture(gestureType: GestureType): number[] | undefined {
    const patternMap: Record<GestureType, number[] | undefined> = {
      tap: [10],
      longpress: [50, 20, 50],
      swipe: [20],
      pinch: [10, 10, 10],
      pan: undefined, // Use default
      pullrefresh: [30, 10, 30]
    }
    
    return patternMap[gestureType]
  }

  // Layout detection and synchronization
  function detectLayoutState(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    
    // Update viewport size
    layoutState.viewportSize = { width, height }
    
    // Determine breakpoint
    if (width < 768) {
      layoutState.breakpoint = 'mobile'
    } else if (width < 1024) {
      layoutState.breakpoint = 'tablet'
    } else {
      layoutState.breakpoint = 'desktop'
    }
    
    // Determine orientation
    layoutState.orientation = width > height ? 'landscape' : 'portrait'
    
    // Detect safe area (for devices with notches)
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0')
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0')
    const safeAreaLeft = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-left') || '0')
    const safeAreaRight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-right') || '0')
    
    layoutState.safeArea = {
      top: safeAreaTop,
      bottom: safeAreaBottom,
      left: safeAreaLeft,
      right: safeAreaRight
    }
  }

  // Public methods
  const connect = async (url?: string): Promise<void> => {
    const wsUrl = url || websocketUrl || `ws://localhost:8081`
    
    try {
      await mobileWebSocket.webSocket.connect(wsUrl)
      isConnected.value = true
      
      // Send initial layout state
      if (enableLayoutSync) {
        await syncLayoutState(layoutState)
      }
    } catch (error) {
      console.error('Failed to connect mobile WebSocket:', error)
      throw error
    }
  }

  const disconnect = (): void => {
    mobileWebSocket.webSocket.disconnect()
    isConnected.value = false
  }

  const enableGestureIntegration = (): void => {
    gestureIntegrationEnabled.value = true
    gestures.enable()
  }

  const disableGestureIntegration = (): void => {
    gestureIntegrationEnabled.value = false
    gestures.disable()
  }

  const syncLayoutState = async (layoutData: any): Promise<void> => {
    if (!isConnected.value) return
    
    try {
      await mobileWebSocket.sendLayoutUpdate({
        ...layoutState,
        ...layoutData,
        preferences: {
          layout: 'list', // Default, can be overridden
          density: 1,
          theme: 'auto',
          ...layoutData.preferences
        }
      })
    } catch (error) {
      console.error('Failed to sync layout state:', error)
    }
  }

  const reportFileAction = async (
    action: string,
    filePath: string,
    metadata?: any
  ): Promise<void> => {
    if (!isConnected.value) return
    
    try {
      await mobileWebSocket.sendPreviewAction(filePath, action, {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        connectionQuality: mobileWebSocket.mobileState.connectionQuality,
        ...metadata
      })
    } catch (error) {
      console.error('Failed to report file action:', error)
    }
  }

  // Set up event listeners and watchers
  onMounted(() => {
    // Initial layout detection
    detectLayoutState()
    
    // Listen for resize events
    const handleResize = (): void => {
      detectLayoutState()
      if (enableLayoutSync && isConnected.value) {
        syncLayoutState(layoutState)
      }
    }
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    
    // Listen for WebSocket connection changes
    watch(() => mobileWebSocket.webSocket.isConnected.value, (connected) => {
      isConnected.value = connected
      
      if (connected && enableLayoutSync) {
        // Send layout state when connected
        syncLayoutState(layoutState)
      }
    })
    
    // Auto-connect if enabled
    if (autoConnect && websocketUrl) {
      connect(websocketUrl).catch(error => {
        console.error('Auto-connect failed:', error)
      })
    }
    
    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      disconnect()
    })
  })

  return {
    // WebSocket functionality
    mobileWebSocket,
    
    // Gesture integration
    gestures,
    
    // State
    isConnected: isConnected.value,
    connectionState: mobileWebSocket.mobileState,
    
    // Methods
    connect,
    disconnect,
    enableGestureIntegration,
    disableGestureIntegration,
    syncLayoutState,
    reportFileAction
  }
}