/**
 * Performance Monitoring Service
 * Comprehensive performance monitoring and metrics collection
 * for progressive enhancement and loading strategy optimization
 */

class PerformanceMonitoringService {
    constructor() {
        this.isInitialized = false;
        this.observers = [];
        this.metrics = new Map();
        this.thresholds = new Map();
        this.alerts = [];
        this.reportingCallbacks = new Set();
        
        // Configuration
        this.config = {
            // Core Web Vitals thresholds (good/needs improvement/poor)
            coreWebVitals: {
                firstContentfulPaint: { good: 1800, poor: 3000 },
                largestContentfulPaint: { good: 2500, poor: 4000 },
                firstInputDelay: { good: 100, poor: 300 },
                cumulativeLayoutShift: { good: 0.1, poor: 0.25 },
                timeToInteractive: { good: 3800, poor: 7300 }
            },
            
            // Custom performance thresholds
            customMetrics: {
                jsHeapSize: { good: 50000000, poor: 100000000 }, // 50MB / 100MB
                domNodes: { good: 1500, poor: 3000 },
                resourceCount: { good: 50, poor: 100 },
                totalResourceSize: { good: 2000000, poor: 5000000 }, // 2MB / 5MB
                averageResourceLoadTime: { good: 500, poor: 1500 }
            },
            
            // Monitoring intervals
            intervals: {
                continuousMonitoring: 5000, // 5 seconds
                memoryCheck: 10000, // 10 seconds
                resourceMonitoring: 15000, // 15 seconds
                reportGeneration: 60000 // 1 minute
            },
            
            // Data retention
            retention: {
                maxMetricEntries: 100,
                maxAlerts: 50,
                maxReports: 20
            }
        };
        
        // Performance data storage
        this.performanceData = {
            coreWebVitals: [],
            customMetrics: [],
            resourceTiming: [],
            userTiming: [],
            navigationTiming: [],
            memoryUsage: [],
            networkMetrics: []
        };
        
        // Bind methods
        this.handlePerformanceEntry = this.handlePerformanceEntry.bind(this);
        this.handleMemoryWarning = this.handleMemoryWarning.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    /**
     * Initialize the performance monitoring service
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        console.log('📊 Initializing Performance Monitoring Service...');
        
        try {
            // Set up performance observers
            this.setupPerformanceObservers();
            
            // Set up custom metric collection
            this.setupCustomMetrics();
            
            // Set up continuous monitoring
            this.setupContinuousMonitoring();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Collect initial baseline metrics
            await this.collectBaselineMetrics();
            
            this.isInitialized = true;
            console.log('✅ Performance Monitoring Service initialized');
            
            // Generate initial report
            this.generatePerformanceReport();
            
        } catch (error) {
            console.error('❌ Failed to initialize Performance Monitoring Service:', error);
            throw error;
        }
    }

    /**
     * Set up performance observers for different entry types
     */
    setupPerformanceObservers() {
        if (!('PerformanceObserver' in window)) {
            console.warn('⚠️ PerformanceObserver not supported');
            return;
        }

        // Core Web Vitals observer
        try {
            const coreWebVitalsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processCoreWebVitalEntry(entry);
                }
            });
            
