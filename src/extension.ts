// Main extension entry point
import * as vscode from 'vscode';
import { WebviewProvider } from './webview/provider';
import { registerButtonCommands } from './commands/buttonCommands';

export function activate(context: vscode.ExtensionContext) {
    console.log('Basic VSCode Extension is now active!');

    // Register webview provider for extension view
    const webviewProvider = new WebviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WebviewProvider.viewType,
            webviewProvider
        )
    );

    // Register commands for button functionality
    registerButtonCommands(context);

    console.log('Basic VSCode Extension registration complete');
}

export function deactivate() {
    // Extension cleanup - subscriptions are automatically disposed by VSCode
    console.log('Basic VSCode Extension deactivated');
}