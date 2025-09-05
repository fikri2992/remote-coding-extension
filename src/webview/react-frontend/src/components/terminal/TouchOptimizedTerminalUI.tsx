import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalXterm, TerminalXtermHandle } from './TerminalXterm';
import { TouchGestureHandler } from './TouchGestureHandler';
import { SmartVirtualKeyboard } from './SmartVirtualKeyboard';
import { HapticFeedback } from './HapticFeedback';
import { ResponsiveFontSystem } from './ResponsiveFontSystem';
import { VisualFeedbackSystem } from './VisualFeedbackSystem';
import { cn } from '../../lib/utils';

export interface TouchOptimizedTerminalUIProps {
  onInput: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  className?: string;
  terminalState?: 'idle' | 'active' | 'input' | 'running';
  currentDirectory?: string;
  commandHistory?: string[];
}

export interface TouchOptimizedTerminalUIHandle extends TerminalXtermHandle {
  enableTouchMode: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
  triggerHapticFeedback: (type: 'light' | 'medium' | 'heavy') => void;
}

export const TouchOptimizedTerminalUI = React.forwardRef<
  TouchOptimizedTerminalUIHandle,
  TouchOptimizedTerminalUIProps
>(({ onInput, onResize, className, terminalState = 'idle', currentDirectory = '~', commandHistory = [] }, ref) => {
  const terminalRef = useRef<TerminalXtermHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [touchInteractions, setTouchInteractions] = useState<Array<{ id: string; x: number; y: number; timestamp: number }>>([]);

  // Detect touch device capability
  useEffect(() => {
    const checkTouchDevice = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(hasTouch);
      
      // Auto-show virtual keyboard on touch devices
      if (hasTouch) {
        setShowVirtualKeyboard(true);
      }
    };

    checkTouchDevice();
    window.addEventListener('resize', checkTouchDevice);
    return () => window.removeEventListener('resize', checkTouchDevice);
  }, []);

  // Handle touch interactions with visual feedback
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const newInteraction = {
      id: `touch_${Date.now()}_${Math.random()}`,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };
    
    setTouchInteractions(prev => [...prev, newInteraction]);
    
    // Trigger haptic feedback for touch start
    if ('vibrate' in navigator) {
      navigator.vibrate(10); // Light haptic feedback
    }

    // Auto-focus terminal on touch
    if (terminalRef.current) {
      terminalRef.current.focus();
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Clear touch interactions after a delay for visual feedback
    setTimeout(() => {
      setTouchInteractions(prev => 
        prev.filter(interaction => Date.now() - interaction.timestamp < 300)
      );
    }, 300);
  }, []);

  // Handle gesture events
  const handleGesture = useCallback((gestureType: string, gestureData: any) => {
    switch (gestureType) {
      case 'pinch':
        // Pinch to zoom font size
        const newSize = Math.max(12, Math.min(32, fontSize * gestureData.scale));
        setFontSize(newSize);
        break;
      
      case 'double-tap':
        // Double tap to show/hide virtual keyboard
        setShowVirtualKeyboard(prev => !prev);
        break;
      
      case 'long-press':
        // Long press for context menu or text selection
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 50, 50]); // Pattern for long press
        }
        break;
    }
  }, [fontSize]);

  // Handle virtual keyboard input
  const handleVirtualKeyboardInput = useCallback((data: string) => {
    onInput(data);
    
    // Provide haptic feedback for key presses
    if ('vibrate' in navigator) {
      navigator.vibrate(5); // Very light feedback for typing
    }
  }, [onInput]);

  // Expose methods through ref
  React.useImperativeHandle(ref, () => ({
    write: (data: string) => terminalRef.current?.write(data),
    clear: () => terminalRef.current?.clear(),
    focus: () => terminalRef.current?.focus(),
    fit: () => terminalRef.current?.fit(),
    getSize: () => terminalRef.current?.getSize() || { cols: 80, rows: 24 },
    enableTouchMode: (enabled: boolean) => setShowVirtualKeyboard(enabled),
    setFontSize: (size: number) => setFontSize(Math.max(12, Math.min(32, size))),
    triggerHapticFeedback: (type: 'light' | 'medium' | 'heavy') => {
      if ('vibrate' in navigator) {
        const patterns = {
          light: 10,
          medium: 25,
          heavy: 50
        };
        navigator.vibrate(patterns[type]);
      }
    }
  }), []);

  return (
    <div 
      ref={containerRef}
      className={cn(
        'relative touch-optimized-terminal',
        'select-none', // Prevent text selection on mobile
        isTouchDevice && 'touch-device',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual feedback for touch interactions */}
      <VisualFeedbackSystem interactions={touchInteractions} />
      
      {/* Gesture handler overlay */}
      <TouchGestureHandler
        onGesture={handleGesture}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ pointerEvents: isTouchDevice ? 'auto' : 'none' }}
      />
      
      {/* Responsive font system wrapper */}
      <ResponsiveFontSystem fontSize={fontSize}>
        <TerminalXterm
          ref={terminalRef}
          onInput={onInput}
          onResize={onResize}
          className={cn(
            'terminal-container',
            // Ensure minimum touch target size (44px)
            'min-h-[44px]',
            // Add padding for better touch interaction
            isTouchDevice && 'p-2'
          )}
        />
      </ResponsiveFontSystem>
      
      {/* Smart virtual keyboard for touch devices */}
      {isTouchDevice && showVirtualKeyboard && (
        <SmartVirtualKeyboard
          onInput={handleVirtualKeyboardInput}
          onClose={() => setShowVirtualKeyboard(false)}
          className="mt-4"
          terminalState={terminalState}
          currentDirectory={currentDirectory}
          commandHistory={commandHistory}
          autoHide={true}
          predictiveText={true}
        />
      )}
      
      {/* Haptic feedback component */}
      <HapticFeedback />
      

    </div>
  );
});

TouchOptimizedTerminalUI.displayName = 'TouchOptimizedTerminalUI';