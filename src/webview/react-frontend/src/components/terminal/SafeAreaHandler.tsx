import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SafeAreaHandlerProps {
  children: React.ReactNode;
  className?: string;
  enablePadding?: boolean;
  enableMargin?: boolean;
  respectNotch?: boolean;
  respectHomeIndicator?: boolean;
  minPadding?: number;
  maxPadding?: number;
  onInsetsChange?: (insets: SafeAreaInsets) => void;
}

export const SafeAreaHandler: React.FC<SafeAreaHandlerProps> = ({
  children,
  className,
  enablePadding = true,
  enableMargin = false,
  respectNotch = true,
  respectHomeIndicator = true,
  minPadding = 0,
  maxPadding = 50,
  onInsetsChange
}) => {
  const [safeAreaInsets, setSafeAreaInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  // Get safe area insets from CSS environment variables
  const getSafeAreaInsets = useCallback((): SafeAreaInsets => {
    const computedStyle = getComputedStyle(document.documentElement);
    
    const parseInset = (value: string): number => {
      const parsed = parseInt(value.replace('px', '')) || 0;
      return Math.max(minPadding, Math.min(maxPadding, parsed));
    };

    const top = respectNotch ? 
      parseInset(computedStyle.getPropertyValue('--safe-area-inset-top') || 
                computedStyle.getPropertyValue('env(safe-area-inset-top)')) : 0;
    
    const bottom = respectHomeIndicator ? 
      parseInset(computedStyle.getPropertyValue('--safe-area-inset-bottom') || 
                computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) : 0;
    
    const left = parseInset(computedStyle.getPropertyValue('--safe-area-inset-left') || 
                           computedStyle.getPropertyValue('env(safe-area-inset-left)'));
    
    const right = parseInset(computedStyle.getPropertyValue('--safe-area-inset-right') || 
                            computedStyle.getPropertyValue('env(safe-area-inset-right)'));

    return { top, bottom, left, right };
  }, [respectNotch, respectHomeIndicator, minPadding, maxPadding]);

  // Update safe area insets
  const updateSafeAreaInsets = useCallback(() => {
    const newInsets = getSafeAreaInsets();
    setSafeAreaInsets(newInsets);
    onInsetsChange?.(newInsets);
  }, [getSafeAreaInsets, onInsetsChange]);

  // Set up CSS custom properties for safe area
  const setupSafeAreaCSS = useCallback(() => {
    const style = document.documentElement.style;
    
    // Set CSS custom properties if they don't exist
    if (!style.getPropertyValue('--safe-area-inset-top')) {
      style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
    }
    if (!style.getPropertyValue('--safe-area-inset-bottom')) {
      style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
    }
    if (!style.getPropertyValue('--safe-area-inset-left')) {
      style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
    }
    if (!style.getPropertyValue('--safe-area-inset-right')) {
      style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
    }
  }, []);

  // Initialize safe area handling
  useEffect(() => {
    setupSafeAreaCSS();
    updateSafeAreaInsets();

    // Listen for viewport changes that might affect safe areas
    const handleViewportChange = () => {
      updateSafeAreaInsets();
    };

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Delay to allow for orientation animation
      setTimeout(updateSafeAreaInsets, 300);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Use ResizeObserver if available for more precise detection
    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(handleViewportChange);
      resizeObserver.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      resizeObserver?.disconnect();
    };
  }, [setupSafeAreaCSS, updateSafeAreaInsets]);

  // Generate container styles
  const getContainerStyles = useCallback((): React.CSSProperties => {
    const { top, bottom, left, right } = safeAreaInsets;
    
    const styles: React.CSSProperties = {
      ['--safe-area-top' as any]: `${top}px`,
      ['--safe-area-bottom' as any]: `${bottom}px`,
      ['--safe-area-left' as any]: `${left}px`,
      ['--safe-area-right' as any]: `${right}px`
    };

    if (enablePadding) {
      styles.paddingTop = `${top}px`;
      styles.paddingBottom = `${bottom}px`;
      styles.paddingLeft = `${left}px`;
      styles.paddingRight = `${right}px`;
    }

    if (enableMargin) {
      styles.marginTop = `${top}px`;
      styles.marginBottom = `${bottom}px`;
      styles.marginLeft = `${left}px`;
      styles.marginRight = `${right}px`;
    }

    return styles;
  }, [safeAreaInsets, enablePadding, enableMargin]);

  return (
    <div
      className={cn(
        'safe-area-container',
        'relative w-full h-full',
        safeAreaInsets.top > 0 && 'has-notch',
        safeAreaInsets.bottom > 0 && 'has-home-indicator',
        (safeAreaInsets.left > 0 || safeAreaInsets.right > 0) && 'has-side-insets',
        className
      )}
      style={getContainerStyles()}
      data-safe-area-top={safeAreaInsets.top}
      data-safe-area-bottom={safeAreaInsets.bottom}
      data-safe-area-left={safeAreaInsets.left}
      data-safe-area-right={safeAreaInsets.right}
    >
      {children}
    </div>
  );
};

// Hook for accessing safe area insets
export const useSafeArea = (options: {
  respectNotch?: boolean;
  respectHomeIndicator?: boolean;
  minPadding?: number;
  maxPadding?: number;
} = {}) => {
  const {
    respectNotch = true,
    respectHomeIndicator = true,
    minPadding = 0,
    maxPadding = 50
  } = options;

  const [safeAreaInsets, setSafeAreaInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  const getSafeAreaInsets = useCallback((): SafeAreaInsets => {
    const computedStyle = getComputedStyle(document.documentElement);
    
    const parseInset = (value: string): number => {
      const parsed = parseInt(value.replace('px', '')) || 0;
      return Math.max(minPadding, Math.min(maxPadding, parsed));
    };

    const top = respectNotch ? 
      parseInset(computedStyle.getPropertyValue('--safe-area-inset-top') || 
                computedStyle.getPropertyValue('env(safe-area-inset-top)')) : 0;
    
    const bottom = respectHomeIndicator ? 
      parseInset(computedStyle.getPropertyValue('--safe-area-inset-bottom') || 
                computedStyle.getPropertyValue('env(safe-area-inset-bottom)')) : 0;
    
    const left = parseInset(computedStyle.getPropertyValue('--safe-area-inset-left') || 
                           computedStyle.getPropertyValue('env(safe-area-inset-left)'));
    
    const right = parseInset(computedStyle.getPropertyValue('--safe-area-inset-right') || 
                            computedStyle.getPropertyValue('env(safe-area-inset-right)'));

    return { top, bottom, left, right };
  }, [respectNotch, respectHomeIndicator, minPadding, maxPadding]);

  useEffect(() => {
    const updateInsets = () => {
      setSafeAreaInsets(getSafeAreaInsets());
    };

    updateInsets();

    const handleChange = () => {
      updateInsets();
    };

    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, [getSafeAreaInsets]);

  return safeAreaInsets;
};

// Utility component for safe area spacing
export const SafeAreaSpacer: React.FC<{
  area: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}> = ({ area, className }) => {
  const safeAreaInsets = useSafeArea();
  const size = safeAreaInsets[area];

  if (size === 0) return null;

  const sizeStyle = area === 'top' || area === 'bottom' 
    ? { height: `${size}px` }
    : { width: `${size}px` };

  return (
    <div
      className={cn(`safe-area-spacer-${area}`, className)}
      style={sizeStyle}
      aria-hidden="true"
    />
  );
};