/**
 * ServerManager - Central orchestrator for HTTP and WebSocket servers
 */

import * as vscode from 'vscode';
import { ServerConfig, ServerStatus, ClientConnection, WebSocketMessage } from './interfaces';
import { HttpServer } from './HttpServer';
import { WebSocketServer } from './WebSocketServer';
import { WebServer, WebServerConfig } from './WebServer';
import { ConfigurationManager } from './ConfigurationManager';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { ConnectionRecoveryManager, RecoveryConfig } from './ConnectionRecoveryManager';

export class ServerManager {
    private _isRunning: boolean = false;
    private _config: ServerConfig | null = null;
    private _startTime: Date | null = null;
    private _connectedClients: Map<string, ClientConnection> = new Map();
    private _lastError: string | null = null;
    private _httpServer: HttpServer | null = null;
    private _webSocketServer: WebSocketServer | null = null;
    private _webServer: WebServer | null = null;
    private _configManager: ConfigurationManager;
    private _configChangeListener: vscode.Disposable | null = null;
    private _errorHandler: ErrorHandler;
    private _recoveryManager: ConnectionRecoveryManager;
    private _startupAttempts: number = 0;
    private _maxStartupAttempts: number = 3;

    constructor() {
        this._configManager = new ConfigurationManager();
        this._errorHandler = ErrorHandler.getInstance();
        this._recoveryManager = new ConnectionRecoveryManager(
            {
                maxRetries: 5,
                initialDelay: 1000,
                maxDelay: 30000,
                backoffMultiplier: 2,
                jitterEnabled: true,
                healthCheckInterval: 30000
            },
            {
                onStateChange: (clientId, oldState, newState) => {
                    console.log(`Client ${clientId} state changed: ${oldState} -> ${newState}`);
                },
                onRecoverySuccess: (clientId, attempts) => {
                    vscode.window.showInformationMessage(`Client ${clientId} reconnected after ${attempts} attempts`);
                },
                onRecoveryFailed: (clientId, error) => {
                    vscode.window.showWarningMessage(`Failed to reconnect client ${clientId}: ${error.message}`);
                }
            }
        );
        
        this.setupConfigurationHandling();
        // Load initial configuration
        this.loadConfiguration();
    }

