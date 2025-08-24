/**
 * Enhanced Web Frontend - Main Application Entry Point
 * Modern ES6+ module-based architecture for VS Code Web Automation
 */

import { AppShell } from './components/AppShell.js';
import { WebSocketClient } from './services/WebSocketClient.js';
import { StateManager } from './services/StateManager.js';
import { ThemeManager } from './services/ThemeManager.js';
import { NotificationService } from './services/NotificationService.js';

/**
 * Enhanced Web Application
 * Main application class that orchestrates all components and services
 */
class EnhancedWebApp {
    constructor() {
        this.appElement = document.getElementById('app');
        this.loadingScreen = document.getElementById('loadingScreen');
        
        // Core services
        this.stateManager = new StateManager();
        this.themeManager = new ThemeManager();
        this.notificationService = new NotificationService();
        this.webSocketClient = new WebSocketClient(this.stateManager);
        
        // Main app shell component
        this.appShell = null;
        
        // Initialization state
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Bind methods
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
        this.handleResize = this.handleResize.bind(this);
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
            console.log('🚀 Initializing Enhanced Web Frontend...');
            
            // Initialize core services
            await this._initializeServices();
            
            // Initialize UI components
            await this._initializeUI();
            
            // Set up event listeners
            this._setupEventListeners();
            
            // Connect to WebSocket
            await this._connectWebSocket();
            
            // Hide loading screen
            this._hideLoadingScreen();
            
            this.isInitialized = true;
            console.log('✅ Enhanced Web Frontend initialized successfully');
            
            // Show welcome notification
            this.notificationService.show({
                title: 'Enhanced UI Ready',
                message: 'VS Code Web Automation with enhanced interface is now active.',
                type: 'success',
                duration: 3000
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced Web Frontend:', error);
            this._showInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize core services
     */
    async _initializeServices() {
        console.log('🔧 Initializing services...');
        
        // Initialize theme manager first
        await this.themeManager.initialize();
        
        // Initialize state manager
        await this.stateManager.initialize();
        
        // Initialize notification service
        await this.notificationService.initialize();
        
        console.log('✅ Services initialized');
    }

    /**
     * Initialize UI components
     */
    async _initializeUI() {
        console.log('🎨 Initializing UI components...');
        
        // Create and initialize app shell
        this.appShell = new AppShell({
            container: this.appElement,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });
        
        await this.appShell.initialize();
        
        console.log('✅ UI components initialized');
    }

    /**
     * Set up global event listeners
     */
    _setupEventListeners() {
        console.log('📡 Setting up event listeners...');
        
        // Page visibility change
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Before unload
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        
        // Window resize
        window.addEventListener('resize', this.handleResize);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this._handleKeyboardShortcuts.bind(this));
        
        // Error handling
        window.addEventListener('error', this._handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this._handleUnhandledRejection.bind(this));
        
        console.log('✅ Event listeners set up');
    }

    /**
     * Connect to WebSocket server
     */
    async _connectWebSocket() {
        console.log('🔌 Connecting to WebSocket...');
        
        try {
            await this.webSocketClient.connect();
            console.log('✅ WebSocket connected');
        } catch (error) {
            console.warn('⚠️ WebSocket connection failed, will retry automatically:', error.message);
            // Don't throw here - let the WebSocket client handle reconnection
        }
    }

    /**
     * Hide loading screen with animation
     */
    _hideLoadingScreen() {
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
            
            // Remove from DOM after animation
            setTimeout(() => {
                if (this.loadingScreen && this.loadingScreen.parentNode) {
                    this.loadingScreen.parentNode.removeChild(this.loadingScreen);
                    this.loadingScreen = null;
                }
            }, 300);
        }
    }

    /**
     * Show initialization error
     */
    _showInitializationError(error) {
        // Hide loading screen
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'none';
        }
        
        // Show error message
        const errorContainer = document.createElement('div');
        errorContainer.className = 'initialization-error';
        errorContainer.innerHTML = `
            <div class="error-content">
                <h2>Initialization Failed</h2>
                <p>The Enhanced Web Frontend failed to initialize properly.</p>
                <details>
                    <summary>Error Details</summary>
                    <pre>${error.message}\n${error.stack}</pre>
                </details>
                <div class="error-actions">
                    <button onclick="window.location.reload()" class="btn btn-primary">
                        Reload Page
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" class="btn btn-secondary">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
        
        // Add error styles
        const errorStyles = document.createElement('style');
        errorStyles.textContent = `
            .initialization-error {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--vscode-editor-background);
                color: var(--vscode-foreground);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            .error-content {
                max-width: 500px;
                padding: 2rem;
                text-align: center;
            }
            .error-content h2 {
                color: var(--vscode-errorForeground);
                margin-bottom: 1rem;
            }
            .error-content details {
                margin: 1rem 0;
                text-align: left;
            }
            .error-content pre {
                background: var(--vscode-textCodeBlock-background);
                padding: 1rem;
                border-radius: 4px;
                overflow: auto;
                max-height: 200px;
                font-size: 12px;
            }
            .error-actions {
                display: flex;
                gap: 1rem;
                justify-content: center;
                margin-top: 1.5rem;
            }
        `;
        
        document.head.appendChild(errorStyles);
        document.body.appendChild(errorContainer);
    }

    /**
     * Handle page visibility change
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - pause non-critical operations
            this.webSocketClient?.pauseHeartbeat();
        } else {
            // Page is visible - resume operations
            this.webSocketClient?.resumeHeartbeat();
            
            // Refresh state if we've been hidden for a while
            if (this.isInitialized) {
                this.stateManager.refreshState();
            }
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload(event) {
        // Clean up connections
        if (this.webSocketClient) {
            this.webSocketClient.disconnect();
        }
        
        // Save any pending state
        this.stateManager?.saveState();
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Notify components about resize
        if (this.appShell) {
            this.appShell.handleResize();
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    _handleKeyboardShortcuts(event) {
        // Only handle shortcuts when not in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        const { ctrlKey, metaKey, shiftKey, altKey, key } = event;
        const cmdKey = ctrlKey || metaKey;

        // Global shortcuts
        if (cmdKey && key === 'k') {
            // Cmd/Ctrl + K - Focus command input
            event.preventDefault();
            this.appShell?.focusCommandInput();
        } else if (cmdKey && key === 'b') {
            // Cmd/Ctrl + B - Toggle sidebar
            event.preventDefault();
            this.appShell?.toggleSidebar();
        } else if (cmdKey && shiftKey && key === 'P') {
            // Cmd/Ctrl + Shift + P - Show command palette
            event.preventDefault();
            this.appShell?.showCommandPalette();
        } else if (key === 'Escape') {
            // Escape - Close modals/overlays
            event.preventDefault();
            this.appShell?.closeOverlays();
        }
    }

    /**
     * Handle global errors
     */
    _handleGlobalError(event) {
        console.error('Global error:', event.error);
        
        this.notificationService?.show({
            title: 'Application Error',
            message: `An unexpected error occurred: ${event.error?.message || 'Unknown error'}`,
            type: 'error',
            duration: 5000
        });
    }

    /**
     * Handle unhandled promise rejections
     */
    _handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        
        this.notificationService?.show({
            title: 'Promise Rejection',
            message: `Unhandled promise rejection: ${event.reason?.message || 'Unknown error'}`,
            type: 'error',
            duration: 5000
        });
    }

    /**
     * Get application state for debugging
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            webSocketConnected: this.webSocketClient?.isConnected(),
            currentSection: this.stateManager?.getCurrentSection(),
            theme: this.themeManager?.getCurrentTheme(),
            notifications: this.notificationService?.getActiveNotifications()
        };
    }

    /**
     * Cleanup and destroy the application
     */
    destroy() {
        console.log('🧹 Cleaning up Enhanced Web Frontend...');
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('resize', this.handleResize);
        
        // Cleanup services
        this.webSocketClient?.destroy();
        this.appShell?.destroy();
        this.stateManager?.destroy();
        this.themeManager?.destroy();
        this.notificationService?.destroy();
        
        console.log('✅ Cleanup complete');
    }
}

/**
 * Application instance
 */
let app = null;

/**
 * Initialize the application when DOM is ready
 */
function initializeApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
        return;
    }

    // Create and initialize the application
    app = new EnhancedWebApp();
    
    // Make app available globally for debugging
    window.enhancedWebApp = app;
    
    // Initialize the application
    app.initialize().catch(error => {
        console.error('Failed to initialize application:', error);
    });
}

// Start initialization
initializeApp();

// Export for module systems
export { EnhancedWebApp };