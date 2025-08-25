/**
 * Optimized Message Processor
 * Handles WebSocket message processing with performance optimizations
 */

import { PerformanceOptimizer, MemoryManager } from './PerformanceOptimizer.js';

export class MessageProcessor {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Performance optimizations
        this.optimizer = new PerformanceOptimizer();
        this.memoryManager = new MemoryManager({
            maxCacheSize: 500,
            cleanupInterval: 30000, // 30 seconds
            maxAge: 180000 // 3 minutes
        });

        // Message queues for batching
        this.messageQueue = [];
        this.batchSize = 10;
        this.batchTimeout = 50; // ms
        this.batchTimer = null;

        // Message deduplication
        this.processedMessages = new Set();
        this.maxProcessedMessages = 1000;

        // Rate limiting
        this.rateLimiter = new Map();
        this.rateLimit = 100; // messages per second
        this.rateLimitWindow = 1000; // 1 second

        // Message handlers with caching
        this.handlers = new Map();
        this.handlerCache = new Map();

        this.setupHandlers();
    }

    /**
     * Process incoming message with optimizations
     */
    processMessage(message) {
        try {
            // Validate message
            if (!this.isValidMessage(message)) {
                console.warn('Invalid message received:', message);
                return;
            }

            // Check for duplicates
            if (this.isDuplicateMessage(message)) {
                console.log('Duplicate message ignored:', message.id);
                return;
            }

            // Rate limiting
            if (!this.checkRateLimit(message.type)) {
                console.warn('Rate limit exceeded for message type:', message.type);
                return;
            }

            // Add to processing queue
            this.queueMessage(message);

        } catch (error) {
            console.error('Error processing message:', error);
        }
    }

    /**
     * Queue message for batch processing
     */
    queueMessage(message) {
        this.messageQueue.push(message);

        // Process immediately if queue is full
        if (this.messageQueue.length >= this.batchSize) {
            this.processBatch();
        } else {
            // Schedule batch processing
            this.scheduleBatchProcessing();
        }
    }

    /**
     * Schedule batch processing with debouncing
     */
    scheduleBatchProcessing() {
        this.optimizer.debounce('message-batch', () => {
            this.processBatch();
        }, this.batchTimeout);
    }

    /**
     * Process queued messages in batch
     */
    processBatch() {
        if (this.messageQueue.length === 0) return;

        const batch = [...this.messageQueue];
        this.messageQueue = [];

        // Group messages by type for efficient processing
        const messagesByType = new Map();
        batch.forEach(message => {
            if (!messagesByType.has(message.type)) {
                messagesByType.set(message.type, []);
            }
            messagesByType.get(message.type).push(message);
        });

        // Process each type in batch
        this.optimizer.requestAnimationFrame('process-batch', () => {
            messagesByType.forEach((messages, type) => {
                this.processBatchByType(type, messages);
            });
        });
    }

    /**
     * Process batch of messages by type
     */
    processBatchByType(type, messages) {
        const handler = this.handlers.get(type);
        if (!handler) {
            console.warn('No handler for message type:', type);
            return;
        }

        try {
            // Check if handler supports batch processing
            if (handler.processBatch) {
                handler.processBatch(messages);
            } else {
                // Process individually
                messages.forEach(message => {
                    handler.process(message);
                    this.markMessageProcessed(message);
                });
            }
        } catch (error) {
            console.error(`Error processing ${type} messages:`, error);
        }
    }

    /**
     * Validate message structure
     */
    isValidMessage(message) {
        return message && 
               typeof message === 'object' && 
               message.type && 
               typeof message.type === 'string';
    }

    /**
     * Check for duplicate messages
     */
    isDuplicateMessage(message) {
        if (!message.id) return false;

        if (this.processedMessages.has(message.id)) {
            return true;
        }

        // Cleanup old processed messages if needed
        if (this.processedMessages.size >= this.maxProcessedMessages) {
            const messagesToRemove = Array.from(this.processedMessages).slice(0, 100);
            messagesToRemove.forEach(id => this.processedMessages.delete(id));
        }

        return false;
    }

    /**
     * Mark message as processed
     */
    markMessageProcessed(message) {
        if (message.id) {
            this.processedMessages.add(message.id);
        }
    }

    /**
     * Rate limiting check
     */
    checkRateLimit(messageType) {
        const now = Date.now();
        const key = `rate-${messageType}`;
        
        if (!this.rateLimiter.has(key)) {
            this.rateLimiter.set(key, { count: 1, window: now });
            return true;
        }

        const rateData = this.rateLimiter.get(key);
        
        // Reset window if expired
        if (now - rateData.window >= this.rateLimitWindow) {
            rateData.count = 1;
            rateData.window = now;
            return true;
        }

        // Check rate limit
        if (rateData.count >= this.rateLimit) {
            return false;
        }

        rateData.count++;
        return true;
    }

    /**
     * Setup message handlers
     */
    setupHandlers() {
        // Chat message handler
        this.handlers.set('chat', {
            process: (message) => this.handleChatMessage(message),
            processBatch: (messages) => this.handleChatMessageBatch(messages)
        });

        // Git message handler
        this.handlers.set('git', {
            process: (message) => this.handleGitMessage(message),
            processBatch: (messages) => this.handleGitMessageBatch(messages)
        });

        // File system handler
        this.handlers.set('fileSystem', {
            process: (message) => this.handleFileSystemMessage(message),
            processBatch: (messages) => this.handleFileSystemMessageBatch(messages)
        });

        // Status handler
        this.handlers.set('status', {
            process: (message) => this.handleStatusMessage(message)
        });

        // Error handler
        this.handlers.set('error', {
            process: (message) => this.handleErrorMessage(message)
        });

        // Typing indicator handler
        this.handlers.set('typing', {
            process: (message) => this.handleTypingMessage(message),
            processBatch: (messages) => this.handleTypingMessageBatch(messages)
        });
    }

    /**
     * Handle chat messages with caching
     */
    handleChatMessage(message) {
        if (message.data && message.data.content) {
            const chatMessage = {
                id: message.id || this.generateId(),
                type: message.data.type || 'system',
                content: message.data.content,
                timestamp: new Date(message.data.timestamp || Date.now()),
                metadata: message.data.metadata
            };

            // Cache message for quick access
            this.memoryManager.set(`chat-${chatMessage.id}`, chatMessage);

            // Update state with debouncing
            this.optimizer.debounce('chat-update', () => {
                this.stateManager.addChatMessage(chatMessage);
            }, 100);
        }
    }

    /**
     * Handle batch of chat messages
     */
    handleChatMessageBatch(messages) {
        const chatMessages = messages
            .filter(msg => msg.data && msg.data.content)
            .map(msg => ({
                id: msg.id || this.generateId(),
                type: msg.data.type || 'system',
                content: msg.data.content,
                timestamp: new Date(msg.data.timestamp || Date.now()),
                metadata: msg.data.metadata
            }));

        if (chatMessages.length > 0) {
            // Cache all messages
            chatMessages.forEach(msg => {
                this.memoryManager.set(`chat-${msg.id}`, msg);
            });

            // Update state once for all messages
            this.optimizer.debounce('chat-batch-update', () => {
                const currentMessages = this.stateManager.getChatMessages();
                this.stateManager.updateChat({
                    messages: [...currentMessages, ...chatMessages]
                });
            }, 50);
        }
    }

    /**
     * Handle git messages with state diffing
     */
    handleGitMessage(message) {
        if (!message.data) return;

        const { operation, result } = message.data;
        const cacheKey = `git-${operation}`;
        
        // Check if data has changed
        const cachedData = this.memoryManager.get(cacheKey);
        if (cachedData && JSON.stringify(cachedData) === JSON.stringify(result)) {
            return; // No change, skip update
        }

        // Cache new data
        this.memoryManager.set(cacheKey, result);

        // Update state based on operation
        this.optimizer.debounce(`git-${operation}`, () => {
            switch (operation) {
                case 'status':
                    this.stateManager.updateGit({ status: result });
                    break;
                case 'log':
                    this.stateManager.updateGit({ recentCommits: result });
                    break;
                case 'diff':
                    this.stateManager.updateGit({ currentDiff: result });
                    break;
                case 'branch':
                    this.stateManager.updateGit({ 
                        currentBranch: result.current,
                        remoteStatus: result.remote 
                    });
                    break;
            }
        }, 200);
    }

    /**
     * Handle batch of git messages
     */
    handleGitMessageBatch(messages) {
        const gitUpdates = {};
        
        messages.forEach(message => {
            if (message.data && message.data.operation) {
                const { operation, result } = message.data;
                const cacheKey = `git-${operation}`;
                
                // Check for changes
                const cachedData = this.memoryManager.get(cacheKey);
                if (!cachedData || JSON.stringify(cachedData) !== JSON.stringify(result)) {
                    this.memoryManager.set(cacheKey, result);
                    
                    switch (operation) {
                        case 'status':
                            gitUpdates.status = result;
                            break;
                        case 'log':
                            gitUpdates.recentCommits = result;
                            break;
                        case 'diff':
                            gitUpdates.currentDiff = result;
                            break;
                        case 'branch':
                            gitUpdates.currentBranch = result.current;
                            gitUpdates.remoteStatus = result.remote;
                            break;
                    }
                }
            }
        });

        // Apply all updates at once
        if (Object.keys(gitUpdates).length > 0) {
            this.optimizer.debounce('git-batch-update', () => {
                this.stateManager.updateGit(gitUpdates);
            }, 100);
        }
    }

    /**
     * Handle file system messages with change detection
     */
    handleFileSystemMessage(message) {
        if (!message.data) return;

        const { operation, path, content } = message.data;
        const cacheKey = `fs-${operation}-${path || 'root'}`;
        
        // Check for changes
        const cachedData = this.memoryManager.get(cacheKey);
        if (cachedData && JSON.stringify(cachedData) === JSON.stringify(content)) {
            return; // No change
        }

        // Cache new data
        this.memoryManager.set(cacheKey, content);

        // Update state with debouncing
        this.optimizer.debounce(`fs-${operation}`, () => {
            switch (operation) {
                case 'tree':
                    this.stateManager.updateFileSystem({ rootNodes: content });
                    break;
                case 'open':
                    this.stateManager.updateFileSystem({ selectedFile: path });
                    break;
                case 'search':
                    this.stateManager.updateFileSystem({ filteredNodes: content });
                    break;
            }
        }, 150);
    }

    /**
     * Handle batch of file system messages
     */
    handleFileSystemMessageBatch(messages) {
        const fsUpdates = {};
        
        messages.forEach(message => {
            if (message.data && message.data.operation) {
                const { operation, path, content } = message.data;
                const cacheKey = `fs-${operation}-${path || 'root'}`;
                
                // Check for changes
                const cachedData = this.memoryManager.get(cacheKey);
                if (!cachedData || JSON.stringify(cachedData) !== JSON.stringify(content)) {
                    this.memoryManager.set(cacheKey, content);
                    
                    switch (operation) {
                        case 'tree':
                            fsUpdates.rootNodes = content;
                            break;
                        case 'open':
                            fsUpdates.selectedFile = path;
                            break;
                        case 'search':
                            fsUpdates.filteredNodes = content;
                            break;
                    }
                }
            }
        });

        // Apply all updates at once
        if (Object.keys(fsUpdates).length > 0) {
            this.optimizer.debounce('fs-batch-update', () => {
                this.stateManager.updateFileSystem(fsUpdates);
            }, 100);
        }
    }

    /**
     * Handle status messages
     */
    handleStatusMessage(message) {
        if (message.data) {
            this.optimizer.debounce('status-update', () => {
                this.stateManager.updateConnection({
                    serverInfo: message.data
                });
            }, 500);
        }
    }

    /**
     * Handle error messages
     */
    handleErrorMessage(message) {
        const errorMsg = message.error || message.data?.error || 'Unknown error';
        
        if (this.notificationService) {
            this.notificationService.show({
                type: 'error',
                message: errorMsg,
                duration: 5000
            });
        }
    }

    /**
     * Handle typing indicators
     */
    handleTypingMessage(message) {
        if (message.data) {
            const { userId, isTyping } = message.data;
            
            this.optimizer.debounce(`typing-${userId}`, () => {
                // Update typing indicators in state
                const currentTyping = this.stateManager.getState().chat.typingUsers || [];
                let newTyping;
                
                if (isTyping) {
                    newTyping = [...new Set([...currentTyping, userId])];
                } else {
                    newTyping = currentTyping.filter(id => id !== userId);
                }
                
                this.stateManager.updateChat({ typingUsers: newTyping });
            }, 100);
        }
    }

    /**
     * Handle batch of typing messages
     */
    handleTypingMessageBatch(messages) {
        const typingUpdates = new Map();
        
        messages.forEach(message => {
            if (message.data && message.data.userId) {
                const { userId, isTyping } = message.data;
                typingUpdates.set(userId, isTyping);
            }
        });

        if (typingUpdates.size > 0) {
            this.optimizer.debounce('typing-batch-update', () => {
                const currentTyping = this.stateManager.getState().chat.typingUsers || [];
                let newTyping = [...currentTyping];
                
                typingUpdates.forEach((isTyping, userId) => {
                    if (isTyping) {
                        if (!newTyping.includes(userId)) {
                            newTyping.push(userId);
                        }
                    } else {
                        newTyping = newTyping.filter(id => id !== userId);
                    }
                });
                
                this.stateManager.updateChat({ typingUsers: newTyping });
            }, 50);
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get processing statistics
     */
    getStats() {
        return {
            queuedMessages: this.messageQueue.length,
            processedMessages: this.processedMessages.size,
            cacheStats: this.memoryManager.getStats(),
            rateLimiterEntries: this.rateLimiter.size,
            optimizerMetrics: this.optimizer.getMetrics()
        };
    }

    /**
     * Clear all caches and reset
     */
    clearCache() {
        this.memoryManager.clear();
        this.processedMessages.clear();
        this.rateLimiter.clear();
        this.messageQueue = [];
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.optimizer.cleanup();
        this.memoryManager.destroy();
        this.clearCache();
    }
}