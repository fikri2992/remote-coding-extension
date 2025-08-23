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
    type: 'command' | 'response' | 'broadcast' | 'status';
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
}