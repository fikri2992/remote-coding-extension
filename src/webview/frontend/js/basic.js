/**
 * VS Code Web Automation Tunnel - Basic UI
 * Traditional script version compatible with VS Code webviews
 */

// Define BasicApp class and assign it to window for global access
class BasicApp {
    constructor() {
        this.client = null;
    }

    async initialize() {
        this.client = new WebAutomationClient();
        return Promise.resolve();
    }

    handleMessage(message) {
        // Handle messages from VS Code webview
        if (this.client) {
            this.client.handleExternalMessage?.(message);
        }
    }

    destroy() {
        if (this.client) {
            this.client.destroy?.();
        }
    }
}

// Make BasicApp available globally
window.BasicApp = BasicApp;

class WebAutomationClient {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.backoffMultiplier = 1.5;
        this.connectionTime = null;
        this.lastPingTime = null;
        this.pingInterval = null;
        this.healthCheckInterval = 15000;
        this.messageQueue = [];
        this.connectionId = null;
        this.networkErrorCount = 0;
        this.maxNetworkErrors = 3;

        this.initializeUI();
        this.connect();
        this.startHealthMonitoring();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        // Get UI elements with fallback for unified frontend
        this.elements = {
            connectionStatus: this.getElementSafely('connectionStatus') || this.getElementSafely('basicConnectionStatus'),
            statusIndicator: this.getElementSafely('statusIndicator') || this.getElementSafely('basicStatusIndicator'),
            statusText: this.getElementSafely('statusText') || this.getElementSafely('basicStatusText'),
            serverUrl: this.getElementSafely('serverUrl') || this.getElementSafely('basicServerUrl'),
            websocketPort: this.getElementSafely('websocketPort') || this.getElementSafely('basicWebsocketPort'),
            connectedClients: this.getElementSafely('connectedClients') || this.getElementSafely('basicConnectedClients'),
            uptime: this.getElementSafely('uptime') || this.getElementSafely('basicUptime'),
            commandInput: this.getElementSafely('commandInput') || this.getElementSafely('basicCommandInput'),
            argsInput: this.getElementSafely('argsInput') || this.getElementSafely('basicArgsInput'),
            executeButton: this.getElementSafely('executeButton') || this.getElementSafely('basicExecuteButton'),
            activeEditor: this.getElementSafely('activeEditor') || this.getElementSafely('basicActiveEditor'),
            workspaceFolders: this.getElementSafely('workspaceFolders') || this.getElementSafely('basicWorkspaceFolders'),
            openEditors: this.getElementSafely('openEditors') || this.getElementSafely('basicOpenEditors'),
            messageLog: this.getElementSafely('messageLog') || this.getElementSafely('basicMessageLog'),
            clearLogButton: this.getElementSafely('clearLogButton') || this.getElementSafely('basicClearLogButton')
        };

        // Validate critical elements
        const criticalElements = ['statusText', 'executeButton', 'messageLog'];
        const missingElements = criticalElements.filter(key => !this.elements[key]);
        
        if (missingElements.length > 0) {
            console.warn('Missing critical UI elements:', missingElements);
            // Continue with graceful degradation
        }

        // Set initial server URL if element exists
        if (this.elements.serverUrl) {
            this.elements.serverUrl.textContent = window.location.origin;
        }

        // Add event listeners with safe element access
        this.addEventListenerSafely(this.elements.executeButton, 'click', () => this.executeCommand());
        this.addEventListenerSafely(this.elements.clearLogButton, 'click', () => this.clearLog());
        
        // Add quick command button listeners
        document.querySelectorAll('.quick-cmd-btn').forEach(button => {
            button.addEventListener('click', () => {
                const command = button.getAttribute('data-command');
                if (command) {
                    this.executeQuickCommand(command);
                }
            });
        });

