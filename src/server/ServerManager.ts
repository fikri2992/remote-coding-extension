/**
 * ServerManager - Central orchestrator for HTTP and WebSocket servers
 */

import * as vscode from 'vscode';
import { ServerConfig, ServerStatus, ClientConnection, WebSocketMessage } from './interfaces';
import { HttpServer } from './HttpServer';
import { WebSocketServer } from './WebSocketServer';
import { ConfigurationManager } from './ConfigurationManager';

export class ServerManager {
    private _isRunning: boolean = false;
    private _config: ServerConfig | null = null;
    private _startTime: Date | null = null;
    private _connectedClients: Map<string, ClientConnection> = new Map();
    private _lastError: string | null = null;
    private _httpServer: HttpServer | null = null;
    private _webSocketServer: WebSocketServer | null = null;
    private _configManager: ConfigurationManager;
    private _configChangeListener: vscode.Disposable | null = null;

    constructor() {
        this._configManager = new ConfigurationManager();
        this.setupConfigurationHandling();
        // Load initial configuration
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
            this._config = config || await this.loadConfiguration();
            
            if (!this._config) {
                throw new Error('Failed to load server configuration');
            }

            // Initialize and start HTTP server
            this._httpServer = new HttpServer(this._config);
            await this._httpServer.start();

            // Initialize and start WebSocket server
            this._webSocketServer = new WebSocketServer(this._config);
            await this._webSocketServer.start();
            
            this._isRunning = true;
            this._startTime = new Date();
            this._lastError = null;

            console.log(`Web Automation Server started - HTTP: ${this._httpServer.port}, WebSocket: ${this._webSocketServer.port}`);
            
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

            // Stop WebSocket server first (closes connections gracefully)
            if (this._webSocketServer) {
                await this._webSocketServer.stop();
                this._webSocketServer = null;
            }
            
            // Stop HTTP server
            if (this._httpServer) {
                await this._httpServer.stop();
                this._httpServer = null;
            }

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
            connectedClients: this._webSocketServer?.clientCount || 0
        };

        if (this._lastError) {
            status.lastError = this._lastError;
        }

        if (this._isRunning && this._config && this._startTime && this._httpServer && this._webSocketServer) {
            status.httpPort = this._httpServer.port;
            status.websocketPort = this._webSocketServer.port;
            status.uptime = Date.now() - this._startTime.getTime();
            status.serverUrl = `http://localhost:${this._httpServer.port}`;
        }

