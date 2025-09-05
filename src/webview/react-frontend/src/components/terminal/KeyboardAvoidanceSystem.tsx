import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

export interface KeyboardAvoidanceProps {
  children: React.ReactNode;
  className?: string;
  enabled?: boolean;
  animationDuration?: number;
  keyboardThreshold?: number;
  onKeyboardToggle?: (visible: boolean, height: number) => void;
  maintainAspectRatio?: boolean;
  scrollToBottom?: boolean;
}

export interface KeyboardState {
  visible: boolean;
  height: number;
  animating: boolean;
}

export const KeyboardAvoidanceSystem: React.FC<KeyboardAvoidanceProps> = ({
  children,
  className,
  enabled = true,
  animationDuration = 300,
  keyboardThreshold = 150,
  onKeyboardToggle,
  maintainAspectRatio = false,
  scrollToBottom = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialViewportHeightRef = useRef<number>(window.innerHeight);
  const animationTimeoutRef = useRef<NodeJS.Timeout>();
  
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    visible: false,
    height: 0,
    animating: false
  });

  // Calculate keyboard height and visibility
  const calculateKeyboardState = useCallback((): KeyboardState => {
    if (!enabled) {
      return { visible: false, height: 0, animating: false };
    }

    const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
    const heightDifference = initialViewportHeightRef.current - currentViewportHeight;
    const isVisible = heightDifference > keyboardThreshold;
    
    return {
      visible: isVisible,
      height: isVisible ? heightDifference : 0,
      animating: keyboardState.animating
    };
  }, [enabled, keyboardThreshold, keyboardState.animating]);

  // Handle viewport changes with animation
  const handleViewportChange = useCallback(() => {
    const newState = calculateKeyboardState();
    const stateChanged = newState.visible !== keyboardState.visible || 
                        Math.abs(newState.height - keyboardState.height) > 10;

    if (stateChanged) {
      // Start animation
      setKeyboardState(() => ({
        ...newState,
        animating: true
      }));

      // Clear existing animation timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // End animation after duration
      animationTimeoutRef.current = setTimeout(() => {
        setKeyboardState(prev => ({
          ...prev,
          animating: false
        }));
      }, animationDuration);

      // Notify parent component
      onKeyboardToggle?.(newState.visible, newState.height);

      // Scroll to bottom if requested and keyboard is showing
      if (scrollToBottom && newState.visible && containerRef.current) {
        setTimeout(() => {
          containerRef.current?.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }, animationDuration / 2);
      }
    }
  }, [calculateKeyboardState, keyboardState, animationDuration, onKeyboardToggle, scrollToBottom]);

  // Initialize viewport monitoring
  useEffect(() => {
    if (!enabled) return;

    initialViewportHeightRef.current = window.innerHeight;

    // Use Visual Viewport API if available (better for mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }
      };
    } else {
      // Fallback to window resize for older browsers
      window.addEventListener('resize', handleViewportChange);
      return () => {
        window.removeEventListener('resize', handleViewportChange);
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }
      };
    }
  }, [enabled, handleViewportChange]);

  // Calculate container styles based on keyboard state
  const getContainerStyles = useCallback((): React.CSSProperties => {
    const { visible, height, animating } = keyboardState;
    
    if (!visible) {
      return {
        height: '100%',
        transition: animating ? `all ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)` : undefined
      };
    }

    const availableHeight = window.innerHeight - height;
    
    return {
      height: maintainAspectRatio ? `${availableHeight}px` : `calc(100% - ${height}px)`,
      maxHeight: `${availableHeight}px`,
      transition: animating ? `all ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)` : undefined,
      overflow: 'hidden'
    };
  }, [keyboardState, animationDuration, maintainAspectRatio]);

  // Calculate content area styles
  const getContentStyles = useCallback((): React.CSSProperties => {
    const { visible, height } = keyboardState;
    
    if (!visible) {
      return {
        transform: 'translateY(0)',
        transition: keyboardState.animating ? `transform ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)` : undefined
      };
    }

    // Slight upward adjustment to ensure content is visible above keyboard
    const adjustment = Math.min(height * 0.1, 20);
    
    return {
      transform: `translateY(-${adjustment}px)`,
      transition: keyboardState.animating ? `transform ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)` : undefined
    };
  }, [keyboardState, animationDuration]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'keyboard-avoidance-container',
        'relative w-full',
        keyboardState.visible && 'keyboard-visible',
        keyboardState.animating && 'keyboard-animating',
        className
      )}
      style={getContainerStyles()}
      data-keyboard-height={keyboardState.height}
      data-keyboard-visible={keyboardState.visible}
    >
      <div
        className="keyboard-avoidance-content w-full h-full"
        style={getContentStyles()}
      >
        {children}
      </div>
      
      {/* Keyboard spacer element for debugging/styling */}
      {keyboardState.visible && (
        <div
          className="keyboard-spacer absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: `${keyboardState.height}px`,
            background: 'transparent'
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// Hook for using keyboard avoidance state
export const useKeyboardAvoidance = (options: {
  enabled?: boolean;
  threshold?: number;
} = {}) => {
  const { enabled = true, threshold = 150 } = options;
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    visible: false,
    height: 0,
    animating: false
  });

  const initialHeightRef = useRef<number>(window.innerHeight);

  useEffect(() => {
    if (!enabled) return;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialHeightRef.current - currentHeight;
      const isVisible = heightDiff > threshold;

      setKeyboardState(prev => ({
        visible: isVisible,
        height: isVisible ? heightDiff : 0,
        animating: prev.visible !== isVisible
      }));

      // Reset animation flag after a delay
      setTimeout(() => {
        setKeyboardState(prev => ({ ...prev, animating: false }));
      }, 300);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
      return () => window.removeEventListener('resize', handleViewportChange);
    }
  }, [enabled, threshold]);

  return keyboardState;
};