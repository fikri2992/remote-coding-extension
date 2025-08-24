/**
 * Enhanced WebSocket Client Service
 * Advanced WebSocket client with enhanced messaging protocol, offline support, and real-time features
 */

export class WebSocketClient {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        this.websocket = null;
        
        // Connection state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.backoffMultiplier = 1.5;
        this.connectionStartTime = null;
        
        // Enhanced message handling
        this.messageQueue = [];
        this.offlineMessageQueue = [];
        this.pendingMessages = new Map();
        this.messageHandlers = new Map();
        this.messageCallbacks = new Map();
        
        // Typing indicators
        this.typingIndicators = new Map();
        this.typingTimeout = null;
        this.typingDebounceMs = 1000;
        
        // Message status tracking
        this.messageStatus = new Map(); // Track message delivery status
        this.messageRetries = new Map(); // Track retry attempts
        this.maxMessageRetries = 3;
        
        // Heartbeat and health monitoring
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.heartbeatIntervalMs = 30000; // 30 seconds
        this.heartbeatTimeoutMs = 10000; // 10 seconds
        this.lastPongTime = null;
        this.connectionHealthScore = 100;
        
        // Connection info and metrics
        this.connectionId = null;
        this.serverInfo = {};
        this.connectionMetrics = {
            messagesReceived: 0,
            messagesSent: 0,
            reconnections: 0,
            averageLatency: 0,
            lastLatency: 0
        };
        
        // Offline mode support
        this.isOfflineMode = false;
        this.offlineModeEnabled = true;
        this.maxOfflineMessages = 100;
        
        // Enhanced protocol support
        this.protocolVersion = '2.0';
        this.supportedMessageTypes = [
            'command', 'response', 'broadcast', 'status', 'error',
            'prompt', 'git', 'fileSystem', 'config', 'typing', 'ping', 'pong'
        ];
        
        // Bind methods
        this.handleOpen = this.handleOpen.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleError = this.handleError.bind(this);
        
        // Set up enhanced message handlers
        this.setupEnhancedMessageHandlers();
        
