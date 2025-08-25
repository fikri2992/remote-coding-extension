/**
 * MessageHistory Component - Message display area with virtual scrolling
 */

import { Component } from './base/Component.js';
import { VirtualScroller, PerformanceOptimizer, MemoryManager } from '../utils/PerformanceOptimizer.js';

export class MessageHistory extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.messages = options.messages || [];
        this.autoScroll = options.autoScroll !== false;

        // Performance optimizations
        this.optimizer = new PerformanceOptimizer();
        this.memoryManager = new MemoryManager({
            maxCacheSize: 200,
            cleanupInterval: 60000,
            maxAge: 300000
        });

        // Virtual scrolling configuration
        this.itemHeight = 80; // Estimated height per message
        this.visibleCount = 10; // Number of visible items
        this.bufferSize = 5; // Extra items to render for smooth scrolling
        this.scrollTop = 0;
        this.containerHeight = 0;

        // Virtual scroller instance
        this.virtualScroller = null;

        // Rendered message elements cache
        this.renderedMessages = new Map();
        this.visibleRange = { start: 0, end: 0 };
        this.messageHeights = new Map(); // Cache actual message heights

        // Typing indicator
        this.typingIndicator = null;
        this.isTypingVisible = false;

        // Scroll position tracking
        this.isAtBottom = true;
        this.lastScrollTop = 0;

        // Performance metrics
        this.renderCount = 0;
        this.lastRenderTime = 0;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.initializeVirtualScrolling();
        this.updateVisibleMessages();
    }

    render() {
        this.element = this.createElement('div', {}, ['message-history']);

        this.element.innerHTML = `
            <div class="message-history-viewport" id="viewport">
                <div class="message-history-content" id="content">
                    <div class="message-list" id="messageList">
                        <!-- Messages will be rendered here -->
                    </div>
                    <div class="typing-indicator hidden" id="typingIndicator">
                        <div class="message message-system typing">
                            <div class="message-avatar system">AI</div>
                            <div class="message-content">
                                <div class="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.viewport = this.querySelector('#viewport');
        this.content = this.querySelector('#content');
        this.messageList = this.querySelector('#messageList');
        this.typingIndicator = this.querySelector('#typingIndicator');

        // Set initial content height
        this.updateContentHeight();
    }

    setupEventListeners() {
        if (this.viewport) {
            // Use optimized scroll handler with throttling
            this.optimizer.addEventListenerWithCleanup(
                this.viewport,
                'scroll',
                () => this.optimizer.throttle('message-scroll', () => this.handleScroll(), 16)
            );
        }

        // Handle window resize with debouncing
        this.optimizer.addEventListenerWithCleanup(
            window,
            'resize',
            () => this.optimizer.debounce('message-resize', () => this.handleResize(), 100)
        );

        // Observe container size changes with debouncing
        this.optimizer.createResizeObserver('message-history', (entries) => {
            for (const entry of entries) {
                this.handleContainerResize(entry.contentRect);
            }
        }).observe(this.element);
    }

    handleScroll() {
        if (!this.viewport) return;

        this.scrollTop = this.viewport.scrollTop;
        const scrollHeight = this.viewport.scrollHeight;
        const clientHeight = this.viewport.clientHeight;

        // Check if user is at bottom
        const wasAtBottom = this.isAtBottom;
        this.isAtBottom = (this.scrollTop + clientHeight >= scrollHeight - 10);

        // Update visible messages based on scroll position
        this.updateVisibleMessages();

        // Emit scroll position change event
        if (wasAtBottom !== this.isAtBottom) {
            this.emit('scroll-position-changed', { 
                isAtBottom: this.isAtBottom,
                scrollTop: this.scrollTop,
                scrollHeight: scrollHeight,
                clientHeight: clientHeight
            });
        }

        this.lastScrollTop = this.scrollTop;
    }

    handleResize() {
        this.updateContainerDimensions();
        this.updateVisibleMessages();
    }

    handleContainerResize(rect) {
        this.containerHeight = rect.height;
        this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight) + this.bufferSize;
        this.updateVisibleMessages();
    }

    addMessage(message) {
        this.messages.push(message);
        
        // Cache message for quick access
        this.memoryManager.set(`msg-${message.id}`, message);
        
        // Update virtual scroller if available
        if (this.virtualScroller) {
            this.virtualScroller.refresh();
        } else {
            this.updateContentHeight();
        }
        
        // Batch scroll updates for better performance
        this.optimizer.debounce('message-scroll-update', () => {
            // If we're at the bottom or auto-scroll is enabled, update visible messages
            if (this.isAtBottom || this.autoScroll) {
                this.updateVisibleMessages();
                
                // Auto-scroll to bottom if enabled
                if (this.autoScroll) {
                    this.scrollToBottom();
                }
            }
        }, 50);
    }

    clearMessages() {
        this.messages = [];
        this.renderedMessages.clear();
        this.messageList.innerHTML = '';
        this.updateContentHeight();
        this.updateVisibleMessages();
    }

    updateVisibleMessages() {
        if (!this.viewport || this.messages.length === 0) return;

        // Calculate visible range based on scroll position
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(
            startIndex + this.visibleCount + this.bufferSize,
            this.messages.length
        );

        const newRange = {
            start: Math.max(0, startIndex - this.bufferSize),
            end: endIndex
        };

        // Only update if range has changed
        if (newRange.start !== this.visibleRange.start || newRange.end !== this.visibleRange.end) {
            this.visibleRange = newRange;
            this.renderVisibleMessages();
        }
    }

    renderVisibleMessages() {
        // Clear existing rendered messages
        this.messageList.innerHTML = '';
        this.renderedMessages.clear();

        // Create spacer for messages above visible range
        if (this.visibleRange.start > 0) {
            const topSpacer = this.createElement('div', {}, ['message-spacer']);
            topSpacer.style.height = `${this.visibleRange.start * this.itemHeight}px`;
            this.messageList.appendChild(topSpacer);
        }

        // Render visible messages
        for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
            const message = this.messages[i];
            if (message) {
                const messageElement = this.renderMessage(message, i);
                this.messageList.appendChild(messageElement);
                this.renderedMessages.set(message.id, messageElement);
            }
        }

        // Create spacer for messages below visible range
        if (this.visibleRange.end < this.messages.length) {
            const bottomSpacer = this.createElement('div', {}, ['message-spacer']);
            const remainingMessages = this.messages.length - this.visibleRange.end;
            bottomSpacer.style.height = `${remainingMessages * this.itemHeight}px`;
            this.messageList.appendChild(bottomSpacer);
        }
    }

    renderMessage(message, index) {
        const messageElement = this.createElement('div', {
            'data-message-id': message.id,
            'data-message-index': index
        }, ['message', `message-${message.type}`]);

        // Format timestamp
        const timestamp = this.formatTimestamp(message.timestamp);

        // Get avatar text
        const avatarText = this.getAvatarText(message.type);

        // Process message content for rich text
        const processedContent = this.processMessageContent(message.content);

        messageElement.innerHTML = `
            <div class="message-avatar ${message.type}">
                ${avatarText}
            </div>
            <div class="message-content">
                <div class="message-text">
                    ${processedContent}
                </div>
                <div class="message-timestamp">
                    ${timestamp}
                    ${message.metadata?.executionTime ? `• ${message.metadata.executionTime}ms` : ''}
                </div>
            </div>
        `;

        // Add click handler for message actions
        this.addEventListener(messageElement, 'click', (event) => {
            this.handleMessageClick(event, message);
        });

        return messageElement;
    }

    processMessageContent(content) {
        if (!content) return '';

        // Convert markdown-style code blocks
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = language || '';
            return `<div class="code-block" data-language="${lang}"><pre><code>${this.escapeHtml(code.trim())}</code></pre></div>`;
        });

        // Convert inline code
        content = content.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>');

        // Convert line breaks
        content = content.replace(/\n/g, '<br>');

        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        return content;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getAvatarText(messageType) {
        switch (messageType) {
            case 'user':
                return 'U';
            case 'system':
                return 'AI';
            case 'error':
                return '⚠️';
            case 'info':
                return 'ℹ️';
            default:
                return '?';
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    handleMessageClick(event, message) {
        // Emit message click event for external handling
        this.emit('message-clicked', { message, event });
    }

    showTypingIndicator() {
        if (this.typingIndicator && !this.isTypingVisible) {
            this.typingIndicator.classList.remove('hidden');
            this.isTypingVisible = true;
            
            // Scroll to bottom to show typing indicator
            if (this.autoScroll) {
                this.scrollToBottom();
            }
        }
    }

    hideTypingIndicator() {
        if (this.typingIndicator && this.isTypingVisible) {
            this.typingIndicator.classList.add('hidden');
            this.isTypingVisible = false;
        }
    }

    updateContentHeight() {
        if (this.content) {
            const totalHeight = this.messages.length * this.itemHeight;
            this.content.style.height = `${totalHeight}px`;
        }
    }

    updateContainerDimensions() {
        if (this.element) {
            const rect = this.element.getBoundingClientRect();
            this.containerHeight = rect.height;
            this.visibleCount = Math.ceil(this.containerHeight / this.itemHeight) + this.bufferSize;
        }
    }

    scrollToBottom() {
        if (this.viewport) {
            this.viewport.scrollTop = this.viewport.scrollHeight;
        }
    }

    scrollToTop() {
        if (this.viewport) {
            this.viewport.scrollTop = 0;
        }
    }

    scrollToMessage(messageId) {
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            const scrollTop = messageIndex * this.itemHeight;
            if (this.viewport) {
                this.viewport.scrollTop = scrollTop;
            }
        }
    }

    getScrollPosition() {
        return {
            scrollTop: this.scrollTop,
            scrollHeight: this.viewport?.scrollHeight || 0,
            clientHeight: this.viewport?.clientHeight || 0,
            isAtBottom: this.isAtBottom
        };
    }

    setAutoScroll(enabled) {
        this.autoScroll = enabled;
    }

    /**
     * Initialize virtual scrolling for large message lists
     */
    initializeVirtualScrolling() {
        // Only use virtual scrolling for large message lists
        if (this.messages.length > 50) {
            this.enableVirtualScrolling();
        }
    }

    /**
     * Enable virtual scrolling
     */
    enableVirtualScrolling() {
        if (this.virtualScroller) return;

        this.virtualScroller = new VirtualScroller({
            container: this.viewport,
            itemHeight: this.itemHeight,
            bufferSize: this.bufferSize,
            renderItem: (message, index) => this.renderMessage(message, index),
            getItemCount: () => this.messages.length,
            getItemData: (index) => this.messages[index]
        });

        console.log('Virtual scrolling enabled for message history');
    }

    /**
     * Disable virtual scrolling
     */
    disableVirtualScrolling() {
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
            this.virtualScroller = null;
            console.log('Virtual scrolling disabled for message history');
        }
    }

    /**
     * Optimized message rendering with caching
     */
    renderMessageOptimized(message, index) {
        const cacheKey = `render-${message.id}-${message.timestamp}`;
        
        // Check cache first
        let cachedElement = this.memoryManager.get(cacheKey);
        if (cachedElement) {
            return cachedElement.cloneNode(true);
        }

        // Render new message
        const messageElement = this.renderMessage(message, index);
        
        // Cache the rendered element
        this.memoryManager.set(cacheKey, messageElement.cloneNode(true));
        
        return messageElement;
    }

    /**
     * Batch message updates for better performance
     */
    batchUpdateMessages(messages) {
        this.optimizer.requestAnimationFrame('batch-message-update', () => {
            messages.forEach(message => {
                this.messages.push(message);
                this.memoryManager.set(`msg-${message.id}`, message);
            });

            if (this.virtualScroller) {
                this.virtualScroller.refresh();
            } else {
                this.updateContentHeight();
                this.updateVisibleMessages();
            }

            if (this.autoScroll) {
                this.scrollToBottom();
            }
        });
    }

    /**
     * Optimized scroll handling
     */
    handleScrollOptimized() {
        const now = performance.now();
        
        // Skip if we're scrolling too frequently
        if (now - this.lastRenderTime < 16) { // 60fps limit
            return;
        }

        this.lastRenderTime = now;
        this.handleScroll();
    }

    /**
     * Memory cleanup for long-running sessions
     */
    performMemoryCleanup() {
        // Clean up old rendered messages
        const maxCachedMessages = 100;
        if (this.renderedMessages.size > maxCachedMessages) {
            const keysToDelete = Array.from(this.renderedMessages.keys())
                .slice(0, this.renderedMessages.size - maxCachedMessages);
            
            keysToDelete.forEach(key => {
                const element = this.renderedMessages.get(key);
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.renderedMessages.delete(key);
            });
        }

        // Clean up message height cache
        if (this.messageHeights.size > maxCachedMessages) {
            const heightKeysToDelete = Array.from(this.messageHeights.keys())
                .slice(0, this.messageHeights.size - maxCachedMessages);
            
            heightKeysToDelete.forEach(key => this.messageHeights.delete(key));
        }

        console.log('Message history memory cleanup completed');
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            messageCount: this.messages.length,
            renderedMessages: this.renderedMessages.size,
            cachedHeights: this.messageHeights.size,
            virtualScrollingEnabled: !!this.virtualScroller,
            renderCount: this.renderCount,
            memoryStats: this.memoryManager.getStats(),
            optimizerMetrics: this.optimizer.getMetrics()
        };
    }

    /**
     * Toggle virtual scrolling based on message count
     */
    checkVirtualScrollingThreshold() {
        const threshold = 50;
        
        if (this.messages.length > threshold && !this.virtualScroller) {
            this.enableVirtualScrolling();
        } else if (this.messages.length <= threshold && this.virtualScroller) {
            this.disableVirtualScrolling();
        }
    }

    destroy() {
        // Cleanup virtual scroller
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
            this.virtualScroller = null;
        }

        // Cleanup performance optimizers
        this.optimizer.cleanup();
        this.memoryManager.destroy();

        // Clear caches
        this.renderedMessages.clear();
        this.messageHeights.clear();

        super.destroy();
    }
}