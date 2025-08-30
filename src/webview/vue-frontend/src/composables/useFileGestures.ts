import { computed, reactive, readonly } from 'vue'
import { useGestures } from './useGestures'
import type { 
  GestureEvent, 
  GestureConfiguration, 
  HapticFeedbackOptions 
} from '../types/gestures'
import type { FileSystemNode } from '../types/filesystem'

export interface FileGestureAction {
  type: 'delete' | 'rename' | 'share' | 'preview' | 'select' | 'copy' | 'move'
  icon: string
  color: string
  label: string
  haptic?: HapticFeedbackOptions
  confirmRequired?: boolean
}

export interface FileGestureConfig {
  // Swipe actions configuration
  swipeActions: {
    left: FileGestureAction[]
    right: FileGestureAction[]
  }
  
  // Pinch zoom configuration for file list density
  densityLevels: {
    compact: { itemHeight: number; fontSize: string }
    normal: { itemHeight: number; fontSize: string }
    comfortable: { itemHeight: number; fontSize: string }
  }
  
  // Pull refresh configuration
  refreshEnabled: boolean
  
  // Long press configuration
  contextMenuEnabled: boolean
}

export interface FileGestureCallbacks {
  onFileAction?: (action: FileGestureAction, file: FileSystemNode) => void
  onDensityChange?: (level: 'compact' | 'normal' | 'comfortable') => void
  onRefresh?: () => Promise<void>
  onContextMenu?: (file: FileSystemNode, position: { x: number; y: number }) => void
  onFileSelect?: (file: FileSystemNode) => void
}

export interface FileGestureState {
  currentDensity: 'compact' | 'normal' | 'comfortable'
  swipeRevealedFile: string | null
  isRefreshing: boolean
  selectedFiles: Set<string>
}

const defaultFileGestureConfig: FileGestureConfig = {
  swipeActions: {
    left: [
      {
        type: 'delete',
        icon: '🗑️',
        color: '#ef4444',
        label: 'Delete',
        haptic: { type: 'medium' },
        confirmRequired: true
      }
    ],
    right: [
      {
        type: 'share',
        icon: '📤',
        color: '#3b82f6',
        label: 'Share',
        haptic: { type: 'light' }
      },
      {
        type: 'preview',
        icon: '👁️',
        color: '#10b981',
        label: 'Preview',
        haptic: { type: 'light' }
      }
    ]
  },
  densityLevels: {
    compact: { itemHeight: 32, fontSize: '0.875rem' },
    normal: { itemHeight: 44, fontSize: '1rem' },
    comfortable: { itemHeight: 56, fontSize: '1.125rem' }
  },
  refreshEnabled: true,
  contextMenuEnabled: true
}

