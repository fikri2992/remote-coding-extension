/**
 * ErrorHandler - Comprehensive error handling and recovery system
 */

import * as vscode from 'vscode';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
    NETWORK = 'network',
    CONFIGURATION = 'configuration',
    COMMAND_EXECUTION = 'command_execution',
    SERVER_STARTUP = 'server_startup',
    CLIENT_CONNECTION = 'client_connection',
    INTERNAL = 'internal'
}

/**
 * Structured error information
 */
export interface ErrorInfo {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: Date;
    context?: any;
    userMessage?: string;
    suggestedActions?: string[];
    recoverable: boolean;
}

/**
 * Error recovery strategy
 */
export interface RecoveryStrategy {
    canRecover: (error: ErrorInfo) => boolean;
    recover: (error: ErrorInfo, context?: any) => Promise<boolean>;
    description: string;
}

/**
 * Comprehensive error handler with recovery mechanisms
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
    private errorHistory: ErrorInfo[] = [];
    private maxHistorySize = 100;

    private constructor() {
        this.initializeRecoveryStrategies();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Initialize built-in recovery strategies
     */
    private initializeRecoveryStrategies(): void {
        // Port conflict recovery
        this.addRecoveryStrategy('port_conflict', {
            canRecover: (error) => error.code === 'EADDRINUSE',
            recover: async (error, context) => {
                if (context?.tryAlternativePort) {
                    return await context.tryAlternativePort();
                }
                return false;
            },
            description: 'Try alternative ports when the configured port is in use'
        });

        // Permission denied recovery
        this.addRecoveryStrategy('permission_denied', {
            canRecover: (error) => error.code === 'EACCES',
            recover: async (error, context) => {
                // For permission errors, we can suggest using a higher port number
                if (context?.useHigherPort) {
                    return await context.useHigherPort();
                }
                return false;
            },
            description: 'Use higher port numbers when permission is denied for low ports'
        });

        // WebSocket connection recovery
        this.addRecoveryStrategy('websocket_reconnect', {
            canRecover: (error) => error.category === ErrorCategory.CLIENT_CONNECTION,
            recover: async (error, context) => {
                if (context?.reconnectClient) {
                    return await context.reconnectClient();
                }
                return false;
            },
            description: 'Automatically reconnect WebSocket clients after connection loss'
        });

        // Configuration validation recovery
        this.addRecoveryStrategy('config_fallback', {
            canRecover: (error) => error.category === ErrorCategory.CONFIGURATION,
            recover: async (error, context) => {
                if (context?.useDefaultConfig) {
                    return await context.useDefaultConfig();
                }
                return false;
            },
            description: 'Fall back to default configuration when current config is invalid'
        });
    }

    /**
     * Handle an error with comprehensive processing and recovery
     */
    async handleError(
        error: Error | ErrorInfo,
        context?: any,
        attemptRecovery: boolean = true
    ): Promise<{ recovered: boolean; errorInfo: ErrorInfo }> {
        
        // Convert Error to ErrorInfo if needed
        const errorInfo = this.normalizeError(error);
        
        // Add to history
        this.addToHistory(errorInfo);
        
        // Log the error
        this.logError(errorInfo);
        
        // Show user notification if appropriate
        this.showUserNotification(errorInfo);
        
        // Attempt recovery if enabled
        let recovered = false;
        if (attemptRecovery && errorInfo.recoverable) {
            recovered = await this.attemptRecovery(errorInfo, context);
        }
        
        return { recovered, errorInfo };
    }

    /**
     * Normalize error to ErrorInfo structure
     */
    private normalizeError(error: Error | ErrorInfo): ErrorInfo {
        if (this.isErrorInfo(error)) {
            return error;
        }

        // Convert Node.js errors to structured format
        const nodeError = error as NodeJS.ErrnoException;
        
        return {
            code: nodeError.code || 'UNKNOWN_ERROR',
            message: error.message,
            category: this.categorizeError(nodeError),
            severity: this.determineSeverity(nodeError),
            timestamp: new Date(),
            context: {
                stack: error.stack,
                errno: nodeError.errno,
                syscall: nodeError.syscall,
                path: nodeError.path
            },
            userMessage: this.generateUserMessage(nodeError),
            suggestedActions: this.generateSuggestedActions(nodeError),
            recoverable: this.isRecoverable(nodeError)
        };
    }

    /**
     * Check if object is ErrorInfo
     */
    private isErrorInfo(obj: any): obj is ErrorInfo {
        return obj && typeof obj === 'object' && 'code' in obj && 'category' in obj;
    }

    /**
     * Categorize error based on error properties
     */
    private categorizeError(error: NodeJS.ErrnoException): ErrorCategory {
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES' || error.code === 'ECONNREFUSED') {
            return ErrorCategory.NETWORK;
        }
        if (error.code === 'ENOENT' || error.code === 'EISDIR') {
            return ErrorCategory.CONFIGURATION;
        }
        if (error.syscall === 'listen' || error.syscall === 'bind') {
            return ErrorCategory.SERVER_STARTUP;
        }
        return ErrorCategory.INTERNAL;
    }

    /**
     * Determine error severity
     */
    private determineSeverity(error: NodeJS.ErrnoException): ErrorSeverity {
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
            return ErrorSeverity.MEDIUM;
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return ErrorSeverity.LOW;
        }
        return ErrorSeverity.HIGH;
    }

    /**
     * Generate user-friendly error message
     */
    private generateUserMessage(error: NodeJS.ErrnoException): string {
        switch (error.code) {
            case 'EADDRINUSE':
                return `The port is already in use by another application. The server will try alternative ports automatically.`;
            case 'EACCES':
                return `Permission denied to bind to the port. Try using a port number above 1024, or run VS Code as administrator.`;
            case 'ECONNREFUSED':
                return `Connection refused. The server may not be running or may be blocked by a firewall.`;
            case 'ETIMEDOUT':
                return `Connection timed out. Check your network connection and firewall settings.`;
            case 'ENOENT':
                return `File or directory not found. Check the configuration paths.`;
            default:
                return `An unexpected error occurred: ${error.message}`;
        }
    }

    /**
     * Generate suggested actions for error resolution
     */
    private generateSuggestedActions(error: NodeJS.ErrnoException): string[] {
        const actions: string[] = [];
        
        switch (error.code) {
            case 'EADDRINUSE':
                actions.push('Wait for automatic port selection');
                actions.push('Manually configure a different port in settings');
                actions.push('Stop other applications using the port');
                break;
            case 'EACCES':
                actions.push('Use a port number above 1024');
                actions.push('Run VS Code as administrator (not recommended)');
                actions.push('Check system firewall settings');
                break;
            case 'ECONNREFUSED':
                actions.push('Restart the server');
                actions.push('Check firewall and antivirus settings');
                actions.push('Verify network connectivity');
                break;
            case 'ETIMEDOUT':
                actions.push('Check network connection');
                actions.push('Increase timeout settings');
                actions.push('Try connecting from localhost');
                break;
        }
        
        return actions;
    }

    /**
     * Determine if error is recoverable
     */
    private isRecoverable(error: NodeJS.ErrnoException): boolean {
        const recoverableCodes = ['EADDRINUSE', 'EACCES', 'ECONNREFUSED', 'ETIMEDOUT'];
        return recoverableCodes.includes(error.code || '');
    }

    /**
     * Attempt error recovery using registered strategies
     */
    private async attemptRecovery(errorInfo: ErrorInfo, context?: any): Promise<boolean> {
        for (const [name, strategy] of this.recoveryStrategies) {
            if (strategy.canRecover(errorInfo)) {
                try {
                    console.log(`Attempting recovery strategy: ${name}`);
                    const recovered = await strategy.recover(errorInfo, context);
                    if (recovered) {
                        console.log(`Recovery successful using strategy: ${name}`);
                        return true;
                    }
                } catch (recoveryError) {
                    console.error(`Recovery strategy ${name} failed:`, recoveryError);
                }
            }
        }
        return false;
    }

    /**
     * Log error with appropriate level
     */
    private logError(errorInfo: ErrorInfo): void {
        const logMessage = `[${errorInfo.category}] ${errorInfo.code}: ${errorInfo.message}`;
        
        switch (errorInfo.severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                console.error(logMessage, errorInfo);
                break;
            case ErrorSeverity.MEDIUM:
                console.warn(logMessage, errorInfo);
                break;
            case ErrorSeverity.LOW:
                console.log(logMessage, errorInfo);
                break;
        }
    }

    /**
     * Show user notification based on error severity
     */
    private showUserNotification(errorInfo: ErrorInfo): void {
        if (!errorInfo.userMessage) {
            return;
        }

        const message = errorInfo.userMessage;
        const actions = errorInfo.suggestedActions?.slice(0, 2) || []; // Limit to 2 actions

        switch (errorInfo.severity) {
            case ErrorSeverity.CRITICAL:
            case ErrorSeverity.HIGH:
                vscode.window.showErrorMessage(message, ...actions);
                break;
            case ErrorSeverity.MEDIUM:
                vscode.window.showWarningMessage(message, ...actions);
                break;
            case ErrorSeverity.LOW:
                // Only show information for recoverable low-severity errors
                if (errorInfo.recoverable) {
                    vscode.window.showInformationMessage(message);
                }
                break;
        }
    }

    /**
     * Add error to history
     */
    private addToHistory(errorInfo: ErrorInfo): void {
        this.errorHistory.unshift(errorInfo);
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
        }
    }

    /**
     * Add custom recovery strategy
     */
    addRecoveryStrategy(name: string, strategy: RecoveryStrategy): void {
        this.recoveryStrategies.set(name, strategy);
    }

    /**
     * Get error history
     */
    getErrorHistory(): ErrorInfo[] {
        return [...this.errorHistory];
    }

    /**
     * Get recent errors by category
     */
    getRecentErrorsByCategory(category: ErrorCategory, limit: number = 10): ErrorInfo[] {
        return this.errorHistory
            .filter(error => error.category === category)
            .slice(0, limit);
    }

    /**
     * Check if there are recurring errors
     */
    hasRecurringErrors(timeWindowMs: number = 60000): boolean {
        const now = new Date();
        const recentErrors = this.errorHistory.filter(
            error => now.getTime() - error.timestamp.getTime() < timeWindowMs
        );
        
        // Group by error code
        const errorCounts = new Map<string, number>();
        recentErrors.forEach(error => {
            const count = errorCounts.get(error.code) || 0;
            errorCounts.set(error.code, count + 1);
        });
        
        // Check if any error occurred more than 3 times
        return Array.from(errorCounts.values()).some(count => count > 3);
    }

    /**
     * Clear error history
     */
    clearHistory(): void {
        this.errorHistory = [];
    }

    /**
     * Create a structured error for specific scenarios
     */
    createError(
        code: string,
        message: string,
        category: ErrorCategory,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context?: any
    ): ErrorInfo {
        return {
            code,
            message,
            category,
            severity,
            timestamp: new Date(),
            context,
            userMessage: message,
            suggestedActions: [],
            recoverable: true
        };
    }
}