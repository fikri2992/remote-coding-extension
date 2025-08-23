/**
 * WebSocketServer - Handles WebSocket connections and real-time communication
 */

import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ServerConfig, WebSocketMessage, ClientConnection } from './interfaces';
import { CommandHandler } from './CommandHandler';

export class WebSocketServer {
    private _server: WSServer | null = null;
    private _port: number;
    private _config: ServerConfig;
    private _clients: Map<string, { ws: WebSocket; connection: ClientConnection }> = new Map();
    private _isRunning: boolean = false;
    private _commandHandler: CommandHandler;

    constructor(config: ServerConfig) {
        this._config = config;
        this._port = config.websocketPort || config.httpPort + 1;
        this._commandHandler = new CommandHandler();
        
        // Set up state change callback for broadcasting
        this._commandHandler.setStateChangeCallback((changeType: string, data: any) => {
            this.broadcastStateChange(changeType, data);
        });
    }

    /**
     * Start the WebSocket server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._server = new WSServer({
                    port: this._port,
                    maxPayload: 1024 * 1024, // 1MB max message size
                });

                this._server.on('listening', () => {
                    this._isRunning = true;
                    console.log(`WebSocket server started on port ${this._port}`);
                    resolve();
                });

                this._server.on('connection', (ws, request) => {
                    this.handleConnection(ws, request);
                });

                this._server.on('error', (error) => {
                    console.error('WebSocket server error:', error);
                    if (!this._isRunning) {
                        reject(error);
                    }
                });

            } catch (error) {
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

        // Create client connection info
        const clientId = uuidv4();
        const connection: ClientConnection = {
            id: clientId,
            connectedAt: new Date(),
            lastActivity: new Date(),
            userAgent: request.headers['user-agent'],
            ipAddress: request.socket.remoteAddress
        };

        // Store client connection
        this._clients.set(clientId, { ws, connection });

        console.log(`WebSocket client connected: ${clientId} (${this._clients.size} total)`);

        // Set up message handling
        ws.on('message', (data) => {
            this.handleMessage(ws, clientId, data);
        });

        // Handle client disconnect
        ws.on('close', (code, reason) => {
            this._clients.delete(clientId);
            console.log(`WebSocket client disconnected: ${clientId} (${this._clients.size} remaining)`);
        });

        // Handle connection errors
        ws.on('error', (error) => {
            console.error(`WebSocket client error (${clientId}):`, error);
            this._clients.delete(clientId);
        });

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'status',
            data: {
                connected: true,
                clientId: clientId,
                serverTime: new Date().toISOString()
            }
        });
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
                await this.handleCommandMessage(clientId, message);
                break;

            case 'status':
                this.handleStatusMessage(clientId, message.id);
                break;

            default:
                this.sendError(clientId, `Unsupported message type: ${message.type}`, message.id);
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
     * Broadcast VS Code state changes to all clients
     */
    private broadcastStateChange(changeType: string, data: any): void {
        const message: WebSocketMessage = {
            type: 'broadcast',
            data: {
                changeType,
                timestamp: new Date().toISOString(),
                data
            }
        };

        this.broadcastMessage(message);
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
     * Get the CommandHandler instance
     */
    get commandHandler(): CommandHandler {
        return this._commandHandler;
    }
}