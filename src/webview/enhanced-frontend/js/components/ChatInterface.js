/**
 * ChatInterface Component - Main chat interface with message display and input
 */

import { Component } from './base/Component.js';
import { MessageHistory } from './MessageHistory.js';
import { MessageInput } from './MessageInput.js';
import { PromptManager } from './PromptManager.js';

export class ChatInterface extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Chat state
        this.messages = [];
        this.isTyping = false;
        this.autoScroll = true;

        // Child components
        this.messageHistory = null;
        this.messageInput = null;
        this.promptManager = null;
    }

    async initialize() {
        await super.initialize();
        this.render();
        await this.initializeChildComponents();
        this.setupEventListeners();
        this.loadInitialMessages();
    }

    render() {
        this.element = this.createElement('div', {}, ['chat-interface']);

        this.element.innerHTML = `
            <div class="chat-header">
                <div class="chat-title">
                    <h3>Chat Interface</h3>
                    <div class="chat-status" id="chatStatus">
                        <span class="status-indicator">
                            <span class="status-dot connected"></span>
                            <span>Connected</span>
                        </span>
                    </div>
                </div>
                <div class="chat-actions">
                    <button class="btn btn-icon" id="promptManagerToggle" title="Toggle Prompt Manager">
                        <span class="icon">📝</span>
                    </button>
                    <button class="btn btn-icon" id="clearChatButton" title="Clear Chat">
                        <span class="icon">🗑️</span>
                    </button>
                    <button class="btn btn-icon" id="scrollToggleButton" title="Toggle Auto-scroll">
                        <span class="icon">📌</span>
                    </button>
                </div>
            </div>
            <div class="chat-body">
                <div class="chat-main">
                    <div class="message-history-container" id="messageHistoryContainer">
                        <!-- MessageHistory component will be rendered here -->
                    </div>
                    <div class="message-input-container" id="messageInputContainer">
                        <!-- MessageInput component will be rendered here -->
                    </div>
                </div>
                <div class="prompt-manager-container hidden" id="promptManagerContainer">
                    <!-- PromptManager component will be rendered here -->
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.chatStatus = this.querySelector('#chatStatus');
        this.promptManagerToggle = this.querySelector('#promptManagerToggle');
        this.clearChatButton = this.querySelector('#clearChatButton');
        this.scrollToggleButton = this.querySelector('#scrollToggleButton');
        this.messageHistoryContainer = this.querySelector('#messageHistoryContainer');
        this.messageInputContainer = this.querySelector('#messageInputContainer');
        this.promptManagerContainer = this.querySelector('#promptManagerContainer');
    }

    async initializeChildComponents() {
        // Initialize MessageHistory component
        this.messageHistory = new MessageHistory({
            container: this.messageHistoryContainer,
            stateManager: this.stateManager,
            messages: this.messages,
            autoScroll: this.autoScroll
        });

        await this.messageHistory.initialize();
        this.addChildComponent(this.messageHistory);

        // Initialize MessageInput component
        this.messageInput = new MessageInput({
            container: this.messageInputContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient
        });

        await this.messageInput.initialize();
        this.addChildComponent(this.messageInput);

        // Initialize PromptManager component
        this.promptManager = new PromptManager({
            container: this.promptManagerContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });

        await this.promptManager.initialize();
        this.addChildComponent(this.promptManager);
    }

    setupEventListeners() {
        // Prompt manager toggle button
        if (this.promptManagerToggle) {
            this.addEventListener(this.promptManagerToggle, 'click', this.handlePromptManagerToggle);
        }

        // Clear chat button
        if (this.clearChatButton) {
            this.addEventListener(this.clearChatButton, 'click', this.handleClearChat);
        }

        // Auto-scroll toggle button
        if (this.scrollToggleButton) {
            this.addEventListener(this.scrollToggleButton, 'click', this.handleScrollToggle);
        }

        // Listen for new messages from MessageInput
        this.addEventListener(this.element, 'message-sent', this.handleMessageSent);

        // Listen for state changes from StateManager
        if (this.stateManager) {
            this.stateManager.subscribe('connection', (connectionState) => {
                this.updateConnectionStatus(connectionState.status);
            });
            
            this.stateManager.subscribe('chat', (chatState) => {
                // Handle typing indicators
                if (chatState.typingUsers && chatState.typingUsers.length > 0) {
                    this.showTypingIndicator(chatState.typingUsers);
                } else {
                    this.hideTypingIndicator();
                }
                
                // Handle message status updates
                if (chatState.messageStatuses) {
                    Object.entries(chatState.messageStatuses).forEach(([messageId, status]) => {
                        this.updateMessageStatus(messageId, status.status);
                    });
                }
            });
        }

        // Listen for scroll events from MessageHistory
        this.addEventListener(this.element, 'scroll-position-changed', this.handleScrollPositionChanged);

        // Listen for prompt manager events
        if (this.promptManager) {
            this.addEventListener(this.element, 'prompt-selected', this.handlePromptSelected);
            this.addEventListener(this.element, 'template-selected', this.handleTemplateSelected);
        }
    }

    loadInitialMessages() {
        // Add welcome message
        this.addMessage({
            id: this.generateMessageId(),
            type: 'system',
            content: 'Welcome to the Enhanced Web Automation chat interface! You can now send prompts and receive responses in real-time.',
            timestamp: new Date(),
            metadata: {
                isWelcome: true
            }
        });

        // Load any persisted messages from state manager
        const persistedMessages = this.stateManager?.getState('chat.messages') || [];
        persistedMessages.forEach(message => this.addMessage(message));
    }

    handleMessageSent(event) {
        const { content, metadata } = event.detail;
        
        // Create user message
        const userMessage = {
            id: this.generateMessageId(),
            type: 'user',
            content: content,
            timestamp: new Date(),
            metadata: metadata || {},
            status: 'sending'
        };

        this.addMessage(userMessage);

        // Send message via enhanced WebSocket client
        if (this.webSocketClient && this.webSocketClient.isConnected) {
            // Use enhanced sendPrompt method
            this.webSocketClient.sendPrompt(content, {
                category: metadata?.category,
                tags: metadata?.tags || [],
                saveToHistory: true,
                callback: (error, response) => {
                    // Update message status
                    userMessage.status = error ? 'failed' : 'sent';
                    this.updateMessageStatus(userMessage.id, userMessage.status);
                    
                    if (error) {
                        this.addMessage({
                            id: this.generateMessageId(),
                            type: 'error',
                            content: `Failed to send message: ${error}`,
                            timestamp: new Date(),
                            metadata: { isError: true }
                        });
                    } else if (response) {
                        // Handle response
                        this.handlePromptResponse(response);
                    }
                }
            });

            // Send typing indicator
            this.webSocketClient.sendTypingIndicator(true, 'chat');
            
            // Show typing indicator in UI
            this.showTypingIndicator();
        } else {
            // Handle offline mode or disconnected state
            userMessage.status = 'queued';
            this.updateMessageStatus(userMessage.id, 'queued');
            
            if (this.webSocketClient && this.webSocketClient.isOfflineMode) {
                this.addMessage({
                    id: this.generateMessageId(),
                    type: 'info',
                    content: 'Message queued - will be sent when connection is restored',
                    timestamp: new Date(),
                    metadata: { isInfo: true }
                });
            } else {
                this.addMessage({
                    id: this.generateMessageId(),
                    type: 'error',
                    content: 'Unable to send message: Not connected to server',
                    timestamp: new Date(),
                    metadata: { isError: true }
                });
            }
        }

        // Persist messages
        this.persistMessages();
    }

    handleMessageReceived(event) {
        const { message } = event.detail;
        
        // Hide typing indicator
        this.hideTypingIndicator();

        // Create system message
        const systemMessage = {
            id: this.generateMessageId(),
            type: 'system',
            content: message.content || 'Response received',
            timestamp: new Date(),
            metadata: {
                messageType: message.type,
                executionTime: message.executionTime,
                ...message.metadata
            },
            status: 'received'
        };

        this.addMessage(systemMessage);
        this.persistMessages();
    }

    handlePromptResponse(response) {
        // Stop typing indicator
        if (this.webSocketClient) {
            this.webSocketClient.sendTypingIndicator(false, 'chat');
        }
        this.hideTypingIndicator();

        // Create response message
        const responseMessage = {
            id: this.generateMessageId(),
            type: 'assistant',
            content: response.content || response.result || 'Command executed successfully',
            timestamp: new Date(),
            metadata: {
                executionTime: response.executionTime,
                commandExecuted: response.command,
                ...response.metadata
            },
            status: 'received'
        };

        this.addMessage(responseMessage);
        this.persistMessages();
    }

    updateMessageStatus(messageId, status) {
        const message = this.messages.find(msg => msg.id === messageId);
        if (message) {
            message.status = status;
            
            // Update in message history component
            if (this.messageHistory) {
                this.messageHistory.updateMessageStatus(messageId, status);
            }
        }
    }

    handleConnectionStatusChanged(event) {
        const { status } = event.detail;
        this.updateConnectionStatus(status);
    }

    handleScrollPositionChanged(event) {
        const { isAtBottom } = event.detail;
        
        // Update auto-scroll based on user scroll position
        if (!isAtBottom && this.autoScroll) {
            this.autoScroll = false;
            this.updateScrollToggleButton();
        }
    }

    handleClearChat() {
        if (confirm('Are you sure you want to clear all chat messages?')) {
            this.clearMessages();
        }
    }

    handleScrollToggle() {
        this.autoScroll = !this.autoScroll;
        this.updateScrollToggleButton();
        
        if (this.autoScroll && this.messageHistory) {
            this.messageHistory.scrollToBottom();
        }
    }

    handlePromptManagerToggle() {
        if (this.promptManagerContainer) {
            const isHidden = this.promptManagerContainer.classList.contains('hidden');
            
            if (isHidden) {
                this.promptManagerContainer.classList.remove('hidden');
                this.promptManagerToggle.classList.add('active');
            } else {
                this.promptManagerContainer.classList.add('hidden');
                this.promptManagerToggle.classList.remove('active');
            }
        }
    }

    handlePromptSelected(event) {
        const { content, category, tags } = event.detail;
        
        // Load prompt content into message input
        if (this.messageInput) {
            this.messageInput.setValue(content);
            this.messageInput.focus();
        }
    }

    handleTemplateSelected(event) {
        const { content, category, tags } = event.detail;
        
        // Load template content into message input
        if (this.messageInput) {
            this.messageInput.setValue(content);
            this.messageInput.focus();
        }
    }

    addMessage(message) {
        this.messages.push(message);
        
        if (this.messageHistory) {
            this.messageHistory.addMessage(message);
            
            // Auto-scroll if enabled
            if (this.autoScroll) {
                this.messageHistory.scrollToBottom();
            }
        }

        // Emit event for external listeners
        this.emit('message-added', { message });
    }

    clearMessages() {
        this.messages = [];
        
        if (this.messageHistory) {
            this.messageHistory.clearMessages();
        }

        // Add welcome message back
        this.loadInitialMessages();
        
        // Clear persisted messages
        this.stateManager?.setState('chat.messages', []);

        this.emit('messages-cleared');
    }

    showTypingIndicator(typingUsers = []) {
        if (this.messageHistory) {
            this.messageHistory.showTypingIndicator(typingUsers);
        }
        this.isTyping = typingUsers.length > 0;
    }

    hideTypingIndicator() {
        if (this.messageHistory) {
            this.messageHistory.hideTypingIndicator();
        }
        this.isTyping = false;
    }

    updateConnectionStatus(status) {
        if (!this.chatStatus) return;

        const statusIndicator = this.chatStatus.querySelector('.status-dot');
        const statusText = this.chatStatus.querySelector('span:last-child');

        if (statusIndicator && statusText) {
            // Remove existing status classes
            statusIndicator.classList.remove('connected', 'connecting', 'disconnected');
            
            // Add new status class and update text
            switch (status) {
                case 'connected':
                    statusIndicator.classList.add('connected');
                    statusText.textContent = 'Connected';
                    break;
                case 'connecting':
                    statusIndicator.classList.add('connecting');
                    statusText.textContent = 'Connecting...';
                    break;
                case 'disconnected':
                    statusIndicator.classList.add('disconnected');
                    statusText.textContent = 'Disconnected';
                    break;
            }
        }
    }

    updateScrollToggleButton() {
        if (!this.scrollToggleButton) return;

        const icon = this.scrollToggleButton.querySelector('.icon');
        if (icon) {
            icon.textContent = this.autoScroll ? '📌' : '📍';
        }
        
        this.scrollToggleButton.title = this.autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled';
        this.scrollToggleButton.classList.toggle('active', this.autoScroll);
    }

    persistMessages() {
        // Only persist non-welcome messages
        const messagesToPersist = this.messages.filter(msg => !msg.metadata?.isWelcome);
        this.stateManager?.setState('chat.messages', messagesToPersist);
    }

    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    focusInput() {
        if (this.messageInput) {
            this.messageInput.focus();
        }
    }

    getMessages() {
        return [...this.messages];
    }

    getMessageCount() {
        return this.messages.length;
    }

    isAutoScrollEnabled() {
        return this.autoScroll;
    }

    scrollToBottom() {
        if (this.messageHistory) {
            this.messageHistory.scrollToBottom();
        }
    }

    scrollToTop() {
        if (this.messageHistory) {
            this.messageHistory.scrollToTop();
        }
    }

    destroy() {
        // Clean up child components
        if (this.messageHistory) {
            this.messageHistory.destroy();
        }
        if (this.messageInput) {
            this.messageInput.destroy();
        }
        if (this.promptManager) {
            this.promptManager.destroy();
        }

        super.destroy();
    }
}