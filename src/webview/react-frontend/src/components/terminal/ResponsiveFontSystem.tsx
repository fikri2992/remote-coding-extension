import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

export interface ResponsiveFontSystemProps {
  fontSize?: number;
  children: React.ReactNode;
  className?: string;
  minFontSize?: number;
  maxFontSize?: number;
  adaptToScreen?: boolean;
  adaptToUserPreferences?: boolean;
}

interface ScreenSize {
  width: number;
  height: number;
  isPortrait: boolean;
  devicePixelRatio: number;
}

interface UserPreferences {
  preferredFontSize: number;
  highContrast: boolean;
  reducedMotion: boolean;
}

export const ResponsiveFontSystem: React.FC<ResponsiveFontSystemProps> = ({
  fontSize = 14,
  children,
  className,
  minFontSize = 12,
  maxFontSize = 32,
  adaptToScreen = true,
  adaptToUserPreferences = true
}) => {
  const [screenSize, setScreenSize] = useState<ScreenSize>({
    width: window.innerWidth,
    height: window.innerHeight,
    isPortrait: window.innerHeight > window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1
  });

  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    preferredFontSize: fontSize,
    highContrast: false,
    reducedMotion: false
  });

  const [adaptedFontSize, setAdaptedFontSize] = useState(fontSize);

  // Update screen size on resize
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
        isPortrait: window.innerHeight > window.innerWidth,
        devicePixelRatio: window.devicePixelRatio || 1
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Detect user preferences
  useEffect(() => {
    if (!adaptToUserPreferences) return;

    const detectPreferences = () => {
      // Check for system font size preferences
      const testElement = document.createElement('div');
      testElement.style.fontSize = '1rem';
      testElement.style.position = 'absolute';
      testElement.style.visibility = 'hidden';
      document.body.appendChild(testElement);
      
      const computedSize = window.getComputedStyle(testElement).fontSize;
      const systemFontSize = parseFloat(computedSize);
      
      document.body.removeChild(testElement);

      // Check for high contrast preference
      const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
      
      // Check for reduced motion preference
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      setUserPreferences({
        preferredFontSize: systemFontSize,
        highContrast,
        reducedMotion
      });
    };

    detectPreferences();

    // Listen for preference changes
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setUserPreferences(prev => ({ ...prev, highContrast: e.matches }));
    };
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setUserPreferences(prev => ({ ...prev, reducedMotion: e.matches }));
    };

    contrastQuery.addEventListener('change', handleContrastChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      contrastQuery.removeEventListener('change', handleContrastChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [adaptToUserPreferences]);

  // Calculate adapted font size based on screen and preferences
  const calculateAdaptedFontSize = useCallback(() => {
    let newSize = fontSize;

    if (adaptToScreen) {
      // Adapt to screen size
      const baseWidth = 375; // iPhone SE width as baseline
      const scaleFactor = Math.min(screenSize.width / baseWidth, 1.5);
      
      // Adjust for portrait vs landscape
      if (screenSize.isPortrait && screenSize.width < 768) {
        // Mobile portrait: slightly larger for better readability
        newSize = fontSize * Math.max(scaleFactor, 1.1);
      } else if (!screenSize.isPortrait && screenSize.width < 768) {
        // Mobile landscape: slightly smaller to fit more content
        newSize = fontSize * Math.min(scaleFactor, 0.9);
      } else {
        // Desktop: use base size with minor scaling
        newSize = fontSize * scaleFactor;
      }

      // Adjust for high DPI screens
      if (screenSize.devicePixelRatio > 2) {
        newSize *= 1.1;
      }
    }

    if (adaptToUserPreferences) {
      // Apply user font size preference
      const userScaleFactor = userPreferences.preferredFontSize / 16; // 16px is typical browser default
      newSize *= userScaleFactor;

      // Increase size for high contrast users (accessibility)
      if (userPreferences.highContrast) {
        newSize *= 1.2;
      }
    }

    // Clamp to min/max bounds
    return Math.max(minFontSize, Math.min(maxFontSize, newSize));
  }, [
    fontSize,
    screenSize,
    userPreferences,
    adaptToScreen,
    adaptToUserPreferences,
    minFontSize,
    maxFontSize
  ]);

  // Update adapted font size when dependencies change
  useEffect(() => {
    const newSize = calculateAdaptedFontSize();
    setAdaptedFontSize(newSize);
  }, [calculateAdaptedFontSize]);

  // Generate CSS custom properties for the font system
  const fontSystemStyles = {
    '--terminal-font-size': `${adaptedFontSize}px`,
    '--terminal-line-height': `${adaptedFontSize * 1.4}px`,
    '--terminal-char-width': `${adaptedFontSize * 0.6}px`, // Monospace character width approximation
    '--terminal-font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
    '--terminal-font-weight': userPreferences.highContrast ? '600' : '400',
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        'responsive-font-system',
        userPreferences.highContrast && 'high-contrast',
        userPreferences.reducedMotion && 'reduced-motion',
        className
      )}
      style={fontSystemStyles}
    >
      {children}
      

    </div>
  );
};

// Hook for accessing font system values
export const useResponsiveFontSystem = () => {
  const [fontSize, setFontSize] = useState(14);
  
  useEffect(() => {
    const updateFontSize = () => {
      const rootElement = document.documentElement;
      const computedSize = getComputedStyle(rootElement).getPropertyValue('--terminal-font-size');
      if (computedSize) {
        setFontSize(parseFloat(computedSize));
      }
    };

    updateFontSize();
    
    // Listen for font size changes
    const observer = new MutationObserver(updateFontSize);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });

    return () => observer.disconnect();
  }, []);

  return {
    fontSize,
    lineHeight: fontSize * 1.4,
    charWidth: fontSize * 0.6,
  };
};