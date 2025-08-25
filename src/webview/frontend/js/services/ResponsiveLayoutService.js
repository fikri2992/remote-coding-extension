/**
 * Responsive Layout Service - Manages responsive design and adaptive layouts
 */

export class ResponsiveLayoutService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Breakpoints
        this.breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024,
            large: 1440
        };
        
        // Current state
        this.currentBreakpoint = 'desktop';
        this.orientation = 'landscape';
        this.isTouch = false;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // Layout configurations
        this.layoutConfigs = new Map();
        this.adaptiveComponents = new Set();
        
        // Observers
        this.resizeObserver = null;
        this.mediaQueryLists = new Map();
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.handleOrientationChange = this.handleOrientationChange.bind(this);
        this.handleMediaQueryChange = this.handleMediaQueryChange.bind(this);
    }

    async initialize() {
        console.log('📱 Initializing Responsive Layout Service...');
        
        // Detect device capabilities
        this.detectDeviceCapabilities();
        
        // Setup media queries
        this.setupMediaQueries();
        
        // Setup resize observer
        this.setupResizeObserver();
        
        // Setup orientation change listener
        this.setupOrientationListener();
        
        // Initialize layout configurations
        this.initializeLayoutConfigs();
        
        // Apply initial layout
        this.updateLayout();
        
        console.log('✅ Responsive Layout Service initialized');
    }

    detectDeviceCapabilities() {
        // Detect touch capability
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Detect device type
        const userAgent = navigator.userAgent.toLowerCase();
        this.deviceType = this.getDeviceType(userAgent);
        
        // Detect orientation
        this.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        
        // Detect high DPI
        this.isHighDPI = this.devicePixelRatio > 1.5;
        
        // Detect reduced motion preference
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Update document classes
        this.updateDocumentClasses();
    }

    getDeviceType(userAgent) {
        if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
            if (/ipad/i.test(userAgent) || (window.innerWidth >= 768 && this.isTouch)) {
                return 'tablet';
            }
            return 'mobile';
        }
        return 'desktop';
    }

    updateDocumentClasses() {
        const body = document.body;
        
        // Device type classes
        body.classList.toggle('mobile-device', this.deviceType === 'mobile');
        body.classList.toggle('tablet-device', this.deviceType === 'tablet');
        body.classList.toggle('desktop-device', this.deviceType === 'desktop');
        
        // Touch capability
        body.classList.toggle('touch-device', this.isTouch);
        body.classList.toggle('no-touch', !this.isTouch);
        
        // Orientation
        body.classList.toggle('portrait', this.orientation === 'portrait');
        body.classList.toggle('landscape', this.orientation === 'landscape');
        
        // High DPI
        body.classList.toggle('high-dpi', this.isHighDPI);
        
        // Reduced motion
        body.classList.toggle('reduced-motion', this.prefersReducedMotion);
        
        // Breakpoint classes
        Object.keys(this.breakpoints).forEach(bp => {
            body.classList.toggle(`bp-${bp}`, this.currentBreakpoint === bp);
        });
    }

    setupMediaQueries() {
        // Create media query lists for each breakpoint
        Object.entries(this.breakpoints).forEach(([name, width]) => {
            const query = window.matchMedia(`(max-width: ${width}px)`);
            query.addListener(this.handleMediaQueryChange);
            this.mediaQueryLists.set(name, query);
        });
        
        // Orientation media query
        const orientationQuery = window.matchMedia('(orientation: portrait)');
        orientationQuery.addListener(this.handleOrientationChange);
        this.mediaQueryLists.set('orientation', orientationQuery);
        
        // Reduced motion media query
        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionQuery.addListener((e) => {
            this.prefersReducedMotion = e.matches;
            this.updateDocumentClasses();
            this.notifyLayoutChange('reduced-motion', { prefersReducedMotion: this.prefersReducedMotion });
        });
        this.mediaQueryLists.set('reduced-motion', reducedMotionQuery);
    }

    setupResizeObserver() {
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(document.body);
        } else {
            // Fallback to window resize event
            window.addEventListener('resize', this.handleResize);
        }
    }

    setupOrientationListener() {
        // Modern orientation API
        if (screen.orientation) {
            screen.orientation.addEventListener('change', this.handleOrientationChange);
        } else {
            // Fallback to orientationchange event
            window.addEventListener('orientationchange', this.handleOrientationChange);
        }
    }

    initializeLayoutConfigs() {
        // Mobile layout configuration
        this.layoutConfigs.set('mobile', {
            sidebar: {
                width: '100vw',
                position: 'absolute',
                overlay: true,
                collapsible: false
            },
            content: {
                padding: '8px',
                fontSize: '14px'
            },
            navigation: {
                touchFriendly: true,
                minTouchTarget: 44
            },
            cards: {
                margin: '8px',
                padding: '12px'
            }
        });
        
        // Tablet layout configuration
        this.layoutConfigs.set('tablet', {
            sidebar: {
                width: '240px',
                position: 'relative',
                overlay: false,
                collapsible: true
            },
            content: {
                padding: '12px',
                fontSize: '14px'
            },
            navigation: {
                touchFriendly: true,
                minTouchTarget: 40
            },
            cards: {
                margin: '12px',
                padding: '16px'
            }
        });
        
        // Desktop layout configuration
        this.layoutConfigs.set('desktop', {
            sidebar: {
                width: '240px',
                position: 'relative',
                overlay: false,
                collapsible: true
            },
            content: {
                padding: '16px',
                fontSize: '13px'
            },
            navigation: {
                touchFriendly: false,
                minTouchTarget: 32
            },
            cards: {
                margin: '16px',
                padding: '16px'
            }
        });
    }

    handleResize() {
        const oldBreakpoint = this.currentBreakpoint;
        this.currentBreakpoint = this.getCurrentBreakpoint();
        
        if (oldBreakpoint !== this.currentBreakpoint) {
            this.updateLayout();
            this.notifyLayoutChange('breakpoint', {
                from: oldBreakpoint,
                to: this.currentBreakpoint
            });
        }
        
        // Update orientation
        const oldOrientation = this.orientation;
        this.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        
        if (oldOrientation !== this.orientation) {
            this.updateDocumentClasses();
            this.notifyLayoutChange('orientation', {
                from: oldOrientation,
                to: this.orientation
            });
        }
        
        // Notify adaptive components
        this.notifyAdaptiveComponents('resize', {
            width: window.innerWidth,
            height: window.innerHeight,
            breakpoint: this.currentBreakpoint,
            orientation: this.orientation
        });
    }

    handleOrientationChange() {
        // Delay to ensure dimensions are updated
        setTimeout(() => {
            this.handleResize();
        }, 100);
    }

    handleMediaQueryChange() {
        this.handleResize();
    }

    getCurrentBreakpoint() {
        const width = window.innerWidth;
        
        if (width <= this.breakpoints.mobile) {
            return 'mobile';
        } else if (width <= this.breakpoints.tablet) {
            return 'tablet';
        } else if (width <= this.breakpoints.desktop) {
            return 'desktop';
        } else {
            return 'large';
        }
    }

    updateLayout() {
        const config = this.layoutConfigs.get(this.currentBreakpoint) || this.layoutConfigs.get('desktop');
        
        // Update document classes
        this.updateDocumentClasses();
        
        // Apply layout configuration
        this.applyLayoutConfig(config);
        
        // Update state manager
        this.stateManager.updateUI({
            breakpoint: this.currentBreakpoint,
            deviceType: this.deviceType,
            orientation: this.orientation,
            isTouch: this.isTouch,
            layoutConfig: config
        });
    }

    applyLayoutConfig(config) {
        const root = document.documentElement;
        
        // Apply CSS custom properties
        if (config.sidebar) {
            root.style.setProperty('--sidebar-width', config.sidebar.width);
        }
        
        if (config.content) {
            root.style.setProperty('--content-padding', config.content.padding);
            root.style.setProperty('--content-font-size', config.content.fontSize);
        }
        
        if (config.navigation) {
            root.style.setProperty('--min-touch-target', `${config.navigation.minTouchTarget}px`);
        }
        
        if (config.cards) {
            root.style.setProperty('--card-margin', config.cards.margin);
            root.style.setProperty('--card-padding', config.cards.padding);
        }
    }

    notifyLayoutChange(type, data) {
        const event = new CustomEvent('layout-change', {
            detail: { type, data, breakpoint: this.currentBreakpoint }
        });
        document.dispatchEvent(event);
    }

    notifyAdaptiveComponents(type, data) {
        this.adaptiveComponents.forEach(component => {
            if (typeof component.handleLayoutChange === 'function') {
                component.handleLayoutChange(type, data);
            }
        });
    }

    // Public API
    registerAdaptiveComponent(component) {
        this.adaptiveComponents.add(component);
    }

    unregisterAdaptiveComponent(component) {
        this.adaptiveComponents.delete(component);
    }

    getCurrentBreakpointInfo() {
        return {
            breakpoint: this.currentBreakpoint,
            deviceType: this.deviceType,
            orientation: this.orientation,
            isTouch: this.isTouch,
            isHighDPI: this.isHighDPI,
            prefersReducedMotion: this.prefersReducedMotion,
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    isMobile() {
        return this.currentBreakpoint === 'mobile' || this.deviceType === 'mobile';
    }

    isTablet() {
        return this.currentBreakpoint === 'tablet' || this.deviceType === 'tablet';
    }

    isDesktop() {
        return this.currentBreakpoint === 'desktop' || this.currentBreakpoint === 'large';
    }

    isTouchDevice() {
        return this.isTouch;
    }

    isPortrait() {
        return this.orientation === 'portrait';
    }

    isLandscape() {
        return this.orientation === 'landscape';
    }

    getLayoutConfig(breakpoint = null) {
        const bp = breakpoint || this.currentBreakpoint;
        return this.layoutConfigs.get(bp) || this.layoutConfigs.get('desktop');
    }

    setLayoutConfig(breakpoint, config) {
        this.layoutConfigs.set(breakpoint, config);
        
        if (breakpoint === this.currentBreakpoint) {
            this.applyLayoutConfig(config);
        }
    }

    // Utility methods for components
    adaptToBreakpoint(element, configs) {
        const config = configs[this.currentBreakpoint] || configs.default;
        
        if (config) {
            Object.entries(config).forEach(([property, value]) => {
                if (property.startsWith('class-')) {
                    const className = property.replace('class-', '');
                    element.classList.toggle(className, value);
                } else if (property.startsWith('style-')) {
                    const styleProp = property.replace('style-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    element.style[styleProp] = value;
                } else if (property.startsWith('attr-')) {
                    const attrName = property.replace('attr-', '');
                    if (value === null || value === false) {
                        element.removeAttribute(attrName);
                    } else {
                        element.setAttribute(attrName, value);
                    }
                }
            });
        }
    }

    createResponsiveElement(tagName, configs) {
        const element = document.createElement(tagName);
        this.adaptToBreakpoint(element, configs);
        
        // Register for automatic updates
        const updateHandler = () => this.adaptToBreakpoint(element, configs);
        document.addEventListener('layout-change', updateHandler);
        
        // Store cleanup function
        element._responsiveCleanup = () => {
            document.removeEventListener('layout-change', updateHandler);
        };
        
        return element;
    }

    destroy() {
        // Clean up media query listeners
        this.mediaQueryLists.forEach(mql => {
            mql.removeListener(this.handleMediaQueryChange);
        });
        this.mediaQueryLists.clear();
        
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else {
            window.removeEventListener('resize', this.handleResize);
        }
        
        // Clean up orientation listener
        if (screen.orientation) {
            screen.orientation.removeEventListener('change', this.handleOrientationChange);
        } else {
            window.removeEventListener('orientationchange', this.handleOrientationChange);
        }
        
        // Clear adaptive components
        this.adaptiveComponents.clear();
        this.layoutConfigs.clear();
        
        console.log('🧹 Responsive Layout Service destroyed');
    }
}