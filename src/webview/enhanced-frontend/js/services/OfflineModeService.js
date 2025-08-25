/**
 * Offline Mode Service
 * Handles offline functionality with cached data display and synchronization
 */

export class OfflineModeService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Offline state
        this.isOfflineMode = false;
        this.offlineStartTime = null;
        this.lastSyncTime = null;
        
        // Cache management
        this.cache = new Map();
        this.cacheKeys = {
            CHAT_MESSAGES: 'chat-messages',
            PROMPT_HISTORY: 'prompt-history',
            FILE_TREE: 'file-tree',
            GIT_STATUS: 'git-status',
            GIT_COMMITS: 'git-commits',
            SERVER_INFO: 'server-info',
            USER_PREFERENCES: 'user-preferences'
        };
        
        // Offline capabilities
        this.offlineCapabilities = new Set([
            'view-chat-history',
            'browse-prompts',
            'view-file-tree',
            'view-git-history',
            'edit-preferences',
            'search-cached-data'
        ]);
        
        // Pending operations for sync
        this.pendingOperations = [];
        this.maxPendingOperations = 100;
        
        // Cache configuration
        this.cacheConfig = {
            maxChatMessages: 500,
            maxPromptHistory: 200,
            maxGitCommits: 100,
            maxFileNodes: 1000,
            cacheExpiry: 24 * 60 * 60 * 1000 // 24 hours
        };
        
        // Storage keys
        this.storageKeys = {
            OFFLINE_CACHE: 'enhanced-ui-offline-cache',
            PENDING_OPERATIONS: 'enhanced-ui-pending-operations',
            OFFLINE_CONFIG: 'enhanced-ui-offline-config'
        };
        
        // Bind methods
        this.handleNetworkChange = this.handleNetworkChange.bind(this);
        this.handleStateChange = this.handleStateChange.bind(this);
    }

    /**
     * Initialize the offline mode service
     */
    async initialize() {
        // Load cached data from storage
        await this.loadCachedData();
        
        // Load pending operations
        await this.loadPendingOperations();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up periodic cache updates
        this.setupPeriodicCaching();
        
        // Check initial network status
        this.handleNetworkChange();
        
        console.log('✅ OfflineModeService initialized');
    }    /
**
     * Set up event listeners
     */
    setupEventListeners() {
        // Network status changes
        window.addEventListener('online', this.handleNetworkChange);
        window.addEventListener('offline', this.handleNetworkChange);
        
        // Connection status changes
        window.addEventListener('websocket-connected', this.handleConnectionRestored.bind(this));
        window.addEventListener('websocket-disconnected', this.handleConnectionLost.bind(this));
        
        // State changes for caching
        this.stateManager.subscribe('chat', this.handleStateChange);
        this.stateManager.subscribe('prompts', this.handleStateChange);
        this.stateManager.subscribe('fileSystem', this.handleStateChange);
        this.stateManager.subscribe('git', this.handleStateChange);
        this.stateManager.subscribe('preferences', this.handleStateChange);
    }

    /**
     * Handle network status changes
     */
    handleNetworkChange() {
        const isOnline = navigator.onLine;
        
        if (!isOnline && !this.isOfflineMode) {
            this.enableOfflineMode();
        } else if (isOnline && this.isOfflineMode) {
            this.disableOfflineMode();
        }
    }

    /**
     * Handle connection restored
     */
    handleConnectionRestored() {
        if (this.isOfflineMode) {
            this.disableOfflineMode();
        }
    }

    /**
     * Handle connection lost
     */
    handleConnectionLost() {
        if (!this.isOfflineMode) {
            this.enableOfflineMode();
        }
    }

    /**
     * Handle state changes for caching
     */
    handleStateChange(newState, section) {
        if (!this.isOfflineMode) {
            // Cache the new state when online
            this.cacheStateSection(section, newState);
        }
    }

    /**
     * Enable offline mode
     */
    enableOfflineMode() {
        if (this.isOfflineMode) return;
        
        console.log('📴 Enabling offline mode');
        
        this.isOfflineMode = true;
        this.offlineStartTime = new Date();
        
        // Cache current state
        this.cacheCurrentState();
        
        // Update UI state
        this.stateManager.updateConnection({
            offlineMode: true,
            offlineStartTime: this.offlineStartTime,
            offlineCapabilities: Array.from(this.offlineCapabilities)
        });
        
        // Show offline notification
        this.notificationService.warning(
            'Offline Mode Active',
            'You are now offline. You can still view cached data and make changes that will sync when reconnected.',
            {
                persistent: true,
                actions: [
                    {
                        label: 'View Capabilities',
                        handler: () => this.showOfflineCapabilities()
                    },
                    {
                        label: 'Try Reconnect',
                        primary: true,
                        handler: () => this.attemptReconnection()
                    }
                ]
            }
        );
    }

    /**
     * Disable offline mode
     */
    async disableOfflineMode() {
        if (!this.isOfflineMode) return;
        
        console.log('🌐 Disabling offline mode');
        
        const offlineDuration = Date.now() - this.offlineStartTime.getTime();
        
        this.isOfflineMode = false;
        this.offlineStartTime = null;
        
        // Update UI state
        this.stateManager.updateConnection({
            offlineMode: false,
            offlineStartTime: null
        });
        
        // Sync pending operations
        await this.syncPendingOperations();
        
        // Show online notification
        this.notificationService.success(
            'Back Online',
            `Reconnected after ${this.formatDuration(offlineDuration)}. ${this.pendingOperations.length} operations synced.`,
            { duration: 5000 }
        );
        
        // Update last sync time
        this.lastSyncTime = new Date();
    }

    /**
     * Cache current state
     */
    cacheCurrentState() {
        const state = this.stateManager.getState();
        
        // Cache chat messages
        this.cacheStateSection(this.cacheKeys.CHAT_MESSAGES, state.chat);
        
        // Cache prompt history
        this.cacheStateSection(this.cacheKeys.PROMPT_HISTORY, state.prompts);
        
        // Cache file tree
        this.cacheStateSection(this.cacheKeys.FILE_TREE, state.fileSystem);
        
        // Cache git data
        this.cacheStateSection(this.cacheKeys.GIT_STATUS, state.git);
        
        // Cache preferences
        this.cacheStateSection(this.cacheKeys.USER_PREFERENCES, state.preferences);
        
        // Save to persistent storage
        this.saveCacheToStorage();
        
        console.log('💾 Current state cached for offline use');
    }    
