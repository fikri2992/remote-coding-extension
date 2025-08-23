// Webview provider class
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'basicExtensionView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

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
                    default:
                        console.log('Unknown message received from webview:', message);
                        break;
                }
            },
            undefined,
            []
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Read the HTML file from the webview directory
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'panel.html');
        
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
}