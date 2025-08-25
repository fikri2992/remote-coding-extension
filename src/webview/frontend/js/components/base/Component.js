/**
 * Base Component Class
 * Provides common functionality for all UI components
 */

export class Component {
    constructor(options = {}) {
        this.container = options.container;
        this.options = options;
        this.element = null;
        this.isInitialized = false;
        this.isDestroyed = false;
        
        // Event listeners registry for cleanup
        this.eventListeners = new Map();
        
        // Child components registry
        this.childComponents = new Set();
        
        // Unique component ID
        this.id = this.generateId();
    }

    /**
     * Initialize the component
     * Override in subclasses for specific initialization logic
     */
    async initialize() {
        if (this.isInitialized || this.isDestroyed) {
            return;
        }
        
        this.isInitialized = true;
    }

    /**
     * Render the component
     * Override in subclasses to provide specific rendering logic
     */
    render() {
        // Default implementation - subclasses should override
        if (this.container) {
            this.element = this.container;
        }
    }

    /**
     * Update the component with new data
     * Override in subclasses for specific update logic
     */
    update(data) {
        // Default implementation - subclasses should override
    }

    /**
     * Add event listener with automatic cleanup tracking
     */
    addEventListener(element, event, handler, options = {}) {
        if (!element || typeof handler !== 'function') {
            return;
        }
        
        // Create bound handler for proper cleanup
        const boundHandler = handler.bind(this);
        
        // Add listener
        element.addEventListener(event, boundHandler, options);
        
        // Track for cleanup
        const key = `${element.constructor.name}-${event}-${this.generateId()}`;
        this.eventListeners.set(key, {
            element,
            event,
            handler: boundHandler,
            options
        });
        
        return key;
    }

    /**
     * Remove specific event listener
     */
    removeEventListener(key) {
        const listener = this.eventListeners.get(key);
        if (listener) {
            listener.element.removeEventListener(
                listener.event,
                listener.handler,
                listener.options
            );
            this.eventListeners.delete(key);
        }
    }

    /**
     * Add child component for lifecycle management
     */
    addChildComponent(component) {
        if (component && typeof component.destroy === 'function') {
            this.childComponents.add(component);
        }
    }

    /**
     * Remove child component
     */
    removeChildComponent(component) {
        this.childComponents.delete(component);
    }

    /**
     * Create DOM element with attributes and classes
     */
    createElement(tag, attributes = {}, classes = []) {
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
     * Find element within component
     */
    querySelector(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * Find all elements within component
     */
    querySelectorAll(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }

    /**
     * Show the component
     */
    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
            this.element.style.display = '';
        }
    }

    /**
     * Hide the component
     */
    hide() {
        if (this.element) {
            this.element.classList.add('hidden');
        }
    }

    /**
     * Toggle component visibility
     */
    toggle() {
        if (this.element) {
            if (this.element.classList.contains('hidden')) {
                this.show();
            } else {
                this.hide();
            }
        }
    }

    /**
     * Check if component is visible
     */
    isVisible() {
        return this.element && !this.element.classList.contains('hidden');
    }

    /**
     * Add CSS class to component element
     */
    addClass(className) {
        if (this.element && className) {
            this.element.classList.add(className);
        }
    }

    /**
     * Remove CSS class from component element
     */
    removeClass(className) {
        if (this.element && className) {
            this.element.classList.remove(className);
        }
    }

    /**
     * Toggle CSS class on component element
     */
    toggleClass(className) {
        if (this.element && className) {
            this.element.classList.toggle(className);
        }
    }

    /**
     * Check if component element has CSS class
     */
    hasClass(className) {
        return this.element ? this.element.classList.contains(className) : false;
    }

    /**
     * Set component data attribute
     */
    setData(key, value) {
        if (this.element) {
            this.element.dataset[key] = value;
        }
    }

    /**
     * Get component data attribute
     */
    getData(key) {
        return this.element ? this.element.dataset[key] : null;
    }

    /**
     * Emit custom event
     */
    emit(eventName, detail = {}) {
        if (this.element) {
            const event = new CustomEvent(eventName, {
                detail,
                bubbles: true,
                cancelable: true
            });
            this.element.dispatchEvent(event);
        }
    }

    /**
     * Handle resize events
     * Override in subclasses for specific resize handling
     */
    handleResize() {
        // Default implementation - subclasses can override
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get component debug information
     */
    getDebugInfo() {
        return {
            id: this.id,
            isInitialized: this.isInitialized,
            isDestroyed: this.isDestroyed,
            hasElement: !!this.element,
            isVisible: this.isVisible(),
            eventListeners: this.eventListeners.size,
            childComponents: this.childComponents.size
        };
    }

    /**
     * Destroy the component and clean up resources
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }
        
        // Mark as destroyed
        this.isDestroyed = true;
        this.isInitialized = false;
        
        // Destroy child components
        this.childComponents.forEach(component => {
            try {
                component.destroy();
            } catch (error) {
                console.warn('Error destroying child component:', error);
            }
        });
        this.childComponents.clear();
        
        // Remove all event listeners
        this.eventListeners.forEach((listener, key) => {
            try {
                listener.element.removeEventListener(
                    listener.event,
                    listener.handler,
                    listener.options
                );
            } catch (error) {
                console.warn('Error removing event listener:', error);
            }
        });
        this.eventListeners.clear();
        
        // Remove element from DOM if it was created by this component
        if (this.element && this.element.parentNode && this.element !== this.container) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Clear references
        this.element = null;
        this.container = null;
        this.options = null;
    }
}