            coreWebVitalsObserver.observe({ 
                entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] 
            });
            
            this.observers.push(coreWebVitalsObserver);
            console.log('✅ Core Web Vitals observer set up');
        } catch (error) {
            console.warn('⚠️ Could not set up Core Web Vitals observer:', error);
        }

        // Resource timing observer
        try {
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processResourceEntry(entry);
                }
            });
            
            resourceObserver.observe({ entryTypes: ['resource'] });
            this.observers.push(resourceObserver);
            console.log('✅ Resource timing observer set up');
        } catch (error) {
            console.warn('⚠️ Could not set up resource timing observer:', error);
        }

        // Navigation timing observer
        try {
            const navigationObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processNavigationEntry(entry);
                }
            });
            
            navigationObserver.observe({ entryTypes: ['navigation'] });
            this.observers.push(navigationObserver);
            console.log('✅ Navigation timing observer set up');
        } catch (error) {
            console.warn('⚠️ Could not set up navigation timing observer:', error);
        }

        // User timing observer (for custom measurements)
        try {
            const userTimingObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processUserTimingEntry(entry);
                }
            });
            
            userTimingObserver.observe({ entryTypes: ['measure', 'mark'] });
            this.observers.push(userTimingObserver);
            console.log('✅ User timing observer set up');
        } catch (error) {
            console.warn('⚠️ Could not set up user timing observer:', error);
        }
    }

    /**
     * Set up custom metrics collection
     */
    setupCustomMetrics() {
        // Memory usage tracking
        if ('memory' in performance) {
            this.trackMemoryUsage();
        }
        
        // DOM complexity tracking
        this.trackDOMComplexity();
        
        // Network quality tracking
        if (navigator.connection) {
            this.trackNetworkMetrics();
        }
        
        // Frame rate tracking
        this.trackFrameRate();
        
        console.log('✅ Custom metrics collection set up');
    }

    /**
     * Set up continuous monitoring
     */
    setupContinuousMonitoring() {
        // Continuous performance monitoring
        setInterval(() => {
            this.collectContinuousMetrics();
        }, this.config.intervals.continuousMonitoring);
        
        // Memory monitoring
        setInterval(() => {
            this.checkMemoryUsage();
        }, this.config.intervals.memoryCheck);
        
        // Resource monitoring
        setInterval(() => {
            this.analyzeResourcePerformance();
        }, this.config.intervals.resourceMonitoring);
        
        // Report generation
        setInterval(() => {
            this.generatePerformanceReport();
        }, this.config.intervals.reportGeneration);
        
        console.log('✅ Continuous monitoring set up');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Page visibility change
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Memory pressure events (if supported)
        if ('memory' in performance) {
            // Custom memory pressure detection
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
                    this.handleMemoryWarning();
                }
            }, 5000);
        }
        
        // Network change events
        if (navigator.connection) {
            navigator.connection.addEventListener('change', () => {
                this.trackNetworkMetrics();
            });
        }
        
        console.log('✅ Event listeners set up');
    }

    /**
     * Collect baseline performance metrics
     */
    async collectBaselineMetrics() {
        console.log('📊 Collecting baseline performance metrics...');
        
        // Navigation timing
        if (performance.timing) {
            const timing = performance.timing;
            const navigationMetrics = {
                timestamp: Date.now(),
                domainLookup: timing.domainLookupEnd - timing.domainLookupStart,
                connection: timing.connectEnd - timing.connectStart,
                request: timing.responseStart - timing.requestStart,
                response: timing.responseEnd - timing.responseStart,
                domProcessing: timing.domComplete - timing.domLoading,
                loadComplete: timing.loadEventEnd - timing.navigationStart
            };
            
            this.performanceData.navigationTiming.push(navigationMetrics);
        }
        
        // Initial resource timing
        if (performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            resources.forEach(resource => this.processResourceEntry(resource));
        }
        
        // Initial memory usage
        if (performance.memory) {
            this.trackMemoryUsage();
        }
        
        // Initial DOM complexity
        this.trackDOMComplexity();
        
        console.log('✅ Baseline metrics collected');
    }

    /**
     * Process Core Web Vitals entries
     */
    processCoreWebVitalEntry(entry) {
        const metric = {
            timestamp: Date.now(),
            name: entry.name,
            value: entry.startTime || entry.value,
            entryType: entry.entryType,
            rating: this.rateMetric(entry.name, entry.startTime || entry.value)
        };
        
        // Special handling for different entry types
        switch (entry.entryType) {
            case 'paint':
                if (entry.name === 'first-contentful-paint') {
                    metric.name = 'firstContentfulPaint';
                    metric.value = entry.startTime;
                }
                break;
                
            case 'largest-contentful-paint':
                metric.name = 'largestContentfulPaint';
                metric.value = entry.startTime;
                break;
                
            case 'first-input':
                metric.name = 'firstInputDelay';
                metric.value = entry.processingStart - entry.startTime;
                break;
                
            case 'layout-shift':
                if (!entry.hadRecentInput) {
                    metric.name = 'cumulativeLayoutShift';
                    metric.value = entry.value;
                    // Accumulate CLS values
                    const existingCLS = this.performanceData.coreWebVitals
                        .filter(m => m.name === 'cumulativeLayoutShift')
                        .reduce((sum, m) => sum + m.value, 0);
                    metric.value = existingCLS + entry.value;
                }
                break;
        }
        
        this.performanceData.coreWebVitals.push(metric);
        this.checkThreshold(metric);
        
        // Maintain data size
        this.maintainDataSize('coreWebVitals');
    }

    /**
     * Process resource timing entries
     */
    processResourceEntry(entry) {
        const resource = {
            timestamp: Date.now(),
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize || 0,
            type: entry.initiatorType,
            startTime: entry.startTime,
            responseEnd: entry.responseEnd,
            domainLookup: entry.domainLookupEnd - entry.domainLookupStart,
            connection: entry.connectEnd - entry.connectStart,
            request: entry.responseStart - entry.requestStart,
            response: entry.responseEnd - entry.responseStart,
            rating: this.rateResourcePerformance(entry)
        };
        
        this.performanceData.resourceTiming.push(resource);
        this.maintainDataSize('resourceTiming');
        
        // Check for slow resources
        if (resource.duration > this.config.customMetrics.averageResourceLoadTime.poor) {
            this.createAlert('slow-resource', `Slow resource detected: ${resource.name} (${resource.duration.toFixed(2)}ms)`);
        }
    }

    /**
     * Process navigation timing entries
     */
    processNavigationEntry(entry) {
        const navigation = {
            timestamp: Date.now(),
            type: entry.type,
            redirectCount: entry.redirectCount,
            domainLookup: entry.domainLookupEnd - entry.domainLookupStart,
            connection: entry.connectEnd - entry.connectStart,
            request: entry.responseStart - entry.requestStart,
            response: entry.responseEnd - entry.responseStart,
            domProcessing: entry.domComplete - entry.domContentLoadedEventStart,
            loadComplete: entry.loadEventEnd - entry.loadEventStart,
            rating: this.rateNavigationPerformance(entry)
        };
        
        this.performanceData.navigationTiming.push(navigation);
        this.maintainDataSize('navigationTiming');
    }

    /**
     * Process user timing entries
     */
    processUserTimingEntry(entry) {
        const userTiming = {
            timestamp: Date.now(),
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration || 0,
            detail: entry.detail || null
        };
        
        this.performanceData.userTiming.push(userTiming);
        this.maintainDataSize('userTiming');
        
        // Check for performance issues in custom measurements
        if (entry.entryType === 'measure' && entry.duration > 1000) {
            this.createAlert('slow-operation', `Slow operation detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
        }
    }

    /**
     * Track memory usage
     */
    trackMemoryUsage() {
        if (!performance.memory) return;
        
        const memory = performance.memory;
        const memoryMetric = {
            timestamp: Date.now(),
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
            rating: this.rateMemoryUsage(memory.usedJSHeapSize)
        };
        
        this.performanceData.memoryUsage.push(memoryMetric);
        this.maintainDataSize('memoryUsage');
        
        // Check memory thresholds
        if (memoryMetric.usagePercentage > 85) {
            this.createAlert('high-memory', `High memory usage: ${memoryMetric.usagePercentage.toFixed(1)}%`);
        }
    }

    /**
     * Track DOM complexity
     */
    trackDOMComplexity() {
        const domMetric = {
            timestamp: Date.now(),
            nodeCount: document.querySelectorAll('*').length,
            depth: this.calculateDOMDepth(),
            rating: this.rateDOMComplexity(document.querySelectorAll('*').length)
        };
        
        this.performanceData.customMetrics.push({
            ...domMetric,
            type: 'dom-complexity'
        });
        
        this.maintainDataSize('customMetrics');
    }

    /**
     * Track network metrics
     */
    trackNetworkMetrics() {
        if (!navigator.connection) return;
        
        const connection = navigator.connection;
        const networkMetric = {
            timestamp: Date.now(),
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData,
            type: connection.type,
            rating: this.rateNetworkQuality(connection)
        };
        
        this.performanceData.networkMetrics.push(networkMetric);
        this.maintainDataSize('networkMetrics');
    }

    /**
     * Track frame rate
     */
    trackFrameRate() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measureFrameRate = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) { // Every second
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                
                this.performanceData.customMetrics.push({
                    timestamp: Date.now(),
                    type: 'frame-rate',
                    value: fps,
                    rating: this.rateFrameRate(fps)
                });
                
                frameCount = 0;
                lastTime = currentTime;
                
                this.maintainDataSize('customMetrics');
                
                // Check for low frame rate
                if (fps < 30) {
                    this.createAlert('low-fps', `Low frame rate detected: ${fps} FPS`);
                }
            }
            
            requestAnimationFrame(measureFrameRate);
        };
        
        requestAnimationFrame(measureFrameRate);
    }

    /**
     * Collect continuous metrics
     */
    collectContinuousMetrics() {
        this.trackMemoryUsage();
        this.trackDOMComplexity();
        
        if (navigator.connection) {
            this.trackNetworkMetrics();
        }
    }

    /**
     * Check memory usage and trigger warnings
     */
    checkMemoryUsage() {
        if (!performance.memory) return;
        
        const memory = performance.memory;
        const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        if (usagePercentage > 90) {
            this.handleMemoryWarning();
        }
    }

    /**
     * Analyze resource performance
     */
    analyzeResourcePerformance() {
        const recentResources = this.performanceData.resourceTiming
            .filter(r => Date.now() - r.timestamp < this.config.intervals.resourceMonitoring);
        
        if (recentResources.length === 0) return;
        
        const averageLoadTime = recentResources.reduce((sum, r) => sum + r.duration, 0) / recentResources.length;
        const totalSize = recentResources.reduce((sum, r) => sum + r.size, 0);
        
        // Check thresholds
        if (averageLoadTime > this.config.customMetrics.averageResourceLoadTime.poor) {
            this.createAlert('slow-resources', `Average resource load time is high: ${averageLoadTime.toFixed(2)}ms`);
        }
        
        if (totalSize > this.config.customMetrics.totalResourceSize.poor) {
            this.createAlert('large-resources', `Total resource size is large: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    /**
     * Rate metric performance
     */
    rateMetric(metricName, value) {
        const thresholds = this.config.coreWebVitals[metricName];
        if (!thresholds) return 'unknown';
        
        if (value <= thresholds.good) return 'good';
        if (value <= thresholds.poor) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Rate resource performance
     */
    rateResourcePerformance(entry) {
        if (entry.duration <= 100) return 'excellent';
        if (entry.duration <= 500) return 'good';
        if (entry.duration <= 1500) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Rate navigation performance
     */
    rateNavigationPerformance(entry) {
        const totalTime = entry.loadEventEnd - entry.fetchStart;
        if (totalTime <= 1000) return 'excellent';
        if (totalTime <= 2500) return 'good';
        if (totalTime <= 4000) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Rate memory usage
     */
    rateMemoryUsage(usedMemory) {
        const thresholds = this.config.customMetrics.jsHeapSize;
        if (usedMemory <= thresholds.good) return 'good';
        if (usedMemory <= thresholds.poor) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Rate DOM complexity
     */
    rateDOMComplexity(nodeCount) {
        const thresholds = this.config.customMetrics.domNodes;
        if (nodeCount <= thresholds.good) return 'good';
        if (nodeCount <= thresholds.poor) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Rate network quality
     */
    rateNetworkQuality(connection) {
        if (connection.effectiveType === '4g' && connection.downlink > 10) return 'excellent';
        if (connection.effectiveType === '4g' || connection.effectiveType === '3g') return 'good';
        if (connection.effectiveType === '2g') return 'needs-improvement';
        return 'poor';
    }

    /**
     * Rate frame rate
     */
    rateFrameRate(fps) {
        if (fps >= 60) return 'excellent';
        if (fps >= 30) return 'good';
        if (fps >= 15) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Calculate DOM depth
     */
    calculateDOMDepth() {
        let maxDepth = 0;
        
        const calculateDepth = (element, depth = 0) => {
            maxDepth = Math.max(maxDepth, depth);
            for (const child of element.children) {
                calculateDepth(child, depth + 1);
            }
        };
        
        calculateDepth(document.body);
        return maxDepth;
    }

    /**
     * Check performance thresholds
     */
    checkThreshold(metric) {
        if (metric.rating === 'poor') {
            this.createAlert('poor-performance', `Poor ${metric.name}: ${metric.value.toFixed(2)}ms`);
        }
    }

    /**
     * Create performance alert
     */
    createAlert(type, message, severity = 'warning') {
        const alert = {
            id: Date.now() + Math.random(),
            type,
            message,
            severity,
            timestamp: Date.now()
        };
        
        this.alerts.push(alert);
        this.maintainDataSize('alerts');
        
        console.warn(`⚠️ Performance Alert [${type}]: ${message}`);
        
        // Dispatch custom event
        const event = new CustomEvent('performance-alert', {
            detail: alert
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle memory warning
     */
    handleMemoryWarning() {
        this.createAlert('memory-pressure', 'High memory usage detected', 'error');
        
        // Dispatch memory pressure event
        const event = new CustomEvent('memory-pressure', {
            detail: {
                timestamp: Date.now(),
                memoryUsage: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : null
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle visibility change
     */
    handleVisibilityChange() {
        const isVisible = !document.hidden;
        
        this.performanceData.customMetrics.push({
            timestamp: Date.now(),
            type: 'visibility-change',
            value: isVisible ? 'visible' : 'hidden'
        });
        
        this.maintainDataSize('customMetrics');
    }

    /**
     * Generate comprehensive performance report
     */
    generatePerformanceReport() {
        const report = {
            timestamp: Date.now(),
            summary: this.generateSummary(),
            coreWebVitals: this.analyzeCoreWebVitals(),
            resources: this.analyzeResources(),
            memory: this.analyzeMemory(),
            network: this.analyzeNetwork(),
            customMetrics: this.analyzeCustomMetrics(),
            alerts: this.getRecentAlerts(),
            recommendations: this.generateRecommendations()
        };
        
        // Store report
        if (!this.reports) this.reports = [];
        this.reports.push(report);
        this.maintainReports();
        
        // Notify listeners
        this.notifyReportingCallbacks(report);
        
        console.log('📊 Performance report generated:', report.summary);
        return report;
    }

    /**
     * Generate performance summary
     */
    generateSummary() {
        const recentAlerts = this.getRecentAlerts();
        const criticalAlerts = recentAlerts.filter(a => a.severity === 'error').length;
        const warningAlerts = recentAlerts.filter(a => a.severity === 'warning').length;
        
        return {
            overallRating: this.calculateOverallRating(),
            criticalIssues: criticalAlerts,
            warnings: warningAlerts,
            dataPoints: Object.values(this.performanceData).reduce((sum, arr) => sum + arr.length, 0),
            monitoringDuration: this.isInitialized ? Date.now() - this.initializationTime : 0
        };
    }

    /**
     * Analyze Core Web Vitals
     */
    analyzeCoreWebVitals() {
        const vitals = {};
        const vitalTypes = ['firstContentfulPaint', 'largestContentfulPaint', 'firstInputDelay', 'cumulativeLayoutShift'];
        
        vitalTypes.forEach(vital => {
            const entries = this.performanceData.coreWebVitals.filter(entry => entry.name === vital);
            if (entries.length > 0) {
                const latest = entries[entries.length - 1];
                vitals[vital] = {
                    value: latest.value,
                    rating: latest.rating,
                    trend: this.calculateTrend(entries.slice(-5).map(e => e.value))
                };
            }
        });
        
        return vitals;
    }

    /**
     * Analyze resource performance
     */
    analyzeResources() {
        const resources = this.performanceData.resourceTiming;
        if (resources.length === 0) return {};
        
        const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
        const averageLoadTime = resources.reduce((sum, r) => sum + r.duration, 0) / resources.length;
        const slowResources = resources.filter(r => r.rating === 'poor').length;
        
        return {
            totalCount: resources.length,
            totalSize: totalSize,
            averageLoadTime: averageLoadTime,
            slowResources: slowResources,
            rating: this.rateResourcePerformance({ duration: averageLoadTime })
        };
    }

    /**
     * Analyze memory usage
     */
    analyzeMemory() {
        const memoryEntries = this.performanceData.memoryUsage;
        if (memoryEntries.length === 0) return {};
        
        const latest = memoryEntries[memoryEntries.length - 1];
        const trend = this.calculateTrend(memoryEntries.slice(-10).map(e => e.usagePercentage));
        
        return {
            current: latest.usagePercentage,
            used: latest.used,
            total: latest.total,
            limit: latest.limit,
            rating: latest.rating,
            trend: trend
        };
    }

    /**
     * Analyze network performance
     */
    analyzeNetwork() {
        const networkEntries = this.performanceData.networkMetrics;
        if (networkEntries.length === 0) return {};
        
        const latest = networkEntries[networkEntries.length - 1];
        
        return {
            effectiveType: latest.effectiveType,
            downlink: latest.downlink,
            rtt: latest.rtt,
            saveData: latest.saveData,
            rating: latest.rating
        };
    }

    /**
     * Analyze custom metrics
     */
    analyzeCustomMetrics() {
        const customEntries = this.performanceData.customMetrics;
        const analysis = {};
        
        // Group by type
        const groupedMetrics = customEntries.reduce((groups, metric) => {
            if (!groups[metric.type]) groups[metric.type] = [];
            groups[metric.type].push(metric);
            return groups;
        }, {});
        
        // Analyze each type
        Object.entries(groupedMetrics).forEach(([type, entries]) => {
            const latest = entries[entries.length - 1];
            analysis[type] = {
                current: latest.value || latest.nodeCount,
                rating: latest.rating,
                count: entries.length
            };
        });
        
        return analysis;
    }

    /**
     * Get recent alerts
     */
    getRecentAlerts(timeWindow = 300000) { // 5 minutes
        const cutoff = Date.now() - timeWindow;
        return this.alerts.filter(alert => alert.timestamp > cutoff);
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        const recentAlerts = this.getRecentAlerts();
        
        // Memory recommendations
        const memoryAlerts = recentAlerts.filter(a => a.type.includes('memory'));
        if (memoryAlerts.length > 0) {
            recommendations.push({
                category: 'memory',
                priority: 'high',
                message: 'Consider reducing memory usage by optimizing data structures and cleaning up unused objects'
            });
        }
        
        // Performance recommendations
        const performanceAlerts = recentAlerts.filter(a => a.type.includes('performance') || a.type.includes('slow'));
        if (performanceAlerts.length > 0) {
            recommendations.push({
                category: 'performance',
                priority: 'medium',
                message: 'Optimize slow operations and consider code splitting for better performance'
            });
        }
        
        // Resource recommendations
        const resourceAlerts = recentAlerts.filter(a => a.type.includes('resource'));
        if (resourceAlerts.length > 0) {
            recommendations.push({
                category: 'resources',
                priority: 'medium',
                message: 'Optimize resource loading with compression, caching, and lazy loading'
            });
        }
        
        return recommendations;
    }

    /**
     * Calculate overall performance rating
     */
    calculateOverallRating() {
        const ratings = [];
        
        // Core Web Vitals ratings
        this.performanceData.coreWebVitals.forEach(entry => {
            ratings.push(this.ratingToScore(entry.rating));
        });
        
        // Resource ratings
        this.performanceData.resourceTiming.forEach(entry => {
            ratings.push(this.ratingToScore(entry.rating));
        });
        
        // Memory ratings
        this.performanceData.memoryUsage.forEach(entry => {
            ratings.push(this.ratingToScore(entry.rating));
        });
        
        if (ratings.length === 0) return 'unknown';
        
        const averageScore = ratings.reduce((sum, score) => sum + score, 0) / ratings.length;
        return this.scoreToRating(averageScore);
    }

    /**
     * Calculate trend for metric values
     */
    calculateTrend(values) {
        if (values.length < 2) return 'stable';
        
        const first = values[0];
        const last = values[values.length - 1];
        const change = ((last - first) / first) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    /**
     * Convert rating to numeric score
     */
    ratingToScore(rating) {
        const scores = {
            'excellent': 5,
            'good': 4,
            'needs-improvement': 2,
            'poor': 1,
            'unknown': 3
        };
        return scores[rating] || 3;
    }

    /**
     * Convert numeric score to rating
     */
    scoreToRating(score) {
        if (score >= 4.5) return 'excellent';
        if (score >= 3.5) return 'good';
        if (score >= 2.5) return 'needs-improvement';
        return 'poor';
    }

    /**
     * Maintain data size limits
     */
    maintainDataSize(dataType) {
        const maxSize = this.config.retention.maxMetricEntries;
        
        if (dataType === 'alerts') {
            if (this.alerts.length > this.config.retention.maxAlerts) {
                this.alerts = this.alerts.slice(-this.config.retention.maxAlerts);
            }
            return;
        }
        
        if (this.performanceData[dataType] && this.performanceData[dataType].length > maxSize) {
            this.performanceData[dataType] = this.performanceData[dataType].slice(-maxSize);
        }
    }

    /**
     * Maintain reports size
     */
    maintainReports() {
        if (this.reports.length > this.config.retention.maxReports) {
            this.reports = this.reports.slice(-this.config.retention.maxReports);
        }
    }

    /**
     * Add reporting callback
     */
    addReportingCallback(callback) {
        this.reportingCallbacks.add(callback);
    }

    /**
     * Remove reporting callback
     */
    removeReportingCallback(callback) {
        this.reportingCallbacks.delete(callback);
    }

    /**
     * Notify reporting callbacks
     */
    notifyReportingCallbacks(report) {
        this.reportingCallbacks.forEach(callback => {
            try {
                callback(report);
            } catch (error) {
                console.error('Error in reporting callback:', error);
            }
        });
    }

    // Public API Methods
    getCurrentMetrics() {
        return {
            coreWebVitals: this.analyzeCoreWebVitals(),
            resources: this.analyzeResources(),
            memory: this.analyzeMemory(),
            network: this.analyzeNetwork(),
            customMetrics: this.analyzeCustomMetrics()
        };
    }

    getPerformanceScore() {
        return this.calculateOverallRating();
    }

    getRecentReport() {
        return this.reports ? this.reports[this.reports.length - 1] : null;
    }

    getAllReports() {
        return this.reports ? [...this.reports] : [];
    }

    clearAlerts() {
        this.alerts = [];
    }

    // Custom measurement methods
    mark(name) {
        if ('performance' in window && performance.mark) {
            performance.mark(name);
        }
    }

    measure(name, startMark, endMark) {
        if ('performance' in window && performance.measure) {
            performance.measure(name, startMark, endMark);
        }
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Performance Monitoring Service...');
        
        // Disconnect observers
        this.observers.forEach(observer => {
            if (observer.disconnect) {
                observer.disconnect();
            }
        });
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Clear intervals (in a real implementation, you'd track these)
        // clearInterval(this.continuousMonitoringInterval);
        
        // Clear data
        this.observers = [];
        this.metrics.clear();
        this.thresholds.clear();
        this.alerts = [];
        this.reportingCallbacks.clear();
        
        Object.keys(this.performanceData).forEach(key => {
            this.performanceData[key] = [];
        });
        
        this.isInitialized = false;
        
        console.log('✅ Performance Monitoring Service cleanup completed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitoringService;
}

// Make available globally for non-module environments
if (typeof window !== 'undefined') {
    window.PerformanceMonitoringService = PerformanceMonitoringService;
}