/**
 * Enhanced UI Loader with Intelligent Decision Making and Fallback Mechanisms
 * Handles progressive enhancement, capability detection, and error recovery
 * Implements smooth transitions, loading states, and comprehensive error handling
 */
class EnhancedUILoader {
    constructor() {
        this.loadingState = 'initializing';
        this.progressSteps = [];
        this.currentStep = 0;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.loadingTimeout = 30000; // 30 seconds
        this.progressiveEnhancement = null;
        this.loadingStrategy = null;
        this.errorHistory = [];
        this.fallbackAttempts = 0;
        this.maxFallbackAttempts = 2;
        this.transitionDuration = 500; // ms for smooth transitions
        this.loadingStateCallbacks = new Map();
        this.recoveryStrategies = [];
        
        // Enhanced loading step definitions with sub-steps
        this.loadingSteps = [
            { 
                id: 'detection', 
                name: 'Detecting capabilities...', 
                weight: 15,
                subSteps: [
                    'Checking device capabilities',
                    'Assessing network conditions',
                    'Measuring performance baseline'
                ]
            },
            { 
                id: 'strategy', 
                name: 'Determining strategy...', 
                weight: 10,
                subSteps: [
                    'Analyzing enhancement decision',
                    'Selecting optimal strategy',
                    'Configuring loading parameters'
                ]
            },
            { 
                id: 'resources', 
                name: 'Loading resources...', 
                weight: 30,
                subSteps: [
                    'Loading stylesheets',
                    'Loading JavaScript modules',
                    'Preparing UI containers'
                ]
            },
            { 
                id: 'initialization', 
                name: 'Initializing components...', 
                weight: 35,
                subSteps: [
                    'Creating UI instance',
                    'Setting up event handlers',
                    'Initializing services'
                ]
            },
            { 
                id: 'finalization', 
                name: 'Finalizing setup...', 
                weight: 10,
                subSteps: [
                    'Configuring message handling',
                    'Setting up monitoring',
                    'Completing initialization'
                ]
            }
        ];
        
        // Recovery strategies in order of preference
        this.recoveryStrategies = [
            {
                name: 'enhanced-retry',
                description: 'Retry enhanced UI with different parameters',
                condition: () => this.fallbackAttempts === 0 && this.loadingStrategy?.useEnhancedUI,
                action: () => this.retryEnhancedUIWithFallback()
            },
            {
                name: 'basic-ui-fallback',
                description: 'Fall back to basic UI',
                condition: () => this.fallbackAttempts <= 1,
                action: () => this.fallbackToBasicUI()
            },
            {
                name: 'minimal-ui-fallback',
                description: 'Fall back to minimal UI',
                condition: () => this.fallbackAttempts <= 2,
                action: () => this.fallbackToMinimalUI()
            },
            {
                name: 'emergency-fallback',
                description: 'Emergency static fallback',
                condition: () => true,
                action: () => this.emergencyFallback()
            }
        ];
        
        // Bind methods
        this.handleLoadingError = this.handleLoadingError.bind(this);
        this.updateProgress = this.updateProgress.bind(this);
        this.handleTransitionEnd = this.handleTransitionEnd.bind(this);
        this.handleRecoveryAction = this.handleRecoveryAction.bind(this);
    }
    
    async initialize() {
        try {
            console.log('🚀 Starting Enhanced UI Loader...');
            this.updateLoadingState('initializing');
            
            // Set up comprehensive error handling
            this.setupErrorHandling();
            
            // Set up loading timeout with recovery
            const loadingTimeout = setTimeout(() => {
                this.handleLoadingTimeout();
            }, this.loadingTimeout);
            
            // Detect UI mode from URL parameters or configuration
            const urlParams = new URLSearchParams(window.location.search);
            const uiMode = urlParams.get('ui') || 'auto';
            const debugMode = urlParams.has('debug');
            
            window.webAutomationConfig.debugMode = debugMode;
            
            // Show debug toggle in debug mode
            if (debugMode) {
                const uiToggle = document.getElementById('uiToggle');
                if (uiToggle) uiToggle.style.display = 'block';
            }
            
            // Enhanced loading with detailed progress tracking
            let uiInstance = null;
            
            try {
                // Step 1: Progressive Enhancement Detection
                this.updateStep('detection');
                await this.updateSubStep('Checking device capabilities');
                const enhancementDecision = await this.performCapabilityDetection();
                
                // Step 2: Strategy Determination
                this.updateStep('strategy');
                await this.updateSubStep('Analyzing enhancement decision');
                const loadingStrategy = await this.determineLoadingStrategy(enhancementDecision, uiMode);
                await this.updateSubStep('Configuring loading parameters');
                
                // Step 3: Load UI based on strategy with intelligent fallback
                this.updateStep('resources');
                uiInstance = await this.loadUIWithIntelligentFallback(loadingStrategy);
                
                // Step 4: Initialize UI components with error boundaries
                this.updateStep('initialization');
                await this.initializeUIComponentsWithErrorBoundaries(uiInstance, loadingStrategy);
                
                // Step 5: Finalize setup with monitoring
                this.updateStep('finalization');
                await this.finalizeUISetupWithMonitoring(uiInstance, loadingStrategy);
                
            } catch (error) {
                console.warn('⚠️ Primary loading path failed, attempting recovery:', error);
                uiInstance = await this.attemptRecovery(error);
            }
            
            clearTimeout(loadingTimeout);
            
            // Smooth transition to hide loading screen
            await this.hideLoadingScreenWithTransition();
            
            console.log('✅ Enhanced UI Loader completed successfully');
            this.updateLoadingState('completed');
            
            // Set up post-initialization monitoring
            this.setupPostInitializationMonitoring(uiInstance);
            
            return uiInstance;
            
        } catch (error) {
            console.error('❌ Enhanced UI Loader failed completely:', error);
            return this.handleCriticalLoadingError(error);
        }
    }
    
    async performCapabilityDetection() {
        try {
            // Initialize progressive enhancement system if available
            if (typeof ProgressiveEnhancement !== 'undefined') {
                this.progressiveEnhancement = new ProgressiveEnhancement();
                const decision = await this.progressiveEnhancement.initialize();
                console.log('📊 Progressive enhancement decision:', decision);
                return decision;
            }
            
            // Fallback capability detection
            return this.basicCapabilityDetection();
            
        } catch (error) {
            console.warn('⚠️ Progressive enhancement failed, using basic detection:', error);
            return this.basicCapabilityDetection();
        }
    }
    
