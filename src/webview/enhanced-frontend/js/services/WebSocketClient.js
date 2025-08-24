/**
 * WebSocket Client Service
 * Enhanced WebSocket client with reconnection, message queuing, and protocol handling
 */

export class WebSocketClient {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.websocket = null;
        
        // Connection state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.backoffMultiplier = 1.5;
        
        // Message handling
        this.messageQueue = [];
        this.pendingMessages = new Map();
        this.messageHandlers = new Map();
        
        // Heartbeat
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.heartbeatIntervalMs = 30000; // 30 seconds
        this.heartbeatTimeoutMs = 10000; // 10 seconds
        this.lastPongTime = null;
        
        // Connection info
        this.connectionId = null;
        this.serverInfo = {};
        
        // Bind methods
        this.handleOpen = this.handleOpen.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleError = this.handleError.bind(this);
        
        // Set up message handlers
        this.setupMessageHandlers();
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
        console.log('✅ WebSocket connected');
        
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Update connection state
        this.stateManager.updateConnection({
            status: 'connected',
            lastConnected: new Date(),
            reconnectAttempts: 0
        });
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Process queued messages
        this.processMessageQueue();
        
        // Request initial server status
        this.sendMessage({
            type: 'status',
            id: this.generateMessageId()
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
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        
        this.isConnected = false;
        this.connectionId = null;
        
        // Stop heartbeat
        this.stopHeartbeat();
        
        // Update connection state
        this.stateManager.updateConnection({
            status: 'disconnected',
            lastConnected: new Date()
        });
        
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
     * Handle pong message
     */
    handlePong(message) {
        this.lastPongTime = Date.now();
        
        // Clear heartbeat timeout
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
        
        // Calculate latency
        if (message.timestamp) {
            const latency = this.lastPongTime - message.timestamp;
            this.stateManager.updateConnection({ latency });
        }
    }

    /**
     * Set up message handlers
     */
    setupMessageHandlers() {
        // Response handler
        this.messageHandlers.set('response', (message) => {
            // Handle command responses, etc.
            console.log('📥 Command response:', message);
        });
        
        // Broadcast handler
        this.messageHandlers.set('broadcast', (message) => {
            this.handleBroadcast(message);
        });
        
        // Status handler
        this.messageHandlers.set('status', (message) => {
            this.handleStatusUpdate(message);
        });
        
        // Error handler
        this.messageHandlers.set('error', (message) => {
            console.error('📥 Server error:', message);
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

    /**
     * Destroy the WebSocket client
     */
    destroy() {
        // Disconnect
        this.disconnect();
        
        // Clear message queue and pending messages
        this.messageQueue = [];
        this.pendingMessages.clear();
        this.messageHandlers.clear();
        
        // Clear references
        this.stateManager = null;
    }
}