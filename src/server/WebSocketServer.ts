/**
 * WebSocketServer - Handles WebSocket connections and real-time communication
 */

import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ServerConfig, WebSocketMessage, ClientConnection } from './interfaces';
import { CommandHandler, StateChangeEvent } from './CommandHandler';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { ConnectionRecoveryManager } from './ConnectionRecoveryManager';

/**
 * Enhanced client connection with state tracking
 */
interface EnhancedClientConnection extends ClientConnection {
    /** Whether client wants incremental updates */
    incrementalUpdates: boolean;
    /** Last state version sent to this client */
    lastStateVersion?: number;
    /** Client preferences for state updates */
    statePreferences?: {
        includeDocumentChanges: boolean;
        includeSelectionChanges: boolean;
        includeDiagnostics: boolean;
        throttleMs: number;
    };
}

export class WebSocketServer {
    private _server: WSServer | null = null;
    private _port: number;
    private _config: ServerConfig;
    private _clients: Map<string, { ws: WebSocket; connection: EnhancedClientConnection }> = new Map();
    private _isRunning: boolean = false;
    private _commandHandler: CommandHandler;
    private _stateVersion: number = 0;
    private _clientThrottles: Map<string, { [key: string]: NodeJS.Timeout }> = new Map();
    private _errorHandler: ErrorHandler;
    private _recoveryManager: ConnectionRecoveryManager;

    constructor(config: ServerConfig) {
        this._config = config;
        this._port = config.websocketPort || config.httpPort + 1;
        this._commandHandler = new CommandHandler();
        this._errorHandler = ErrorHandler.getInstance();
        this._recoveryManager = new ConnectionRecoveryManager(
            {
                maxRetries: 5,
                initialDelay: 2000,
                maxDelay: 30000,
                backoffMultiplier: 1.5,
                jitterEnabled: true,
                healthCheckInterval: 15000
            },
            {
                onStateChange: (clientId, oldState, newState) => {
                    console.log(`WebSocket client ${clientId} state: ${oldState} -> ${newState}`);
                },
                onRecoveryAttempt: (clientId, attempt, maxAttempts) => {
                    console.log(`Attempting to recover client ${clientId} (${attempt}/${maxAttempts})`);
                },
                onRecoverySuccess: (clientId, attempts) => {
                    console.log(`Client ${clientId} recovered after ${attempts} attempts`);
                    this.notifyClientRecovered(clientId);
                },
                onRecoveryFailed: (clientId, error) => {
                    console.error(`Failed to recover client ${clientId}:`, error);
                    this.handleClientRecoveryFailure(clientId, error);
                }
            }
        );
        
        // Set up enhanced state change callback for broadcasting
        this._commandHandler.setStateChangeCallback((event: StateChangeEvent) => {
            this.handleStateChangeEvent(event);
        });
    }

