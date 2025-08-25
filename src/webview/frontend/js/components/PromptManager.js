/**
 * PromptManager Component - Comprehensive prompt management with .remoterc persistence
 */

import { Component } from './base/Component.js';

export class PromptManager extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Prompt management state
        this.prompts = [];
        this.categories = new Map();
        this.favorites = new Set();
        this.templates = new Map();
        this.searchQuery = '';
        this.selectedCategory = 'all';

        // .remoterc configuration
        this.remoteRcPath = '.remoterc';
        this.promptsSubfolder = 'prompts';
        this.categoriesFile = 'categories.json';
        this.favoritesFile = 'favorites.json';
        this.templatesFile = 'templates.json';

        // Default categories
        this.defaultCategories = [
            { id: 'general', name: 'General', color: '#6366f1' },
            { id: 'coding', name: 'Coding', color: '#10b981' },
            { id: 'debugging', name: 'Debugging', color: '#f59e0b' },
            { id: 'documentation', name: 'Documentation', color: '#8b5cf6' }
        ];

        // Default templates
        this.defaultTemplates = [
            {
                id: 'code-review',
                name: 'Code Review',
                content: 'Please review this code for best practices and improvements:\n\n```\n[paste code here]\n```',
                category: 'coding',
                tags: ['review', 'code-quality']
            },
            {
                id: 'bug-fix',
                name: 'Bug Fix Request',
                content: 'I need help fixing this bug:\n\n**Expected:** [describe expected]\n**Actual:** [describe actual]\n**Code:**\n```\n[paste code]\n```',
                category: 'debugging',
                tags: ['bug', 'fix']
            }
        ];
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        await this.initializePromptSystem();
    }

    render() {
        this.element = this.createElement('div', {}, ['prompt-manager']);
        this.element.innerHTML = `
            <div class="prompt-manager-header">
                <h3>Prompt Manager</h3>
                <div class="header-actions">
                    <button class="btn btn-icon" id="searchToggleBtn" title="Search">🔍</button>
                    <button class="btn btn-icon" id="templatesBtn" title="Templates">📋</button>
                    <button class="btn btn-icon" id="refreshBtn" title="Refresh">🔄</button>
                </div>
            </div>
            <div class="prompt-manager-content">
                <div class="prompts-list" id="promptsList"></div>
                <div class="loading-indicator hidden" id="loadingIndicator">Loading...</div>
                <div class="empty-state hidden" id="emptyState">
                    <p>No prompts found. Start chatting to save prompts automatically.</p>
                </div>
            </div>
        `;
        this.container.appendChild(this.element);
        
        // Get references
        this.promptsList = this.querySelector('#promptsList');
        this.loadingIndicator = this.querySelector('#loadingIndicator');
        this.emptyState = this.querySelector('#emptyState');
    }    s
