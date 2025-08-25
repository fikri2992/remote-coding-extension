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

    constructor(private readonly _extensionUri: vscode.Uri) {
        this._serverManager = new ServerManager();
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
                    case 'getConfiguration':
                        this._handleGetConfiguration();
                        break;
                    case 'updateConfiguration':
                        this._handleUpdateConfiguration(message.data);
                        break;
                    case 'resetConfiguration':
                        this._handleResetConfiguration();
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
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Check if enhanced UI is enabled
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        const useEnhancedUI = config.get<boolean>('useEnhancedUI', true);
        
        if (useEnhancedUI) {
            return this._getEnhancedHtmlForWebview(webview);
        } else {
            return this._getBasicHtmlForWebview(webview);
        }
    }

    private _getEnhancedHtmlForWebview(webview: vscode.Webview): string {
        try {
            // Read the unified frontend HTML from the built output directory
            const htmlPath = path.join(this._extensionUri.fsPath, 'out', 'webview', 'frontend', 'index.html');
            let html = fs.readFileSync(htmlPath, 'utf8');
            
            // Convert local resource paths to webview URIs
            const frontendUri = webview.asWebviewUri(
                vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'frontend')
            );
            
            // Replace relative paths with webview URIs
            html = html.replace(/href="styles\//g, `href="${frontendUri}/styles/`);
            html = html.replace(/src="js\//g, `src="${frontendUri}/js/`);
            
            // Add VS Code webview API script
            const vscodeApiScript = `
                <script>
                    // Make VS Code API available to unified frontend
                    window.vscode = acquireVsCodeApi();
                    
                    // Enhanced message handling for unified frontend
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        // Forward messages to the unified web app
                        if (window.unifiedWebApp) {
                            if (window.unifiedWebApp.webSocketClient) {
                                window.unifiedWebApp.webSocketClient.handleExtensionMessage(message);
                            }
                            if (window.unifiedWebApp.webAutomationService) {
                                window.unifiedWebApp.webAutomationService.handleExtensionMessage(message);
                            }
                        }
                    });
                </script>
            `;
            
            // Insert the VS Code API script before the closing head tag
            html = html.replace('</head>', `${vscodeApiScript}</head>`);
            
            return html;
            
        } catch (error) {
            console.error('Error reading unified frontend HTML file:', error);
            // Fallback to basic UI
            return this._getBasicHtmlForWebview(webview);
        }
    }

    private _getBasicHtmlForWebview(webview: vscode.Webview): string {
        // Read the basic HTML file from the built output directory
        const htmlPath = path.join(this._extensionUri.fsPath, 'out', 'webview', 'panel.html');
        
        try {
            let html = fs.readFileSync(htmlPath, 'utf8');
            
            // Replace any local resource references with webview URIs if needed
            // For now, return the HTML as-is since we're not using external resources yet
            return html;
        } catch (error) {
            console.error('Error reading HTML file:', error);
            // Fallback HTML content
            return `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Basic Extension</title>
                </head>
                <body>
                    <h3>Basic Extension Panel</h3>
                    <p>Error loading panel content.</p>
                </body>
                </html>
            `;
        }
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
            vscode.window.showErrorMessage(`Failed to start server: ${errorMessage}`);
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
            vscode.window.showErrorMessage(`Failed to stop server: ${errorMessage}`);
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
    private async _handleUpdateConfiguration(data: { key: string; value: any }): Promise<void> {
        if (!this._view) return;

        try {
            await this._serverManager.updateConfigurationValue(data.key, data.value);
            
            this._view.webview.postMessage({
                command: 'configurationUpdateSuccess',
                data: { key: data.key, value: data.value }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._view.webview.postMessage({
                command: 'configurationUpdateError',
                data: { 
                    key: data.key, 
                    error: errorMessage 
                }
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
            // Forward git operation to WebSocket server
            const wsServer = this._serverManager.webSocketServer;
            if (wsServer) {
                // Execute git operation through the git service
                const result = await wsServer.commandHandler.executeCommand('git.' + data.operation, data.args || []);
                
                this._view.webview.postMessage({
                    command: 'gitOperationResult',
                    data: { 
                        operation: data.operation,
                        success: result.success,
                        result: result.data,
                        error: result.error
                    }
                });
            } else {
                throw new Error('WebSocket server not available');
            }
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
                    throw new Error(`Unsupported file system operation: ${operation}`);
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
                    throw new Error(`Unsupported config operation: ${operation}`);
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
     * Dispose resources
     */
    public dispose(): void {
        this._stopStatusUpdates();
        this._serverManager.dispose();
    }
}