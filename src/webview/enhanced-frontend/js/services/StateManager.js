/**
 * State Manager Service
 * Centralized state management for the enhanced web frontend
 */

export class StateManager {
    constructor() {
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
        
        // Debounced save function
        this.debouncedSave = this.debounce(this.saveState.bind(this), 1000);
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
     * Update a section of the state
     */
    updateState(section, updates) {
        if (!this.state[section]) {
            console.warn(`State section '${section}' does not exist`);
            return;
        }
        
        const previousState = { ...this.state[section] };
        
        // Deep merge updates
        this.state[section] = this.deepMerge(this.state[section], updates);
        
        // Notify subscribers
        this.notifySubscribers(section, this.state[section], previousState);
        
        // Auto-save if this section is persisted
        if (this.persistedKeys.includes(section)) {
            this.debouncedSave();
        }
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
     * Notify subscribers of state changes
     */
    notifySubscribers(section, newState, previousState) {
        const sectionSubscribers = this.subscribers.get(section);
        if (sectionSubscribers) {
            sectionSubscribers.forEach(callback => {
                try {
                    callback(newState, previousState);
                } catch (error) {
                    console.error(`Error in state subscriber for section '${section}':`, error);
                }
            });
        }
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
     * Add chat message
     */
    addChatMessage(message) {
        const messages = [...this.state.chat.messages, {
            id: this.generateId(),
            timestamp: new Date(),
            ...message
        }];
        
        this.updateChat({ messages });
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
     * Destroy the state manager
     */
    destroy() {
        // Save final state
        this.saveState();
        
        // Clear all subscribers
        this.subscribers.clear();
        
        // Clear state
        this.state = null;
    }
}