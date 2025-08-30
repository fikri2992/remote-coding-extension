import type { ComputedRef } from 'vue'

export interface TouchPoint {
  x: number
  y: number
  timestamp: number
  identifier: number
}

export interface GestureEvent {
  type: GestureType
  target: HTMLElement
  touches: TouchPoint[]
  deltaX: number
  deltaY: number
  distance: number
  velocity: number
  scale?: number
  rotation?: number
  direction?: SwipeDirection
  duration: number
  center: { x: number; y: number }
  preventDefault: () => void
  stopPropagation: () => void
}

export type GestureType = 
  | 'swipe'
  | 'pinch'
  | 'pan'
  | 'tap'
  | 'longpress'
  | 'pullrefresh'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface SwipeGestureConfig {
  threshold: number // Minimum distance in pixels
  velocity: number // Minimum velocity in pixels/ms
  maxTime: number // Maximum time for swipe in ms
  tolerance: number // Tolerance for direction detection
}

export interface PinchGestureConfig {
  threshold: number // Minimum scale change to trigger
  minScale: number
  maxScale: number
}

export interface LongPressGestureConfig {
  duration: number // Time in ms to trigger long press
  tolerance: number // Maximum movement allowed during long press
}

export interface PullRefreshGestureConfig {
  threshold: number // Distance to trigger refresh
  maxDistance: number // Maximum pull distance
  elasticity: number // Elastic resistance factor
  snapBackDuration: number // Animation duration for snap back
}

export interface GestureConfiguration {
  swipe: SwipeGestureConfig
  pinch: PinchGestureConfig
  longpress: LongPressGestureConfig
  pullrefresh: PullRefreshGestureConfig
  
  // Global settings
  preventDefaultTouchAction: boolean
  enableHapticFeedback: boolean
  debugMode: boolean
}

export interface GestureState {
  isActive: boolean
  activeGestures: Set<GestureType>
  touchPoints: Map<number, TouchPoint>
  startTime: number
  lastEventTime: number
  
  // Swipe state
  swipeStartPoint?: TouchPoint | null
  swipeDirection?: SwipeDirection | null
  
  // Pinch state
  initialDistance?: number | null
  currentScale: number
  
  // Long press state
  longPressTimer?: number | null
  longPressStartPoint?: TouchPoint | null
  
  // Pull refresh state
  pullRefreshDistance: number
  pullRefreshActive: boolean
  pullRefreshTriggered: boolean
}

export interface HapticFeedbackOptions {
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification'
  pattern?: number[] // For custom vibration patterns
}

export interface GestureCallbacks {
  onSwipe?: (event: GestureEvent) => void
  onPinch?: (event: GestureEvent) => void
  onPan?: (event: GestureEvent) => void
  onTap?: (event: GestureEvent) => void
  onLongPress?: (event: GestureEvent) => void
  onPullRefresh?: (event: GestureEvent) => void
  
  // Lifecycle callbacks
  onGestureStart?: (type: GestureType, event: GestureEvent) => void
  onGestureEnd?: (type: GestureType, event: GestureEvent) => void
  onGestureCancel?: (type: GestureType, event: GestureEvent) => void
}

export interface GestureComposableOptions {
  element?: HTMLElement | null
  config?: Partial<GestureConfiguration>
  callbacks?: GestureCallbacks
  enabled?: boolean
}

export interface GestureComposable {
  // State
  isActive: ComputedRef<boolean>
  activeGestures: ComputedRef<GestureType[]>
  currentScale: ComputedRef<number>
  pullRefreshDistance: ComputedRef<number>
  
  // Configuration
  updateConfig: (config: Partial<GestureConfiguration>) => void
  
  // Control
  enable: () => void
  disable: () => void
  reset: () => void
  
  // Haptic feedback
  triggerHapticFeedback: (options: HapticFeedbackOptions) => Promise<void>
  
  // Utilities
  isGestureActive: (type: GestureType) => boolean
  getGestureState: () => GestureState
}