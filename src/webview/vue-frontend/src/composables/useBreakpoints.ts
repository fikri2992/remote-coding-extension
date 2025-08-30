import { ref, onMounted, onUnmounted, computed } from 'vue'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'
export type Orientation = 'portrait' | 'landscape'

export interface BreakpointState {
  current: Breakpoint
  orientation: Orientation
  width: number
  height: number
  safeArea: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

export interface BreakpointConfig {
  mobile: number
  tablet: number
  desktop: number
}

const defaultConfig: BreakpointConfig = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
}

export function useBreakpoints(config: BreakpointConfig = defaultConfig) {
  const width = ref(0)
  const height = ref(0)
  const safeAreaTop = ref(0)
  const safeAreaBottom = ref(0)
  const safeAreaLeft = ref(0)
  const safeAreaRight = ref(0)

  // Media query objects for efficient breakpoint detection
  const mobileQuery = ref<MediaQueryList | null>(null)
  const tabletQuery = ref<MediaQueryList | null>(null)
  const desktopQuery = ref<MediaQueryList | null>(null)
  const orientationQuery = ref<MediaQueryList | null>(null)

  // Reactive breakpoint state
  const current = computed<Breakpoint>(() => {
    if (width.value < config.mobile) return 'mobile'
    if (width.value < config.tablet) return 'tablet'
    return 'desktop'
  })

  const orientation = computed<Orientation>(() => {
    return width.value > height.value ? 'landscape' : 'portrait'
  })

  const isMobile = computed(() => current.value === 'mobile')
  const isTablet = computed(() => current.value === 'tablet')
  const isDesktop = computed(() => current.value === 'desktop')
  const isPortrait = computed(() => orientation.value === 'portrait')
  const isLandscape = computed(() => orientation.value === 'landscape')

  const safeArea = computed(() => ({
    top: safeAreaTop.value,
    bottom: safeAreaBottom.value,
    left: safeAreaLeft.value,
    right: safeAreaRight.value
  }))

  const state = computed<BreakpointState>(() => ({
    current: current.value,
    orientation: orientation.value,
    width: width.value,
    height: height.value,
    safeArea: safeArea.value
  }))

  // Update dimensions and safe area
  const updateDimensions = () => {
    width.value = window.innerWidth
    height.value = window.innerHeight

    // Get safe area values from CSS environment variables
    const computedStyle = getComputedStyle(document.documentElement)
    safeAreaTop.value = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0', 10)
    safeAreaBottom.value = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0', 10)
    safeAreaLeft.value = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0', 10)
    safeAreaRight.value = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0', 10)
  }

  // Initialize media queries
  const initializeMediaQueries = () => {
    if (typeof window === 'undefined') return

    // Create media queries for breakpoint detection
    mobileQuery.value = window.matchMedia(`(max-width: ${config.mobile - 1}px)`)
    tabletQuery.value = window.matchMedia(`(min-width: ${config.mobile}px) and (max-width: ${config.tablet - 1}px)`)
    desktopQuery.value = window.matchMedia(`(min-width: ${config.tablet}px)`)
    orientationQuery.value = window.matchMedia('(orientation: portrait)')

    // Add listeners for media query changes
    const handleChange = () => updateDimensions()
    
    mobileQuery.value?.addEventListener('change', handleChange)
    tabletQuery.value?.addEventListener('change', handleChange)
    desktopQuery.value?.addEventListener('change', handleChange)
    orientationQuery.value?.addEventListener('change', handleChange)
  }

  // Cleanup media queries
  const cleanupMediaQueries = () => {
    const handleChange = () => updateDimensions()
    
    mobileQuery.value?.removeEventListener('change', handleChange)
    tabletQuery.value?.removeEventListener('change', handleChange)
    desktopQuery.value?.removeEventListener('change', handleChange)
    orientationQuery.value?.removeEventListener('change', handleChange)
  }

  // Utility functions for responsive behavior
  const matches = (breakpoint: Breakpoint): boolean => {
    return current.value === breakpoint
  }

  const matchesAny = (breakpoints: Breakpoint[]): boolean => {
    return breakpoints.includes(current.value)
  }

  const isAtLeast = (breakpoint: Breakpoint): boolean => {
    const order: Breakpoint[] = ['mobile', 'tablet', 'desktop']
    const currentIndex = order.indexOf(current.value)
    const targetIndex = order.indexOf(breakpoint)
    return currentIndex >= targetIndex
  }

  const isAtMost = (breakpoint: Breakpoint): boolean => {
    const order: Breakpoint[] = ['mobile', 'tablet', 'desktop']
    const currentIndex = order.indexOf(current.value)
    const targetIndex = order.indexOf(breakpoint)
    return currentIndex <= targetIndex
  }

  // Get responsive value based on current breakpoint
  const getResponsiveValue = <T>(values: Partial<Record<Breakpoint, T>>, fallback: T): T => {
    return values[current.value] ?? fallback
  }

  onMounted(() => {
    updateDimensions()
    initializeMediaQueries()
    window.addEventListener('resize', updateDimensions)
    window.addEventListener('orientationchange', updateDimensions)
  })

  onUnmounted(() => {
    cleanupMediaQueries()
    window.removeEventListener('resize', updateDimensions)
    window.removeEventListener('orientationchange', updateDimensions)
  })

  return {
    // State
    state,
    current,
    orientation,
    width,
    height,
    safeArea,
    
    // Computed flags
    isMobile,
    isTablet,
    isDesktop,
    isPortrait,
    isLandscape,
    
    // Utility functions
    matches,
    matchesAny,
    isAtLeast,
    isAtMost,
    getResponsiveValue,
    
    // Configuration
    config
  }
}