/**
 * Progressive Enhancement Detection System
 * Implements comprehensive feature detection, network assessment, and performance monitoring
 * to determine optimal loading strategy and UI enhancement level
 */

class ProgressiveEnhancement {
    constructor() {
        this.capabilities = {};
        this.networkConditions = {};
        this.performanceMetrics = {};
        this.loadingStrategy = {};
        this.observers = [];
        this.isInitialized = false;
        
        // Configuration
        this.config = {
            // Performance thresholds
            performance: {
                slowDeviceThreshold: 2000, // ms for initial load
                lowMemoryThreshold: 1000000000, // 1GB in bytes
                highLatencyThreshold: 500, // ms
                lowBandwidthThreshold: 1.5 // Mbps
            },
            
            // Feature detection timeouts
            timeouts: {
                featureDetection: 5000,
                networkAssessment: 3000,
                performanceBaseline: 2000
            },
            
            // Update intervals
            intervals: {
                networkMonitoring: 30000, // 30 seconds
                performanceMonitoring: 10000, // 10 seconds
                capabilityRecheck: 60000 // 1 minute
            }
        };
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Bind methods
        this.handleNetworkChange = this.handleNetworkChange.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleMemoryWarning = this.handleMemoryWarning.bind(this);
    }

    /**
     * Initialize the progressive enhancement system
     */
    async initialize() {
        if (this.isInitialized) {
            return this.getEnhancementDecision();
        }

        console.log('🔍 Initializing Progressive Enhancement Detection System...');
        
        try {
            // Run all detection systems in parallel
            const detectionPromises = [
                this.detectDeviceCapabilities(),
                this.assessNetworkConditions(),
                this.establishPerformanceBaseline()
            ];

            await Promise.allSettled(detectionPromises);
            
            // Determine loading strategy based on collected data
            this.determineLoadingStrategy();
            
            // Set up continuous monitoring
            this.setupContinuousMonitoring();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            
            console.log('✅ Progressive Enhancement Detection System initialized');
            console.log('📊 Enhancement Decision:', this.getEnhancementDecision());
            
            return this.getEnhancementDecision();
            
        } catch (error) {
            console.error('❌ Failed to initialize Progressive Enhancement system:', error);
            
            // Fallback to safe defaults
            this.setFallbackStrategy();
            return this.getEnhancementDecision();
        }
    }

    /**
     * Detect device capabilities
     */
    async detectDeviceCapabilities() {
        console.log('🔍 Detecting device capabilities...');
        
        const capabilities = {
            // Touch support
            touchSupport: this.detectTouchSupport(),
            
            // Display capabilities
            highDPI: this.detectHighDPI(),
            colorGamut: this.detectColorGamut(),
            hdr: this.detectHDRSupport(),
            
            // Graphics capabilities
            webGL: this.detectWebGLSupport(),
            webGL2: this.detectWebGL2Support(),
            canvas: this.detectCanvasSupport(),
            
            // Modern web features
            serviceWorker: this.detectServiceWorkerSupport(),
            webAssembly: this.detectWebAssemblySupport(),
            intersectionObserver: this.detectIntersectionObserver(),
            resizeObserver: this.detectResizeObserver(),
            mutationObserver: this.detectMutationObserver(),
            
            // Storage capabilities
            localStorage: this.detectLocalStorageSupport(),
            sessionStorage: this.detectSessionStorageSupport(),
            indexedDB: this.detectIndexedDBSupport(),
            
            // Network features
            fetch: this.detectFetchSupport(),
            webSockets: this.detectWebSocketSupport(),
            webRTC: this.detectWebRTCSupport(),
            
            // Media capabilities
            webP: await this.detectWebPSupport(),
            avif: await this.detectAVIFSupport(),
            webm: this.detectWebMSupport(),
            
            // CSS features
            cssGrid: this.detectCSSGridSupport(),
            cssFlexbox: this.detectCSSFlexboxSupport(),
            cssCustomProperties: this.detectCSSCustomPropertiesSupport(),
            cssContainerQueries: this.detectCSSContainerQueriesSupport(),
            
            // JavaScript features
            es6Modules: this.detectES6ModulesSupport(),
            asyncAwait: this.detectAsyncAwaitSupport(),
            webComponents: this.detectWebComponentsSupport(),
            
            // Hardware access
            deviceMotion: this.detectDeviceMotionSupport(),
            deviceOrientation: this.detectDeviceOrientationSupport(),
            vibration: this.detectVibrationSupport(),
            
            // Performance features
            performanceObserver: this.detectPerformanceObserverSupport(),
            performanceTiming: this.detectPerformanceTimingSupport(),
            
            // Accessibility features
            reducedMotion: this.detectReducedMotionPreference(),
            highContrast: this.detectHighContrastPreference(),
            forcedColors: this.detectForcedColorsPreference()
        };

        // Detect hardware specifications
        capabilities.hardware = await this.detectHardwareSpecs();
        
        this.capabilities = capabilities;
        console.log('✅ Device capabilities detected:', capabilities);
        
        return capabilities;
    }

