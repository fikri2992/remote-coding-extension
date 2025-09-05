import React, { useRef, useCallback, useEffect } from 'react';

export interface GestureData {
  scale?: number;
  rotation?: number;
  deltaX?: number;
  deltaY?: number;
  velocity?: { x: number; y: number };
  center?: { x: number; y: number };
}

export interface TouchGestureHandlerProps {
  onGesture: (type: string, data: GestureData) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export const TouchGestureHandler: React.FC<TouchGestureHandlerProps> = ({
  onGesture,
  className,
  style
}) => {
  const touchesRef = useRef<Map<number, TouchPoint>>(new Map());
  const gestureStateRef = useRef({
    isGesturing: false,
    initialDistance: 0,
    initialScale: 1,
    lastTapTime: 0,
    tapCount: 0,
    longPressTimer: null as NodeJS.Timeout | null
  });

  // Calculate distance between two points
  const getDistance = (p1: TouchPoint, p2: TouchPoint): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate center point between touches
  const getCenter = (touches: TouchPoint[]): { x: number; y: number } => {
    const x = touches.reduce((sum, touch) => sum + touch.x, 0) / touches.length;
    const y = touches.reduce((sum, touch) => sum + touch.y, 0) / touches.length;
    return { x, y };
  };

  // Handle touch start
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    const now = Date.now();
    const touches = Array.from(event.touches);
    
    // Clear existing touches and add new ones
    touchesRef.current.clear();
    touches.forEach(touch => {
      touchesRef.current.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now
      });
    });

    // Handle single touch gestures
    if (touches.length === 1) {
      const touch = touches[0];
      
      // Detect double tap
      if (now - gestureStateRef.current.lastTapTime < 300) {
        gestureStateRef.current.tapCount++;
        if (gestureStateRef.current.tapCount === 2) {
          onGesture('double-tap', {
            center: { x: touch.clientX, y: touch.clientY }
          });
          gestureStateRef.current.tapCount = 0;
        }
      } else {
        gestureStateRef.current.tapCount = 1;
      }
      
      gestureStateRef.current.lastTapTime = now;
      
      // Start long press timer
      gestureStateRef.current.longPressTimer = setTimeout(() => {
        onGesture('long-press', {
          center: { x: touch.clientX, y: touch.clientY }
        });
      }, 500);
    }
    
    // Handle multi-touch gestures (pinch)
    if (touches.length === 2) {
      const touchPoints = Array.from(touchesRef.current.values());
      gestureStateRef.current.initialDistance = getDistance(touchPoints[0], touchPoints[1]);
      gestureStateRef.current.initialScale = 1;
      gestureStateRef.current.isGesturing = true;
      
      // Clear long press timer for multi-touch
      if (gestureStateRef.current.longPressTimer) {
        clearTimeout(gestureStateRef.current.longPressTimer);
        gestureStateRef.current.longPressTimer = null;
      }
    }
  }, [onGesture]);

  // Handle touch move
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
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
          timestamp: now
        });
      }
    });

    // Clear long press timer on move
    if (gestureStateRef.current.longPressTimer) {
      clearTimeout(gestureStateRef.current.longPressTimer);
      gestureStateRef.current.longPressTimer = null;
    }

    // Handle pinch gesture
    if (touches.length === 2 && gestureStateRef.current.isGesturing) {
      const touchPoints = Array.from(touchesRef.current.values());
      if (touchPoints.length === 2) {
        const currentDistance = getDistance(touchPoints[0], touchPoints[1]);
        const scale = currentDistance / gestureStateRef.current.initialDistance;
        
        onGesture('pinch', {
          scale,
          center: getCenter(touchPoints)
        });
      }
    }

    // Handle single touch pan/swipe
    if (touches.length === 1) {
      const touch = touches[0];
      const touchPoint = touchesRef.current.get(touch.identifier);
      
      if (touchPoint) {
        const deltaX = touch.clientX - touchPoint.x;
        const deltaY = touch.clientY - touchPoint.y;
        const timeDelta = now - touchPoint.timestamp;
        
        // Calculate velocity
        const velocity = {
          x: deltaX / timeDelta,
          y: deltaY / timeDelta
        };
        
        // Detect swipe if movement is significant
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > 50) {
          onGesture('swipe', {
            deltaX,
            deltaY,
            velocity,
            center: { x: touch.clientX, y: touch.clientY }
          });
        }
      }
    }
  }, [onGesture]);

  // Handle touch end
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
    
    const remainingTouches = Array.from(event.touches);
    
    // Remove ended touches
    const allTouchIds = new Set(Array.from(event.changedTouches).map(t => t.identifier));
    allTouchIds.forEach(id => {
      touchesRef.current.delete(id);
    });

    // Clear long press timer
    if (gestureStateRef.current.longPressTimer) {
      clearTimeout(gestureStateRef.current.longPressTimer);
      gestureStateRef.current.longPressTimer = null;
    }

    // Handle single tap
    if (remainingTouches.length === 0 && gestureStateRef.current.tapCount === 1) {
      setTimeout(() => {
        if (gestureStateRef.current.tapCount === 1) {
          onGesture('tap', {});
          gestureStateRef.current.tapCount = 0;
        }
      }, 300);
    }

    // End gesture state
    if (remainingTouches.length < 2) {
      gestureStateRef.current.isGesturing = false;
      gestureStateRef.current.initialDistance = 0;
      gestureStateRef.current.initialScale = 1;
    }
  }, [onGesture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gestureStateRef.current.longPressTimer) {
        clearTimeout(gestureStateRef.current.longPressTimer);
      }
    };
  }, []);

  return (
    <div
      className={className}
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    />
  );
};