/**
 * Core interfaces for the Web Automation Tunnel server infrastructure
 */

/**
 * Configuration interface for the web automation server
 */
export interface ServerConfig {
    /** HTTP server port */
    httpPort: number;
    /** WebSocket server port (optional, defaults to httpPort + 1) */
    websocketPort?: number;
    /** Allowed origins for CORS and WebSocket connections */
    allowedOrigins: string[];
    /** Maximum number of concurrent connections */
    maxConnections: number;
    /** Enable CORS support */
    enableCors: boolean;
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
}

/**
 * WebSocket message protocol for client-server communication
 */
export interface WebSocketMessage {
    /** Message type for routing */
    type: 'command' | 'response' | 'broadcast' | 'status' | 'fileSystem' | 'prompt' | 'git' | 'config';
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
            operation: 'status' | 'log' | 'diff' | 'branch' | 'commit' | 'push' | 'pull';
            result?: any;
            path?: string;
            options?: any;
        };
        
        // File system data
        fileSystemData?: {
            operation: 'tree' | 'open' | 'watch' | 'create' | 'delete' | 'rename';
            path?: string;
            content?: any;
            options?: any;
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