    /**
     * Start the WebSocket server with enhanced error handling
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._server = new WSServer({
                    port: this._port,
                    maxPayload: 1024 * 1024, // 1MB max message size
                    perMessageDeflate: false, // Disable compression to reduce CPU usage
                    clientTracking: true, // Enable client tracking for better management
                });

                this._server.on('listening', () => {
                    this._isRunning = true;
                    console.log(`WebSocket server started on port ${this._port}`);
                    resolve();
                });

                this._server.on('connection', (ws, request) => {
                    this.handleConnectionWithErrorHandling(ws, request);
                });

                this._server.on('error', async (error) => {
                    const errorInfo = this._errorHandler.createError(
                        (error as any).code || 'WEBSOCKET_SERVER_ERROR',
                        `WebSocket server error: ${error.message}`,
                        ErrorCategory.SERVER_STARTUP,
                        ErrorSeverity.HIGH,
                        { port: this._port, error: error.message }
                    );

                    await this._errorHandler.handleError(errorInfo, null, false);

                    if (!this._isRunning) {
                        reject(error);
                    } else {
                        // Server is running but encountered an error, attempt recovery
                        this.handleServerError(error);
                    }
                });

                // Handle server close events
                this._server.on('close', () => {
                    console.log('WebSocket server closed');
                    this._isRunning = false;
                });

            } catch (error) {
                const errorInfo = this._errorHandler.createError(
                    'WEBSOCKET_STARTUP_FAILED',
                    `Failed to create WebSocket server: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    ErrorCategory.SERVER_STARTUP,
                    ErrorSeverity.CRITICAL
                );

                this._errorHandler.handleError(errorInfo, null, false);
                reject(error);
            }
        });
    }

    /**
     * Stop the WebSocket server gracefully
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this._server || !this._isRunning) {
                resolve();
                return;
            }

            // Close all client connections gracefully
            this._clients.forEach(({ ws }) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close(1000, 'Server shutting down');
                }
            });

            this._server.close(() => {
                this._isRunning = false;
                this._clients.clear();
                
                // Dispose of CommandHandler resources
                this._commandHandler.dispose();
                
                console.log('WebSocket server stopped');
                resolve();
            });
        });
    }

    /**
     * Handle new WebSocket connection with comprehensive error handling
     */
    private handleConnectionWithErrorHandling(ws: WebSocket, request: any): void {
        try {
            this.handleConnection(ws, request);
        } catch (error) {
            console.error('Error handling new WebSocket connection:', error);
            
            const errorInfo = this._errorHandler.createError(
                'CONNECTION_HANDLING_ERROR',
                `Failed to handle new WebSocket connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.CLIENT_CONNECTION,
                ErrorSeverity.MEDIUM,
                { userAgent: request.headers['user-agent'], origin: request.headers.origin }
            );

            this._errorHandler.handleError(errorInfo, null, false);
            
            // Close the problematic connection
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1011, 'Internal server error');
            }
        }
    }

    /**
     * Handle new WebSocket connection
     */
    private handleConnection(ws: WebSocket, request: any): void {
        // Check connection limits
        if (this._clients.size >= this._config.maxConnections) {
            console.warn('Maximum connections reached, rejecting new connection');
            ws.close(1008, 'Maximum connections exceeded');
            return;
        }

        // Validate origin if not allowing all origins
        if (!this.validateOrigin(request)) {
            console.warn('Connection rejected: invalid origin');
            ws.close(1008, 'Origin not allowed');
            return;
        }

        // Create enhanced client connection info
        const clientId = uuidv4();
        const connection: EnhancedClientConnection = {
            id: clientId,
            connectedAt: new Date(),
            lastActivity: new Date(),
            userAgent: request.headers['user-agent'],
            ipAddress: request.socket.remoteAddress,
            incrementalUpdates: true, // Default to incremental updates
            statePreferences: {
                includeDocumentChanges: true,
                includeSelectionChanges: false, // Default to false to reduce noise
                includeDiagnostics: true,
                throttleMs: 500
            }
        };

        // Store client connection
        this._clients.set(clientId, { ws, connection });
        this._clientThrottles.set(clientId, {});

        console.log(`WebSocket client connected: ${clientId} (${this._clients.size} total)`);

        // Set up message handling with error recovery
        ws.on('message', (data) => {
            this.handleMessageWithErrorHandling(ws, clientId, data);
        });

        // Handle client disconnect with recovery
        ws.on('close', (code, reason) => {
            console.log(`WebSocket client disconnected: ${clientId} (code: ${code}, reason: ${reason}) (${this._clients.size - 1} remaining)`);
            
            // Notify recovery manager about disconnection
            this._recoveryManager.handleDisconnection(clientId, new Error(`Connection closed with code ${code}: ${reason}`));
            
            this.cleanupClient(clientId);
        });

        // Handle connection errors with recovery
        ws.on('error', async (error) => {
            console.error(`WebSocket client error (${clientId}):`, error);
            
            const errorInfo = this._errorHandler.createError(
                'CLIENT_CONNECTION_ERROR',
                `WebSocket client ${clientId} error: ${error.message}`,
                ErrorCategory.CLIENT_CONNECTION,
                ErrorSeverity.LOW,
                { clientId, error: error.message }
            );

            await this._errorHandler.handleError(errorInfo, {
                reconnectClient: () => this._recoveryManager.forceReconnection(clientId)
            });

            // Notify recovery manager about the error
            this._recoveryManager.handleDisconnection(clientId, error);
            
            this.cleanupClient(clientId);
        });

        // Register client with recovery manager
        this._recoveryManager.registerClient(clientId, ws);

        // Send welcome message with current state
        this.sendToClient(clientId, {
            type: 'status',
            data: {
                connected: true,
                clientId: clientId,
                serverTime: new Date().toISOString(),
                stateVersion: this._stateVersion,
                capabilities: {
                    incrementalUpdates: true,
                    statePreferences: true,
                    realTimeSync: true
                }
            }
        });

        // Send initial full state to new client
        setTimeout(() => {
            this.sendFullStateToClient(clientId);
        }, 100);
    }

    /**
     * Handle incoming WebSocket message
     */
    private async handleMessage(ws: WebSocket, clientId: string, data: Buffer | ArrayBuffer | Buffer[]): Promise<void> {
        try {
            // Update client activity
            const client = this._clients.get(clientId);
            if (client) {
                client.connection.lastActivity = new Date();
            }

            // Parse message
            const message = this.parseMessage(data);
            if (!message) {
                this.sendError(clientId, 'Invalid message format');
                return;
            }

            // Validate message
            if (!this.validateMessage(message)) {
                this.sendError(clientId, 'Message validation failed', message.id);
                return;
            }

            console.log(`Received message from ${clientId}:`, message.type, message.command || '');

            // Route message based on type
            await this.routeMessage(clientId, message);

        } catch (error) {
            console.error(`Error handling message from ${clientId}:`, error);
            this.sendError(clientId, 'Internal server error');
        }
    }

    /**
     * Parse incoming message data
     */
    private parseMessage(data: Buffer | ArrayBuffer | Buffer[]): WebSocketMessage | null {
        try {
            const messageStr = data.toString();
            return JSON.parse(messageStr) as WebSocketMessage;
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            return null;
        }
    }

    /**
     * Validate WebSocket message structure
     */
    private validateMessage(message: WebSocketMessage): boolean {
        // Check required type field
        if (!message.type || !['command', 'response', 'broadcast', 'status'].includes(message.type)) {
            return false;
        }

        // Validate command messages
        if (message.type === 'command') {
            if (!message.command || typeof message.command !== 'string') {
                return false;
            }
        }

        return true;
    }

    /**
     * Route message to appropriate handler
     */
    private async routeMessage(clientId: string, message: WebSocketMessage): Promise<void> {
        switch (message.type) {
            case 'command':
                await this.handleCommandMessageWithErrorHandling(clientId, message);
                break;

            case 'status':
                this.handleStatusMessage(clientId, message.id);
                break;

            default:
                // Check if it's a client configuration message
                if (message.type === 'broadcast' && message.data?.type === 'clientConfig') {
                    this.handleClientConfigMessage(clientId, message);
                } else {
                    this.sendError(clientId, `Unsupported message type: ${message.type}`, message.id);
                }
        }
    }

    /**
     * Handle command execution messages
     */
    private async handleCommandMessage(clientId: string, message: WebSocketMessage): Promise<void> {
        if (!message.command) {
            this.sendError(clientId, 'Command is required for command messages', message.id);
            return;
        }

        try {
            // Execute command through CommandHandler
            const result = await this._commandHandler.executeCommand(message.command, message.args);
            
            // Send response back to client
            const response: WebSocketMessage = {
                type: 'response',
                data: {
                    command: message.command,
                    success: result.success,
                    result: result.data,
                    error: result.error
                }
            };

            if (message.id) {
                response.id = message.id;
            }

            this.sendToClient(clientId, response);

            // If command was successful and might have changed state, broadcast current state
            if (result.success) {
                this.broadcastWorkspaceState();
            }

        } catch (error) {
            console.error(`Error handling command message from ${clientId}:`, error);
            this.sendError(clientId, 'Internal error executing command', message.id);
        }
    }

    /**
     * Handle status request messages
     */
    private handleStatusMessage(clientId: string, messageId?: string): void {
        const status = {
            connectedClients: this._clients.size,
            serverTime: new Date().toISOString(),
            clientId: clientId,
            workspaceState: this._commandHandler.getWorkspaceState(),
            allowedCommands: this._commandHandler.getAllowedCommands()
        };

        const response: WebSocketMessage = {
            type: 'status',
            data: status
        };
        
        if (messageId) {
            response.id = messageId;
        }
        
        this.sendToClient(clientId, response);
    }

    /**
     * Handle enhanced state change events with incremental updates
     */
    private handleStateChangeEvent(event: StateChangeEvent): void {
        this._stateVersion++;
        
        // Handle full state broadcasts (for new clients)
        if (!event.incremental && event.data.fullState) {
            // This is a full state broadcast, send to all clients
            const message: WebSocketMessage = {
                type: 'broadcast',
                data: {
                    changeType: 'fullState',
                    timestamp: event.timestamp.toISOString(),
                    stateVersion: this._stateVersion,
                    data: event.data.workspaceState,
                    incremental: false
                }
            };
            this.broadcastMessage(message);
            return;
        }

        // Handle incremental state changes
        this._clients.forEach((client, clientId) => {
            this.sendStateChangeToClient(clientId, event);
        });
    }

    /**
     * Send state change to specific client based on their preferences
     */
    private sendStateChangeToClient(clientId: string, event: StateChangeEvent): void {
        const client = this._clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const prefs = client.connection.statePreferences;
        if (!prefs) {
            return;
        }

        // Filter events based on client preferences
        let shouldSend = true;
        switch (event.type) {
            case 'documentChange':
                shouldSend = prefs.includeDocumentChanges;
                break;
            case 'selection':
                shouldSend = prefs.includeSelectionChanges;
                break;
            case 'diagnostics':
                shouldSend = prefs.includeDiagnostics;
                break;
            // Always send these critical state changes
            case 'activeEditor':
            case 'workspaceFolders':
            case 'visibleEditors':
                shouldSend = true;
                break;
        }

        if (!shouldSend) {
            return;
        }

        // Throttle messages per client based on their preferences
        const throttleKey = `${event.type}_${clientId}`;
        const clientThrottles = this._clientThrottles.get(clientId);
        
        if (clientThrottles && clientThrottles[event.type]) {
            clearTimeout(clientThrottles[event.type]);
        }

        const sendMessage = () => {
            const message: WebSocketMessage = {
                type: 'broadcast',
                data: {
                    changeType: event.type,
                    timestamp: event.timestamp.toISOString(),
                    stateVersion: this._stateVersion,
                    data: event.data,
                    incremental: event.incremental
                }
            };

            this.sendToClient(clientId, message);
            
            // Update client's last state version
            client.connection.lastStateVersion = this._stateVersion;
        };

        if (clientThrottles) {
            clientThrottles[event.type] = setTimeout(sendMessage, prefs.throttleMs);
        }
    }

    /**
     * Handle client configuration messages
     */
    private handleClientConfigMessage(clientId: string, message: WebSocketMessage): void {
        const client = this._clients.get(clientId);
        if (!client) {
            return;
        }

        const config = message.data?.config;
        if (config && config.statePreferences) {
            // Update client preferences
            client.connection.statePreferences = {
                ...client.connection.statePreferences,
                ...config.statePreferences
            };

            if (typeof config.incrementalUpdates === 'boolean') {
                client.connection.incrementalUpdates = config.incrementalUpdates;
            }

            console.log(`Updated client ${clientId} preferences:`, client.connection.statePreferences);

            // Send confirmation
            const response: WebSocketMessage = {
                type: 'response',
                data: {
                    success: true,
                    message: 'Client preferences updated',
                    preferences: client.connection.statePreferences
                }
            };
            
            if (message.id) {
                response.id = message.id;
            }
            
            this.sendToClient(clientId, response);
        }
    }

    /**
     * Send full workspace state to a specific client
     */
    private sendFullStateToClient(clientId: string): void {
        const workspaceState = this._commandHandler.getWorkspaceState();
        
        const message: WebSocketMessage = {
            type: 'broadcast',
            data: {
                changeType: 'fullState',
                timestamp: new Date().toISOString(),
                stateVersion: this._stateVersion,
                data: workspaceState,
                incremental: false
            }
        };

        this.sendToClient(clientId, message);
        
        // Update client's state version
        const client = this._clients.get(clientId);
        if (client) {
            client.connection.lastStateVersion = this._stateVersion;
        }
    }

    /**
     * Clean up client resources
     */
    private cleanupClient(clientId: string): void {
        // Clear any pending throttled messages
        const clientThrottles = this._clientThrottles.get(clientId);
        if (clientThrottles) {
            Object.values(clientThrottles).forEach(timeout => {
                if (timeout) {
                    clearTimeout(timeout);
                }
            });
            this._clientThrottles.delete(clientId);
        }

        // Remove client from connections
        this._clients.delete(clientId);
    }

    /**
     * Broadcast current workspace state to all clients
     */
    private broadcastWorkspaceState(): void {
        const workspaceState = this._commandHandler.getWorkspaceState();
        
        const message: WebSocketMessage = {
            type: 'broadcast',
            data: {
                changeType: 'workspaceState',
                timestamp: new Date().toISOString(),
                data: workspaceState
            }
        };

        this.broadcastMessage(message);
    }

    /**
     * Validate connection origin
     */
    private validateOrigin(request: any): boolean {
        // If allowing all origins
        if (this._config.allowedOrigins.includes('*')) {
            return true;
        }

        const origin = request.headers.origin;
        if (!origin) {
            return false;
        }

        return this._config.allowedOrigins.includes(origin);
    }

    /**
     * Send message to specific client
     */
    sendToClient(clientId: string, message: WebSocketMessage): boolean {
        const client = this._clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            client.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error(`Failed to send message to client ${clientId}:`, error);
            return false;
        }
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcastMessage(message: WebSocketMessage): number {
        let sentCount = 0;

        this._clients.forEach((client, clientId) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                try {
                    client.ws.send(JSON.stringify(message));
                    sentCount++;
                } catch (error) {
                    console.error(`Failed to broadcast to client ${clientId}:`, error);
                }
            }
        });

        return sentCount;
    }

    /**
     * Send error message to client
     */
    private sendError(clientId: string, error: string, messageId?: string): void {
        const response: WebSocketMessage = {
            type: 'response',
            error: error
        };
        
        if (messageId) {
            response.id = messageId;
        }
        
        this.sendToClient(clientId, response);
    }

    /**
     * Get connected clients information
     */
    getConnectedClients(): ClientConnection[] {
        return Array.from(this._clients.values()).map(client => client.connection);
    }

    /**
     * Get enhanced client connection information
     */
    getEnhancedClientInfo(): EnhancedClientConnection[] {
        return Array.from(this._clients.values()).map(client => client.connection);
    }

    /**
     * Force state synchronization for all clients
     */
    forceStateSynchronization(): void {
        this._commandHandler.broadcastFullState();
    }

    /**
     * Force state synchronization for specific client
     */
    forceClientStateSynchronization(clientId: string): boolean {
        const client = this._clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        this.sendFullStateToClient(clientId);
        return true;
    }

    /**
     * Get current state version
     */
    get stateVersion(): number {
        return this._stateVersion;
    }

    /**
     * Get server port
     */
    get port(): number {
        return this._port;
    }

    /**
     * Check if server is running
     */
    get isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Get number of connected clients
     */
    get clientCount(): number {
        return this._clients.size;
    }

    /**
     * Handle server-level errors
     */
    private async handleServerError(error: Error): Promise<void> {
        console.error('WebSocket server error during operation:', error);
        
        const errorInfo = this._errorHandler.createError(
            'WEBSOCKET_RUNTIME_ERROR',
            `WebSocket server runtime error: ${error.message}`,
            ErrorCategory.NETWORK,
            ErrorSeverity.HIGH,
            { error: error.message, clientCount: this._clients.size }
        );

        await this._errorHandler.handleError(errorInfo, null, false);
        
        // Check if we need to restart the server
        if (this.shouldRestartServer(error)) {
            console.log('Attempting to restart WebSocket server due to critical error');
            await this.restartServer();
        }
    }

    /**
     * Determine if server should be restarted based on error
     */
    private shouldRestartServer(error: Error): boolean {
        const restartCodes = ['ECONNRESET', 'EPIPE', 'ENOTFOUND'];
        return restartCodes.includes((error as any).code);
    }

    /**
     * Restart the WebSocket server
     */
    private async restartServer(): Promise<void> {
        try {
            console.log('Restarting WebSocket server...');
            
            // Stop current server
            await this.stop();
            
            // Wait a moment before restarting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start new server
            await this.start();
            
            console.log('WebSocket server restarted successfully');
        } catch (error) {
            console.error('Failed to restart WebSocket server:', error);
            
            const errorInfo = this._errorHandler.createError(
                'SERVER_RESTART_FAILED',
                `Failed to restart WebSocket server: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.SERVER_STARTUP,
                ErrorSeverity.CRITICAL
            );

            await this._errorHandler.handleError(errorInfo, null, false);
        }
    }

