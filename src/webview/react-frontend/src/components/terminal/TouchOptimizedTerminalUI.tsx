import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TerminalXterm, TerminalXtermHandle } from './TerminalXterm';
import { GestureHandler, useGestureHandler } from './GestureHandler';
import { SmartVirtualKeyboard } from './SmartVirtualKeyboard';
import { HapticFeedback } from './HapticFeedback';
import { ResponsiveFontSystem } from './ResponsiveFontSystem';
import { VisualFeedbackSystem } from './VisualFeedbackSystem';
import { GestureFeedback } from './GestureFeedback';
import { MobileLayoutProvider, useMobileLayout } from './MobileLayoutManager';
import { KeyboardAvoidanceSystem } from './KeyboardAvoidanceSystem';
import { SafeAreaHandler } from './SafeAreaHandler';
import { CompactModeProvider, useCompactMode } from './CompactModeManager';
import { TouchGesture, GestureSettings } from '../../types/gesture';
import { cn } from '../../lib/utils';
import './mobile-layout.css';
import './compact-mode.css';

export interface TouchOptimizedTerminalUIProps {
  onInput: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  className?: string;
  terminalState?: 'idle' | 'active' | 'input' | 'running';
  currentDirectory?: string;
  commandHistory?: string[];
  gestureSettings?: Partial<GestureSettings>;
  onTextSelection?: (text: string) => void;
  onGesture?: (gesture: TouchGesture) => void;
  enableMobileLayout?: boolean;
  enableKeyboardAvoidance?: boolean;
  enableSafeArea?: boolean;
  enableCompactMode?: boolean;
}

export interface TouchOptimizedTerminalUIHandle extends TerminalXtermHandle {
  enableTouchMode: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
  triggerHapticFeedback: (type: 'light' | 'medium' | 'heavy') => void;
  updateGestureSettings: (settings: Partial<GestureSettings>) => void;
  getGestureSettings: () => GestureSettings;
  toggleCompactMode: () => void;
  refreshLayout: () => void;
  getOptimalSize: () => { cols: number; rows: number };
}

// Internal component that uses the layout managers
const TouchOptimizedTerminalUIInternal = React.forwardRef<
  TouchOptimizedTerminalUIHandle,
  TouchOptimizedTerminalUIProps & { 
    enableMobileLayout: boolean;
    enableKeyboardAvoidance: boolean;
    enableSafeArea: boolean;
    enableCompactMode: boolean;
  }