    /**
     * Assess network conditions
     */
    async assessNetworkConditions() {
        console.log('🌐 Assessing network conditions...');
        
        const networkConditions = {
            // Connection information
            connectionType: this.getConnectionType(),
            effectiveType: this.getEffectiveConnectionType(),
            downlink: this.getDownlinkSpeed(),
            rtt: this.getRoundTripTime(),
            saveData: this.getSaveDataPreference(),
            
            // Network quality assessment
            quality: 'unknown',
            stability: 'unknown',
            latency: 'unknown',
            bandwidth: 'unknown'
        };

        // Perform network quality tests
        try {
            const qualityTests = await Promise.allSettled([
                this.measureNetworkLatency(),
                this.measureBandwidthCapacity(),
                this.assessNetworkStability()
            ]);

            if (qualityTests[0].status === 'fulfilled') {
                networkConditions.measuredLatency = qualityTests[0].value;
                networkConditions.latency = this.categorizeLatency(qualityTests[0].value);
            }

            if (qualityTests[1].status === 'fulfilled') {
                networkConditions.measuredBandwidth = qualityTests[1].value;
                networkConditions.bandwidth = this.categorizeBandwidth(qualityTests[1].value);
            }

            if (qualityTests[2].status === 'fulfilled') {
                networkConditions.stability = qualityTests[2].value;
            }

            // Determine overall network quality
            networkConditions.quality = this.determineNetworkQuality(networkConditions);
            
        } catch (error) {
            console.warn('⚠️ Network quality assessment failed:', error);
            networkConditions.quality = 'poor';
        }

        this.networkConditions = networkConditions;
        console.log('✅ Network conditions assessed:', networkConditions);
        
        return networkConditions;
    }

    /**
     * Establish performance baseline
     */
    async establishPerformanceBaseline() {
        console.log('⚡ Establishing performance baseline...');
        
        const performanceMetrics = {
            // Core Web Vitals
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            firstInputDelay: 0,
            cumulativeLayoutShift: 0,
            
            // Custom metrics
            timeToInteractive: 0,
            totalBlockingTime: 0,
            speedIndex: 0,
            
            // Device performance indicators
            deviceMemory: this.getDeviceMemory(),
            hardwareConcurrency: this.getHardwareConcurrency(),
            
            // Runtime performance
            jsHeapSize: this.getJSHeapSize(),
            domNodes: this.getDOMNodeCount(),
            
            // Timing metrics
            navigationTiming: this.getNavigationTiming(),
            resourceTiming: this.getResourceTiming(),
            
            // Performance score
            performanceScore: 0,
            deviceClass: 'unknown'
        };

        // Measure Core Web Vitals
        try {
            const webVitals = await this.measureCoreWebVitals();
            Object.assign(performanceMetrics, webVitals);
        } catch (error) {
            console.warn('⚠️ Core Web Vitals measurement failed:', error);
        }

        // Run performance benchmarks
        try {
            const benchmarks = await this.runPerformanceBenchmarks();
            performanceMetrics.benchmarkResults = benchmarks;
            performanceMetrics.performanceScore = this.calculatePerformanceScore(benchmarks);
            performanceMetrics.deviceClass = this.classifyDevice(performanceMetrics);
        } catch (error) {
            console.warn('⚠️ Performance benchmarks failed:', error);
            performanceMetrics.deviceClass = 'low-end';
        }

        this.performanceMetrics = performanceMetrics;
        console.log('✅ Performance baseline established:', performanceMetrics);
        
        return performanceMetrics;
    }

