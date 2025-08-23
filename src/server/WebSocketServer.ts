/**
 * WebSocketServer - Handles WebSocket connections and real-time communication
 */

import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ServerConfig, WebSocketMessage, ClientConnection } from './interfaces';

export class WebSocketServer {
    private _server: WSServer | null = null;
    private _port: number;
    private _config: ServerConfig;
    private _clients: Map<string, { ws: WebSocket; connection: ClientConnection }> = new Map();
    private _isRunning: boolean = false;

    constructor(config: ServerConfig) {
        this._config = config;
        this._port = config.websocketPort || config.httpPort + 1;
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
    private handleMessage(ws: WebSocket, clientId: string, data: Buffer | ArrayBuffer | Buffer[]): void {
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
            this.routeMessage(clientId, message);

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
    private routeMessage(clientId: string, message: WebSocketMessage): void {
        switch (message.type) {
            case 'command':
                // Command messages will be handled by CommandHandler in the next task
                // For now, just acknowledge receipt
                if (message.id) {
                    this.sendToClient(clientId, {
                        type: 'response',
                        id: message.id,
                        data: { status: 'received', command: message.command }
                    });
                }
                break;

            case 'status':
                // Handle status requests
                this.sendServerStatus(clientId, message.id);
                break;

            default:
                this.sendError(clientId, `Unsupported message type: ${message.type}`, message.id);
        }
    }

    /**
     * Send server status to client
     */
    private sendServerStatus(clientId: string, messageId?: string): void {
        const status = {
            connectedClients: this._clients.size,
            serverTime: new Date().toISOString(),
            clientId: clientId
        };

        const response: WebSocketMessage = {
            type: 'response',
            data: status
        };
        
        if (messageId) {
            response.id = messageId;
        }
        
        this.sendToClient(clientId, response);
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
}