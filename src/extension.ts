// Main extension entry point
import * as vscode from 'vscode';
import { WebviewProvider } from './webview/provider';
import { registerButtonCommands } from './commands/buttonCommands';
import { registerIntegrationTestCommand } from './integration-test';

export function activate(context: vscode.ExtensionContext) {
    console.log('Basic VSCode Extension is now active!');

    // Register webview provider for extension view
    const webviewProvider = new WebviewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WebviewProvider.viewType,
            webviewProvider
        )
    );

    // Register commands for button functionality
    registerButtonCommands(context);

    // Register server management commands
    const startServerCommand = vscode.commands.registerCommand('webAutomationTunnel.startServer', async () => {
        try {
            await webviewProvider.startServer();
            vscode.window.showInformationMessage('Web Automation Server started successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to start server: ${errorMessage}`);
        }
    });

    const stopServerCommand = vscode.commands.registerCommand('webAutomationTunnel.stopServer', async () => {
        try {
            await webviewProvider.stopServer();
            vscode.window.showInformationMessage('Web Automation Server stopped');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to stop server: ${errorMessage}`);
        }
    });

    const openConfigurationCommand = vscode.commands.registerCommand('webAutomationTunnel.openConfiguration', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'webAutomationTunnel');
    });

    const resetConfigurationCommand = vscode.commands.registerCommand('webAutomationTunnel.resetConfiguration', async () => {
        const action = await vscode.window.showWarningMessage(
            'This will reset all Web Automation Tunnel settings to their default values. Are you sure?',
            'Reset',
            'Cancel'
        );

        if (action === 'Reset') {
            try {
                await webviewProvider.serverManager.resetConfigurationToDefaults();
                vscode.window.showInformationMessage('Configuration reset to defaults successfully');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to reset configuration: ${errorMessage}`);
            }
        }
    });

    const toggleUICommand = vscode.commands.registerCommand('webAutomationTunnel.toggleUI', async () => {
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        const currentValue = config.get('useEnhancedUI', true);
        const newValue = !currentValue;
        
        try {
            await config.update('useEnhancedUI', newValue, vscode.ConfigurationTarget.Workspace);
            
            const uiType = newValue ? 'Enhanced' : 'Basic';
            const action = await vscode.window.showInformationMessage(
                `Switched to ${uiType} UI. Refresh the webview to see changes.`,
                'Refresh Now'
            );
            
            if (action === 'Refresh Now') {
                webviewProvider.refresh();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to toggle UI: ${errorMessage}`);
        }
    });

    // Tunnel management commands
    const startTunnelCommand = vscode.commands.registerCommand('webAutomationTunnel.startTunnel', async () => {
        try {
            // Ask for tunnel name (blank -> quick tunnel)
            let tunnelName = await vscode.window.showInputBox({
                prompt: 'Enter tunnel name (optional, leave empty for quick tunnel)',
                placeHolder: 'vscode-web-automation'
            });

            let cloudflareToken: string | undefined;

            if (tunnelName) {
                // Named tunnel: try SecretStorage first
                const secretKey = 'webAutomationTunnel.cloudflareToken';
                const existing = await context.secrets.get(secretKey);
                cloudflareToken = existing || undefined;

                if (!cloudflareToken) {
                    cloudflareToken = await vscode.window.showInputBox({
                        prompt: 'Enter Cloudflare API token (required for named tunnel)',
                        placeHolder: 'Paste your token',
                        password: true
                    });
                    if (!cloudflareToken) {
                        vscode.window.showWarningMessage('Cloudflare token is required for a named tunnel. Starting quick tunnel instead.');
                        tunnelName = undefined;
                    } else {
                        const save = await vscode.window.showInformationMessage(
                            'Save Cloudflare token securely for future use?',
                            'Save',
                            'Not now'
                        );
                        if (save === 'Save') {
                            await context.secrets.store(secretKey, cloudflareToken);
                        }
                    }
                }
            }

            const tunnelConfig: any = {};
            if (tunnelName) tunnelConfig.tunnelName = tunnelName;
            if (cloudflareToken) tunnelConfig.cloudflareToken = cloudflareToken;

            await webviewProvider.serverManager.startTunnel(tunnelConfig);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to start tunnel: ${errorMessage}`);
        }
    });

    const stopTunnelCommand = vscode.commands.registerCommand('webAutomationTunnel.stopTunnel', async () => {
        try {
            await webviewProvider.serverManager.stopTunnel();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to stop tunnel: ${errorMessage}`);
        }
    });

    const installCloudflaredCommand = vscode.commands.registerCommand('webAutomationTunnel.installCloudflared', async () => {
        try {
            await webviewProvider.serverManager.installCloudflared();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Installation error: ${errorMessage}`);
        }
    });

    const tunnelStatusCommand = vscode.commands.registerCommand('webAutomationTunnel.tunnelStatus', async () => {
        try {
            const status = webviewProvider.serverManager.getTunnelStatus();
            const serverStatus = webviewProvider.serverManager.getServerStatus();

            const message = [
                `Tunnel Status: ${status ? 'Active' : 'Inactive'}`,
                status ? `Public URL: ${status.publicUrl || 'Not available'}` : '',
                status ? `Local URL: ${status.localUrl || 'Not available'}` : '',
                status ? `Started: ${status.startTime ? new Date(status.startTime).toLocaleString() : 'Unknown'}` : '',
                `Server Running: ${serverStatus.isRunning}`,
                `Server URL: ${serverStatus.serverUrl || 'Not available'}`
            ].filter(Boolean).join('\n');

            vscode.window.showInformationMessage(message, { modal: true }, 'Copy URL').then(action => {
                if (action === 'Copy URL' && status?.publicUrl) {
                    vscode.env.clipboard.writeText(status.publicUrl);
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Status check error: ${errorMessage}`);
        }
    });

    context.subscriptions.push(
        startServerCommand, 
        stopServerCommand, 
        openConfigurationCommand, 
        resetConfigurationCommand,
        toggleUICommand,
        startTunnelCommand,
        stopTunnelCommand,
        installCloudflaredCommand,
        tunnelStatusCommand
    );

    // Register integration test command
    registerIntegrationTestCommand(context);

    console.log('Basic VSCode Extension registration complete');

    // Show one-time deprecation/migration notice
    const noticeKey = 'webAutomationTunnel.deprecationNotice.v1';
    const shown = context.globalState.get<boolean>(noticeKey, false);
    if (!shown) {
        vscode.window.showInformationMessage(
            'Web Automation Tunnel: Settings simplified. Only "httpPort" remains. Deprecated settings like websocketPort, allowedOrigins, enableCors, tunnelName, and cloudflareToken are ignored. Control auto-start and tunnel from the UI.',
            'Open Settings'
        ).then(action => {
            if (action === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'webAutomationTunnel');
            }
        });
        context.globalState.update(noticeKey, true);
    }

    // Auto-start the server on activation (UI will manage tunnel state)
    (async () => {
        try {
            await webviewProvider.startServer();
        } catch (err) {
            console.warn('Auto-start server failed:', err);
        }
    })();
}

export function deactivate() {
    // Extension cleanup - subscriptions are automatically disposed by VSCode
    console.log('Basic VSCode Extension deactivated');
    
    // Ensure proper cleanup of server resources
    // Note: webviewProvider is not accessible here, but the ServerManager
    // will be disposed when the webviewProvider is disposed by VSCode
}