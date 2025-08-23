/**
 * ServerManager - Central orchestrator for HTTP and WebSocket servers
 */

import * as vscode from 'vscode';
import { ServerConfig, ServerStatus, ClientConnection } from './interfaces';
import { HttpServer } from './HttpServer';

export class ServerManager {
    private _isRunning: boolean = false;
    private _config: ServerConfig | null = null;
    private _startTime: Date | null = null;
    private _connectedClients: Map<string, ClientConnection> = new Map();
    private _lastError: string | null = null;
    private _httpServer: HttpServer | null = null;

    constructor() {
        // Initialize with default configuration
        this.loadConfiguration();
    }

    /**
     * Start the HTTP and WebSocket servers
     */
    async startServer(config?: ServerConfig): Promise<void> {
        try {
            if (this._isRunning) {
                throw new Error('Server is already running');
            }

            // Use provided config or load from settings
            this._config = config || this.loadConfiguration();
            
            if (!this._config) {
                throw new Error('Failed to load server configuration');
            }

            // Validate configuration
            this.validateConfiguration(this._config);

            // Initialize and start HTTP server
            this._httpServer = new HttpServer(this._config);
            await this._httpServer.start();

            // TODO: Initialize WebSocket server
            
            this._isRunning = true;
            this._startTime = new Date();
            this._lastError = null;

            console.log(`Web Automation Server started on port ${this._httpServer.port}`);
            
        } catch (error) {
            this._lastError = error instanceof Error ? error.message : 'Unknown error occurred';
            this._isRunning = false;
            throw error;
        }
    }

    /**
     * Stop the HTTP and WebSocket servers gracefully
     */
    async stopServer(): Promise<void> {
        try {
            if (!this._isRunning) {
                return; // Already stopped
            }

            // TODO: Close WebSocket connections gracefully
            
            // Stop HTTP server
            if (this._httpServer) {
                await this._httpServer.stop();
                this._httpServer = null;
            }

            // TODO: Stop WebSocket server

            this._isRunning = false;
            this._startTime = null;
            this._connectedClients.clear();
            this._lastError = null;

            console.log('Web Automation Server stopped');
            
        } catch (error) {
            this._lastError = error instanceof Error ? error.message : 'Error during server shutdown';
            throw error;
        }
    }

    /**
     * Get current server status
     */
    getServerStatus(): ServerStatus {
        const status: ServerStatus = {
            isRunning: this._isRunning,
            connectedClients: this._connectedClients.size
        };

        if (this._lastError) {
            status.lastError = this._lastError;
        }

        if (this._isRunning && this._config && this._startTime && this._httpServer) {
            status.httpPort = this._httpServer.port;
            status.websocketPort = this._config.websocketPort || this._httpServer.port + 1;
            status.uptime = Date.now() - this._startTime.getTime();
            status.serverUrl = `http://localhost:${this._httpServer.port}`;
        }

        return status;
    }

    /**
     * Load server configuration from VS Code settings
     */
    private loadConfiguration(): ServerConfig {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        
        const serverConfig: ServerConfig = {
            httpPort: config.get<number>('httpPort') || 8080,
            allowedOrigins: config.get<string[]>('allowedOrigins') || ['*'],
            maxConnections: config.get<number>('maxConnections') || 10,
            enableCors: config.get<boolean>('enableCors') ?? true
        };

        const websocketPort = config.get<number>('websocketPort');
        if (websocketPort !== undefined) {
            serverConfig.websocketPort = websocketPort;
        }

        return serverConfig;
    }

    /**
     * Validate server configuration
     */
    private validateConfiguration(config: ServerConfig): void {
        if (config.httpPort < 1024 || config.httpPort > 65535) {
            throw new Error('HTTP port must be between 1024 and 65535');
        }

        if (config.websocketPort && (config.websocketPort < 1024 || config.websocketPort > 65535)) {
            throw new Error('WebSocket port must be between 1024 and 65535');
        }

        if (config.maxConnections < 1 || config.maxConnections > 100) {
            throw new Error('Max connections must be between 1 and 100');
        }

        if (!Array.isArray(config.allowedOrigins) || config.allowedOrigins.length === 0) {
            throw new Error('At least one allowed origin must be specified');
        }
    }

    /**
     * Broadcast message to all connected WebSocket clients
     */
    broadcastToClients(message: any): void {
        if (!this._isRunning) {
            console.warn('Cannot broadcast message: server is not running');
            return;
        }

        // TODO: Implement WebSocket broadcasting
        console.log('Broadcasting message to clients:', message);
    }

    /**
     * Get list of connected clients
     */
    getConnectedClients(): ClientConnection[] {
        return Array.from(this._connectedClients.values());
    }

    /**
     * Check if server is running
     */
    get isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Get current configuration
     */
    get config(): ServerConfig | null {
        return this._config;
    }
}