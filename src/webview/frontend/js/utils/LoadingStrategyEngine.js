/**
 * Loading Strategy Decision Engine
 * Determines optimal loading strategy based on progressive enhancement detection
 * and manages adaptive loading behavior throughout the application lifecycle
 */

class LoadingStrategyEngine {
    constructor(progressiveEnhancement) {
        this.progressiveEnhancement = progressiveEnhancement;
        this.currentStrategy = null;
        this.strategyHistory = [];
        this.adaptiveRules = new Map();
        this.loadingQueue = [];
        this.isProcessingQueue = false;
        
        // Configuration
        this.config = {
            // Strategy update thresholds
            thresholds: {
                networkQualityChange: 2, // Levels of change required
                performanceScoreChange: 20, // Points of change required
                memoryUsageChange: 0.2, // 20% change in memory usage
                latencyChange: 200 // ms change in latency
            },
            
            // Adaptive loading settings
            adaptiveLoading: {
                batchSize: 3, // Number of resources to load simultaneously
                retryAttempts: 3,
                retryDelay: 1000, // ms
                timeoutDuration: 10000 // ms
            },
            
            // Performance monitoring
            monitoring: {
                performanceCheckInterval: 5000, // ms
                strategyReviewInterval: 30000, // ms
                memoryCheckInterval: 10000 // ms
            }
        };
        
        // Strategy templates
        this.strategyTemplates = {
            'high-performance': {
                useEnhancedUI: true,
                uiComplexity: 'full',
                lazyLoadImages: false,
                preloadCritical: true,
                enableAnimations: true,
                enableServiceWorker: true,
                useCodeSplitting: true,
                enablePrefetch: true,
                compressionLevel: 'standard',
                adaptiveLoading: true
            },
            
            'balanced': {
                useEnhancedUI: true,
                uiComplexity: 'medium',
                lazyLoadImages: true,
                preloadCritical: true,
                enableAnimations: true,
                enableServiceWorker: true,
                useCodeSplitting: true,
                enablePrefetch: false,
                compressionLevel: 'high',
                adaptiveLoading: true
            },
            
            'conservative': {
                useEnhancedUI: false,
                uiComplexity: 'basic',
                lazyLoadImages: true,
                preloadCritical: false,
                enableAnimations: false,
                enableServiceWorker: true,
                useCodeSplitting: true,
                enablePrefetch: false,
                compressionLevel: 'maximum',
                adaptiveLoading: false
            },
            
            'minimal': {
                useEnhancedUI: false,
                uiComplexity: 'basic',
                lazyLoadImages: true,
                preloadCritical: false,
                enableAnimations: false,
                enableServiceWorker: false,
                useCodeSplitting: false,
                enablePrefetch: false,
                compressionLevel: 'maximum',
                adaptiveLoading: false
            }
        };
        
        // Bind methods
        this.handleStrategyChange = this.handleStrategyChange.bind(this);
        this.handlePerformanceChange = this.handlePerformanceChange.bind(this);
        this.handleNetworkChange = this.handleNetworkChange.bind(this);
        
        // Initialize
        this.initialize();
    }

    /**
     * Initialize the loading strategy engine
     */
    async initialize() {
        console.log('🎯 Initializing Loading Strategy Engine...');
        
        try {
            // Get initial enhancement decision
            const enhancementDecision = await this.progressiveEnhancement.initialize();
            
            // Determine initial strategy
            this.currentStrategy = this.determineOptimalStrategy(enhancementDecision);
            this.strategyHistory.push({
                strategy: { ...this.currentStrategy },
                timestamp: Date.now(),
                reason: 'Initial strategy determination'
            });
            
            // Set up adaptive rules
            this.setupAdaptiveRules();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start monitoring
            this.startMonitoring();
            
            console.log('✅ Loading Strategy Engine initialized');
            console.log('📋 Initial Strategy:', this.currentStrategy);
            
            // Notify about initial strategy
            this.notifyStrategyUpdate('initialization');
            
        } catch (error) {
            console.error('❌ Failed to initialize Loading Strategy Engine:', error);
            this.setFallbackStrategy();
        }
    }

