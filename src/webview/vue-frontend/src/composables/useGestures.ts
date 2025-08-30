import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import type {
  TouchPoint,
  GestureEvent,
  GestureType,
  SwipeDirection,
  GestureConfiguration,
  GestureState,
  GestureCallbacks,
  GestureComposableOptions,
  GestureComposable,
  HapticFeedbackOptions
} from '../types/gestures'

// Default configuration
const defaultConfig: GestureConfiguration = {
  swipe: {
    threshold: 50, // 50px minimum distance
    velocity: 0.3, // 0.3px/ms minimum velocity
    maxTime: 300, // 300ms maximum time
    tolerance: 30 // 30 degrees tolerance
  },
  pinch: {
    threshold: 0.1, // 10% scale change minimum
    minScale: 0.5,
    maxScale: 3.0
  },
  longpress: {
    duration: 500, // 500ms for long press
    tolerance: 10 // 10px movement tolerance
  },
  pullrefresh: {
    threshold: 80, // 80px to trigger refresh
    maxDistance: 120, // 120px maximum pull
    elasticity: 0.5, // 50% resistance
    snapBackDuration: 300 // 300ms snap back
  },
  preventDefaultTouchAction: true,
  enableHapticFeedback: true,
  debugMode: false
}

export function useGestures(options: GestureComposableOptions = {}): GestureComposable {
  const element = ref<HTMLElement | null>(options.element || null)
  const enabled = ref(options.enabled !== false)
  const config = reactive<GestureConfiguration>({ ...defaultConfig, ...options.config })
  const callbacks = reactive<GestureCallbacks>(options.callbacks || {})

  // Gesture state
  const state = reactive<GestureState>({
    isActive: false,
    activeGestures: new Set(),
    touchPoints: new Map(),
    startTime: 0,
    lastEventTime: 0,
    currentScale: 1,
    pullRefreshDistance: 0,
    pullRefreshActive: false,
    pullRefreshTriggered: false
  })

  // Computed properties
  const isActive = computed(() => state.isActive)
  const activeGestures = computed(() => Array.from(state.activeGestures))
  const currentScale = computed(() => state.currentScale)
  const pullRefreshDistance = computed(() => state.pullRefreshDistance)

  // Utility functions
  const calculateDistance = (p1: TouchPoint, p2: TouchPoint): number => {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  const calculateVelocity = (distance: number, time: number): number => {
    return time > 0 ? distance / time : 0
  }

  const calculateAngle = (p1: TouchPoint, p2: TouchPoint): number => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
  }

  const getSwipeDirection = (angle: number): SwipeDirection => {
    const absAngle = Math.abs(angle)
    
    if (absAngle <= 45) return 'right'
    if (absAngle >= 135) return 'left'
    if (angle > 0) return 'down'
    return 'up'
  }

  const getTouchPoint = (touch: Touch): TouchPoint => ({
    x: touch.clientX,
    y: touch.clientY,
    timestamp: Date.now(),
    identifier: touch.identifier
  })

  const getCenterPoint = (touches: TouchPoint[]): { x: number; y: number } => {
    if (touches.length === 0) return { x: 0, y: 0 }
    
    const sum = touches.reduce(
      (acc, touch) => ({ x: acc.x + touch.x, y: acc.y + touch.y }),
      { x: 0, y: 0 }
    )
    
    return {
      x: sum.x / touches.length,
      y: sum.y / touches.length
    }
  }

  const createGestureEvent = (
    type: GestureType,
    target: HTMLElement,
    touches: TouchPoint[],
    additionalData: Partial<GestureEvent> = {}
  ): GestureEvent => {
    const center = getCenterPoint(touches)
    const now = Date.now()
    
    return {
      type,
      target,
      touches,
      deltaX: 0,
      deltaY: 0,
      distance: 0,
      velocity: 0,
      duration: now - state.startTime,
      center,
      preventDefault: () => {},
      stopPropagation: () => {},
      ...additionalData
    }
  }

  // Haptic feedback
  const triggerHapticFeedback = async (options: HapticFeedbackOptions): Promise<void> => {
    if (!config.enableHapticFeedback) return

    try {
      // Use Web Vibration API if available
      if ('vibrate' in navigator) {
        let pattern: number | number[]
        
        switch (options.type) {
          case 'light':
            pattern = 10
            break
          case 'medium':
            pattern = 20
            break
          case 'heavy':
            pattern = 50
            break
          case 'selection':
            pattern = [10, 10, 10]
            break
          case 'impact':
            pattern = [20, 10, 20]
            break
          case 'notification':
            pattern = [50, 20, 50, 20, 50]
            break
          default:
            pattern = options.pattern || 20
        }
        
        navigator.vibrate(pattern)
      }
    } catch (error) {
      if (config.debugMode) {
        console.warn('Haptic feedback not supported:', error)
      }
    }
  }

  // Gesture detection functions
  const detectSwipe = (startPoint: TouchPoint, endPoint: TouchPoint): GestureEvent | null => {
    const distance = calculateDistance(startPoint, endPoint)
    const time = endPoint.timestamp - startPoint.timestamp
    const velocity = calculateVelocity(distance, time)
    const angle = calculateAngle(startPoint, endPoint)
    const direction = getSwipeDirection(angle)

    if (distance < config.swipe.threshold) return null
    if (velocity < config.swipe.velocity) return null
    if (time > config.swipe.maxTime) return null

    return createGestureEvent('swipe', element.value!, [startPoint, endPoint], {
      deltaX: endPoint.x - startPoint.x,
      deltaY: endPoint.y - startPoint.y,
      distance,
      velocity,
      direction
    })
  }

  const detectPinch = (touches: TouchPoint[]): GestureEvent | null => {
    if (touches.length !== 2) return null

    const currentDistance = calculateDistance(touches[0]!, touches[1]!)
    
    if (!state.initialDistance) {
      state.initialDistance = currentDistance
      return null
    }

    const scale = currentDistance / state.initialDistance
    const scaleChange = Math.abs(scale - state.currentScale)

    if (scaleChange < config.pinch.threshold) return null

    state.currentScale = Math.max(
      config.pinch.minScale,
      Math.min(config.pinch.maxScale, scale)
    )

    return createGestureEvent('pinch', element.value!, touches, {
      scale: state.currentScale,
      distance: currentDistance
    })
  }

  const detectLongPress = (startPoint: TouchPoint, currentPoint: TouchPoint): GestureEvent | null => {
    const distance = calculateDistance(startPoint, currentPoint)
    const duration = currentPoint.timestamp - startPoint.timestamp

    if (distance > config.longpress.tolerance) return null
    if (duration < config.longpress.duration) return null

    return createGestureEvent('longpress', element.value!, [startPoint, currentPoint], {
      duration
    })
  }

  const detectPullRefresh = (startPoint: TouchPoint, currentPoint: TouchPoint): GestureEvent | null => {
    // Only detect pull refresh from top of container
    if (startPoint.y > 50) return null // Must start near top
    
    const deltaY = currentPoint.y - startPoint.y
    if (deltaY <= 0) return null // Must be pulling down

    // Apply elasticity
    const elasticDistance = deltaY * (1 - Math.min(deltaY / config.pullrefresh.maxDistance, 1) * config.pullrefresh.elasticity)
    state.pullRefreshDistance = Math.min(elasticDistance, config.pullrefresh.maxDistance)

    const shouldTrigger = state.pullRefreshDistance >= config.pullrefresh.threshold
    
    if (shouldTrigger && !state.pullRefreshTriggered) {
      state.pullRefreshTriggered = true
      state.pullRefreshActive = true
      
      return createGestureEvent('pullrefresh', element.value!, [startPoint, currentPoint], {
        deltaY: state.pullRefreshDistance,
        distance: state.pullRefreshDistance
      })
    }

    return null
  }

  // Touch event handlers
  const handleTouchStart = (event: TouchEvent): void => {
    if (!enabled.value || !element.value) return

    if (config.preventDefaultTouchAction) {
      event.preventDefault()
    }

    const now = Date.now()
    state.isActive = true
    state.startTime = now
    state.lastEventTime = now

    // Store touch points
    Array.from(event.touches).forEach(touch => {
      const touchPoint = getTouchPoint(touch)
      state.touchPoints.set(touch.identifier, touchPoint)
    })

    // Initialize gesture-specific state
    if (event.touches.length === 1) {
      const touch = getTouchPoint(event.touches[0]!)
      state.swipeStartPoint = touch
      state.longPressStartPoint = touch
      
      // Start long press timer
      state.longPressTimer = window.setTimeout(() => {
        if (state.longPressStartPoint && state.touchPoints.size === 1) {
          const currentTouch = Array.from(state.touchPoints.values())[0]
          const longPressEvent = detectLongPress(state.longPressStartPoint!, currentTouch!)
          
          if (longPressEvent) {
            state.activeGestures.add('longpress')
            triggerHapticFeedback({ type: 'medium' })
            callbacks.onLongPress?.(longPressEvent)
            callbacks.onGestureStart?.('longpress', longPressEvent)
          }
        }
      }, config.longpress.duration)
    }

    if (event.touches.length === 2) {
      const touches = Array.from(event.touches).map(getTouchPoint)
      state.initialDistance = calculateDistance(touches[0]!, touches[1]!)
      state.currentScale = 1
    }

    if (config.debugMode) {
      console.log('Touch start:', { touches: event.touches.length, points: state.touchPoints.size })
    }
  }

  const handleTouchMove = (event: TouchEvent): void => {
    if (!enabled.value || !element.value || !state.isActive) return

    if (config.preventDefaultTouchAction) {
      event.preventDefault()
    }

    const now = Date.now()
    state.lastEventTime = now

    // Update touch points
    Array.from(event.touches).forEach(touch => {
      const touchPoint = getTouchPoint(touch)
      state.touchPoints.set(touch.identifier, touchPoint)
    })

    const touches = Array.from(state.touchPoints.values())

    // Detect pinch gesture
    if (touches.length === 2) {
      const pinchEvent = detectPinch(touches)
      if (pinchEvent) {
        state.activeGestures.add('pinch')
        callbacks.onPinch?.(pinchEvent)
        
        if (!state.activeGestures.has('pinch')) {
          callbacks.onGestureStart?.('pinch', pinchEvent)
        }
      }
    }

    // Detect pull refresh (only for single touch)
    if (touches.length === 1 && state.swipeStartPoint) {
      const pullRefreshEvent = detectPullRefresh(state.swipeStartPoint!, touches[0]!)
      if (pullRefreshEvent) {
        state.activeGestures.add('pullrefresh')
        callbacks.onPullRefresh?.(pullRefreshEvent)
        
        if (!state.activeGestures.has('pullrefresh')) {
          triggerHapticFeedback({ type: 'light' })
          callbacks.onGestureStart?.('pullrefresh', pullRefreshEvent)
        }
      }
    }

    // Clear long press timer if touch moves too much
    if (state.longPressTimer && state.longPressStartPoint && touches.length === 1) {
      const distance = calculateDistance(state.longPressStartPoint!, touches[0]!)
      if (distance > config.longpress.tolerance) {
        clearTimeout(state.longPressTimer)
        state.longPressTimer = null
      }
    }

    if (config.debugMode) {
      console.log('Touch move:', { touches: touches.length, scale: state.currentScale })
    }
  }

  const handleTouchEnd = (event: TouchEvent): void => {
    if (!enabled.value || !element.value || !state.isActive) return

    if (config.preventDefaultTouchAction) {
      event.preventDefault()
    }

    // Clear long press timer
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer)
      state.longPressTimer = null
    }

    // Remove ended touches
    Array.from(event.changedTouches).forEach(touch => {
      state.touchPoints.delete(touch.identifier)
    })

    const remainingTouches = Array.from(state.touchPoints.values())

    // Detect swipe gesture if ending with single touch
    if (event.changedTouches.length === 1 && state.swipeStartPoint) {
      const endTouch = getTouchPoint(event.changedTouches[0]!)
      const swipeEvent = detectSwipe(state.swipeStartPoint, endTouch)
      
      if (swipeEvent) {
        state.activeGestures.add('swipe')
        triggerHapticFeedback({ type: 'light' })
        callbacks.onSwipe?.(swipeEvent)
        callbacks.onGestureStart?.('swipe', swipeEvent)
        callbacks.onGestureEnd?.('swipe', swipeEvent)
      }
    }

    // Handle pull refresh end
    if (state.pullRefreshActive) {
      if (state.pullRefreshTriggered) {
        // Animate back to normal position
        const startDistance = state.pullRefreshDistance
        const startTime = Date.now()
        
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / config.pullrefresh.snapBackDuration, 1)
          const easeOut = 1 - Math.pow(1 - progress, 3)
          
          state.pullRefreshDistance = startDistance * (1 - easeOut)
          
          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            state.pullRefreshDistance = 0
            state.pullRefreshActive = false
            state.pullRefreshTriggered = false
          }
        }
        
        requestAnimationFrame(animate)
      } else {
        state.pullRefreshDistance = 0
        state.pullRefreshActive = false
      }
    }

    // End all active gestures if no touches remain
    if (remainingTouches.length === 0) {
      state.activeGestures.forEach(gestureType => {
        const event = createGestureEvent(gestureType, element.value!, [])
        callbacks.onGestureEnd?.(gestureType, event)
      })
      
      reset()
    }

    if (config.debugMode) {
      console.log('Touch end:', { remaining: remainingTouches.length })
    }
  }

  const handleTouchCancel = (_event: TouchEvent): void => {
    if (!enabled.value || !element.value) return

    // Clear long press timer
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer)
      state.longPressTimer = null
    }

    // Cancel all active gestures
    state.activeGestures.forEach(gestureType => {
      const event = createGestureEvent(gestureType, element.value!, [])
      callbacks.onGestureCancel?.(gestureType, event)
    })

    reset()

    if (config.debugMode) {
      console.log('Touch cancel')
    }
  }

  // Control functions
  const enable = (): void => {
    enabled.value = true
  }

  const disable = (): void => {
    enabled.value = false
    reset()
  }

  const reset = (): void => {
    state.isActive = false
    state.activeGestures.clear()
    state.touchPoints.clear()
    state.startTime = 0
    state.lastEventTime = 0
    state.swipeStartPoint = null
    state.swipeDirection = null
    state.initialDistance = null
    state.currentScale = 1
    state.longPressStartPoint = null
    state.pullRefreshDistance = 0
    state.pullRefreshActive = false
    state.pullRefreshTriggered = false
    
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer)
      state.longPressTimer = null
    }
  }

  const updateConfig = (newConfig: Partial<GestureConfiguration>): void => {
    Object.assign(config, newConfig)
  }

  const isGestureActive = (type: GestureType): boolean => {
    return state.activeGestures.has(type)
  }

  const getGestureState = (): GestureState => {
    return { ...state }
  }

  // Setup event listeners
  const setupEventListeners = (): void => {
    if (!element.value) return

    element.value.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.value.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.value.addEventListener('touchend', handleTouchEnd, { passive: false })
    element.value.addEventListener('touchcancel', handleTouchCancel, { passive: false })

    // Prevent default touch actions via CSS if configured
    if (config.preventDefaultTouchAction) {
      element.value.style.touchAction = 'none'
    }
  }

  const removeEventListeners = (): void => {
    if (!element.value) return

    element.value.removeEventListener('touchstart', handleTouchStart)
    element.value.removeEventListener('touchmove', handleTouchMove)
    element.value.removeEventListener('touchend', handleTouchEnd)
    element.value.removeEventListener('touchcancel', handleTouchCancel)

    if (config.preventDefaultTouchAction) {
      element.value.style.touchAction = ''
    }
  }

  // Watch for element changes
  watch(element, (newElement, oldElement) => {
    if (oldElement) {
      removeEventListeners()
    }
    if (newElement) {
      setupEventListeners()
    }
  })

  // Watch for enabled state changes
  watch(enabled, (isEnabled) => {
    if (!isEnabled) {
      reset()
    }
  })

  // Setup initial listeners
  onMounted(() => {
    if (element.value) {
      setupEventListeners()
    }
  })

  // Cleanup
  onUnmounted(() => {
    removeEventListeners()
    reset()
  })

  return {
    // State
    isActive,
    activeGestures,
    currentScale,
    pullRefreshDistance,

    // Configuration
    updateConfig,

    // Control
    enable,
    disable,
    reset,

    // Haptic feedback
    triggerHapticFeedback,

    // Utilities
    isGestureActive,
    getGestureState
  }
}