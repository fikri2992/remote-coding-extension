/**
 * ConfigurationManager - Handles VS Code settings integration, validation, and change detection
 */

import * as vscode from 'vscode';
import * as net from 'net';
import { ServerConfig } from './interfaces';

export class ConfigurationManager {
    private _configChangeListener: vscode.Disposable | null = null;
    private _onConfigurationChanged: vscode.EventEmitter<ServerConfig> = new vscode.EventEmitter<ServerConfig>();
    
    /**
     * Event fired when configuration changes
     */
    public readonly onConfigurationChanged: vscode.Event<ServerConfig> = this._onConfigurationChanged.event;

    constructor() {
        this.setupConfigurationWatcher();
    }

    /**
     * Load and validate server configuration from VS Code settings
     */
    public async loadConfiguration(): Promise<ServerConfig> {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        
        // Load configuration with defaults
        const rawConfig = {
            httpPort: config.get<number>('httpPort'),
            websocketPort: config.get<number>('websocketPort'),
            allowedOrigins: config.get<string[]>('allowedOrigins'),
            maxConnections: config.get<number>('maxConnections'),
            enableCors: config.get<boolean>('enableCors')
        };

        // Apply defaults and validate
        const serverConfig = await this.applyDefaultsAndValidate(rawConfig);
        
        return serverConfig;
    }

    /**
     * Apply default values and validate configuration
     */
    private async applyDefaultsAndValidate(rawConfig: any): Promise<ServerConfig> {
        // Apply defaults
        const config: ServerConfig = {
            httpPort: rawConfig.httpPort ?? 8080,
            allowedOrigins: rawConfig.allowedOrigins ?? ['*'],
            maxConnections: rawConfig.maxConnections ?? 10,
            enableCors: rawConfig.enableCors ?? true
        };

        // Set WebSocket port default (HTTP port + 1)
        if (rawConfig.websocketPort !== undefined) {
            config.websocketPort = rawConfig.websocketPort;
        } else {
            config.websocketPort = config.httpPort + 1;
        }

        // Validate configuration
        await this.validateConfiguration(config);

        return config;
    }