    /**
     * Determine optimal loading strategy based on enhancement decision
     */
    determineOptimalStrategy(enhancementDecision) {
        const { capabilities, networkConditions, performanceMetrics, loadingStrategy } = enhancementDecision;
        
        console.log('🔍 Determining optimal loading strategy...');
        
        // Start with base strategy from progressive enhancement
        let strategy = { ...loadingStrategy };
        
        // Apply template-based optimizations
        const templateName = this.selectStrategyTemplate(enhancementDecision);
        const template = this.strategyTemplates[templateName];
        
        if (template) {
            strategy = { ...template, ...strategy };
            strategy.templateUsed = templateName;
        }
        
        // Apply adaptive rules
        strategy = this.applyAdaptiveRules(strategy, enhancementDecision);
        
        // Add metadata
        strategy.metadata = {
            timestamp: Date.now(),
            version: '1.0.0',
            decisionFactors: this.getDecisionFactors(enhancementDecision),
            confidence: this.calculateStrategyConfidence(enhancementDecision)
        };
        
        console.log('✅ Optimal strategy determined:', strategy);
        return strategy;
    }

    /**
     * Select appropriate strategy template
     */
    selectStrategyTemplate(enhancementDecision) {
        const { networkConditions, performanceMetrics, capabilities } = enhancementDecision;
        
        // High-performance conditions
        if (performanceMetrics.deviceClass === 'high-end' && 
            networkConditions.quality === 'excellent' && 
            !networkConditions.saveData) {
            return 'high-performance';
        }
        
        // Conservative conditions
        if (performanceMetrics.deviceClass === 'low-end' || 
            networkConditions.quality === 'poor' || 
            networkConditions.saveData ||
            (performanceMetrics.deviceMemory && performanceMetrics.deviceMemory < 2)) {
            return 'conservative';
        }
        
        // Minimal conditions
        if (networkConditions.effectiveType === 'slow-2g' || 
            networkConditions.effectiveType === '2g' ||
            !capabilities.serviceWorker ||
            !capabilities.localStorage) {
            return 'minimal';
        }
        
        // Default to balanced
        return 'balanced';
    }

    /**
     * Apply adaptive rules to strategy
     */
    applyAdaptiveRules(strategy, enhancementDecision) {
        const { capabilities, networkConditions, performanceMetrics } = enhancementDecision;
        
        // Rule: Disable animations for reduced motion preference
        if (capabilities.reducedMotion) {
            strategy.enableAnimations = false;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('Animations disabled due to reduced motion preference');
        }
        
        // Rule: Enable high contrast mode
        if (capabilities.highContrast) {
            strategy.enableHighContrast = true;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('High contrast mode enabled');
        }
        
        // Rule: Adjust for save data preference
        if (networkConditions.saveData) {
            strategy.lazyLoadImages = true;
            strategy.preloadCritical = false;
            strategy.enablePrefetch = false;
            strategy.compressionLevel = 'maximum';
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('Data saving optimizations applied');
        }
        
        // Rule: Memory-constrained devices
        if (performanceMetrics.deviceMemory && performanceMetrics.deviceMemory < 1) {
            strategy.uiComplexity = 'basic';
            strategy.useCodeSplitting = true;
            strategy.enableAnimations = false;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('Memory optimizations for low-memory device');
        }
        
        // Rule: Very slow networks
        if (networkConditions.effectiveType === 'slow-2g') {
            strategy.useEnhancedUI = false;
            strategy.uiComplexity = 'basic';
            strategy.lazyLoadImages = true;
            strategy.preloadCritical = false;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('Basic UI for very slow network');
        }
        
        // Rule: Touch devices
        if (capabilities.touchSupport) {
            strategy.enableTouchOptimizations = true;
            strategy.touchTargetSize = 44; // Minimum touch target size
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('Touch optimizations enabled');
        }
        
        // Rule: High DPI displays
        if (capabilities.highDPI) {
            strategy.useHighDPIAssets = true;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('High DPI assets enabled');
        }
        
        // Rule: WebP/AVIF support
        if (capabilities.webP) {
            strategy.useWebP = true;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('WebP format enabled');
        }
        
        if (capabilities.avif) {
            strategy.useAVIF = true;
            strategy.reasoning = strategy.reasoning || [];
            strategy.reasoning.push('AVIF format enabled');
        }
        
        return strategy;
    }

