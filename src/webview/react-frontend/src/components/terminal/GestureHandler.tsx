import React, { useRef, useEffect, ReactNode } from 'react';

interface GestureHandlerProps {
  children: ReactNode;
  onGesture: (gesture: string, data?: any) => void;
  className?: string;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export const GestureHandler: React.FC<GestureHandlerProps> = ({
  children,
  onGesture,
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<TouchPoint | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  // Calculate distance between two touch points
  const getDistance = (touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();
    
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now
    };

    // Handle multi-touch (pinch)
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      pinchStartRef.current = { distance, scale: 1 };
      return;
    }

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      if (touchStartRef.current) {
        onGesture('longPress', {
          x: touchStartRef.current.x,
          y: touchStartRef.current.y
        });
      }
    }, 500);

    // Check for double tap
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const dx = Math.abs(touch.clientX - lastTapRef.current.x);
      const dy = Math.abs(touch.clientY - lastTapRef.current.y);
      
      if (dx < 50 && dy < 50) {
        onGesture('doubleTap', { x: touch.clientX, y: touch.clientY });
        lastTapRef.current = null;
        return;
      }
    }

    lastTapRef.current = { x: touch.clientX, y: touch.clientY, time: now };
  };

  // Handle touch move
  const handleTouchMove = (e: TouchEvent) => {
    // Clear long press timer on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && pinchStartRef.current) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      const scale = distance / pinchStartRef.current.distance;
      
      onGesture('pinch', { 
        scale,
        delta: scale - pinchStartRef.current.scale
      });
      
      pinchStartRef.current.scale = scale;
      return;
    }

    const touch = e.touches[0];
    touchEndRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  // Handle touch end
  const handleTouchEnd = (e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Reset pinch state
    if (e.touches.length < 2) {
      pinchStartRef.current = null;
    }

    if (!touchStartRef.current || !touchEndRef.current) return;

    const dx = touchEndRef.current.x - touchStartRef.current.x;
    const dy = touchEndRef.current.y - touchStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = touchEndRef.current.time - touchStartRef.current.time;

    // Minimum distance and maximum duration for swipe
    if (distance > 50 && duration < 500) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      // Determine swipe direction
      if (Math.abs(angle) < 45) {
        onGesture('swipeRight', { distance, duration, angle });
      } else if (Math.abs(angle) > 135) {
        onGesture('swipeLeft', { distance, duration, angle });
      } else if (angle > 45 && angle < 135) {
        onGesture('swipeDown', { distance, duration, angle });
      } else if (angle < -45 && angle > -135) {
        onGesture('swipeUp', { distance, duration, angle });
      }
    }

    // Reset touch points
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Handle mouse events for desktop testing
  const handleMouseDown = (e: MouseEvent) => {
    const now = Date.now();
    touchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: now
    };

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      if (touchStartRef.current) {
        onGesture('longPress', {
          x: touchStartRef.current.x,
          y: touchStartRef.current.y
        });
      }
    }, 500);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (touchStartRef.current) {
      touchEndRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now()
      };
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!touchStartRef.current) return;

    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - touchStartRef.current.time;

    // Handle mouse swipes (for desktop testing)
    if (distance > 50 && duration < 500) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      if (Math.abs(angle) < 45) {
        onGesture('swipeRight', { distance, duration, angle });
      } else if (Math.abs(angle) > 135) {
        onGesture('swipeLeft', { distance, duration, angle });
      } else if (angle > 45 && angle < 135) {
        onGesture('swipeDown', { distance, duration, angle });
      } else if (angle < -45 && angle > -135) {
        onGesture('swipeUp', { distance, duration, angle });
      }
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch events
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Mouse events for desktop testing
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [onGesture]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ touchAction: 'none' }} // Prevent default touch behaviors
    >
      {children}
    </div>
  );
};