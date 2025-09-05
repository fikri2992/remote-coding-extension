import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface ScreenDimensions {
  width: number;
  height: number;
}

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface LayoutState {
  orientation: 'portrait' | 'landscape';
  screenSize: ScreenDimensions;
  safeArea: SafeArea;
  keyboardVisible: boolean;
  keyboardHeight: number;
  compactMode: boolean;
  isFullscreen: boolean;
  devicePixelRatio: number;
}

export interface MobileLayoutContextType {
  layoutState: LayoutState;
  adjustForKeyboard: (height: number) => void;
  optimizeForOrientation: (orientation: 'portrait' | 'landscape') => void;
  setCompactMode: (enabled: boolean) => void;
  toggleFullscreen: () => void;
  getOptimalTerminalSize: () => { cols: number; rows: number };
  getLayoutClasses: () => string;
  isSmallScreen: () => boolean;
  isMobileDevice: () => boolean;
  refreshLayout: () => void;
}

const MobileLayoutContext = createContext<MobileLayoutContextType | null>(null);

export const useMobileLayout = (): MobileLayoutContextType => {
  const context = useContext(MobileLayoutContext);
  if (!context) {
    throw new Error('useMobileLayout must be used within a MobileLayoutProvider');
  }
  return context;
};

interface MobileLayoutProviderProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileLayoutProvider: React.FC<MobileLayoutProviderProps> = ({ 
  children, 
  className 
}) => {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    orientation: 'portrait',
    screenSize: { width: window.innerWidth, height: window.innerHeight },
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    keyboardVisible: false,
    keyboardHeight: 0,
    compactMode: false,
    isFullscreen: false,
    devicePixelRatio: window.devicePixelRatio || 1
  });

  const resizeTimeoutRef = useRef<NodeJS.Timeout>();
  const orientationTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect safe area insets from CSS environment variables
  const updateSafeArea = useCallback(() => {
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-top').replace('px', '')) || 0;
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-bottom').replace('px', '')) || 0;
    const safeAreaLeft = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-left').replace('px', '')) || 0;
    const safeAreaRight = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-right').replace('px', '')) || 0;

    setLayoutState(prev => ({
      ...prev,
      safeArea: {
        top: safeAreaTop,
        bottom: safeAreaBottom,
        left: safeAreaLeft,
        right: safeAreaRight
      }
    }));
  }, []);

  // Handle screen size and orientation changes
  const handleResize = useCallback(() => {
    // Debounce resize events to avoid excessive updates
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      const newOrientation = newWidth > newHeight ? 'landscape' : 'portrait';

      setLayoutState(prev => ({
        ...prev,
        screenSize: { width: newWidth, height: newHeight },
        orientation: newOrientation,
        devicePixelRatio: window.devicePixelRatio || 1
      }));

      updateSafeArea();
    }, 100);
  }, [updateSafeArea]);

  // Handle orientation change with optimization delay
  const handleOrientationChange = useCallback(() => {
    // Clear any existing timeout
    if (orientationTimeoutRef.current) {
      clearTimeout(orientationTimeoutRef.current);
    }

    // Delay orientation handling to allow for screen rotation animation
    orientationTimeoutRef.current = setTimeout(() => {
      handleResize();
      
      // Additional optimization for orientation change
      const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      optimizeForOrientation(newOrientation);
    }, 300);
  }, [handleResize]);

  // Detect virtual keyboard visibility (mobile browsers)
  const detectKeyboard = useCallback(() => {
    const initialViewportHeight = window.innerHeight;
    
    const handleViewportChange = () => {
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentViewportHeight;
      
      // Threshold for keyboard detection (typically > 150px change indicates keyboard)
      const keyboardThreshold = 150;
      const isKeyboardVisible = heightDifference > keyboardThreshold;
      
      setLayoutState(prev => ({
        ...prev,
        keyboardVisible: isKeyboardVisible,
        keyboardHeight: isKeyboardVisible ? heightDifference : 0
      }));
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
    } else {
      // Fallback for browsers without visualViewport support
      window.addEventListener('resize', handleViewportChange);
      return () => window.removeEventListener('resize', handleViewportChange);
    }
  }, []);

  // Initialize layout detection
  useEffect(() => {
    handleResize();
    updateSafeArea();
    
    const keyboardCleanup = detectKeyboard();
    
    // Set up event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      setLayoutState(prev => ({
        ...prev,
        isFullscreen: !!document.fullscreenElement
      }));
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      keyboardCleanup?.();
      
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (orientationTimeoutRef.current) {
        clearTimeout(orientationTimeoutRef.current);
      }
    };
  }, [handleResize, handleOrientationChange, detectKeyboard, updateSafeArea]);

  // Layout management functions
  const adjustForKeyboard = useCallback((height: number) => {
    setLayoutState(prev => ({
      ...prev,
      keyboardVisible: height > 0,
      keyboardHeight: height
    }));
  }, []);

  const optimizeForOrientation = useCallback((orientation: 'portrait' | 'landscape') => {
    setLayoutState(prev => ({
      ...prev,
      orientation,
      // Auto-enable compact mode in landscape on small screens
      compactMode: prev.compactMode || (orientation === 'landscape' && prev.screenSize.width < 768)
    }));
  }, []);

  const setCompactMode = useCallback((enabled: boolean) => {
    setLayoutState(prev => ({
      ...prev,
      compactMode: enabled
    }));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen not supported or failed:', error);
    }
  }, []);

  // Calculate optimal terminal size based on current layout
  const getOptimalTerminalSize = useCallback((): { cols: number; rows: number } => {
    const { screenSize, safeArea, keyboardHeight, compactMode, orientation } = layoutState;
    
    // Base character dimensions (approximate)
    const charWidth = 8.4; // Average character width in pixels
    const charHeight = 17; // Average character height in pixels
    
    // Calculate available space
    const availableWidth = screenSize.width - safeArea.left - safeArea.right;
    const availableHeight = screenSize.height - safeArea.top - safeArea.bottom - keyboardHeight;
    
    // Adjust for UI elements (header, footer, padding)
    const uiOverhead = compactMode ? 60 : 120; // Reduced overhead in compact mode
    const terminalHeight = Math.max(200, availableHeight - uiOverhead);
    
    // Calculate terminal dimensions
    const cols = Math.floor((availableWidth - 32) / charWidth); // 32px for padding
    const rows = Math.floor(terminalHeight / charHeight);
    
    // Apply constraints based on orientation and device type
    const minCols = orientation === 'landscape' ? 60 : 40;
    const minRows = orientation === 'landscape' ? 15 : 20;
    const maxCols = 200;
    const maxRows = 50;
    
    return {
      cols: Math.max(minCols, Math.min(maxCols, cols)),
      rows: Math.max(minRows, Math.min(maxRows, rows))
    };
  }, [layoutState]);

  // Generate layout-specific CSS classes
  const getLayoutClasses = useCallback((): string => {
    const { orientation, compactMode, keyboardVisible, isFullscreen } = layoutState;
    
    return cn(
      'mobile-layout-container',
      `orientation-${orientation}`,
      compactMode && 'compact-mode',
      keyboardVisible && 'keyboard-visible',
      isFullscreen && 'fullscreen-mode',
      isSmallScreen() && 'small-screen',
      isMobileDevice() && 'mobile-device'
    );
  }, [layoutState]);

  // Utility functions
  const isSmallScreen = useCallback((): boolean => {
    return layoutState.screenSize.width < 768;
  }, [layoutState.screenSize.width]);

  const isMobileDevice = useCallback((): boolean => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const refreshLayout = useCallback(() => {
    handleResize();
  }, [handleResize]);

  const contextValue: MobileLayoutContextType = {
    layoutState,
    adjustForKeyboard,
    optimizeForOrientation,
    setCompactMode,
    toggleFullscreen,
    getOptimalTerminalSize,
    getLayoutClasses,
    isSmallScreen,
    isMobileDevice,
    refreshLayout
  };

  return (
    <MobileLayoutContext.Provider value={contextValue}>
      <div 
        className={cn(getLayoutClasses(), className)}
        style={{
          paddingTop: `${layoutState.safeArea.top}px`,
          paddingBottom: `${layoutState.safeArea.bottom}px`,
          paddingLeft: `${layoutState.safeArea.left}px`,
          paddingRight: `${layoutState.safeArea.right}px`,
          '--keyboard-height': `${layoutState.keyboardHeight}px`,
          '--safe-area-top': `${layoutState.safeArea.top}px`,
          '--safe-area-bottom': `${layoutState.safeArea.bottom}px`,
          '--safe-area-left': `${layoutState.safeArea.left}px`,
          '--safe-area-right': `${layoutState.safeArea.right}px`
        } as React.CSSProperties}
      >
        {children}
      </div>
    </MobileLayoutContext.Provider>
  );
};