    /**
     * Comprehensive configuration validation
     */
    private async validateConfiguration(config: ServerConfig): Promise<void> {
        const errors: string[] = [];

        // Validate HTTP port
        if (!this.isValidPort(config.httpPort)) {
            errors.push('HTTP port must be between 1024 and 65535');
        } else {
            // Check port availability
            const httpPortAvailable = await this.isPortAvailable(config.httpPort);
            if (!httpPortAvailable) {
                // Try to find an alternative port
                const alternativePort = await this.findAvailablePort(config.httpPort);
                if (alternativePort) {
                    vscode.window.showWarningMessage(
                        `HTTP port ${config.httpPort} is not available. Using port ${alternativePort} instead.`
                    );
                    config.httpPort = alternativePort;
                } else {
                    errors.push(`HTTP port ${config.httpPort} is not available and no alternative port found`);
                }
            }
        }

        // Validate WebSocket port
        const websocketPort = config.websocketPort ?? config.httpPort + 1;
        if (!this.isValidPort(websocketPort)) {
            errors.push('WebSocket port must be between 1024 and 65535');
        } else {
            // Check WebSocket port availability
            const wsPortAvailable = await this.isPortAvailable(websocketPort);
            if (!wsPortAvailable) {
                // Try to find an alternative port
                const alternativePort = await this.findAvailablePort(websocketPort);
                if (alternativePort) {
                    vscode.window.showWarningMessage(
                        `WebSocket port ${websocketPort} is not available. Using port ${alternativePort} instead.`
                    );
                    config.websocketPort = alternativePort;
                } else {
                    errors.push(`WebSocket port ${websocketPort} is not available and no alternative port found`);
                }
            } else {
                config.websocketPort = websocketPort;
            }
        }

        // Validate port conflicts
        if (config.httpPort === config.websocketPort) {
            errors.push('HTTP and WebSocket ports cannot be the same');
        }

        // Validate max connections
        if (config.maxConnections < 1 || config.maxConnections > 100) {
            errors.push('Max connections must be between 1 and 100');
        }

        // Validate allowed origins
        if (!Array.isArray(config.allowedOrigins) || config.allowedOrigins.length === 0) {
            errors.push('At least one allowed origin must be specified');
        } else {
            // Validate origin format
            for (const origin of config.allowedOrigins) {
                if (typeof origin !== 'string' || origin.trim() === '') {
                    errors.push('All allowed origins must be non-empty strings');
                    break;
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }

    /**
     * Check if a port number is valid
     */
    private isValidPort(port: number): boolean {
        return Number.isInteger(port) && port >= 1024 && port <= 65535;
    }

    /**
     * Check if a port is available for binding
     */
    private async isPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.close(() => {
                    resolve(true);
                });
            });

            server.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Find an available port starting from the given port
     */
    private async findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number | null> {
        for (let i = 0; i < maxAttempts; i++) {
            const port = startPort + i;
            if (this.isValidPort(port) && await this.isPortAvailable(port)) {
                return port;
            }
        }
        return null;
    }

    /**
     * Setup configuration change watcher
     */
    private setupConfigurationWatcher(): void {
        this._configChangeListener = vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('webAutomationTunnel')) {
                try {
                    const newConfig = await this.loadConfiguration();
                    this._onConfigurationChanged.fire(newConfig);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
                    vscode.window.showErrorMessage(`Configuration validation failed: ${errorMessage}`);
                }
            }
        });
    }

    /**
     * Get configuration schema for validation
     */
    public getConfigurationSchema(): any {
        return {
            httpPort: {
                type: 'number',
                minimum: 1024,
                maximum: 65535,
                default: 8080,
                description: 'Port number for the HTTP server'
            },
            websocketPort: {
                type: 'number',
                minimum: 1024,
                maximum: 65535,
                description: 'Port number for the WebSocket server (defaults to HTTP port + 1)'
            },
            allowedOrigins: {
                type: 'array',
                items: { type: 'string' },
                default: ['*'],
                description: 'List of allowed origins for CORS and WebSocket connections'
            },
            maxConnections: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                default: 10,
                description: 'Maximum number of concurrent WebSocket connections'
            },
            enableCors: {
                type: 'boolean',
                default: true,
                description: 'Enable Cross-Origin Resource Sharing (CORS) support'
            }
        };
    }

    /**
     * Reset configuration to defaults
     */
    public async resetToDefaults(): Promise<void> {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        const schema = this.getConfigurationSchema();

        for (const [key, value] of Object.entries(schema)) {
            if (typeof value === 'object' && value !== null && 'default' in value) {
                await config.update(key, (value as any).default, vscode.ConfigurationTarget.Workspace);
            }
        }

        vscode.window.showInformationMessage('Web Automation Tunnel configuration reset to defaults');
    }

    /**
     * Validate and update a specific configuration value
     */
    public async updateConfiguration(key: string, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        
        // Validate the specific value
        await this.validateConfigurationValue(key, value);
        
        // Update the configuration
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * Validate a specific configuration value
     */
    private async validateConfigurationValue(key: string, value: any): Promise<void> {
        const schema = this.getConfigurationSchema();
        const fieldSchema = schema[key];

        if (!fieldSchema) {
            throw new Error(`Unknown configuration key: ${key}`);
        }

        switch (fieldSchema.type) {
            case 'number':
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                    throw new Error(`${key} must be an integer`);
                }
                if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
                    throw new Error(`${key} must be at least ${fieldSchema.minimum}`);
                }
                if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
                    throw new Error(`${key} must be at most ${fieldSchema.maximum}`);
                }
                
                // Special validation for ports
                if (key.includes('Port')) {
                    const available = await this.isPortAvailable(value);
                    if (!available) {
                        throw new Error(`Port ${value} is not available`);
                    }
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    throw new Error(`${key} must be a boolean`);
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    throw new Error(`${key} must be an array`);
                }
                if (key === 'allowedOrigins' && value.length === 0) {
                    throw new Error('At least one allowed origin must be specified');
                }
                break;

            default:
                throw new Error(`Unsupported configuration type: ${fieldSchema.type}`);
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        if (this._configChangeListener) {
            this._configChangeListener.dispose();
            this._configChangeListener = null;
        }
        this._onConfigurationChanged.dispose();
    }
}