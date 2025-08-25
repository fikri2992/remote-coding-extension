/**
 * Performance Optimizer Utilities
 * Collection of performance optimization utilities for the enhanced web frontend
 */

export class PerformanceOptimizer {
    constructor() {
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.rafCallbacks = new Map();
        this.observers = new Map();
    }

    /**
     * Debounce function execution
     */
    debounce(key, func, delay = 300) {
        // Clear existing timer
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            func();
        }, delay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Throttle function execution
     */
    throttle(key, func, delay = 100) {
        if (this.throttleTimers.has(key)) {
            return; // Already throttled
        }

        // Execute immediately
        func();

        // Set throttle timer
        const timer = setTimeout(() => {
            this.throttleTimers.delete(key);
        }, delay);

        this.throttleTimers.set(key, timer);
    }

    /**
     * Request animation frame with key-based deduplication
     */
    requestAnimationFrame(key, callback) {
        // Cancel existing RAF for this key
        if (this.rafCallbacks.has(key)) {
            cancelAnimationFrame(this.rafCallbacks.get(key));
        }

        // Schedule new RAF
        const rafId = requestAnimationFrame(() => {
            this.rafCallbacks.delete(key);
            callback();
        });

        this.rafCallbacks.set(key, rafId);
    }

    /**
     * Batch DOM updates using RAF
     */
    batchDOMUpdates(key, updates) {
        this.requestAnimationFrame(key, () => {
            updates.forEach(update => update());
        });
    }

    /**
     * Create intersection observer for lazy loading
     */
    createIntersectionObserver(key, callback, options = {}) {
        const defaultOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver(callback, { ...defaultOptions, ...options });
        this.observers.set(key, observer);
        return observer;
    }

    /**
     * Create resize observer with debouncing
     */
    createResizeObserver(key, callback, debounceDelay = 100) {
        const debouncedCallback = (entries) => {
            this.debounce(`resize-${key}`, () => callback(entries), debounceDelay);
        };

        const observer = new ResizeObserver(debouncedCallback);
        this.observers.set(key, observer);
        return observer;
    }

    /**
     * Memory-efficient event listener management
     */
    addEventListenerWithCleanup(element, event, handler, options = {}) {
        const wrappedHandler = (e) => {
            try {
                handler(e);
            } catch (error) {
                console.error('Error in event handler:', error);
            }
        };

        element.addEventListener(event, wrappedHandler, options);

        // Return cleanup function
        return () => {
            element.removeEventListener(event, wrappedHandler, options);
        };
    }

    /**
     * Efficient DOM element creation with caching
     */
    createElement(tag, attributes = {}, classes = [], cache = false) {
        const element = document.createElement(tag);

        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                element.setAttribute(key, value);
            }
        });

        // Add classes
        if (classes.length > 0) {
            element.classList.add(...classes);
        }

        return element;
    }

    /**
     * Efficient text content updates
     */
    updateTextContent(element, text) {
        if (element.textContent !== text) {
            element.textContent = text;
        }
    }

    /**
     * Efficient class list updates
     */
    updateClassList(element, classesToAdd = [], classesToRemove = []) {
        // Remove classes first
        classesToRemove.forEach(cls => {
            if (element.classList.contains(cls)) {
                element.classList.remove(cls);
            }
        });

        // Add classes
        classesToAdd.forEach(cls => {
            if (!element.classList.contains(cls)) {
                element.classList.add(cls);
            }
        });
    }

    /**
     * Cleanup all timers and observers
     */
    cleanup() {
        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        // Clear throttle timers
        this.throttleTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.clear();

        // Cancel RAF callbacks
        this.rafCallbacks.forEach(rafId => cancelAnimationFrame(rafId));
        this.rafCallbacks.clear();

        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            activeDebounceTimers: this.debounceTimers.size,
            activeThrottleTimers: this.throttleTimers.size,
            activeRAFCallbacks: this.rafCallbacks.size,
            activeObservers: this.observers.size,
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        };
    }
}

/**
 * Virtual Scrolling Implementation
 */
export class VirtualScroller {
    constructor(options) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 50;
        this.bufferSize = options.bufferSize || 5;
        this.renderItem = options.renderItem;
        this.getItemCount = options.getItemCount;
        this.getItemData = options.getItemData;

        // State
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.renderedItems = new Map();

        // Elements
        this.viewport = null;
        this.content = null;
        this.spacerTop = null;
        this.spacerBottom = null;

        // Performance optimizer
        this.optimizer = new PerformanceOptimizer();