    /**
     * Setup adaptive rules for runtime strategy adjustments
     */
    setupAdaptiveRules() {
        // Network quality change rule
        this.adaptiveRules.set('networkQuality', (oldDecision, newDecision) => {
            const oldQuality = this.getNetworkQualityScore(oldDecision.networkConditions);
            const newQuality = this.getNetworkQualityScore(newDecision.networkConditions);
            
            if (Math.abs(oldQuality - newQuality) >= this.config.thresholds.networkQualityChange) {
                return this.determineOptimalStrategy(newDecision);
            }
            return null;
        });
        
        // Performance score change rule
        this.adaptiveRules.set('performanceScore', (oldDecision, newDecision) => {
            const oldScore = oldDecision.performanceMetrics.performanceScore || 50;
            const newScore = newDecision.performanceMetrics.performanceScore || 50;
            
            if (Math.abs(oldScore - newScore) >= this.config.thresholds.performanceScoreChange) {
                return this.determineOptimalStrategy(newDecision);
            }
            return null;
        });
        
        // Memory usage change rule
        this.adaptiveRules.set('memoryUsage', (oldDecision, newDecision) => {
            const oldMemory = oldDecision.performanceMetrics.jsHeapSize?.used || 0;
            const newMemory = newDecision.performanceMetrics.jsHeapSize?.used || 0;
            
            if (oldMemory > 0 && newMemory > 0) {
                const change = Math.abs(newMemory - oldMemory) / oldMemory;
                if (change >= this.config.thresholds.memoryUsageChange) {
                    return this.determineOptimalStrategy(newDecision);
                }
            }
            return null;
        });
        
        // Network latency change rule
        this.adaptiveRules.set('networkLatency', (oldDecision, newDecision) => {
            const oldLatency = oldDecision.networkConditions.rtt || 0;
            const newLatency = newDecision.networkConditions.rtt || 0;
            
            if (Math.abs(newLatency - oldLatency) >= this.config.thresholds.latencyChange) {
                return this.determineOptimalStrategy(newDecision);
            }
            return null;
        });
    }

