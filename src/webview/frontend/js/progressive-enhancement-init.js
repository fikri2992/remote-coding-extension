/**
 * Progressive Enhancement Initialization Script
 * Initializes and coordinates the progressive enhancement detection system,
 * loading strategy engine, and performance monitoring service
 */

(function() {
    'use strict';

    // Global progressive enhancement system
    let progressiveEnhancementSystem = null;
    let loadingStrategyEngine = null;
    let performanceMonitoringService = null;
    let isInitialized = false;

    /**
     * Initialize the progressive enhancement system
     */
    async function initializeProgressiveEnhancement() {
        if (isInitialized) {
            return getEnhancementDecision();
        }

        console.log('🚀 Initializing Progressive Enhancement System...');
        
        try {
            // Show loading progress
            updateLoadingProgress('Detecting device capabilities...', 10);
            
            // Initialize performance monitoring first
            performanceMonitoringService = new PerformanceMonitoringService();
            await performanceMonitoringService.initialize();
            
            updateLoadingProgress('Analyzing network conditions...', 30);
            
            // Initialize progressive enhancement detection
            progressiveEnhancementSystem = new ProgressiveEnhancement();
            const enhancementDecision = await progressiveEnhancementSystem.initialize();
            
            updateLoadingProgress('Determining optimal loading strategy...', 60);
            
            // Initialize loading strategy engine
            loadingStrategyEngine = new LoadingStrategyEngine(progressiveEnhancementSystem);
            await loadingStrategyEngine.initialize();
            
            updateLoadingProgress('Setting up adaptive monitoring...', 80);
            
            // Set up integration between systems
            setupSystemIntegration();
            
            updateLoadingProgress('Progressive enhancement ready!', 100);
            
            isInitialized = true;
            
            console.log('✅ Progressive Enhancement System fully initialized');
            console.log('📊 Final Enhancement Decision:', enhancementDecision);
            
            // Notify about initialization completion
            notifyInitializationComplete(enhancementDecision);
            
            // Hide loading screen after a brief delay
            setTimeout(() => {
                hideLoadingScreen();
            }, 500);
            
            return enhancementDecision;
            
        } catch (error) {
            console.error('❌ Failed to initialize Progressive Enhancement System:', error);
            
            // Fallback to basic functionality
            handleInitializationFailure(error);
            throw error;
        }
    }

    /**
     * Set up integration between systems
     */
    function setupSystemIntegration() {
        console.log('🔗 Setting up system integration...');
        
        // Performance monitoring integration
        if (performanceMonitoringService) {
            // Add performance report callback
            performanceMonitoringService.addReportingCallback((report) => {
                handlePerformanceReport(report);
            });
            
            // Listen for performance alerts
            document.addEventListener('performance-alert', (event) => {
                handlePerformanceAlert(event.detail);
            });
            
            // Listen for memory pressure
            document.addEventListener('memory-pressure', (event) => {
                handleMemoryPressure(event.detail);
            });
        }
        
        // Loading strategy integration
        if (loadingStrategyEngine) {
            // Listen for strategy updates
            document.addEventListener('loading-strategy-update', (event) => {
                handleStrategyUpdate(event.detail);
            });
        }
        
        // Progressive enhancement integration
        if (progressiveEnhancementSystem) {
            // Listen for enhancement changes
            document.addEventListener('progressive-enhancement-change', (event) => {
                handleEnhancementChange(event.detail);
            });
        }
        
        console.log('✅ System integration complete');
    }

    /**
     * Handle performance reports
     */
    function handlePerformanceReport(report) {
        console.log('📊 Performance Report:', report.summary);
        
        // Check if performance has degraded significantly
        if (report.summary.overallRating === 'poor' && report.summary.criticalIssues > 0) {
            console.warn('⚠️ Performance degradation detected, triggering strategy review');
            
            if (loadingStrategyEngine) {
                loadingStrategyEngine.forceStrategyUpdate('Performance degradation detected');
            }
        }
        
        // Update UI with performance information
        updatePerformanceIndicators(report);
    }

    /**
     * Handle performance alerts
     */
    function handlePerformanceAlert(alert) {
        console.warn(`⚠️ Performance Alert [${alert.type}]: ${alert.message}`);
        
        // Take action based on alert type
        switch (alert.type) {
            case 'memory-pressure':
            case 'high-memory':
                handleMemoryPressureAlert();
                break;
                
            case 'slow-resource':
            case 'slow-resources':
                handleSlowResourceAlert();
                break;
                
            case 'poor-performance':
                handlePoorPerformanceAlert();
                break;
                
            case 'low-fps':
                handleLowFrameRateAlert();
                break;
        }
        
        // Show user notification for critical alerts
        if (alert.severity === 'error') {
            showPerformanceNotification(alert);
        }
    }

    /**
     * Handle memory pressure events
     */
    function handleMemoryPressure(detail) {
        console.warn('⚠️ Memory pressure detected:', detail);
        
        // Trigger aggressive memory optimization
        if (loadingStrategyEngine) {
            const currentStrategy = loadingStrategyEngine.getCurrentStrategy();
            const optimizedStrategy = {
                ...currentStrategy,
                uiComplexity: 'basic',
                enableAnimations: false,
                lazyLoadImages: true,
                useCodeSplitting: true,
                preloadCritical: false,
                reasoning: [...(currentStrategy.reasoning || []), 'Memory pressure optimization']
            };
            
            loadingStrategyEngine.updateStrategy(optimizedStrategy, 'Memory pressure detected');
        }
        
        // Trigger garbage collection if available
        if (window.gc && typeof window.gc === 'function') {
            try {
                window.gc();
                console.log('🗑️ Manual garbage collection triggered');
            } catch (error) {
                console.warn('Could not trigger garbage collection:', error);
            }
        }
    }

    /**
     * Handle strategy updates
     */
    function handleStrategyUpdate(detail) {
        console.log('🔄 Loading Strategy Updated:', detail.reason);
        console.log('📋 New Strategy:', detail.strategy);
        
        // Apply the new strategy to the application
        applyLoadingStrategy(detail.strategy);
        
        // Update UI indicators
        updateStrategyIndicators(detail.strategy);
        
        // Notify other systems about the strategy change
        notifyStrategyChange(detail);
    }

    /**
     * Handle enhancement changes
     */
    function handleEnhancementChange(detail) {
        console.log('🔍 Progressive Enhancement Changed');
        
        // The loading strategy engine will automatically handle this
        // through its event listeners, but we can add additional logic here
        
        // Update UI based on new capabilities
        updateCapabilityIndicators(detail.capabilities);
    }

    /**
     * Apply loading strategy to the application
     */
    function applyLoadingStrategy(strategy) {
        console.log('🎯 Applying loading strategy:', strategy.templateUsed || 'custom');
        
        // Update document class for CSS targeting
        updateDocumentClasses(strategy);
        
        // Configure resource loading
        configureResourceLoading(strategy);
        
        // Configure UI complexity
        configureUIComplexity(strategy);
        
        // Configure animations
        configureAnimations(strategy);
        
        // Configure accessibility features
        configureAccessibility(strategy);
        
        // Configure service worker
        configureServiceWorker(strategy);
    }

    /**
     * Update document classes based on strategy
     */
    function updateDocumentClasses(strategy) {
        const html = document.documentElement;
        
        // Remove existing strategy classes
        html.classList.remove('strategy-high-performance', 'strategy-balanced', 'strategy-conservative', 'strategy-minimal');
        html.classList.remove('ui-full', 'ui-medium', 'ui-basic');
        html.classList.remove('animations-enabled', 'animations-disabled');
        
        // Add new strategy classes
        if (strategy.templateUsed) {
            html.classList.add(`strategy-${strategy.templateUsed}`);
        }
        
        html.classList.add(`ui-${strategy.uiComplexity}`);
        html.classList.add(strategy.enableAnimations ? 'animations-enabled' : 'animations-disabled');
        
        // Add capability classes
        if (strategy.enableTouchOptimizations) {
            html.classList.add('touch-optimized');
        }
        
        if (strategy.enableHighContrast) {
            html.classList.add('high-contrast');
        }
        
        if (strategy.respectReducedMotion) {
            html.classList.add('reduced-motion');
        }
    }

    /**
     * Configure resource loading based on strategy
     */
    function configureResourceLoading(strategy) {
        // Configure image loading
        if (strategy.lazyLoadImages) {
            enableLazyImageLoading();
        }
        
        // Configure preloading
        if (strategy.preloadCritical) {
            preloadCriticalResources();
        }
        
        // Configure image formats
        if (strategy.useWebP || strategy.useAVIF) {
            configureModernImageFormats(strategy);
        }
        
        // Configure compression
        configureResourceCompression(strategy.compressionLevel);
    }

    /**
     * Configure UI complexity
     */
    function configureUIComplexity(strategy) {
        const complexity = strategy.uiComplexity;
        
        // Determine which UI to load
        if (strategy.useEnhancedUI && (complexity === 'full' || complexity === 'medium')) {
            loadEnhancedUI(complexity);
        } else {
            loadBasicUI();
        }
    }

    /**
     * Configure animations based on strategy
     */
    function configureAnimations(strategy) {
        if (!strategy.enableAnimations || strategy.respectReducedMotion) {
            disableAnimations();
        } else {
            enableAnimations();
        }
    }

    /**
     * Configure accessibility features
     */
    function configureAccessibility(strategy) {
        if (strategy.enableHighContrast) {
            enableHighContrastMode();
        }
        
        if (strategy.respectReducedMotion) {
            respectReducedMotionPreference();
        }
        
        // Ensure touch targets are appropriately sized
        if (strategy.touchTargetSize) {
            configureTouchTargets(strategy.touchTargetSize);
        }
    }

    /**
     * Configure service worker based on strategy
     */
    function configureServiceWorker(strategy) {
        if (strategy.enableServiceWorker && 'serviceWorker' in navigator) {
            registerServiceWorker();
        }
    }

    /**
     * Load enhanced UI
     */
    function loadEnhancedUI(complexity) {
        console.log(`🎨 Loading enhanced UI (${complexity} complexity)...`);
        
        // Load enhanced UI script
        loadScript('./js/enhanced.js')
            .then(() => {
                console.log('✅ Enhanced UI loaded successfully');
                
                // Initialize enhanced UI
                if (window.EnhancedApp) {
                    const enhancedApp = new window.EnhancedApp();
                    enhancedApp.initialize().then(() => {
                        console.log('✅ Enhanced UI initialized');
                        notifyUIReady('enhanced', complexity);
                    });
                }
            })
            .catch((error) => {
                console.warn('⚠️ Failed to load enhanced UI, falling back to basic UI:', error);
                loadBasicUI();
            });
    }

    /**
     * Load basic UI
     */
    function loadBasicUI() {
        console.log('🎨 Loading basic UI...');
        
        // Load basic UI script
        loadScript('./js/basic.js')
            .then(() => {
                console.log('✅ Basic UI loaded successfully');
                
                // Initialize basic UI
                if (window.BasicApp) {
                    const basicApp = new window.BasicApp();
                    basicApp.initialize().then(() => {
                        console.log('✅ Basic UI initialized');
                        notifyUIReady('basic', 'basic');
                    });
                }
            })
            .catch((error) => {
                console.error('❌ Failed to load basic UI:', error);
                showFallbackUI();
            });
    }

    /**
     * Show fallback UI
     */
    function showFallbackUI() {
        console.warn('⚠️ Showing fallback UI');
        
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div class="fallback-ui">
                    <h1>VS Code Web Automation</h1>
                    <p>The application is running in fallback mode due to loading issues.</p>
                    <button onclick="location.reload()">Reload Page</button>
                </div>
            `;
        }
        
        notifyUIReady('fallback', 'minimal');
    }

    /**
     * Enable lazy image loading
     */
    function enableLazyImageLoading() {
        // Add intersection observer for lazy loading
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });
            
            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    /**
     * Preload critical resources
     */
    function preloadCriticalResources() {
        const criticalResources = [
            './js/enhanced.js',
            './styles/enhanced-main.css',
            './assets/icons/icon.svg'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            
            if (resource.endsWith('.js')) {
                link.as = 'script';
            } else if (resource.endsWith('.css')) {
                link.as = 'style';
            } else if (resource.includes('icon')) {
                link.as = 'image';
            }
            
            document.head.appendChild(link);
        });
    }

    /**
     * Configure modern image formats
     */
    function configureModernImageFormats(strategy) {
        // This would typically involve updating image sources
        // to use WebP or AVIF formats when supported
        console.log('🖼️ Configuring modern image formats:', {
            webP: strategy.useWebP,
            avif: strategy.useAVIF
        });
    }

    /**
     * Configure resource compression
     */
    function configureResourceCompression(level) {
        // This would typically involve setting headers or
        // choosing different resource variants
        console.log('🗜️ Configuring resource compression level:', level);
    }

    /**
     * Disable animations
     */
    function disableAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Enable animations
     */
    function enableAnimations() {
        // Remove any animation-disabling styles
        const disableStyles = document.querySelectorAll('style[data-disable-animations]');
        disableStyles.forEach(style => style.remove());
    }

    /**
     * Enable high contrast mode
     */
    function enableHighContrastMode() {
        document.documentElement.classList.add('high-contrast-mode');
    }

    /**
     * Respect reduced motion preference
     */
    function respectReducedMotionPreference() {
        document.documentElement.classList.add('respect-reduced-motion');
    }

    /**
     * Configure touch targets
     */
    function configureTouchTargets(minSize) {
        const style = document.createElement('style');
        style.textContent = `
            button, .interactive, input, select, textarea, a {
                min-height: ${minSize}px;
                min-width: ${minSize}px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Register service worker
     */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registered:', registration);
                })
                .catch(error => {
                    console.warn('⚠️ Service Worker registration failed:', error);
                });
        }
    }

    /**
     * Load script dynamically
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Update loading progress
     */
    function updateLoadingProgress(message, percentage) {
        const loadingText = document.getElementById('loadingText');
        const progressBar = document.querySelector('.progress-bar');
        
        if (loadingText) {
            loadingText.textContent = message;
        }
        
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        console.log(`📊 Loading Progress: ${percentage}% - ${message}`);
    }

    /**
     * Hide loading screen
     */
    function hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Handle initialization failure
     */
    function handleInitializationFailure(error) {
        console.error('💥 Progressive Enhancement initialization failed:', error);
        
        // Update loading screen with error
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = 'Initialization failed, loading basic interface...';
        }
        
        // Fall back to basic UI after a delay
        setTimeout(() => {
            loadBasicUI();
        }, 1000);
    }

    /**
     * Notify about initialization completion
     */
    function notifyInitializationComplete(enhancementDecision) {
        const event = new CustomEvent('progressive-enhancement-ready', {
            detail: {
                enhancementDecision,
                timestamp: Date.now(),
                systems: {
                    progressiveEnhancement: !!progressiveEnhancementSystem,
                    loadingStrategy: !!loadingStrategyEngine,
                    performanceMonitoring: !!performanceMonitoringService
                }
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Notify about UI readiness
     */
    function notifyUIReady(uiType, complexity) {
        const event = new CustomEvent('ui-ready', {
            detail: {
                uiType,
                complexity,
                timestamp: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Notify about strategy changes
     */
    function notifyStrategyChange(detail) {
        const event = new CustomEvent('strategy-applied', {
            detail: {
                ...detail,
                appliedAt: Date.now()
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Update performance indicators in UI
     */
    function updatePerformanceIndicators(report) {
        // This would update UI elements showing performance status
        console.log('📊 Updating performance indicators:', report.summary);
    }

    /**
     * Update strategy indicators in UI
     */
    function updateStrategyIndicators(strategy) {
        // This would update UI elements showing current strategy
        console.log('🎯 Updating strategy indicators:', strategy.templateUsed);
    }

    /**
     * Update capability indicators in UI
     */
    function updateCapabilityIndicators(capabilities) {
        // This would update UI elements showing detected capabilities
        console.log('🔍 Updating capability indicators');
    }

    /**
     * Handle specific performance alert types
     */
    function handleMemoryPressureAlert() {
        console.warn('🧠 Handling memory pressure alert');
        // Trigger memory cleanup
    }

    function handleSlowResourceAlert() {
        console.warn('🐌 Handling slow resource alert');
        // Optimize resource loading
    }

    function handlePoorPerformanceAlert() {
        console.warn('📉 Handling poor performance alert');
        // Reduce UI complexity
    }

    function handleLowFrameRateAlert() {
        console.warn('🎬 Handling low frame rate alert');
        // Disable animations
    }

    /**
     * Show performance notification to user
     */
    function showPerformanceNotification(alert) {
        // This would show a user-facing notification
        console.log('🔔 Performance notification:', alert.message);
    }

    /**
     * Get current enhancement decision
     */
    function getEnhancementDecision() {
        if (progressiveEnhancementSystem) {
            return progressiveEnhancementSystem.getEnhancementDecision();
        }
        return null;
    }

    /**
     * Get current loading strategy
     */
    function getCurrentStrategy() {
        if (loadingStrategyEngine) {
            return loadingStrategyEngine.getCurrentStrategy();
        }
        return null;
    }

    /**
     * Get current performance metrics
     */
    function getCurrentMetrics() {
        if (performanceMonitoringService) {
            return performanceMonitoringService.getCurrentMetrics();
        }
        return null;
    }

    // Public API
    window.ProgressiveEnhancementAPI = {
        initialize: initializeProgressiveEnhancement,
        getEnhancementDecision,
        getCurrentStrategy,
        getCurrentMetrics,
        isInitialized: () => isInitialized,
        
        // System references (for debugging)
        systems: {
            get progressiveEnhancement() { return progressiveEnhancementSystem; },
            get loadingStrategy() { return loadingStrategyEngine; },
            get performanceMonitoring() { return performanceMonitoringService; }
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProgressiveEnhancement);
    } else {
        // DOM is already ready
        initializeProgressiveEnhancement();
    }

})();