        // Allow Enter key to execute command
        this.addEventListenerSafely(this.elements.commandInput, 'keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.executeCommand();
            }
        });

        // Update uptime every second
        setInterval(() => this.updateUptime(), 1000);
    }

    /**
     * Safely get element by ID
     */
    getElementSafely(id) {
        try {
            return document.getElementById(id);
        } catch (error) {
            console.warn(`Failed to get element with ID '${id}':`, error);
            return null;
        }
    }

    /**
     * Safely add event listener to element
     */
    addEventListenerSafely(element, event, handler) {
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Cannot add event listener to element:`, element);
        }
    }

    /**
     * Connect to WebSocket server with enhanced error handling
     */
    connect() {
        try {
            // Clear any existing connection
            if (this.websocket) {
                this.websocket.onopen = null;
                this.websocket.onmessage = null;
                this.websocket.onclose = null;
                this.websocket.onerror = null;
                if (this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.close();
                }
            }

            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = parseInt(window.location.port) + 1; // WebSocket port is HTTP port + 1
            const wsUrl = `${protocol}//${window.location.hostname}:${port}`;

            this.elements.websocketPort.textContent = port;
            this.updateConnectionStatus('connecting', `Connecting... (attempt ${this.reconnectAttempts + 1})`);
            this.log('info', `Connecting to WebSocket: ${wsUrl} (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
                    this.websocket.close();
                    this.log('error', 'Connection timeout');
                    this.handleConnectionError(new Error('Connection timeout'));
                }
            }, 10000); // 10 second timeout

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                clearTimeout(connectionTimeout);
                this.onWebSocketOpen();
            };
            this.websocket.onmessage = (event) => this.onWebSocketMessage(event);
            this.websocket.onclose = (event) => {
                clearTimeout(connectionTimeout);
                this.onWebSocketClose(event);
            };
            this.websocket.onerror = (error) => {
                clearTimeout(connectionTimeout);
                this.onWebSocketError(error);
            };

        } catch (error) {
            this.log('error', `Failed to create WebSocket connection: ${error.message}`);
            this.handleConnectionError(error);
        }
    }

    /**
     * Handle WebSocket connection open
     */
    onWebSocketOpen() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.networkErrorCount = 0;
        this.connectionTime = new Date();
        this.updateConnectionStatus('connected', 'Connected');
        this.elements.executeButton.disabled = false;
        this.log('success', 'WebSocket connection established');

        // Start ping/pong for connection health monitoring
        this.startPingPong();

        // Process any queued messages
        this.processMessageQueue();

        // Request initial server status
        this.sendMessage({
            type: 'status',
            id: this.generateId()
        });

        // Configure client preferences for optimal performance
        this.configureClientPreferences();
    }

    /**
     * Handle WebSocket message
     */
    onWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.log('info', `Received: ${message.type}`, message);

            switch (message.type) {
                case 'response':
                    this.handleCommandResponse(message);
                    break;
                case 'broadcast':
                    this.handleBroadcast(message);
                    break;
                case 'status':
                    this.handleStatusUpdate(message);
                    break;
                default:
                    this.log('warning', `Unknown message type: ${message.type}`);
            }
        } catch (error) {
            this.log('error', `Failed to parse WebSocket message: ${error.message}`);
        }
    }

    /**
     * Handle WebSocket connection close
     */
    onWebSocketClose(event) {
        this.isConnected = false;
        this.elements.executeButton.disabled = true;
        this.stopPingPong();

        // Analyze close code for better error handling
        const closeReason = this.getCloseReason(event.code);
        
        if (event.wasClean) {
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.log('info', `WebSocket connection closed cleanly: ${closeReason}`);
        } else {
            this.updateConnectionStatus('disconnected', 'Connection lost');
            this.log('warning', `WebSocket connection lost (code: ${event.code}): ${closeReason}`);
            
            // Determine if we should attempt reconnection
            if (this.shouldAttemptReconnection(event.code)) {
                this.scheduleReconnect();
            } else {
                this.log('error', 'Connection closed permanently, reconnection not attempted');
                this.updateConnectionStatus('disconnected', 'Connection failed');
            }
        }
    }

    /**
     * Handle WebSocket error
     */
    onWebSocketError(error) {
        this.networkErrorCount++;
        this.log('error', `WebSocket error occurred (${this.networkErrorCount}/${this.maxNetworkErrors})`);
        this.updateConnectionStatus('disconnected', 'Connection error');
        this.handleConnectionError(error);
    }

    /**
     * Schedule reconnection attempt with exponential backoff and jitter
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.updateConnectionStatus('disconnected', 'Connection failed - max attempts reached');
            this.log('error', `Max reconnection attempts reached (${this.maxReconnectAttempts}). Manual refresh required.`);
            this.showReconnectionOptions();
            return;
        }

        this.reconnectAttempts++;
        
        // Calculate delay with exponential backoff and jitter
        let delay = Math.min(
            this.reconnectDelay * Math.pow(this.backoffMultiplier, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );
        
        // Add jitter (±25%) to prevent thundering herd
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        delay = Math.max(1000, delay + jitter);

        this.updateConnectionStatus('connecting', `Reconnecting in ${Math.ceil(delay / 1000)}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.log('info', `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.ceil(delay)}ms`);

        // Show countdown
        this.showReconnectionCountdown(delay);

        setTimeout(() => {
            if (!this.isConnected) { // Only reconnect if still disconnected
                this.connect();
            }
        }, delay);
    }



    /**
     * Execute VS Code command
     */
    executeCommand() {
        const command = this.elements.commandInput.value.trim();
        if (!command) {
            this.log('warning', 'Please enter a command');
            return;
        }

        let args = [];
        const argsText = this.elements.argsInput.value.trim();
        if (argsText) {
            try {
                args = JSON.parse(argsText);
                if (!Array.isArray(args)) {
                    args = [args];
                }
            } catch (error) {
                this.log('error', `Invalid arguments JSON: ${error.message}`);
                return;
            }
        }

        this.sendCommandMessage(command, args);
    }

    /**
     * Execute a quick command
     */
    executeQuickCommand(command) {
        this.sendCommandMessage(command, []);
    }

    /**
     * Send command message via WebSocket
     */
    sendCommandMessage(command, args) {
        const message = {
            type: 'command',
            id: this.generateId(),
            command: command,
            args: args
        };

        if (this.sendMessage(message)) {
            this.log('info', `Executing command: ${command}`, args.length > 0 ? args : undefined);
        }
    }

    /**
     * Handle command response
     */
    handleCommandResponse(message) {
        if (message.error) {
            this.log('error', `Command failed: ${message.error}`);
        } else if (message.data) {
            // Handle different response formats
            if (message.data.success === false) {
                this.log('error', `Command failed: ${message.data.error || 'Unknown error'}`);
            } else if (message.data.success === true) {
                this.log('success', `Command executed successfully: ${message.data.command || 'unknown'}`, message.data.result);
            } else {
                this.log('success', 'Command executed successfully', message.data);
            }
        } else {
            this.log('success', 'Command executed successfully');
        }
    }

    /**
     * Handle broadcast message
     */
    handleBroadcast(message) {
        if (message.data) {
            // Handle different types of broadcast messages
            if (message.data.changeType === 'workspaceState' && message.data.data) {
                this.updateWorkspaceState(message.data.data);
            } else if (message.data.workspaceState) {
                // Fallback for direct workspace state
                this.updateWorkspaceState(message.data.workspaceState);
            }
            
            // Log the broadcast for debugging
            this.log('info', `Broadcast received: ${message.data.changeType || 'unknown'}`, message.data);
        }
    }

    /**
     * Handle status update
     */
    handleStatusUpdate(message) {
        if (message.data) {
            this.updateServerInfo(message.data);
            
            // Update workspace state if included
            if (message.data.workspaceState) {
                this.updateWorkspaceState(message.data.workspaceState);
            }
        }
    }

    /**
     * Update workspace state display
     */
    updateWorkspaceState(state) {
        // Update active editor
        if (state.activeEditor) {
            const editor = state.activeEditor;
            this.elements.activeEditor.textContent =
                `${editor.fileName} (${editor.language})\n` +
                `Lines: ${editor.lineCount}\n` +
                `Selection: ${editor.selection.start.line}:${editor.selection.start.character} - ${editor.selection.end.line}:${editor.selection.end.character}`;
        } else {
            this.elements.activeEditor.textContent = 'No active editor';
        }

        // Update workspace folders
        if (state.workspaceFolders && state.workspaceFolders.length > 0) {
            this.elements.workspaceFolders.textContent = state.workspaceFolders.join('\n');
        } else {
            this.elements.workspaceFolders.textContent = 'No workspace folders';
        }

        // Update open editors
        if (state.openEditors && state.openEditors.length > 0) {
            this.elements.openEditors.textContent = state.openEditors.join('\n');
        } else {
            this.elements.openEditors.textContent = 'No open editors';
        }
    }

    /**
     * Update server information display
     */
    updateServerInfo(serverStatus) {
        if (serverStatus.connectedClients !== undefined) {
            this.elements.connectedClients.textContent = serverStatus.connectedClients;
        }
        
        // Update server time if available
        if (serverStatus.serverTime) {
            this.serverStartTime = new Date(serverStatus.serverTime);
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status, text) {
        try {
            if (this.elements.statusIndicator) {
                this.elements.statusIndicator.className = `status-indicator ${status}`;
            }
            if (this.elements.statusText) {
                this.elements.statusText.textContent = text;
            }
            
            // Enable/disable quick command buttons based on connection status
            const isConnected = status === 'connected';
            document.querySelectorAll('.quick-cmd-btn').forEach(button => {
                button.disabled = !isConnected;
            });
        } catch (error) {
            console.warn('Failed to update connection status:', error);
        }
    }

    /**
     * Update uptime display
     */
    updateUptime() {
        try {
            if (!this.elements.uptime) {
                return; // Element not available, skip gracefully
            }
            
            if (this.isConnected && this.connectionTime) {
                const now = new Date();
                const uptimeMs = now.getTime() - this.connectionTime.getTime();
                const uptimeSeconds = Math.floor(uptimeMs / 1000);
                
                const hours = Math.floor(uptimeSeconds / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                const seconds = uptimeSeconds % 60;
                
                if (hours > 0) {
                    this.elements.uptime.textContent = `${hours}h ${minutes}m ${seconds}s`;
                } else if (minutes > 0) {
                    this.elements.uptime.textContent = `${minutes}m ${seconds}s`;
                } else {
                    this.elements.uptime.textContent = `${seconds}s`;
                }
            } else {
                this.elements.uptime.textContent = this.isConnected ? 'Connected' : 'Disconnected';
            }
        } catch (error) {
            console.warn('Failed to update uptime:', error);
        }
    }

    /**
     * Log message to the message log
     */
    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data);
        
        // Add to UI log if element exists
        if (!this.elements.messageLog) {
            return; // Element not available, only console log
        }
        
        try {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${level}`;

            const timestampSpan = document.createElement('div');
            timestampSpan.className = 'log-timestamp';
            timestampSpan.textContent = timestamp;

            const messageSpan = document.createElement('div');
            messageSpan.className = 'log-message';
            messageSpan.textContent = message;

            logEntry.appendChild(timestampSpan);
            logEntry.appendChild(messageSpan);

            if (data) {
                const dataSpan = document.createElement('div');
                dataSpan.className = 'log-message';
                dataSpan.style.color = '#9cdcfe';
                dataSpan.style.fontSize = '12px';
                dataSpan.textContent = JSON.stringify(data, null, 2);
                logEntry.appendChild(dataSpan);
            }

            this.elements.messageLog.appendChild(logEntry);
            this.elements.messageLog.scrollTop = this.elements.messageLog.scrollHeight;

            // Keep only last 100 log entries
            while (this.elements.messageLog.children.length > 100) {
                this.elements.messageLog.removeChild(this.elements.messageLog.firstChild);
            }
        } catch (error) {
            console.warn('Failed to add log entry to UI:', error);
        }
    }

    /**
     * Clear message log
     */
    clearLog() {
        this.elements.messageLog.innerHTML = '';
        this.log('info', 'Log cleared');
    }

    /**
     * Handle connection errors with detailed analysis
     */
    handleConnectionError(error) {
        console.error('Connection error details:', error);
        
        // Analyze error type and provide specific guidance
        let errorMessage = 'Connection error occurred';
        let suggestedAction = 'Retrying automatically...';
        
        if (error && error.message) {
            if (error.message.includes('timeout')) {
                errorMessage = 'Connection timeout - server may be overloaded';
                suggestedAction = 'Will retry with longer timeout';
            } else if (error.message.includes('refused')) {
                errorMessage = 'Connection refused - server may be down';
                suggestedAction = 'Check if server is running';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error - check internet connection';
                suggestedAction = 'Verify network connectivity';
            }
        }
        
        this.log('error', `${errorMessage}. ${suggestedAction}`);
        
        // If too many network errors, suggest manual intervention
        if (this.networkErrorCount >= this.maxNetworkErrors) {
            this.log('error', 'Multiple network errors detected. Consider refreshing the page or checking server status.');
        }
    }

    /**
     * Get human-readable close reason
     */
    getCloseReason(code) {
        const closeReasons = {
            1000: 'Normal closure',
            1001: 'Going away',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1005: 'No status received',
            1006: 'Abnormal closure',
            1007: 'Invalid frame payload data',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Mandatory extension',
            1011: 'Internal server error',
            1015: 'TLS handshake failure'
        };
        
        return closeReasons[code] || `Unknown close code: ${code}`;
    }

    /**
     * Determine if reconnection should be attempted based on close code
     */
    shouldAttemptReconnection(code) {
        // Don't reconnect for these codes
        const noReconnectCodes = [1002, 1003, 1007, 1008, 1010]; // Protocol/policy errors
        return !noReconnectCodes.includes(code);
    }

    /**
     * Start ping/pong for connection health monitoring
     */
    startPingPong() {
        this.stopPingPong(); // Clear any existing interval
        
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.lastPingTime = Date.now();
                
                // Send ping message
                this.sendMessage({
                    type: 'ping',
                    timestamp: this.lastPingTime
                });
            }
        }, this.healthCheckInterval);
    }

    /**
     * Stop ping/pong monitoring
     */
    stopPingPong() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckInterval);
    }

    /**
     * Perform connection health check
     */
    performHealthCheck() {
        if (!this.isConnected) {
            return;
        }

        const now = Date.now();
        
        // Check if ping response is overdue
        if (this.lastPingTime && (now - this.lastPingTime) > this.healthCheckInterval * 2) {
            this.log('warning', 'Connection health check failed - no ping response');
            
            // Force reconnection if connection seems dead
            if (this.websocket) {
                this.websocket.close(1006, 'Health check failed');
            }
        }
    }

    /**
     * Process queued messages after reconnection
     */
    processMessageQueue() {
        if (this.messageQueue.length > 0) {
            this.log('info', `Processing ${this.messageQueue.length} queued messages`);
            
            const queue = [...this.messageQueue];
            this.messageQueue = [];
            
            queue.forEach(message => {
                this.sendMessage(message);
            });
        }
    }

    /**
     * Configure client preferences for optimal performance
     */
    configureClientPreferences() {
        const preferences = {
            type: 'broadcast',
            data: {
                type: 'clientConfig',
                config: {
                    incrementalUpdates: true,
                    statePreferences: {
                        includeDocumentChanges: true,
                        includeSelectionChanges: false, // Reduce noise
                        includeDiagnostics: true,
                        throttleMs: 1000 // Throttle updates to 1 second
                    }
                }
            }
        };
        
        this.sendMessage(preferences);
    }

    /**
     * Show reconnection countdown
     */
    showReconnectionCountdown(totalDelay) {
        let remaining = Math.ceil(totalDelay / 1000);
        
        const countdownInterval = setInterval(() => {
            remaining--;
            if (remaining > 0 && !this.isConnected) {
                this.updateConnectionStatus('connecting', `Reconnecting in ${remaining}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }

    /**
     * Show reconnection options when max attempts reached
     */
    showReconnectionOptions() {
        // Create a retry button in the UI
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Retry Connection';
        retryButton.className = 'retry-btn';
        retryButton.onclick = () => {
            this.reconnectAttempts = 0;
            this.networkErrorCount = 0;
            retryButton.remove();
            this.connect();
        };
        
        // Add button to connection status area
        const statusArea = document.querySelector('.connection-status');
        if (statusArea && !statusArea.querySelector('.retry-btn')) {
            statusArea.appendChild(retryButton);
        }
    }

    /**
     * Enhanced send message with queuing for offline scenarios
     */
    sendMessage(message) {
        if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            // Queue non-critical messages for later
            if (message.type !== 'ping' && message.type !== 'status') {
                this.messageQueue.push(message);
                this.log('info', 'Message queued for when connection is restored');
            }
            return false;
        }

        try {
            this.websocket.send(JSON.stringify(message));
            this.log('info', `Sent: ${message.type}`, message);
            return true;
        } catch (error) {
            this.log('error', `Failed to send message: ${error.message}`);
            
            // Queue the message for retry
            if (message.type !== 'ping') {
                this.messageQueue.push(message);
            }
            
            return false;
        }
    }

    /**
     * Enhanced message handling with error recovery
     */
    onWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            // Handle pong responses
            if (message.type === 'pong') {
                const latency = Date.now() - (message.timestamp || this.lastPingTime || 0);
                this.log('info', `Ping latency: ${latency}ms`);
                return;
            }
            
            this.log('info', `Received: ${message.type}`, message);

            switch (message.type) {
                case 'response':
                    this.handleCommandResponse(message);
                    break;
                case 'broadcast':
                    this.handleBroadcast(message);
                    break;
                case 'status':
                    this.handleStatusUpdate(message);
                    break;
                case 'error':
                    this.handleServerError(message);
                    break;
                default:
                    this.log('warning', `Unknown message type: ${message.type}`);
            }
        } catch (error) {
            this.log('error', `Failed to parse WebSocket message: ${error.message}`);
            // Don't disconnect for parse errors, just log them
        }
    }

    /**
     * Handle server error messages
     */
    handleServerError(message) {
        const errorMsg = message.error || message.data?.error || 'Unknown server error';
        this.log('error', `Server error: ${errorMsg}`);
        
        // Show user-friendly error notification
        if (message.data?.userMessage) {
            this.showErrorNotification(message.data.userMessage, message.data.suggestedActions);
        }
    }

    /**
     * Show error notification to user
     */
    showErrorNotification(message, suggestedActions = []) {
        // Create error notification element
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="error-message">${message}</div>
            ${suggestedActions.length > 0 ? `
                <div class="error-actions">
                    ${suggestedActions.map(action => `<button class="error-action-btn">${action}</button>`).join('')}
                </div>
            ` : ''}
            <button class="error-close-btn">×</button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
        
        // Handle close button
        notification.querySelector('.error-close-btn').onclick = () => notification.remove();
    }

    /**
     * Generate unique ID for messages
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Handle external messages from VS Code webview
     */
    handleExternalMessage(message) {
        this.log('info', 'Received external message:', message);
        // Handle messages from VS Code extension
        // Implementation depends on the specific message format
    }

    /**
     * Cleanup and destroy the client
     */
    destroy() {
        this.log('info', 'Destroying WebAutomation client...');
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        this.isConnected = false;
        this.messageQueue = [];
    }
}