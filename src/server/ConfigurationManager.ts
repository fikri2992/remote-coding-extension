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
     * Load and validate server configuration from VS Code settings (simplified schema)
     */
    public async loadConfiguration(): Promise<ServerConfig> {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');

        // Load configuration with defaults (simplified: only httpPort is honored)
        const rawConfig = {
            httpPort: config.get<number>('httpPort')
        } as const;

        // Apply defaults and validate
        const serverConfig = await this.applyDefaultsAndValidate(rawConfig);

        // Return minimal shape of ServerConfig for backward compatibility
        // Note: we intentionally omit deprecated optional fields to satisfy exactOptionalPropertyTypes
        const cfg: ServerConfig = {
            httpPort: serverConfig.httpPort,
            autoStartTunnel: false
        } as ServerConfig;
        return cfg;
    }

    /**
     * Apply default values and validate configuration
     */
    private async applyDefaultsAndValidate(rawConfig: any): Promise<Pick<ServerConfig, 'httpPort'>> {
        // Apply defaults (simplified schema)
        const config: Pick<ServerConfig, 'httpPort'> = {
            httpPort: rawConfig.httpPort ?? 3900
        };

        // Validate configuration
        await this.validateConfiguration({ httpPort: config.httpPort } as ServerConfig);

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
                    (config as any).httpPort = alternativePort;
                } else {
                    errors.push(`HTTP port ${config.httpPort} is not available and no alternative port found`);
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
     * Get configuration schema for validation
     */
    public getConfigurationSchema(): any {
        return {
            httpPort: {
                type: 'number',
                minimum: 1024,
                maximum: 65535,
                default: 3900,
                description: 'Port number for the HTTP server'
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
        // Only httpPort is supported; deprecated keys are ignored with a warning
        if (key !== 'httpPort') {
            vscode.window.showWarningMessage(`Setting '${key}' is deprecated and ignored. Use 'httpPort' only.`);
            // Still emit current config so UI can refresh
            const cfg = await this.loadConfiguration();
            this._onConfigurationChanged.fire(cfg);
            return;
        }
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
        if (key !== 'httpPort') {
            // Deprecated keys: warn and do not block
            vscode.window.showWarningMessage(`Setting '${key}' is deprecated and will be ignored.`);
            return;
        }

        const schema = this.getConfigurationSchema();
        const fieldSchema = (schema as any)[key];

        if (!fieldSchema) {
            throw new Error(`Unknown configuration key: ${key}`);
        }

        if (typeof value !== 'number' || !Number.isInteger(value)) {
            throw new Error(`${key} must be an integer`);
        }
        if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
            throw new Error(`${key} must be at least ${fieldSchema.minimum}`);
        }
        if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
            throw new Error(`${key} must be at most ${fieldSchema.maximum}`);
        }

        // Ensure port availability
        const available = await this.isPortAvailable(value);
        if (!available) {
            throw new Error(`Port ${value} is not available`);
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