    basicCapabilityDetection() {
        const capabilities = {
            touchSupport: 'ontouchstart' in window,
            highDPI: window.devicePixelRatio > 1,
            serviceWorker: 'serviceWorker' in navigator,
            intersectionObserver: 'IntersectionObserver' in window,
            webGL: !!this.detectWebGL(),
            localStorage: this.testLocalStorage(),
            deviceMemory: navigator.deviceMemory || 4,
            connectionSpeed: navigator.connection?.effectiveType || '4g'
        };
        
        const networkConditions = {
            effectiveType: navigator.connection?.effectiveType || '4g',
            saveData: navigator.connection?.saveData || false,
            quality: this.assessNetworkQuality()
        };
        
        const performanceMetrics = {
            deviceClass: this.classifyDevice(capabilities),
            loadTime: performance.now()
        };
        
        return {
            capabilities,
            networkConditions,
            performanceMetrics,
            loadingStrategy: { useEnhancedUI: true }
        };
    }
    
    detectWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl') || !!canvas.getContext('experimental-webgl');
        } catch (e) {
            return false;
        }
    }
    
    testLocalStorage() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    assessNetworkQuality() {
        const connection = navigator.connection;
        if (!connection) return 'good';
        
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') return 'excellent';
        if (effectiveType === '3g') return 'good';
        if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'poor';
        return 'fair';
    }
    
    classifyDevice(capabilities) {
        const memory = capabilities.deviceMemory || 4;
        const hasWebGL = capabilities.webGL;
        const isHighDPI = capabilities.highDPI;
        
        if (memory >= 8 && hasWebGL && isHighDPI) return 'high-end';
        if (memory >= 4 && (hasWebGL || isHighDPI)) return 'mid-range';
        return 'low-end';
    }
    
    async determineLoadingStrategy(enhancementDecision, requestedMode) {
        const { capabilities, networkConditions, performanceMetrics } = enhancementDecision;
        
        // Handle explicit mode requests
        if (requestedMode === 'enhanced') {
            return { useEnhancedUI: true, forced: true };
        }
        if (requestedMode === 'basic') {
            return { useEnhancedUI: false, forced: true };
        }
        
        // Auto-detection logic
        const shouldUseEnhanced = (
            performanceMetrics.deviceClass !== 'low-end' &&
            networkConditions.quality !== 'poor' &&
            !networkConditions.saveData &&
            capabilities.serviceWorker &&
            capabilities.intersectionObserver
        );
        
        const strategy = {
            useEnhancedUI: shouldUseEnhanced,
            lazyLoad: networkConditions.quality === 'fair' || networkConditions.quality === 'poor',
            enableAnimations: performanceMetrics.deviceClass === 'high-end',
            preloadCritical: networkConditions.quality === 'excellent',
            compressionLevel: networkConditions.saveData ? 'maximum' : 'standard'
        };
        
        console.log('📋 Loading strategy determined:', strategy);
        this.loadingStrategy = strategy;
        window.webAutomationConfig.useEnhancedUI = strategy.useEnhancedUI;
        
        return strategy;
    }
    
    async loadUIWithIntelligentFallback(strategy) {
        this.retryCount = 0;
        this.fallbackAttempts = 0;
        
        while (this.retryCount <= this.maxRetries) {
            try {
                await this.updateSubStep('Loading stylesheets');
                
                if (strategy.useEnhancedUI) {
                    console.log(`🎨 Attempting to load Enhanced UI (attempt ${this.retryCount + 1})...`);
                    await this.updateSubStep('Loading JavaScript modules');
                    const uiInstance = await this.loadEnhancedUIWithRecovery();
                    await this.updateSubStep('Preparing UI containers');
                    return uiInstance;
                } else {
                    console.log(`🔧 Loading Basic UI (attempt ${this.retryCount + 1})...`);
                    await this.updateSubStep('Loading basic components');
                    const uiInstance = await this.loadBasicUIWithRecovery();
                    await this.updateSubStep('Preparing basic containers');
                    return uiInstance;
                }
            } catch (error) {
                this.errorHistory.push({ 
                    error, 
                    attempt: this.retryCount + 1, 
                    timestamp: Date.now(),
                    strategy: strategy.useEnhancedUI ? 'enhanced' : 'basic',
                    fallbackAttempt: this.fallbackAttempts
                });
                
                console.warn(`⚠️ UI loading attempt ${this.retryCount + 1} failed:`, error);
                
                this.retryCount++;
                
                if (this.retryCount <= this.maxRetries) {
                    // Intelligent fallback strategy
                    const fallbackStrategy = await this.determineFallbackStrategy(error, strategy);
                    
                    if (fallbackStrategy) {
                        Object.assign(strategy, fallbackStrategy);
                        this.updateLoadingText(`Trying ${fallbackStrategy.description}... (${this.retryCount}/${this.maxRetries})`);
                        
                        // Progressive delay with jitter
                        const delay = (1000 * this.retryCount) + (Math.random() * 500);
                        await this.delay(delay);
                    } else {
                        throw error; // No more fallback options
                    }
                } else {
                    throw new Error(`All UI loading attempts failed after ${this.maxRetries} retries`);
                }
            }
        }
    }

    async determineFallbackStrategy(error, currentStrategy) {
        this.fallbackAttempts++;
        
        // Analyze error type to determine best fallback
        const errorType = this.categorizeError(error);
        
        switch (errorType) {
            case 'network':
                if (currentStrategy.useEnhancedUI && this.fallbackAttempts === 1) {
                    return {
                        useEnhancedUI: false,
                        description: 'Basic UI due to network issues',
                        reason: 'Network connectivity problems detected'
                    };
                }
                break;
                
            case 'script':
                if (currentStrategy.useEnhancedUI && this.fallbackAttempts === 1) {
                    return {
                        useEnhancedUI: false,
                        description: 'Basic UI due to script loading failure',
                        reason: 'JavaScript module loading failed'
                    };
                }
                break;
                
            case 'memory':
                return {
                    useEnhancedUI: false,
                    uiComplexity: 'minimal',
                    description: 'Minimal UI due to memory constraints',
                    reason: 'Insufficient memory detected'
                };
                
            case 'timeout':
                if (this.fallbackAttempts === 1) {
                    return {
                        useEnhancedUI: false,
                        description: 'Basic UI due to timeout',
                        reason: 'Loading timeout exceeded'
                    };
                }
                break;
        }
        
        // No suitable fallback found
        return null;
    }

    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
            return 'network';
        }
        if (message.includes('script') || message.includes('module') || message.includes('import')) {
            return 'script';
        }
        if (message.includes('memory') || message.includes('heap')) {
            return 'memory';
        }
        if (message.includes('timeout')) {
            return 'timeout';
        }
        
        return 'unknown';
    }
    
    async loadEnhancedUIWithRecovery() {
        // Show enhanced container
        document.getElementById('enhancedApp').style.display = 'block';
        document.getElementById('basicApp').style.display = 'none';
        
        // Load enhanced styles with fallback
        this.updateLoadingText('Loading enhanced styles...');
        this.enableStylesheets(['enhancedStyles', 'componentsStyles', 'themesStyles', 'animationsStyles', 'touchStyles']);
        this.disableStylesheets(['basicStyles']);
        
        // Set up enhanced UI container elements
        const enhancedContainer = document.getElementById('enhancedApp');
        let appElement = document.getElementById('app');
        if (!appElement) {
            appElement = document.createElement('div');
            appElement.id = 'app';
            appElement.className = 'app-container';
            enhancedContainer.appendChild(appElement);
        }
        
        // Load enhanced JavaScript with timeout and retry
        this.updateLoadingText('Loading enhanced components...');
        await window.loadScriptWithRetry('./js/enhanced.js', 'EnhancedApp');
        
        // Create and return enhanced app instance
        if (typeof window.EnhancedApp !== 'undefined') {
            return new window.EnhancedApp();
        } else if (typeof window.EnhancedWebApp !== 'undefined') {
            return new window.EnhancedWebApp();
        } else {
            throw new Error('Enhanced UI class not found after loading script');
        }
    }
    
    async loadBasicUIWithRecovery() {
        // Show basic container
        document.getElementById('basicApp').style.display = 'block';
        document.getElementById('enhancedApp').style.display = 'none';
        
        // Load basic styles
        this.updateLoadingText('Loading basic interface...');
        this.enableStylesheets(['basicStyles']);
        this.disableStylesheets(['enhancedStyles', 'componentsStyles', 'themesStyles', 'animationsStyles', 'touchStyles']);
        
        // Load Basic UI template
        try {
            this.updateLoadingText('Loading basic UI template...');
            await window.templateLoader.loadBasicUI();
            console.log('Basic UI template loaded successfully');
        } catch (error) {
            console.warn('Failed to load Basic UI template, using fallback:', error);
            // Fallback: create basic structure programmatically
            const basicApp = document.getElementById('basicApp');
            basicApp.innerHTML = `
                <div class="container">
                    <header role="banner" class="app-header">
                        <div class="header-content">
                            <h1 class="app-title">VS Code Web Automation Tunnel</h1>
                            <nav role="navigation" aria-label="Connection status and settings">
                                <div class="connection-status" id="basicConnectionStatus" role="status" aria-live="polite">
                                    <span class="status-indicator" id="basicStatusIndicator" aria-hidden="true"></span>
                                    <span id="basicStatusText" aria-label="Connection status">Connecting...</span>
                                </div>
                            </nav>
                        </div>
                    </header>
                    <main id="main-content" role="main" class="app-main" aria-label="Main application content">
                        <section class="command-interface" aria-labelledby="command-interface-heading">
                            <h2 id="command-interface-heading" class="section-heading">Command Interface</h2>
                            <div class="command-form" aria-labelledby="custom-command-heading">
                                <h3 id="custom-command-heading" class="subsection-heading">Custom Command</h3>
                                <form role="form" aria-label="Custom VS Code command execution">
                                    <div class="input-group">
                                        <label for="basicCommandInput" class="input-label">VS Code Command:</label>
                                        <input type="text" id="basicCommandInput" class="command-input" 
                                               placeholder="e.g., workbench.action.files.newUntitledFile"
                                               aria-describedby="command-help" autocomplete="off" spellcheck="false">
                                        <div id="command-help" class="input-help">Enter a VS Code command identifier</div>
                                    </div>
                                    <button id="basicExecuteButton" type="button" class="execute-btn" disabled 
                                            aria-label="Execute the custom command">
                                        <span class="btn-icon" aria-hidden="true">▶️</span>
                                        <span class="btn-text">Execute Command</span>
                                    </button>
                                </form>
                            </div>
                        </section>
                        <section class="message-log" aria-labelledby="message-log-heading">
                            <h2 id="message-log-heading" class="section-heading">Message Log</h2>
                            <div class="log-controls" role="toolbar" aria-label="Log controls">
                                <button id="basicClearLogButton" type="button" class="clear-log-btn" 
                                        aria-label="Clear all log messages">
                                    <span class="btn-icon" aria-hidden="true">🗑️</span>
                                    <span class="btn-text">Clear Log</span>
                                </button>
                            </div>
                            <div class="log-container" id="basicMessageLog" role="log" aria-live="polite" 
                                 aria-label="Application message log" tabindex="0"></div>
                        </section>
                    </main>
                </div>
            `;
        }
        
        // Update element IDs for basic UI compatibility
        window.updateBasicUIElementIds();
        
        // Load basic JavaScript with timeout and retry
        this.updateLoadingText('Initializing basic components...');
        await window.loadScriptWithRetry('./js/basic.js', 'BasicApp');
        
        // Create and return basic app instance
        if (typeof window.BasicApp !== 'undefined') {
            return new window.BasicApp();
        } else {
            throw new Error('Basic UI class not found after loading script');
        }
    }
    
    enableStylesheets(ids) {
        ids.forEach(id => {
            const stylesheet = document.getElementById(id);
            if (stylesheet) stylesheet.disabled = false;
        });
    }
    
    disableStylesheets(ids) {
        ids.forEach(id => {
            const stylesheet = document.getElementById(id);
            if (stylesheet) stylesheet.disabled = true;
        });
    }
    
    async initializeUIComponentsWithErrorBoundaries(uiInstance, strategy) {
        if (!uiInstance) {
            throw new Error('No UI instance to initialize');
        }
        
        await this.updateSubStep('Creating UI instance');
        
        // Initialize with comprehensive error handling
        const initTimeout = setTimeout(() => {
            throw new Error('UI initialization timeout');
        }, 15000);
        
        try {
            // Set up error boundary for UI instance
            this.setupUIErrorBoundary(uiInstance);
            
            await this.updateSubStep('Setting up event handlers');
            
            if (typeof uiInstance.initialize === 'function') {
                // Initialize with progress tracking
                await this.initializeWithProgress(uiInstance, strategy);
            } else {
                console.warn('⚠️ UI instance has no initialize method, using fallback initialization');
                await this.fallbackInitialization(uiInstance, strategy);
            }
            
            clearTimeout(initTimeout);
            
            await this.updateSubStep('Initializing services');
            
            // Store reference for later use with error handling
            this.storeUIReference(uiInstance, strategy);
            
            // Verify initialization success
            await this.verifyInitialization(uiInstance, strategy);
            
        } catch (error) {
            clearTimeout(initTimeout);
            console.error('❌ UI initialization failed:', error);
            
            // Attempt graceful degradation
            const fallbackInstance = await this.attemptInitializationFallback(error, strategy);
            if (fallbackInstance) {
                return fallbackInstance;
            }
            
            throw error;
        }
        
        return uiInstance;
    }

    async initializeWithProgress(uiInstance, strategy) {
        // Track initialization progress
        const initSteps = [
            { name: 'Core initialization', weight: 40 },
            { name: 'Event handlers setup', weight: 30 },
            { name: 'Service connections', weight: 30 }
        ];
        
        let completedWeight = 0;
        
        for (const step of initSteps) {
            try {
                this.updateLoadingText(`${step.name}...`);
                
                if (step.name === 'Core initialization') {
                    await uiInstance.initialize();
                } else if (step.name === 'Event handlers setup') {
                    await this.setupEventHandlers(uiInstance);
                } else if (step.name === 'Service connections') {
                    await this.setupServiceConnections(uiInstance, strategy);
                }
                
                completedWeight += step.weight;
                this.updateProgress(70 + (completedWeight / 100) * 25); // 70-95% range
                
            } catch (error) {
                console.warn(`⚠️ ${step.name} failed:`, error);
                // Continue with other steps unless critical
                if (step.name === 'Core initialization') {
                    throw error;
                }
            }
        }
    }

    async setupEventHandlers(uiInstance) {
        try {
            // Set up global error handlers for the UI instance
            if (typeof uiInstance.setupErrorHandlers === 'function') {
                await uiInstance.setupErrorHandlers();
            }
            
            // Set up performance monitoring
            if (typeof uiInstance.setupPerformanceMonitoring === 'function') {
                await uiInstance.setupPerformanceMonitoring();
            }
            
        } catch (error) {
            console.warn('⚠️ Event handler setup failed:', error);
            // Non-critical, continue
        }
    }

    async setupServiceConnections(uiInstance, strategy) {
        try {
            // Set up WebSocket connections if available
            if (typeof uiInstance.setupWebSocket === 'function') {
                await uiInstance.setupWebSocket();
            }
            
            // Set up service worker if enabled
            if (strategy.enableServiceWorker && 'serviceWorker' in navigator) {
                await this.setupServiceWorker();
            }
            
        } catch (error) {
            console.warn('⚠️ Service connection setup failed:', error);
            // Non-critical, continue
        }
    }

    setupUIErrorBoundary(uiInstance) {
        // Wrap critical UI methods with error boundaries
        const criticalMethods = ['render', 'update', 'handleMessage', 'handleEvent'];
        
        criticalMethods.forEach(methodName => {
            if (typeof uiInstance[methodName] === 'function') {
                const originalMethod = uiInstance[methodName];
                uiInstance[methodName] = async (...args) => {
                    try {
                        return await originalMethod.apply(uiInstance, args);
                    } catch (error) {
                        console.error(`❌ UI method ${methodName} failed:`, error);
                        this.handleUIMethodError(error, methodName, uiInstance);
                        throw error;
                    }
                };
            }
        });
    }

    handleUIMethodError(error, methodName, uiInstance) {
        // Log error for debugging
        this.errorHistory.push({
            type: 'ui-method-error',
            method: methodName,
            error: error,
            timestamp: Date.now(),
            uiType: uiInstance.constructor.name
        });
        
        // Attempt recovery based on method type
        if (methodName === 'render') {
            this.attemptRenderRecovery(uiInstance);
        } else if (methodName === 'handleMessage') {
            this.attemptMessageHandlingRecovery(uiInstance);
        }
    }

    async attemptRenderRecovery(uiInstance) {
        try {
            console.log('🔄 Attempting render recovery...');
            
            // Clear potentially corrupted DOM state
            const container = document.getElementById(uiInstance.containerId || 'app');
            if (container) {
                container.innerHTML = '<div class="recovery-message">Recovering interface...</div>';
            }
            
            // Attempt re-initialization
            if (typeof uiInstance.reinitialize === 'function') {
                await uiInstance.reinitialize();
            }
            
        } catch (recoveryError) {
            console.error('❌ Render recovery failed:', recoveryError);
        }
    }

    async attemptMessageHandlingRecovery(uiInstance) {
        try {
            console.log('🔄 Attempting message handling recovery...');
            
            // Reset message queue if available
            if (uiInstance.messageQueue) {
                uiInstance.messageQueue = [];
            }
            
            // Re-establish WebSocket connection if needed
            if (typeof uiInstance.reconnectWebSocket === 'function') {
                await uiInstance.reconnectWebSocket();
            }
            
        } catch (recoveryError) {
            console.error('❌ Message handling recovery failed:', recoveryError);
        }
    }
    
    async finalizeUISetupWithMonitoring(uiInstance, strategy) {
        await this.updateSubStep('Configuring message handling');
        
        // Set up comprehensive message handling for VS Code webview
        if (window.webAutomationConfig.isVSCodeWebview) {
            this.setupRobustMessageHandling(uiInstance);
        }
        
        await this.updateSubStep('Setting up monitoring');
        
        // Set up health monitoring
        this.setupHealthMonitoring(uiInstance, strategy);
        
        // Set up performance monitoring
        this.setupPerformanceMonitoring(uiInstance);
        
        await this.updateSubStep('Completing initialization');
        
        // Final progress update
        this.updateProgress(100);
        this.updateLoadingText('Ready!');
        
        // Brief delay for user feedback with smooth transition
        await this.delay(500);
        
        // Trigger completion event
        this.triggerCompletionEvent(uiInstance, strategy);
    }

    setupRobustMessageHandling(uiInstance) {
        const messageHandler = (event) => {
            try {
                const message = event.data;
                
                if (uiInstance && typeof uiInstance.handleMessage === 'function') {
                    uiInstance.handleMessage(message);
                } else {
                    console.warn('⚠️ UI instance cannot handle message:', message);
                    // Queue message for later processing
                    this.queueMessage(message);
                }
                
            } catch (error) {
                console.error('❌ Message handling error:', error);
                this.handleMessageError(error, event.data);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Store reference for cleanup
        this.messageHandler = messageHandler;
    }

    queueMessage(message) {
        if (!this.messageQueue) {
            this.messageQueue = [];
        }
        
        this.messageQueue.push({
            message,
            timestamp: Date.now()
        });
        
        // Limit queue size
        if (this.messageQueue.length > 100) {
            this.messageQueue = this.messageQueue.slice(-50);
        }
    }

    handleMessageError(error, message) {
        this.errorHistory.push({
            type: 'message-handling-error',
            error: error,
            message: message,
            timestamp: Date.now()
        });
        
        // Attempt to recover message handling
        setTimeout(() => {
            this.attemptMessageRecovery();
        }, 1000);
    }

    setupHealthMonitoring(uiInstance, strategy) {
        // Monitor UI health every 30 seconds
        this.healthMonitorInterval = setInterval(() => {
            this.checkUIHealth(uiInstance, strategy);
        }, 30000);
        
        // Monitor for memory leaks
        if (performance.memory) {
            this.memoryMonitorInterval = setInterval(() => {
                this.checkMemoryUsage();
            }, 60000);
        }
    }

    checkUIHealth(uiInstance, strategy) {
        try {
            // Check if UI instance is still responsive
            if (!uiInstance || typeof uiInstance.isHealthy === 'function') {
                const isHealthy = uiInstance.isHealthy();
                if (!isHealthy) {
                    console.warn('⚠️ UI health check failed, attempting recovery...');
                    this.attemptHealthRecovery(uiInstance);
                }
            }
            
            // Check DOM integrity
            const container = document.getElementById(strategy.useEnhancedUI ? 'enhancedApp' : 'basicApp');
            if (!container || container.children.length === 0) {
                console.warn('⚠️ UI container is empty, attempting recovery...');
                this.attemptContainerRecovery(uiInstance, strategy);
            }
            
        } catch (error) {
            console.error('❌ Health monitoring error:', error);
        }
    }

    checkMemoryUsage() {
        if (performance.memory) {
            const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            
            if (memoryUsage > 0.85) {
                console.warn('⚠️ High memory usage detected:', memoryUsage);
                this.handleHighMemoryUsage();
            }
        }
    }

    handleHighMemoryUsage() {
        // Trigger garbage collection if possible
        if (window.gc) {
            window.gc();
        }
        
        // Clear old error history
        if (this.errorHistory.length > 10) {
            this.errorHistory = this.errorHistory.slice(-5);
        }
        
        // Clear message queue
        if (this.messageQueue && this.messageQueue.length > 10) {
            this.messageQueue = this.messageQueue.slice(-5);
        }
    }

    setupPerformanceMonitoring(uiInstance) {
        // Monitor Core Web Vitals
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.handlePerformanceEntry(entry);
                    }
                });
                
                observer.observe({ 
                    entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] 
                });
                
                this.performanceObserver = observer;
                
            } catch (error) {
                console.warn('⚠️ Performance monitoring setup failed:', error);
            }
        }
    }

    handlePerformanceEntry(entry) {
        // Log significant performance events
        if (entry.entryType === 'largest-contentful-paint' && entry.startTime > 2500) {
            console.warn('⚠️ Slow LCP detected:', entry.startTime);
        }
        
        if (entry.entryType === 'first-input' && entry.processingStart - entry.startTime > 100) {
            console.warn('⚠️ Slow FID detected:', entry.processingStart - entry.startTime);
        }
        
        if (entry.entryType === 'layout-shift' && entry.value > 0.1) {
            console.warn('⚠️ High CLS detected:', entry.value);
        }
    }

    triggerCompletionEvent(uiInstance, strategy) {
        const completionEvent = new CustomEvent('ui-loader-complete', {
            detail: {
                uiInstance,
                strategy,
                loadingTime: Date.now() - this.startTime,
                errorHistory: this.errorHistory,
                fallbackAttempts: this.fallbackAttempts
            }
        });
        
        document.dispatchEvent(completionEvent);
    }
    
    async hideLoadingScreenWithTransition() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;
        
        // Trigger transition start event
        const transitionEvent = new CustomEvent('ui-loader-transition-start', {
            detail: { phase: 'hiding-loading-screen' }
        });
        document.dispatchEvent(transitionEvent);
        
        // Enhanced transition with multiple phases
        await this.performSmoothTransition(loadingScreen);
        
        // Trigger transition complete event
        const completeEvent = new CustomEvent('ui-loader-transition-complete', {
            detail: { phase: 'loading-screen-hidden' }
        });
        document.dispatchEvent(completeEvent);
    }

    async performSmoothTransition(loadingScreen) {
        // Phase 1: Fade out progress bar
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.transition = 'opacity 0.2s ease-out';
            progressBar.style.opacity = '0';
            await this.delay(200);
        }
        
        // Phase 2: Fade out text
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.style.transition = 'opacity 0.2s ease-out';
            loadingText.style.opacity = '0';
            await this.delay(200);
        }
        
        // Phase 3: Scale and fade out entire screen
        loadingScreen.style.transition = `opacity ${this.transitionDuration}ms ease-out, transform ${this.transitionDuration}ms ease-out`;
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transform = 'scale(0.95)';
        
        // Wait for animation to complete
        await this.delay(this.transitionDuration);
        
        // Phase 4: Remove from DOM with cleanup
        this.cleanupLoadingScreen(loadingScreen);
    }

    cleanupLoadingScreen(loadingScreen) {
        try {
            // Remove event listeners
            loadingScreen.removeEventListener('transitionend', this.handleTransitionEnd);
            
            // Clear any intervals or timeouts
            if (this.progressUpdateInterval) {
                clearInterval(this.progressUpdateInterval);
            }
            
            // Remove from DOM
            if (loadingScreen.parentNode) {
                loadingScreen.parentNode.removeChild(loadingScreen);
            }
            
            console.log('✅ Loading screen cleanup completed');
            
        } catch (error) {
            console.warn('⚠️ Loading screen cleanup error:', error);
        }
    }

    handleTransitionEnd(event) {
        console.log('🎬 Transition ended:', event.propertyName);
    }

    setupErrorHandling() {
        // Set up comprehensive error handling
        this.startTime = Date.now();
        
        // Global error handler
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, 'global-error');
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason, 'unhandled-rejection');
        });
        
        // Set up loading state callbacks
        this.setupLoadingStateCallbacks();
    }

    setupLoadingStateCallbacks() {
        // Allow external code to register callbacks for loading state changes
        this.loadingStateCallbacks.set('progress', []);
        this.loadingStateCallbacks.set('error', []);
        this.loadingStateCallbacks.set('complete', []);
        this.loadingStateCallbacks.set('fallback', []);
    }

    handleGlobalError(error, type) {
        this.errorHistory.push({
            type: type,
            error: error,
            timestamp: Date.now(),
            loadingState: this.loadingState
        });
        
        // If error occurs during loading, it might affect the loading process
        if (this.loadingState !== 'completed') {
            console.warn('⚠️ Error during loading process:', error);
        }
    }

    setupPostInitializationMonitoring(uiInstance) {
        // Monitor for post-initialization issues
        setTimeout(() => {
            this.performPostInitializationCheck(uiInstance);
        }, 5000);
        
        // Set up periodic health checks
        this.setupPeriodicHealthChecks(uiInstance);
    }

    async performPostInitializationCheck(uiInstance) {
        try {
            console.log('🔍 Performing post-initialization check...');
            
            // Check if UI is still responsive
            if (uiInstance && typeof uiInstance.isHealthy === 'function') {
                const isHealthy = uiInstance.isHealthy();
                if (!isHealthy) {
                    console.warn('⚠️ UI health check failed after initialization');
                    this.handlePostInitializationFailure(uiInstance);
                }
            }
            
            // Check DOM integrity
            const activeContainer = document.querySelector('.ui-container[style*="block"]');
            if (!activeContainer) {
                console.warn('⚠️ No active UI container found after initialization');
                this.handleMissingContainer();
            }
            
            console.log('✅ Post-initialization check completed');
            
        } catch (error) {
            console.error('❌ Post-initialization check failed:', error);
        }
    }

    setupPeriodicHealthChecks(uiInstance) {
        // Check every 2 minutes
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck(uiInstance);
        }, 120000);
    }

    async performHealthCheck(uiInstance) {
        try {
            // Basic responsiveness check
            if (uiInstance && typeof uiInstance.ping === 'function') {
                const response = await Promise.race([
                    uiInstance.ping(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
                ]);
                
                if (!response) {
                    console.warn('⚠️ UI health check failed - no response');
                    this.handleHealthCheckFailure(uiInstance);
                }
            }
            
        } catch (error) {
            console.warn('⚠️ Health check error:', error);
            this.handleHealthCheckFailure(uiInstance);
        }
    }

    handlePostInitializationFailure(uiInstance) {
        console.log('🔄 Handling post-initialization failure...');
        
        // Attempt to reinitialize
        if (typeof uiInstance.reinitialize === 'function') {
            uiInstance.reinitialize().catch(error => {
                console.error('❌ Reinitialization failed:', error);
            });
        }
    }

    handleMissingContainer() {
        console.log('🔄 Handling missing container...');
        
        // Try to restore the UI container
        const basicApp = document.getElementById('basicApp');
        const enhancedApp = document.getElementById('enhancedApp');
        
        if (basicApp && basicApp.style.display === 'none') {
            basicApp.style.display = 'block';
        } else if (enhancedApp && enhancedApp.style.display === 'none') {
            enhancedApp.style.display = 'block';
        }
    }

    handleHealthCheckFailure(uiInstance) {
        console.warn('⚠️ Periodic health check failed');
        
        // Log the failure
        this.errorHistory.push({
            type: 'health-check-failure',
            timestamp: Date.now(),
            uiType: uiInstance?.constructor?.name || 'unknown'
        });
        
        // Attempt recovery if too many failures
        const recentFailures = this.errorHistory.filter(
            entry => entry.type === 'health-check-failure' && 
                    Date.now() - entry.timestamp < 300000 // 5 minutes
        );
        
        if (recentFailures.length >= 3) {
            console.warn('⚠️ Multiple health check failures detected, attempting recovery...');
            this.attemptHealthRecovery(uiInstance);
        }
    }

    async attemptHealthRecovery(uiInstance) {
        try {
            console.log('🔄 Attempting health recovery...');
            
            // Clear error history to prevent cascading failures
            this.errorHistory = this.errorHistory.slice(-5);
            
            // Attempt to restart the UI
            if (typeof uiInstance.restart === 'function') {
                await uiInstance.restart();
            } else if (typeof uiInstance.reinitialize === 'function') {
                await uiInstance.reinitialize();
            } else {
                // Last resort: reload the page
                console.log('🔄 No recovery methods available, reloading page...');
                setTimeout(() => location.reload(), 2000);
            }
            
        } catch (error) {
            console.error('❌ Health recovery failed:', error);
        }
    }

    // Cleanup method
    cleanup() {
        // Clear all intervals
        if (this.healthMonitorInterval) clearInterval(this.healthMonitorInterval);
        if (this.memoryMonitorInterval) clearInterval(this.memoryMonitorInterval);
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
        if (this.progressUpdateInterval) clearInterval(this.progressUpdateInterval);
        
        // Disconnect observers
        if (this.performanceObserver) this.performanceObserver.disconnect();
        
        // Remove event listeners
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
        }
        
        console.log('✅ UI Loader cleanup completed');
    }
    
    handleLoadingTimeout() {
        console.error('❌ UI loading timeout after', this.loadingTimeout, 'ms');
        
        const errorScreen = this.createTimeoutErrorScreen();
        document.body.appendChild(errorScreen);
    }
    
    async attemptRecovery(error) {
        console.log('🔄 Attempting intelligent recovery...');
        
        // Try recovery strategies in order of preference
        for (const strategy of this.recoveryStrategies) {
            if (strategy.condition()) {
                try {
                    console.log(`🔄 Trying recovery strategy: ${strategy.name}`);
                    this.updateLoadingText(`Recovery: ${strategy.description}...`);
                    
                    const result = await strategy.action();
                    if (result) {
                        console.log(`✅ Recovery successful with strategy: ${strategy.name}`);
                        return result;
                    }
                    
                } catch (recoveryError) {
                    console.warn(`⚠️ Recovery strategy ${strategy.name} failed:`, recoveryError);
                    this.errorHistory.push({
                        type: 'recovery-attempt',
                        strategy: strategy.name,
                        error: recoveryError,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
        // All recovery strategies failed
        throw new Error('All recovery strategies exhausted');
    }

    async retryEnhancedUIWithFallback() {
        try {
            // Retry with reduced complexity
            const fallbackStrategy = {
                useEnhancedUI: true,
                uiComplexity: 'medium',
                enableAnimations: false,
                lazyLoadImages: true,
                preloadCritical: false
            };
            
            return await this.loadEnhancedUIWithRecovery(fallbackStrategy);
            
        } catch (error) {
            console.warn('⚠️ Enhanced UI retry failed:', error);
            throw error;
        }
    }

    async fallbackToBasicUI() {
        try {
            console.log('🔧 Falling back to Basic UI...');
            
            const basicStrategy = {
                useEnhancedUI: false,
                uiComplexity: 'basic'
            };
            
            const basicApp = await this.loadBasicUIWithRecovery();
            await this.initializeUIComponentsWithErrorBoundaries(basicApp, basicStrategy);
            
            // Show fallback notification
            this.showFallbackNotification('basic');
            
            return basicApp;
            
        } catch (error) {
            console.warn('⚠️ Basic UI fallback failed:', error);
            throw error;
        }
    }

    async fallbackToMinimalUI() {
        try {
            console.log('🔧 Falling back to Minimal UI...');
            
            // Create minimal UI programmatically
            const minimalApp = this.createMinimalUI();
            
            // Show fallback notification
            this.showFallbackNotification('minimal');
            
            return minimalApp;
            
        } catch (error) {
            console.warn('⚠️ Minimal UI fallback failed:', error);
            throw error;
        }
    }

    createMinimalUI() {
        // Create a very basic UI instance
        const minimalContainer = document.getElementById('basicApp') || document.createElement('div');
        minimalContainer.id = 'basicApp';
        minimalContainer.style.display = 'block';
        
        // Hide other containers
        const enhancedContainer = document.getElementById('enhancedApp');
        if (enhancedContainer) enhancedContainer.style.display = 'none';
        
        minimalContainer.innerHTML = `
            <div class="minimal-ui">
                <header class="minimal-header">
                    <h1>VS Code Web Automation Tunnel</h1>
                    <div class="status">Running in Safe Mode</div>
                </header>
                <main class="minimal-main">
                    <div class="minimal-message">
                        <p>The interface is running in safe mode due to loading issues.</p>
                        <p>Basic functionality is available.</p>
                        <button onclick="location.reload()" class="reload-btn">Reload Page</button>
                    </div>
                </main>
            </div>
        `;
        
        if (!document.body.contains(minimalContainer)) {
            document.body.appendChild(minimalContainer);
        }
        
        // Create minimal app instance
        return {
            initialize: async () => {
                console.log('Minimal UI initialized');
            },
            handleMessage: (message) => {
                console.log('Minimal UI received message:', message);
            },
            isHealthy: () => true
        };
    }

    async emergencyFallback() {
        try {
            console.log('🚨 Emergency fallback activated...');
            
            // Remove loading screen immediately
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.remove();
            }
            
            // Create emergency UI
            const emergencyContainer = document.createElement('div');
            emergencyContainer.className = 'emergency-ui';
            emergencyContainer.innerHTML = `
                <div class="emergency-content">
                    <h1>⚠️ System Recovery Mode</h1>
                    <p>The application encountered critical errors and is running in recovery mode.</p>
                    <div class="emergency-actions">
                        <button onclick="location.reload()" class="emergency-btn primary">Reload Application</button>
                        <button onclick="window.location.search='?ui=basic'" class="emergency-btn">Try Basic Mode</button>
                        <button onclick="window.downloadErrorLogs?.()" class="emergency-btn">Download Error Log</button>
                    </div>
                    <details class="emergency-details">
                        <summary>Technical Details</summary>
                        <pre class="error-log">${this.formatErrorHistory()}</pre>
                    </details>
                </div>
            `;
            
            document.body.appendChild(emergencyContainer);
            
            return {
                initialize: async () => {
                    console.log('Emergency UI initialized');
                },
                handleMessage: () => {},
                isHealthy: () => false
            };
            
        } catch (error) {
            console.error('❌ Emergency fallback failed:', error);
            throw error;
        }
    }

    async handleCriticalLoadingError(error) {
        console.error('❌ Critical loading error - all recovery attempts failed:', error);
        
        try {
            // Last resort: emergency fallback
            return await this.emergencyFallback();
            
        } catch (emergencyError) {
            console.error('❌ Emergency fallback failed:', emergencyError);
            
            // Show critical error screen
            const errorScreen = this.createCriticalErrorScreen(error, emergencyError);
            document.body.appendChild(errorScreen);
            
            throw new Error('Complete UI loading failure - all recovery mechanisms exhausted');
        }
    }

    showFallbackNotification(uiType) {
        const notification = document.createElement('div');
        notification.className = 'fallback-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">⚠️</div>
                <div class="notification-body">
                    <div class="notification-title">Fallback Mode Active</div>
                    <div class="notification-message">
                        Running in ${uiType} mode due to loading issues. Some features may be limited.
                    </div>
                    <div class="notification-actions">
                        <button class="notification-btn" onclick="this.closest('.fallback-notification').remove()">
                            Dismiss
                        </button>
                        <button class="notification-btn secondary" onclick="location.reload()">
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 15000);
    }

    formatErrorHistory() {
        return this.errorHistory.map(entry => {
            return `[${new Date(entry.timestamp).toISOString()}] ${entry.type || 'error'}: ${entry.error?.message || entry.error}`;
        }).join('\n');
    }
    
    updateStep(stepId) {
        this.currentStep++;
        const step = this.loadingSteps.find(s => s.id === stepId);
        if (step) {
            console.log(`📋 Step ${this.currentStep}/${this.loadingSteps.length}: ${step.name}`);
            this.updateLoadingText(step.name);
            this.currentSubStep = 0;
            
            // Calculate progress based on completed steps
            const completedWeight = this.loadingSteps.slice(0, this.currentStep - 1)
                .reduce((sum, s) => sum + s.weight, 0);
            const progress = (completedWeight / 100) * 100;
            this.updateProgress(Math.min(progress, 95)); // Cap at 95% until completion
            
            // Trigger step change event
            this.triggerStepChangeEvent(step);
        }
    }

    async updateSubStep(subStepName) {
        const currentStep = this.loadingSteps[this.currentStep - 1];
        if (currentStep && currentStep.subSteps) {
            this.currentSubStep = (this.currentSubStep || 0) + 1;
            
            console.log(`  📋 Sub-step: ${subStepName}`);
            this.updateLoadingText(subStepName);
            
            // Calculate sub-step progress
            const stepProgress = (this.currentSubStep / currentStep.subSteps.length) * currentStep.weight;
            const baseProgress = this.loadingSteps.slice(0, this.currentStep - 1)
                .reduce((sum, s) => sum + s.weight, 0);
            const totalProgress = (baseProgress + stepProgress) / 100 * 100;
            
            this.updateProgress(Math.min(totalProgress, 95));
            
            // Add smooth transition delay
            await this.delay(100);
        }
    }

    triggerStepChangeEvent(step) {
        const stepEvent = new CustomEvent('ui-loader-step-change', {
            detail: {
                step: step,
                currentStep: this.currentStep,
                totalSteps: this.loadingSteps.length,
                progress: this.calculateCurrentProgress()
            }
        });
        
        document.dispatchEvent(stepEvent);
    }

    calculateCurrentProgress() {
        const completedWeight = this.loadingSteps.slice(0, this.currentStep - 1)
            .reduce((sum, s) => sum + s.weight, 0);
        return (completedWeight / 100) * 100;
    }
    
    updateLoadingState(state) {
        this.loadingState = state;
        console.log(`🔄 Loading state: ${state}`);
    }
    
    updateLoadingText(text) {
        const loadingText = document.getElementById('loadingText');
        if (loadingText) {
            loadingText.textContent = text;
        }
    }
    
    updateProgress(percentage) {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        }
        
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.setAttribute('aria-valuenow', percentage.toString());
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Error screen creation methods will be defined in error-handling.js
    createTimeoutErrorScreen() {
        return window.createTimeoutErrorScreen();
    }
    
    createCriticalErrorScreen(primaryError, emergencyError) {
        return window.createCriticalErrorScreen(primaryError, emergencyError);
    }
    
    showRecoveryNotification() {
        return window.showRecoveryNotification();
    }
}

    // Additional utility methods
    storeUIReference(uiInstance, strategy) {
        try {
            if (strategy.useEnhancedUI) {
                window.enhancedApp = uiInstance;
                console.log('✅ Enhanced UI reference stored');
            } else {
                window.basicApp = uiInstance;
                console.log('✅ Basic UI reference stored');
            }
            
            // Store in global config
            window.webAutomationConfig.currentUI = uiInstance;
            window.webAutomationConfig.currentStrategy = strategy;
            
        } catch (error) {
            console.warn('⚠️ Failed to store UI reference:', error);
        }
    }

    async verifyInitialization(uiInstance, strategy) {
        try {
            // Verify UI instance has required methods
            const requiredMethods = ['initialize', 'handleMessage'];
            const missingMethods = requiredMethods.filter(method => 
                typeof uiInstance[method] !== 'function'
            );
            
            if (missingMethods.length > 0) {
                console.warn('⚠️ UI instance missing methods:', missingMethods);
            }
            
            // Verify DOM structure
            const containerId = strategy.useEnhancedUI ? 'enhancedApp' : 'basicApp';
            const container = document.getElementById(containerId);
            
            if (!container || container.style.display === 'none') {
                throw new Error(`UI container ${containerId} not visible`);
            }
            
            // Verify basic functionality
            if (typeof uiInstance.ping === 'function') {
                await uiInstance.ping();
            }
            
            console.log('✅ UI initialization verified');
            
        } catch (error) {
            console.warn('⚠️ UI initialization verification failed:', error);
            throw error;
        }
    }

    async fallbackInitialization(uiInstance, strategy) {
        console.log('🔄 Performing fallback initialization...');
        
        try {
            // Basic initialization without advanced features
            if (uiInstance.container) {
                uiInstance.container.style.display = 'block';
            }
            
            // Set up basic event handling
            if (typeof uiInstance.setupBasicEvents === 'function') {
                uiInstance.setupBasicEvents();
            }
            
            console.log('✅ Fallback initialization completed');
            
        } catch (error) {
            console.error('❌ Fallback initialization failed:', error);
            throw error;
        }
    }

    async attemptInitializationFallback(error, strategy) {
        console.log('🔄 Attempting initialization fallback...');
        
        try {
            // Create a minimal working UI instance
            const fallbackInstance = {
                initialize: async () => {
                    console.log('Fallback UI initialized');
                },
                handleMessage: (message) => {
                    console.log('Fallback UI received message:', message);
                },
                isHealthy: () => true,
                ping: async () => true
            };
            
            // Set up basic container
            const containerId = strategy.useEnhancedUI ? 'enhancedApp' : 'basicApp';
            const container = document.getElementById(containerId);
            
            if (container) {
                container.style.display = 'block';
                container.innerHTML = `
                    <div class="fallback-ui">
                        <div class="fallback-message">
                            <h2>Limited Functionality Mode</h2>
                            <p>The interface is running with limited functionality due to initialization issues.</p>
                        </div>
                    </div>
                `;
            }
            
            return fallbackInstance;
            
        } catch (fallbackError) {
            console.error('❌ Initialization fallback failed:', fallbackError);
            return null;
        }
    }

    async attemptMessageRecovery() {
        try {
            console.log('🔄 Attempting message handling recovery...');
            
            // Process queued messages if any
            if (this.messageQueue && this.messageQueue.length > 0) {
                const currentUI = window.webAutomationConfig.currentUI;
                
                if (currentUI && typeof currentUI.handleMessage === 'function') {
                    for (const queuedMessage of this.messageQueue) {
                        try {
                            currentUI.handleMessage(queuedMessage.message);
                        } catch (error) {
                            console.warn('⚠️ Failed to process queued message:', error);
                        }
                    }
                    
                    // Clear processed messages
                    this.messageQueue = [];
                }
            }
            
        } catch (error) {
            console.error('❌ Message recovery failed:', error);
        }
    }

    async attemptContainerRecovery(uiInstance, strategy) {
        try {
            console.log('🔄 Attempting container recovery...');
            
            const containerId = strategy.useEnhancedUI ? 'enhancedApp' : 'basicApp';
            let container = document.getElementById(containerId);
            
            if (!container) {
                // Create missing container
                container = document.createElement('div');
                container.id = containerId;
                container.className = 'ui-container';
                document.body.appendChild(container);
            }
            
            container.style.display = 'block';
            
            // Attempt to re-render UI
            if (typeof uiInstance.render === 'function') {
                await uiInstance.render();
            }
            
            console.log('✅ Container recovery completed');
            
        } catch (error) {
            console.error('❌ Container recovery failed:', error);
        }
    }

    async setupServiceWorker() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('✅ Service Worker registered:', registration);
                return registration;
            }
        } catch (error) {
            console.warn('⚠️ Service Worker registration failed:', error);
        }
    }

    // Public API methods for external use
    onLoadingStateChange(state, callback) {
        if (!this.loadingStateCallbacks.has(state)) {
            this.loadingStateCallbacks.set(state, []);
        }
        this.loadingStateCallbacks.get(state).push(callback);
    }

    removeLoadingStateCallback(state, callback) {
        if (this.loadingStateCallbacks.has(state)) {
            const callbacks = this.loadingStateCallbacks.get(state);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    getLoadingState() {
        return {
            state: this.loadingState,
            currentStep: this.currentStep,
            totalSteps: this.loadingSteps.length,
            progress: this.calculateCurrentProgress(),
            errorHistory: this.errorHistory,
            fallbackAttempts: this.fallbackAttempts
        };
    }

    getErrorHistory() {
        return [...this.errorHistory];
    }

    clearErrorHistory() {
        this.errorHistory = [];
    }
}

// Export for use in other modules
window.EnhancedUILoader = EnhancedUILoader;