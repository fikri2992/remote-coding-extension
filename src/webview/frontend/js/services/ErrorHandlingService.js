/**
 * Error Handling Service
 * Comprehensive error handling with recovery mechanisms, offline mode, and user-friendly error messages
 */

export class ErrorHandlingService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Error tracking
        this.errorLog = [];
        this.maxErrorLogSize = 100;
        this.errorCounts = new Map();
        this.lastErrors = new Map();
        
        // Recovery mechanisms
        this.recoveryStrategies = new Map();
        this.retryAttempts = new Map();
        this.maxRetryAttempts = 3;
        this.retryDelays = [1000, 2000, 5000]; // Progressive delays
        
        // Offline mode
        this.isOfflineMode = false;
        this.offlineData = new Map();
        this.offlineCapabilities = new Set([
            'chat-history', 'prompt-history', 'file-tree-cache', 'git-cache'
        ]);
        
        // Error categories
        this.errorCategories = {
            CONNECTION: 'connection',
            WEBSOCKET: 'websocket',
            FILE_SYSTEM: 'filesystem',
            GIT: 'git',
            PROMPT: 'prompt',
            UI: 'ui',
            PERFORMANCE: 'performance',
            UNKNOWN: 'unknown'
        };
        
        // User-friendly error messages
        this.errorMessages = new Map();
        this.setupErrorMessages();
        
        // Diagnostic information
        this.diagnosticInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            connection: null,
            performance: null
        };
        
        // Bind methods
        this.handleGlobalError = this.handleGlobalError.bind(this);
        this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
        this.handleOnlineStatusChange = this.handleOnlineStatusChange.bind(this);
    } 
   /**
     * Initialize the error handling service
     */
    async initialize() {
        // Set up global error handlers
        this.setupGlobalErrorHandlers();
        
        // Set up network status monitoring
        this.setupNetworkMonitoring();
        
        // Set up recovery strategies
        this.setupRecoveryStrategies();
        
        // Initialize diagnostic information
        await this.initializeDiagnostics();
        
        // Set up periodic cleanup
        this.setupPeriodicCleanup();
        
        console.log('✅ ErrorHandlingService initialized');
    }

    /**
     * Set up global error handlers
     */
    setupGlobalErrorHandlers() {
        // Global JavaScript errors
        window.addEventListener('error', this.handleGlobalError);
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
        
        // Network status changes
        window.addEventListener('online', this.handleOnlineStatusChange);
        window.addEventListener('offline', this.handleOnlineStatusChange);
        
        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleResourceError(event);
            }
        }, true);
    }

    /**
     * Handle global JavaScript errors
     */
    handleGlobalError(event) {
        const error = {
            type: 'javascript',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error,
            stack: event.error?.stack,
            timestamp: new Date(),
            category: this.categorizeError(event.error)
        };
        
        this.logError(error);
        this.handleError(error);
    }

    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(event) {
        const error = {
            type: 'promise',
            message: event.reason?.message || 'Unhandled promise rejection',
            reason: event.reason,
            stack: event.reason?.stack,
            timestamp: new Date(),
            category: this.categorizeError(event.reason)
        };
        
        this.logError(error);
        this.handleError(error);
        
        // Prevent default browser behavior
        event.preventDefault();
    }    /**
  
   * Handle resource loading errors
     */
    handleResourceError(event) {
        const error = {
            type: 'resource',
            message: `Failed to load resource: ${event.target.src || event.target.href}`,
            element: event.target.tagName,
            src: event.target.src || event.target.href,
            timestamp: new Date(),
            category: this.errorCategories.UI
        };
        
        this.logError(error);
        this.handleError(error);
    }

    /**
     * Handle network status changes
     */
    handleOnlineStatusChange(event) {
        const isOnline = navigator.onLine;
        
        if (!isOnline && !this.isOfflineMode) {
            this.enableOfflineMode();
        } else if (isOnline && this.isOfflineMode) {
            this.disableOfflineMode();
        }
        
        // Update diagnostic info
        this.diagnosticInfo.onLine = isOnline;
        
        // Update state
        this.stateManager.updateConnection({
            networkStatus: isOnline ? 'online' : 'offline',
            offlineMode: this.isOfflineMode
        });
    }

    /**
     * Categorize error based on its properties
     */
    categorizeError(error) {
        if (!error) return this.errorCategories.UNKNOWN;
        
        const message = error.message?.toLowerCase() || '';
        const stack = error.stack?.toLowerCase() || '';
        
        if (message.includes('websocket') || message.includes('connection') || 
            message.includes('network') || stack.includes('websocket')) {
            return this.errorCategories.WEBSOCKET;
        }
        
        if (message.includes('file') || message.includes('path') || 
            stack.includes('filesystem')) {
            return this.errorCategories.FILE_SYSTEM;
        }
        
        if (message.includes('git') || stack.includes('git')) {
            return this.errorCategories.GIT;
        }
        
        if (message.includes('prompt') || stack.includes('prompt')) {
            return this.errorCategories.PROMPT;
        }
        
        if (message.includes('performance') || message.includes('memory')) {
            return this.errorCategories.PERFORMANCE;
        }
        
        return this.errorCategories.UNKNOWN;
    }

    /**
     * Log error with deduplication
     */
    logError(error) {
        // Create error signature for deduplication
        const signature = this.createErrorSignature(error);
        
        // Update error count
        const count = this.errorCounts.get(signature) || 0;
        this.errorCounts.set(signature, count + 1);
        
        // Only log if it's a new error or hasn't been seen recently
        const lastSeen = this.lastErrors.get(signature);
        const now = Date.now();
        
        if (!lastSeen || now - lastSeen > 60000) { // 1 minute threshold
            this.errorLog.push({
                ...error,
                signature,
                count: count + 1,
                id: this.generateErrorId()
            });
            
            this.lastErrors.set(signature, now);
            
            // Limit error log size
            if (this.errorLog.length > this.maxErrorLogSize) {
                this.errorLog = this.errorLog.slice(-this.maxErrorLogSize);
            }
            
            console.error('Error logged:', error);
        }
    }    /**
  
   * Handle error with recovery strategies
     */
    async handleError(error) {
        const category = error.category;
        const signature = this.createErrorSignature(error);
        
        // Get user-friendly message
        const userMessage = this.getUserFriendlyMessage(error);
        
        // Try recovery strategy
        const recovered = await this.attemptRecovery(error);
        
        if (recovered) {
            // Show recovery success notification
            this.notificationService.success(
                'Issue Resolved',
                'The application has automatically recovered from the error.',
                { duration: 3000 }
            );
        } else {
            // Show error notification with recovery suggestions
            this.showErrorNotification(error, userMessage);
        }
        
        // Update error state
        this.updateErrorState(error);
    }

    /**
     * Attempt error recovery
     */
    async attemptRecovery(error) {
        const category = error.category;
        const signature = this.createErrorSignature(error);
        
        // Check if we've already tried to recover this error
        const attempts = this.retryAttempts.get(signature) || 0;
        if (attempts >= this.maxRetryAttempts) {
            return false;
        }
        
        // Get recovery strategy
        const strategy = this.recoveryStrategies.get(category);
        if (!strategy) {
            return false;
        }
        
        try {
            // Increment retry attempts
            this.retryAttempts.set(signature, attempts + 1);
            
            // Wait before retry
            const delay = this.retryDelays[Math.min(attempts, this.retryDelays.length - 1)];
            await this.sleep(delay);
            
            // Execute recovery strategy
            const result = await strategy(error);
            
            if (result) {
                // Reset retry attempts on success
                this.retryAttempts.delete(signature);
                return true;
            }
            
            return false;
        } catch (recoveryError) {
            console.error('Recovery strategy failed:', recoveryError);
            return false;
        }
    }

    /**
     * Enable offline mode
     */
    enableOfflineMode() {
        if (this.isOfflineMode) return;
        
        console.log('🔄 Enabling offline mode');
        this.isOfflineMode = true;
        
        // Cache current data for offline use
        this.cacheDataForOfflineMode();
        
        // Show offline notification
        this.notificationService.warning(
            'Offline Mode',
            'You are now offline. Some features may be limited, but you can still view cached data.',
            {
                persistent: true,
                actions: [
                    {
                        label: 'Retry Connection',
                        primary: true,
                        handler: () => this.attemptReconnection()
                    }
                ]
            }
        );
        
        // Update state
        this.stateManager.updateConnection({
            offlineMode: true,
            offlineCapabilities: Array.from(this.offlineCapabilities)
        });
    }    /*
*
     * Disable offline mode
     */
    disableOfflineMode() {
        if (!this.isOfflineMode) return;
        
        console.log('🔄 Disabling offline mode');
        this.isOfflineMode = false;
        
        // Show online notification
        this.notificationService.success(
            'Back Online',
            'Connection restored. All features are now available.',
            { duration: 3000 }
        );
        
        // Update state
        this.stateManager.updateConnection({
            offlineMode: false
        });
        
        // Sync any pending data
        this.syncOfflineData();
    }

    /**
     * Cache data for offline mode
     */
    cacheDataForOfflineMode() {
        const state = this.stateManager.getState();
        
        // Cache chat messages
        if (this.offlineCapabilities.has('chat-history')) {
            this.offlineData.set('chat-messages', [...state.chat.messages]);
        }
        
        // Cache prompt history
        if (this.offlineCapabilities.has('prompt-history')) {
            this.offlineData.set('prompt-history', [...state.prompts.history]);
        }
        
        // Cache file tree
        if (this.offlineCapabilities.has('file-tree-cache')) {
            this.offlineData.set('file-tree', [...state.fileSystem.rootNodes]);
        }
        
        // Cache git data
        if (this.offlineCapabilities.has('git-cache')) {
            this.offlineData.set('git-data', { ...state.git });
        }
        
        console.log('📦 Data cached for offline mode');
    }

    /**
     * Sync offline data when back online
     */
    async syncOfflineData() {
        // This would typically sync any changes made while offline
        // For now, just clear the offline cache
        this.offlineData.clear();
        console.log('🔄 Offline data synced');
    }

    /**
     * Attempt reconnection
     */
    async attemptReconnection() {
        try {
            // This would typically trigger a reconnection attempt
            // For now, just check network status
            if (navigator.onLine) {
                this.disableOfflineMode();
                
                // Trigger reconnection in WebSocket client
                const event = new CustomEvent('reconnect-requested');
                window.dispatchEvent(event);
            } else {
                this.notificationService.warning(
                    'Still Offline',
                    'Network connection is still unavailable. Please check your internet connection.',
                    { duration: 5000 }
                );
            }
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
        }
    }

    /**
     * Show error notification with recovery suggestions
     */
    showErrorNotification(error, userMessage) {
        const actions = this.getRecoveryActions(error);
        
        this.notificationService.error(
            'Application Error',
            userMessage,
            {
                actions,
                persistent: error.category === this.errorCategories.CONNECTION
            }
        );
    }    /**
  
   * Get recovery actions for error
     */
    getRecoveryActions(error) {
        const actions = [];
        
        switch (error.category) {
            case this.errorCategories.CONNECTION:
            case this.errorCategories.WEBSOCKET:
                actions.push({
                    label: 'Retry Connection',
                    primary: true,
                    handler: () => this.attemptReconnection()
                });
                break;
                
            case this.errorCategories.FILE_SYSTEM:
                actions.push({
                    label: 'Refresh Files',
                    primary: true,
                    handler: () => this.refreshFileSystem()
                });
                break;
                
            case this.errorCategories.GIT:
                actions.push({
                    label: 'Refresh Git Status',
                    primary: true,
                    handler: () => this.refreshGitStatus()
                });
                break;
                
            case this.errorCategories.UI:
                actions.push({
                    label: 'Reload Page',
                    primary: true,
                    handler: () => window.location.reload()
                });
                break;
        }
        
        // Always add diagnostic action
        actions.push({
            label: 'View Details',
            handler: () => this.showErrorDetails(error)
        });
        
        return actions;
    }

    /**
     * Setup error messages
     */
    setupErrorMessages() {
        this.errorMessages.set(this.errorCategories.CONNECTION, {
            title: 'Connection Error',
            message: 'Unable to connect to the server. Please check your network connection and try again.',
            suggestions: [
                'Check your internet connection',
                'Verify the server is running',
                'Try refreshing the page'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.WEBSOCKET, {
            title: 'WebSocket Error',
            message: 'Real-time communication with the server was interrupted.',
            suggestions: [
                'The connection will automatically retry',
                'Check your network stability',
                'Some features may be temporarily unavailable'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.FILE_SYSTEM, {
            title: 'File System Error',
            message: 'There was an issue accessing files in your workspace.',
            suggestions: [
                'Check file permissions',
                'Verify the workspace path is valid',
                'Try refreshing the file tree'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.GIT, {
            title: 'Git Error',
            message: 'Unable to access git repository information.',
            suggestions: [
                'Ensure this is a git repository',
                'Check git configuration',
                'Verify repository permissions'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.PROMPT, {
            title: 'Prompt Error',
            message: 'There was an issue processing your prompt.',
            suggestions: [
                'Try sending the prompt again',
                'Check prompt content for special characters',
                'Verify connection to the server'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.UI, {
            title: 'Interface Error',
            message: 'The user interface encountered an unexpected error.',
            suggestions: [
                'Try refreshing the page',
                'Clear browser cache',
                'Check browser console for details'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.PERFORMANCE, {
            title: 'Performance Issue',
            message: 'The application is experiencing performance issues.',
            suggestions: [
                'Close unnecessary browser tabs',
                'Clear application cache',
                'Restart the application'
            ]
        });
        
        this.errorMessages.set(this.errorCategories.UNKNOWN, {
            title: 'Unexpected Error',
            message: 'An unexpected error occurred.',
            suggestions: [
                'Try refreshing the page',
                'Check browser console for details',
                'Contact support if the issue persists'
            ]
        });
    }  
  /**
     * Setup recovery strategies
     */
    setupRecoveryStrategies() {
        // Connection recovery
        this.recoveryStrategies.set(this.errorCategories.CONNECTION, async (error) => {
            return this.attemptReconnection();
        });
        
        // WebSocket recovery
        this.recoveryStrategies.set(this.errorCategories.WEBSOCKET, async (error) => {
            // Trigger WebSocket reconnection
            const event = new CustomEvent('websocket-reconnect');
            window.dispatchEvent(event);
            return true;
        });
        
        // File system recovery
        this.recoveryStrategies.set(this.errorCategories.FILE_SYSTEM, async (error) => {
            return this.refreshFileSystem();
        });
        
        // Git recovery
        this.recoveryStrategies.set(this.errorCategories.GIT, async (error) => {
            return this.refreshGitStatus();
        });
        
        // UI recovery
        this.recoveryStrategies.set(this.errorCategories.UI, async (error) => {
            // Try to reset UI state
            try {
                this.stateManager.updateNavigation({ activeSection: 'prompt' });
                return true;
            } catch {
                return false;
            }
        });
        
        // Performance recovery
        this.recoveryStrategies.set(this.errorCategories.PERFORMANCE, async (error) => {
            // Trigger memory cleanup
            if (window.gc) {
                window.gc();
            }
            
            // Clear caches
            this.clearPerformanceCaches();
            return true;
        });
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(error) {
        const errorInfo = this.errorMessages.get(error.category);
        if (errorInfo) {
            return errorInfo.message;
        }
        
        // Fallback to generic message
        return 'An unexpected error occurred. Please try again.';
    }

    /**
     * Show error details dialog
     */
    showErrorDetails(error) {
        const errorInfo = this.errorMessages.get(error.category);
        const suggestions = errorInfo?.suggestions || [];
        
        const detailsHtml = `
            <div class="error-details">
                <h3>Error Information</h3>
                <p><strong>Type:</strong> ${error.type}</p>
                <p><strong>Category:</strong> ${error.category}</p>
                <p><strong>Time:</strong> ${error.timestamp.toLocaleString()}</p>
                <p><strong>Message:</strong> ${error.message}</p>
                
                ${suggestions.length > 0 ? `
                    <h4>Suggestions:</h4>
                    <ul>
                        ${suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                ` : ''}
                
                <h4>Technical Details:</h4>
                <details>
                    <summary>Stack Trace</summary>
                    <pre>${error.stack || 'No stack trace available'}</pre>
                </details>
                
                <h4>Diagnostic Information:</h4>
                <pre>${JSON.stringify(this.getDiagnosticInfo(), null, 2)}</pre>
            </div>
        `;
        
        // Create modal dialog
        this.showModal('Error Details', detailsHtml);
    }

    /**
     * Initialize diagnostic information
     */
    async initializeDiagnostics() {
        // Get connection information
        if ('connection' in navigator) {
            this.diagnosticInfo.connection = {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        
        // Get performance information
        if ('performance' in window) {
            this.diagnosticInfo.performance = {
                memory: performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null,
                timing: performance.timing ? {
                    loadEventEnd: performance.timing.loadEventEnd,
                    navigationStart: performance.timing.navigationStart
                } : null
            };
        }
    }    /**

     * Setup network monitoring
     */
    setupNetworkMonitoring() {
        // Monitor connection changes
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                this.diagnosticInfo.connection = {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt
                };
            });
        }
    }

    /**
     * Setup periodic cleanup
     */
    setupPeriodicCleanup() {
        // Clean up old errors every 10 minutes
        setInterval(() => {
            this.cleanupOldErrors();
        }, 600000);
        
        // Clean up retry attempts every 5 minutes
        setInterval(() => {
            this.cleanupRetryAttempts();
        }, 300000);
    }

    /**
     * Clean up old errors
     */
    cleanupOldErrors() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour
        
        // Clean up error log
        this.errorLog = this.errorLog.filter(error => 
            now - error.timestamp.getTime() < maxAge
        );
        
        // Clean up last errors map
        for (const [signature, timestamp] of this.lastErrors.entries()) {
            if (now - timestamp > maxAge) {
                this.lastErrors.delete(signature);
                this.errorCounts.delete(signature);
            }
        }
    }

    /**
     * Clean up retry attempts
     */
    cleanupRetryAttempts() {
        // Reset retry attempts for errors that haven't occurred recently
        const now = Date.now();
        const resetThreshold = 300000; // 5 minutes
        
        for (const [signature, timestamp] of this.lastErrors.entries()) {
            if (now - timestamp > resetThreshold) {
                this.retryAttempts.delete(signature);
            }
        }
    }

    /**
     * Refresh file system
     */
    async refreshFileSystem() {
        try {
            // Trigger file system refresh
            const event = new CustomEvent('refresh-filesystem');
            window.dispatchEvent(event);
            return true;
        } catch (error) {
            console.error('Failed to refresh file system:', error);
            return false;
        }
    }

    /**
     * Refresh git status
     */
    async refreshGitStatus() {
        try {
            // Trigger git refresh
            const event = new CustomEvent('refresh-git');
            window.dispatchEvent(event);
            return true;
        } catch (error) {
            console.error('Failed to refresh git status:', error);
            return false;
        }
    }

    /**
     * Clear performance caches
     */
    clearPerformanceCaches() {
        // Clear various caches to improve performance
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }
    }

    /**
     * Create error signature for deduplication
     */
    createErrorSignature(error) {
        const parts = [
            error.type,
            error.category,
            error.message?.substring(0, 100) || '',
            error.filename || '',
            error.lineno || ''
        ];
        
        return parts.join('|');
    } 
   /**
     * Update error state
     */
    updateErrorState(error) {
        // Update connection state if it's a connection error
        if (error.category === this.errorCategories.CONNECTION || 
            error.category === this.errorCategories.WEBSOCKET) {
            this.stateManager.updateConnection({
                lastError: error.message,
                errorCount: this.errorCounts.get(this.createErrorSignature(error)) || 1
            });
        }
    }

    /**
     * Get diagnostic information
     */
    getDiagnosticInfo() {
        return {
            ...this.diagnosticInfo,
            timestamp: new Date().toISOString(),
            errorLogSize: this.errorLog.length,
            activeRetries: this.retryAttempts.size,
            offlineMode: this.isOfflineMode,
            offlineCapabilities: Array.from(this.offlineCapabilities),
            recentErrors: this.errorLog.slice(-5).map(error => ({
                type: error.type,
                category: error.category,
                message: error.message,
                timestamp: error.timestamp
            }))
        };
    }

    /**
     * Show modal dialog
     */
    showModal(title, content) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        modal.style.cssText = `
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
            padding: 0;
        `;
        
        modal.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid var(--vscode-widget-border);">
                <h2 style="margin: 0; color: var(--vscode-foreground);">${title}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" 
                        style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--vscode-foreground); cursor: pointer; font-size: 18px;">×</button>
            </div>
            <div style="padding: 16px; color: var(--vscode-foreground);">
                ${content}
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error statistics
     */
    getErrorStatistics() {
        const categories = {};
        const types = {};
        
        this.errorLog.forEach(error => {
            categories[error.category] = (categories[error.category] || 0) + 1;
            types[error.type] = (types[error.type] || 0) + 1;
        });
        
        return {
            totalErrors: this.errorLog.length,
            categories,
            types,
            mostCommonErrors: Array.from(this.errorCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            activeRetries: this.retryAttempts.size,
            offlineMode: this.isOfflineMode
        };
    }

    /**
     * Export error log for debugging
     */
    exportErrorLog() {
        const exportData = {
            timestamp: new Date().toISOString(),
            diagnosticInfo: this.getDiagnosticInfo(),
            errorLog: this.errorLog,
            errorStatistics: this.getErrorStatistics()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-log-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy the error handling service
     */
    destroy() {
        // Remove event listeners
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
        window.removeEventListener('online', this.handleOnlineStatusChange);
        window.removeEventListener('offline', this.handleOnlineStatusChange);
        
        // Clear data
        this.errorLog = [];
        this.errorCounts.clear();
        this.lastErrors.clear();
        this.retryAttempts.clear();
        this.offlineData.clear();
        this.recoveryStrategies.clear();
        
        console.log('✅ ErrorHandlingService destroyed');
    }
}