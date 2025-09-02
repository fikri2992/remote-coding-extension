/**
 * ConfigurationManager - Handles VS Code settings integration, validation, and change detection
 */

import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { ServerConfig } from './interfaces';

export class ConfigurationManager {
    private _configChangeListener: vscode.Disposable | null = null;
    private _onConfigurationChanged: vscode.EventEmitter<ServerConfig> = new vscode.EventEmitter<ServerConfig>();
    private _configFileWatcher: vscode.FileSystemWatcher | null = null;
    private _usingFileConfig: boolean = false;
    
    /**
     * Event fired when configuration changes
     */
    public readonly onConfigurationChanged: vscode.Event<ServerConfig> = this._onConfigurationChanged.event;

    constructor() {
        this.setupConfigurationWatcher();
        this.setupConfigFileWatcher();
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
     * Watch .remote-coding/config.json changes and emit validated ServerConfig
     */
    private setupConfigFileWatcher(): void {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        // Dispose any existing watcher
        if (this._configFileWatcher) {
            this._configFileWatcher.dispose();
            this._configFileWatcher = null;
        }

        const folders = vscode.workspace.workspaceFolders!;
        const folder = folders[0]!;
        const pattern = new vscode.RelativePattern(folder, '.remote-coding/config.json');
        this._configFileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        const reloadAndEmit = async () => {
            try {
                const cfg = await this.loadConfiguration();
                this._onConfigurationChanged.fire(cfg);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Configuration file error: ${msg}`);
            }
        };

        this._configFileWatcher.onDidCreate(reloadAndEmit);
        this._configFileWatcher.onDidChange(reloadAndEmit);
        this._configFileWatcher.onDidDelete(async () => {
            this._usingFileConfig = false;
            await reloadAndEmit();
        });
    }

    /**
     * Load and validate server configuration from VS Code settings (simplified schema)
     */
    public async loadConfiguration(): Promise<ServerConfig> {
        // Try to load from .remote-coding/config.json first
        const fileCfg = await this.readConfigFile();
        if (fileCfg) {
            this._usingFileConfig = true;
            const serverConfig = await this.applyDefaultsAndValidate(fileCfg);
            const cfg: ServerConfig = {
                httpPort: serverConfig.httpPort,
                autoStartTunnel: false
            } as ServerConfig;
            return cfg;
        }

        // Fallback to VS Code settings
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        const rawConfig = {
            httpPort: config.get<number>('httpPort')
        } as const;

        const serverConfig = await this.applyDefaultsAndValidate(rawConfig);
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
     * Ensure onboarding by creating .remote-coding/config.json if missing (interactive by default).
     */
    public async ensureOnboarding(interactive: boolean = true): Promise<void> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return; // no workspace open

        const folderPath = path.join(workspace.uri.fsPath, '.remote-coding');
        const configPath = path.join(folderPath, 'config.json');

        // If already exists, nothing to do
        if (await this.pathExists(configPath)) {
            return;
        }

        if (!interactive) {
            await fs.promises.mkdir(folderPath, { recursive: true });
            await this.writeConfigFile({ httpPort: 3900 });
            vscode.window.showInformationMessage('Initialized .remote-coding/config.json with defaults');
            return;
        }

        const choice = await vscode.window.showInformationMessage(
            'Remote Coding: Set up project configuration?',
            'Set Up',
            'Skip'
        );
        if (choice === 'Set Up') {
            try {
                await fs.promises.mkdir(folderPath, { recursive: true });
                await this.writeConfigFile({ httpPort: 3900 });
                this._usingFileConfig = true;
                const cfg = await this.loadConfiguration();
                this._onConfigurationChanged.fire(cfg);
                vscode.window.showInformationMessage('Project configured in .remote-coding/config.json');
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                vscode.window.showErrorMessage(`Failed to initialize .remote-coding: ${msg}`);
            }
        }
    }

    /** Read JSON from .remote-coding/config.json if it exists */
    private async readConfigFile(): Promise<Partial<ServerConfig> | null> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return null;
        const configPath = path.join(workspace.uri.fsPath, '.remote-coding', 'config.json');
        if (!(await this.pathExists(configPath))) return null;
        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            const data = JSON.parse(content);
            // Only honor supported keys
            const result: Partial<ServerConfig> = {};
            if (typeof data.httpPort === 'number') result.httpPort = data.httpPort;
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Invalid .remote-coding/config.json: ${msg}`);
            return null;
        }
    }

    /** Write JSON to .remote-coding/config.json */
    private async writeConfigFile(data: Partial<ServerConfig>): Promise<void> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return;
        const folderPath = path.join(workspace.uri.fsPath, '.remote-coding');
        const configPath = path.join(folderPath, 'config.json');
        await fs.promises.mkdir(folderPath, { recursive: true });
        const payload: any = {};
        if (typeof data.httpPort === 'number') payload.httpPort = data.httpPort;
        await fs.promises.writeFile(configPath, JSON.stringify(payload, null, 2), 'utf8');
    }

    private async pathExists(p: string): Promise<boolean> {
        try {
            await fs.promises.stat(p);
            return true;
        } catch {
            return false;
        }
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
        // Prefer file-based config if present
        const fileCfg = await this.readConfigFile();
        if (fileCfg !== null) {
            await this.writeConfigFile({ httpPort: 3900 });
            const cfg = await this.loadConfiguration();
            this._onConfigurationChanged.fire(cfg);
            vscode.window.showInformationMessage('Reset .remote-coding/config.json to defaults');
            return;
        }

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

        // Prefer file-based config if present (or if previously used)
        const hasFile = (await this.readConfigFile()) !== null;
        if (hasFile || this._usingFileConfig) {
            await this.writeConfigFile({ httpPort: value });
            const cfg = await this.loadConfiguration();
            this._onConfigurationChanged.fire(cfg);
            return;
        }

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
        if (this._configFileWatcher) {
            this._configFileWatcher.dispose();
            this._configFileWatcher = null;
        }
        this._onConfigurationChanged.dispose();
    }
}