import { TunnelStatus } from './LocalTunnel';

/**
 * Configuration interface for the web automation server
 */
export interface ServerConfig {
    /** HTTP server port */
    httpPort: number;
    /** WebSocket server port (optional, defaults to httpPort + 1) */
    websocketPort?: number;
    /** Optional Cloudflare named tunnel to use (fallback to quick tunnel if omitted) */
    tunnelName?: string;
    /** Optional Cloudflare API token for authenticated tunnels */
    cloudflareToken?: string;
    /** Whether to auto-start Cloudflare tunnel when server starts */
    autoStartTunnel: boolean;
}

/**
 * Current status of the web automation server
 */
export interface ServerStatus {
    /** Whether the server is currently running */
    isRunning: boolean;
    /** HTTP server port (if running) */
    httpPort?: number;
    /** WebSocket server port (if running) */
    websocketPort?: number;
    /** Number of connected WebSocket clients */
    connectedClients: number;
    /** Server uptime in milliseconds */
    uptime?: number;
    /** Last error message (if any) */
    lastError?: string;
    /** Full server URL for web access */
    serverUrl?: string;
    /** Local URL of the browser web interface (React/Vue app) */
    webInterfaceUrl?: string;
    /** Publicly accessible URL if a tunnel is active */
    publicUrl?: string;
    /** Tunnel status if a tunnel is running */
    tunnelStatus?: TunnelStatus;
}

/**
 * WebSocket message protocol for client-server communication
 */
export interface WebSocketMessage {
    /** Message type for routing */
    type: 'command' | 'response' | 'broadcast' | 'status' | 'fileSystem' | 'prompt' | 'git' | 'config' | 'terminal';
    /** Unique identifier for request/response correlation */
    id?: string;
    /** VS Code command name to execute */
    command?: string;
    /** Arguments for the command */
    args?: any[];
    /** Message payload data */
    data?: any;
    /** Error information (if applicable) */
    error?: string;
}

/**
 * Enhanced WebSocket message with additional data payloads for new features
 */
export interface EnhancedWebSocketMessage extends WebSocketMessage {
    data?: {
        // Terminal-specific data
        terminalData?: TerminalMessageData;
        // Prompt-specific data
        promptData?: {
            operation?: string;
            content?: string;
            category?: string;
            tags?: string[];
            timestamp?: Date;
            promptId?: string;
            query?: string;
            days?: number;
        };
        
        // Git-specific data
        gitData?: {
            operation: 'status' | 'log' | 'diff' | 'branch' | 'commit' | 'push' | 'pull' | 'show';
            result?: any;
            path?: string;
            options?: any;
        };
        
        // File system data
        fileSystemData?: {
            operation: 'tree' | 'open' | 'watch' | 'create' | 'delete' | 'rename';
            path?: string;
            content?: any;
            options?: {
                format?: 'auto' | 'text' | 'binary';
                [key: string]: any;
            };
        };
        
        // Configuration data
        configData?: {
            operation?: string;
            key?: string;
            value?: any;
            schema?: any;
        };
        
        // Generic data for backward compatibility
        [key: string]: any;
    };
}

// Enhanced terminal message data
export interface TerminalMessageData {
    op: 'exec' | 'create' | 'input' | 'resize' | 'dispose' | 'keepalive' | 'list-sessions' | 'reconnect';
    sessionId?: string;
    command?: string;
    cwd?: string;
    cols?: number;
    rows?: number;
    data?: string;
    persistent?: boolean;
    availableProviders?: string[];
    sessions?: SessionInfo[];
}

export interface SessionInfo {
    sessionId: string;
    persistent: boolean;
    status: 'active' | 'idle' | 'disconnected';
    lastActivity: number;
    createdAt: number;
    availableProviders: string[];
}

/**
 * Client connection information
 */
export interface ClientConnection {
    /** Unique client identifier */
    id: string;
    /** Connection timestamp */
    connectedAt: Date;
    /** Last activity timestamp */
    lastActivity: Date;
    /** Client user agent string */
    userAgent?: string;
    /** Client IP address */
    ipAddress?: string;
}

/**
 * VS Code workspace state information
 */
export interface WorkspaceState {
    /** List of workspace folder paths */
    workspaceFolders: string[];
    /** Active editor information */
    activeEditor?: {
        fileName: string;
        language: string;
        lineCount: number;
        selection: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
    };
    /** List of open editor file paths */
    openEditors: string[];
    /** Recently accessed files */
    recentFiles: string[];
    /** Git repository state */
    gitState?: GitRepositoryState;
    /** File system tree structure */
    fileTree?: FileNode[];
}

/**
 * Git repository state information
 */
export interface GitRepositoryState {
    /** Current branch name */
    currentBranch: string;
    /** Repository status */
    status: {
        staged: string[];
        unstaged: string[];
        untracked: string[];
        conflicted: string[];
    };
    /** Recent commits */
    recentCommits: GitCommit[];
    /** Current diff information */
    currentDiff?: GitDiff[];
    /** Remote status */
    remoteStatus: {
        ahead: number;
        behind: number;
        remote: string;
    };
    /** Repository root path */
    repositoryRoot: string;
}

/**
 * Git commit information
 */
export interface GitCommit {
    /** Commit hash */
    hash: string;
    /** Commit message */
    message: string;
    /** Author information */
    author: string;
    /** Commit date */
    date: Date;
    /** Modified files */
    files: string[];
}

/**
 * Git diff information
 */
export interface GitDiff {
    /** File path */
    file: string;
    /** Change type */
    type: 'added' | 'modified' | 'deleted' | 'renamed';
    /** Number of additions */
    additions: number;
    /** Number of deletions */
    deletions: number;
    /** Diff content */
    content: string;
}

/**
 * File system node information
 */
export interface FileNode {
    /** File/directory name */
    name: string;
    /** Full path relative to workspace */
    path: string;
    /** Node type */
    type: 'file' | 'directory';
    /** File size (for files) */
    size?: number;
    /** Last modified date */
    modified?: Date;
    /** Child nodes (for directories) */
    children?: FileNode[];
    /** Whether directory is expanded */
    expanded?: boolean;
    /** File type icon */
    icon?: string;
    /** Programming language (for files) */
    language?: string;
}

/**
 * Prompt record for .remoterc management
 */
export interface PromptRecord {
    /** Unique identifier */
    id: string;
    /** Prompt content */
    content: string;
    /** Creation timestamp */
    timestamp: Date;
    /** Category/folder */
    category?: string;
    /** Tags for organization */
    tags: string[];
    /** File path in .remoterc */
    filePath: string;
    /** Whether marked as favorite */
    favorite: boolean;
    /** Number of times executed */
    executionCount: number;
    /** Last used timestamp */
    lastUsed?: Date;
}

/**
 * .remoterc folder structure
 */
export interface RemoteRCStructure {
    /** Prompts organized by date */
    prompts: {
        [date: string]: PromptRecord[];
    };
    /** Categories mapping */
    categories: {
        [category: string]: string[];
    };
    /** Configuration */
    config: {
        defaultCategory: string;
        autoSave: boolean;
        maxHistoryDays: number;
    };
}