export function useFileGestures(
  element: HTMLElement | null,
  config: Partial<FileGestureConfig> = {},
  callbacks: FileGestureCallbacks = {}
) {
  const fileConfig = reactive<FileGestureConfig>({ ...defaultFileGestureConfig, ...config })
  const state = reactive<FileGestureState>({
    currentDensity: 'normal',
    swipeRevealedFile: null,
    isRefreshing: false,
    selectedFiles: new Set()
  })

  // Gesture configuration optimized for file operations
  const gestureConfig: Partial<GestureConfiguration> = {
    swipe: {
      threshold: 60, // Slightly higher threshold for file swipes
      velocity: 0.4,
      maxTime: 400,
      tolerance: 25
    },
    pinch: {
      threshold: 0.15, // More sensitive for density changes
      minScale: 0.7, // Compact mode
      maxScale: 1.5 // Comfortable mode
    },
    longpress: {
      duration: 600, // Longer for file context menu
      tolerance: 8
    },
    pullrefresh: {
      threshold: 70,
      maxDistance: 100,
      elasticity: 0.6,
      snapBackDuration: 250
    },
    enableHapticFeedback: true,
    debugMode: false
  }

  // Initialize base gesture system
  const gestures = useGestures({
    element,
    config: gestureConfig,
    callbacks: {
      onSwipe: handleSwipeGesture,
      onPinch: handlePinchGesture,
      onLongPress: handleLongPressGesture,
      onPullRefresh: handlePullRefreshGesture
    }
  })

  // Gesture handlers
  function handleSwipeGesture(event: GestureEvent): void {
    const fileElement = findFileElement(event.target)
    if (!fileElement) return

    const filePath = fileElement.dataset['filePath']
    if (!filePath) return

    const direction = event.direction
    if (!direction || (direction !== 'left' && direction !== 'right')) return

    // Get actions for this direction
    const actions = fileConfig.swipeActions[direction]
    if (!actions || actions.length === 0) return

    // Reveal swipe actions
    state.swipeRevealedFile = filePath
    
    // If only one action, execute it directly
    if (actions.length === 1) {
      const action = actions[0]
      const fileNode = getFileNodeFromElement(fileElement)
      
      if (fileNode) {
        if (action) {
          executeFileAction(action, fileNode)
        }
      }
    } else {
      // Show action menu for multiple actions
      showSwipeActionMenu(fileElement, actions, direction)
    }
  }

  function handlePinchGesture(event: GestureEvent): void {
    if (!event.scale) return

    // Map scale to density levels
    let newDensity: 'compact' | 'normal' | 'comfortable'
    
    if (event.scale < 0.85) {
      newDensity = 'compact'
    } else if (event.scale > 1.15) {
      newDensity = 'comfortable'
    } else {
      newDensity = 'normal'
    }

    if (newDensity !== state.currentDensity) {
      state.currentDensity = newDensity
      gestures.triggerHapticFeedback({ type: 'selection' })
      callbacks.onDensityChange?.(newDensity)
    }
  }

  function handleLongPressGesture(event: GestureEvent): void {
    if (!fileConfig.contextMenuEnabled) return

    const fileElement = findFileElement(event.target)
    if (!fileElement) return

    const fileNode = getFileNodeFromElement(fileElement)
    if (!fileNode) return

    const position = {
      x: event.center.x,
      y: event.center.y
    }

    callbacks.onContextMenu?.(fileNode, position)
  }

  async function handlePullRefreshGesture(_event: GestureEvent): Promise<void> {
    if (!fileConfig.refreshEnabled || state.isRefreshing) return

    state.isRefreshing = true
    
    try {
      await callbacks.onRefresh?.()
      gestures.triggerHapticFeedback({ type: 'notification' })
    } catch (error) {
      console.error('Refresh failed:', error)
      gestures.triggerHapticFeedback({ type: 'heavy' })
    } finally {
      state.isRefreshing = false
    }
  }

  // Helper functions
  function findFileElement(target: HTMLElement): HTMLElement | null {
    let current = target
    while (current && current !== element) {
      if (current.dataset['filePath']) {
        return current
      }
      current = current.parentElement as HTMLElement
    }
    return null
  }

  function getFileNodeFromElement(fileElement: HTMLElement): FileSystemNode | null {
    const filePath = fileElement.dataset['filePath']
    if (!filePath) return null

    // This would typically come from a file system store or prop
    // For now, we'll construct a basic node from the element data
    return {
      path: filePath,
      name: fileElement.dataset['fileName'] || '',
      type: (fileElement.dataset['fileType'] as 'file' | 'directory') || 'file',
      modified: new Date(),
      created: new Date(),
      parent: ''
    }
  }

  function executeFileAction(action: FileGestureAction, file: FileSystemNode): void {
    // Trigger haptic feedback if configured
    if (action.haptic) {
      gestures.triggerHapticFeedback(action.haptic)
    }

    // Execute the action
    callbacks.onFileAction?.(action, file)

    // Clear revealed state
    state.swipeRevealedFile = null
  }

  function showSwipeActionMenu(
    fileElement: HTMLElement, 
    actions: FileGestureAction[], 
    _direction: 'left' | 'right'
  ): void {
    // This would typically show a floating action menu
    // For now, we'll just execute the first action
    const fileNode = getFileNodeFromElement(fileElement)
    if (fileNode && actions.length > 0 && actions[0]) {
      executeFileAction(actions[0], fileNode)
    }
  }

  // Public API
  const currentDensityLevel = computed(() => fileConfig.densityLevels[state.currentDensity])
  
  const isFileRevealed = (filePath: string): boolean => {
    return state.swipeRevealedFile === filePath
  }

  const hideRevealedActions = (): void => {
    state.swipeRevealedFile = null
  }

  const selectFile = (filePath: string): void => {
    if (state.selectedFiles.has(filePath)) {
      state.selectedFiles.delete(filePath)
    } else {
      state.selectedFiles.add(filePath)
    }
  }

  const clearSelection = (): void => {
    state.selectedFiles.clear()
  }

  const isFileSelected = (filePath: string): boolean => {
    return state.selectedFiles.has(filePath)
  }

  const updateConfig = (newConfig: Partial<FileGestureConfig>): void => {
    Object.assign(fileConfig, newConfig)
  }

  const setDensity = (density: 'compact' | 'normal' | 'comfortable'): void => {
    state.currentDensity = density
    callbacks.onDensityChange?.(density)
  }

  return {
    // State
    state: readonly(state),
    currentDensityLevel,
    isRefreshing: computed(() => state.isRefreshing),
    selectedFiles: computed(() => Array.from(state.selectedFiles)),

    // Gesture controls
    enable: gestures.enable,
    disable: gestures.disable,
    reset: gestures.reset,

    // File-specific methods
    isFileRevealed,
    hideRevealedActions,
    selectFile,
    clearSelection,
    isFileSelected,
    setDensity,
    updateConfig,

    // Haptic feedback
    triggerHapticFeedback: gestures.triggerHapticFeedback,

    // Configuration
    config: readonly(fileConfig)
  }
}