/**
 * State Manager Service
 * Centralized state management for the enhanced web frontend
 */

import { PerformanceOptimizer, MemoryManager } from '../utils/PerformanceOptimizer.js';

export class StateManager {
    constructor() {
        // Performance optimizations
        this.optimizer = new PerformanceOptimizer();
        this.memoryManager = new MemoryManager({
            maxCacheSize: 100,
            cleanupInterval: 120000, // 2 minutes
            maxAge: 600000 // 10 minutes
        });
        this.state = {
            // Navigation state
            navigation: {
                activeSection: 'prompt',
                previousSection: null,
                sidebarCollapsed: false,
                sidebarOpen: false // For mobile
            },
            
            // Chat state
            chat: {
                messages: [],
                inputValue: '',
                isTyping: false,
                scrollPosition: 0,
                autoScroll: true
            },
            
            // Git state
            git: {
                currentBranch: null,
                status: {
                    staged: [],
                    unstaged: [],
                    untracked: [],
                    conflicted: []
                },
                recentCommits: [],
                currentDiff: [],
                remoteStatus: {
                    ahead: 0,
                    behind: 0,
                    remote: null
                }
            },
            
            // File system state
            fileSystem: {
                rootNodes: [],
                selectedFile: null,
                expandedPaths: new Set(),
                searchQuery: '',
                filteredNodes: []
            },
            
            // Connection state
            connection: {
                status: 'disconnected', // 'connected' | 'connecting' | 'disconnected'
                lastConnected: null,
                reconnectAttempts: 0,
                latency: null,
                serverInfo: {}
            },
            
            // UI preferences
            preferences: {
                theme: 'dark',
                fontSize: 13,
                compactMode: false,
                animations: true,
                sidebarCollapsed: false
            },
            
            // Prompt management
            prompts: {
                history: [],
                categories: {},
                favorites: [],
                searchQuery: '',
                selectedCategory: 'all'
            }
        };
        
        // Subscribers for state changes
        this.subscribers = new Map();
        
        // State persistence
        this.persistenceKey = 'enhanced-web-frontend-state';
        this.persistedKeys = ['preferences', 'navigation', 'prompts'];
        
        // State change batching
        this.pendingUpdates = new Map();
        this.updateBatchSize = 5;
        this.updateBatchTimeout = 100;

        // Performance metrics
        this.updateCount = 0;
        this.lastUpdateTime = 0;
        this.batchedUpdates = 0;
    }

    /**
     * Initialize the state manager
     */
    async initialize() {
        // Load persisted state
        await this.loadState();
        
        // Set up auto-save
        this.setupAutoSave();
        
        console.log('✅ StateManager initialized');
    }

    /**
     * Get the current state
     */
    getState() {
        return this.state;
    }

    /**
     * Get a specific part of the state
     */
    getStateSection(section) {
        return this.state[section];
    }

    /**
     * Update a section of the state with performance optimizations
     */
    updateState(section, updates) {
        if (!this.state[section]) {
            console.warn(`State section '${section}' does not exist`);
            return;
        }

        // Check if updates actually change the state
        const currentState = this.state[section];
        const hasChanges = this.hasStateChanges(currentState, updates);
        
        if (!hasChanges) {
            return; // No changes, skip update
        }

        // Batch updates for better performance
        this.batchStateUpdate(section, updates);
    }

    /**
     * Batch state updates for better performance
     */
    batchStateUpdate(section, updates) {
        // Add to pending updates
        if (!this.pendingUpdates.has(section)) {
            this.pendingUpdates.set(section, []);
        }
        
        this.pendingUpdates.get(section).push(updates);

        // Process batch if it's full or schedule processing
        if (this.pendingUpdates.get(section).length >= this.updateBatchSize) {
            this.processBatchUpdates(section);
        } else {
            this.scheduleBatchProcessing(section);
        }
    }

    /**
     * Schedule batch processing with debouncing
     */
    scheduleBatchProcessing(section) {
        this.optimizer.debounce(`state-batch-${section}`, () => {
            this.processBatchUpdates(section);
        }, this.updateBatchTimeout);
    }

    /**
     * Process batched state updates
     */
    processBatchUpdates(section) {
        const updates = this.pendingUpdates.get(section);
        if (!updates || updates.length === 0) return;

        // Clear pending updates
        this.pendingUpdates.set(section, []);

        // Merge all updates
        const mergedUpdates = updates.reduce((acc, update) => {
            return this.deepMerge(acc, update);
        }, {});

        // Apply the merged update
        this.applyStateUpdate(section, mergedUpdates);
        
        this.batchedUpdates++;
    }