    /**
     * Setup event listeners for strategy changes
     */
    setupEventListeners() {
        // Listen for progressive enhancement changes
        document.addEventListener('progressive-enhancement-change', this.handleStrategyChange);
        
        // Listen for performance changes
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver(this.handlePerformanceChange);
                observer.observe({ entryTypes: ['measure', 'navigation'] });
            } catch (error) {
                console.warn('Could not set up performance observer:', error);
            }
        }
        
        // Listen for network changes
        if (navigator.connection) {
            navigator.connection.addEventListener('change', this.handleNetworkChange);
        }
        
        // Listen for memory pressure
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.85) {
                    this.handleMemoryPressure();
                }
            }, this.config.monitoring.memoryCheckInterval);
        }
    }

    /**
     * Start monitoring for strategy adjustments
     */
    startMonitoring() {
        // Performance monitoring
        setInterval(() => {
            this.checkPerformanceMetrics();
        }, this.config.monitoring.performanceCheckInterval);
        
        // Strategy review
        setInterval(() => {
            this.reviewCurrentStrategy();
        }, this.config.monitoring.strategyReviewInterval);
    }

    /**
     * Handle strategy change events
     */
    handleStrategyChange(event) {
        const newDecision = event.detail;
        const oldDecision = this.getLastDecision();
        
        console.log('📊 Progressive enhancement change detected, evaluating strategy...');
        
        // Apply adaptive rules
        let newStrategy = null;
        for (const [ruleName, rule] of this.adaptiveRules) {
            try {
                const ruleResult = rule(oldDecision, newDecision);
                if (ruleResult) {
                    newStrategy = ruleResult;
                    console.log(`🔄 Strategy updated by rule: ${ruleName}`);
                    break;
                }
            } catch (error) {
                console.warn(`⚠️ Adaptive rule '${ruleName}' failed:`, error);
            }
        }
        
        if (newStrategy && this.isStrategySignificantlyDifferent(this.currentStrategy, newStrategy)) {
            this.updateStrategy(newStrategy, `Adaptive rule triggered by ${event.type}`);
        }
    }

    /**
     * Handle performance change events
     */
    handlePerformanceChange(list) {
        const entries = list.getEntries();
        
        for (const entry of entries) {
            if (entry.entryType === 'measure' && entry.name.startsWith('app-')) {
                // Check if performance has degraded significantly
                if (entry.duration > 1000) { // 1 second threshold
                    console.warn('⚠️ Performance degradation detected:', entry.name, entry.duration);
                    this.handlePerformanceDegradation();
                }
            }
        }
    }

    /**
     * Handle network change events
     */
    handleNetworkChange() {
        console.log('🌐 Network change detected, reassessing strategy...');
        
        // Trigger progressive enhancement reassessment
        setTimeout(() => {
            this.progressiveEnhancement.assessNetworkConditions().then(() => {
                // Strategy will be updated via the progressive-enhancement-change event
            });
        }, 1000); // Small delay to allow network to stabilize
    }

    /**
     * Handle memory pressure
     */
    handleMemoryPressure() {
        console.warn('⚠️ Memory pressure detected, adjusting strategy...');
        
        const memoryOptimizedStrategy = {
            ...this.currentStrategy,
            uiComplexity: 'basic',
            enableAnimations: false,
            useCodeSplitting: true,
            lazyLoadImages: true,
            preloadCritical: false,
            reasoning: [...(this.currentStrategy.reasoning || []), 'Memory pressure optimization']
        };
        
        this.updateStrategy(memoryOptimizedStrategy, 'Memory pressure detected');
    }

    /**
     * Handle performance degradation
     */
    handlePerformanceDegradation() {
        console.warn('⚠️ Performance degradation detected, optimizing strategy...');
        
        const optimizedStrategy = {
            ...this.currentStrategy,
            enableAnimations: false,
            uiComplexity: this.currentStrategy.uiComplexity === 'full' ? 'medium' : 'basic',
            lazyLoadImages: true,
            reasoning: [...(this.currentStrategy.reasoning || []), 'Performance degradation optimization']
        };
        
        this.updateStrategy(optimizedStrategy, 'Performance degradation detected');
    }

    /**
     * Check current performance metrics
     */
    checkPerformanceMetrics() {
        if ('memory' in performance) {
            const memory = performance.memory;
            const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
            
            // If memory usage is high, consider strategy adjustment
            if (memoryUsage > 0.8 && this.currentStrategy.uiComplexity !== 'basic') {
                this.handleMemoryPressure();
            }
        }
    }

    /**
     * Review current strategy effectiveness
     */
    reviewCurrentStrategy() {
        console.log('🔍 Reviewing current strategy effectiveness...');
        
        // Get current performance metrics
        const currentMetrics = this.getCurrentPerformanceMetrics();
        
        // Compare with expected performance for current strategy
        const expectedPerformance = this.getExpectedPerformance(this.currentStrategy);
        
        if (this.isPerformanceBelowExpectations(currentMetrics, expectedPerformance)) {
            console.log('📉 Performance below expectations, considering strategy adjustment...');
            this.considerStrategyDowngrade();
        } else if (this.isPerformanceAboveExpectations(currentMetrics, expectedPerformance)) {
            console.log('📈 Performance above expectations, considering strategy upgrade...');
            this.considerStrategyUpgrade();
        }
    }

    /**
     * Update current strategy
     */
    updateStrategy(newStrategy, reason) {
        const oldStrategy = { ...this.currentStrategy };
        this.currentStrategy = newStrategy;
        
        // Add to history
        this.strategyHistory.push({
            strategy: { ...newStrategy },
            timestamp: Date.now(),
            reason: reason,
            previousStrategy: oldStrategy
        });
        
        // Keep history manageable
        if (this.strategyHistory.length > 50) {
            this.strategyHistory = this.strategyHistory.slice(-25);
        }
        
        console.log('🔄 Strategy updated:', reason);
        console.log('📋 New Strategy:', newStrategy);
        
        // Notify about strategy update
        this.notifyStrategyUpdate(reason);
    }

    /**
     * Notify about strategy updates
     */
    notifyStrategyUpdate(reason) {
        const event = new CustomEvent('loading-strategy-update', {
            detail: {
                strategy: this.currentStrategy,
                reason: reason,
                timestamp: Date.now(),
                history: this.strategyHistory.slice(-5) // Last 5 changes
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * Adaptive loading queue management
     */
    async loadResource(resource, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const loadItem = {
                resource,
                priority,
                resolve,
                reject,
                attempts: 0,
                timestamp: Date.now()
            };
            
            // Add to queue based on priority
            if (priority === 'high') {
                this.loadingQueue.unshift(loadItem);
            } else {
                this.loadingQueue.push(loadItem);
            }
            
            // Process queue if not already processing
            if (!this.isProcessingQueue) {
                this.processLoadingQueue();
            }
        });
    }

    /**
     * Process loading queue with adaptive batching
     */
    async processLoadingQueue() {
        if (this.isProcessingQueue || this.loadingQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        try {
            while (this.loadingQueue.length > 0) {
                // Determine batch size based on current strategy and network conditions
                const batchSize = this.calculateOptimalBatchSize();
                const batch = this.loadingQueue.splice(0, batchSize);
                
                // Process batch
                const batchPromises = batch.map(item => this.processLoadItem(item));
                await Promise.allSettled(batchPromises);
                
                // Small delay between batches to prevent overwhelming
                if (this.loadingQueue.length > 0) {
                    await this.delay(100);
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Process individual load item
     */
    async processLoadItem(item) {
        const { resource, resolve, reject, attempts } = item;
        
        try {
            // Apply timeout based on current strategy
            const timeout = this.getLoadTimeout();
            const result = await this.loadWithTimeout(resource, timeout);
            resolve(result);
        } catch (error) {
            item.attempts++;
            
            if (item.attempts < this.config.adaptiveLoading.retryAttempts) {
                // Retry with exponential backoff
                const delay = this.config.adaptiveLoading.retryDelay * Math.pow(2, item.attempts - 1);
                await this.delay(delay);
                
                // Add back to queue for retry
                this.loadingQueue.unshift(item);
            } else {
                reject(error);
            }
        }
    }

    /**
     * Calculate optimal batch size for loading
     */
    calculateOptimalBatchSize() {
        const baseSize = this.config.adaptiveLoading.batchSize;
        
        // Adjust based on network conditions
        if (this.currentStrategy.adaptiveLoading === false) {
            return 1; // Sequential loading
        }
        
        const networkQuality = this.getNetworkQualityFromStrategy();
        
        switch (networkQuality) {
            case 'excellent':
                return baseSize * 2;
            case 'good':
                return baseSize;
            case 'fair':
                return Math.max(1, Math.floor(baseSize / 2));
            case 'poor':
                return 1;
            default:
                return baseSize;
        }
    }

    /**
     * Get load timeout based on strategy
     */
    getLoadTimeout() {
        const baseTimeout = this.config.adaptiveLoading.timeoutDuration;
        
        if (this.currentStrategy.compressionLevel === 'maximum') {
            return baseTimeout * 2; // More time for compressed resources
        }
        
        return baseTimeout;
    }

    /**
     * Load resource with timeout
     */
    async loadWithTimeout(resource, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Load timeout: ${resource}`));
            }, timeout);
            
            // Simulate resource loading (replace with actual loading logic)
            this.actualLoadResource(resource)
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    /**
     * Actual resource loading implementation
     */
    async actualLoadResource(resource) {
        // This would be implemented based on resource type
        // For now, simulate loading
        if (typeof resource === 'string') {
            // URL loading
            const response = await fetch(resource);
            if (!response.ok) {
                throw new Error(`Failed to load ${resource}: ${response.status}`);
            }
            return response;
        } else if (typeof resource === 'function') {
            // Function execution
            return await resource();
        } else {
            // Object with custom loading logic
            if (resource.load && typeof resource.load === 'function') {
                return await resource.load();
            }
        }
        
        throw new Error('Unknown resource type');
    }

    // Utility Methods
    getLastDecision() {
        return this.progressiveEnhancement.getEnhancementDecision();
    }

    getNetworkQualityScore(networkConditions) {
        const qualityMap = { excellent: 4, good: 3, fair: 2, poor: 1, unknown: 2 };
        return qualityMap[networkConditions.quality] || 2;
    }

    getDecisionFactors(enhancementDecision) {
        return {
            deviceClass: enhancementDecision.performanceMetrics.deviceClass,
            networkQuality: enhancementDecision.networkConditions.quality,
            saveData: enhancementDecision.networkConditions.saveData,
            reducedMotion: enhancementDecision.capabilities.reducedMotion,
            touchSupport: enhancementDecision.capabilities.touchSupport,
            serviceWorkerSupport: enhancementDecision.capabilities.serviceWorker
        };
    }

    calculateStrategyConfidence(enhancementDecision) {
        let confidence = 100;
        
        // Reduce confidence for unknown values
        if (enhancementDecision.networkConditions.quality === 'unknown') confidence -= 20;
        if (enhancementDecision.performanceMetrics.deviceClass === 'unknown') confidence -= 20;
        if (!enhancementDecision.performanceMetrics.performanceScore) confidence -= 10;
        
        return Math.max(0, confidence);
    }

    isStrategySignificantlyDifferent(oldStrategy, newStrategy) {
        const significantFields = [
            'useEnhancedUI', 'uiComplexity', 'enableAnimations', 
            'lazyLoadImages', 'preloadCritical', 'enableServiceWorker'
        ];
        
        return significantFields.some(field => oldStrategy[field] !== newStrategy[field]);
    }

    getCurrentPerformanceMetrics() {
        return {
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            timing: performance.timing ? {
                loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
            } : null
        };
    }

    getExpectedPerformance(strategy) {
        // Define expected performance baselines for different strategies
        const baselines = {
            'high-performance': { loadTime: 1000, memoryUsage: 0.6 },
            'balanced': { loadTime: 2000, memoryUsage: 0.5 },
            'conservative': { loadTime: 3000, memoryUsage: 0.4 },
            'minimal': { loadTime: 1500, memoryUsage: 0.3 }
        };
        
        return baselines[strategy.templateUsed] || baselines['balanced'];
    }

    isPerformanceBelowExpectations(current, expected) {
        if (current.memory && current.memory.limit > 0) {
            const memoryUsage = current.memory.used / current.memory.limit;
            if (memoryUsage > expected.memoryUsage * 1.2) { // 20% tolerance
                return true;
            }
        }
        
        return false;
    }

    isPerformanceAboveExpectations(current, expected) {
        if (current.memory && current.memory.limit > 0) {
            const memoryUsage = current.memory.used / current.memory.limit;
            if (memoryUsage < expected.memoryUsage * 0.8) { // 20% better
                return true;
            }
        }
        
        return false;
    }

    considerStrategyDowngrade() {
        const currentTemplate = this.currentStrategy.templateUsed;
        const downgrades = {
            'high-performance': 'balanced',
            'balanced': 'conservative',
            'conservative': 'minimal'
        };
        
        const newTemplate = downgrades[currentTemplate];
        if (newTemplate) {
            const newStrategy = {
                ...this.strategyTemplates[newTemplate],
                templateUsed: newTemplate,
                reasoning: ['Performance-based downgrade']
            };
            
            this.updateStrategy(newStrategy, 'Performance-based strategy downgrade');
        }
    }

    considerStrategyUpgrade() {
        const currentTemplate = this.currentStrategy.templateUsed;
        const upgrades = {
            'minimal': 'conservative',
            'conservative': 'balanced',
            'balanced': 'high-performance'
        };
        
        const newTemplate = upgrades[currentTemplate];
        if (newTemplate) {
            const newStrategy = {
                ...this.strategyTemplates[newTemplate],
                templateUsed: newTemplate,
                reasoning: ['Performance-based upgrade']
            };
            
            this.updateStrategy(newStrategy, 'Performance-based strategy upgrade');
        }
    }

    getNetworkQualityFromStrategy() {
        // Infer network quality from current strategy
        if (this.currentStrategy.templateUsed === 'high-performance') return 'excellent';
        if (this.currentStrategy.templateUsed === 'balanced') return 'good';
        if (this.currentStrategy.templateUsed === 'conservative') return 'fair';
        return 'poor';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setFallbackStrategy() {
        console.warn('⚠️ Using fallback loading strategy');
        
        this.currentStrategy = {
            ...this.strategyTemplates['minimal'],
            templateUsed: 'minimal',
            reasoning: ['Fallback strategy due to initialization failure'],
            metadata: {
                timestamp: Date.now(),
                version: '1.0.0',
                confidence: 0
            }
        };
    }

    // Public API Methods
    getCurrentStrategy() {
        return { ...this.currentStrategy };
    }

    getStrategyHistory() {
        return [...this.strategyHistory];
    }

    forceStrategyUpdate(reason = 'Manual update') {
        const enhancementDecision = this.progressiveEnhancement.getEnhancementDecision();
        const newStrategy = this.determineOptimalStrategy(enhancementDecision);
        this.updateStrategy(newStrategy, reason);
    }

    // Cleanup
    destroy() {
        console.log('🧹 Cleaning up Loading Strategy Engine...');
        
        // Remove event listeners
        document.removeEventListener('progressive-enhancement-change', this.handleStrategyChange);
        
        if (navigator.connection) {
            navigator.connection.removeEventListener('change', this.handleNetworkChange);
        }
        
        // Clear intervals and timeouts
        // (In a real implementation, you'd track these and clear them)
        
        // Clear references
        this.currentStrategy = null;
        this.strategyHistory = [];
        this.adaptiveRules.clear();
        this.loadingQueue = [];
        
        console.log('✅ Loading Strategy Engine cleanup completed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingStrategyEngine;
}

// Make available globally for non-module environments
if (typeof window !== 'undefined') {
    window.LoadingStrategyEngine = LoadingStrategyEngine;
}