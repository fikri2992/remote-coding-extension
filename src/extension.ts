// Main extension entry point
import * as vscode from 'vscode';
import { WebviewProvider } from './webview/provider';
import { registerButtonCommands } from './commands/buttonCommands';
import { registerIntegrationTestCommand } from './integration-test';

export function activate(context: vscode.ExtensionContext) {
    console.log('Basic VSCode Extension is now active!');

    let webviewProvider: WebviewProvider;
    
    try {
        // Register webview provider for extension view
        webviewProvider = new WebviewProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                WebviewProvider.viewType,
                webviewProvider
            )
        );
    } catch (error) {
        console.error('Failed to register webview provider:', error);
        vscode.window.showErrorMessage('Failed to initialize Web Automation Tunnel extension');
        return;
    }

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

    context.subscriptions.push(
        startServerCommand, 
        stopServerCommand, 
        openConfigurationCommand, 
        resetConfigurationCommand,
        toggleUICommand
    );

    // Register integration test command
    registerIntegrationTestCommand(context);

    // Register diagnostic command
    const diagnosticCommand = vscode.commands.registerCommand('webAutomationTunnel.runDiagnostic', async () => {
        try {
            const status = webviewProvider.serverManager.getServerStatus();
            const clients = webviewProvider.serverManager.getConnectedClients();
            
            const diagnosticInfo = [
                `Extension Status: Active`,
                `Server Running: ${status.isRunning}`,
                `Connected Clients: ${status.connectedClients}`,
                `Last Error: ${status.lastError || 'None'}`,
                `HTTP Port: ${status.httpPort || 'Not set'}`,
                `WebSocket Port: ${status.websocketPort || 'Not set'}`,
                `Uptime: ${status.uptime ? Math.floor(status.uptime / 1000) + 's' : 'Not running'}`
            ].join('\n');
            
            vscode.window.showInformationMessage('Web Automation Tunnel Diagnostic', {
                modal: true,
                detail: diagnosticInfo
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Diagnostic failed: ${errorMessage}`);
        }
    });

    context.subscriptions.push(diagnosticCommand);

    console.log('Basic VSCode Extension registration complete');
}

export function deactivate() {
    // Extension cleanup - subscriptions are automatically disposed by VSCode
    console.log('Basic VSCode Extension deactivated');
    
    // Ensure proper cleanup of server resources
    // Note: webviewProvider is not accessible here, but the ServerManager
    // will be disposed when the webviewProvider is disposed by VSCode
}