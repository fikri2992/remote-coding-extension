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
     * Watch VS Code configuration changes and emit validated ServerConfig
     */
    private setupConfigurationWatcher(): void {
        if (this._configChangeListener) {
            this._configChangeListener.dispose();
            this._configChangeListener = null;
        }

        this._configChangeListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (!e.affectsConfiguration('webAutomationTunnel')) return;
            try {
                const cfg = await this.loadConfiguration();
                this._onConfigurationChanged.fire(cfg);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Configuration update error: ${msg}`);
            }
        });
    }

    /**
     * Load and validate server configuration from VS Code settings (minimal schema)
     */
    public async loadConfiguration(): Promise<ServerConfig> {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');

        // Load configuration with defaults (minimal schema)
        const rawConfig = {
            httpPort: config.get<number>('httpPort'),
            websocketPort: config.get<number>('websocketPort'),
            tunnelName: config.get<string>('tunnelName'),
            cloudflareToken: config.get<string>('cloudflareToken'),
            autoStartTunnel: config.get<boolean>('autoStartTunnel')
        };

        // Apply defaults and validate
        const serverConfig = await this.applyDefaultsAndValidate(rawConfig);

        return serverConfig;
    }

    /**
     * Apply default values and validate configuration
     */
    private async applyDefaultsAndValidate(rawConfig: any): Promise<ServerConfig> {
        // Apply defaults (minimal schema)
        const config: ServerConfig = {
            httpPort: rawConfig.httpPort ?? 8080,
            websocketPort: rawConfig.websocketPort ?? ((rawConfig.httpPort ?? 8080) + 1),
            tunnelName: rawConfig.tunnelName?.trim() || undefined,
            cloudflareToken: rawConfig.cloudflareToken?.trim() || undefined,
            autoStartTunnel: rawConfig.autoStartTunnel ?? true
        };

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
        const websocketPort = config.websocketPort ?? (config.httpPort + 1);
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

        // Validate tunnelName (if provided)
        if (config.tunnelName && !/^[A-Za-z0-9-_]{1,128}$/.test(config.tunnelName)) {
            errors.push('tunnelName may only contain letters, numbers, dashes and underscores (max 128 chars)');
        }

        // Validate cloudflareToken (basic check if provided)
        if (config.cloudflareToken && config.cloudflareToken.length < 10) {
            errors.push('cloudflareToken appears too short');
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
            tunnelName: {
                type: 'string',
                description: 'Optional Cloudflare named tunnel to use (leave empty to use a quick tunnel)'
            },
            cloudflareToken: {
                type: 'string',
                description: 'Optional Cloudflare API token for authenticated tunnels (recommended for named tunnels)'
            },
            autoStartTunnel: {
                type: 'boolean',
                default: true,
                description: 'Automatically start Cloudflare tunnel when server starts'
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
            } else {
                await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
            }
        }

        vscode.window.showInformationMessage('Web Automation Tunnel configuration reset to defaults');
    }

    /**
     * Update a specific configuration value after validating.
     */
    public async updateConfiguration(key: string, value: any): Promise<void> {
        await this.validateConfigurationValue(key, value);
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
        // Reload and emit
        const cfg = await this.loadConfiguration();
        this._onConfigurationChanged.fire(cfg);
    }

    /**
     * Validate a specific configuration value
     */
    private async validateConfigurationValue(key: string, value: any): Promise<void> {
        const schema = this.getConfigurationSchema();
        const fieldSchema = (schema as any)[key];

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

            case 'string':
                if (typeof value !== 'string') {
                    throw new Error(`${key} must be a string`);
                }
                if (key === 'tunnelName' && value && !/^[A-Za-z0-9-_]{1,128}$/.test(value)) {
                    throw new Error('tunnelName may only contain letters, numbers, dashes and underscores (max 128 chars)');
                }
                if (key === 'cloudflareToken' && value && value.length < 10) {
                    throw new Error('cloudflareToken appears too short');
                }
                break;

            default:
                throw new Error(`Unsupported configuration type: ${fieldSchema.type}`);
        }
    }

    /**
     * Check if a port is available by attempting to bind to it.
     */
    private async isPortAvailable(port: number): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const server = net.createServer();
            server.unref();
            server.on('error', () => resolve(false));
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
        });
    }

    /**
     * Find an available port starting from startPort.
     */
    private async findAvailablePort(startPort: number, maxAttempts: number = 20): Promise<number | null> {
        for (let i = 0; i < maxAttempts; i++) {
            const probe = startPort + i;
            // Skip reserved or duplicate of http/websocket sanity
            if (!this.isValidPort(probe)) continue;
            // eslint-disable-next-line no-await-in-loop
            const available = await this.isPortAvailable(probe);
            if (available) return probe;
        }
        return null;
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