    /**
     * Determine optimal loading strategy
     */
    determineLoadingStrategy() {
        console.log('🎯 Determining optimal loading strategy...');
        
        const strategy = {
            // UI enhancement level
            useEnhancedUI: true,
            uiComplexity: 'full', // full, medium, basic
            
            // Resource loading
            lazyLoadImages: true,
            preloadCritical: true,
            enableAnimations: true,
            useWebP: false,
            useAVIF: false,
            
            // Performance optimizations
            enableServiceWorker: true,
            useCodeSplitting: true,
            enablePrefetch: true,
            
            // Network optimizations
            adaptiveLoading: true,
            compressionLevel: 'high',
            
            // Accessibility
            respectReducedMotion: false,
            enableHighContrast: false,
            
            // Reasoning for decisions
            reasoning: []
        };

        // Analyze device capabilities
        if (!this.capabilities.serviceWorker) {
            strategy.enableServiceWorker = false;
            strategy.reasoning.push('Service Worker not supported');
        }

        if (!this.capabilities.webP) {
            strategy.useWebP = false;
        } else {
            strategy.useWebP = true;
            strategy.reasoning.push('WebP support detected');
        }

        if (this.capabilities.avif) {
            strategy.useAVIF = true;
            strategy.reasoning.push('AVIF support detected');
        }

        if (this.capabilities.reducedMotion) {
            strategy.respectReducedMotion = true;
            strategy.enableAnimations = false;
            strategy.reasoning.push('Reduced motion preference detected');
        }

        if (this.capabilities.highContrast) {
            strategy.enableHighContrast = true;
            strategy.reasoning.push('High contrast preference detected');
        }

        // Analyze network conditions
        if (this.networkConditions.saveData || this.networkConditions.quality === 'poor') {
            strategy.uiComplexity = 'basic';
            strategy.enableAnimations = false;
            strategy.lazyLoadImages = true;
            strategy.compressionLevel = 'maximum';
            strategy.reasoning.push('Poor network conditions or save-data preference');
        }

        if (this.networkConditions.effectiveType === '2g' || this.networkConditions.effectiveType === 'slow-2g') {
            strategy.useEnhancedUI = false;
            strategy.uiComplexity = 'basic';
            strategy.enablePrefetch = false;
            strategy.reasoning.push('Very slow network detected');
        }

        // Analyze performance metrics
        if (this.performanceMetrics.deviceClass === 'low-end') {
            strategy.uiComplexity = 'medium';
            strategy.enableAnimations = false;
            strategy.useCodeSplitting = true;
            strategy.reasoning.push('Low-end device detected');
        }

        if (this.performanceMetrics.deviceMemory && this.performanceMetrics.deviceMemory < 2) {
            strategy.uiComplexity = 'basic';
            strategy.useCodeSplitting = true;
            strategy.reasoning.push('Low memory device detected');
        }

        // Final adjustments based on combined factors
        if (strategy.uiComplexity === 'basic' && this.networkConditions.quality === 'poor') {
            strategy.useEnhancedUI = false;
            strategy.reasoning.push('Combined poor performance and network conditions');
        }

        this.loadingStrategy = strategy;
        console.log('✅ Loading strategy determined:', strategy);
        
        return strategy;
    }

    /**
     * Get the final enhancement decision
     */
    getEnhancementDecision() {
        return {
            capabilities: this.capabilities,
            networkConditions: this.networkConditions,
            performanceMetrics: this.performanceMetrics,
            loadingStrategy: this.loadingStrategy,
            timestamp: Date.now(),
            version: '1.0.0'
        };
    }