        return status;
    }

    /**
     * Load server configuration from VS Code settings using ConfigurationManager
     */
    private async loadConfiguration(): Promise<ServerConfig> {
        try {
            return await this._configManager.loadConfiguration();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
            vscode.window.showErrorMessage(`Configuration error: ${errorMessage}`);
            
            // Return a basic default configuration as fallback
            return {
                httpPort: 8080,
                allowedOrigins: ['*'],
                maxConnections: 10,
                enableCors: true
            };
        }
    }

    /**
     * Setup configuration change handling
     */
    private setupConfigurationHandling(): void {
        this._configChangeListener = this._configManager.onConfigurationChanged(async (newConfig) => {
            await this.handleConfigurationChange(newConfig);
        });
    }

    /**
     * Handle configuration changes with server restart prompts
     */
    private async handleConfigurationChange(newConfig: ServerConfig): Promise<void> {
        if (!this._isRunning) {
            // Server is not running, just update the config
            this._config = newConfig;
            return;
        }

        // Check if the configuration change requires a server restart
        const requiresRestart = this.configurationRequiresRestart(this._config!, newConfig);
        
        if (requiresRestart) {
            const action = await vscode.window.showWarningMessage(
                'Configuration changes require a server restart to take effect.',
                'Restart Now',
                'Restart Later',
                'Cancel'
            );

            switch (action) {
                case 'Restart Now':
                    try {
                        await this.restartServer(newConfig);
                        vscode.window.showInformationMessage('Server restarted with new configuration');
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        vscode.window.showErrorMessage(`Failed to restart server: ${errorMessage}`);
                    }
                    break;
                    
                case 'Restart Later':
                    vscode.window.showInformationMessage('Configuration saved. Restart the server manually to apply changes.');
                    break;
                    
                case 'Cancel':
                    // Configuration change was cancelled, but VS Code settings have already changed
                    // We could potentially revert the settings here, but that might be confusing
                    vscode.window.showInformationMessage('Configuration change noted. Current server continues with previous settings.');
                    break;
            }
        } else {
            // Configuration change doesn't require restart, apply immediately
            this._config = newConfig;
            vscode.window.showInformationMessage('Configuration updated successfully');
        }
    }

    /**
     * Check if configuration changes require a server restart
     */
    private configurationRequiresRestart(oldConfig: ServerConfig, newConfig: ServerConfig): boolean {
        // Port changes require restart
        if (oldConfig.httpPort !== newConfig.httpPort) {
            return true;
        }
        
        if (oldConfig.websocketPort !== newConfig.websocketPort) {
            return true;
        }

        // CORS and origin changes require restart
        if (oldConfig.enableCors !== newConfig.enableCors) {
            return true;
        }

        if (JSON.stringify(oldConfig.allowedOrigins) !== JSON.stringify(newConfig.allowedOrigins)) {
            return true;
        }

        // Max connections can be changed without restart (handled by WebSocket server)
        return false;
    }

    /**
     * Restart the server with new configuration
     */
    private async restartServer(newConfig: ServerConfig): Promise<void> {
        await this.stopServer();
        await this.startServer(newConfig);
    }

    /**
     * Broadcast message to all connected WebSocket clients
     */
    broadcastToClients(message: WebSocketMessage): number {
        if (!this._isRunning || !this._webSocketServer) {
            console.warn('Cannot broadcast message: server is not running');
            return 0;
        }

        return this._webSocketServer.broadcastMessage(message);
    }

    /**
     * Get list of connected clients
     */
    getConnectedClients(): ClientConnection[] {
        return this._webSocketServer?.getConnectedClients() || [];
    }

    /**
     * Send message to specific WebSocket client
     */
    sendToClient(clientId: string, message: WebSocketMessage): boolean {
        if (!this._isRunning || !this._webSocketServer) {
            console.warn('Cannot send message: server is not running');
            return false;
        }

        return this._webSocketServer.sendToClient(clientId, message);
    }

    /**
     * Force state synchronization for all connected clients
     */
    forceStateSynchronization(): void {
        if (this._isRunning && this._webSocketServer) {
            this._webSocketServer.forceStateSynchronization();
        }
    }

    /**
     * Force state synchronization for specific client
     */
    forceClientStateSynchronization(clientId: string): boolean {
        if (!this._isRunning || !this._webSocketServer) {
            return false;
        }

        return this._webSocketServer.forceClientStateSynchronization(clientId);
    }

    /**
     * Get enhanced client connection information
     */
    getEnhancedClientInfo(): any[] {
        if (!this._isRunning || !this._webSocketServer) {
            return [];
        }

        return this._webSocketServer.getEnhancedClientInfo();
    }

    /**
     * Get current state version
     */
    getStateVersion(): number {
        if (!this._isRunning || !this._webSocketServer) {
            return 0;
        }

        return this._webSocketServer.stateVersion;
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

    /**
     * Get configuration manager instance
     */
    get configurationManager(): ConfigurationManager {
        return this._configManager;
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfigurationToDefaults(): Promise<void> {
        await this._configManager.resetToDefaults();
    }

    /**
     * Update a specific configuration value
     */
    async updateConfigurationValue(key: string, value: any): Promise<void> {
        await this._configManager.updateConfiguration(key, value);
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this._configChangeListener) {
            this._configChangeListener.dispose();
            this._configChangeListener = null;
        }
        
        if (this._configManager) {
            this._configManager.dispose();
        }
    }
}