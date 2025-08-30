import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useBreakpoints, type Breakpoint, type Orientation } from './useBreakpoints'

export type LayoutMode = 'single-column' | 'two-column' | 'three-column' | 'sidebar' | 'overlay' | 'split'
export type NavigationPattern = 'top' | 'bottom' | 'sidebar' | 'overlay'
export type HeaderState = 'expanded' | 'collapsed' | 'hidden'

export interface LayoutConfiguration {
  mobile: {
    mode: LayoutMode
    navigation: NavigationPattern
    headerCollapsible: boolean
    searchCollapsible: boolean
    maxWidth?: string
  }
  tablet: {
    mode: LayoutMode
    navigation: NavigationPattern
    headerCollapsible: boolean
    searchCollapsible: boolean
    sidebarWidth?: string
    maxWidth?: string
  }
  desktop: {
    mode: LayoutMode
    navigation: NavigationPattern
    headerCollapsible: boolean
    searchCollapsible: boolean
    sidebarWidth?: string
    maxWidth?: string
  }
}

export interface LayoutState {
  currentMode: LayoutMode
  currentNavigation: NavigationPattern
  headerState: HeaderState
  searchExpanded: boolean
  sidebarVisible: boolean
  overlayVisible: boolean
  isTransitioning: boolean
  previousBreakpoint: Breakpoint | null
  orientationChanged: boolean
}

export interface LayoutTransition {
  duration: number
  easing: string
  properties: string[]
}

export interface AdaptiveLayoutOptions {
  configuration?: Partial<LayoutConfiguration>
  transitions?: Partial<LayoutTransition>
  preserveState?: boolean
  enableAnimations?: boolean
  autoCollapse?: boolean
}

const defaultLayoutConfiguration: LayoutConfiguration = {
  mobile: {
    mode: 'single-column',
    navigation: 'bottom',
    headerCollapsible: true,
    searchCollapsible: true
  },
  tablet: {
    mode: 'two-column',
    navigation: 'sidebar',
    headerCollapsible: true,
    searchCollapsible: false,
    sidebarWidth: '280px'
  },
  desktop: {
    mode: 'three-column',
    navigation: 'sidebar',
    headerCollapsible: false,
    searchCollapsible: false,
    sidebarWidth: '320px',
    maxWidth: '1400px'
  }
}

const defaultTransition: LayoutTransition = {
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  properties: ['transform', 'opacity', 'width', 'height']
}

