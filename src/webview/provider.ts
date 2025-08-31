// Webview provider class
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ServerManager } from '../server/ServerManager';
import { ServerStatus, WebSocketMessage } from '../server/interfaces';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'basicExtensionView';
    private _view?: vscode.WebviewView;
    private _serverManager: ServerManager;
    private _statusUpdateInterval?: NodeJS.Timeout;
    private _serverStatusSubscription?: vscode.Disposable;
    private _tunnelStatusSubscription?: vscode.Disposable;

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context?: vscode.ExtensionContext) {
        this._serverManager = new ServerManager(_context);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        // Configure webview options and security settings
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's directory
            localResourceRoots: [this._extensionUri]
        };

        // Set the HTML content for the webview panel
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Set up message handling between webview and extension
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'executeAction':
                        this._handleExecuteAction(message.data);
                        break;
                    case 'startServer':
                        this._handleStartServer();
                        break;
                    case 'stopServer':
                        this._handleStopServer();
                        break;
                    case 'getServerStatus':
                        this._handleGetServerStatus();
                        break;
                    case 'openWebInterface':
                        this._handleOpenWebInterface();
                        break;
                    case 'startTunnel':
                        this._handleStartTunnel(message.data);
                        break;
                    case 'stopTunnel':
                        this._handleStopTunnel();
                        break;
                    case 'installCloudflared':
                        this._handleInstallCloudflared();
                        break;
                    case 'copyToClipboard':
                        this._handleCopyToClipboard(message.data);
                        break;
                    case 'updateConfiguration':
                        this._handleUpdateConfiguration(message.data);
                        break;
                    case 'resetConfiguration':
                        this._handleResetConfiguration();
                        break;
                    case 'getConfiguration':
                        this._handleGetConfiguration();
                        break;
                    case 'validatePort':
                        this._handleValidatePort(message.data);
                        break;
                    case 'promptOperation':
                        this._handlePromptOperation(message.data);
                        break;
                    case 'gitOperation':
                        this._handleGitOperation(message.data);
                        break;
                    case 'fileSystemOperation':
                        this._handleFileSystemOperation(message.data);
                        break;
                    case 'configOperation':
                        this._handleConfigOperation(message.data);
                        break;
                    case 'openWebInterface':
                        this._handleOpenWebInterface();
                        break;
                    default:
                        console.log('Unknown message received from webview:', message);
                        break;
                }
            },
            undefined,
            []
        );

        // Start periodic status updates
        this._startStatusUpdates();

        // Subscribe to immediate server/tunnel status changes
        this._serverStatusSubscription?.dispose();
        this._tunnelStatusSubscription?.dispose();
        this._serverStatusSubscription = this._serverManager.onServerStatusChanged(() => {
            this._sendServerStatus();
        });
        this._tunnelStatusSubscription = this._serverManager.onTunnelStatusChanged(() => {
            this._sendServerStatus();
            this._sendTunnelStatus();
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Use Vue frontend for VS Code webview - modern unified interface
        return this._getPanelHtmlForWebview(webview);
    }

    private _getPanelHtmlForWebview(webview: vscode.Webview): string {
        try {
            // Read the simple panel HTML from the built output directory
            const htmlPath = path.join(this._extensionUri.fsPath, 'out', 'webview', 'panel.html');
            let html = fs.readFileSync(htmlPath, 'utf8');
            
            // Convert CSS and JS file paths to webview URIs
            const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'styles.css'));
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'script.js'));
            
            // Replace the relative paths with webview URIs
            html = html.replace('href="styles.css"', `href="${stylesUri}"`);
            html = html.replace('src="script.js"', `src="${scriptUri}"`);
            
            // Add VS Code webview API script
            const vscodeApiScript = 
                '<script>' +
                '    // Make VS Code API available to panel' +
                '    window.vscode = acquireVsCodeApi();' +
                '</script>';
            
            // Insert the VS Code API script before the closing body tag
            html = html.replace('</body>', vscodeApiScript + '</body>');
            
            return html;
            
        } catch (error) {
            console.error('Failed to load panel HTML:', error);
            return this._getFallbackHtml(webview);
        }
    }

    /**
     * Handle starting Cloudflare tunnel from webview
     */
    private async _handleStartTunnel(data?: any): Promise<void> {
        try {
            // Ensure server is running; ServerManager will error if not
            const mode = data?.mode as 'named' | 'quick' | undefined;
            let tunnelName: string | undefined = data?.tunnelName;
            let cloudflareToken: string | undefined = data?.cloudflareToken;

            if (mode === 'named') {
                // Try SecretStorage first
                const secretKey = 'webAutomationTunnel.cloudflareToken';
                const existing = await this._context?.secrets.get(secretKey);

                if (!cloudflareToken) {
                    cloudflareToken = existing || undefined;
                }

                if (!cloudflareToken) {
                    cloudflareToken = await vscode.window.showInputBox({
                        prompt: 'Enter Cloudflare token for named tunnel',
                        placeHolder: 'Paste token (will be stored securely if you choose so)',
                        password: true
                    });
                    if (!cloudflareToken) {
                        throw new Error('Cloudflare token is required for named tunnel');
                    }
                    // Offer to save to SecretStorage
                    const save = await vscode.window.showInformationMessage(
                        'Save Cloudflare token securely for future use?',
                        'Save',
                        'Not now'
                    );
                    if (save === 'Save') {
                        await this._context?.secrets.store(secretKey, cloudflareToken);
                    }
                }

                if (!tunnelName) {
                    tunnelName = await vscode.window.showInputBox({
                        prompt: 'Enter tunnel name (optional)',
                        placeHolder: 'my-vscode-tunnel'
                    });
                }
            }

            await this._serverManager.startTunnel({
                tunnelName,
                cloudflareToken
            } as any);

            this._sendTunnelStatus();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to start tunnel: ${errorMessage}`);
            // Also notify webview so UI can reflect error state
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'tunnelStatusUpdate',
                    data: { isRunning: false, error: errorMessage }
                });
            }
        }
    }

    /**
     * Handle stopping Cloudflare tunnel from webview
     */
    private async _handleStopTunnel(): Promise<void> {
        try {
            await this._serverManager.stopTunnel();
            this._sendTunnelStatus();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to stop tunnel: ${errorMessage}`);
        }
    }

    /**
     * Handle install cloudflared request from webview
     */
    private async _handleInstallCloudflared(): Promise<void> {
        try {
            await this._serverManager.installCloudflared();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Installation error: ${errorMessage}`);
        }
    }

    /**
     * Handle copy to clipboard from webview
     */
    private async _handleCopyToClipboard(data: { text?: string }): Promise<void> {
        if (!data?.text) return;
        try {
            await vscode.env.clipboard.writeText(data.text);
            vscode.window.showInformationMessage('Copied to clipboard');
        } catch {
            // ignore
        }
    }

    private _getUnifiedHtmlForWebview(webview: vscode.Webview): string {
        try {
            // Read the Vue frontend HTML from the built output directory
            const htmlPath = path.join(this._extensionUri.fsPath, 'out', 'webview', 'vue-frontend', 'index.html');
            let html = fs.readFileSync(htmlPath, 'utf8');
            
            // Convert local resource paths to webview URIs
            const frontendUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'vue-frontend')
            );
            
            // Replace relative paths with webview URIs
            html = html.replace(/href="\/assets\//g, 'href="' + frontendUri + '/assets/');
            html = html.replace(/src="\/assets\//g, 'src="' + frontendUri + '/assets/');
            
            // Debug logging to verify path replacement
            console.log('Vue Frontend URI:', frontendUri.toString());
            
            // Add VS Code webview API script for Vue frontend
            const vscodeApiScript = 
                '<script>' +
                '    // Make VS Code API available to Vue frontend' +
                '    window.vscode = acquireVsCodeApi();' +
                '</script>';
            
            // Insert the VS Code API script before the closing body tag
            html = html.replace('</body>', vscodeApiScript + '</body>');
            
            return html;
            
        } catch (error) {
            console.error('Failed to load Vue frontend HTML:', error);
            return this._getFallbackHtml(webview);
        }
    }
    /**
     * Fallback HTML when Vue frontend fails to load
     */
    private _getFallbackHtml(webview: vscode.Webview): string {
        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '    <title>Web Automation Tunnel - Error</title>',
            '    <style>',
            '        body {',
            '            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '            padding: 20px;',
            '            background: var(--vscode-editor-background, #1e1e1e);',
            '            color: var(--vscode-foreground, #cccccc);',
            '        }',
            '        .error-container {',
            '            max-width: 600px;',
            '            margin: 0 auto;',
            '            text-align: center;',
            '            padding: 40px 20px;',
            '        }',
            '        .error-title {',
            '            color: var(--vscode-errorForeground, #f14c4c);',
            '            font-size: 24px;',
            '            margin-bottom: 16px;',
            '        }',
            '        .error-message {',
            '            font-size: 16px;',
            '            line-height: 1.5;',
            '            margin-bottom: 24px;',
            '        }',
            '        .retry-button {',
            '            background: var(--vscode-button-background, #0e639c);',
            '            color: var(--vscode-button-foreground, #ffffff);',
            '            border: none;',
            '            padding: 8px 16px;',
            '            border-radius: 2px;',
            '            cursor: pointer;',
            '            font-size: 14px;',
            '        }',
            '        .retry-button:hover {',
            '            background: var(--vscode-button-hoverBackground, #1177bb);',
            '        }',
            '    </style>',
            '</head>',
            '<body>',
            '    <div class="error-container">',
            '        <h1 class="error-title">Frontend Load Error</h1>',
            '        <p class="error-message">',
            '            Failed to load the web automation interface. This may be due to missing files or build issues.',
            '        </p>',
            '        <button class="retry-button" onclick="location.reload()">Retry</button>',
            '    </div>',
            '    <script>',
            '        window.vscode = acquireVsCodeApi();',
            '    </script>',
            '</body>',
            '</html>'
        ].join('\n');
    }


    private _handleExecuteAction(data: any) {
        // Handle the execute action message from webview
        console.log('Execute action requested from webview:', data);
        
        // Execute the registered command
        vscode.commands.executeCommand('basicExtension.executeAction', data);
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    /**
     * Handle server start request from webview
     */
    private async _handleStartServer(): Promise<void> {
        try {
            this._sendStatusUpdate({ type: 'serverStarting' });
            await this._serverManager.startServer();
            this._sendServerStatus();
            vscode.window.showInformationMessage('Web Automation Server started successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this._sendStatusUpdate({ type: 'serverError', error: errorMessage });
            vscode.window.showErrorMessage('Failed to start server: ' + errorMessage);
            // Send status update even on error to ensure UI reflects current state
            this._sendServerStatus();
        }
    }

    /**
     * Handle server stop request from webview
     */
    private async _handleStopServer(): Promise<void> {
        try {
            this._sendStatusUpdate({ type: 'serverStopping' });
            await this._serverManager.stopServer();
            this._sendServerStatus();
            vscode.window.showInformationMessage('Web Automation Server stopped');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this._sendStatusUpdate({ type: 'serverError', error: errorMessage });
            vscode.window.showErrorMessage('Failed to stop server: ' + errorMessage);
            // Send status update even on error to ensure UI reflects current state
            this._sendServerStatus();
        }
    }

    /**
     * Handle server status request from webview
     */
    private _handleGetServerStatus(): void {
        this._sendServerStatus();
    }

    /**
     * Send current server status to webview
     */
    private _sendServerStatus(): void {
        if (!this._view) return;

        const status = this._serverManager.getServerStatus();
        const connectedClients = this._serverManager.getConnectedClients();
        
        this._view.webview.postMessage({
            command: 'serverStatusUpdate',
            data: {
                status,
                clients: connectedClients
            }
        });
    }

    /**
     * Send status update to webview
     */
    private _sendStatusUpdate(update: any): void {
        if (!this._view) return;

        this._view.webview.postMessage({
            command: 'statusUpdate',
            data: update
        });
    }

    /**
     * Start periodic status updates
     */
    private _startStatusUpdates(): void {
        // Clear existing interval if any
        if (this._statusUpdateInterval) {
            clearInterval(this._statusUpdateInterval);
        }

        // Send initial status
        this._sendServerStatus();
        this._sendTunnelStatus();

        // Set up periodic updates every 2 seconds
        this._statusUpdateInterval = setInterval(() => {
            this._sendServerStatus();
        }, 2000);
    }

    /**
     * Stop periodic status updates
     */
    private _stopStatusUpdates(): void {
        if (this._statusUpdateInterval) {
            clearInterval(this._statusUpdateInterval);
            delete this._statusUpdateInterval;
        }
    }

    /**
     * Start server (public method for command palette)
     */
    public async startServer(): Promise<void> {
        return this._handleStartServer();
    }

    /**
     * Stop server (public method for command palette)
     */
    public async stopServer(): Promise<void> {
        return this._handleStopServer();
    }

    /**
     * Get server manager instance
     */
    public get serverManager(): ServerManager {
        return this._serverManager;
    }

    /**
     * Send current tunnel status to webview
     */
    private _sendTunnelStatus(): void {
        if (!this._view) return;

        const t = this._serverManager.getTunnelStatus();
        this._view.webview.postMessage({
            command: 'tunnelStatusUpdate',
            data: t
                ? { isRunning: true, publicUrl: t.publicUrl || undefined, error: undefined }
                : { isRunning: false }
        });
    }

    /**
     * Handle configuration request from webview
     */
    private async _handleGetConfiguration(): Promise<void> {
        if (!this._view) return;

        try {
            const config = await this._serverManager.configurationManager.loadConfiguration();
            const schema = this._serverManager.configurationManager.getConfigurationSchema();
            
            this._view.webview.postMessage({
                command: 'configurationUpdate',
                data: {
                    config,
                    schema
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'configurationError',
                data: { error: errorMessage }
            });
        }
    }

    /**
     * Handle configuration update from webview
     */
    private async _handleUpdateConfiguration(data: any): Promise<void> {
        if (!this._view) return;

        try {
            // Handle both single key-value and multiple settings format
            if (data.key && data.value !== undefined) {
                // Single setting update
                await this._serverManager.updateConfigurationValue(data.key, data.value);
                
                this._view.webview.postMessage({
                    command: 'configurationUpdated',
                    data: { key: data.key, value: data.value }
                });
            } else if (typeof data === 'object') {
                // Multiple settings update
                const updates = Object.entries(data);
                for (const [key, value] of updates) {
                    await this._serverManager.updateConfigurationValue(key, value);
                }
                
                this._view.webview.postMessage({
                    command: 'configurationUpdated',
                    data: data
                });
            } else {
                throw new Error('Invalid configuration data format');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'configurationError',
                data: { error: errorMessage }
            });
        }
    }

    /**
     * Handle configuration reset from webview
     */
    private async _handleResetConfiguration(): Promise<void> {
        if (!this._view) return;

        try {
            await this._serverManager.resetConfigurationToDefaults();
            
            // Send updated configuration
            await this._handleGetConfiguration();
            
            this._view.webview.postMessage({
                command: 'configurationResetSuccess',
                data: {}
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'configurationResetError',
                data: { error: errorMessage }
            });
        }
    }

    /**
     * Handle port validation from webview
     */
    private async _handleValidatePort(data: { port: number }): Promise<void> {
        if (!this._view) return;

        try {
            // Use the configuration manager to validate the port
            await this._serverManager.configurationManager.updateConfiguration('httpPort', data.port);
            
            this._view.webview.postMessage({
                command: 'portValidationResult',
                data: { 
                    port: data.port, 
                    valid: true 
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'portValidationResult',
                data: { 
                    port: data.port, 
                    valid: false, 
                    error: errorMessage 
                }
            });
        }
    }

    /**
     * Handle prompt operation from webview
     */
    private async _handlePromptOperation(data: any): Promise<void> {
        if (!this._view) return;

        try {
            // Forward prompt operation to WebSocket server
            const wsServer = this._serverManager.webSocketServer;
            if (wsServer) {
                // Broadcast prompt operation to all connected clients
                const message: WebSocketMessage = {
                    type: 'prompt',
                    data: {
                        promptData: data
                    }
                };
                
                wsServer.broadcastMessage(message);
                
                this._view.webview.postMessage({
                    command: 'promptOperationSuccess',
                    data: { operation: data.operation }
                });
            } else {
                throw new Error('WebSocket server not available');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'promptOperationError',
                data: { 
                    operation: data.operation,
                    error: errorMessage 
            }
        });
        }
    }

    /**
     * Handle git operation from webview
     */
    private async _handleGitOperation(data: any): Promise<void> {
        if (!this._view) return;

        try {
            // For now, send a simple acknowledgment since git operations
            // would require a separate Git service integration
            console.log('Git operation requested:', data);

            this._view.webview.postMessage({
                command: 'gitOperationResult',
                data: {
                    operation: data.operation,
                    success: false,
                    result: null,
                    error: 'Git operations not yet implemented in this version'
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'gitOperationError',
                data: {
                    operation: data.operation,
                    error: errorMessage
                }
            });
        }
    }

    /**
     * Handle file system operation from webview
     */
    private async _handleFileSystemOperation(data: any): Promise<void> {
        if (!this._view) return;

        try {
            const { operation, path: filePath, options } = data;
            let result: any;

            switch (operation) {
                case 'openFile':
                    if (filePath) {
                        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
                        result = { success: true };
                    } else {
                        throw new Error('File path is required');
                    }
                    break;

                case 'createFile':
                    if (filePath) {
                        const uri = vscode.Uri.file(filePath);
                        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
                        result = { success: true, path: filePath };
                    } else {
                        throw new Error('File path is required');
                    }
                    break;

                case 'deleteFile':
                    if (filePath) {
                        const uri = vscode.Uri.file(filePath);
                        await vscode.workspace.fs.delete(uri);
                        result = { success: true };
                    } else {
                        throw new Error('File path is required');
                    }
                    break;

                case 'renameFile':
                    if (filePath && options?.newPath) {
                        const oldUri = vscode.Uri.file(filePath);
                        const newUri = vscode.Uri.file(options.newPath);
                        await vscode.workspace.fs.rename(oldUri, newUri);
                        result = { success: true, oldPath: filePath, newPath: options.newPath };
                    } else {
                        throw new Error('File path and new path are required');
                    }
                    break;

                case 'watchFiles':
                    // Set up file system watcher
                    const pattern = options?.pattern || '**/*';
                    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                    
                    watcher.onDidCreate(uri => {
                        this._view?.webview.postMessage({
                            command: 'fileSystemChange',
                            data: { type: 'created', path: uri.fsPath }
                        });
                    });

                    watcher.onDidChange(uri => {
                        this._view?.webview.postMessage({
                            command: 'fileSystemChange',
                            data: { type: 'changed', path: uri.fsPath }
                        });
                    });

                    watcher.onDidDelete(uri => {
                        this._view?.webview.postMessage({
                            command: 'fileSystemChange',
                            data: { type: 'deleted', path: uri.fsPath }
                        });
                    });

                    result = { success: true, watching: pattern };
                    break;

                default:
                    throw new Error('Unsupported file system operation: ' + operation);
            }

            this._view.webview.postMessage({
                command: 'fileSystemOperationResult',
                data: { 
                    operation,
                    result
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'fileSystemOperationError',
                data: { 
                    operation: data.operation,
                    error: errorMessage 
                }
            });
        }
    }

    /**
     * Handle configuration operation from webview
     */
    private async _handleConfigOperation(data: any): Promise<void> {
        if (!this._view) return;

        try {
            const { operation, key, value } = data;
            let result: any;

            switch (operation) {
                case 'get':
                    if (key) {
                        result = vscode.workspace.getConfiguration().get(key);
                    } else {
                        // Get all enhanced UI configuration
                        result = {
                            webAutomationTunnel: vscode.workspace.getConfiguration('webAutomationTunnel').get(''),
                            enhancedUI: vscode.workspace.getConfiguration('enhancedUI').get('')
                        };
                    }
                    break;

                case 'set':
                    if (key && value !== undefined) {
                        await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Workspace);
                        result = { success: true, key, value };
                    } else {
                        throw new Error('Configuration key and value are required');
                    }
                    break;

                case 'reset':
                    if (key) {
                        await vscode.workspace.getConfiguration().update(key, undefined, vscode.ConfigurationTarget.Workspace);
                        result = { success: true, key };
                    } else {
                        throw new Error('Configuration key is required');
                    }
                    break;

                default:
                    throw new Error('Unsupported config operation: ' + operation);
            }

            this._view.webview.postMessage({
                command: 'configOperationResult',
                data: { 
                    operation,
                    key,
                    result
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'configOperationError',
                data: { 
                    operation: data.operation,
                    error: errorMessage 
                }
            });
        }
    }

    /**
     * Handle opening web interface in browser
     */
    private _handleOpenWebInterface(): void {
        const status = this._serverManager.getServerStatus();
        const webInterfaceUrl = status.webInterfaceUrl || status.serverUrl || 'http://localhost:3000';
        vscode.env.openExternal(vscode.Uri.parse(webInterfaceUrl));
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this._stopStatusUpdates();
        this._serverStatusSubscription?.dispose();
        this._tunnelStatusSubscription?.dispose();
        this._serverManager.dispose();
    }
}