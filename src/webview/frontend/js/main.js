/**
 * Unified Web Frontend - Main Application Entry Point
 * Combines enhanced UI with web automation functionality
 */

import { AppShell } from './components/AppShell.js';
import { WebSocketClient } from './services/WebSocketClient.js';
import { StateManager } from './services/StateManager.js';
import { ThemeManager } from './services/ThemeManager.js';
import { NotificationService } from './services/NotificationService.js';
import { KeyboardShortcutService } from './services/KeyboardShortcutService.js';
import { ContextMenuService } from './services/ContextMenuService.js';
import { DragDropService } from './services/DragDropService.js';
import { AnimationService } from './services/AnimationService.js';
import { TouchGestureService } from './services/TouchGestureService.js';
import { ResponsiveLayoutService } from './services/ResponsiveLayoutService.js';
import { ErrorHandlingService } from './services/ErrorHandlingService.js';
import { ConnectionRecoveryService } from './services/ConnectionRecoveryService.js';
import { OfflineModeService } from './services/OfflineModeService.js';
import { WebAutomationService } from './services/WebAutomationService.js';
import { GracefulDegradation } from './utils/GracefulDegradation.js';
import { globalPerformanceIntegration } from './utils/PerformanceIntegration.js';

/**
 * Unified Web Application
 * Main application class that orchestrates all components and services
 */
class UnifiedWebApp {
    constructor() {
        this.appElement = document.getElementById('app');
        this.loadingScreen = document.getElementById('loadingScreen');
        
        // Core services
        this.stateManager = new StateManager();
        this.themeManager = new ThemeManager();
        this.notificationService = new NotificationService();
        this.animationService = new AnimationService();
        
        // Error handling and recovery services
        this.errorHandlingService = new ErrorHandlingService(this.stateManager, this.notificationService);
        this.offlineModeService = new OfflineModeService(this.stateManager, this.notificationService);
        this.gracefulDegradation = new GracefulDegradation(this.stateManager, this.notificationService);
        
        // Web automation service for VS Code integration
        this.webAutomationService = new WebAutomationService(this.stateManager, this.notificationService);
        
        // Initialize WebSocket client with error handling services
        this.webSocketClient = new WebSocketClient(
            this.stateManager, 
            this.notificationService, 
            this.errorHandlingService,
            this.webAutomationService
        );
        
        // Connection recovery service (depends on WebSocket client)
        this.connectionRecoveryService = new ConnectionRecoveryService(
            this.webSocketClient, 
            this.stateManager, 
            this.notificationService
        );
        
        // Layout and interaction services
        this.responsiveLayoutService = new ResponsiveLayoutService(this.stateManager, this.notificationService);
        this.keyboardShortcutService = new KeyboardShortcutService(this.stateManager, this.notificationService);
        this.contextMenuService = new ContextMenuService(this.stateManager, this.notificationService);
        this.dragDropService = new DragDropService(this.stateManager, this.notificationService);
        this.touchGestureService = new TouchGestureService(this.stateManager, this.notificationService);
        
        // Main UI component
        this.appShell = null;
        
        // Performance monitoring
        this.performanceStartTime = performance.now();
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
        
        // Make VS Code API available
        if (typeof acquireVsCodeApi !== 'undefined') {
            window.vscode = acquireVsCodeApi();
        }
    }

