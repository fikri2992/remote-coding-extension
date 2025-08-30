import { ref } from 'vue'

export interface HapticFeedbackOptions {
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification'
  pattern?: number[]
  enabled?: boolean
}

export interface HapticFeedbackConfig {
  enabled: boolean
  fallbackToVisual: boolean
  debugMode: boolean
}

const defaultConfig: HapticFeedbackConfig = {
  enabled: true,
  fallbackToVisual: true,
  debugMode: false
}

export function useHapticFeedback(config: Partial<HapticFeedbackConfig> = {}) {
  const hapticConfig = ref<HapticFeedbackConfig>({ ...defaultConfig, ...config })
  const isSupported = ref(false)
  const lastFeedbackTime = ref(0)

  // Check if haptic feedback is supported
  const checkSupport = (): boolean => {
    try {
      // Check for Web Vibration API
      if ('vibrate' in navigator) {
        isSupported.value = true
        return true
      }
      
      // Check for iOS haptic feedback (if available in future)
      // @ts-ignore - Future API
      if (window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission === 'function') {
        // iOS devices might support haptic feedback in the future
        isSupported.value = false
        return false
      }
      
      isSupported.value = false
      return false
    } catch (error) {
      if (hapticConfig.value.debugMode) {
        console.warn('Haptic feedback support check failed:', error)
      }
      isSupported.value = false
      return false
    }
  }

  // Trigger haptic feedback
  const triggerHapticFeedback = async (options: HapticFeedbackOptions): Promise<boolean> => {
    if (!hapticConfig.value.enabled || (options.enabled === false)) {
      return false
    }

    // Throttle feedback to prevent excessive vibration
    const now = Date.now()
    const minInterval = 50 // Minimum 50ms between feedback
    if (now - lastFeedbackTime.value < minInterval) {
      return false
    }
    lastFeedbackTime.value = now

    try {
      if (!checkSupport()) {
        if (hapticConfig.value.fallbackToVisual) {
          triggerVisualFeedback(options.type)
        }
        return false
      }

      let pattern: number | number[]

      // Use custom pattern if provided
      if (options.pattern) {
        pattern = options.pattern
      } else {
        // Map feedback types to vibration patterns
        switch (options.type) {
          case 'light':
            pattern = 10
            break
          case 'medium':
            pattern = 20
            break
          case 'heavy':
            pattern = 50
            break
          case 'selection':
            pattern = [10, 10, 10]
            break
          case 'impact':
            pattern = [20, 10, 20]
            break
          case 'notification':
            pattern = [50, 20, 50, 20, 50]
            break
          default:
            pattern = 20
        }
      }

      // Trigger vibration
      const success = navigator.vibrate(pattern)
      
      if (hapticConfig.value.debugMode) {
        console.log(`Haptic feedback triggered: ${options.type}`, { pattern, success })
      }

      return success
    } catch (error) {
      if (hapticConfig.value.debugMode) {
        console.warn('Haptic feedback failed:', error)
      }
      
      if (hapticConfig.value.fallbackToVisual) {
        triggerVisualFeedback(options.type)
      }
      
      return false
    }
  }

  // Visual feedback fallback
  const triggerVisualFeedback = (type: HapticFeedbackOptions['type']): void => {
    const element = document.activeElement as HTMLElement
    if (!element) return

    const className = `haptic-feedback-${type}`
    
    // Add visual feedback class
    element.classList.add(className)
    
    // Remove class after animation
    const duration = type === 'heavy' ? 200 : type === 'medium' ? 150 : 100
    setTimeout(() => {
      element.classList.remove(className)
    }, duration)
  }

  // Convenience methods for common feedback types
  const light = (enabled = true) => triggerHapticFeedback({ type: 'light', enabled })
  const medium = (enabled = true) => triggerHapticFeedback({ type: 'medium', enabled })
  const heavy = (enabled = true) => triggerHapticFeedback({ type: 'heavy', enabled })
  const selection = (enabled = true) => triggerHapticFeedback({ type: 'selection', enabled })
  const impact = (enabled = true) => triggerHapticFeedback({ type: 'impact', enabled })
  const notification = (enabled = true) => triggerHapticFeedback({ type: 'notification', enabled })

  // Custom pattern feedback
  const custom = (pattern: number[], enabled = true) => 
    triggerHapticFeedback({ type: 'light', pattern, enabled })

  // Configuration methods
  const enable = () => {
    hapticConfig.value.enabled = true
  }

  const disable = () => {
    hapticConfig.value.enabled = false
  }

  const setConfig = (newConfig: Partial<HapticFeedbackConfig>) => {
    Object.assign(hapticConfig.value, newConfig)
  }

  // Initialize support check
  checkSupport()

  return {
    // State
    isSupported,
    config: hapticConfig,

    // Core methods
    triggerHapticFeedback,
    triggerVisualFeedback,
    checkSupport,

    // Convenience methods
    light,
    medium,
    heavy,
    selection,
    impact,
    notification,
    custom,

    // Configuration
    enable,
    disable,
    setConfig
  }
}

// Global haptic feedback instance for app-wide use
let globalHapticFeedback: ReturnType<typeof useHapticFeedback> | null = null

export function useGlobalHapticFeedback(config?: Partial<HapticFeedbackConfig>) {
  if (!globalHapticFeedback) {
    globalHapticFeedback = useHapticFeedback(config)
  }
  return globalHapticFeedback
}

// Utility function for quick haptic feedback without composable
export async function quickHaptic(
  type: HapticFeedbackOptions['type'] = 'light',
  enabled = true
): Promise<boolean> {
  if (!enabled) return false
  
  const haptic = useGlobalHapticFeedback()
  return haptic.triggerHapticFeedback({ type, enabled })
}