    // Feature Detection Methods
    detectTouchSupport() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }

    detectHighDPI() {
        return window.devicePixelRatio > 1;
    }

    detectColorGamut() {
        if (window.matchMedia) {
            if (window.matchMedia('(color-gamut: p3)').matches) return 'p3';
            if (window.matchMedia('(color-gamut: srgb)').matches) return 'srgb';
            if (window.matchMedia('(color-gamut: rec2020)').matches) return 'rec2020';
        }
        return 'unknown';
    }

    detectHDRSupport() {
        return window.matchMedia && window.matchMedia('(dynamic-range: high)').matches;
    }

    detectWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    detectWebGL2Support() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch (e) {
            return false;
        }
    }

    detectCanvasSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        } catch (e) {
            return false;
        }
    }

    detectServiceWorkerSupport() {
        return 'serviceWorker' in navigator;
    }

    detectWebAssemblySupport() {
        return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    }

    detectIntersectionObserver() {
        return 'IntersectionObserver' in window;
    }

    detectResizeObserver() {
        return 'ResizeObserver' in window;
    }

    detectMutationObserver() {
        return 'MutationObserver' in window;
    }

    detectLocalStorageSupport() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    detectSessionStorageSupport() {
        try {
            const test = 'test';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    detectIndexedDBSupport() {
        return 'indexedDB' in window;
    }

    detectFetchSupport() {
        return 'fetch' in window;
    }

    detectWebSocketSupport() {
        return 'WebSocket' in window;
    }

    detectWebRTCSupport() {
        return 'RTCPeerConnection' in window || 'webkitRTCPeerConnection' in window || 'mozRTCPeerConnection' in window;
    }

    async detectWebPSupport() {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => resolve(webP.height === 2);
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    async detectAVIFSupport() {
        return new Promise((resolve) => {
            const avif = new Image();
            avif.onload = avif.onerror = () => resolve(avif.height === 2);
            avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
        });
    }

    detectWebMSupport() {
        const video = document.createElement('video');
        return video.canPlayType('video/webm; codecs="vp8, vorbis"') !== '';
    }

    detectCSSGridSupport() {
        return CSS.supports('display', 'grid');
    }

    detectCSSFlexboxSupport() {
        return CSS.supports('display', 'flex');
    }

    detectCSSCustomPropertiesSupport() {
        return CSS.supports('color', 'var(--test)');
    }

    detectCSSContainerQueriesSupport() {
        return CSS.supports('container-type', 'inline-size');
    }

    detectES6ModulesSupport() {
        try {
            return typeof Symbol !== 'undefined' && typeof Symbol.iterator !== 'undefined';
        } catch (e) {
            return false;
        }
    }

    detectAsyncAwaitSupport() {
        try {
            return (async () => {})().constructor === Promise;
        } catch (e) {
            return false;
        }
    }

    detectWebComponentsSupport() {
        return 'customElements' in window && 'attachShadow' in Element.prototype;
    }

    detectDeviceMotionSupport() {
        return 'DeviceMotionEvent' in window;
    }

    detectDeviceOrientationSupport() {
        return 'DeviceOrientationEvent' in window;
    }

    detectVibrationSupport() {
        return 'vibrate' in navigator;
    }

    detectPerformanceObserverSupport() {
        return 'PerformanceObserver' in window;
    }

    detectPerformanceTimingSupport() {
        return 'performance' in window && 'timing' in performance;
    }

    detectReducedMotionPreference() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    detectHighContrastPreference() {
        return window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches;
    }

    detectForcedColorsPreference() {
        return window.matchMedia && window.matchMedia('(forced-colors: active)').matches;
    }

    // Hardware Detection Methods
    async detectHardwareSpecs() {
        const hardware = {
            deviceMemory: this.getDeviceMemory(),
            hardwareConcurrency: this.getHardwareConcurrency(),
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            vendor: navigator.vendor,
            maxTouchPoints: navigator.maxTouchPoints || 0
        };

        // Detect GPU information if available
        if (this.capabilities.webGL) {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        hardware.gpu = {
                            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
                        };
                    }
                }
            } catch (e) {
                console.warn('Could not detect GPU information:', e);
            }
        }

        return hardware;
    }

    // Network Assessment Methods
    getConnectionType() {
        return navigator.connection?.type || 'unknown';
    }

    getEffectiveConnectionType() {
        return navigator.connection?.effectiveType || 'unknown';
    }

    getDownlinkSpeed() {
        return navigator.connection?.downlink || 0;
    }

    getRoundTripTime() {
        return navigator.connection?.rtt || 0;
    }

    getSaveDataPreference() {
        return navigator.connection?.saveData || false;
    }

    async measureNetworkLatency() {
        const start = performance.now();
        try {
            // Use a small image to measure latency
            await fetch('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            return performance.now() - start;
        } catch (error) {
            return this.config.performance.highLatencyThreshold;
        }
    }

    async measureBandwidthCapacity() {
        // Simple bandwidth test using a small resource
        const testSize = 1024; // 1KB
        const start = performance.now();
        
        try {
            const response = await fetch('data:application/octet-stream;base64,' + 'A'.repeat(testSize), {
                cache: 'no-cache'
            });
            await response.blob();
            const duration = (performance.now() - start) / 1000; // seconds
            return (testSize * 8) / duration / 1000; // Kbps
        } catch (error) {
            return 0;
        }
    }

    async assessNetworkStability() {
        // Perform multiple small requests to assess stability
        const requests = 3;
        const results = [];
        
        for (let i = 0; i < requests; i++) {
            const start = performance.now();
            try {
                await fetch('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', {
                    method: 'HEAD',
                    cache: 'no-cache'
                });
                results.push(performance.now() - start);
            } catch (error) {
                results.push(1000); // High penalty for failed requests
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Calculate coefficient of variation
        const mean = results.reduce((a, b) => a + b, 0) / results.length;
        const variance = results.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / results.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean;
        
        if (cv < 0.2) return 'stable';
        if (cv < 0.5) return 'moderate';
        return 'unstable';
    }

    categorizeLatency(latency) {
        if (latency < 100) return 'excellent';
        if (latency < 200) return 'good';
        if (latency < 500) return 'fair';
        return 'poor';
    }

    categorizeBandwidth(bandwidth) {
        if (bandwidth > 10000) return 'excellent'; // >10 Mbps
        if (bandwidth > 5000) return 'good';       // >5 Mbps
        if (bandwidth > 1500) return 'fair';       // >1.5 Mbps
        return 'poor';
    }

    determineNetworkQuality(conditions) {
        const scores = {
            excellent: 4,
            good: 3,
            fair: 2,
            poor: 1
        };
        
        const latencyScore = scores[conditions.latency] || 1;
        const bandwidthScore = scores[conditions.bandwidth] || 1;
        const stabilityScore = conditions.stability === 'stable' ? 4 : 
                              conditions.stability === 'moderate' ? 2 : 1;
        
        const averageScore = (latencyScore + bandwidthScore + stabilityScore) / 3;
        
        if (averageScore >= 3.5) return 'excellent';
        if (averageScore >= 2.5) return 'good';
        if (averageScore >= 1.5) return 'fair';
        return 'poor';
    }

    // Performance Measurement Methods
    getDeviceMemory() {
        return navigator.deviceMemory || 0;
    }

    getHardwareConcurrency() {
        return navigator.hardwareConcurrency || 1;
    }

    getJSHeapSize() {
        return performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        } : null;
    }

    getDOMNodeCount() {
        return document.querySelectorAll('*').length;
    }

    getNavigationTiming() {
        if (!performance.timing) return null;
        
        const timing = performance.timing;
        return {
            domainLookup: timing.domainLookupEnd - timing.domainLookupStart,
            connection: timing.connectEnd - timing.connectStart,
            request: timing.responseStart - timing.requestStart,
            response: timing.responseEnd - timing.responseStart,
            domProcessing: timing.domComplete - timing.domLoading,
            loadComplete: timing.loadEventEnd - timing.navigationStart
        };
    }

    getResourceTiming() {
        if (!performance.getEntriesByType) return [];
        
        return performance.getEntriesByType('resource').map(entry => ({
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize || 0,
            type: entry.initiatorType
        }));
    }

    async measureCoreWebVitals() {
        const vitals = {
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            firstInputDelay: 0,
            cumulativeLayoutShift: 0
        };

        // Use Performance Observer if available
        if ('PerformanceObserver' in window) {
            return new Promise((resolve) => {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        switch (entry.entryType) {
                            case 'paint':
                                if (entry.name === 'first-contentful-paint') {
                                    vitals.firstContentfulPaint = entry.startTime;
                                }
                                break;
                            case 'largest-contentful-paint':
                                vitals.largestContentfulPaint = entry.startTime;
                                break;
                            case 'first-input':
                                vitals.firstInputDelay = entry.processingStart - entry.startTime;
                                break;
                            case 'layout-shift':
                                if (!entry.hadRecentInput) {
                                    vitals.cumulativeLayoutShift += entry.value;
                                }
                                break;
                        }
                    }
                });

                try {
                    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
                    
                    // Resolve after a reasonable timeout
                    setTimeout(() => {
                        observer.disconnect();
                        resolve(vitals);
                    }, this.config.timeouts.performanceBaseline);
                } catch (error) {
                    resolve(vitals);
                }
            });
        }

        return vitals;
    }

    async runPerformanceBenchmarks() {
        const benchmarks = {
            jsExecution: 0,
            domManipulation: 0,
            memoryAllocation: 0,
            renderingPerformance: 0
        };

        // JavaScript execution benchmark
        const jsStart = performance.now();
        for (let i = 0; i < 100000; i++) {
            Math.random() * Math.random();
        }
        benchmarks.jsExecution = performance.now() - jsStart;

        // DOM manipulation benchmark
        const domStart = performance.now();
        const testDiv = document.createElement('div');
        document.body.appendChild(testDiv);
        for (let i = 0; i < 1000; i++) {
            const span = document.createElement('span');
            span.textContent = `Test ${i}`;
            testDiv.appendChild(span);
        }
        document.body.removeChild(testDiv);
        benchmarks.domManipulation = performance.now() - domStart;

        // Memory allocation benchmark
        const memStart = performance.now();
        const arrays = [];
        for (let i = 0; i < 1000; i++) {
            arrays.push(new Array(1000).fill(i));
        }
        benchmarks.memoryAllocation = performance.now() - memStart;

        // Rendering performance benchmark (if canvas is supported)
        if (this.capabilities.canvas) {
            const renderStart = performance.now();
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            
            for (let i = 0; i < 1000; i++) {
                ctx.fillStyle = `hsl(${i % 360}, 50%, 50%)`;
                ctx.fillRect(i % 200, (i * 2) % 200, 5, 5);
            }
            
            benchmarks.renderingPerformance = performance.now() - renderStart;
        }

        return benchmarks;
    }

    calculatePerformanceScore(benchmarks) {
        // Normalize benchmark results to a 0-100 score
        const weights = {
            jsExecution: 0.3,
            domManipulation: 0.3,
            memoryAllocation: 0.2,
            renderingPerformance: 0.2
        };

        // Reference values for scoring (lower is better)
        const references = {
            jsExecution: 50,      // 50ms for JS benchmark
            domManipulation: 100, // 100ms for DOM benchmark
            memoryAllocation: 30, // 30ms for memory benchmark
            renderingPerformance: 20 // 20ms for rendering benchmark
        };

        let totalScore = 0;
        let totalWeight = 0;

        for (const [metric, value] of Object.entries(benchmarks)) {
            if (references[metric] && weights[metric]) {
                const score = Math.max(0, 100 - (value / references[metric]) * 100);
                totalScore += score * weights[metric];
                totalWeight += weights[metric];
            }
        }

        return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
    }

    classifyDevice(metrics) {
        const score = metrics.performanceScore;
        const memory = metrics.deviceMemory || 2;
        const cores = metrics.hardwareConcurrency || 2;

        // High-end device criteria
        if (score >= 80 && memory >= 8 && cores >= 8) {
            return 'high-end';
        }

        // Mid-range device criteria
        if (score >= 60 && memory >= 4 && cores >= 4) {
            return 'mid-range';
        }

        // Low-end device criteria
        if (score < 40 || memory < 2 || cores < 2) {
            return 'low-end';
        }

        return 'mid-range'; // Default fallback
    }

    // Continuous Monitoring Methods
    setupContinuousMonitoring() {
        // Network monitoring
        if (navigator.connection) {
            this.monitoringIntervals = {
                network: setInterval(() => {
                    this.updateNetworkConditions();
                }, this.config.intervals.networkMonitoring),
                
                performance: setInterval(() => {
                    this.updatePerformanceMetrics();
                }, this.config.intervals.performanceMonitoring),
                
                capabilities: setInterval(() => {
                    this.recheckCapabilities();
                }, this.config.intervals.capabilityRecheck)
            };
        }
    }

    setupEventListeners() {
        // Network change events
        if (navigator.connection) {
            navigator.connection.addEventListener('change', this.handleNetworkChange);
        }

        // Visibility change events
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Memory pressure events
        if ('memory' in performance) {
            // Monitor memory usage
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
                    this.handleMemoryWarning();
                }
            }, 5000);
        }
    }

    handleNetworkChange() {
        console.log('🌐 Network conditions changed, reassessing...');
        this.assessNetworkConditions().then(() => {
            this.determineLoadingStrategy();
            this.notifyStrategyChange();
        });
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, reduce monitoring frequency
            this.pauseMonitoring();
        } else {
            // Page is visible, resume normal monitoring
            this.resumeMonitoring();
        }
    }

    handleMemoryWarning() {
        console.warn('⚠️ High memory usage detected, adjusting strategy...');
        
        // Adjust strategy for memory constraints
        this.loadingStrategy.uiComplexity = 'basic';
        this.loadingStrategy.enableAnimations = false;
        this.loadingStrategy.useCodeSplitting = true;
        this.loadingStrategy.reasoning.push('High memory usage detected');
        
        this.notifyStrategyChange();
    }

    updateNetworkConditions() {
        const newConditions = {
            connectionType: this.getConnectionType(),
            effectiveType: this.getEffectiveConnectionType(),
            downlink: this.getDownlinkSpeed(),
            rtt: this.getRoundTripTime(),
            saveData: this.getSaveDataPreference()
        };

        // Check if conditions have changed significantly
        const hasChanged = Object.keys(newConditions).some(key => 
            this.networkConditions[key] !== newConditions[key]
        );

        if (hasChanged) {
            Object.assign(this.networkConditions, newConditions);
            this.determineLoadingStrategy();
            this.notifyStrategyChange();
        }
    }

    updatePerformanceMetrics() {
        // Update runtime performance metrics
        const newMetrics = {
            jsHeapSize: this.getJSHeapSize(),
            domNodes: this.getDOMNodeCount()
        };

        Object.assign(this.performanceMetrics, newMetrics);
    }

    recheckCapabilities() {
        // Recheck capabilities that might change at runtime
        const newCapabilities = {
            reducedMotion: this.detectReducedMotionPreference(),
            highContrast: this.detectHighContrastPreference(),
            forcedColors: this.detectForcedColorsPreference()
        };

        const hasChanged = Object.keys(newCapabilities).some(key => 
            this.capabilities[key] !== newCapabilities[key]
        );

        if (hasChanged) {
            Object.assign(this.capabilities, newCapabilities);
            this.determineLoadingStrategy();
            this.notifyStrategyChange();
        }
    }

    pauseMonitoring() {
        if (this.monitoringIntervals) {
            Object.values(this.monitoringIntervals).forEach(interval => {
                clearInterval(interval);
            });
        }
    }

    resumeMonitoring() {
        this.setupContinuousMonitoring();
    }

    notifyStrategyChange() {
        // Dispatch custom event for strategy changes
        const event = new CustomEvent('progressive-enhancement-change', {
            detail: this.getEnhancementDecision()
        });
        document.dispatchEvent(event);
    }

    // Fallback Methods
    setFallbackStrategy() {
        console.warn('⚠️ Using fallback progressive enhancement strategy');
        
        this.capabilities = {
            touchSupport: this.detectTouchSupport(),
            serviceWorker: this.detectServiceWorkerSupport(),
            localStorage: this.detectLocalStorageSupport(),
            fetch: this.detectFetchSupport(),
            webSockets: this.detectWebSocketSupport()
        };

        this.networkConditions = {
            quality: 'poor',
            effectiveType: '3g',
            saveData: false
        };

        this.performanceMetrics = {
            deviceClass: 'low-end',
            performanceScore: 30
        };

        this.loadingStrategy = {
            useEnhancedUI: false,
            uiComplexity: 'basic',
            lazyLoadImages: true,
            preloadCritical: false,
            enableAnimations: false,
            enableServiceWorker: this.capabilities.serviceWorker,
            reasoning: ['Fallback strategy due to detection failure']
        };
    }

    // Cleanup Methods
    destroy() {
        console.log('🧹 Cleaning up Progressive Enhancement Detection System...');
        
        // Clear monitoring intervals
        if (this.monitoringIntervals) {
            Object.values(this.monitoringIntervals).forEach(interval => {
                clearInterval(interval);
            });
        }

        // Remove event listeners
        if (navigator.connection) {
            navigator.connection.removeEventListener('change', this.handleNetworkChange);
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // Clear observers
        this.observers.forEach(observer => {
            if (observer.disconnect) {
                observer.disconnect();
            }
        });

        // Clear references
        this.capabilities = {};
        this.networkConditions = {};
        this.performanceMetrics = {};
        this.loadingStrategy = {};
        this.observers = [];
        this.eventListeners.clear();
        
        this.isInitialized = false;
        
        console.log('✅ Progressive Enhancement Detection System cleanup completed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressiveEnhancement;
}

// Make available globally for non-module environments
if (typeof window !== 'undefined') {
    window.ProgressiveEnhancement = ProgressiveEnhancement;
}