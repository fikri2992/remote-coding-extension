import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';

export interface CompactModeSettings {
  enabled: boolean;
  autoEnable: boolean;
  hideHeader: boolean;
  hideFooter: boolean;
  hideSidebar: boolean;
  minimizeUI: boolean;
  maxTerminalSpace: boolean;
  compactKeyboard: boolean;
  reducedPadding: boolean;
  smallerFonts: boolean;
}

export interface CompactModeContextType {
  settings: CompactModeSettings;
  isCompactMode: boolean;
  toggleCompactMode: () => void;
  updateSettings: (newSettings: Partial<CompactModeSettings>) => void;
  getCompactClasses: () => string;
  shouldAutoEnable: () => boolean;
}

const defaultSettings: CompactModeSettings = {
  enabled: false,
  autoEnable: true,
  hideHeader: false,
  hideFooter: true,
  hideSidebar: false,
  minimizeUI: true,
  maxTerminalSpace: true,
  compactKeyboard: true,
  reducedPadding: true,
  smallerFonts: false
};

const CompactModeContext = createContext<CompactModeContextType | null>(null);

export const useCompactMode = (): CompactModeContextType => {
  const context = useContext(CompactModeContext);
  if (!context) {
    throw new Error('useCompactMode must be used within a CompactModeProvider');
  }
  return context;
};

interface CompactModeProviderProps {
  children: React.ReactNode;
  initialSettings?: Partial<CompactModeSettings>;
  className?: string;
}

export const CompactModeProvider: React.FC<CompactModeProviderProps> = ({
  children,
  initialSettings = {},
  className
}) => {
  const [settings, setSettings] = useState<CompactModeSettings>({
    ...defaultSettings,
    ...initialSettings
  });

  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  );

  // Update screen size and orientation
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      setScreenSize({ width: newWidth, height: newHeight });
      setOrientation(newWidth > newHeight ? 'landscape' : 'portrait');
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 300); // Delay for orientation animation
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Determine if compact mode should be auto-enabled
  const shouldAutoEnable = useCallback((): boolean => {
    if (!settings.autoEnable) return false;

    const isSmallScreen = screenSize.width < 768;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isLandscapeMobile = isMobile && orientation === 'landscape';
    const isVerySmallScreen = screenSize.width < 480;

    return isSmallScreen || isLandscapeMobile || isVerySmallScreen;
  }, [settings.autoEnable, screenSize, orientation]);

  // Auto-enable compact mode based on conditions
  useEffect(() => {
    if (settings.autoEnable) {
      const shouldEnable = shouldAutoEnable();
      if (shouldEnable !== settings.enabled) {
        setSettings(prev => ({ ...prev, enabled: shouldEnable }));
      }
    }
  }, [settings.autoEnable, shouldAutoEnable, settings.enabled]);

  // Toggle compact mode
  const toggleCompactMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      enabled: !prev.enabled,
      autoEnable: false // Disable auto-enable when manually toggled
    }));
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<CompactModeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Generate CSS classes based on compact mode state
  const getCompactClasses = useCallback((): string => {
    if (!settings.enabled) return '';

    const classes = ['compact-mode'];

    if (settings.hideHeader) classes.push('compact-hide-header');
    if (settings.hideFooter) classes.push('compact-hide-footer');
    if (settings.hideSidebar) classes.push('compact-hide-sidebar');
    if (settings.minimizeUI) classes.push('compact-minimize-ui');
    if (settings.maxTerminalSpace) classes.push('compact-max-terminal');
    if (settings.compactKeyboard) classes.push('compact-keyboard');
    if (settings.reducedPadding) classes.push('compact-reduced-padding');
    if (settings.smallerFonts) classes.push('compact-smaller-fonts');

    // Add orientation-specific classes
    classes.push(`compact-${orientation}`);

    // Add screen size classes
    if (screenSize.width < 480) classes.push('compact-very-small');
    else if (screenSize.width < 768) classes.push('compact-small');

    return classes.join(' ');
  }, [settings, orientation, screenSize]);

  const contextValue: CompactModeContextType = {
    settings,
    isCompactMode: settings.enabled,
    toggleCompactMode,
    updateSettings,
    getCompactClasses,
    shouldAutoEnable
  };

  return (
    <CompactModeContext.Provider value={contextValue}>
      <div className={cn(getCompactClasses(), className)}>
        {children}
      </div>
    </CompactModeContext.Provider>
  );
};

// Compact mode toggle button component
export const CompactModeToggle: React.FC<{
  className?: string;
  showLabel?: boolean;
}> = ({ className, showLabel = false }) => {
  const { isCompactMode, toggleCompactMode } = useCompactMode();

  return (
    <button
      onClick={toggleCompactMode}
      className={cn(
        'compact-mode-toggle',
        'flex items-center justify-center',
        'min-h-[44px] min-w-[44px]', // Touch-friendly size
        'rounded-md border border-border',
        'bg-background hover:bg-muted',
        'text-foreground transition-colors',
        className
      )}
      title={isCompactMode ? 'Exit compact mode' : 'Enter compact mode'}
      aria-label={isCompactMode ? 'Exit compact mode' : 'Enter compact mode'}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isCompactMode ? (
          // Expand icon
          <>
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </>
        ) : (
          // Compress icon
          <>
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </>
        )}
      </svg>
      {showLabel && (
        <span className="ml-2 text-sm">
          {isCompactMode ? 'Expand' : 'Compact'}
        </span>
      )}
    </button>
  );
};

// Hook for using compact mode state without provider
export const useCompactModeState = (initialSettings?: Partial<CompactModeSettings>) => {
  const [settings, setSettings] = useState<CompactModeSettings>({
    ...defaultSettings,
    ...initialSettings
  });

  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldAutoEnable = useCallback((): boolean => {
    if (!settings.autoEnable) return false;

    const isSmallScreen = screenSize.width < 768;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isLandscape = screenSize.width > screenSize.height;
    const isLandscapeMobile = isMobile && isLandscape;

    return isSmallScreen || isLandscapeMobile;
  }, [settings.autoEnable, screenSize]);

  const toggleCompactMode = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      enabled: !prev.enabled,
      autoEnable: false
    }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<CompactModeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return {
    settings,
    isCompactMode: settings.enabled,
    toggleCompactMode,
    updateSettings,
    shouldAutoEnable,
    screenSize
  };
};