/**
     * Cache a specific state section
     */
    cacheStateSection(key, data) {
        const cacheEntry = {
            data: this.sanitizeDataForCache(key, data),
            timestamp: new Date(),
            version: 1
        };
        
        this.cache.set(key, cacheEntry);
    }

    /**
     * Sanitize data for caching (remove large or unnecessary data)
     */
    sanitizeDataForCache(key, data) {
        const sanitized = JSON.parse(JSON.stringify(data));
        
        switch (key) {
            case this.cacheKeys.CHAT_MESSAGES:
                // Limit chat messages
                if (sanitized.messages && sanitized.messages.length > this.cacheConfig.maxChatMessages) {
                    sanitized.messages = sanitized.messages.slice(-this.cacheConfig.maxChatMessages);
                }
                break;
                
            case this.cacheKeys.PROMPT_HISTORY:
                // Limit prompt history
                if (sanitized.history && sanitized.history.length > this.cacheConfig.maxPromptHistory) {
                    sanitized.history = sanitized.history.slice(-this.cacheConfig.maxPromptHistory);
                }
                break;
                
            case this.cacheKeys.GIT_STATUS:
                // Limit git commits
                if (sanitized.recentCommits && sanitized.recentCommits.length > this.cacheConfig.maxGitCommits) {
                    sanitized.recentCommits = sanitized.recentCommits.slice(-this.cacheConfig.maxGitCommits);
                }
                break;
                
            case this.cacheKeys.FILE_TREE:
                // Limit file nodes (flatten and count)
                sanitized.rootNodes = this.limitFileNodes(sanitized.rootNodes, this.cacheConfig.maxFileNodes);
                break;
        }
        
        return sanitized;
    }

    /**
     * Limit file nodes recursively
     */
    limitFileNodes(nodes, maxNodes) {
        if (!Array.isArray(nodes)) return nodes;
        
        let nodeCount = 0;
        
        const limitNodes = (nodeArray) => {
            const result = [];
            
            for (const node of nodeArray) {
                if (nodeCount >= maxNodes) break;
                
                const limitedNode = { ...node };
                nodeCount++;
                
                if (node.children && Array.isArray(node.children)) {
                    limitedNode.children = limitNodes(node.children);
                }
                
                result.push(limitedNode);
            }
            
            return result;
        };
        
        return limitNodes(nodes);
    }

    /**
     * Get cached data
     */
    getCachedData(key) {
        const cacheEntry = this.cache.get(key);
        
        if (!cacheEntry) {
            return null;
        }
        
        // Check if cache is expired
        const age = Date.now() - cacheEntry.timestamp.getTime();
        if (age > this.cacheConfig.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        
        return cacheEntry.data;
    }

    /**
     * Add pending operation for sync
     */
    addPendingOperation(operation) {
        const pendingOp = {
            id: this.generateOperationId(),
            type: operation.type,
            data: operation.data,
            timestamp: new Date(),
            retries: 0,
            maxRetries: 3
        };
        
        this.pendingOperations.push(pendingOp);
        
        // Limit pending operations
        if (this.pendingOperations.length > this.maxPendingOperations) {
            this.pendingOperations = this.pendingOperations.slice(-this.maxPendingOperations);
        }
        
        // Save to storage
        this.savePendingOperationsToStorage();
        
        console.log('📝 Added pending operation:', pendingOp.type);
    }

    /**
     * Sync pending operations
     */
    async syncPendingOperations() {
        if (this.pendingOperations.length === 0) {
            return;
        }
        
        console.log(`🔄 Syncing ${this.pendingOperations.length} pending operations`);
        
        const operations = [...this.pendingOperations];
        const syncResults = {
            successful: 0,
            failed: 0,
            errors: []
        };
        
        for (const operation of operations) {
            try {
                const success = await this.syncOperation(operation);
                
                if (success) {
                    syncResults.successful++;
                    // Remove from pending operations
                    this.pendingOperations = this.pendingOperations.filter(op => op.id !== operation.id);
                } else {
                    syncResults.failed++;
                    operation.retries++;
                    
                    // Remove if max retries exceeded
                    if (operation.retries >= operation.maxRetries) {
                        this.pendingOperations = this.pendingOperations.filter(op => op.id !== operation.id);
                        syncResults.errors.push(`Operation ${operation.type} failed after ${operation.maxRetries} retries`);
                    }
                }
            } catch (error) {
                syncResults.failed++;
                syncResults.errors.push(`Operation ${operation.type} error: ${error.message}`);
                
                operation.retries++;
                if (operation.retries >= operation.maxRetries) {
                    this.pendingOperations = this.pendingOperations.filter(op => op.id !== operation.id);
                }
            }
        }
        
        // Save updated pending operations
        this.savePendingOperationsToStorage();
        
        // Show sync results if there were failures
        if (syncResults.failed > 0) {
            this.notificationService.warning(
                'Sync Issues',
                `${syncResults.successful} operations synced, ${syncResults.failed} failed.`,
                {
                    actions: [
                        {
                            label: 'View Details',
                            handler: () => this.showSyncErrors(syncResults.errors)
                        }
                    ]
                }
            );
        }
        
        console.log('✅ Sync completed:', syncResults);
    }   
 /**
     * Sync individual operation
     */
    async syncOperation(operation) {
        // This would typically send the operation to the server
        // For now, just simulate the sync
        
        switch (operation.type) {
            case 'prompt-save':
                // Sync saved prompt
                return this.syncPromptSave(operation.data);
                
            case 'preference-update':
                // Sync preference update
                return this.syncPreferenceUpdate(operation.data);
                
            case 'file-operation':
                // Sync file operation
                return this.syncFileOperation(operation.data);
                
            default:
                console.warn('Unknown operation type:', operation.type);
                return false;
        }
    }

    /**
     * Sync prompt save operation
     */
    async syncPromptSave(data) {
        try {
            // This would send the prompt to the server
            console.log('Syncing prompt save:', data);
            return true;
        } catch (error) {
            console.error('Failed to sync prompt save:', error);
            return false;
        }
    }

    /**
     * Sync preference update operation
     */
    async syncPreferenceUpdate(data) {
        try {
            // This would send preferences to the server
            console.log('Syncing preference update:', data);
            return true;
        } catch (error) {
            console.error('Failed to sync preference update:', error);
            return false;
        }
    }

    /**
     * Sync file operation
     */
    async syncFileOperation(data) {
        try {
            // This would send file operation to the server
            console.log('Syncing file operation:', data);
            return true;
        } catch (error) {
            console.error('Failed to sync file operation:', error);
            return false;
        }
    }

    /**
     * Show offline capabilities
     */
    showOfflineCapabilities() {
        const capabilities = Array.from(this.offlineCapabilities).map(cap => 
            cap.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        );
        
        const content = `
            <div class="offline-capabilities">
                <h3>Available Offline Features:</h3>
                <ul>
                    ${capabilities.map(cap => `<li>${cap}</li>`).join('')}
                </ul>
                <p><strong>Note:</strong> Changes made offline will be synchronized when connection is restored.</p>
                <p><strong>Cached Data:</strong> ${this.cache.size} sections cached</p>
                <p><strong>Pending Operations:</strong> ${this.pendingOperations.length} operations waiting to sync</p>
            </div>
        `;
        
        this.showModal('Offline Mode Capabilities', content);
    }

    /**
     * Show sync errors
     */
    showSyncErrors(errors) {
        const content = `
            <div class="sync-errors">
                <h3>Synchronization Errors:</h3>
                <ul>
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
                <p>These operations could not be synchronized and have been discarded.</p>
            </div>
        `;
        
        this.showModal('Sync Errors', content);
    }

    /**
     * Attempt reconnection
     */
    attemptReconnection() {
        // Trigger reconnection attempt
        const event = new CustomEvent('reconnect-requested');
        window.dispatchEvent(event);
    }

    /**
     * Setup periodic caching
     */
    setupPeriodicCaching() {
        // Cache state every 5 minutes when online
        setInterval(() => {
            if (!this.isOfflineMode) {
                this.cacheCurrentState();
            }
        }, 300000); // 5 minutes
        
        // Clean up expired cache every hour
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 3600000); // 1 hour
    }

    /**
     * Clean up expired cache entries
     */
    cleanupExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.cache.entries()) {
            const age = now - entry.timestamp.getTime();
            if (age > this.cacheConfig.cacheExpiry) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => {
            this.cache.delete(key);
        });
        
        if (expiredKeys.length > 0) {
            console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
            this.saveCacheToStorage();
        }
    }

    /**
     * Load cached data from storage
     */
    async loadCachedData() {
        try {
            const cachedData = localStorage.getItem(this.storageKeys.OFFLINE_CACHE);
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                
                // Restore cache entries
                for (const [key, entry] of Object.entries(parsed)) {
                    this.cache.set(key, {
                        ...entry,
                        timestamp: new Date(entry.timestamp)
                    });
                }
                
                console.log(`📦 Loaded ${this.cache.size} cached entries from storage`);
            }
        } catch (error) {
            console.warn('Failed to load cached data:', error);
        }
    }    /**

     * Save cache to storage
     */
    saveCacheToStorage() {
        try {
            const cacheData = {};
            
            for (const [key, entry] of this.cache.entries()) {
                cacheData[key] = entry;
            }
            
            localStorage.setItem(this.storageKeys.OFFLINE_CACHE, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Failed to save cache to storage:', error);
        }
    }

    /**
     * Load pending operations from storage
     */
    async loadPendingOperations() {
        try {
            const pendingData = localStorage.getItem(this.storageKeys.PENDING_OPERATIONS);
            if (pendingData) {
                const parsed = JSON.parse(pendingData);
                
                this.pendingOperations = parsed.map(op => ({
                    ...op,
                    timestamp: new Date(op.timestamp)
                }));
                
                console.log(`📝 Loaded ${this.pendingOperations.length} pending operations from storage`);
            }
        } catch (error) {
            console.warn('Failed to load pending operations:', error);
        }
    }

    /**
     * Save pending operations to storage
     */
    savePendingOperationsToStorage() {
        try {
            localStorage.setItem(this.storageKeys.PENDING_OPERATIONS, JSON.stringify(this.pendingOperations));
        } catch (error) {
            console.warn('Failed to save pending operations to storage:', error);
        }
    }

    /**
     * Format duration for display
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Generate operation ID
     */
    generateOperationId() {
        return `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
            <div style="padding: 16px; border-bottom: 1px solid var(--vscode-widget-border); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; color: var(--vscode-foreground);">${title}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" 
                        style="background: none; border: none; color: var(--vscode-foreground); cursor: pointer; font-size: 18px;">×</button>
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
     * Get offline mode statistics
     */
    getOfflineStatistics() {
        return {
            isOfflineMode: this.isOfflineMode,
            offlineStartTime: this.offlineStartTime,
            lastSyncTime: this.lastSyncTime,
            cachedSections: this.cache.size,
            pendingOperations: this.pendingOperations.length,
            offlineCapabilities: Array.from(this.offlineCapabilities),
            cacheConfig: { ...this.cacheConfig }
        };
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
        this.pendingOperations = [];
        
        // Clear from storage
        localStorage.removeItem(this.storageKeys.OFFLINE_CACHE);
        localStorage.removeItem(this.storageKeys.PENDING_OPERATIONS);
        
        console.log('🧹 All cached data cleared');
        
        this.notificationService.info(
            'Cache Cleared',
            'All offline cached data has been cleared.',
            { duration: 3000 }
        );
    }

    /**
     * Export offline data for debugging
     */
    exportOfflineData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            statistics: this.getOfflineStatistics(),
            cachedData: Object.fromEntries(this.cache.entries()),
            pendingOperations: this.pendingOperations
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `offline-data-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * Destroy the offline mode service
     */
    destroy() {
        // Save final state
        this.saveCacheToStorage();
        this.savePendingOperationsToStorage();
        
        // Remove event listeners
        window.removeEventListener('online', this.handleNetworkChange);
        window.removeEventListener('offline', this.handleNetworkChange);
        
        // Unsubscribe from state changes
        this.stateManager.unsubscribe('chat', this.handleStateChange);
        this.stateManager.unsubscribe('prompts', this.handleStateChange);
        this.stateManager.unsubscribe('fileSystem', this.handleStateChange);
        this.stateManager.unsubscribe('git', this.handleStateChange);
        this.stateManager.unsubscribe('preferences', this.handleStateChange);
        
        // Clear data
        this.cache.clear();
        this.pendingOperations = [];
        
        console.log('✅ OfflineModeService destroyed');
    }
}