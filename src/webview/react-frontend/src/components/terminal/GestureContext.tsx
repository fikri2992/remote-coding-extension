import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { 
  GestureType, 
  GestureCallback, 
  GestureSettings, 
  GestureConfig,
  GestureHandler as IGestureHandler,
  TouchGesture
} from '../../types/gesture';
import { updateGestureSetting } from './gestureUtils';

interface GestureContextType {
  gestureHandler: IGestureHandler;
  settings: GestureSettings;
  registerGlobalGesture: (type: GestureType, handler: GestureCallback) => void;
  unregisterGlobalGesture: (type: GestureType) => void;
  triggerGesture: (gesture: TouchGesture) => void;
}

const GestureContext = createContext<GestureContextType | null>(null);

// Default gesture settings
const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  tap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 300 },
  doubleTap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 300 },
  tripleTap: { enabled: true, sensitivity: 1, threshold: 10, timeout: 400 },
  longPress: { enabled: true, sensitivity: 1, threshold: 10, timeout: 500 },
  swipe: { enabled: true, sensitivity: 1, threshold: 50, timeout: 1000 },
  pinch: { enabled: true, sensitivity: 1, threshold: 20 },
  pan: { enabled: true, sensitivity: 1, threshold: 10 },
  globalSensitivity: 1,
  hapticFeedback: true,
  visualFeedback: true
};

interface GestureProviderProps {
  children: React.ReactNode;
  initialSettings?: Partial<GestureSettings>;
  onGlobalGesture?: (gesture: TouchGesture) => void;
}

export const GestureProvider: React.FC<GestureProviderProps> = ({
  children,
  initialSettings = {},
  onGlobalGesture
}) => {
  const gestureHandlersRef = useRef<Map<GestureType, GestureCallback[]>>(new Map());
  const [settings, setSettings] = useState<GestureSettings>({
    ...DEFAULT_GESTURE_SETTINGS,
    ...initialSettings
  });

  // Global gesture handler implementation
  const gestureHandler: IGestureHandler = {
    registerGesture: (type: GestureType, handler: GestureCallback) => {
      const handlers = gestureHandlersRef.current.get(type) || [];
      handlers.push(handler);
      gestureHandlersRef.current.set(type, handlers);
    },

    unregisterGesture: (type: GestureType) => {
      gestureHandlersRef.current.delete(type);
    },

    enableGesture: (type: GestureType, enabled: boolean) => {
      setSettings(prev => ({
        ...prev,
        ...updateGestureSetting(prev, type, { enabled })
      }));
    },

    setGestureSensitivity: (sensitivity: number) => {
      setSettings(prev => ({
        ...prev,
        globalSensitivity: Math.max(0.1, Math.min(5, sensitivity))
      }));
    },

    setGestureConfig: (type: GestureType, config: Partial<GestureConfig>) => {
      setSettings(prev => ({
        ...prev,
        ...updateGestureSetting(prev, type, config)
      }));
    },

    getGestureSettings: () => settings,

    updateGestureSettings: (newSettings: Partial<GestureSettings>) => {
      setSettings(prev => ({ ...prev, ...newSettings }));
    }
  };

  // Register global gesture handler
  const registerGlobalGesture = useCallback((type: GestureType, handler: GestureCallback) => {
    gestureHandler.registerGesture(type, handler);
  }, [gestureHandler]);

  // Unregister global gesture handler
  const unregisterGlobalGesture = useCallback((type: GestureType) => {
    gestureHandler.unregisterGesture(type);
  }, [gestureHandler]);

  // Trigger gesture and call all registered handlers
  const triggerGesture = useCallback((gesture: TouchGesture) => {
    // Call global gesture handler if provided
    onGlobalGesture?.(gesture);
    
    // Call all registered handlers for this gesture type
    const handlers = gestureHandlersRef.current.get(gesture.type) || [];
    handlers.forEach(handler => {
      try {
        handler(gesture);
      } catch (error) {
        console.error(`Error in gesture handler for ${gesture.type}:`, error);
      }
    });
  }, [onGlobalGesture]);

  const contextValue: GestureContextType = {
    gestureHandler,
    settings,
    registerGlobalGesture,
    unregisterGlobalGesture,
    triggerGesture
  };

  return (
    <GestureContext.Provider value={contextValue}>
      {children}
    </GestureContext.Provider>
  );
};

// Hook to use gesture context
export const useGestureContext = (): GestureContextType => {
  const context = useContext(GestureContext);
  if (!context) {
    throw new Error('useGestureContext must be used within a GestureProvider');
  }
  return context;
};

// Hook to register gesture handlers with automatic cleanup
export const useGestureRegistration = (
  type: GestureType, 
  handler: GestureCallback, 
  enabled: boolean = true
) => {
  const { registerGlobalGesture, unregisterGlobalGesture } = useGestureContext();

  React.useEffect(() => {
    if (enabled) {
      registerGlobalGesture(type, handler);
      return () => unregisterGlobalGesture(type);
    }
  }, [type, handler, enabled, registerGlobalGesture, unregisterGlobalGesture]);
};

// Hook for gesture settings management
export const useGestureSettings = () => {
  const { gestureHandler, settings } = useGestureContext();

  const updateSetting = useCallback((type: GestureType, config: Partial<GestureConfig>) => {
    gestureHandler.setGestureConfig(type, config);
  }, [gestureHandler]);

  const updateGlobalSensitivity = useCallback((sensitivity: number) => {
    gestureHandler.setGestureSensitivity(sensitivity);
  }, [gestureHandler]);

  const enableGesture = useCallback((type: GestureType, enabled: boolean) => {
    gestureHandler.enableGesture(type, enabled);
  }, [gestureHandler]);

  const updateAllSettings = useCallback((newSettings: Partial<GestureSettings>) => {
    gestureHandler.updateGestureSettings(newSettings);
  }, [gestureHandler]);

  return {
    settings,
    updateSetting,
    updateGlobalSensitivity,
    enableGesture,
    updateAllSettings
  };
};

export default GestureContext;