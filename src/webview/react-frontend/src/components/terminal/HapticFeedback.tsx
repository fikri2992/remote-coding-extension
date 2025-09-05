import React, { useEffect, useCallback } from 'react';

export interface HapticFeedbackProps {
  enabled?: boolean;
}

export interface HapticPattern {
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';
  duration?: number;
  pattern?: number[];
}

// Predefined haptic patterns for different interaction types
const HAPTIC_PATTERNS: Record<string, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [25, 25, 25],
  warning: [50, 50, 50, 50],
  error: [100, 50, 100],
  selection: 15,
  keyPress: 5,
  longPress: [50, 25, 50],
  swipe: 20,
  pinch: 30,
  tap: 8,
  doubleTab: [10, 10, 10],
};

export class HapticFeedbackManager {
  private static instance: HapticFeedbackManager;
  private enabled: boolean = true;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'vibrate' in navigator;
    
    // Check for iOS haptic feedback support
    if ('DeviceMotionEvent' in window && 'requestPermission' in (DeviceMotionEvent as any)) {
      // iOS device with haptic feedback capability
      this.isSupported = true;
    }
  }

  static getInstance(): HapticFeedbackManager {
    if (!HapticFeedbackManager.instance) {
      HapticFeedbackManager.instance = new HapticFeedbackManager();
    }
    return HapticFeedbackManager.instance;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isHapticSupported(): boolean {
    return this.isSupported;
  }

  // Trigger haptic feedback with pattern
  trigger(pattern: HapticPattern): void {
    if (!this.enabled || !this.isSupported) {
      return;
    }

    try {
      // Use custom pattern if provided
      if (pattern.pattern) {
        navigator.vibrate(pattern.pattern);
        return;
      }

      // Use predefined patterns
      const vibrationPattern = HAPTIC_PATTERNS[pattern.type];
      if (vibrationPattern) {
        navigator.vibrate(vibrationPattern);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }

  // Convenience methods for common interactions
  keyPress(): void {
    this.trigger({ type: 'selection' });
  }

  longPress(): void {
    this.trigger({ type: 'medium', pattern: [50, 25, 50] });
  }

  swipe(): void {
    this.trigger({ type: 'light' });
  }

  pinch(): void {
    this.trigger({ type: 'medium' });
  }

  tap(): void {
    this.trigger({ type: 'light' });
  }

  doubleTap(): void {
    this.trigger({ type: 'selection', pattern: [10, 10, 10] });
  }

  success(): void {
    this.trigger({ type: 'success' });
  }

  error(): void {
    this.trigger({ type: 'error' });
  }

  warning(): void {
    this.trigger({ type: 'warning' });
  }

  // Stop all vibrations
  stop(): void {
    if (this.isSupported) {
      navigator.vibrate(0);
    }
  }
}

export const HapticFeedback: React.FC<HapticFeedbackProps> = ({ 
  enabled = true 
}) => {
  const hapticManager = HapticFeedbackManager.getInstance();

  useEffect(() => {
    hapticManager.setEnabled(enabled);
  }, [enabled, hapticManager]);

  // Expose haptic manager to window for global access
  useEffect(() => {
    (window as any).hapticFeedback = hapticManager;
    
    return () => {
      delete (window as any).hapticFeedback;
    };
  }, [hapticManager]);

  // This component doesn't render anything visible
  return null;
};

// Hook for using haptic feedback in components
export const useHapticFeedback = () => {
  const hapticManager = HapticFeedbackManager.getInstance();

  const triggerHaptic = useCallback((pattern: HapticPattern) => {
    hapticManager.trigger(pattern);
  }, [hapticManager]);

  const hapticActions = {
    keyPress: () => hapticManager.keyPress(),
    longPress: () => hapticManager.longPress(),
    swipe: () => hapticManager.swipe(),
    pinch: () => hapticManager.pinch(),
    tap: () => hapticManager.tap(),
    doubleTap: () => hapticManager.doubleTap(),
    success: () => hapticManager.success(),
    error: () => hapticManager.error(),
    warning: () => hapticManager.warning(),
    stop: () => hapticManager.stop(),
  };

  return {
    triggerHaptic,
    isSupported: hapticManager.isHapticSupported(),
    ...hapticActions
  };
};