export function useLayout(options: AdaptiveLayoutOptions = {}) {
  const breakpoints = useBreakpoints()
  
  // Configuration
  const config = reactive<LayoutConfiguration>({
    ...defaultLayoutConfiguration,
    ...options.configuration
  })
  
  const transition = reactive<LayoutTransition>({
    ...defaultTransition,
    ...options.transitions
  })

  // State management
  const state = reactive<LayoutState>({
    currentMode: 'single-column',
    currentNavigation: 'top',
    headerState: 'expanded',
    searchExpanded: false,
    sidebarVisible: false,
    overlayVisible: false,
    isTransitioning: false,
    previousBreakpoint: null,
    orientationChanged: false
  })

  // Preserved state for seamless transitions
  const preservedState = ref<{
    scrollPosition: number
    selectedItems: string[]
    expandedFolders: string[]
    searchQuery: string
  }>({
    scrollPosition: 0,
    selectedItems: [],
    expandedFolders: [],
    searchQuery: ''
  })

  // Computed properties
  const currentLayoutConfig = computed(() => {
    return config[breakpoints.current.value]
  })

  const layoutClasses = computed(() => {
    const classes: string[] = []
    
    // Base layout classes
    classes.push(`layout-${state.currentMode}`)
    classes.push(`nav-${state.currentNavigation}`)
    classes.push(`header-${state.headerState}`)
    
    // Breakpoint classes
    classes.push(`breakpoint-${breakpoints.current.value}`)
    classes.push(`orientation-${breakpoints.orientation.value}`)
    
    // State classes
    if (state.isTransitioning) classes.push('layout-transitioning')
    if (state.searchExpanded) classes.push('search-expanded')
    if (state.sidebarVisible) classes.push('sidebar-visible')
    if (state.overlayVisible) classes.push('overlay-visible')
    if (state.orientationChanged) classes.push('orientation-changed')
    
    return classes
  })

  const layoutStyles = computed(() => {
    const styles: Record<string, string> = {}
    
    // Transition styles
    if (options.enableAnimations !== false) {
      styles['--layout-transition-duration'] = `${transition.duration}ms`
      styles['--layout-transition-easing'] = transition.easing
      styles['--layout-transition-properties'] = transition.properties.join(', ')
    }
    
    // Layout-specific styles
    const layoutConfig = currentLayoutConfig.value
    
    if (layoutConfig.sidebarWidth) {
      styles['--sidebar-width'] = layoutConfig.sidebarWidth
    }
    
    if (layoutConfig.maxWidth) {
      styles['--layout-max-width'] = layoutConfig.maxWidth
    }
    
    // Safe area support
    styles['--safe-area-top'] = `${breakpoints.safeArea.value.top}px`
    styles['--safe-area-bottom'] = `${breakpoints.safeArea.value.bottom}px`
    styles['--safe-area-left'] = `${breakpoints.safeArea.value.left}px`
    styles['--safe-area-right'] = `${breakpoints.safeArea.value.right}px`
    
    return styles
  })

  const isCollapsibleHeader = computed(() => {
    return currentLayoutConfig.value.headerCollapsible
  })

  const isCollapsibleSearch = computed(() => {
    return currentLayoutConfig.value.searchCollapsible
  })

  const shouldShowBottomNavigation = computed(() => {
    return state.currentNavigation === 'bottom'
  })

  const shouldShowSidebar = computed(() => {
    return ['sidebar', 'split'].includes(state.currentNavigation) && state.sidebarVisible
  })

  // Layout update methods
  const updateLayout = async (newBreakpoint?: Breakpoint, newOrientation?: Orientation) => {
    const targetBreakpoint = newBreakpoint || breakpoints.current.value
    const targetOrientation = newOrientation || breakpoints.orientation.value
    
    // Check if this is an orientation change
    const orientationChanged = state.previousBreakpoint === targetBreakpoint && 
                              targetOrientation !== breakpoints.orientation.value

    if (orientationChanged) {
      state.orientationChanged = true
      
      // Preserve state during orientation change
      if (options.preserveState) {
        await preserveCurrentState()
      }
    }

    // Start transition
    state.isTransitioning = true
    
    try {
      // Update layout configuration
      const newConfig = config[targetBreakpoint]
      
      // Apply new layout mode
      state.currentMode = newConfig.mode
      state.currentNavigation = newConfig.navigation
      
      // Update header state based on configuration
      if (newConfig.headerCollapsible && options.autoCollapse) {
        state.headerState = breakpoints.isMobile.value ? 'collapsed' : 'expanded'
      }
      
      // Update search state
      if (newConfig.searchCollapsible) {
        state.searchExpanded = !breakpoints.isMobile.value
      } else {
        state.searchExpanded = true
      }
      
      // Update sidebar visibility
      state.sidebarVisible = ['sidebar', 'split'].includes(newConfig.navigation)
      
      // Update overlay visibility for mobile
      state.overlayVisible = newConfig.navigation === 'overlay'
      
      // Wait for DOM updates
      await nextTick()
      
      // Restore state if needed
      if (options.preserveState && (orientationChanged || state.previousBreakpoint !== targetBreakpoint)) {
        await restorePreservedState()
      }
      
      // Update previous breakpoint
      state.previousBreakpoint = targetBreakpoint
      
    } finally {
      // End transition after animation duration
      setTimeout(() => {
        state.isTransitioning = false
        state.orientationChanged = false
      }, transition.duration)
    }
  }

  // State preservation methods
  const preserveCurrentState = async () => {
    // Preserve scroll position
    const scrollContainer = document.querySelector('.file-tree')
    if (scrollContainer) {
      preservedState.value.scrollPosition = scrollContainer.scrollTop
    }
    
    // Preserve search query
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
    if (searchInput) {
      preservedState.value.searchQuery = searchInput.value
    }
    
    // Preserve selected items (this would be passed from parent component)
    // preservedState.value.selectedItems = [...selectedItems]
    
    // Preserve expanded folders (this would be passed from parent component)  
    // preservedState.value.expandedFolders = [...expandedFolders]
  }

  const restorePreservedState = async () => {
    await nextTick()
    
    // Restore scroll position
    const scrollContainer = document.querySelector('.file-tree')
    if (scrollContainer && preservedState.value.scrollPosition > 0) {
      scrollContainer.scrollTop = preservedState.value.scrollPosition
    }
    
    // Restore search query
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
    if (searchInput && preservedState.value.searchQuery) {
      searchInput.value = preservedState.value.searchQuery
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  // Header and search control methods
  const toggleHeader = () => {
    if (!isCollapsibleHeader.value) return
    
    state.headerState = state.headerState === 'expanded' ? 'collapsed' : 'expanded'
  }

  const expandHeader = () => {
    if (!isCollapsibleHeader.value) return
    state.headerState = 'expanded'
  }

  const collapseHeader = () => {
    if (!isCollapsibleHeader.value) return
    state.headerState = 'collapsed'
  }

  const toggleSearch = () => {
    if (!isCollapsibleSearch.value) return
    state.searchExpanded = !state.searchExpanded
  }

  const expandSearch = () => {
    if (!isCollapsibleSearch.value) return
    state.searchExpanded = true
  }

  const collapseSearch = () => {
    if (!isCollapsibleSearch.value) return
    state.searchExpanded = false
  }

  // Sidebar control methods
  const toggleSidebar = () => {
    state.sidebarVisible = !state.sidebarVisible
  }

  const showSidebar = () => {
    state.sidebarVisible = true
  }

  const hideSidebar = () => {
    state.sidebarVisible = false
  }

  // Overlay control methods
  const showOverlay = () => {
    state.overlayVisible = true
  }

  const hideOverlay = () => {
    state.overlayVisible = false
  }

  // Configuration update methods
  const updateConfiguration = (newConfig: Partial<LayoutConfiguration>) => {
    Object.assign(config, newConfig)
    updateLayout()
  }

  const updateTransition = (newTransition: Partial<LayoutTransition>) => {
    Object.assign(transition, newTransition)
  }

  // Responsive utilities
  const getLayoutValue = <T>(values: Partial<Record<Breakpoint, T>>, fallback: T): T => {
    return values[breakpoints.current.value] ?? fallback
  }

  const isLayoutMode = (mode: LayoutMode): boolean => {
    return state.currentMode === mode
  }

  const isNavigationPattern = (pattern: NavigationPattern): boolean => {
    return state.currentNavigation === pattern
  }

  // Watch for breakpoint changes
  watch(
    () => breakpoints.current.value,
    (newBreakpoint, oldBreakpoint) => {
      if (newBreakpoint !== oldBreakpoint) {
        updateLayout(newBreakpoint)
      }
    }
  )

  // Watch for orientation changes
  watch(
    () => breakpoints.orientation.value,
    (newOrientation, oldOrientation) => {
      if (newOrientation !== oldOrientation) {
        updateLayout(breakpoints.current.value, newOrientation)
      }
    }
  )

  // Initialize layout on mount
  onMounted(() => {
    updateLayout()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    // Clean up any pending transitions
    state.isTransitioning = false
  })

  return {
    // State
    state: readonly(state),
    config: readonly(config),
    transition: readonly(transition),
    preservedState: readonly(preservedState),
    
    // Computed properties
    currentLayoutConfig,
    layoutClasses,
    layoutStyles,
    isCollapsibleHeader,
    isCollapsibleSearch,
    shouldShowBottomNavigation,
    shouldShowSidebar,
    
    // Layout control methods
    updateLayout,
    preserveCurrentState,
    restorePreservedState,
    
    // Header and search controls
    toggleHeader,
    expandHeader,
    collapseHeader,
    toggleSearch,
    expandSearch,
    collapseSearch,
    
    // Sidebar controls
    toggleSidebar,
    showSidebar,
    hideSidebar,
    
    // Overlay controls
    showOverlay,
    hideOverlay,
    
    // Configuration methods
    updateConfiguration,
    updateTransition,
    
    // Utilities
    getLayoutValue,
    isLayoutMode,
    isNavigationPattern,
    
    // Breakpoint integration
    breakpoints
  }
}