        this.initialize();
    }

    initialize() {
        this.createElements();
        this.setupEventListeners();
        this.updateDimensions();
        this.render();
    }

    createElements() {
        // Create viewport
        this.viewport = this.optimizer.createElement('div', {}, ['virtual-scroll-viewport']);
        this.viewport.style.cssText = `
            height: 100%;
            overflow-y: auto;
            position: relative;
        `;

        // Create content container
        this.content = this.optimizer.createElement('div', {}, ['virtual-scroll-content']);
        this.content.style.cssText = `
            position: relative;
            min-height: 100%;
        `;

        // Create spacers
        this.spacerTop = this.optimizer.createElement('div', {}, ['virtual-scroll-spacer-top']);
        this.spacerBottom = this.optimizer.createElement('div', {}, ['virtual-scroll-spacer-bottom']);

        // Assemble structure
        this.content.appendChild(this.spacerTop);
        this.content.appendChild(this.spacerBottom);
        this.viewport.appendChild(this.content);
        this.container.appendChild(this.viewport);
    }

    setupEventListeners() {
        // Scroll handler with throttling
        this.optimizer.addEventListenerWithCleanup(
            this.viewport,
            'scroll',
            () => this.optimizer.throttle('virtual-scroll', () => this.handleScroll(), 16)
        );

        // Resize handler with debouncing
        this.optimizer.createResizeObserver('virtual-scroller', (entries) => {
            this.updateDimensions();
            this.render();
        }).observe(this.container);
    }

    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.updateVisibleRange();
        this.render();
    }

    updateDimensions() {
        const rect = this.container.getBoundingClientRect();
        this.containerHeight = rect.height;
    }

    updateVisibleRange() {
        const itemCount = this.getItemCount();
        const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);

        this.visibleStart = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
        this.visibleEnd = Math.min(itemCount, this.visibleStart + visibleCount + (this.bufferSize * 2));
    }

    render() {
        this.optimizer.requestAnimationFrame('virtual-scroll-render', () => {
            this.renderItems();
            this.updateSpacers();
        });
    }

    renderItems() {
        const itemCount = this.getItemCount();
        
        // Remove items that are no longer visible
        for (const [index, element] of this.renderedItems) {
            if (index < this.visibleStart || index >= this.visibleEnd) {
                element.remove();
                this.renderedItems.delete(index);
            }
        }

        // Add new visible items
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            if (!this.renderedItems.has(i)) {
                const itemData = this.getItemData(i);
                const element = this.renderItem(itemData, i);
                
                // Position the element
                element.style.position = 'absolute';
                element.style.top = `${i * this.itemHeight}px`;
                element.style.width = '100%';
                element.style.height = `${this.itemHeight}px`;

                this.content.insertBefore(element, this.spacerBottom);
                this.renderedItems.set(i, element);
            }
        }
    }

    updateSpacers() {
        const itemCount = this.getItemCount();
        const totalHeight = itemCount * this.itemHeight;

        // Update top spacer
        const topSpacerHeight = this.visibleStart * this.itemHeight;
        this.spacerTop.style.height = `${topSpacerHeight}px`;

        // Update bottom spacer
        const bottomSpacerHeight = (itemCount - this.visibleEnd) * this.itemHeight;
        this.spacerBottom.style.height = `${bottomSpacerHeight}px`;

        // Update content height
        this.content.style.height = `${totalHeight}px`;
    }

    scrollToIndex(index) {
        const scrollTop = index * this.itemHeight;
        this.viewport.scrollTop = scrollTop;
    }

    scrollToTop() {
        this.viewport.scrollTop = 0;
    }

    scrollToBottom() {
        this.viewport.scrollTop = this.viewport.scrollHeight;
    }

    refresh() {
        this.updateVisibleRange();
        this.render();
    }

    destroy() {
        this.optimizer.cleanup();
        this.renderedItems.clear();
        if (this.viewport && this.viewport.parentNode) {
            this.viewport.parentNode.removeChild(this.viewport);
        }
    }
}

/**
 * Memory Manager for long-running sessions
 */
export class MemoryManager {
    constructor(options = {}) {
        this.maxCacheSize = options.maxCacheSize || 1000;
        this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
        this.maxAge = options.maxAge || 300000; // 5 minutes

        this.cache = new Map();
        this.accessTimes = new Map();
        this.cleanupTimer = null;

        this.startCleanup();
    }

    set(key, value) {
        // Remove oldest items if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldest();
        }

        this.cache.set(key, value);
        this.accessTimes.set(key, Date.now());
    }

    get(key) {
        if (this.cache.has(key)) {
            this.accessTimes.set(key, Date.now());
            return this.cache.get(key);
        }
        return null;
    }

    has(key) {
        return this.cache.has(key);
    }

    delete(key) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
    }

    clear() {
        this.cache.clear();
        this.accessTimes.clear();
    }

    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, time] of this.accessTimes) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    cleanup() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, time] of this.accessTimes) {
            if (now - time > this.maxAge) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.delete(key));

        console.log(`Memory cleanup: removed ${keysToDelete.length} expired items`);
    }

    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    getStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            memoryUsage: this.cache.size / this.maxCacheSize * 100
        };
    }

    destroy() {
        this.stopCleanup();
        this.clear();
    }
}

// Global performance optimizer instance
export const globalOptimizer = new PerformanceOptimizer();