    /**
     * Apply state update with caching and notifications
     */
    applyStateUpdate(section, updates) {
        const previousState = { ...this.state[section] };
        
        // Deep merge updates
        this.state[section] = this.deepMerge(this.state[section], updates);
        
        // Cache the state for quick access
        this.memoryManager.set(`state-${section}`, this.state[section]);
        
        // Notify subscribers with throttling
        this.optimizer.throttle(`notify-${section}`, () => {
            this.notifySubscribers(section, this.state[section], previousState);
        }, 50);
        
        // Auto-save if this section is persisted
        if (this.persistedKeys.includes(section)) {
            this.optimizer.debounce('state-save', () => this.saveState(), 1000);
        }

        this.updateCount++;
        this.lastUpdateTime = Date.now();
    }

    /**
     * Check if updates actually change the state
     */
    hasStateChanges(currentState, updates) {
        return !this.deepEqual(currentState, this.deepMerge(currentState, updates));
    }

    /**
     * Deep equality check for objects
     */
    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        
        if (obj1 == null || obj2 == null) return false;
        
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
            return obj1 === obj2;
        }
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!this.deepEqual(obj1[key], obj2[key])) return false;
        }
        
        return true;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(section, callback) {
        if (!this.subscribers.has(section)) {
            this.subscribers.set(section, new Set());
        }
        
        this.subscribers.get(section).add(callback);
        
        // Return unsubscribe function
        return () => {
            const sectionSubscribers = this.subscribers.get(section);
            if (sectionSubscribers) {
                sectionSubscribers.delete(callback);
            }
        };
    }

    /**
     * Unsubscribe from state changes
     */
    unsubscribe(section, callback) {
        const sectionSubscribers = this.subscribers.get(section);
        if (sectionSubscribers) {
            sectionSubscribers.delete(callback);
        }
    }

    /**
     * Notify subscribers of state changes with performance optimizations
     */
    notifySubscribers(section, newState, previousState) {
        const sectionSubscribers = this.subscribers.get(section);
        if (!sectionSubscribers || sectionSubscribers.size === 0) return;

        // Use RAF for smooth UI updates
        this.optimizer.requestAnimationFrame(`notify-${section}`, () => {
            sectionSubscribers.forEach(callback => {
                try {
                    callback(newState, previousState);
                } catch (error) {
                    console.error(`Error in state subscriber for section '${section}':`, error);
                }
            });
        });
    }

    // Convenience methods for common state updates

    /**
     * Update navigation state
     */
    updateNavigation(updates) {
        this.updateState('navigation', updates);
    }

    /**
     * Update chat state
     */
    updateChat(updates) {
        this.updateState('chat', updates);
    }

    /**
     * Add chat message with performance optimizations
     */
    addChatMessage(message) {
        const newMessage = {
            id: this.generateId(),
            timestamp: new Date(),
            ...message
        };

        // Cache the message for quick access
        this.memoryManager.set(`msg-${newMessage.id}`, newMessage);

        // Batch message additions for better performance
        this.optimizer.debounce('add-chat-message', () => {
            const messages = [...this.state.chat.messages, newMessage];
            this.updateChat({ messages });
        }, 50);
    }

    /**
     * Add multiple chat messages in batch
     */
    addChatMessageBatch(messages) {
        const newMessages = messages.map(message => ({
            id: this.generateId(),
            timestamp: new Date(),
            ...message
        }));

        // Cache all messages
        newMessages.forEach(msg => {
            this.memoryManager.set(`msg-${msg.id}`, msg);
        });

        // Update state once for all messages
        this.optimizer.requestAnimationFrame('batch-chat-messages', () => {
            const allMessages = [...this.state.chat.messages, ...newMessages];
            this.updateChat({ messages: allMessages });
        });
    }

    /**
     * Update git state
     */
    updateGit(updates) {
        this.updateState('git', updates);
    }

    /**
     * Update file system state
     */
    updateFileSystem(updates) {
        this.updateState('fileSystem', updates);
    }

    /**
     * Update connection state
     */
    updateConnection(updates) {
        this.updateState('connection', updates);
    }

    /**
     * Update preferences
     */
    updatePreferences(updates) {
        this.updateState('preferences', updates);
    }

    /**
     * Update prompts state
     */
    updatePrompts(updates) {
        this.updateState('prompts', updates);
    }

    /**
     * Add prompt to history
     */
    addPromptToHistory(prompt) {
        const history = [...this.state.prompts.history, {
            id: this.generateId(),
            timestamp: new Date(),
            ...prompt
        }];
        
        this.updatePrompts({ history });
    }

    /**
     * Update prompt in history
     */
    updatePromptInHistory(promptId, updates) {
        const history = this.state.prompts.history.map(prompt => 
            prompt.id === promptId ? { ...prompt, ...updates } : prompt
        );
        
        this.updatePrompts({ history });
    }

    /**
     * Remove prompt from history
     */
    removePromptFromHistory(promptId) {
        const history = this.state.prompts.history.filter(prompt => prompt.id !== promptId);
        this.updatePrompts({ history });
    }

    /**
     * Add category
     */
    addPromptCategory(category) {
        const categories = {
            ...this.state.prompts.categories,
            [category.id]: category
        };
        
        this.updatePrompts({ categories });
    }

    /**
     * Update category
     */
    updatePromptCategory(categoryId, updates) {
        const categories = {
            ...this.state.prompts.categories,
            [categoryId]: {
                ...this.state.prompts.categories[categoryId],
                ...updates
            }
        };
        
        this.updatePrompts({ categories });
    }

    /**
     * Remove category
     */
    removePromptCategory(categoryId) {
        const categories = { ...this.state.prompts.categories };
        delete categories[categoryId];
        
        this.updatePrompts({ categories });
    }

    // Getter methods for common state access

    getCurrentSection() {
        return this.state.navigation.activeSection;
    }

    isConnected() {
        return this.state.connection.status === 'connected';
    }

    getChatMessages() {
        return this.state.chat.messages;
    }

    getGitStatus() {
        return this.state.git;
    }

    getFileSystemState() {
        return this.state.fileSystem;
    }

    getPreferences() {
        return this.state.preferences;
    }

    getPromptHistory() {
        return this.state.prompts.history;
    }

    /**
     * Refresh state from server
     */
    async refreshState() {
        // This would typically make API calls to refresh state
        // For now, just emit a refresh event
        this.notifySubscribers('refresh', {}, {});
    }

    /**
     * Load state from localStorage
     */
    async loadState() {
        try {
            const savedState = localStorage.getItem(this.persistenceKey);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                
                // Only restore persisted sections
                this.persistedKeys.forEach(key => {
                    if (parsedState[key]) {
                        this.state[key] = this.deepMerge(this.state[key], parsedState[key]);
                    }
                });
                
                // Convert Set objects back from arrays
                if (parsedState.fileSystem?.expandedPaths) {
                    this.state.fileSystem.expandedPaths = new Set(parsedState.fileSystem.expandedPaths);
                }
                
                console.log('✅ State loaded from localStorage');
            }
        } catch (error) {
            console.warn('Failed to load state from localStorage:', error);
        }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const stateToSave = {};
            
            // Only save persisted sections
            this.persistedKeys.forEach(key => {
                stateToSave[key] = this.state[key];
            });
            
            // Convert Set objects to arrays for JSON serialization
            if (stateToSave.fileSystem?.expandedPaths) {
                stateToSave.fileSystem.expandedPaths = Array.from(stateToSave.fileSystem.expandedPaths);
            }
            
            localStorage.setItem(this.persistenceKey, JSON.stringify(stateToSave));
        } catch (error) {
            console.warn('Failed to save state to localStorage:', error);
        }
    }

    /**
     * Set up auto-save for state changes
     */
    setupAutoSave() {
        // Save state when page is about to unload
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
        
        // Periodic save (every 30 seconds)
        setInterval(() => {
            this.saveState();
        }, 30000);
    }

    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get debug information
     */
    getDebugInfo() {
        return {
            stateKeys: Object.keys(this.state),
            subscriberCounts: Object.fromEntries(
                Array.from(this.subscribers.entries()).map(([key, set]) => [key, set.size])
            ),
            persistedKeys: this.persistedKeys,
            currentSection: this.getCurrentSection(),
            isConnected: this.isConnected()
        };
    }

    /**
     * Reset state to defaults
     */
    reset() {
        // Clear localStorage
        localStorage.removeItem(this.persistenceKey);
        
        // Reset to initial state
        this.state = {
            navigation: { activeSection: 'prompt', previousSection: null, sidebarCollapsed: false, sidebarOpen: false },
            chat: { messages: [], inputValue: '', isTyping: false, scrollPosition: 0, autoScroll: true },
            git: { currentBranch: null, status: { staged: [], unstaged: [], untracked: [], conflicted: [] }, recentCommits: [], currentDiff: [], remoteStatus: { ahead: 0, behind: 0, remote: null } },
            fileSystem: { rootNodes: [], selectedFile: null, expandedPaths: new Set(), searchQuery: '', filteredNodes: [] },
            connection: { status: 'disconnected', lastConnected: null, reconnectAttempts: 0, latency: null, serverInfo: {} },
            preferences: { theme: 'dark', fontSize: 13, compactMode: false, animations: true, sidebarCollapsed: false },
            prompts: { history: [], categories: {}, favorites: [], searchQuery: '', selectedCategory: 'all' }
        };
        
        // Notify all subscribers
        Object.keys(this.state).forEach(section => {
            this.notifySubscribers(section, this.state[section], {});
        });
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            updateCount: this.updateCount,
            batchedUpdates: this.batchedUpdates,
            lastUpdateTime: this.lastUpdateTime,
            pendingUpdates: this.pendingUpdates.size,
            subscriberCounts: Object.fromEntries(
                Array.from(this.subscribers.entries()).map(([key, set]) => [key, set.size])
            ),
            memoryStats: this.memoryManager.getStats(),
            optimizerMetrics: this.optimizer.getMetrics()
        };
    }

    /**
     * Perform memory cleanup for long-running sessions
     */
    performMemoryCleanup() {
        // Clean up old chat messages if there are too many
        const maxChatMessages = 500;
        if (this.state.chat.messages.length > maxChatMessages) {
            const messagesToKeep = this.state.chat.messages.slice(-maxChatMessages);
            this.updateChat({ messages: messagesToKeep });
            console.log(`Cleaned up ${this.state.chat.messages.length - maxChatMessages} old chat messages`);
        }

        // Clean up old prompt history
        const maxPromptHistory = 200;
        if (this.state.prompts.history.length > maxPromptHistory) {
            const promptsToKeep = this.state.prompts.history.slice(-maxPromptHistory);
            this.updatePrompts({ history: promptsToKeep });
            console.log(`Cleaned up ${this.state.prompts.history.length - maxPromptHistory} old prompts`);
        }

        // Clean up old git commits
        const maxGitCommits = 100;
        if (this.state.git.recentCommits.length > maxGitCommits) {
            const commitsToKeep = this.state.git.recentCommits.slice(-maxGitCommits);
            this.updateGit({ recentCommits: commitsToKeep });
            console.log(`Cleaned up ${this.state.git.recentCommits.length - maxGitCommits} old commits`);
        }

        console.log('State manager memory cleanup completed');
    }

    /**
     * Optimize state for performance
     */
    optimizeState() {
        // Remove duplicate messages
        const uniqueMessages = this.state.chat.messages.filter((message, index, array) => 
            array.findIndex(m => m.id === message.id) === index
        );
        
        if (uniqueMessages.length !== this.state.chat.messages.length) {
            this.updateChat({ messages: uniqueMessages });
            console.log(`Removed ${this.state.chat.messages.length - uniqueMessages.length} duplicate messages`);
        }

        // Remove duplicate prompts
        const uniquePrompts = this.state.prompts.history.filter((prompt, index, array) => 
            array.findIndex(p => p.id === prompt.id) === index
        );
        
        if (uniquePrompts.length !== this.state.prompts.history.length) {
            this.updatePrompts({ history: uniquePrompts });
            console.log(`Removed ${this.state.prompts.history.length - uniquePrompts.length} duplicate prompts`);
        }

        // Compact file system expanded paths
        const validPaths = new Set();
        const checkPath = (nodes, parentPath = '') => {
            nodes.forEach(node => {
                const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
                if (node.type === 'directory') {
                    validPaths.add(fullPath);
                    if (node.children) {
                        checkPath(node.children, fullPath);
                    }
                }
            });
        };
        
        checkPath(this.state.fileSystem.rootNodes);
        
        const validExpandedPaths = new Set(
            Array.from(this.state.fileSystem.expandedPaths).filter(path => validPaths.has(path))
        );
        
        if (validExpandedPaths.size !== this.state.fileSystem.expandedPaths.size) {
            this.updateFileSystem({ expandedPaths: validExpandedPaths });
            console.log(`Cleaned up ${this.state.fileSystem.expandedPaths.size - validExpandedPaths.size} invalid expanded paths`);
        }
    }

    /**
     * Start periodic optimization
     */
    startPeriodicOptimization() {
        // Run cleanup every 5 minutes
        setInterval(() => {
            this.performMemoryCleanup();
        }, 300000);

        // Run optimization every 10 minutes
        setInterval(() => {
            this.optimizeState();
        }, 600000);
    }

    /**
     * Enhanced initialization with performance monitoring
     */
    async initialize() {
        // Load persisted state
        await this.loadState();
        
        // Set up auto-save
        this.setupAutoSave();
        
        // Start periodic optimization
        this.startPeriodicOptimization();
        
        console.log('✅ StateManager initialized with performance optimizations');
    }

    /**
     * Destroy the state manager
     */
    destroy() {
        // Save final state
        this.saveState();
        
        // Cleanup performance optimizers
        this.optimizer.cleanup();
        this.memoryManager.destroy();
        
        // Clear pending updates
        this.pendingUpdates.clear();
        
        // Clear all subscribers
        this.subscribers.clear();
        
        // Clear state
        this.state = null;
    }
}