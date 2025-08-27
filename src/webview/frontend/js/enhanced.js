/**
 * Enhanced Web Frontend - Main Application Entry Point
 * Traditional script version compatible with VS Code webviews
 * Note: This is a simplified version that focuses on core functionality
 * without external module dependencies for VS Code webview compatibility
 */

/**
 * Enhanced Web Application
 * Main application class that orchestrates all components and services
 */
class EnhancedWebApp {
    constructor() {
        this.appElement = document.getElementById('app') || document.getElementById('enhancedApp');
        this.loadingScreen = document.getElementById('loadingScreen') || document.getElementById('enhancedLoadingScreen');
        
        // Core state
        this.isInitialized = false;
        this.initializationPromise = null;
        this.webSocketClient = null;
        
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
     * Perform the actual initialization - simplified version for webview compatibility
     */
    async _performInitialization() {
        try {
            console.log('🚀 Initializing Enhanced Web Frontend (simplified mode)...');
            
            // Initialize basic UI
            await this._initializeBasicUI();
            
            // Set up event listeners
            this._setupBasicEventListeners();
            
            // Initialize basic WebSocket connection
            await this._initializeBasicWebSocket();
            
            // Hide loading screen
            this._hideLoadingScreen();
            
            this.isInitialized = true;
            console.log('✅ Enhanced Web Frontend initialized successfully (simplified mode)');
            
            // Show simple notification
            this._showSimpleNotification('Enhanced UI Ready', 'VS Code Web Automation enhanced interface is active.');
            
            // Update workspace information
            this._updateWorkspaceInfo();
            
            // Add initial log message
            this._addLogMessage('Enhanced UI initialized successfully', 'success');
            
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced Web Frontend:', error);
            this._showInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize basic UI elements
     */
    async _initializeBasicUI() {
        console.log('🎨 Setting up enhanced UI elements...');
        
        // Ensure we have the app element
        if (!this.appElement) {
            console.warn('App element not found, creating one...');
            this.appElement = document.createElement('div');
            this.appElement.id = 'app';
            this.appElement.className = 'app-container';
            document.body.appendChild(this.appElement);
        }
        
        // Create basic enhanced UI structure with Tailwind CSS
        this.appElement.innerHTML = `
            <div class="flex flex-col h-screen bg-white">
                <!-- Mobile Header -->
                <header class="flex items-center justify-between p-4 sm:p-6 bg-white border-b border-gray-200">
                    <div class="flex items-center space-x-4">
                        <button id="mobileMenuToggle" class="sm:hidden p-2 text-gray-600 hover:text-gray-800 focus:outline-none touch-target" aria-label="Toggle menu">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                            </svg>
                        </button>
                        <h1 class="text-xl sm:text-2xl font-light text-gray-800">Enhanced VS Code Web Automation</h1>
                    </div>
                    <div class="flex items-center space-x-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
                        <div class="status-indicator" id="enhancedStatusIndicator"></div>
                        <span class="text-xs text-gray-600" id="enhancedStatusText">Initializing...</span>
                    </div>
                </header>
                
                <!-- Main Content Area -->
                <div class="flex flex-1 overflow-hidden">
                    <!-- Mobile Overlay -->
                    <div id="mobileOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-20 hidden sm:hidden"></div>
                    
                    <!-- Sidebar -->
                    <aside id="sidebar" class="fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform -translate-x-full transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 sm:w-60 lg:w-64">
                        <nav class="pt-6">
                            <button class="nav-item" data-view="dashboard">
                                <span class="text-lg mr-3">🏠</span>
                                <span class="mobile-nav-hidden">Dashboard</span>
                            </button>
                            <button class="nav-item" data-view="commands">
                                <span class="text-lg mr-3">⚙️</span>
                                <span class="mobile-nav-hidden">Commands</span>
                            </button>
                            <button class="nav-item" data-view="workspace">
                                <span class="text-lg mr-3">📁</span>
                                <span class="mobile-nav-hidden">Workspace</span>
                            </button>
                            <button class="nav-item" data-view="logs">
                                <span class="text-lg mr-3">📜</span>
                                <span class="mobile-nav-hidden">Logs</span>
                            </button>
                        </nav>
                    </aside>
                    
                    <!-- Content Area -->
                    <main class="flex-1 overflow-hidden">
                        <!-- Dashboard View -->
                        <div class="content-view active p-4 sm:p-6 lg:p-8 h-full overflow-y-auto" id="dashboard-view">
                            <h2 class="text-2xl sm:text-3xl font-light text-gray-800 mb-6">Enhanced Dashboard</h2>
                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div class="dashboard-card">
                                    <h3 class="text-lg font-medium text-gray-800 mb-4">Connection Status</h3>
                                    <div id="enhancedConnectionInfo" class="text-gray-600">Connecting...</div>
                                </div>
                                <div class="dashboard-card">
                                    <h3 class="text-lg font-medium text-gray-800 mb-4">Quick Actions</h3>
                                    <div class="space-y-3">
                                        <button class="action-btn w-full text-left" data-command="workbench.action.files.newUntitledFile">New File</button>
                                        <button class="action-btn w-full text-left" data-command="workbench.action.showCommands">Command Palette</button>
                                        <button class="action-btn w-full text-left" data-command="workbench.action.terminal.toggleTerminal">Toggle Terminal</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Commands View -->
                        <div class="content-view p-4 sm:p-6 lg:p-8 h-full overflow-y-auto" id="commands-view">
                            <h2 class="text-2xl sm:text-3xl font-light text-gray-800 mb-6">Command Interface</h2>
                            <div class="max-w-2xl">
                                <div class="flex flex-col sm:flex-row gap-3">
                                    <input type="text" id="enhancedCommandInput" class="input-field flex-1" placeholder="Enter VS Code command...">
                                    <button id="enhancedExecuteButton" class="primary-btn touch-target">Execute</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Workspace View -->
                        <div class="content-view p-4 sm:p-6 lg:p-8 h-full overflow-y-auto" id="workspace-view">
                            <h2 class="text-2xl sm:text-3xl font-light text-gray-800 mb-6">Workspace Information</h2>
                            <div id="enhancedWorkspaceInfo" class="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-700">Loading workspace information...</div>
                        </div>
                        
                        <!-- Logs View -->
                        <div class="content-view p-4 sm:p-6 lg:p-8 h-full overflow-y-auto" id="logs-view">
                            <h2 class="text-2xl sm:text-3xl font-light text-gray-800 mb-6">Activity Logs</h2>
                            <div class="mb-4">
                                <button id="enhancedClearLogButton" class="px-4 py-2 text-red-600 border border-red-600 rounded-lg text-sm hover:bg-red-600 hover:text-white transition-colors touch-target">Clear Logs</button>
                            </div>
                            <div class="log-container" id="enhancedMessageLog"></div>
                        </div>
                    </main>
                </div>
            </div>
        `;
        
        console.log('✅ Enhanced UI structure created');
    }

    /**
     * Set up basic event listeners
     */
    _setupBasicEventListeners() {
        console.log('🎬 Setting up event listeners...');
        
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.getElementById('sidebar');
        const mobileOverlay = document.getElementById('mobileOverlay');
        
        if (mobileMenuToggle && sidebar && mobileOverlay) {
            mobileMenuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('-translate-x-full');
                mobileOverlay.classList.toggle('hidden');
            });
            
            mobileOverlay.addEventListener('click', () => {
                sidebar.classList.add('-translate-x-full');
                mobileOverlay.classList.add('hidden');
            });
        }
        
        // Navigation handling
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-view');
                this._switchView(view);
                
                // Close mobile menu after navigation
                if (sidebar && mobileOverlay) {
                    sidebar.classList.add('-translate-x-full');
                    mobileOverlay.classList.add('hidden');
                }
            });
        });
        
        // Quick action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const command = e.currentTarget.getAttribute('data-command');
                if (command) {
                    this._executeCommand(command);
                }
            });
        });
        
        // Command execution
        const executeBtn = document.getElementById('enhancedExecuteButton');
        const commandInput = document.getElementById('enhancedCommandInput');
        
        if (executeBtn) {
            executeBtn.addEventListener('click', () => {
                const command = commandInput?.value.trim();
                if (command) {
                    this._executeCommand(command);
                }
            });
        }
        
        if (commandInput) {
            commandInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const command = e.target.value.trim();
                    if (command) {
                        this._executeCommand(command);
                    }
                }
            });
        }
        
        // Clear logs
        const clearLogBtn = document.getElementById('enhancedClearLogButton');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                this._clearLogs();
            });
        }
        
        // Touch gestures for mobile
        this._setupTouchGestures();
        
        // Global event listeners
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        window.addEventListener('resize', this.handleResize);
        
        console.log('✅ Event listeners set up');
    }
    
    /**
     * Set up touch gestures for mobile devices
     */
    _setupTouchGestures() {
        let startX = 0;
        let startY = 0;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = endY - startY;
            
            // Swipe right to open menu (from left edge)
            if (diffX > 100 && Math.abs(diffY) < 100 && startX < 50) {
                const sidebar = document.getElementById('sidebar');
                const mobileOverlay = document.getElementById('mobileOverlay');
                if (sidebar && mobileOverlay) {
                    sidebar.classList.remove('-translate-x-full');
                    mobileOverlay.classList.remove('hidden');
                }
            }
            
            // Swipe left to close menu
            if (diffX < -100 && Math.abs(diffY) < 100) {
                const sidebar = document.getElementById('sidebar');
                const mobileOverlay = document.getElementById('mobileOverlay');
                if (sidebar && mobileOverlay && !sidebar.classList.contains('-translate-x-full')) {
                    sidebar.classList.add('-translate-x-full');
                    mobileOverlay.classList.add('hidden');
                }
            }
        }, { passive: true });
    }

    /**
     * Switch between different views
     */
    _switchView(viewId) {
        try {
            // Update navigation active state
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                item.classList.remove('bg-blue-50', 'text-primary-500', 'font-medium');
                item.classList.add('text-gray-600');
                
                if (item.getAttribute('data-view') === viewId) {
                    item.classList.add('active');
                    item.classList.add('bg-blue-50', 'text-primary-500', 'font-medium');
                    item.classList.remove('text-gray-600');
                }
            });
            
            // Hide all views
            document.querySelectorAll('.content-view').forEach(view => {
                view.classList.remove('active');
                view.style.display = 'none';
            });
            
            // Show selected view
            const selectedView = document.getElementById(`${viewId}-view`);
            if (selectedView) {
                selectedView.classList.add('active');
                selectedView.style.display = 'block';
            }
            
            // Log view switch
            this._addLogMessage(`Switched to ${viewId} view`);
            
        } catch (error) {
            console.warn('⚠️ Failed to switch view:', error);
        }
    }

    /**
     * Execute a VS Code command
     */
    _executeCommand(command) {
        try {
            if (!command) {
                this._addLogMessage('Error: No command specified', 'error');
                return;
            }
            
            this._addLogMessage(`Executing command: ${command}`, 'info');
            
            // If we're in VS Code webview, send command to extension
            if (window.vscode) {
                window.vscode.postMessage({
                    command: 'executeCommand',
                    data: command
                });
                this._addLogMessage(`Command sent to VS Code: ${command}`, 'success');
            } else {
                // In standalone mode, simulate command execution
                this._simulateCommand(command);
            }
            
            // Clear command input
            const commandInput = document.getElementById('enhancedCommandInput');
            if (commandInput) {
                commandInput.value = '';
            }
            
        } catch (error) {
            console.error('❌ Failed to execute command:', error);
            this._addLogMessage(`Error executing command: ${error.message}`, 'error');
        }
    }

    /**
     * Simulate command execution in standalone mode
     */
    _simulateCommand(command) {
        const simulatedCommands = {
            'workbench.action.files.newUntitledFile': 'New untitled file created',
            'workbench.action.showCommands': 'Command palette opened',
            'workbench.action.terminal.toggleTerminal': 'Terminal toggled',
            'workbench.action.files.save': 'File saved',
            'workbench.action.closeActiveEditor': 'Active editor closed'
        };
        
        const response = simulatedCommands[command] || `Simulated execution of: ${command}`;
        this._addLogMessage(`Simulation: ${response}`, 'info');
    }

    /**
     * Add a log message to the activity log
     */
    _addLogMessage(message, type = 'info') {
        try {
            const logContainer = document.getElementById('enhancedMessageLog');
            if (!logContainer) return;
            
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${type}`;
            logEntry.style.cssText = `
                padding: 8px 12px;
                margin-bottom: 4px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 1.4;
                background: var(--vscode-textCodeBlock-background, #1e1e1e);
                border-left: 3px solid ${this._getLogColor(type)};
                color: var(--vscode-foreground, #cccccc);
                animation: slideIn 0.3s ease;
            `;
            
            logEntry.innerHTML = `
                <span style="color: var(--vscode-descriptionForeground, #999); font-size: 11px;">[${timestamp}]</span>
                <span style="margin-left: 8px;">${message}</span>
            `;
            
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
            
            // Keep only last 50 log entries
            const entries = logContainer.querySelectorAll('.log-entry');
            if (entries.length > 50) {
                entries[0].remove();
            }
            
        } catch (error) {
            console.warn('⚠️ Failed to add log message:', error);
        }
    }

    /**
     * Get color for log entry type
     */
    _getLogColor(type) {
        const colors = {
            'info': '#007acc',
            'success': '#4caf50',
            'warning': '#ff9800',
            'error': '#f44336'
        };
        return colors[type] || colors.info;
    }

    /**
     * Clear activity logs
     */
    _clearLogs() {
        try {
            const logContainer = document.getElementById('enhancedMessageLog');
            if (logContainer) {
                logContainer.innerHTML = '';
                this._addLogMessage('Logs cleared', 'info');
            }
        } catch (error) {
            console.warn('⚠️ Failed to clear logs:', error);
        }
    }

    /**
     * Update workspace information
     */
    _updateWorkspaceInfo() {
        try {
            const workspaceInfo = document.getElementById('enhancedWorkspaceInfo');
            if (!workspaceInfo) return;
            
            if (window.vscode) {
                // Request workspace info from extension
                window.vscode.postMessage({
                    command: 'getWorkspaceInfo'
                });
                workspaceInfo.textContent = 'Requesting workspace information from VS Code...';
            } else {
                // Standalone mode - show placeholder info
                workspaceInfo.innerHTML = `
                    <div style="color: var(--vscode-descriptionForeground, #999);">
                        <p><strong>Mode:</strong> Standalone Web Application</p>
                        <p><strong>URL:</strong> ${window.location.href}</p>
                        <p><strong>User Agent:</strong> ${navigator.userAgent.substring(0, 60)}...</p>
                        <p><strong>Language:</strong> ${navigator.language}</p>
                        <p><strong>Platform:</strong> ${navigator.platform}</p>
                        <p><strong>Viewport:</strong> ${window.innerWidth}x${window.innerHeight}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('⚠️ Failed to update workspace info:', error);
        }
    }

    /**
     * Initialize basic WebSocket connection
     */
    async _initializeBasicWebSocket() {
        console.log('🔌 Initializing WebSocket connection...');
        
        try {
            // Create a simple WebSocket client
            this.webSocketClient = new SimpleWebSocketClient();
            await this.webSocketClient.connect();
            
            this._updateConnectionStatus('connected', 'Connected to VS Code');
            console.log('✅ WebSocket connection established');
        } catch (error) {
            console.warn('⚠️ WebSocket connection failed, continuing in offline mode:', error);
            this._updateConnectionStatus('disconnected', 'Offline Mode');
        }
    }

    /**
     * Show a simple notification
     */
    _showSimpleNotification(title, message, type = 'info') {
        try {
            // If we have a notification service, use it
            if (this.notificationService && typeof this.notificationService.show === 'function') {
                this.notificationService.show({
                    title: title,
                    message: message,
                    type: type,
                    duration: 4000
                });
                return;
            }
            
            // Fallback to console logging
            console.log(`🔔 ${title}: ${message}`);
            
            // Create a simple toast notification if no service is available
            this._createToastNotification(title, message, type);
            
        } catch (error) {
            console.warn('⚠️ Failed to show notification:', error);
            // Ultimate fallback - just log to console
            console.log(`📢 ${title}: ${message}`);
        }
    }

    /**
     * Create a simple toast notification
     */
    _createToastNotification(title, message, type = 'info') {
        try {
            // Create toast container if it doesn't exist
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = 'toast-container';
                toastContainer.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    pointer-events: none;
                `;
                document.body.appendChild(toastContainer);
            }
            
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.style.cssText = `
                background: var(--vscode-notifications-background, #1e1e1e);
                color: var(--vscode-notifications-foreground, #cccccc);
                border: 1px solid var(--vscode-notifications-border, #454545);
                border-radius: 4px;
                padding: 12px 16px;
                margin-bottom: 8px;
                max-width: 350px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                pointer-events: auto;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
                font-size: 13px;
                line-height: 1.4;
            `;
            
            // Add type-specific styling
            if (type === 'success') {
                toast.style.borderLeftColor = 'var(--vscode-statusBarItem-prominentBackground, #007acc)';
                toast.style.borderLeftWidth = '4px';
            } else if (type === 'error') {
                toast.style.borderLeftColor = 'var(--vscode-errorForeground, #f85149)';
                toast.style.borderLeftWidth = '4px';
            } else if (type === 'warning') {
                toast.style.borderLeftColor = 'var(--vscode-editorWarning-foreground, #ffcc02)';
                toast.style.borderLeftWidth = '4px';
            }
            
            // Set content
            toast.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
                <div style="opacity: 0.9;">${message}</div>
                <button style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                " onclick="this.parentElement.remove()">×</button>
            `;
            
            // Add to container
            toastContainer.appendChild(toast);
            
            // Animate in
            setTimeout(() => {
                toast.style.transform = 'translateX(0)';
            }, 100);
            
            // Auto-remove after 4 seconds
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (toast.parentElement) {
                            toast.remove();
                        }
                    }, 300);
                }
            }, 4000);
            
        } catch (error) {
            console.warn('⚠️ Failed to create toast notification:', error);
        }
    }

    /**
     * Update connection status in the UI
     */
    _updateConnectionStatus(status, message) {
        try {
            // Update state manager with connection status
            if (this.stateManager) {
                this.stateManager.updateConnection({
                    status: status,
                    message: message,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Update UI elements if they exist
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            
            if (statusDot) {
                // Remove all status classes
                statusDot.classList.remove('connected', 'connecting', 'disconnected');
                // Add current status class
                statusDot.classList.add(status);
            }
            
            if (statusText) {
                statusText.textContent = message || status;
            }
            
            // Show notification for status changes
            if (this.notificationService && message) {
                const notificationType = status === 'connected' ? 'success' : 
                                       status === 'connecting' ? 'info' : 'warning';
                
                this.notificationService.show({
                    title: 'Connection Status',
                    message: message,
                    type: notificationType,
                    duration: 3000
                });
            }
            
            console.log(`🔌 Connection status updated: ${status} - ${message}`);
            
        } catch (error) {
            console.warn('⚠️ Failed to update connection status:', error);
        }
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
            notificationService: this.notificationService,
            errorHandlingService: this.errorHandlingService,
            connectionRecoveryService: this.connectionRecoveryService,
            offlineModeService: this.offlineModeService,
            gracefulDegradation: this.gracefulDegradation,
            animationService: this.animationService,
            responsiveLayoutService: this.responsiveLayoutService,
            touchGestureService: this.touchGestureService,
            keyboardShortcutService: this.keyboardShortcutService,
            contextMenuService: this.contextMenuService,
            dragDropService: this.dragDropService
        });
        
        await this.appShell.initialize();
        
        // Register components with performance integration
        this.performanceIntegration.registerComponent('appShell', this.appShell);
        
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
        
        // Error handling is now managed by ErrorHandlingService
        // Keep these for fallback in case error service fails
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
            // Check if we're running in VS Code webview
            if (window.vscode) {
                console.log('🔌 Running in VS Code webview - using extension integration');
                // In webview mode, we rely on extension messages instead of direct WebSocket
                this.webSocketClient.isVSCodeWebview = true;
                
                // Request initial server status from extension
                window.vscode.postMessage({
                    command: 'getServerStatus'
                });
                
                // Mark as connected for UI purposes
                this.webSocketClient.isConnected = true;
                this.stateManager.updateConnection({
                    status: 'connected',
                    isVSCodeWebview: true
                });
            } else {
                // Standalone mode - connect directly to WebSocket
                await this.webSocketClient.connect();
                console.log('✅ WebSocket connected');
            }
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
     * Setup advanced UI features
     */
    _setupAdvancedUIFeatures() {
        console.log('✨ Setting up advanced UI features...');
        
        // Setup keyboard shortcut event handlers
        document.addEventListener('keyboard-shortcut', this._handleKeyboardShortcutEvent.bind(this));
        
        // Setup context menu event handlers
        document.addEventListener('context-menu-action', this._handleContextMenuAction.bind(this));
        
        // Setup drag and drop event handlers
        document.addEventListener('file-move', this._handleFileMove.bind(this));
        document.addEventListener('prompt-category-change', this._handlePromptCategoryChange.bind(this));
        
        // Add hover animations to existing elements
        this.animationService.addHoverAnimations(document.body);
        
        console.log('✅ Advanced UI features set up');
    }

    /**
     * Handle keyboard shortcut events
     */
    _handleKeyboardShortcutEvent(event) {
        const { action, ...data } = event.detail;
        
        switch (action) {
            case 'focus-command-input':
                this.appShell?.focusCommandInput();
                break;
            case 'toggle-sidebar':
                this.appShell?.toggleSidebar();
                break;
            case 'show-command-palette':
                this.appShell?.showCommandPalette();
                break;
            case 'close-overlays':
                this.appShell?.closeOverlays();
                break;
            case 'send-message':
                // Delegate to chat interface
                break;
            case 'navigate-message-history':
                // Delegate to chat interface
                break;
            case 'open-selected-file':
                // Delegate to file manager
                break;
            case 'expand-selected-folder':
                // Delegate to file manager
                break;
            case 'collapse-selected-folder':
                // Delegate to file manager
                break;
            case 'refresh-git-status':
                // Delegate to git dashboard
                break;
        }
    }

    /**
     * Handle context menu actions
     */
    _handleContextMenuAction(event) {
        const { action, ...data } = event.detail;
        
        // Most context menu actions will be handled by the respective components
        // This is a central place to handle cross-component actions
        console.log('Context menu action:', action, data);
        
        // Show notification for actions that need user feedback
        if (action.includes('delete')) {
            this.notificationService.warning(
                'Confirm Action',
                `Are you sure you want to ${action.replace('-', ' ')}?`,
                {
                    actions: [
                        {
                            label: 'Confirm',
                            primary: true,
                            handler: () => this._executeContextMenuAction(action, data)
                        },
                        {
                            label: 'Cancel',
                            handler: () => {}
                        }
                    ]
                }
            );
        } else {
            this._executeContextMenuAction(action, data);
        }
    }

    /**
     * Execute context menu action
     */
    _executeContextMenuAction(action, data) {
        // This would typically delegate to the appropriate service or component
        console.log('Executing context menu action:', action, data);
        
        // For now, just show a notification
        this.notificationService.info(
            'Action Executed',
            `${action.replace('-', ' ')} completed`
        );
    }

    /**
     * Handle file move events
     */
    _handleFileMove(event) {
        const { sourcePath, targetPath, type } = event.detail;
        
        console.log('File move:', { sourcePath, targetPath, type });
        
        // Show notification
        this.notificationService.success(
            'File Moved',
            `${type} moved from ${sourcePath} to ${targetPath}`
        );
    }

    /**
     * Handle prompt category change events
     */
    _handlePromptCategoryChange(event) {
        const { promptId, newCategory } = event.detail;
        
        console.log('Prompt category change:', { promptId, newCategory });
        
        // Show notification
        this.notificationService.success(
            'Category Updated',
            `Prompt moved to ${newCategory} category`
        );
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
        } else if (cmdKey && key === 'g') {
            // Cmd/Ctrl + G - Switch to Git section
            event.preventDefault();
            this.stateManager?.updateNavigation({ activeSection: 'git' });
        } else if (cmdKey && key === 'e') {
            // Cmd/Ctrl + E - Switch to Files section
            event.preventDefault();
            this.stateManager?.updateNavigation({ activeSection: 'files' });
        } else if (cmdKey && key === 'i') {
            // Cmd/Ctrl + I - Switch to Info section
            event.preventDefault();
            this.stateManager?.updateNavigation({ activeSection: 'info' });
        } else if (key === 'Escape') {
            // Escape - Close modals/overlays
            event.preventDefault();
            this.appShell?.closeOverlays();
        }
    }

    /**
     * Handle global errors (fallback)
     */
    _handleGlobalError(event) {
        console.error('Global error (fallback handler):', event.error);
        
        // Only handle if error handling service is not available
        if (!this.errorHandlingService) {
            this.notificationService?.show({
                title: 'Application Error',
                message: `An unexpected error occurred: ${event.error?.message || 'Unknown error'}`,
                type: 'error',
                duration: 5000
            });
        }
    }

    /**
     * Handle unhandled promise rejections (fallback)
     */
    _handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection (fallback handler):', event.reason);
        
        // Only handle if error handling service is not available
        if (!this.errorHandlingService) {
            this.notificationService?.show({
                title: 'Promise Rejection',
                message: `Unhandled promise rejection: ${event.reason?.message || 'Unknown error'}`,
                type: 'error',
                duration: 5000
            });
        }
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
            notifications: this.notificationService?.getActiveNotifications(),
            performance: this.performanceIntegration?.getPerformanceReport()
        };
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        return this.performanceIntegration?.getPerformanceReport();
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
        
        // Cleanup performance integration first
        this.performanceIntegration?.destroy();
        
        // Cleanup services in reverse order
        this.webSocketClient?.destroy();
        this.appShell?.destroy();
        this.dragDropService?.destroy();
        this.contextMenuService?.destroy();
        this.keyboardShortcutService?.destroy();
        this.touchGestureService?.destroy();
        this.responsiveLayoutService?.destroy();
        this.animationService?.destroy();
        
        // Cleanup error handling services
        this.connectionRecoveryService?.destroy();
        this.offlineModeService?.destroy();
        this.gracefulDegradation?.destroy();
        this.errorHandlingService?.destroy();
        
        // Cleanup core services
        this.stateManager?.destroy();
        this.themeManager?.destroy();
        this.notificationService?.destroy();
        
        console.log('✅ Cleanup complete');
    }

    /**
     * Handle external messages from VS Code webview
     */
    handleMessage(message) {
        console.log('Enhanced UI received external message:', message);
        // Forward to appropriate service or component
        if (this.webSocketClient) {
            this.webSocketClient.handleExternalMessage?.(message);
        }
    }
}

// Make EnhancedWebApp available globally for VS Code webview compatibility
window.EnhancedApp = EnhancedWebApp;