    /**
     * Notify that a client has recovered
     */
    private notifyClientRecovered(clientId: string): void {
        // Send recovery notification to all other clients
        const message: WebSocketMessage = {
            type: 'broadcast',
            data: {
                changeType: 'clientRecovered',
                timestamp: new Date().toISOString(),
                data: { clientId, message: 'Client connection recovered' }
            }
        };

        this.broadcastMessage(message);
    }

    /**
     * Handle client recovery failure
     */
    private async handleClientRecoveryFailure(clientId: string, error: Error): Promise<void> {
        const errorInfo = this._errorHandler.createError(
            'CLIENT_RECOVERY_FAILED',
            `Failed to recover client ${clientId}: ${error.message}`,
            ErrorCategory.CLIENT_CONNECTION,
            ErrorSeverity.MEDIUM,
            { clientId, error: error.message }
        );

        await this._errorHandler.handleError(errorInfo, null, false);
        
        // Clean up any remaining client data
        this.cleanupClient(clientId);
    }

    /**
     * Enhanced message handling with error recovery
     */
    private async handleMessageWithErrorHandling(ws: WebSocket, clientId: string, data: Buffer | ArrayBuffer | Buffer[]): Promise<void> {
        try {
            await this.handleMessage(ws, clientId, data);
        } catch (error) {
            console.error(`Error handling message from client ${clientId}:`, error);
            
            const errorInfo = this._errorHandler.createError(
                'MESSAGE_HANDLING_ERROR',
                `Failed to handle message from client ${clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.COMMAND_EXECUTION,
                ErrorSeverity.LOW,
                { clientId, error: error instanceof Error ? error.message : 'Unknown error' }
            );

            await this._errorHandler.handleError(errorInfo, null, false);
            
            // Send error response to client
            this.sendError(clientId, 'Internal server error while processing message');
        }
    }

    /**
     * Enhanced command execution with comprehensive error handling
     */
    private async handleCommandMessageWithErrorHandling(clientId: string, message: WebSocketMessage): Promise<void> {
        if (!message.command) {
            this.sendError(clientId, 'Command is required for command messages', message.id);
            return;
        }

        try {
            // Execute command through CommandHandler
            const result = await this._commandHandler.executeCommand(message.command, message.args);
            
            // Send response back to client
            const response: WebSocketMessage = {
                type: 'response',
                data: {
                    command: message.command,
                    success: result.success,
                    result: result.data,
                    error: result.error
                }
            };

            if (message.id) {
                response.id = message.id;
            }

            this.sendToClient(clientId, response);

            // If command was successful and might have changed state, broadcast current state
            if (result.success) {
                this.broadcastWorkspaceState();
            }

        } catch (error) {
            console.error(`Error executing command from client ${clientId}:`, error);
            
            const errorInfo = this._errorHandler.createError(
                'COMMAND_EXECUTION_ERROR',
                `Command execution failed for client ${clientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.COMMAND_EXECUTION,
                ErrorSeverity.MEDIUM,
                { clientId, command: message.command, error: error instanceof Error ? error.message : 'Unknown error' }
            );

            await this._errorHandler.handleError(errorInfo, null, false);
            
            // Send detailed error response to client
            const errorResponse: WebSocketMessage = {
                type: 'response',
                data: {
                    command: message.command,
                    success: false,
                    error: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            };

            if (message.id) {
                errorResponse.id = message.id;
            }

            this.sendToClient(clientId, errorResponse);
        }
    }

    /**
     * Get connection recovery manager
     */
    get recoveryManager(): ConnectionRecoveryManager {
        return this._recoveryManager;
    }

    /**
     * Get error handler
     */
    get errorHandler(): ErrorHandler {
        return this._errorHandler;
    }

    /**
     * Get the CommandHandler instance
     */
    get commandHandler(): CommandHandler {
        return this._commandHandler;
    }
}