>(({ 
  onInput, 
  onResize, 
  className, 
  terminalState = 'idle', 
  currentDirectory = '~', 
  commandHistory = [],
  gestureSettings,
  onTextSelection,
  onGesture,
  enableMobileLayout,
  enableKeyboardAvoidance,
  enableSafeArea,
  enableCompactMode
}, ref) => {
  const terminalRef = useRef<TerminalXtermHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [touchInteractions, setTouchInteractions] = useState<Array<{ id: string; x: number; y: number; timestamp: number }>>([]);
  const [lastGesture, setLastGesture] = useState<TouchGesture | null>(null);
  
  // Initialize gesture handler
  const { gestureHandler, settings } = useGestureHandler(gestureSettings);
  
  // Use layout managers if enabled
  const mobileLayout = enableMobileLayout ? useMobileLayout() : null;
  const compactMode = enableCompactMode ? useCompactMode() : null;

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

  // Handle enhanced gesture events
  const handleGesture = useCallback((gesture: TouchGesture) => {
    setLastGesture(gesture);
    
    // Call external gesture handler if provided
    onGesture?.(gesture);
    
    switch (gesture.type) {
      case 'pinch':
        // Pinch to zoom font size
        if (gesture.data.scale) {
          const newSize = Math.max(12, Math.min(32, fontSize * gesture.data.scale));
          setFontSize(newSize);
        }
        break;
      
      case 'double-tap':
        // Double tap to show/hide virtual keyboard or select word
        if (isTouchDevice) {
          setShowVirtualKeyboard(prev => !prev);
        }
        // Handle text selection for double-tap (word selection)
        handleTextSelectionGesture(gesture, 'word');
        break;
      
      case 'triple-tap':
        // Triple tap to select line
        handleTextSelectionGesture(gesture, 'line');
        break;
      
      case 'long-press':
        // Long press for context menu or text selection mode
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 50, 50]); // Pattern for long press
        }
        break;
      
      case 'swipe':
        // Handle swipe gestures for navigation
        handleSwipeGesture(gesture);
        break;
      
      case 'pan':
        // Handle pan gestures for scrolling
        handlePanGesture(gesture);
        break;
    }
  }, [fontSize, isTouchDevice, onGesture]);

  // Handle text selection gestures
  const handleTextSelectionGesture = useCallback((gesture: TouchGesture, selectionType: 'word' | 'line') => {
    if (!gesture.data.center) return;
    
    // Simulate text selection based on gesture position
    // In a real implementation, this would interact with the terminal's text buffer
    const mockText = selectionType === 'word' ? 'selected_word' : 'selected_line_content';
    onTextSelection?.(mockText);
    
    // Provide haptic feedback for text selection
    if ('vibrate' in navigator) {
      const pattern = selectionType === 'word' ? [10, 20, 10] : [20, 30, 20];
      navigator.vibrate(pattern);
    }
  }, [onTextSelection]);

  // Handle swipe gestures
  const handleSwipeGesture = useCallback((gesture: TouchGesture) => {
    if (!gesture.data.direction) return;
    
    // Handle different swipe directions
    switch (gesture.data.direction) {
      case 'left':
        // Swipe left could switch to next session/tab
        break;
      case 'right':
        // Swipe right could switch to previous session/tab
        break;
      case 'up':
        // Swipe up could show command history
        break;
      case 'down':
        // Swipe down could hide virtual keyboard
        if (showVirtualKeyboard) {
          setShowVirtualKeyboard(false);
        }
        break;
    }
  }, [showVirtualKeyboard]);

  // Handle pan gestures
  const handlePanGesture = useCallback((_gesture: TouchGesture) => {
    // Pan gestures could be used for scrolling the terminal
    // This would integrate with the terminal's scroll functionality
  }, []);

  // Handle text selection callback from gesture handler
  const handleTextSelectionCallback = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    // This would be used to create actual text selection in the terminal
    console.log('Text selection area:', { startX, startY, endX, endY });
  }, []);

  // Handle virtual keyboard input
  const handleVirtualKeyboardInput = useCallback((data: string) => {
    onInput(data);
    
    // Provide haptic feedback for key presses
    if ('vibrate' in navigator) {
      navigator.vibrate(5); // Very light feedback for typing
    }
  }, [onInput]);

  // Handle layout-aware terminal resizing
  const handleLayoutResize = useCallback(() => {
    if (mobileLayout && onResize) {
      const optimalSize = mobileLayout.getOptimalTerminalSize();
      onResize(optimalSize.cols, optimalSize.rows);
    }
  }, [mobileLayout, onResize]);

  // Listen for layout changes
  useEffect(() => {
    if (mobileLayout) {
      handleLayoutResize();
    }
  }, [mobileLayout?.layoutState, handleLayoutResize]);

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
    },
    updateGestureSettings: (newSettings: Partial<GestureSettings>) => {
      gestureHandler.updateGestureSettings(newSettings);
    },
    getGestureSettings: () => gestureHandler.getGestureSettings(),
    toggleCompactMode: () => compactMode?.toggleCompactMode(),
    refreshLayout: () => mobileLayout?.refreshLayout?.(),
    getOptimalSize: () => mobileLayout?.getOptimalTerminalSize() || { cols: 80, rows: 24 }
  }), [gestureHandler, compactMode, mobileLayout]);

  const terminalContent = (
    <div 
      ref={containerRef}
      className={cn(
        'relative touch-optimized-terminal',
        'select-none', // Prevent text selection on mobile
        isTouchDevice && 'touch-device',
        mobileLayout?.getLayoutClasses(),
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual feedback for touch interactions */}
      <VisualFeedbackSystem interactions={touchInteractions} />
      
      {/* Enhanced gesture handler overlay */}
      <GestureHandler
        onGesture={handleGesture}
        onTextSelection={handleTextSelectionCallback}
        gestureSettings={settings}
        enableTouchGestures={isTouchDevice}
        enableMouseGestures={!isTouchDevice}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ pointerEvents: 'auto' }}
      />
      
      {/* Responsive font system wrapper */}
      <ResponsiveFontSystem fontSize={fontSize}>
        <TerminalXterm
          ref={terminalRef}
          onInput={onInput}
          onResize={handleLayoutResize}
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
      
      {/* Enhanced gesture feedback system */}
      <GestureFeedback
        gesture={lastGesture || undefined}
        hapticEnabled={settings.hapticFeedback}
        visualEnabled={settings.visualFeedback}
      />
      
      {/* Haptic feedback component */}
      <HapticFeedback />
    </div>
  );

  // Wrap with keyboard avoidance if enabled
  const keyboardAwareContent = enableKeyboardAvoidance ? (
    <KeyboardAvoidanceSystem
      onKeyboardToggle={(_visible, height) => {
        mobileLayout?.adjustForKeyboard(height);
      }}
      scrollToBottom={true}
      maintainAspectRatio={false}
    >
      {terminalContent}
    </KeyboardAvoidanceSystem>
  ) : terminalContent;

  // Wrap with safe area handler if enabled
  const safeAreaContent = enableSafeArea ? (
    <SafeAreaHandler
      enablePadding={true}
      respectNotch={true}
      respectHomeIndicator={true}
      onInsetsChange={(insets) => {
        // Handle safe area changes if needed
        console.log('Safe area insets changed:', insets);
      }}
    >
      {keyboardAwareContent}
    </SafeAreaHandler>
  ) : keyboardAwareContent;

  return safeAreaContent;
});

TouchOptimizedTerminalUIInternal.displayName = 'TouchOptimizedTerminalUIInternal';

// Main component with layout providers
export const TouchOptimizedTerminalUI = React.forwardRef<
  TouchOptimizedTerminalUIHandle,
  TouchOptimizedTerminalUIProps
>(({ 
  enableMobileLayout = true,
  enableKeyboardAvoidance = true,
  enableSafeArea = true,
  enableCompactMode = true,
  ...props
}, ref) => {
  // Wrap with providers if enabled
  let content = (
    <TouchOptimizedTerminalUIInternal
      {...props}
      enableMobileLayout={enableMobileLayout}
      enableKeyboardAvoidance={enableKeyboardAvoidance}
      enableSafeArea={enableSafeArea}
      enableCompactMode={enableCompactMode}
      ref={ref}
    />
  );

  if (enableCompactMode) {
    content = (
      <CompactModeProvider>
        {content}
      </CompactModeProvider>
    );
  }

  if (enableMobileLayout) {
    content = (
      <MobileLayoutProvider>
        {content}
      </MobileLayoutProvider>
    );
  }

  return content;
});

TouchOptimizedTerminalUI.displayName = 'TouchOptimizedTerminalUI';