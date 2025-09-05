export type GestureType = 'tap' | 'double-tap' | 'triple-tap' | 'long-press' | 'swipe' | 'pinch' | 'pan';

export interface GestureData {
  scale?: number;
  rotation?: number;
  deltaX?: number;
  deltaY?: number;
  velocity?: { x: number; y: number };
  center?: { x: number; y: number };
  startPosition?: { x: number; y: number };
  endPosition?: { x: number; y: number };
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}

export interface TouchGesture {
  type: GestureType;
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  duration: number;
  velocity?: { x: number; y: number };
  scale?: number;
  data: GestureData;
}

export type GestureCallback = (gesture: TouchGesture) => void;

export interface GestureConfig {
  enabled: boolean;
  sensitivity: number;
  threshold?: number;
  timeout?: number;
}

export interface GestureSettings {
  tap: GestureConfig;
  doubleTap: GestureConfig;
  tripleTap: GestureConfig;
  longPress: GestureConfig;
  swipe: GestureConfig;
  pinch: GestureConfig;
  pan: GestureConfig;
  globalSensitivity: number;
  hapticFeedback: boolean;
  visualFeedback: boolean;
}

export interface GestureHandler {
  registerGesture(type: GestureType, handler: GestureCallback): void;
  unregisterGesture(type: GestureType): void;
  enableGesture(type: GestureType, enabled: boolean): void;
  setGestureSensitivity(sensitivity: number): void;
  setGestureConfig(type: GestureType, config: Partial<GestureConfig>): void;
  getGestureSettings(): GestureSettings;
  updateGestureSettings(settings: Partial<GestureSettings>): void;
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
  force?: number;
}

export interface GestureState {
  isGesturing: boolean;
  gestureType: GestureType | null;
  startTime: number;
  lastTapTime: number;
  tapCount: number;
  longPressTimer: NodeJS.Timeout | null;
  initialDistance: number;
  initialScale: number;
  conflictResolution: {
    activeGesture: GestureType | null;
    conflictingGestures: GestureType[];
  };
}