        // Set up page visibility handling for offline mode
        this.setupPageVisibilityHandling();
    }

    /**
     * Connect to WebSocket server
     */
    async connect() {
        if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
            return; // Already connecting
        }
        
        if (this.isConnected) {
            return; // Already connected
        }
        
        try {
            // Update connection state
            this.stateManager.updateConnection({
                status: 'connecting',
                reconnectAttempts: this.reconnectAttempts
            });
            
            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = parseInt(window.location.port) + 1; // WebSocket port is HTTP port + 1
            const wsUrl = `${protocol}//${window.location.hostname}:${port}`;
            
            console.log(`🔌 Connecting to WebSocket: ${wsUrl} (attempt ${this.reconnectAttempts + 1})`);
            
            // Create WebSocket connection
            this.websocket = new WebSocket(wsUrl);
            
            // Set up event listeners
            this.websocket.addEventListener('open', this.handleOpen);
            this.websocket.addEventListener('message', this.handleMessage);
            this.websocket.addEventListener('close', this.handleClose);
            this.websocket.addEventListener('error', this.handleError);
            
            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
                    console.warn('⏰ WebSocket connection timeout');
                    this.websocket.close();
                }
            }, 10000);
            
            // Wait for connection to open
            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    clearTimeout(connectionTimeout);
                    this.websocket.removeEventListener('open', onOpen);
                    this.websocket.removeEventListener('error', onError);
                };
                
                const onOpen = () => {
                    cleanup();
                    resolve();
                };
                
                const onError = (error) => {
                    cleanup();
                    reject(error);
                };
                
                this.websocket.addEventListener('open', onOpen, { once: true });
                this.websocket.addEventListener('error', onError, { once: true });
            });
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.handleConnectionError(error);
            throw error;
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.websocket) {
            // Stop heartbeat
            this.stopHeartbeat();
            
            // Close connection
            this.websocket.close(1000, 'Client disconnect');
            this.websocket = null;
        }
        
        this.isConnected = false;
        this.connectionId = null;
        
        // Update state
        this.stateManager.updateConnection({
            status: 'disconnected',
            lastConnected: new Date()
        });
    }

    /**
     * Send message to server
     */
    async sendMessage(message) {
        if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            // Queue message for later
            if (message.type !== 'ping') {
                this.messageQueue.push(message);
                console.log('📤 Message queued (not connected):', message.type);
            }
            return false;
        }
        
        try {
            // Add message ID if not present
            if (!message.id) {
                message.id = this.generateMessageId();
            }
            
            // Track pending message if it expects a response
            if (message.type === 'command' || message.type === 'request') {
                this.pendingMessages.set(message.id, {
                    message,
                    timestamp: Date.now()
                });
            }
            
            // Send message
            this.websocket.send(JSON.stringify(message));
            console.log('📤 Sent message:', message.type, message.id);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            
            // Queue message for retry if it's not a ping
            if (message.type !== 'ping') {
                this.messageQueue.push(message);
            }
            
            return false;
        }
    }

    /**
     * Handle WebSocket open event
     */
    handleOpen() {
        console.log('✅ Enhanced WebSocket connected');
        
        this.isConnected = true;
        this.isOfflineMode = false;
        this.reconnectAttempts = 0;
        this.connectionStartTime = Date.now();
        this.connectionMetrics.reconnections = this.reconnectAttempts;
        
        // Update connection state with enhanced info
        this.stateManager.updateConnection({
            status: 'connected',
            lastConnected: new Date(),
            reconnectAttempts: 0,
            isOfflineMode: false,
            protocolVersion: this.protocolVersion,
            connectionHealth: this.connectionHealthScore
        });
        
        // Show connection success notification
        if (this.notificationService) {
            this.notificationService.show({
                type: 'success',
                message: 'Connected to server',
                duration: 3000
            });
        }
        
        // Start enhanced heartbeat
        this.startHeartbeat();
        
        // Process all queued messages (both online and offline)
        this.processAllQueuedMessages();
        
        // Send enhanced handshake with protocol version
        this.sendHandshake();
        
        // Request initial server status
        this.sendMessage({
            type: 'status',
            id: this.generateMessageId(),
            protocolVersion: this.protocolVersion
        });
    }

    /**
     * Handle WebSocket message event
     */
    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('📥 Received message:', message.type, message.id);
            
            // Handle pong responses
            if (message.type === 'pong') {
                this.handlePong(message);
                return;
            }
            
            // Remove from pending messages if this is a response
            if (message.id && this.pendingMessages.has(message.id)) {
                this.pendingMessages.delete(message.id);
            }
            
            // Route message to appropriate handler
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
                handler(message);
            } else {
                console.warn('⚠️ No handler for message type:', message.type);
            }
            
        } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
        }
    }

    /**
     * Handle WebSocket close event
     */
    handleClose(event) {
        console.log('🔌 Enhanced WebSocket closed:', event.code, event.reason);
        
        this.isConnected = false;
        this.connectionId = null;
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Enable offline mode if supported
        if (this.offlineModeEnabled && !event.wasClean) {
            this.enableOfflineMode();
        }
        
        // Update connection state with enhanced info
        this.stateManager.updateConnection({
            status: 'disconnected',
            lastConnected: new Date(),
            isOfflineMode: this.isOfflineMode,
            closeCode: event.code,
            closeReason: this.getCloseReason(event.code)
        });
        
        // Show disconnection notification
        if (this.notificationService && !event.wasClean) {
            this.notificationService.show({
                type: 'warning',
                message: `Connection lost: ${this.getCloseReason(event.code)}`,
                duration: 5000
            });
        }
        
        // Schedule reconnection if not a clean close
        if (!event.wasClean && this.shouldReconnect(event.code)) {
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket error event
     */
    handleError(error) {
        console.error('❌ WebSocket error:', error);
        this.handleConnectionError(error);
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        this.stateManager.updateConnection({
            status: 'disconnected',
            lastError: error.message || 'Connection error'
        });
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            this.stateManager.updateConnection({
                status: 'disconnected',
                lastError: 'Max reconnection attempts reached'
            });
            return;
        }
        
        this.reconnectAttempts++;
        
        // Calculate delay with exponential backoff
        let delay = Math.min(
            this.reconnectDelay * Math.pow(this.backoffMultiplier, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );
        
        // Add jitter
        delay = delay + (Math.random() * 1000);
        
        console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                this.connect().catch(error => {
                    console.error('❌ Reconnection failed:', error);
                });
            }
        }, delay);
    }

    /**
     * Determine if we should attempt reconnection
     */
    shouldReconnect(closeCode) {
        // Don't reconnect for these codes
        const noReconnectCodes = [1002, 1003, 1007, 1008, 1010]; // Protocol/policy errors
        return !noReconnectCodes.includes(closeCode);
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        if (this.messageQueue.length === 0) {
            return;
        }
        
        console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
        
        const queue = [...this.messageQueue];
        this.messageQueue = [];
        
        queue.forEach(message => {
            this.sendMessage(message);
        });
    }

    /**
     * Start heartbeat
     */
    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing heartbeat
        
        this.heartbeatInterval = setInterval(() => {
            this.sendPing();
        }, this.heartbeatIntervalMs);
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    /**
     * Pause heartbeat (for when page is hidden)
     */
    pauseHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Resume heartbeat (for when page becomes visible)
     */
    resumeHeartbeat() {
        if (this.isConnected && !this.heartbeatInterval) {
            this.startHeartbeat();
        }
    }

    /**
     * Send ping message
     */
    sendPing() {
        const pingMessage = {
            type: 'ping',
            timestamp: Date.now()
        };
        
        this.sendMessage(pingMessage);
        
        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
            console.warn('⚠️ Heartbeat timeout - no pong received');
            if (this.websocket) {
                this.websocket.close(1006, 'Heartbeat timeout');
            }
        }, this.heartbeatTimeoutMs);
    }

    /**
     * Handle pong message with enhanced metrics
     */
    handlePong(message) {
        this.lastPongTime = Date.now();
        
        // Clear heartbeat timeout
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
        
        // Calculate latency and update metrics
        if (message.timestamp) {
            const latency = this.lastPongTime - message.timestamp;
            this.connectionMetrics.lastLatency = latency;
            
            // Update average latency
            if (this.connectionMetrics.averageLatency === 0) {
                this.connectionMetrics.averageLatency = latency;
            } else {
                this.connectionMetrics.averageLatency = 
                    (this.connectionMetrics.averageLatency * 0.8) + (latency * 0.2);
            }
            
            // Update connection health based on latency
            if (latency < 100) {
                this.connectionHealthScore = Math.min(100, this.connectionHealthScore + 1);
            } else if (latency > 1000) {
                this.connectionHealthScore = Math.max(0, this.connectionHealthScore - 5);
            }
            
            this.stateManager.updateConnection({ 
                latency,
                averageLatency: Math.round(this.connectionMetrics.averageLatency),
                connectionHealth: this.connectionHealthScore
            });
        }
    }

    // Prompt Handling Helper Methods

    /**
     * Handle prompt save operation
     */
    handlePromptSave(content, metadata) {
        this.stateManager.addPromptToHistory({
            content,
            category: metadata?.category,
            tags: metadata?.tags || [],
            filePath: metadata?.filePath,
            timestamp: new Date(metadata?.timestamp || Date.now())
        });
    }

    /**
     * Handle prompt history operation
     */
    handlePromptHistory(content) {
        if (Array.isArray(content)) {
            this.stateManager.updatePrompts({
                history: content.map(prompt => ({
                    ...prompt,
                    timestamp: new Date(prompt.timestamp)
                }))
            });
        }
    }

    /**
     * Handle prompt search operation
     */
    handlePromptSearch(content) {
        this.stateManager.updatePrompts({
            searchResults: content
        });
    }

    /**
     * Handle prompt category operation
     */
    handlePromptCategory(content) {
        this.stateManager.updatePrompts({
            categories: content
        });
    }

    /**
     * Handle file system change notifications
     */
    handleFileSystemChange(changeData) {
        if (changeData.type === 'file' && changeData.event === 'change') {
            // File was modified
            this.stateManager.updateFileSystem({
                lastModified: {
                    path: changeData.path,
                    timestamp: new Date()
                }
            });
        } else if (changeData.type === 'directory') {
            // Directory structure changed, request updated tree
            this.sendFileSystemCommand('tree', changeData.path);
        }
    }

    /**
     * Set up enhanced message handlers for new protocol
     */
    setupEnhancedMessageHandlers() {
        // Legacy handlers
        this.messageHandlers.set('response', (message) => {
            this.handleCommandResponse(message);
        });
        
        this.messageHandlers.set('broadcast', (message) => {
            this.handleBroadcast(message);
        });
        
        this.messageHandlers.set('status', (message) => {
            this.handleStatusUpdate(message);
        });
        
        this.messageHandlers.set('error', (message) => {
            this.handleServerError(message);
        });
        
        // Enhanced protocol handlers
        this.messageHandlers.set('prompt', (message) => {
            this.handlePromptMessage(message);
        });
        
        this.messageHandlers.set('git', (message) => {
            this.handleGitMessage(message);
        });
        
        this.messageHandlers.set('fileSystem', (message) => {
            this.handleFileSystemMessage(message);
        });
        
        this.messageHandlers.set('config', (message) => {
            this.handleConfigMessage(message);
        });
        
        this.messageHandlers.set('typing', (message) => {
            this.handleTypingIndicator(message);
        });
        
        // Message status handlers
        this.messageHandlers.set('messageStatus', (message) => {
            this.handleMessageStatus(message);
        });
        
        this.messageHandlers.set('ack', (message) => {
            this.handleMessageAcknowledgment(message);
        });
    }

    /**
     * Handle broadcast messages
     */
    handleBroadcast(message) {
        if (message.data) {
            const { changeType, data } = message.data;
            
            switch (changeType) {
                case 'workspaceState':
                    // Update workspace state
                    break;
                case 'gitStatus':
                    this.stateManager.updateGit(data);
                    break;
                case 'fileSystem':
                    this.stateManager.updateFileSystem(data);
                    break;
                default:
                    console.log('📥 Unknown broadcast type:', changeType);
            }
        }
    }

    /**
     * Handle status updates
     */
    handleStatusUpdate(message) {
        if (message.data) {
            this.serverInfo = message.data;
            
            this.stateManager.updateConnection({
                serverInfo: this.serverInfo
            });
        }
    }

    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            lastPongTime: this.lastPongTime,
            queuedMessages: this.messageQueue.length,
            pendingMessages: this.pendingMessages.size
        };
    }

    // Enhanced Message Handlers

    /**
     * Handle prompt messages
     */
    handlePromptMessage(message) {
        console.log('📥 Prompt message:', message);
        
        if (message.data) {
            const { operation, content, metadata } = message.data;
            
            switch (operation) {
                case 'save':
                    this.handlePromptSave(content, metadata);
                    break;
                case 'history':
                    this.handlePromptHistory(content);
                    break;
                case 'search':
                    this.handlePromptSearch(content);
                    break;
                case 'category':
                    this.handlePromptCategory(content);
                    break;
                default:
                    console.warn('Unknown prompt operation:', operation);
            }
        }
    }

    /**
     * Handle git messages
     */
    handleGitMessage(message) {
        console.log('📥 Git message:', message);
        
        if (message.data) {
            const { operation, result } = message.data;
            
            switch (operation) {
                case 'status':
                    this.stateManager.updateGit({ status: result });
                    break;
                case 'log':
                    this.stateManager.updateGit({ recentCommits: result });
                    break;
                case 'diff':
                    this.stateManager.updateGit({ currentDiff: result });
                    break;
                case 'branch':
                    this.stateManager.updateGit({ 
                        currentBranch: result.current,
                        remoteStatus: result.remote 
                    });
                    break;
                default:
                    console.warn('Unknown git operation:', operation);
            }
        }
    }

    /**
     * Handle file system messages
     */
    handleFileSystemMessage(message) {
        console.log('📥 File system message:', message);
        
        if (message.data) {
            const { operation, path, content } = message.data;
            
            switch (operation) {
                case 'tree':
                    this.stateManager.updateFileSystem({ rootNodes: content });
                    break;
                case 'open':
                    // File opened in VS Code
                    this.stateManager.updateFileSystem({ selectedFile: path });
                    break;
                case 'watch':
                    // File system change notification
                    this.handleFileSystemChange(content);
                    break;
                case 'search':
                    this.stateManager.updateFileSystem({ filteredNodes: content });
                    break;
                default:
                    console.warn('Unknown file system operation:', operation);
            }
        }
    }

    /**
     * Handle config messages
     */
    handleConfigMessage(message) {
        console.log('📥 Config message:', message);
        
        if (message.data) {
            const { key, value, schema } = message.data;
            
            // Update preferences if it's a UI config
            if (key.startsWith('ui.')) {
                const prefKey = key.replace('ui.', '');
                this.stateManager.updatePreferences({ [prefKey]: value });
            }
            
            // Store server config
            this.serverInfo.config = this.serverInfo.config || {};
            this.serverInfo.config[key] = { value, schema };
        }
    }

    /**
     * Handle typing indicators
     */
    handleTypingIndicator(message) {
        if (message.data) {
            const { userId, isTyping, section } = message.data;
            
            if (isTyping) {
                this.typingIndicators.set(userId, {
                    section,
                    timestamp: Date.now()
                });
            } else {
                this.typingIndicators.delete(userId);
            }
            
            // Update chat state with typing indicators
            this.stateManager.updateChat({
                typingUsers: Array.from(this.typingIndicators.keys())
            });
        }
    }

    /**
     * Handle message status updates
     */
    handleMessageStatus(message) {
        if (message.data && message.data.messageId) {
            const { messageId, status, error } = message.data;
            
            this.messageStatus.set(messageId, { status, error, timestamp: Date.now() });
            
            // Update UI with message status
            this.stateManager.updateChat({
                messageStatuses: Object.fromEntries(this.messageStatus)
            });
        }
    }

    /**
     * Handle message acknowledgments
     */
    handleMessageAcknowledgment(message) {
        if (message.data && message.data.messageId) {
            const { messageId } = message.data;
            
            // Remove from pending messages
            this.pendingMessages.delete(messageId);
            
            // Update message status
            this.messageStatus.set(messageId, { 
                status: 'delivered', 
                timestamp: Date.now() 
            });
        }
    }

    /**
     * Handle command responses with enhanced error handling
     */
    handleCommandResponse(message) {
        console.log('📥 Enhanced command response:', message);
        
        // Update message status
        if (message.id) {
            this.messageStatus.set(message.id, {
                status: message.error ? 'error' : 'success',
                error: message.error,
                timestamp: Date.now()
            });
        }
        
        // Execute callback if registered
        if (message.id && this.messageCallbacks.has(message.id)) {
            const callback = this.messageCallbacks.get(message.id);
            this.messageCallbacks.delete(message.id);
            
            try {
                callback(message.error, message.data);
            } catch (error) {
                console.error('Error in message callback:', error);
            }
        }
        
        // Show notification for errors
        if (message.error && this.notificationService) {
            this.notificationService.show({
                type: 'error',
                message: `Command failed: ${message.error}`,
                duration: 5000
            });
        }
    }

    /**
     * Handle server errors with enhanced reporting
     */
    handleServerError(message) {
        console.error('📥 Enhanced server error:', message);
        
        const errorMsg = message.error || message.data?.error || 'Unknown server error';
        
        // Show user-friendly error notification
        if (this.notificationService) {
            this.notificationService.show({
                type: 'error',
                message: errorMsg,
                duration: 8000,
                actions: message.data?.suggestedActions || []
            });
        }
        
        // Update connection health score
        this.connectionHealthScore = Math.max(0, this.connectionHealthScore - 10);
        this.stateManager.updateConnection({ 
            connectionHealth: this.connectionHealthScore 
        });
    }

    // Enhanced Messaging Methods

    /**
     * Send enhanced message with callback support
     */
    async sendEnhancedMessage(type, data, options = {}) {
        const message = {
            type,
            id: this.generateMessageId(),
            data,
            timestamp: Date.now(),
            protocolVersion: this.protocolVersion,
            ...options
        };
        
        // Register callback if provided
        if (options.callback) {
            this.messageCallbacks.set(message.id, options.callback);
        }
        
        // Set message status to pending
        this.messageStatus.set(message.id, {
            status: 'pending',
            timestamp: Date.now()
        });
        
        const sent = await this.sendMessage(message);
        
        if (!sent) {
            // Update status to failed
            this.messageStatus.set(message.id, {
                status: 'failed',
                timestamp: Date.now()
            });
        }
        
        return sent;
    }

    /**
     * Send prompt message
     */
    async sendPrompt(content, options = {}) {
        return this.sendEnhancedMessage('prompt', {
            operation: 'execute',
            content,
            category: options.category,
            tags: options.tags || [],
            saveToHistory: options.saveToHistory !== false
        }, options);
    }

    /**
     * Send git command
     */
    async sendGitCommand(operation, params = {}, options = {}) {
        return this.sendEnhancedMessage('git', {
            operation,
            params
        }, options);
    }

    /**
     * Send file system command
     */
    async sendFileSystemCommand(operation, path, options = {}) {
        return this.sendEnhancedMessage('fileSystem', {
            operation,
            path,
            ...options
        }, options);
    }

    /**
     * Send typing indicator
     */
    sendTypingIndicator(isTyping, section = 'chat') {
        // Debounce typing indicators
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.sendMessage({
            type: 'typing',
            data: {
                isTyping,
                section,
                timestamp: Date.now()
            }
        });
        
        // Auto-stop typing after debounce period
        if (isTyping) {
            this.typingTimeout = setTimeout(() => {
                this.sendTypingIndicator(false, section);
            }, this.typingDebounceMs);
        }
    }

    // Offline Mode Support

    /**
     * Enable offline mode
     */
    enableOfflineMode() {
        if (!this.offlineModeEnabled) return;
        
        console.log('📴 Enabling offline mode');
        this.isOfflineMode = true;
        
        this.stateManager.updateConnection({
            isOfflineMode: true,
            status: 'offline'
        });
        
        if (this.notificationService) {
            this.notificationService.show({
                type: 'info',
                message: 'Working offline - messages will be queued',
                duration: 5000
            });
        }
    }

    /**
     * Disable offline mode
     */
    disableOfflineMode() {
        console.log('🌐 Disabling offline mode');
        this.isOfflineMode = false;
        
        this.stateManager.updateConnection({
            isOfflineMode: false
        });
    }

    /**
     * Process all queued messages (online and offline)
     */
    processAllQueuedMessages() {
        // Process regular message queue
        this.processMessageQueue();
        
        // Process offline message queue
        if (this.offlineMessageQueue.length > 0) {
            console.log(`📤 Processing ${this.offlineMessageQueue.length} offline messages`);
            
            const offlineQueue = [...this.offlineMessageQueue];
            this.offlineMessageQueue = [];
            
            offlineQueue.forEach(message => {
                // Add offline indicator to message
                message.wasOffline = true;
                this.sendMessage(message);
            });
        }
    }

    /**
     * Enhanced send message with offline support
     */
    async sendMessage(message) {
        // Add message ID if not present
        if (!message.id) {
            message.id = this.generateMessageId();
        }
        
        // Update metrics
        this.connectionMetrics.messagesSent++;
        
        if (!this.isConnected || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            // Handle offline mode
            if (this.isOfflineMode && this.offlineModeEnabled) {
                // Queue in offline queue with size limit
                if (this.offlineMessageQueue.length < this.maxOfflineMessages) {
                    this.offlineMessageQueue.push({
                        ...message,
                        queuedAt: Date.now()
                    });
                    console.log('📴 Message queued offline:', message.type);
                } else {
                    console.warn('📴 Offline queue full, dropping message:', message.type);
                }
            } else {
                // Queue in regular queue for non-critical messages
                if (message.type !== 'ping' && message.type !== 'typing') {
                    this.messageQueue.push(message);
                    console.log('📤 Message queued (not connected):', message.type);
                }
            }
            return false;
        }

        try {
            // Track pending message if it expects a response
            if (message.type === 'command' || message.type === 'request' || 
                message.type === 'prompt' || message.type === 'git' || 
                message.type === 'fileSystem') {
                this.pendingMessages.set(message.id, {
                    message,
                    timestamp: Date.now(),
                    retries: 0
                });
            }

            // Send message
            this.websocket.send(JSON.stringify(message));
            console.log('📤 Sent enhanced message:', message.type, message.id);

            return true;
        } catch (error) {
            console.error('❌ Failed to send enhanced message:', error);

            // Queue message for retry if it's not a ping or typing indicator
            if (message.type !== 'ping' && message.type !== 'typing') {
                this.messageQueue.push(message);
            }

            return false;
        }
    }

    // Page Visibility Handling

    /**
     * Set up page visibility handling for offline mode
     */
    setupPageVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, pause heartbeat to save resources
                this.pauseHeartbeat();
            } else {
                // Page is visible, resume heartbeat
                this.resumeHeartbeat();
                
                // Check connection health
                if (this.isConnected) {
                    this.sendPing();
                }
            }
        });
    }

    // Utility Methods

    /**
     * Send handshake with protocol version
     */
    sendHandshake() {
        this.sendMessage({
            type: 'handshake',
            data: {
                protocolVersion: this.protocolVersion,
                clientCapabilities: {
                    offlineMode: this.offlineModeEnabled,
                    typingIndicators: true,
                    messageStatus: true,
                    enhancedProtocol: true
                },
                timestamp: Date.now()
            }
        });
    }

    /**
     * Get close reason with enhanced descriptions
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
            1012: 'Service restart',
            1013: 'Try again later',
            1014: 'Bad gateway',
            1015: 'TLS handshake failure'
        };
        
        return closeReasons[code] || `Unknown close code: ${code}`;
    }

    /**
     * Send file system command for .remoterc operations
     */
    sendFileSystemCommand(operation, data, callback) {
        const message = {
            type: 'fileSystem',
            id: this.generateMessageId(),
            data: {
                operation: operation,
                ...data
            }
        };

        // Register callback if provided
        if (callback) {
            this.messageCallbacks.set(message.id, callback);
        }

        return this.sendMessage(message);
    }

    /**
     * Send prompt command for enhanced prompt handling
     */
    sendPrompt(content, options = {}) {
        const message = {
            type: 'prompt',
            id: this.generateMessageId(),
            data: {
                content: content,
                category: options.category,
                tags: options.tags || [],
                saveToHistory: options.saveToHistory !== false,
                metadata: options.metadata || {}
            }
        };

        // Register callback if provided
        if (options.callback) {
            this.messageCallbacks.set(message.id, options.callback);
        }

        return this.sendMessage(message);
    }

    /**
     * Send git command
     */
    sendGitCommand(operation, data, callback) {
        const message = {
            type: 'git',
            id: this.generateMessageId(),
            data: {
                operation: operation,
                ...data
            }
        };

        // Register callback if provided
        if (callback) {
            this.messageCallbacks.set(message.id, callback);
        }

        return this.sendMessage(message);
    }

    /**
     * Send typing indicator
     */
    sendTypingIndicator(isTyping, section = 'chat') {
        // Debounce typing indicators
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        if (isTyping) {
            this.sendMessage({
                type: 'typing',
                data: {
                    isTyping: true,
                    section: section,
                    timestamp: Date.now()
                }
            });

            // Auto-stop typing after timeout
            this.typingTimeout = setTimeout(() => {
                this.sendTypingIndicator(false, section);
            }, this.typingDebounceMs);
        } else {
            this.sendMessage({
                type: 'typing',
                data: {
                    isTyping: false,
                    section: section,
                    timestamp: Date.now()
                }
            });
        }
    }

    /**
     * Get enhanced connection status
     */
    getEnhancedConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isOfflineMode: this.isOfflineMode,
            reconnectAttempts: this.reconnectAttempts,
            lastPongTime: this.lastPongTime,
            queuedMessages: this.messageQueue.length,
            offlineMessages: this.offlineMessageQueue.length,
            pendingMessages: this.pendingMessages.size,
            connectionHealth: this.connectionHealthScore,
            metrics: this.connectionMetrics,
            typingUsers: Array.from(this.typingIndicators.keys())
        };
    }

    /**
     * Destroy the enhanced WebSocket client
     */
    destroy() {
        // Clear typing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Disconnect
        this.disconnect();
        
        // Clear all queues and maps
        this.messageQueue = [];
        this.offlineMessageQueue = [];
        this.pendingMessages.clear();
        this.messageHandlers.clear();
        this.messageCallbacks.clear();
        this.messageStatus.clear();
        this.messageRetries.clear();
        this.typingIndicators.clear();
        
        // Clear references
        this.stateManager = null;
        this.notificationService = null;
    }
}