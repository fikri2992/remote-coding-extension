/**
 * CommandHandler - Executes VS Code commands and manages state synchronization
 */

import * as vscode from 'vscode';
import { WebSocketMessage, WorkspaceState } from './interfaces';

/**
 * Command execution result interface
 */
export interface CommandResult {
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Command validation result interface
 */
export interface CommandValidation {
    isValid: boolean;
    reason?: string;
}

/**
 * CommandHandler manages secure execution of VS Code commands and state collection
 */
export class CommandHandler {
    private _allowedCommands: Set<string>;
    private _stateChangeListeners: vscode.Disposable[] = [];

    constructor() {
        this._allowedCommands = this.initializeAllowedCommands();
        this.setupStateChangeListeners();
    }

    /**
     * Initialize the whitelist of allowed VS Code commands for security
     */
    private initializeAllowedCommands(): Set<string> {
        return new Set([
            // File operations
            'workbench.action.files.newUntitledFile',
            'workbench.action.files.openFile',
            'workbench.action.files.openFolder',
            'workbench.action.files.save',
            'workbench.action.files.saveAll',
            'workbench.action.closeActiveEditor',
            'workbench.action.closeAllEditors',
            
            // Editor operations
            'editor.action.selectAll',
            'editor.action.copyLinesDownAction',
            'editor.action.copyLinesUpAction',
            'editor.action.moveLinesDownAction',
            'editor.action.moveLinesUpAction',
            'editor.action.deleteLines',
            'editor.action.insertLineAfter',
            'editor.action.insertLineBefore',
            'editor.action.commentLine',
            'editor.action.blockComment',
            'editor.action.formatDocument',
            'editor.action.formatSelection',
            
            // Navigation
            'workbench.action.navigateBack',
            'workbench.action.navigateForward',
            'workbench.action.gotoLine',
            'workbench.action.quickOpen',
            'workbench.action.showCommands',
            
            // View operations
            'workbench.action.toggleSidebarVisibility',
            'workbench.action.togglePanel',
            'workbench.action.toggleActivityBar',
            'workbench.action.toggleStatusBar',
            'workbench.view.explorer',
            'workbench.view.search',
            'workbench.view.scm',
            'workbench.view.debug',
            'workbench.view.extensions',
            
            // Terminal operations
            'workbench.action.terminal.new',
            'workbench.action.terminal.toggleTerminal',
            'workbench.action.terminal.clear',
            
            // Search operations
            'workbench.action.findInFiles',
            'workbench.action.replaceInFiles',
            'actions.find',
            'editor.action.startFindReplaceAction',
            
            // Git operations (basic)
            'git.refresh',
            'git.openChange',
            'git.stage',
            'git.unstage',
            
            // Workspace operations
            'workbench.action.reloadWindow',
            'workbench.action.openSettings',
            'workbench.action.openKeybindings'
        ]);
    }

