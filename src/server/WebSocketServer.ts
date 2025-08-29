/**
 * WebSocketServer - Handles WebSocket connections and real-time communication
 */

import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ServerConfig, WebSocketMessage, ClientConnection, EnhancedWebSocketMessage } from './interfaces';
import { CommandHandler, StateChangeEvent } from './CommandHandler';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { ConnectionRecoveryManager } from './ConnectionRecoveryManager';
import { GitService } from './GitService';
import { RemoteRCService } from './RemoteRCService';

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
    private _gitService: GitService;
    private _remoteRCService: RemoteRCService;

    constructor(config: ServerConfig) {
        this._config = config;
        this._port = config.websocketPort || config.httpPort + 1;
        this._commandHandler = new CommandHandler();
        this._errorHandler = ErrorHandler.getInstance();
        this._gitService = new GitService();
        this._remoteRCService = new RemoteRCService();
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
                
                // Dispose of service resources
                this._commandHandler.dispose();
                this._gitService.dispose();
                this._remoteRCService.dispose();
                
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
            
            // Only treat as error if it's an abnormal closure
            // Normal closure codes: 1000 (normal), 1001 (going away), 1005 (no status)
            const isNormalClosure = code === 1000 || code === 1001 || code === 1005;
            const error = isNormalClosure ? undefined : new Error(`Connection closed with code ${code}: ${reason}`);
            
            // Notify recovery manager about disconnection
            this._recoveryManager.handleDisconnection(clientId, error);
            
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
     * Handle incoming WebSocket message with error handling wrapper
     */
    private handleMessageWithErrorHandling(ws: WebSocket, clientId: string, data: Buffer | ArrayBuffer | Buffer[]): void {
        this.handleMessage(ws, clientId, data).catch(error => {
            console.error(`Error handling message from client ${clientId}:`, error);
            this.sendError(clientId, 'Internal server error processing message');
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
        const validTypes = ['command', 'response', 'broadcast', 'status', 'fileSystem', 'prompt', 'git', 'config'];
        if (!message.type || !validTypes.includes(message.type)) {
            return false;
        }

        // Validate command messages
        if (message.type === 'command') {
            if (!message.command || typeof message.command !== 'string') {
                return false;
            }
        }

        // Validate enhanced message types
        if (['prompt', 'git', 'config'].includes(message.type)) {
            if (!message.data) {
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

            case 'fileSystem':
                await this.handleFileSystemMessage(clientId, message);
                break;

            case 'prompt':
                await this.handlePromptMessage(clientId, message);
                break;

            case 'git':
                await this.handleGitMessage(clientId, message);
                break;

            case 'config':
                await this.handleConfigMessage(clientId, message);
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
            let result: any;

            // Handle special workspace commands that need custom implementation
            if (message.command.startsWith('vscode.workspace.')) {
                result = await this.handleWorkspaceCommand(message.command, message.args || []);
            } else {
                // Execute command through CommandHandler
                result = await this._commandHandler.executeCommand(message.command, message.args);
            }
            
            // Send response back to client
            const response: WebSocketMessage = {
                type: 'response',
                data: result
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
     * Handle VS Code workspace commands
     */
    private async handleWorkspaceCommand(command: string, args: any[]): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');
        const fs = await import('fs').then(m => m.promises);

        try {
            switch (command) {
                case 'vscode.workspace.getFileTree':
                    return {
                        success: true,
                        data: await this.getFileTree(args[0] || '.')
                    };

                case 'vscode.workspace.refreshFileTree':
                    return {
                        success: true,
                        data: await this.getFileTree(args[0] || '.')
                    };

                case 'vscode.workspace.getDirectoryContents':
                    return {
                        success: true,
                        data: await this.getDirectoryContents(args[0])
                    };

                case 'vscode.workspace.createFile':
                    return await this.createFile(args[0], args[1] || '');

                case 'vscode.workspace.createDirectory':
                    return await this.createDirectory(args[0]);

                case 'vscode.workspace.deleteFile':
                    return await this.deleteFile(args[0]);

                case 'vscode.workspace.deleteDirectory':
                    return await this.deleteDirectory(args[0], args[1]?.recursive || false);

                case 'vscode.workspace.renameFile':
                    return await this.renameFile(args[0], args[1]);

                case 'vscode.workspace.moveFile':
                    return await this.moveFile(args[0], args[1]);

                case 'vscode.workspace.copyFile':
                    return await this.copyFile(args[0], args[1]);

                case 'vscode.workspace.readFile':
                    return await this.readFile(args[0]);

                case 'vscode.workspace.writeFile':
                    return await this.writeFile(args[0], args[1], args[2]);

                case 'vscode.workspace.getFileStats':
                    return await this.getFileStats(args[0]);

                case 'vscode.workspace.searchFiles':
                    return {
                        success: true,
                        data: await this.searchFiles(args[0]?.query || '', args[0]?.path || '.')
                    };

                case 'vscode.workspace.getWorkspaceInfo':
                    return {
                        success: true,
                        data: {
                            workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || []
                        }
                    };

                case 'vscode.getCommands':
                    return {
                        success: true,
                        data: this._commandHandler.getAllowedCommands()
                    };

                default:
                    return {
                        success: false,
                        error: `Unsupported workspace command: ${command}`
                    };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get directory contents
     */
    private async getDirectoryContents(dirPath: string): Promise<any[]> {
        const vscode = await import('vscode');
        const path = await import('path');
        const fs = await import('fs').then(m => m.promises);

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, dirPath);
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            
            const contents = [];
            for (const entry of entries) {
                const itemPath = path.join(fullPath, entry.name);
                const stats = await fs.stat(itemPath);
                
                contents.push({
                    name: entry.name,
                    path: path.join(dirPath, entry.name).replace(/\\/g, '/'),
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: entry.isFile() ? stats.size : undefined,
                    modified: stats.mtime,
                    created: stats.birthtime
                });
            }

            return contents.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

        } catch (error) {
            throw new Error(`Failed to get directory contents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create a new file
     */
    private async createFile(filePath: string, content: string = ''): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(fullPath);

            // Create the file
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

            return {
                success: true,
                data: { path: filePath, created: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Create a new directory
     */
    private async createDirectory(dirPath: string): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, dirPath);
            const dirUri = vscode.Uri.file(fullPath);

            // Create the directory
            await vscode.workspace.fs.createDirectory(dirUri);

            return {
                success: true,
                data: { path: dirPath, created: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Delete a file
     */
    private async deleteFile(filePath: string): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(fullPath);

            // Delete the file
            await vscode.workspace.fs.delete(fileUri);

            return {
                success: true,
                data: { path: filePath, deleted: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Delete a directory
     */
    private async deleteDirectory(dirPath: string, recursive: boolean = false): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, dirPath);
            const dirUri = vscode.Uri.file(fullPath);

            // Delete the directory
            await vscode.workspace.fs.delete(dirUri, { recursive, useTrash: false });

            return {
                success: true,
                data: { path: dirPath, deleted: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to delete directory: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Rename a file or directory
     */
    private async renameFile(oldPath: string, newPath: string): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const oldFullPath = path.resolve(workspaceRoot, oldPath);
            const newFullPath = path.resolve(workspaceRoot, newPath);
            const oldUri = vscode.Uri.file(oldFullPath);
            const newUri = vscode.Uri.file(newFullPath);

            // Rename the file/directory
            await vscode.workspace.fs.rename(oldUri, newUri);

            return {
                success: true,
                data: { oldPath, newPath, renamed: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Move a file or directory
     */
    private async moveFile(sourcePath: string, targetPath: string): Promise<any> {
        return this.renameFile(sourcePath, targetPath);
    }

    /**
     * Copy a file or directory
     */
    private async copyFile(sourcePath: string, targetPath: string): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const sourceFullPath = path.resolve(workspaceRoot, sourcePath);
            const targetFullPath = path.resolve(workspaceRoot, targetPath);
            const sourceUri = vscode.Uri.file(sourceFullPath);
            const targetUri = vscode.Uri.file(targetFullPath);

            // Copy the file/directory
            await vscode.workspace.fs.copy(sourceUri, targetUri);

            return {
                success: true,
                data: { sourcePath, targetPath, copied: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to copy: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Read file contents
     */
    private async readFile(filePath: string): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(fullPath);

            // Read the file
            const fileData = await vscode.workspace.fs.readFile(fileUri);
            const decoder = new TextDecoder();
            const content = decoder.decode(fileData);

            // Get file stats
            const stats = await vscode.workspace.fs.stat(fileUri);

            return {
                success: true,
                data: {
                    path: filePath,
                    content,
                    encoding: 'utf8',
                    size: stats.size,
                    modified: new Date(stats.mtime)
                }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Write file contents
     */
    private async writeFile(filePath: string, content: string, encoding: string = 'utf8'): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(fullPath);

            // Write the file
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

            return {
                success: true,
                data: { path: filePath, written: true }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get file statistics
     */
    private async getFileStats(filePath: string): Promise<any> {
        const vscode = await import('vscode');
        const path = await import('path');

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(fullPath);

            // Get file stats
            const stats = await vscode.workspace.fs.stat(fileUri);

            return {
                success: true,
                data: {
                    path: filePath,
                    name: path.basename(filePath),
                    type: stats.type === vscode.FileType.Directory ? 'directory' : 'file',
                    size: stats.size,
                    modified: new Date(stats.mtime),
                    created: new Date(stats.ctime)
                }
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
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
     * Handle file system operation messages
     */
    private async handleFileSystemMessage(clientId: string, message: WebSocketMessage): Promise<void> {
        try {
            const { operation, path, ...options } = message.data || {};
            
            if (!operation) {
                this.sendError(clientId, 'File system operation is required', message.id);
                return;
            }

            let result: any;

            switch (operation) {
                case 'tree':
                    result = await this.getFileTree(path || '.');
                    break;
                
                case 'open':
                    result = await this.openFileInVSCode(path);
                    break;
                
                case 'search':
                    result = await this.searchFiles(options.query || '', path || '.');
                    break;
                
                default:
                    this.sendError(clientId, `Unsupported file system operation: ${operation}`, message.id);
                    return;
            }

            // Send response
            const response: WebSocketMessage = {
                type: 'fileSystem',
                data: {
                    operation,
                    path,
                    content: result
                }
            };

            if (message.id) {
                response.id = message.id;
            }

            this.sendToClient(clientId, response);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown file system error';
            console.error(`File system operation failed for client ${clientId}:`, error);
            this.sendError(clientId, `File system operation failed: ${errorMessage}`, message.id);
        }
    }

    /**
     * Get file tree structure
     */
    private async getFileTree(rootPath: string): Promise<any[]> {
        const vscode = await import('vscode');
        const path = await import('path');
        const fs = await import('fs').then(m => m.promises);

        try {
            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return [];
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const targetPath = path.resolve(workspaceRoot, rootPath);

            // Build file tree recursively
            const buildTree = async (dirPath: string, relativePath: string = ''): Promise<any[]> => {
                const items: any[] = [];
                
                try {
                    const entries = await fs.readdir(dirPath, { withFileTypes: true });
                    
                    for (const entry of entries) {
                        // Skip hidden files and common ignore patterns
                        if (entry.name.startsWith('.') && !entry.name.match(/^\.(git|vscode|env)$/)) {
                            continue;
                        }
                        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
                            continue;
                        }

                        const fullPath = path.join(dirPath, entry.name);
                        const itemRelativePath = path.join(relativePath, entry.name).replace(/\\/g, '/');
                        
                        if (entry.isDirectory()) {
                            const children = await buildTree(fullPath, itemRelativePath);
                            items.push({
                                name: entry.name,
                                path: itemRelativePath,
                                type: 'directory',
                                children: children
                            });
                        } else {
                            const stats = await fs.stat(fullPath);
                            items.push({
                                name: entry.name,
                                path: itemRelativePath,
                                type: 'file',
                                size: stats.size,
                                modified: stats.mtime
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to read directory ${dirPath}:`, error);
                }

                return items.sort((a, b) => {
                    // Directories first, then files, both alphabetically
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
            };

            return await buildTree(targetPath);

        } catch (error) {
            console.error('Failed to get file tree:', error);
            return [];
        }
    }

    /**
     * Open file in VS Code
     */
    private async openFileInVSCode(filePath: string): Promise<boolean> {
        try {
            const vscode = await import('vscode');
            const path = await import('path');

            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder available');
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const fullPath = path.resolve(workspaceRoot, filePath);
            const fileUri = vscode.Uri.file(fullPath);

            // Open the file
            await vscode.window.showTextDocument(fileUri);
            
            return true;

        } catch (error) {
            console.error('Failed to open file:', error);
            throw error;
        }
    }

    /**
     * Search files in workspace
     */
    private async searchFiles(query: string, rootPath: string): Promise<any[]> {
        const vscode = await import('vscode');
        const path = await import('path');
        const fs = await import('fs').then(m => m.promises);

        try {
            if (!query || query.length < 2) {
                return [];
            }

            // Get workspace folders
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return [];
            }

            const workspaceRoot = workspaceFolders[0]!.uri.fsPath;
            const searchRegex = new RegExp(query, 'i');
            const results: any[] = [];

            // Recursive search function
            const searchInDirectory = async (dirPath: string, relativePath: string = ''): Promise<void> => {
                try {
                    const entries = await fs.readdir(dirPath, { withFileTypes: true });
                    
                    for (const entry of entries) {
                        // Skip hidden files and common ignore patterns
                        if (entry.name.startsWith('.') && !entry.name.match(/^\.(git|vscode|env)$/)) {
                            continue;
                        }
                        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
                            continue;
                        }

                        const fullPath = path.join(dirPath, entry.name);
                        const itemRelativePath = path.join(relativePath, entry.name).replace(/\\/g, '/');
                        
                        // Check if name matches search query
                        if (searchRegex.test(entry.name)) {
                            if (entry.isDirectory()) {
                                results.push({
                                    name: entry.name,
                                    path: itemRelativePath,
                                    type: 'directory'
                                });
                            } else {
                                const stats = await fs.stat(fullPath);
                                results.push({
                                    name: entry.name,
                                    path: itemRelativePath,
                                    type: 'file',
                                    size: stats.size,
                                    modified: stats.mtime
                                });
                            }
                        }

                        // Recursively search subdirectories
                        if (entry.isDirectory() && results.length < 100) { // Limit results
                            await searchInDirectory(fullPath, itemRelativePath);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to search in directory ${dirPath}:`, error);
                }
            };

            await searchInDirectory(workspaceRoot);
            
            return results.slice(0, 50); // Limit to 50 results

        } catch (error) {
            console.error('Failed to search files:', error);
            return [];
        }
    }

    /**
     * Handle prompt management messages
     */
    private async handlePromptMessage(clientId: string, message: EnhancedWebSocketMessage): Promise<void> {
        try {
            const { operation, content, category, tags, promptId, query, days } = message.data?.promptData || {};
            
            if (!operation) {
                this.sendError(clientId, 'Prompt operation is required', message.id);
                return;
            }

            let result: any;

            switch (operation) {
                case 'save':
                    if (!content) {
                        this.sendError(clientId, 'Prompt content is required for save operation', message.id);
                        return;
                    }
                    result = await this._remoteRCService.savePrompt(content, category, tags || []);
                    break;

                case 'history':
                    result = await this._remoteRCService.getPromptHistory(days);
                    break;

                case 'search':
                    if (!query) {
                        this.sendError(clientId, 'Search query is required', message.id);
                        return;
                    }
                    result = await this._remoteRCService.searchPrompts(query, category, tags);
                    break;

                case 'categories':
                    result = await this._remoteRCService.getCategories();
                    break;

                case 'byCategory':
                    if (!category) {
                        this.sendError(clientId, 'Category is required for byCategory operation', message.id);
                        return;
                    }
                    result = await this._remoteRCService.getPromptsByCategory(category);
                    break;

                case 'updateUsage':
                    if (!promptId) {
                        this.sendError(clientId, 'Prompt ID is required for updateUsage operation', message.id);
                        return;
                    }
                    await this._remoteRCService.updatePromptUsage(promptId);
                    result = { success: true };
                    break;

                case 'toggleFavorite':
                    if (!promptId) {
                        this.sendError(clientId, 'Prompt ID is required for toggleFavorite operation', message.id);
                        return;
                    }
                    result = { favorite: await this._remoteRCService.togglePromptFavorite(promptId) };
                    break;

                case 'structure':
                    result = await this._remoteRCService.getRemoteRCStructure();
                    break;

                default:
                    this.sendError(clientId, `Unsupported prompt operation: ${operation}`, message.id);
                    return;
            }

            // Send response
            const response: WebSocketMessage = {
                type: 'prompt',
                data: {
                    operation,
                    result
                }
            };

            if (message.id) {
                response.id = message.id;
            }

            this.sendToClient(clientId, response);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown prompt operation error';
            console.error(`Prompt operation failed for client ${clientId}:`, error);
            this.sendError(clientId, `Prompt operation failed: ${errorMessage}`, message.id);
        }
    }

    /**
     * Handle git operation messages
     */
    private async handleGitMessage(clientId: string, message: EnhancedWebSocketMessage): Promise<void> {
        try {
            const { operation, path, options } = message.data?.gitData || {};
            
            if (!operation) {
                this.sendError(clientId, 'Git operation is required', message.id);
                return;
            }

            const result = await this._gitService.executeGitCommand(operation, { 
                workspacePath: path, 
                ...options 
            });

            // Send response
            const response: WebSocketMessage = {
                type: 'git',
                data: {
                    operation,
                    result
                }
            };

            if (message.id) {
                response.id = message.id;
            }

            this.sendToClient(clientId, response);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown git operation error';
            console.error(`Git operation failed for client ${clientId}:`, error);
            this.sendError(clientId, `Git operation failed: ${errorMessage}`, message.id);
        }
    }

    /**
     * Handle configuration messages
     */
    private async handleConfigMessage(clientId: string, message: EnhancedWebSocketMessage): Promise<void> {
        try {
            const { operation, key, value } = message.data?.configData || {};
            
            if (!operation) {
                this.sendError(clientId, 'Config operation is required', message.id);
                return;
            }

            let result: any;

            switch (operation) {
                case 'get':
                    if (key === 'remoterc') {
                        result = await this._remoteRCService.getRemoteRCStructure();
                    } else if (key) {
                        // Get VS Code configuration
                        const vscode = await import('vscode');
                        result = vscode.workspace.getConfiguration().get(key);
                    } else {
                        result = null;
                    }
                    break;

                case 'set':
                    if (!key) {
                        this.sendError(clientId, 'Configuration key is required for set operation', message.id);
                        return;
                    }
                    
                    if (key.startsWith('remoterc.')) {
                        // Update RemoteRC configuration
                        const configKey = key.replace('remoterc.', '') as keyof typeof this._remoteRCService['_config'];
                        await this._remoteRCService.updateConfiguration(configKey, value);
                        result = { success: true };
                    } else {
                        // Update VS Code configuration
                        const vscode = await import('vscode');
                        await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Workspace);
                        result = { success: true };
                    }
                    break;

                case 'schema':
                    // Return configuration schema for UI generation
                    result = {
                        remoterc: {
                            defaultCategory: { type: 'string', default: 'general' },
                            autoSave: { type: 'boolean', default: true },
                            maxHistoryDays: { type: 'number', default: 30, min: 1, max: 365 }
                        }
                    };
                    break;

                default:
                    this.sendError(clientId, `Unsupported config operation: ${operation}`, message.id);
                    return;
            }

            // Send response
            const response: WebSocketMessage = {
                type: 'config',
                data: {
                    operation,
                    key,
                    result
                }
            };

            if (message.id) {
                response.id = message.id;
            }

            this.sendToClient(clientId, response);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown config operation error';
            console.error(`Config operation failed for client ${clientId}:`, error);
            this.sendError(clientId, `Config operation failed: ${errorMessage}`, message.id);
        }
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