etupEventListeners() {
        // State manager subscriptions
        if (this.stateManager) {
            this.stateManager.subscribe('chat', (chatState) => {
                // Auto-save new messages as prompts
                if (chatState.messages && chatState.messages.length > 0) {
                    const lastMessage = chatState.messages[chatState.messages.length - 1];
                    if (lastMessage.type === 'user' && !lastMessage.metadata?.savedAsPrompt) {
                        this.savePromptFromMessage(lastMessage);
                    }
                }
            });
        }
    }

    async initializePromptSystem() {
        this.setLoading(true);
        
        try {
            // Initialize .remoterc folder structure
            await this.initializeRemoteRcFolder();
            
            // Load existing data
            await this.loadCategories();
            await this.loadPromptData();
            
            console.log('✅ Prompt system initialized');
        } catch (error) {
            console.error('❌ Failed to initialize prompt system:', error);
        } finally {
            this.setLoading(false);
        }
    }

    async initializeRemoteRcFolder() {
        if (this.webSocketClient && this.webSocketClient.isConnected) {
            return new Promise((resolve, reject) => {
                this.webSocketClient.sendMessage({
                    type: 'fileSystem',
                    data: {
                        operation: 'createRemoteRc',
                        path: this.remoteRcPath,
                        structure: {
                            [this.promptsSubfolder]: {},
                            [this.categoriesFile]: this.defaultCategories,
                            [this.templatesFile]: this.defaultTemplates
                        }
                    }
                });
                
                // For now, just resolve - in a real implementation, we'd wait for response
                setTimeout(() => resolve(), 100);
            });
        }
    }

    async loadCategories() {
        // Initialize with default categories
        this.defaultCategories.forEach(category => {
            this.categories.set(category.id, category);
        });
    }

    async savePromptFromMessage(message) {
        if (!message.content || message.content.trim().length === 0) {
            return;
        }

        try {
            const prompt = {
                id: this.generatePromptId(),
                content: message.content,
                timestamp: message.timestamp || new Date(),
                category: 'general',
                tags: [],
                usageCount: 1
            };

            // Generate filename with timestamp
            const filename = this.generatePromptFilename(prompt.timestamp);
            const filePath = `${this.promptsSubfolder}/${filename}`;

            // Save prompt file
            await this.savePromptFile(filePath, prompt);

            // Add to local state
            this.prompts.push(prompt);
            this.renderPrompts();

            // Mark message as saved
            if (message.metadata) {
                message.metadata.savedAsPrompt = true;
                message.metadata.promptFile = filePath;
            }

            console.log('✅ Prompt saved:', filename);
        } catch (error) {
            console.error('❌ Failed to save prompt:', error);
        }
    }

    async savePromptFile(filePath, prompt) {
        const promptData = {
            ...prompt,
            metadata: {
                version: '1.0',
                savedAt: new Date(),
                filePath: filePath
            }
        };

        if (this.webSocketClient && this.webSocketClient.isConnected) {
            this.webSocketClient.sendMessage({
                type: 'fileSystem',
                data: {
                    operation: 'writeRemoteRcFile',
                    path: `${this.remoteRcPath}/${filePath}`,
                    content: JSON.stringify(promptData, null, 2)
                }
            });
        }
    }

    async loadPromptData() {
        // For now, just render empty state
        this.renderPrompts();
    }

    generatePromptId() {
        return `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generatePromptFilename(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}_prompt.json`;
    }

    renderPrompts() {
        if (!this.promptsList) return;

        if (this.prompts.length === 0) {
            this.promptsList.classList.add('hidden');
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.promptsList.classList.remove('hidden');
        this.emptyState.classList.add('hidden');

        this.promptsList.innerHTML = this.prompts.map(prompt => this.renderPromptItem(prompt)).join('');
    }

    renderPromptItem(prompt) {
        const category = this.categories.get(prompt.category);
        const timestamp = this.formatTimestamp(prompt.timestamp);
        const preview = this.getPromptPreview(prompt.content);

        return `
            <div class="prompt-item" data-prompt-id="${prompt.id}">
                <div class="prompt-header">
                    <div class="prompt-category" style="background-color: ${category?.color || '#6366f1'}">
                        ${this.escapeHtml(category?.name || 'Unknown')}
                    </div>
                    <div class="prompt-timestamp">${timestamp}</div>
                </div>
                <div class="prompt-content">
                    <div class="prompt-preview">${this.escapeHtml(preview)}</div>
                </div>
            </div>
        `;
    }

    getPromptPreview(content, maxLength = 100) {
        if (!content) return '';
        return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (this.loadingIndicator) {
            if (loading) {
                this.loadingIndicator.classList.remove('hidden');
                this.promptsList.classList.add('hidden');
                this.emptyState.classList.add('hidden');
            } else {
                this.loadingIndicator.classList.add('hidden');
            }
        }
    }

    // Public API Methods
    getPrompts() {
        return [...this.prompts];
    }

    getCategories() {
        return Array.from(this.categories.values());
    }
}