    /**
     * Set up listeners for VS Code state changes
     */
    private setupStateChangeListeners(): void {
        // Listen for active editor changes
        this._stateChangeListeners.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                this.onStateChange('activeEditor', this.getActiveEditorInfo(editor));
            })
        );

        // Listen for text document changes
        this._stateChangeListeners.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
                    this.onStateChange('documentChange', {
                        fileName: event.document.fileName,
                        changes: event.contentChanges.length
                    });
                }
            })
        );

        // Listen for workspace folder changes
        this._stateChangeListeners.push(
            vscode.workspace.onDidChangeWorkspaceFolders((event) => {
                this.onStateChange('workspaceFolders', {
                    added: event.added.map(f => f.uri.fsPath),
                    removed: event.removed.map(f => f.uri.fsPath)
                });
            })
        );

        // Listen for visible editors changes
        this._stateChangeListeners.push(
            vscode.window.onDidChangeVisibleTextEditors((editors) => {
                this.onStateChange('visibleEditors', 
                    editors.map(e => e.document.fileName)
                );
            })
        );
    }

    /**
     * Execute a VS Code command with validation and error handling
     */
    async executeCommand(command: string, args?: any[]): Promise<CommandResult> {
        try {
            // Validate command
            const validation = this.validateCommand(command);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Command validation failed: ${validation.reason}`
                };
            }

            // Execute the command
            const result = await vscode.commands.executeCommand(command, ...(args || []));
            
            return {
                success: true,
                data: result
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error(`Command execution failed for '${command}':`, error);
            
            return {
                success: false,
                error: `Command execution failed: ${errorMessage}`
            };
        }
    }

    /**
     * Validate if a command is allowed to be executed
     */
    validateCommand(command: string): CommandValidation {
        if (!command || typeof command !== 'string') {
            return {
                isValid: false,
                reason: 'Command must be a non-empty string'
            };
        }

        if (!this._allowedCommands.has(command)) {
            return {
                isValid: false,
                reason: `Command '${command}' is not in the allowed commands whitelist`
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * Get current VS Code workspace state
     */
    getWorkspaceState(): WorkspaceState {
        const workspaceFolders = vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || [];
        const activeEditor = this.getActiveEditorInfo(vscode.window.activeTextEditor);
        const openEditors = vscode.window.visibleTextEditors.map(editor => editor.document.fileName);
        
        // Get recently opened files from VS Code's recent files
        const recentFiles = this.getRecentFiles();

        const state: WorkspaceState = {
            workspaceFolders,
            openEditors,
            recentFiles
        };

        if (activeEditor) {
            state.activeEditor = activeEditor;
        }

        return state;
    }

    /**
     * Get active editor information
     */
    private getActiveEditorInfo(editor?: vscode.TextEditor): WorkspaceState['activeEditor'] {
        if (!editor) {
            return undefined;
        }

        const document = editor.document;
        const selection = editor.selection;

        return {
            fileName: document.fileName,
            language: document.languageId,
            lineCount: document.lineCount,
            selection: {
                start: {
                    line: selection.start.line,
                    character: selection.start.character
                },
                end: {
                    line: selection.end.line,
                    character: selection.end.character
                }
            }
        };
    }

    /**
     * Get recently opened files (simplified implementation)
     */
    private getRecentFiles(): string[] {
        // VS Code doesn't provide direct API access to recent files
        // This is a simplified implementation that returns currently open editors
        // In a real implementation, you might want to maintain your own recent files list
        return vscode.window.visibleTextEditors
            .map(editor => editor.document.fileName)
            .filter((fileName, index, array) => array.indexOf(fileName) === index) // Remove duplicates
            .slice(0, 10); // Limit to 10 recent files
    }

    /**
     * Handle state change events (to be connected to WebSocket broadcasting)
     */
    private onStateChange(changeType: string, data: any): void {
        // This method will be called when VS Code state changes
        // The ServerManager or WebSocketServer can subscribe to these events
        // For now, we'll just log the changes
        console.log(`VS Code state change - ${changeType}:`, data);
    }

    /**
     * Get list of allowed commands
     */
    getAllowedCommands(): string[] {
        return Array.from(this._allowedCommands);
    }

    /**
     * Add a command to the allowed commands whitelist
     */
    addAllowedCommand(command: string): void {
        this._allowedCommands.add(command);
    }

    /**
     * Remove a command from the allowed commands whitelist
     */
    removeAllowedCommand(command: string): void {
        this._allowedCommands.delete(command);
    }

    /**
     * Set up a callback for state changes (for WebSocket broadcasting)
     */
    onStateChangeCallback?: (changeType: string, data: any) => void;

    /**
     * Set the state change callback
     */
    setStateChangeCallback(callback: (changeType: string, data: any) => void): void {
        this.onStateChangeCallback = callback;
        // Update the onStateChange method to use the callback
        this.onStateChange = (changeType: string, data: any) => {
            console.log(`VS Code state change - ${changeType}:`, data);
            if (this.onStateChangeCallback) {
                this.onStateChangeCallback(changeType, data);
            }
        };
    }

    /**
     * Dispose of all event listeners
     */
    dispose(): void {
        this._stateChangeListeners.forEach(listener => listener.dispose());
        this._stateChangeListeners = [];
    }
}