/**
 * Web Automation Service
 * Handles VS Code integration and command execution
 */

export class WebAutomationService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // VS Code API
        this.vscode = window.vscode;
        
        // Connection state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.backoffMultiplier = 1.5;
        
        // Health monitoring
        this.lastPingTime = null;
        this.pingInterval = null;
        this.healthCheckInterval = 15000;
        
        // Message handling
        this.messageQueue = [];
        this.connectionId = null;
        this.networkErrorCount = 0;
        this.maxNetworkErrors = 3;
        
        // Command execution
        this.pendingCommands = new Map();
        this.commandTimeout = 30000; // 30 seconds
        
        // Bind methods
        this.handleExtensionMessage = this.handleExtensionMessage.bind(this);
        this.executeCommand = this.executeCommand.bind(this);
        this.executeQuickCommand = this.executeQuickCommand.bind(this);
    }

    /**
     * Initialize the web automation service
     */
    async initialize() {
        console.log('🔧 Initializing Web Automation Service...');
        
        // Initialize VS Code integration
        this._initializeVSCodeIntegration();
        
        // Set up command handlers
        this._setupCommandHandlers();
        
        // Start health monitoring
        this._startHealthMonitoring();
        
        // Update initial state
        this.stateManager.updateState('webAutomation', {
            initialized: true,
            connected: this.isConnected,
            vsCodeApiAvailable: !!this.vscode,
            timestamp: Date.now()
        });
        
        console.log('✅ Web Automation Service initialized');
    }

    /**
     * Initialize VS Code integration
     */
    _initializeVSCodeIntegration() {
        if (this.vscode) {
            console.log('✓ VS Code API available');
            this.isConnected = true;
            
            // Request initial server status
            this._sendMessage({
                command: 'getServerStatus'
            });
            
            // Request initial configuration
            this._sendMessage({
                command: 'getConfiguration'
            });
            
        } else {
            console.warn('⚠️ VS Code API not available - running in standalone mode');
            this.isConnected = false;
        }
    }

    /**
     * Set up command handlers
     */
    _setupCommandHandlers() {
        // Register global command handlers
        if (typeof window !== 'undefined') {
            window.executeVSCodeCommand = this.executeCommand;
            window.executeQuickCommand = this.executeQuickCommand;
        }
    }

    /**
     * Start health monitoring
     */
    _startHealthMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        this.pingInterval = setInterval(() => {
            this._performHealthCheck();
        }, this.healthCheckInterval);
    }

    /**
     * Perform health check
     */
    _performHealthCheck() {
        if (this.vscode && this.isConnected) {
            this.lastPingTime = Date.now();
            
            this._sendMessage({
                command: 'ping',
                timestamp: this.lastPingTime
            });
        }
    }

    /**
     * Handle messages from VS Code extension
     */
    handleExtensionMessage(message) {
        if (!message || typeof message !== 'object') {
            return;
        }

        try {
            switch (message.command) {
                case 'serverStatusUpdate':
                    this._handleServerStatusUpdate(message.data);
                    break;
                    
                case 'statusUpdate':
                    this._handleStatusUpdate(message.data);
                    break;
                    
                case 'configurationUpdate':
                    this._handleConfigurationUpdate(message.data);
                    break;
                    
                case 'configurationError':
                    this._handleConfigurationError(message.data);
                    break;
                    
                case 'commandResponse':
                    this._handleCommandResponse(message);
                    break;
                    
                case 'fileSystemChange':
                    this._handleFileSystemChange(message.data);
                    break;
                    
                case 'gitOperationResult':
                    this._handleGitOperationResult(message.data);
                    break;
                    
                case 'promptOperationSuccess':
                    this._handlePromptOperationSuccess(message.data);
                    break;
                    
                case 'pong':
                    this._handlePong(message);
                    break;
                    
                default:
                    console.log('Unknown message from extension:', message);
                    break;
            }
        } catch (error) {
            console.error('Error handling extension message:', error);
            this.notificationService.error('Message Error', 'Failed to process extension message');
        }
    }

    /**
     * Handle server status update
     */
    _handleServerStatusUpdate(data) {
        this.stateManager.updateState('webAutomation', {
            serverStatus: data.status,
            connectedClients: data.clients,
            lastStatusUpdate: Date.now()
        });
        
        // Update connection state
        this.stateManager.updateState('connection', {
            serverRunning: data.status?.running || false,
            serverUrl: data.status?.url,
            websocketPort: data.status?.websocketPort,
            httpPort: data.status?.httpPort,
            uptime: data.status?.uptime
        });
    }

    /**
     * Handle status update
     */
    _handleStatusUpdate(data) {
        if (data.type === 'serverStarting') {
            this.notificationService.info('Server', 'Starting web automation server...');
        } else if (data.type === 'serverStopping') {
            this.notificationService.info('Server', 'Stopping web automation server...');
        } else if (data.type === 'serverError') {
            this.notificationService.error('Server Error', data.error);
        }
    }

    /**
     * Handle configuration update
     */
    _handleConfigurationUpdate(data) {
        this.stateManager.updateState('webAutomation', {
            configuration: data.config,
            configurationSchema: data.schema,
            lastConfigUpdate: Date.now()
        });
    }

    /**
     * Handle configuration error
     */
    _handleConfigurationError(data) {
        this.notificationService.error('Configuration Error', data.error);
    }

    /**
     * Handle command response
     */
    _handleCommandResponse(message) {
        const commandId = message.id;
        if (commandId && this.pendingCommands.has(commandId)) {
            const { resolve, reject, timeout } = this.pendingCommands.get(commandId);
            
            clearTimeout(timeout);
            this.pendingCommands.delete(commandId);
            
            if (message.success) {
                resolve(message.result);
            } else {
                reject(new Error(message.error || 'Command execution failed'));
            }
        }
    }

    /**
     * Handle file system change
     */
    _handleFileSystemChange(data) {
        // Emit file system change event
        document.dispatchEvent(new CustomEvent('fileSystemChange', {
            detail: data
        }));
        
        // Update state
        this.stateManager.updateState('fileSystem', {
            lastChange: {
                type: data.type,
                path: data.path,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Handle git operation result
     */
    _handleGitOperationResult(data) {
        if (data.success) {
            this.notificationService.success('Git', `${data.operation} completed successfully`);
        } else {
            this.notificationService.error('Git Error', data.error);
        }
        
        // Update git state
        this.stateManager.updateState('git', {
            lastOperation: {
                operation: data.operation,
                success: data.success,
                result: data.result,
                error: data.error,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Handle prompt operation success
     */
    _handlePromptOperationSuccess(data) {
        this.notificationService.success('Prompt', `${data.operation} completed successfully`);
    }

    /**
     * Handle pong response
     */
    _handlePong(message) {
        if (this.lastPingTime && message.timestamp) {
            const latency = Date.now() - message.timestamp;
            
            this.stateManager.updateState('connection', {
                latency: latency,
                lastPong: Date.now(),
                connectionHealth: latency < 1000 ? 'good' : latency < 3000 ? 'fair' : 'poor'
            });
        }
    }

    /**
     * Execute VS Code command
     */
    async executeCommand(command, args = []) {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        const commandId = this._generateId();
        
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingCommands.delete(commandId);
                reject(new Error('Command execution timeout'));
            }, this.commandTimeout);
            
            // Store pending command
            this.pendingCommands.set(commandId, { resolve, reject, timeout });
            
            // Send command to extension
            this._sendMessage({
                command: 'executeCommand',
                id: commandId,
                data: {
                    command: command,
                    args: args
                }
            });
        });
    }

    /**
     * Execute a quick command
     */
    async executeQuickCommand(command) {
        try {
            const result = await this.executeCommand(command);
            this.notificationService.success('Command', `Executed: ${command}`);
            return result;
        } catch (error) {
            this.notificationService.error('Command Error', `Failed to execute ${command}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Start server
     */
    async startServer() {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'startServer'
        });
    }

    /**
     * Stop server
     */
    async stopServer() {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'stopServer'
        });
    }

    /**
     * Get server status
     */
    getServerStatus() {
        if (!this.vscode) {
            return null;
        }

        this._sendMessage({
            command: 'getServerStatus'
        });
    }

    /**
     * Update configuration
     */
    async updateConfiguration(key, value) {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'updateConfiguration',
            data: { key, value }
        });
    }

    /**
     * Reset configuration
     */
    async resetConfiguration() {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'resetConfiguration'
        });
    }

    /**
     * Validate port
     */
    async validatePort(port) {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'validatePort',
            data: { port }
        });
    }

    /**
     * Execute file system operation
     */
    async executeFileSystemOperation(operation, path, options = {}) {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'fileSystemOperation',
            data: { operation, path, options }
        });
    }

    /**
     * Execute git operation
     */
    async executeGitOperation(operation, args = []) {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'gitOperation',
            data: { operation, args }
        });
    }

    /**
     * Execute prompt operation
     */
    async executePromptOperation(operation, data) {
        if (!this.vscode) {
            throw new Error('VS Code API not available');
        }

        this._sendMessage({
            command: 'promptOperation',
            data: { operation, ...data }
        });
    }

    /**
     * Send message to VS Code extension
     */
    _sendMessage(message) {
        if (this.vscode) {
            this.vscode.postMessage(message);
        } else {
            console.warn('Cannot send message - VS Code API not available:', message);
        }
    }

    /**
     * Generate unique ID
     */
    _generateId() {
        return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        const state = this.stateManager.getState();
        return {
            isConnected: this.isConnected,
            vsCodeApiAvailable: !!this.vscode,
            reconnectAttempts: this.reconnectAttempts,
            networkErrorCount: this.networkErrorCount,
            pendingCommands: this.pendingCommands.size,
            lastPingTime: this.lastPingTime,
            connectionHealth: state.connection?.connectionHealth || 'unknown',
            latency: state.connection?.latency || null
        };
    }

    /**
     * Destroy the service
     */
    destroy() {
        console.log('🧹 Cleaning up Web Automation Service...');
        
        // Clear intervals
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Clear pending commands
        this.pendingCommands.forEach(({ reject, timeout }) => {
            clearTimeout(timeout);
            reject(new Error('Service destroyed'));
        });
        this.pendingCommands.clear();
        
        // Clear message queue
        this.messageQueue = [];
        
        // Reset state
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.networkErrorCount = 0;
        
        console.log('✅ Web Automation Service cleanup completed');
    }
}