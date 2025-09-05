import React, { useRef, useCallback, useEffect, useState } from 'react';
import { 
  GestureType, 
  GestureData, 
  TouchGesture, 
  GestureCallback, 
  GestureSettings, 
  GestureConfig, 
  TouchPoint, 
  GestureState,
  GestureHandler as IGestureHandler
} from '../../types/gesture';
import { getGestureSetting, updateGestureSetting } from './gestureUtils';

export interface GestureHandlerProps {
  onGesture: (gesture: TouchGesture) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  gestureSettings?: Partial<GestureSettings>;
  onTextSelection?: (startX: number, startY: number, endX: number, endY: number) => void;
  enableMouseGestures?: boolean;
  enableTouchGestures?: boolean;
}

// Default gesture settings with configurable sensitivity
const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  tap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 300 },
  doubleTap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 300 },
  tripleTap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 400 },
  longPress: { enabled: true, sensitivity: 1, threshold: 10, timeout: 500 },
  swipe: { enabled: true, sensitivity: 1, threshold: 50, timeout: 1000 },
  pinch: { enabled: true, sensitivity: 1, threshold: 20 },
  pan: { enabled: true, sensitivity: 1, threshold: 10 },
  globalSensitivity: 1,
  hapticFeedback: true,
  visualFeedback: true
};

