import { useEffect, useState, useCallback, useRef } from 'react';

export interface MobileLayoutState {
  orientation: 'portrait' | 'landscape';
  screenSize: { width: number; height: number };
  safeArea: { top: number; bottom: number; left: number; right: number };
  keyboardVisible: boolean;
  keyboardHeight: number;
  compactMode: boolean;
  isFullscreen: boolean;
  isMobile: boolean;
  isSmallScreen: boolean;
}

export interface MobileLayoutActions {
  adjustForKeyboard: (height: number) => void;
  optimizeForOrientation: (orientation: 'portrait' | 'landscape') => void;
  setCompactMode: (enabled: boolean) => void;
  toggleFullscreen: () => Promise<void>;
  getOptimalTerminalSize: () => { cols: number; rows: number };
  refreshLayout: () => void;
}

export interface UseMobileLayoutOptions {
  enableKeyboardDetection?: boolean;
  enableOrientationOptimization?: boolean;
  autoCompactMode?: boolean;
  debounceMs?: number;
}

export const useMobileLayout = (options: UseMobileLayoutOptions = {}): [MobileLayoutState, MobileLayoutActions] => {
  const {
    enableKeyboardDetection = true,
    enableOrientationOptimization = true,
    autoCompactMode = true,
    debounceMs = 100
  } = options;

  const [layoutState, setLayoutState] = useState<MobileLayoutState>(() => {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;
    
    return {
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
      screenSize: { width: window.innerWidth, height: window.innerHeight },
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      keyboardVisible: false,
      keyboardHeight: 0,
      compactMode: autoCompactMode && (isSmallScreen || (isMobile && window.innerWidth > window.innerHeight)),
      isFullscreen: !!document.fullscreenElement,
      isMobile,
      isSmallScreen
    };
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const initialViewportHeightRef = useRef<number>(window.innerHeight);

  // Debounced layout update function
  const updateLayout = useCallback((updater: (prev: MobileLayoutState) => MobileLayoutState) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setLayoutState(updater);
    }, debounceMs);
  }, [debounceMs]);

  // Get safe area insets from CSS environment variables
  const getSafeAreaInsets = useCallback((): { top: number; bottom: number; left: number; right: number } => {
    const computedStyle = getComputedStyle(document.documentElement);
    
    return {
      top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top').replace('px', '')) || 0,
      bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom').replace('px', '')) || 0,
      left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left').replace('px', '')) || 0,
      right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right').replace('px', '')) || 0
    };
  }, []);

  // Handle screen resize and orientation changes
  const handleResize = useCallback(() => {
    updateLayout(prev => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      const newOrientation = newWidth > newHeight ? 'landscape' : 'portrait';
      const isSmallScreen = newWidth < 768;
      
      return {
        ...prev,
        orientation: newOrientation,
        screenSize: { width: newWidth, height: newHeight },
        safeArea: getSafeAreaInsets(),
        isSmallScreen,
        compactMode: autoCompactMode ? 
          (isSmallScreen || (prev.isMobile && newOrientation === 'landscape')) : 
          prev.compactMode
      };
    });
  }, [updateLayout, getSafeAreaInsets, autoCompactMode]);

  // Detect virtual keyboard visibility
  const detectKeyboard = useCallback(() => {
    if (!enableKeyboardDetection) return;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeightRef.current - currentHeight;
      const keyboardThreshold = 150;
      
      updateLayout(prev => ({
        ...prev,
        keyboardVisible: heightDifference > keyboardThreshold,
        keyboardHeight: heightDifference > keyboardThreshold ? heightDifference : 0
      }));
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
    } else {
      // Fallback for browsers without visualViewport
      const handleWindowResize = () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeightRef.current - currentHeight;
        const keyboardThreshold = 150;
        
        updateLayout(prev => ({
          ...prev,
          keyboardVisible: heightDifference > keyboardThreshold,
          keyboardHeight: heightDifference > keyboardThreshold ? heightDifference : 0
        }));
      };

      window.addEventListener('resize', handleWindowResize);
      return () => window.removeEventListener('resize', handleWindowResize);
    }
  }, [enableKeyboardDetection, updateLayout]);

  // Handle fullscreen changes
  const handleFullscreenChange = useCallback(() => {
    setLayoutState(prev => ({
      ...prev,
      isFullscreen: !!document.fullscreenElement
    }));
  }, []);

  // Initialize event listeners
  useEffect(() => {
    initialViewportHeightRef.current = window.innerHeight;
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    const keyboardCleanup = detectKeyboard();
    
    // Handle orientation change with delay for animation
    const handleOrientationChange = () => {
      setTimeout(handleResize, 300);
    };
    
    if (enableOrientationOptimization) {
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      
      if (enableOrientationOptimization) {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
      
      keyboardCleanup?.();
      
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [handleResize, handleFullscreenChange, detectKeyboard, enableOrientationOptimization]);

  // Action functions
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
      compactMode: autoCompactMode ? 
        (prev.isSmallScreen || (prev.isMobile && orientation === 'landscape')) : 
        prev.compactMode
    }));
  }, [autoCompactMode]);

  const setCompactMode = useCallback((enabled: boolean) => {
    setLayoutState(prev => ({
      ...prev,
      compactMode: enabled
    }));
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen operation failed:', error);
      throw error;
    }
  }, []);

  const getOptimalTerminalSize = useCallback((): { cols: number; rows: number } => {
    const { screenSize, safeArea, keyboardHeight, compactMode, orientation } = layoutState;
    
    // Character dimensions (approximate monospace font metrics)
    const charWidth = 8.4;
    const charHeight = 17;
    
    // Calculate available space
    const availableWidth = screenSize.width - safeArea.left - safeArea.right;
    const availableHeight = screenSize.height - safeArea.top - safeArea.bottom - keyboardHeight;
    
    // UI overhead calculations
    const headerHeight = compactMode ? 40 : 60;
    const footerHeight = compactMode ? 0 : 40;
    const padding = compactMode ? 16 : 32;
    
    const terminalWidth = availableWidth - padding;
    const terminalHeight = availableHeight - headerHeight - footerHeight - padding;
    
    // Calculate dimensions
    const cols = Math.floor(terminalWidth / charWidth);
    const rows = Math.floor(terminalHeight / charHeight);
    
    // Apply constraints
    const minCols = orientation === 'landscape' ? 60 : 40;
    const minRows = orientation === 'landscape' ? 15 : 20;
    const maxCols = 200;
    const maxRows = 50;
    
    return {
      cols: Math.max(minCols, Math.min(maxCols, cols)),
      rows: Math.max(minRows, Math.min(maxRows, rows))
    };
  }, [layoutState]);

  const refreshLayout = useCallback(() => {
    handleResize();
  }, [handleResize]);

  const actions: MobileLayoutActions = {
    adjustForKeyboard,
    optimizeForOrientation,
    setCompactMode,
    toggleFullscreen,
    getOptimalTerminalSize,
    refreshLayout
  };

  return [layoutState, actions];
};