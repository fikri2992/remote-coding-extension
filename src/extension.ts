// Main extension entry point
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { WebviewProvider } from './webview/provider';
import { registerButtonCommands } from './commands/buttonCommands';
import { registerIntegrationTestCommand } from './integration-test';
import { registerDiagnosePtyCommand } from './commands/diagnosePTY';
import { SessionEngine } from './server/pseudo/SessionEngine';
import { KiroPseudoTerminal } from './server/pseudo/KiroPseudoTerminal';



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
    registerDiagnosePtyCommand(context);

    // Register server management commands
    const startServerCommand = vscode.commands.registerCommand('webAutomationTunnel.startServer', async () => {
        try {
            await webviewProvider.startServer();
            vscode.window.showInformationMessage('Web Automation Server started successfully');
            // Auto-open pseudo terminal if configured
            const cfg = vscode.workspace.getConfiguration('webAutomationTunnel');
            if (cfg.get<boolean>('terminal.autoOpenPseudoTerminal', false)) {
                try { await vscode.commands.executeCommand('webAutomationTunnel.openPseudoTerminal'); } catch {}
            }
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

    // Quick Start: Start server then quick tunnel
    const quickStartCommand = vscode.commands.registerCommand('webAutomationTunnel.quickStart', async () => {
        try {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Starting server and tunnel...' }, async (progress) => {
                const status = webviewProvider.serverManager.getServerStatus();
                if (!status.isRunning) {
                    progress.report({ message: 'Starting server...' });
                    await webviewProvider.startServer();
                }
                progress.report({ message: 'Starting quick tunnel...' });
                await webviewProvider.serverManager.startTunnel({} as any);
            });

            const t = webviewProvider.serverManager.getTunnelStatus();
            if (t?.publicUrl) {
                vscode.window.showInformationMessage(
                    `Tunnel ready: ${t.publicUrl}`,
                    'Open',
                    'Copy URL'
                ).then(action => {
                    if (action === 'Open') {
                        vscode.env.openExternal(vscode.Uri.parse(t.publicUrl!));
                    } else if (action === 'Copy URL') {
                        vscode.env.clipboard.writeText(t.publicUrl!);
                    }
                });
            } else {
                vscode.window.showInformationMessage('Server started. Tunnel starting...');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Quick Start failed: ${errorMessage}`);
        }
    });

    // Status bar item for quick actions
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.name = 'Web Automation Tunnel';
    statusBarItem.command = 'webAutomationTunnel.statusBarAction';

    const updateStatusBar = () => {
        const s = webviewProvider.serverManager.getServerStatus();
        const hasTunnel = !!s.publicUrl && !!s.tunnelStatus?.isRunning;
        if (hasTunnel) {
            statusBarItem.text = '$(globe) Tunnel';
            statusBarItem.tooltip = s.publicUrl;
        } else if (s.isRunning) {
            statusBarItem.text = '$(plug) Server';
            statusBarItem.tooltip = 'Server running. Click for actions.';
        } else {
            statusBarItem.text = '$(circle-slash) Server Off';
            statusBarItem.tooltip = 'Click to start server / tunnel';
        }
        statusBarItem.show();
    };

    updateStatusBar();
    const serverDisp = webviewProvider.serverManager.onServerStatusChanged(() => updateStatusBar());
    const tunnelDisp = webviewProvider.serverManager.onTunnelStatusChanged(() => updateStatusBar());

    const statusBarActionCommand = vscode.commands.registerCommand('webAutomationTunnel.statusBarAction', async () => {
        const s = webviewProvider.serverManager.getServerStatus();
        const actions: string[] = [];
        if (s.publicUrl && s.tunnelStatus?.isRunning) {
            actions.push('Open Public URL', 'Copy Public URL', 'Stop Tunnel');
        } else if (s.isRunning) {
            actions.push('Start Quick Tunnel', 'Start Named Tunnel');
        } else {
            actions.push('Quick Start (Server + Quick Tunnel)', 'Start Server');
        }
        const choice = await vscode.window.showQuickPick(actions, { placeHolder: 'Web Automation Tunnel' });
        if (!choice) return;
        try {
            switch (choice) {
                case 'Open Public URL':
                    if (s.publicUrl) vscode.env.openExternal(vscode.Uri.parse(s.publicUrl));
                    break;
                case 'Copy Public URL':
                    if (s.publicUrl) await vscode.env.clipboard.writeText(s.publicUrl);
                    break;
                case 'Stop Tunnel':
                    await webviewProvider.serverManager.stopTunnel();
                    break;
                case 'Start Quick Tunnel':
                    await webviewProvider.serverManager.startTunnel({} as any);
                    break;
                case 'Start Named Tunnel':
                    vscode.commands.executeCommand('webAutomationTunnel.startTunnel');
                    break;
                case 'Quick Start (Server + Quick Tunnel)':
                    vscode.commands.executeCommand('webAutomationTunnel.quickStart');
                    break;
                case 'Start Server':
                    await webviewProvider.startServer();
                    break;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Action failed: ${msg}`);
        }
    });

    context.subscriptions.push(statusBarItem, serverDisp, tunnelDisp);

    // Pseudo Terminal command (Solution 1)
    const pseudoEngine = new SessionEngine();
    const openPseudoTerminal = vscode.commands.registerCommand('webAutomationTunnel.openPseudoTerminal', async () => {
        const sid = `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const cwd = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : process.cwd();
        const env = { ...process.env } as NodeJS.ProcessEnv;
        if (!env.TERM) (env as any).TERM = 'xterm-256color';
        // Read preferred engine for VS Code pseudo terminal as well
        const modeCfg = (vscode.workspace.getConfiguration('webAutomationTunnel').get<string>('terminal.engineMode', 'auto') || 'auto');
        const usePipe = modeCfg === 'pipe' || (process.env.KIRO_TERMINAL_ENGINE || '').toLowerCase() === 'pipe';
        const cfg = vscode.workspace.getConfiguration('webAutomationTunnel');
        const promptEnabled = cfg.get<boolean>('terminal.prompt.enabled', true) ?? true;
        const hiddenEchoEnabled = cfg.get<boolean>('terminal.hiddenEcho.enabled', true) ?? true;
        const pty = new KiroPseudoTerminal(pseudoEngine, sid, { cwd, env, mode: usePipe ? 'pipe' : 'line', interceptClear: true, promptEnabled, hiddenEchoEnabled });
        const terminal = vscode.window.createTerminal({ name: 'Kiro Pseudo Terminal', pty });
        terminal.show(true);
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
        tunnelStatusCommand,
        quickStartCommand,
        statusBarActionCommand,
        openPseudoTerminal
    );

    // Kiro Agent: Focus, Paste, Enter (for keyboard shortcut binding)
    const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));
    
    // Windows-only: send keystrokes via PowerShell (WScript.Shell)
    function sendKeysPS(keys: string) {
        if (process.platform !== 'win32') return; // no-op on non-Windows
        try {
            // PowerShell single-quote escaping: double single quotes inside '...'
            const safeKeys = keys.replace(/'/g, "''");
            // Use COM WScript.Shell SendKeys
            const psScript = `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${safeKeys}')`;
            const ps = spawn('powershell.exe', [
                '-NoProfile',
                '-WindowStyle','Hidden',
                '-STA', // SendKeys requires STA
                '-Command', psScript
            ], { detached: true, stdio: 'ignore' });
            ps.unref();
        } catch (e) {
            // Swallow errors; fallback path below will still try
        }
    }
    const kiroFocusPasteEnter = vscode.commands.registerCommand('kiroAgent.focusPasteEnter', async () => {
        try {
            try { await vscode.commands.executeCommand('kiroAgent.focusContinueInputWithoutClear'); } catch {}
            await sleep(300);
            try { await vscode.commands.executeCommand('editor.action.clipboardPasteAction'); } catch {}
            await sleep(150);
            // Experiment: try Enter via PowerShell SendKeys on Windows
            if (process.platform === 'win32') {
                console.log('Kiro Agent: using PowerShell SendKeys to send ENTER');
                sendKeysPS('{ENTER}');
                // Small delay to allow SendKeys to dispatch
                await sleep(120);
            } else {
                // Fallback for non-Windows
                await vscode.commands.executeCommand('type', { text: '\n' });
                await sleep(80);
                await vscode.commands.executeCommand('type', { text: '\r' });
            }
            vscode.window.showInformationMessage('Kiro Agent: Pasted and submitted.');
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Kiro Agent: Failed to paste/submit: ${msg}`);
        }
    });
    context.subscriptions.push(kiroFocusPasteEnter);

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

    // Auto-start the server on activation (UI will manage tunnel state) - DISABLED
    // (async () => {
    //     try {
    //         await webviewProvider.startServer();
    //     } catch (err) {
    //         console.warn('Auto-start server failed:', err);
    //     }
    // })();
}

export function deactivate() {
    // Extension cleanup - subscriptions are automatically disposed by VSCode
    console.log('Basic VSCode Extension deactivated');
    
    // Ensure proper cleanup of server resources
    // Note: webviewProvider is not accessible here, but the ServerManager
    // will be disposed when the webviewProvider is disposed by VSCode
}
