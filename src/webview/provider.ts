// Webview provider class - placeholder
import * as vscode from 'vscode';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'basicExtensionView';

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        // Webview implementation will be added in task 5
    }
}