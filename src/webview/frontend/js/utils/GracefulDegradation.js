/**
 * Graceful Degradation Utility
 * Handles feature unavailability and provides fallback functionality
 */

export class GracefulDegradation {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Feature availability tracking
        this.featureAvailability = new Map();
        this.featureFallbacks = new Map();
        this.disabledFeatures = new Set();
        
        // Feature categories
        this.featureCategories = {
            CORE: 'core',
            COMMUNICATION: 'communication',
            FILE_SYSTEM: 'file-system',
            GIT: 'git',
            PROMPT: 'prompt',
            UI: 'ui',
            PERFORMANCE: 'performance'
        };
        
        // Initialize feature definitions
        this.initializeFeatures();
        
        // Setup feature monitoring
        this.setupFeatureMonitoring();
    }

    /**
     * Initialize feature definitions
     */
    initializeFeatures() {
        // Core features
        this.defineFeature('websocket-connection', {
            category: this.featureCategories.COMMUNICATION,
            required: false,
            fallback: 'offline-mode',
            description: 'Real-time WebSocket communication',
            testFunction: () => this.testWebSocketConnection()
        });
        
        this.defineFeature('file-system-access', {
            category: this.featureCategories.FILE_SYSTEM,
            required: false,
            fallback: 'cached-file-tree',
            description: 'File system operations',
            testFunction: () => this.testFileSystemAccess()
        });
        
        this.defineFeature('git-integration', {
            category: this.featureCategories.GIT,
            required: false,
            fallback: 'cached-git-data',
            description: 'Git repository integration',
            testFunction: () => this.testGitIntegration()
        });
        
        this.defineFeature('prompt-persistence', {
            category: this.featureCategories.PROMPT,
            required: false,
            fallback: 'session-storage',
            description: 'Prompt history persistence',
            testFunction: () => this.testPromptPersistence()
        });
        
        this.defineFeature('local-storage', {
            category: this.featureCategories.CORE,
            required: true,
            fallback: 'memory-storage',
            description: 'Browser local storage',
            testFunction: () => this.testLocalStorage()
        });
        
        this.defineFeature('web-workers', {
            category: this.featureCategories.PERFORMANCE,
            required: false,
            fallback: 'main-thread-processing',
            description: 'Web Workers for background processing',
            testFunction: () => this.testWebWorkers()
        });
        
        this.defineFeature('notifications', {
            category: this.featureCategories.UI,
            required: false,
            fallback: 'console-logging',
            description: 'Browser notifications',
            testFunction: () => this.testNotifications()
        });
    }

    /**
     * Define a feature
     */
    defineFeature(name, config) {
        this.featureAvailability.set(name, {
            ...config,
            available: null, // null = not tested, true = available, false = unavailable
            lastTested: null,
            testCount: 0,
            fallbackActive: false
        });
    }

    /**
     * Test feature availability
     */
    async testFeature(featureName) {
        const feature = this.featureAvailability.get(featureName);
        if (!feature) {
            console.warn(`Unknown feature: ${featureName}`);
            return false;
        }
        
        try {
            feature.testCount++;
            feature.lastTested = new Date();
            
            const available = await feature.testFunction();
            feature.available = available;
            
            if (!available && !feature.fallbackActive) {
                this.activateFallback(featureName);
            }
            
            return available;
        } catch (error) {
            console.error(`Feature test failed for ${featureName}:`, error);
            feature.available = false;
            
            if (!feature.fallbackActive) {
                this.activateFallback(featureName);
            }
            
            return false;
        }
    }

    /**
     * Test all features
     */
    async testAllFeatures() {
        const results = {};
        
        for (const featureName of this.featureAvailability.keys()) {
            results[featureName] = await this.testFeature(featureName);
        }
        
        return results;
    }

    /**
     * Activate fallback for a feature
     */
    activateFallback(featureName) {
        const feature = this.featureAvailability.get(featureName);
        if (!feature || feature.fallbackActive) {
            return;
        }
        
        console.log(`🔄 Activating fallback for feature: ${featureName}`);
        
        feature.fallbackActive = true;
        this.disabledFeatures.add(featureName);
        
        // Execute fallback logic
        const fallbackHandler = this.featureFallbacks.get(feature.fallback);
        if (fallbackHandler) {
            fallbackHandler(featureName, feature);
        } else {
            this.executeDefaultFallback(featureName, feature);
        }
        
        // Show user notification for important features
        if (feature.required || feature.category === this.featureCategories.CORE) {
            this.notificationService?.warning(
                'Feature Unavailable',
                `${feature.description} is not available. Using fallback mode.`,
                { duration: 5000 }
            );
        }
    }

    /**
     * Execute default fallback
     */
    executeDefaultFallback(featureName, feature) {
        switch (feature.fallback) {
            case 'offline-mode':
                this.activateOfflineMode();
                break;
            case 'cached-file-tree':
                this.useCachedFileTree();
                break;
            case 'cached-git-data':
                this.useCachedGitData();
                break;
            case 'session-storage':
                this.useSessionStorage();
                break;
            case 'memory-storage':
                this.useMemoryStorage();
                break;
            case 'main-thread-processing':
                this.useMainThreadProcessing();
                break;
            case 'console-logging':
                this.useConsoleLogging();
                break;
            default:
                console.warn(`No fallback handler for: ${feature.fallback}`);
        }
    }

    /**
     * Setup feature monitoring
     */
    setupFeatureMonitoring() {
        // Test features on initialization
        setTimeout(() => {
            this.testAllFeatures();
        }, 1000);
        
        // Periodic feature testing
        setInterval(() => {
            this.retestFailedFeatures();
        }, 300000); // 5 minutes
        
        // Listen for connection changes
        window.addEventListener('online', () => {
            this.retestCommunicationFeatures();
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkOffline();
        });
    }

    /**
     * Retest failed features
     */
    async retestFailedFeatures() {
        const failedFeatures = Array.from(this.featureAvailability.entries())
            .filter(([name, feature]) => feature.available === false)
            .map(([name]) => name);
        
        if (failedFeatures.length === 0) {
            return;
        }
        
        console.log(`🔄 Retesting ${failedFeatures.length} failed features`);
        
        for (const featureName of failedFeatures) {
            const wasAvailable = await this.testFeature(featureName);
            
            if (wasAvailable) {
                this.deactivateFallback(featureName);
            }
        }
    }

    /**
     * Retest communication features
     */
    async retestCommunicationFeatures() {
        const commFeatures = Array.from(this.featureAvailability.entries())
            .filter(([name, feature]) => feature.category === this.featureCategories.COMMUNICATION)
            .map(([name]) => name);
        
        for (const featureName of commFeatures) {
            await this.testFeature(featureName);
        }
    }

    /**
     * Handle network offline
     */
    handleNetworkOffline() {
        // Disable communication features
        const commFeatures = Array.from(this.featureAvailability.entries())
            .filter(([name, feature]) => feature.category === this.featureCategories.COMMUNICATION);
        
        for (const [featureName, feature] of commFeatures) {
            if (feature.available !== false) {
                feature.available = false;
                this.activateFallback(featureName);
            }
        }
    }

    /**
     * Deactivate fallback for a feature
     */
    deactivateFallback(featureName) {
        const feature = this.featureAvailability.get(featureName);
        if (!feature || !feature.fallbackActive) {
            return;
        }
        
        console.log(`✅ Deactivating fallback for feature: ${featureName}`);
        
        feature.fallbackActive = false;
        this.disabledFeatures.delete(featureName);
        
        // Show restoration notification
        this.notificationService?.success(
            'Feature Restored',
            `${feature.description} is now available.`,
            { duration: 3000 }
        );
    }

    // Feature test functions

    async testWebSocketConnection() {
        // Test if WebSocket connection is possible
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = parseInt(window.location.port) + 1;
            const wsUrl = `${protocol}//${window.location.hostname}:${port}`;
            
            return new Promise((resolve) => {
                const testWs = new WebSocket(wsUrl);
                const timeout = setTimeout(() => {
                    testWs.close();
                    resolve(false);
                }, 5000);
                
                testWs.onopen = () => {
                    clearTimeout(timeout);
                    testWs.close();
                    resolve(true);
                };
                
                testWs.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };
            });
        } catch (error) {
            return false;
        }
    }

    async testFileSystemAccess() {
        // Test if file system operations are available
        try {
            // This would typically test VS Code extension communication
            return window.vscode !== undefined;
        } catch (error) {
            return false;
        }
    }

    async testGitIntegration() {
        // Test if git integration is available
        try {
            // This would typically test git command availability
            return window.vscode !== undefined;
        } catch (error) {
            return false;
        }
    }

    async testPromptPersistence() {
        // Test if prompt persistence is available
        try {
            // Test .remoterc folder access
            return window.vscode !== undefined;
        } catch (error) {
            return false;
        }
    }

    async testLocalStorage() {
        try {
            const testKey = 'test-storage';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    async testWebWorkers() {
        try {
            return typeof Worker !== 'undefined';
        } catch (error) {
            return false;
        }
    }

    async testNotifications() {
        try {
            return 'Notification' in window;
        } catch (error) {
            return false;
        }
    }

    // Fallback implementations

    activateOfflineMode() {
        console.log('🔄 Activating offline mode fallback');
        // Trigger offline mode
        const event = new CustomEvent('activate-offline-mode');
        window.dispatchEvent(event);
    }

    useCachedFileTree() {
        console.log('🔄 Using cached file tree');
        // Use cached file system data
        this.stateManager?.updateFileSystem({
            fallbackMode: true,
            fallbackMessage: 'Using cached file data'
        });
    }

    useCachedGitData() {
        console.log('🔄 Using cached git data');
        // Use cached git data
        this.stateManager?.updateGit({
            fallbackMode: true,
            fallbackMessage: 'Using cached git data'
        });
    }

    useSessionStorage() {
        console.log('🔄 Using session storage fallback');
        // Switch to session storage for prompts
    }

    useMemoryStorage() {
        console.log('🔄 Using memory storage fallback');
        // Switch to in-memory storage
    }

    useMainThreadProcessing() {
        console.log('🔄 Using main thread processing');
        // Disable web worker usage
    }

    useConsoleLogging() {
        console.log('🔄 Using console logging fallback');
        // Fallback to console for notifications
    }

    /**
     * Check if feature is available
     */
    isFeatureAvailable(featureName) {
        const feature = this.featureAvailability.get(featureName);
        return feature ? feature.available === true : false;
    }

    /**
     * Check if feature fallback is active
     */
    isFallbackActive(featureName) {
        const feature = this.featureAvailability.get(featureName);
        return feature ? feature.fallbackActive : false;
    }

    /**
     * Get feature status
     */
    getFeatureStatus() {
        const status = {};
        
        for (const [name, feature] of this.featureAvailability.entries()) {
            status[name] = {
                available: feature.available,
                fallbackActive: feature.fallbackActive,
                category: feature.category,
                description: feature.description,
                lastTested: feature.lastTested,
                testCount: feature.testCount
            };
        }
        
        return status;
    }

    /**
     * Get degradation statistics
     */
    getDegradationStatistics() {
        const total = this.featureAvailability.size;
        const available = Array.from(this.featureAvailability.values())
            .filter(f => f.available === true).length;
        const unavailable = Array.from(this.featureAvailability.values())
            .filter(f => f.available === false).length;
        const untested = total - available - unavailable;
        
        return {
            total,
            available,
            unavailable,
            untested,
            fallbacksActive: this.disabledFeatures.size,
            availabilityPercentage: total > 0 ? Math.round((available / total) * 100) : 0
        };
    }

    /**
     * Force feature availability (for testing)
     */
    forceFeatureAvailability(featureName, available) {
        const feature = this.featureAvailability.get(featureName);
        if (feature) {
            feature.available = available;
            
            if (!available && !feature.fallbackActive) {
                this.activateFallback(featureName);
            } else if (available && feature.fallbackActive) {
                this.deactivateFallback(featureName);
            }
        }
    }

    /**
     * Destroy graceful degradation
     */
    destroy() {
        // Clear all data
        this.featureAvailability.clear();
        this.featureFallbacks.clear();
        this.disabledFeatures.clear();
        
        console.log('✅ GracefulDegradation destroyed');
    }
}