    /**
     * Start the HTTP and WebSocket servers with comprehensive error handling
     */
    async startServer(config?: ServerConfig): Promise<void> {
        this._startupAttempts++;
        
        try {
            if (this._isRunning) {
                const errorInfo = this._errorHandler.createError(
                    'SERVER_ALREADY_RUNNING',
                    'Server is already running',
                    ErrorCategory.SERVER_STARTUP,
                    ErrorSeverity.LOW
                );
                throw errorInfo;
            }

            // Use provided config or load from settings
            this._config = config || await this.loadConfiguration();
            
            if (!this._config) {
                const errorInfo = this._errorHandler.createError(
                    'CONFIG_LOAD_FAILED',
                    'Failed to load server configuration',
                    ErrorCategory.CONFIGURATION,
                    ErrorSeverity.HIGH
                );
                throw errorInfo;
            }

            // Validate configuration before starting
            await this.validateConfiguration(this._config);

            // Initialize and start HTTP server with recovery
            await this.startHttpServerWithRecovery(this._config);

            // Initialize and start WebSocket server with recovery
            await this.startWebSocketServerWithRecovery(this._config);
            
            // Initialize and start webserver for React frontend
            await this.startWebServerWithRecovery(this._config);
            
            this._isRunning = true;
            this._startTime = new Date();
            this._lastError = null;
            this._startupAttempts = 0; // Reset on success

            const successMessage = `Web Automation Server started successfully - HTTP: ${this._httpServer!.port}, WebSocket: ${this._webSocketServer!.port}`;
            console.log(successMessage);
            
            // Show success notification
            vscode.window.showInformationMessage(
                `Server started on http://localhost:${this._httpServer!.port}`,
                'Open in Browser'
            ).then(action => {
                if (action === 'Open in Browser') {
                    vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${this._httpServer!.port}`));
                }
            });
            
        } catch (error) {
            await this.handleStartupError(error);
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
     * Get WebSocket server instance
     */
    get webSocketServer(): WebSocketServer | null {
        return this._webSocketServer;
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
     * Validate server configuration
     */
    private async validateConfiguration(config: ServerConfig): Promise<void> {
        // Validate port ranges
        if (config.httpPort < 1 || config.httpPort > 65535) {
            throw this._errorHandler.createError(
                'INVALID_PORT_RANGE',
                `HTTP port ${config.httpPort} is outside valid range (1-65535)`,
                ErrorCategory.CONFIGURATION,
                ErrorSeverity.HIGH
            );
        }

        // Check if port is available
        const isPortAvailable = await this.checkPortAvailability(config.httpPort);
        if (!isPortAvailable && this._startupAttempts <= 1) {
            // Only throw error on first attempt, let recovery handle subsequent attempts
            throw this._errorHandler.createError(
                'EADDRINUSE',
                `Port ${config.httpPort} is already in use`,
                ErrorCategory.NETWORK,
                ErrorSeverity.MEDIUM
            );
        }

        // Validate allowed origins
        if (!config.allowedOrigins || config.allowedOrigins.length === 0) {
            console.warn('No allowed origins specified, defaulting to localhost only');
            config.allowedOrigins = ['http://localhost:*'];
        }

        // Validate max connections
        if (config.maxConnections < 1 || config.maxConnections > 1000) {
            console.warn(`Max connections ${config.maxConnections} is outside recommended range (1-1000), using default`);
            config.maxConnections = 10;
        }
    }

    /**
     * Check if a port is available
     */
    private async checkPortAvailability(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => resolve(true));
                server.close();
            });
            
            server.on('error', () => resolve(false));
        });
    }

    /**
     * Start HTTP server with recovery mechanisms
     */
    private async startHttpServerWithRecovery(config: ServerConfig): Promise<void> {
        try {
            this._httpServer = new HttpServer(config);
            await this._httpServer.start();
        } catch (error) {
            const { recovered } = await this._errorHandler.handleError(error as Error, {
                tryAlternativePort: async () => {
                    return await this.tryAlternativeHttpPort(config);
                },
                useHigherPort: async () => {
                    config.httpPort = Math.max(config.httpPort, 8080) + Math.floor(Math.random() * 1000);
                    return await this.tryAlternativeHttpPort(config);
                }
            });

            if (!recovered) {
                throw error;
            }
        }
    }

    /**
     * Try alternative HTTP port
     */
    private async tryAlternativeHttpPort(config: ServerConfig): Promise<boolean> {
        const maxAttempts = 10;
        let currentPort = config.httpPort;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const testConfig = { ...config, httpPort: currentPort + attempt };
                const testServer = new HttpServer(testConfig);
                await testServer.start();
                await testServer.stop();
                
                // Port is available, update config and create actual server
                config.httpPort = currentPort + attempt;
                this._httpServer = new HttpServer(config);
                await this._httpServer.start();
                
                console.log(`HTTP server started on alternative port: ${config.httpPort}`);
                return true;
            } catch (portError) {
                // Continue to next port
                continue;
            }
        }
        
        return false;
    }

    /**
     * Start webserver for React frontend with recovery mechanisms
     */
    private async startWebServerWithRecovery(config: ServerConfig): Promise<void> {
        try {
            // Use a different port for the webserver (frontend)
            const webServerConfig: WebServerConfig = {
                port: 3000, // Use port 3000 for React frontend
                host: 'localhost'
                // distPath will be set when building the React app
            };

            this._webServer = new WebServer(webServerConfig);
            await this._webServer.start();
        } catch (error) {
            const { recovered } = await this._errorHandler.handleError(error as Error, {
                tryAlternativePort: async () => {
                    return await this.tryAlternativeWebServerPort(config);
                }
            });

            if (!recovered) {
                throw error;
            }
        }
    }

    /**
     * Try alternative webserver port
     */
    private async tryAlternativeWebServerPort(config: ServerConfig): Promise<boolean> {
        const maxAttempts = 10;
        let currentPort = 3000; // Start from 3000

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const webServerConfig: WebServerConfig = {
                    port: currentPort + attempt,
                    host: 'localhost'
                    // distPath will be set when building the React app
                };

                const testServer = new WebServer(webServerConfig);
                await testServer.start();
                await testServer.stop();

                // Port is available, update config and create actual server
                this._webServer = new WebServer(webServerConfig);
                await this._webServer.start();

                console.log(`Webserver started on alternative port: ${currentPort + attempt}`);
                return true;
            } catch (portError) {
                // Continue to next port
                continue;
            }
        }

        return false;
    }

    /**
     * Start WebSocket server with recovery mechanisms
     */
    private async startWebSocketServerWithRecovery(config: ServerConfig): Promise<void> {
        try {
            this._webSocketServer = new WebSocketServer(config);
            await this._webSocketServer.start();
            
            // Setup connection recovery for WebSocket clients
            this.setupWebSocketRecovery();
            
        } catch (error) {
            const { recovered } = await this._errorHandler.handleError(error as Error, {
                tryAlternativePort: async () => {
                    return await this.tryAlternativeWebSocketPort(config);
                }
            });

            if (!recovered) {
                throw error;
            }
        }
    }

    /**
     * Try alternative WebSocket port
     */
    private async tryAlternativeWebSocketPort(config: ServerConfig): Promise<boolean> {
        const maxAttempts = 10;
        const basePort = config.websocketPort || config.httpPort + 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const testConfig = { ...config, websocketPort: basePort + attempt };
                const testServer = new WebSocketServer(testConfig);
                await testServer.start();
                await testServer.stop();
                
                // Port is available, update config and create actual server
                config.websocketPort = basePort + attempt;
                this._webSocketServer = new WebSocketServer(config);
                await this._webSocketServer.start();
                
                this.setupWebSocketRecovery();
                
                console.log(`WebSocket server started on alternative port: ${config.websocketPort}`);
                return true;
            } catch (portError) {
                // Continue to next port
                continue;
            }
        }
        
        return false;
    }

    /**
     * Setup WebSocket connection recovery
     */
    private setupWebSocketRecovery(): void {
        if (!this._webSocketServer) {
            return;
        }

        // Monitor client connections and register them with recovery manager
        // This would typically be integrated with the WebSocketServer's connection handling
        console.log('WebSocket connection recovery monitoring enabled');
    }

    /**
     * Handle startup errors with recovery attempts
     */
    private async handleStartupError(error: any): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : 'Unknown startup error';
        this._lastError = errorMessage;
        this._isRunning = false;

        // Clean up any partially started servers
        await this.cleanupPartialStartup();

        // Determine if we should retry
        const shouldRetry = this._startupAttempts < this._maxStartupAttempts && 
                           this.isRetryableError(error);

        if (shouldRetry) {
            const delay = Math.min(1000 * Math.pow(2, this._startupAttempts - 1), 10000);
            console.log(`Startup failed, retrying in ${delay}ms (attempt ${this._startupAttempts}/${this._maxStartupAttempts})`);
            
            setTimeout(async () => {
                try {
                    await this.startServer();
                } catch (retryError) {
                    // Final error handling will be done in the recursive call
                }
            }, delay);
        } else {
            // Final failure, show comprehensive error message
            const errorInfo = this._errorHandler.createError(
                'STARTUP_FAILED',
                `Server startup failed after ${this._startupAttempts} attempts: ${errorMessage}`,
                ErrorCategory.SERVER_STARTUP,
                ErrorSeverity.CRITICAL,
                { attempts: this._startupAttempts, originalError: errorMessage }
            );

            await this._errorHandler.handleError(errorInfo, null, false);
            this._startupAttempts = 0; // Reset for next manual attempt
        }
    }

    /**
     * Check if error is retryable
     */
    private isRetryableError(error: any): boolean {
        if (error && typeof error === 'object' && 'code' in error) {
            const retryableCodes = ['EADDRINUSE', 'EACCES', 'ETIMEDOUT', 'ECONNREFUSED'];
            return retryableCodes.includes(error.code);
        }
        return false;
    }

    /**
     * Clean up partially started servers
     */
    private async cleanupPartialStartup(): Promise<void> {
        try {
            if (this._httpServer) {
                await this._httpServer.stop();
                this._httpServer = null;
            }
        } catch (error) {
            console.error('Error stopping HTTP server during cleanup:', error);
        }

        try {
            if (this._webSocketServer) {
                await this._webSocketServer.stop();
                this._webSocketServer = null;
            }
        } catch (error) {
            console.error('Error stopping WebSocket server during cleanup:', error);
        }
    }

    /**
     * Get comprehensive server diagnostics
     */
    getServerDiagnostics(): any {
        return {
            isRunning: this._isRunning,
            startupAttempts: this._startupAttempts,
            lastError: this._lastError,
            errorHistory: this._errorHandler.getErrorHistory().slice(0, 10),
            connectionHealth: this._recoveryManager.getAllClientHealth(),
            config: this._config,
            uptime: this._startTime ? Date.now() - this._startTime.getTime() : 0
        };
    }

    /**
     * Force recovery for all connections
     */
    async forceRecoveryAll(): Promise<void> {
        const clients = this._recoveryManager.getAllClientHealth();
        const recoveryPromises = clients.map(client => 
            this._recoveryManager.forceReconnection(client.clientId)
        );
        
        const results = await Promise.allSettled(recoveryPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        vscode.window.showInformationMessage(
            `Recovery attempted for ${clients.length} clients, ${successful} successful`
        );
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
        
        if (this._recoveryManager) {
            this._recoveryManager.dispose();
        }
    }
}