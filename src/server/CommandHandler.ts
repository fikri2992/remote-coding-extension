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
 * State change event interface for incremental updates
 */
export interface StateChangeEvent {
    type: 'activeEditor' | 'documentChange' | 'workspaceFolders' | 'visibleEditors' | 'selection' | 'diagnostics';
    timestamp: Date;
    data: any;
    incremental?: boolean;
}

/**
 * Cached state for incremental updates
 */
interface CachedState {
    workspaceFolders: string[];
    activeEditorFileName: string | undefined;
    visibleEditors: string[];
    lastSelectionChange: Date | undefined;
}

/**
 * CommandHandler manages secure execution of VS Code commands and state collection
 */
export class CommandHandler {
    private _allowedCommands: Set<string>;
    private _stateChangeListeners: vscode.Disposable[] = [];
    private _cachedState: CachedState;
    private _stateChangeCallback?: (event: StateChangeEvent) => void;

    constructor() {
        this._allowedCommands = this.initializeAllowedCommands();
        this._cachedState = this.initializeCachedState();
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
            
            // File system operations
            'vscode.open',
            'vscode.workspace.getFileTree',
            'vscode.workspace.refreshFileTree',
            'vscode.workspace.getDirectoryContents',
            'vscode.workspace.createFile',
            'vscode.workspace.createDirectory',
            'vscode.workspace.deleteFile',
            'vscode.workspace.deleteDirectory',
            'vscode.workspace.renameFile',
            'vscode.workspace.moveFile',
            'vscode.workspace.copyFile',
            'vscode.workspace.readFile',
            'vscode.workspace.writeFile',
            'vscode.workspace.getFileStats',
            'vscode.workspace.searchFiles',
            'vscode.workspace.watchPath',
            'vscode.workspace.unwatchPath',
            'vscode.workspace.getWorkspaceInfo',
            'vscode.getCommands',
            
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
            'git.status',
            'git.log',
            'git.diff',
            'git.branch',
            'git.commit',
            'git.push',
            'git.pull',
            
            // Workspace operations
            'workbench.action.reloadWindow',
            'workbench.action.openSettings',
            'workbench.action.openKeybindings'
        ]);
    }

    /**
     * Initialize cached state for incremental updates
     */
    private initializeCachedState(): CachedState {
        return {
            workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [],
            activeEditorFileName: vscode.window.activeTextEditor?.document.fileName || undefined,
            visibleEditors: vscode.window.visibleTextEditors.map(e => e.document.fileName),
            lastSelectionChange: new Date()
        };
    }

    /**
     * Set up comprehensive listeners for VS Code state changes
     */
    private setupStateChangeListeners(): void {
        // Listen for active editor changes
        this._stateChangeListeners.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                const newFileName = editor?.document.fileName;
                const oldFileName = this._cachedState.activeEditorFileName;
                
                if (newFileName !== oldFileName) {
                    this._cachedState.activeEditorFileName = newFileName;
                    this.emitStateChange({
                        type: 'activeEditor',
                        timestamp: new Date(),
                        data: {
                            previous: oldFileName,
                            current: newFileName,
                            editorInfo: this.getActiveEditorInfo(editor)
                        },
                        incremental: true
                    });
                }
            })
        );

        // Listen for text document changes (throttled to avoid spam)
        let documentChangeTimeout: NodeJS.Timeout | undefined;
        this._stateChangeListeners.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document === vscode.window.activeTextEditor?.document) {
                    // Throttle document change events to every 500ms
                    if (documentChangeTimeout) {
                        clearTimeout(documentChangeTimeout);
                    }
                    
                    documentChangeTimeout = setTimeout(() => {
                        this.emitStateChange({
                            type: 'documentChange',
                            timestamp: new Date(),
                            data: {
                                fileName: event.document.fileName,
                                languageId: event.document.languageId,
                                lineCount: event.document.lineCount,
                                isDirty: event.document.isDirty,
                                changeCount: event.contentChanges.length
                            },
                            incremental: true
                        });
                    }, 500);
                }
            })
        );

        // Listen for workspace folder changes
        this._stateChangeListeners.push(
            vscode.workspace.onDidChangeWorkspaceFolders((event) => {
                const newFolders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
                const oldFolders = this._cachedState.workspaceFolders;
                
                this._cachedState.workspaceFolders = newFolders;
                
                this.emitStateChange({
                    type: 'workspaceFolders',
                    timestamp: new Date(),
                    data: {
                        added: event.added.map(f => f.uri.fsPath),
                        removed: event.removed.map(f => f.uri.fsPath),
                        current: newFolders,
                        previous: oldFolders
                    },
                    incremental: true
                });
            })
        );

        // Listen for visible editors changes
        this._stateChangeListeners.push(
            vscode.window.onDidChangeVisibleTextEditors((editors) => {
                const newEditors = editors.map(e => e.document.fileName);
                const oldEditors = this._cachedState.visibleEditors;
                
                // Only emit if there's an actual change
                if (JSON.stringify(newEditors.sort()) !== JSON.stringify(oldEditors.sort())) {
                    this._cachedState.visibleEditors = newEditors;
                    
                    this.emitStateChange({
                        type: 'visibleEditors',
                        timestamp: new Date(),
                        data: {
                            current: newEditors,
                            previous: oldEditors,
                            opened: newEditors.filter(e => !oldEditors.includes(e)),
                            closed: oldEditors.filter(e => !newEditors.includes(e))
                        },
                        incremental: true
                    });
                }
            })
        );

        // Listen for text editor selection changes (throttled)
        let selectionChangeTimeout: NodeJS.Timeout | undefined;
        this._stateChangeListeners.push(
            vscode.window.onDidChangeTextEditorSelection((event) => {
                // Throttle selection changes to avoid excessive updates
                if (selectionChangeTimeout) {
                    clearTimeout(selectionChangeTimeout);
                }
                
                selectionChangeTimeout = setTimeout(() => {
                    const now = new Date();
                    // Only emit if enough time has passed since last selection change
                    if (!this._cachedState.lastSelectionChange || 
                        now.getTime() - this._cachedState.lastSelectionChange.getTime() > 200) {
                        
                        this._cachedState.lastSelectionChange = now;
                        
                        this.emitStateChange({
                            type: 'selection',
                            timestamp: now,
                            data: {
                                fileName: event.textEditor.document.fileName,
                                selections: event.selections.map(sel => ({
                                    start: { line: sel.start.line, character: sel.start.character },
                                    end: { line: sel.end.line, character: sel.end.character },
                                    isEmpty: sel.isEmpty
                                })),
                                kind: event.kind
                            },
                            incremental: true
                        });
                    }
                }, 200);
            })
        );

        // Listen for diagnostic changes (errors, warnings, etc.)
        this._stateChangeListeners.push(
            vscode.languages.onDidChangeDiagnostics((event) => {
                // Only report diagnostics for currently open files to reduce noise
                const openFiles = vscode.window.visibleTextEditors.map(e => e.document.uri);
                const relevantUris = event.uris.filter(uri => 
                    openFiles.some(openUri => openUri.toString() === uri.toString())
                );
                
                if (relevantUris.length > 0) {
                    const diagnosticsData = relevantUris.map(uri => ({
                        file: uri.fsPath,
                        diagnostics: vscode.languages.getDiagnostics(uri).map(diag => ({
                            severity: diag.severity,
                            message: diag.message,
                            range: {
                                start: { line: diag.range.start.line, character: diag.range.start.character },
                                end: { line: diag.range.end.line, character: diag.range.end.character }
                            },
                            source: diag.source
                        }))
                    }));
                    
                    this.emitStateChange({
                        type: 'diagnostics',
                        timestamp: new Date(),
                        data: {
                            files: diagnosticsData
                        },
                        incremental: true
                    });
                }
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
     * Emit state change events with improved data structure
     */
    private emitStateChange(event: StateChangeEvent): void {
        console.log(`VS Code state change - ${event.type}:`, event.data);
        
        if (this._stateChangeCallback) {
            this._stateChangeCallback(event);
        }
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
     * Set the state change callback for WebSocket broadcasting
     */
    setStateChangeCallback(callback: (event: StateChangeEvent) => void): void {
        this._stateChangeCallback = callback;
    }

    /**
     * Get incremental state update since last check
     */
    getIncrementalStateUpdate(): Partial<WorkspaceState> | null {
        // This method can be used to get only changed parts of the state
        // For now, we rely on the event-driven approach, but this could be enhanced
        // to provide periodic state diffs
        return null;
    }

    /**
     * Force a full state broadcast (useful for new client connections)
     */
    broadcastFullState(): void {
        if (this._stateChangeCallback) {
            const fullState = this.getWorkspaceState();
            this._stateChangeCallback({
                type: 'activeEditor', // Use a generic type for full state
                timestamp: new Date(),
                data: {
                    fullState: true,
                    workspaceState: fullState
                },
                incremental: false
            });
        }
    }

    /**
     * Dispose of all event listeners
     */
    dispose(): void {
        this._stateChangeListeners.forEach(listener => listener.dispose());
        this._stateChangeListeners = [];
    }
}