    /**
     * Initialize the application
     */
    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
    }

    /**
     * Perform the actual initialization
     */
    async _performInitialization() {
        try {
            console.log('🚀 Starting Unified Web App initialization...');
            
            // Initialize performance monitoring
            this._initializePerformanceOptimizations();
            
            // Initialize core services first
            await this._initializeServices();
            
            // Initialize UI components
            await this._initializeUI();
            
            // Set up global event listeners
            this._setupEventListeners();
            
            // Setup advanced UI features
            this._setupAdvancedUIFeatures();
            
            // Hide loading screen
            this._hideLoadingScreen();
            
            this.isInitialized = true;
            
            const initTime = performance.now() - this.performanceStartTime;
            console.log(`✅ Unified Web App initialized successfully in ${initTime.toFixed(2)}ms`);
            
            // Emit initialization complete event
            this.stateManager.updateState('system', {
                initialized: true,
                initializationTime: initTime,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Unified Web App:', error);
            this._showInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize core services
     */
    async _initializeServices() {
        const services = [
            { name: 'StateManager', service: this.stateManager },
            { name: 'ThemeManager', service: this.themeManager },
            { name: 'NotificationService', service: this.notificationService },
            { name: 'AnimationService', service: this.animationService },
            { name: 'ErrorHandlingService', service: this.errorHandlingService },
            { name: 'OfflineModeService', service: this.offlineModeService },
            { name: 'WebAutomationService', service: this.webAutomationService },
            { name: 'WebSocketClient', service: this.webSocketClient },
            { name: 'ConnectionRecoveryService', service: this.connectionRecoveryService },
            { name: 'ResponsiveLayoutService', service: this.responsiveLayoutService },
            { name: 'KeyboardShortcutService', service: this.keyboardShortcutService },
            { name: 'ContextMenuService', service: this.contextMenuService },
            { name: 'DragDropService', service: this.dragDropService },
            { name: 'TouchGestureService', service: this.touchGestureService }
        ];

        for (const { name, service } of services) {
            try {
                if (service && typeof service.initialize === 'function') {
                    await service.initialize();
                    console.log(`✓ ${name} initialized`);
                }
            } catch (error) {
                console.error(`✗ Failed to initialize ${name}:`, error);
                // Continue with other services
            }
        }
    }

    /**
     * Initialize UI components
     */
    async _initializeUI() {
        // Create and initialize the main app shell
        this.appShell = new AppShell({
            container: this.appElement,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            webAutomationService: this.webAutomationService,
            notificationService: this.notificationService,
            animationService: this.animationService,
            responsiveLayoutService: this.responsiveLayoutService
        });

        await this.appShell.initialize();
        this.appShell.render();
    }

    /**
     * Initialize performance optimizations
     */
    _initializePerformanceOptimizations() {
        // Enable global performance integration
        if (globalPerformanceIntegration) {
            globalPerformanceIntegration.initialize();
        }
        
        // Set up performance observers
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.entryType === 'measure' && entry.name.startsWith('app-')) {
                            console.log(`📊 ${entry.name}: ${entry.duration.toFixed(2)}ms`);
                        }
                    });
                });
                
                observer.observe({ entryTypes: ['measure', 'navigation'] });
            } catch (error) {
                console.warn('Performance observer not supported:', error);
            }
        }
    }

    /**
     * Set up global event listeners
     */
    _setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Global error handlers
        window.addEventListener('error', this._handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this._handleUnhandledRejection.bind(this));
        
        // VS Code extension message handling
        if (window.vscode) {
            window.addEventListener('message', this._handleExtensionMessage.bind(this));
        }
    }

    /**
     * Setup advanced UI features
     */
    _setupAdvancedUIFeatures() {
        // Enable graceful degradation
        this.gracefulDegradation.initialize();
        
        // Set up responsive layout monitoring
        this.responsiveLayoutService.registerAdaptiveComponent(this);
        
        // Initialize keyboard shortcuts
        this.keyboardShortcutService.setContext('global');
        
        // Set up context menus
        this.contextMenuService.initialize();
        
        // Initialize drag and drop
        this.dragDropService.initialize();
        
        // Set up touch gestures for mobile
        if (this.responsiveLayoutService.isTouchDevice()) {
            this.touchGestureService.initialize();
        }
    }

    /**
     * Handle VS Code extension messages
     */
    _handleExtensionMessage(event) {
        const message = event.data;
        
        if (this.webAutomationService) {
            this.webAutomationService.handleExtensionMessage(message);
        }
        
        if (this.webSocketClient) {
            this.webSocketClient.handleExtensionMessage(message);
        }
    }

    /**
     * Handle global errors
     */
    _handleGlobalError(event) {
        if (this.errorHandlingService) {
            this.errorHandlingService.handleGlobalError(event);
        }
    }

    /**
     * Handle unhandled promise rejections
     */
    _handleUnhandledRejection(event) {
        if (this.errorHandlingService) {
            this.errorHandlingService.handleUnhandledRejection(event);
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.appShell && typeof this.appShell.handleResize === 'function') {
            this.appShell.handleResize();
        }
        
        if (this.responsiveLayoutService) {
            this.responsiveLayoutService.handleResize();
        }
    }

    /**
     * Handle page visibility change
     */
    handleVisibilityChange() {
        const isVisible = !document.hidden;
        
        if (this.webSocketClient) {
            if (isVisible) {
                this.webSocketClient.handleVisibilityChange(true);
            } else {
                this.webSocketClient.handleVisibilityChange(false);
            }
        }
        
        // Update state
        this.stateManager.updateState('system', {
            pageVisible: isVisible,
            lastVisibilityChange: Date.now()
        });
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload(event) {
        // Perform cleanup
        this.destroy();
        
        // Don't show confirmation dialog unless there are unsaved changes
        const hasUnsavedChanges = this.stateManager.getState().system?.hasUnsavedChanges;
        if (hasUnsavedChanges) {
            event.preventDefault();
            event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return event.returnValue;
        }
    }

    /**
     * Hide loading screen with animation
     */
    _hideLoadingScreen() {
        if (this.loadingScreen && this.animationService) {
            this.animationService.animate(this.loadingScreen, 'fadeOut', {
                duration: 500,
                onComplete: () => {
                    this.loadingScreen.style.display = 'none';
                }
            });
        } else if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
    }

    /**
     * Show initialization error
     */
    _showInitializationError(error) {
        if (this.loadingScreen) {
            this.loadingScreen.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">Initialization Failed</div>
                    <div class="error-message">${error.message || 'Unknown error occurred'}</div>
                    <button onclick="location.reload()" class="retry-button">Retry</button>
                </div>
            `;
        }
    }

    /**
     * Get application state for debugging
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            initializationTime: performance.now() - this.performanceStartTime,
            services: {
                stateManager: !!this.stateManager,
                webSocketClient: !!this.webSocketClient,
                webAutomationService: !!this.webAutomationService,
                appShell: !!this.appShell
            },
            state: this.stateManager ? this.stateManager.getState() : null
        };
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        const state = this.stateManager.getState();
        return {
            initializationTime: performance.now() - this.performanceStartTime,
            memoryUsage: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            stateManager: this.stateManager.getPerformanceMetrics ? this.stateManager.getPerformanceMetrics() : null,
            connectionMetrics: state.connection?.metrics || null
        };
    }

    /**
     * Cleanup and destroy the application
     */
    destroy() {
        console.log('🧹 Cleaning up Unified Web App...');
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Destroy services in reverse order
        const services = [
            this.touchGestureService,
            this.dragDropService,
            this.contextMenuService,
            this.keyboardShortcutService,
            this.responsiveLayoutService,
            this.connectionRecoveryService,
            this.webSocketClient,
            this.webAutomationService,
            this.offlineModeService,
            this.errorHandlingService,
            this.animationService,
            this.notificationService,
            this.themeManager,
            this.stateManager
        ];
        
        services.forEach(service => {
            if (service && typeof service.destroy === 'function') {
                try {
                    service.destroy();
                } catch (error) {
                    console.error('Error destroying service:', error);
                }
            }
        });
        
        // Destroy UI components
        if (this.appShell && typeof this.appShell.destroy === 'function') {
            this.appShell.destroy();
        }
        
        console.log('✅ Unified Web App cleanup completed');
    }
}

/**
 * Initialize the application when DOM is ready
 */
async function initializeApp() {
    try {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Create and initialize the app
        const app = new UnifiedWebApp();
        await app.initialize();
        
        // Make app globally available for debugging
        window.unifiedWebApp = app;
        
        console.log('🎉 Unified Web App is ready!');
        
    } catch (error) {
        console.error('💥 Failed to initialize Unified Web App:', error);
        
        // Show fallback error UI
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div class="initialization-error">
                    <h2>Application Failed to Load</h2>
                    <p>An error occurred while initializing the application:</p>
                    <pre>${error.message}</pre>
                    <button onclick="location.reload()">Reload Page</button>
                </div>
            `;
        }
    }
}

// Start the application
initializeApp();