export const GestureHandler: React.FC<GestureHandlerProps> = ({
  onGesture,
  className,
  style,
  children,
  gestureSettings = {},
  onTextSelection,
  enableMouseGestures = true,
  enableTouchGestures = true
}) => {
  const touchesRef = useRef<Map<number, TouchPoint>>(new Map());
  const gestureHandlersRef = useRef<Map<GestureType, GestureCallback[]>>(new Map());
  const mouseStateRef = useRef<{
    isDown: boolean;
    startPos: { x: number; y: number };
    lastClickTime: number;
    clickCount: number;
  }>({
    isDown: false,
    startPos: { x: 0, y: 0 },
    lastClickTime: 0,
    clickCount: 0
  });

  const [settings, setSettings] = useState<GestureSettings>({
    ...DEFAULT_GESTURE_SETTINGS,
    ...gestureSettings
  });

  const gestureStateRef = useRef<GestureState>({
    isGesturing: false,
    gestureType: null,
    startTime: 0,
    lastTapTime: 0,
    tapCount: 0,
    longPressTimer: null,
    initialDistance: 0,
    initialScale: 1,
    conflictResolution: {
      activeGesture: null,
      conflictingGestures: []
    }
  });

  // Gesture Handler Implementation would go here if needed for external use
  // Currently this component handles gestures internally

  // Utility functions
  const getDistance = (p1: TouchPoint | { x: number; y: number }, p2: TouchPoint | { x: number; y: number }): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touches: TouchPoint[]): { x: number; y: number } => {
    const x = touches.reduce((sum, touch) => sum + touch.x, 0) / touches.length;
    const y = touches.reduce((sum, touch) => sum + touch.y, 0) / touches.length;
    return { x, y };
  };

  const getSwipeDirection = (deltaX: number, deltaY: number): 'up' | 'down' | 'left' | 'right' => {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absX > absY) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  };

  // Haptic feedback function
  const triggerHapticFeedback = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!settings.hapticFeedback) return;
    
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30]
      };
      navigator.vibrate(patterns[intensity]);
    }
  };

  // Visual feedback function
  const triggerVisualFeedback = (x: number, y: number, _type: GestureType) => {
    if (!settings.visualFeedback) return;
    
    // Create a temporary visual indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      left: ${x - 15}px;
      top: ${y - 15}px;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: rgba(0, 123, 255, 0.3);
      border: 2px solid rgba(0, 123, 255, 0.6);
      pointer-events: none;
      z-index: 9999;
      animation: gestureRipple 0.3s ease-out;
    `;
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      if (document.body.contains(indicator)) {
        document.body.removeChild(indicator);
      }
    }, 300);
  };

  // Gesture conflict resolution with priority system
  const resolveGestureConflict = (newGesture: GestureType): boolean => {
    const state = gestureStateRef.current;
    
    // If no active gesture, allow new gesture
    if (!state.conflictResolution.activeGesture) {
      state.conflictResolution.activeGesture = newGesture;
      return true;
    }
    
    // Priority order: pinch > long-press > triple-tap > double-tap > swipe > pan > tap
    const priority: Record<GestureType, number> = {
      'pinch': 7,
      'long-press': 6,
      'triple-tap': 5,
      'double-tap': 4,
      'swipe': 3,
      'pan': 2,
      'tap': 1
    };
    
    const currentPriority = priority[state.conflictResolution.activeGesture];
    const newPriority = priority[newGesture];
    
    // Allow higher priority gestures to override lower priority ones
    if (newPriority > currentPriority) {
      state.conflictResolution.conflictingGestures.push(state.conflictResolution.activeGesture);
      state.conflictResolution.activeGesture = newGesture;
      return true;
    }
    
    // Add to conflicting gestures list for debugging
    if (!state.conflictResolution.conflictingGestures.includes(newGesture)) {
      state.conflictResolution.conflictingGestures.push(newGesture);
    }
    
    return false;
  };

  // Create and dispatch gesture
  const createGesture = (type: GestureType, startPos: { x: number; y: number }, endPos: { x: number; y: number }, data: GestureData): TouchGesture => {
    const now = Date.now();
    const duration = now - gestureStateRef.current.startTime;
    
    return {
      type,
      startPosition: startPos,
      endPosition: endPos,
      duration,
      velocity: data.velocity,
      scale: data.scale,
      data
    };
  };

  const dispatchGesture = (gesture: TouchGesture) => {
    // Check if gesture type is enabled
    const gestureSetting = getGestureSetting(settings, gesture.type);
    if (!gestureSetting?.enabled) return;
    
    // Apply sensitivity scaling
    const sensitivityFactor = settings.globalSensitivity * (gestureSetting?.sensitivity || 1);
    
    // Adjust gesture data based on sensitivity
    if (gesture.data.deltaX !== undefined) {
      gesture.data.deltaX *= sensitivityFactor;
    }
    if (gesture.data.deltaY !== undefined) {
      gesture.data.deltaY *= sensitivityFactor;
    }
    if (gesture.data.velocity) {
      gesture.data.velocity.x *= sensitivityFactor;
      gesture.data.velocity.y *= sensitivityFactor;
    }
    
    // Trigger feedback
    if (gesture.data.center) {
      triggerHapticFeedback('light');
      triggerVisualFeedback(gesture.data.center.x, gesture.data.center.y, gesture.type);
    }
    
    // Call registered handlers
    const handlers = gestureHandlersRef.current.get(gesture.type) || [];
    handlers.forEach(handler => handler(gesture));
    
    // Call main gesture handler
    onGesture(gesture);
  };

  // Mouse event handlers
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!enableMouseGestures) return;
    
    const now = Date.now();
    mouseStateRef.current.isDown = true;
    mouseStateRef.current.startPos = { x: event.clientX, y: event.clientY };
    
    // Initialize gesture state
    gestureStateRef.current.startTime = now;
    gestureStateRef.current.isGesturing = true;
    gestureStateRef.current.conflictResolution.activeGesture = null;
    
    // Handle click sequence detection
    const timeSinceLastClick = now - mouseStateRef.current.lastClickTime;
    
    if (timeSinceLastClick < settings.doubleTap.timeout!) {
      mouseStateRef.current.clickCount++;
    } else {
      mouseStateRef.current.clickCount = 1;
    }
    
    mouseStateRef.current.lastClickTime = now;
    
    // Start long press timer
    if (settings.longPress.enabled) {
      gestureStateRef.current.longPressTimer = setTimeout(() => {
        if (resolveGestureConflict('long-press')) {
          const gesture = createGesture('long-press', mouseStateRef.current.startPos, mouseStateRef.current.startPos, {
            center: mouseStateRef.current.startPos
          });
          dispatchGesture(gesture);
        }
      }, settings.longPress.timeout!);
    }
  }, [enableMouseGestures, settings, onGesture]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (!enableMouseGestures || !mouseStateRef.current.isDown) return;
    
    mouseStateRef.current.isDown = false;
    
    // Clear long press timer
    if (gestureStateRef.current.longPressTimer) {
      clearTimeout(gestureStateRef.current.longPressTimer);
      gestureStateRef.current.longPressTimer = null;
    }
    
    const endPos = { x: event.clientX, y: event.clientY };
    const distance = getDistance(mouseStateRef.current.startPos, endPos);
    
    // Handle click gestures
    if (distance < (settings.tap.threshold! * settings.globalSensitivity)) {
      // Handle multi-click detection
      if (mouseStateRef.current.clickCount === 3 && settings.tripleTap.enabled) {
        if (resolveGestureConflict('triple-tap')) {
          const gesture = createGesture('triple-tap', mouseStateRef.current.startPos, endPos, {
            center: endPos
          });
          dispatchGesture(gesture);
          
          // Handle text selection for triple-click (select line)
          if (onTextSelection) {
            onTextSelection(endPos.x, endPos.y, endPos.x, endPos.y);
          }
        }
      } else if (mouseStateRef.current.clickCount === 2 && settings.doubleTap.enabled) {
        if (resolveGestureConflict('double-tap')) {
          const gesture = createGesture('double-tap', mouseStateRef.current.startPos, endPos, {
            center: endPos
          });
          dispatchGesture(gesture);
          
          // Handle text selection for double-click (select word)
          if (onTextSelection) {
            onTextSelection(endPos.x, endPos.y, endPos.x, endPos.y);
          }
        }
      } else {
        // Single click - wait to see if it becomes multi-click
        setTimeout(() => {
          if (mouseStateRef.current.clickCount === 1 && settings.tap.enabled) {
            if (resolveGestureConflict('tap')) {
              const gesture = createGesture('tap', mouseStateRef.current.startPos, endPos, {
                center: endPos
              });
              dispatchGesture(gesture);
            }
          }
        }, settings.tap.timeout!);
      }
    }
    
    // Reset gesture state
    setTimeout(() => {
      gestureStateRef.current.isGesturing = false;
      gestureStateRef.current.gestureType = null;
      gestureStateRef.current.conflictResolution.activeGesture = null;
      gestureStateRef.current.conflictResolution.conflictingGestures = [];
    }, 50);
  }, [enableMouseGestures, settings, onGesture, onTextSelection]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!enableMouseGestures || !mouseStateRef.current.isDown) return;
    
    const currentPos = { x: event.clientX, y: event.clientY };
    const deltaX = currentPos.x - mouseStateRef.current.startPos.x;
    const deltaY = currentPos.y - mouseStateRef.current.startPos.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Clear long press timer on significant movement
    if (gestureStateRef.current.longPressTimer && distance > (settings.longPress.threshold || 10)) {
      clearTimeout(gestureStateRef.current.longPressTimer);
      gestureStateRef.current.longPressTimer = null;
    }
    
    // Detect drag/pan gesture
    if (distance > (settings.pan.threshold! * settings.globalSensitivity)) {
      if (settings.pan.enabled && resolveGestureConflict('pan')) {
        const gesture = createGesture('pan', mouseStateRef.current.startPos, currentPos, {
          deltaX,
          deltaY,
          distance,
          center: currentPos
        });
        dispatchGesture(gesture);
      }
    }
  }, [enableMouseGestures, settings, onGesture]);

  // Touch event handlers (delegated to TouchGestureHandler logic)
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!enableTouchGestures) return;
    
    event.preventDefault();
    
    const now = Date.now();
    const touches = Array.from(event.touches);
    
    // Initialize gesture state
    gestureStateRef.current.startTime = now;
    gestureStateRef.current.isGesturing = true;
    gestureStateRef.current.conflictResolution.activeGesture = null;
    gestureStateRef.current.conflictResolution.conflictingGestures = [];
    
    // Clear existing touches and add new ones
    touchesRef.current.clear();
    touches.forEach(touch => {
      touchesRef.current.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now,
        force: (touch as any).force || 0
      });
    });

    // Handle single touch gestures
    if (touches.length === 1) {
      const touch = touches[0];
      const touchPos = { x: touch.clientX, y: touch.clientY };
      
      // Handle tap sequence (single, double, triple)
      const timeSinceLastTap = now - gestureStateRef.current.lastTapTime;
      
      if (timeSinceLastTap < settings.doubleTap.timeout!) {
        gestureStateRef.current.tapCount++;
        
        // Triple tap detection
        if (gestureStateRef.current.tapCount === 3 && settings.tripleTap.enabled) {
          if (resolveGestureConflict('triple-tap')) {
            const gesture = createGesture('triple-tap', touchPos, touchPos, {
              center: touchPos
            });
            dispatchGesture(gesture);
            
            // Handle text selection for triple-tap (select line)
            if (onTextSelection) {
              onTextSelection(touchPos.x, touchPos.y, touchPos.x, touchPos.y);
            }
            
            gestureStateRef.current.tapCount = 0;
            return;
          }
        }
        
        // Double tap detection
        if (gestureStateRef.current.tapCount === 2 && settings.doubleTap.enabled) {
          if (resolveGestureConflict('double-tap')) {
            const gesture = createGesture('double-tap', touchPos, touchPos, {
              center: touchPos
            });
            dispatchGesture(gesture);
            
            // Handle text selection for double-tap (select word)
            if (onTextSelection) {
              onTextSelection(touchPos.x, touchPos.y, touchPos.x, touchPos.y);
            }
            
            return;
          }
        }
      } else {
        gestureStateRef.current.tapCount = 1;
      }
      
      gestureStateRef.current.lastTapTime = now;
      
      // Start long press timer
      if (settings.longPress.enabled) {
        gestureStateRef.current.longPressTimer = setTimeout(() => {
          if (resolveGestureConflict('long-press')) {
            const gesture = createGesture('long-press', touchPos, touchPos, {
              center: touchPos
            });
            dispatchGesture(gesture);
          }
        }, settings.longPress.timeout!);
      }
    }
    
    // Handle multi-touch gestures (pinch)
    if (touches.length === 2 && settings.pinch.enabled) {
      const touchPoints = Array.from(touchesRef.current.values());
      gestureStateRef.current.initialDistance = getDistance(touchPoints[0], touchPoints[1]);
      gestureStateRef.current.initialScale = 1;
      
      if (resolveGestureConflict('pinch')) {
        // Clear long press timer for multi-touch
        if (gestureStateRef.current.longPressTimer) {
          clearTimeout(gestureStateRef.current.longPressTimer);
          gestureStateRef.current.longPressTimer = null;
        }
      }
    }
  }, [enableTouchGestures, settings, onGesture, onTextSelection]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!enableTouchGestures) return;
    
    event.preventDefault();
    
    const touches = Array.from(event.touches);
    const now = Date.now();
    
    // Update touch positions
    touches.forEach(touch => {
      const existingTouch = touchesRef.current.get(touch.identifier);
      if (existingTouch) {
        touchesRef.current.set(touch.identifier, {
          ...existingTouch,
          x: touch.clientX,
          y: touch.clientY,
          timestamp: now,
          force: (touch as any).force || 0
        });
      }
    });

    // Clear long press timer on significant movement
    if (gestureStateRef.current.longPressTimer) {
      const firstTouch = touches[0];
      const originalTouch = Array.from(touchesRef.current.values())[0];
      
      if (originalTouch) {
        const moveDistance = getDistance(
          { x: firstTouch.clientX, y: firstTouch.clientY },
          originalTouch
        );
        
        if (moveDistance > (settings.longPress.threshold || 10)) {
          clearTimeout(gestureStateRef.current.longPressTimer);
          gestureStateRef.current.longPressTimer = null;
        }
      }
    }

    // Handle pinch gesture
    if (touches.length === 2 && settings.pinch.enabled && gestureStateRef.current.conflictResolution.activeGesture === 'pinch') {
      const touchPoints = Array.from(touchesRef.current.values());
      if (touchPoints.length === 2) {
        const currentDistance = getDistance(touchPoints[0], touchPoints[1]);
        const scale = currentDistance / gestureStateRef.current.initialDistance;
        const center = getCenter(touchPoints);
        
        // Only trigger if scale change is significant
        if (Math.abs(scale - 1) > (settings.pinch.threshold! / 100)) {
          const gesture = createGesture('pinch', touchPoints[0], touchPoints[1], {
            scale,
            center
          });
          dispatchGesture(gesture);
        }
      }
    }

    // Handle single touch pan/swipe
    if (touches.length === 1) {
      const touch = touches[0];
      const startTouch = Array.from(touchesRef.current.values())[0];
      
      if (startTouch) {
        const deltaX = touch.clientX - startTouch.x;
        const deltaY = touch.clientY - startTouch.y;
        const timeDelta = now - startTouch.timestamp;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Calculate velocity
        const velocity = {
          x: timeDelta > 0 ? deltaX / timeDelta : 0,
          y: timeDelta > 0 ? deltaY / timeDelta : 0
        };
        
        // Detect swipe if movement is significant and fast enough
        const swipeThreshold = settings.swipe.threshold! * settings.globalSensitivity;
        const velocityThreshold = 0.5; // pixels per ms
        
        if (distance > swipeThreshold && (Math.abs(velocity.x) > velocityThreshold || Math.abs(velocity.y) > velocityThreshold)) {
          if (settings.swipe.enabled && resolveGestureConflict('swipe')) {
            const direction = getSwipeDirection(deltaX, deltaY);
            const gesture = createGesture('swipe', 
              { x: startTouch.x, y: startTouch.y }, 
              { x: touch.clientX, y: touch.clientY }, 
              {
                deltaX,
                deltaY,
                velocity,
                direction,
                distance,
                center: { x: touch.clientX, y: touch.clientY }
              }
            );
            dispatchGesture(gesture);
          }
        }
        // Detect pan for slower, continuous movement
        else if (distance > (settings.pan.threshold! * settings.globalSensitivity)) {
          if (settings.pan.enabled && resolveGestureConflict('pan')) {
            const gesture = createGesture('pan',
              { x: startTouch.x, y: startTouch.y },
              { x: touch.clientX, y: touch.clientY },
              {
                deltaX,
                deltaY,
                velocity,
                distance,
                center: { x: touch.clientX, y: touch.clientY }
              }
            );
            dispatchGesture(gesture);
          }
        }
      }
    }
  }, [enableTouchGestures, settings, onGesture]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!enableTouchGestures) return;
    
    event.preventDefault();
    
    const remainingTouches = Array.from(event.touches);
    const changedTouches = Array.from(event.changedTouches);
    
    // Remove ended touches
    changedTouches.forEach(touch => {
      touchesRef.current.delete(touch.identifier);
    });

    // Clear long press timer
    if (gestureStateRef.current.longPressTimer) {
      clearTimeout(gestureStateRef.current.longPressTimer);
      gestureStateRef.current.longPressTimer = null;
    }

    // Handle single tap (only if no other gestures were triggered)
    if (remainingTouches.length === 0 && gestureStateRef.current.tapCount === 1) {
      // Wait to see if this becomes a double/triple tap
      setTimeout(() => {
        if (gestureStateRef.current.tapCount === 1 && settings.tap.enabled) {
          const lastTouch = changedTouches[0];
          if (lastTouch && resolveGestureConflict('tap')) {
            const touchPos = { x: lastTouch.clientX, y: lastTouch.clientY };
            const gesture = createGesture('tap', touchPos, touchPos, {
              center: touchPos
            });
            dispatchGesture(gesture);
          }
          gestureStateRef.current.tapCount = 0;
        }
      }, settings.tap.timeout!);
    }

    // Reset gesture state when all touches end
    if (remainingTouches.length === 0) {
      // Reset after a short delay to allow for multi-tap detection
      setTimeout(() => {
        if (remainingTouches.length === 0) {
          gestureStateRef.current.isGesturing = false;
          gestureStateRef.current.gestureType = null;
          gestureStateRef.current.conflictResolution.activeGesture = null;
          gestureStateRef.current.conflictResolution.conflictingGestures = [];
        }
      }, 50);
    }

    // End multi-touch gestures
    if (remainingTouches.length < 2) {
      gestureStateRef.current.initialDistance = 0;
      gestureStateRef.current.initialScale = 1;
    }
  }, [enableTouchGestures, settings, onGesture]);

  // Add CSS for visual feedback animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes gestureRipple {
        0% {
          transform: scale(0);
          opacity: 1;
        }
        100% {
          transform: scale(2);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gestureStateRef.current.longPressTimer) {
        clearTimeout(gestureStateRef.current.longPressTimer);
      }
    };
  }, []);

  // Update settings when props change
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      ...gestureSettings
    }));
  }, [gestureSettings]);

  // Expose gesture handler methods via context or ref if needed
  // const contextValue = React.useMemo(() => gestureHandler, [gestureHandler]);

  return (
    <div
      className={className}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}
    </div>
  );
};

// Custom hook to provide gesture handler functionality
export const useGestureHandler = (initialSettings?: Partial<GestureSettings>) => {
  const gestureHandlersRef = useRef<Map<GestureType, GestureCallback[]>>(new Map());
  const [settings, setSettings] = useState<GestureSettings>({
    ...DEFAULT_GESTURE_SETTINGS,
    ...initialSettings
  });

  const gestureHandler: IGestureHandler = {
    registerGesture: (type: GestureType, handler: GestureCallback) => {
      const handlers = gestureHandlersRef.current.get(type) || [];
      handlers.push(handler);
      gestureHandlersRef.current.set(type, handlers);
    },

    unregisterGesture: (type: GestureType) => {
      gestureHandlersRef.current.delete(type);
    },

    enableGesture: (type: GestureType, enabled: boolean) => {
      setSettings(prev => ({
        ...prev,
        ...updateGestureSetting(prev, type, { enabled })
      }));
    },

    setGestureSensitivity: (sensitivity: number) => {
      setSettings(prev => ({
        ...prev,
        globalSensitivity: Math.max(0.1, Math.min(5, sensitivity))
      }));
    },

    setGestureConfig: (type: GestureType, config: Partial<GestureConfig>) => {
      setSettings(prev => ({
        ...prev,
        ...updateGestureSetting(prev, type, config)
      }));
    },

    getGestureSettings: () => settings,

    updateGestureSettings: (newSettings: Partial<GestureSettings>) => {
      setSettings(prev => ({ ...prev, ...newSettings }));
    }
  };

  return { gestureHandler, settings };
};

export default GestureHandler;