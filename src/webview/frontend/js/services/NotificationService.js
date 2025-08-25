/**
 * Notification Service
 * Handles user notifications and alerts
 */

export class NotificationService {
    constructor() {
        this.notifications = new Map();
        this.container = null;
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
        
        // Notification types
        this.types = {
            info: { icon: 'ℹ️', className: 'notification-info' },
            success: { icon: '✅', className: 'notification-success' },
            warning: { icon: '⚠️', className: 'notification-warning' },
            error: { icon: '❌', className: 'notification-error' }
        };
    }

    /**
     * Initialize the notification service
     */
    async initialize() {
        this.createContainer();
        console.log('✅ NotificationService initialized');
    }

    /**
     * Create notification container
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        
        // Add container styles
        const styles = `
            .notification-container {
                position: fixed;
                top: 16px;
                right: 16px;
                z-index: var(--z-notification, 1000);
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: 400px;
                pointer-events: none;
            }
            
            .notification {
                background: var(--vscode-notifications-background);
                border: 1px solid var(--vscode-notifications-border);
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                overflow: hidden;
                pointer-events: auto;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s ease-out;
                max-width: 100%;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification.hide {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .notification-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                border-bottom: 1px solid var(--vscode-notifications-border);
            }
            
            .notification-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: var(--vscode-notifications-foreground);
            }
            
            .notification-close {
                background: none;
                border: none;
                color: var(--vscode-icon-foreground);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                font-size: 16px;
            }
            
            .notification-close:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }
            
            .notification-body {
                padding: 12px 16px;
                color: var(--vscode-notifications-foreground);
                font-size: 13px;
                line-height: 1.4;
                word-wrap: break-word;
            }
            
            .notification-actions {
                padding: 8px 16px;
                border-top: 1px solid var(--vscode-notifications-border);
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            
            .notification-progress {
                height: 3px;
                background: var(--vscode-progressBar-background);
                position: relative;
                overflow: hidden;
            }
            
            .notification-progress-bar {
                height: 100%;
                background: var(--vscode-progressBar-foreground);
                width: 100%;
                transform: translateX(-100%);
                transition: transform linear;
            }
            
            .notification-progress-bar.animate {
                transform: translateX(0);
            }
            
            /* Type-specific styles */
            .notification-success .notification-progress-bar {
                background: var(--vscode-testing-iconPassed);
            }
            
            .notification-warning .notification-progress-bar {
                background: var(--vscode-testing-iconQueued);
            }
            
            .notification-error .notification-progress-bar {
                background: var(--vscode-testing-iconFailed);
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                .notification-container {
                    top: 8px;
                    right: 8px;
                    left: 8px;
                    max-width: none;
                }
                
                .notification {
                    transform: translateY(-100%);
                }
                
                .notification.show {
                    transform: translateY(0);
                }
                
                .notification.hide {
                    transform: translateY(-100%);
                }
            }
        `;
        
        // Add styles to document
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        
        // Add container to document
        document.body.appendChild(this.container);
    }

    /**
     * Show notification
     */
    show(options) {
        const notification = this.createNotification(options);
        
        // Add to container
        this.container.appendChild(notification.element);
        
        // Store notification
        this.notifications.set(notification.id, notification);
        
        // Show with animation
        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });
        
        // Auto-hide if duration is set
        if (notification.duration > 0) {
            this.scheduleHide(notification.id, notification.duration);
        }
        
        // Limit number of notifications
        this.limitNotifications();
        
        return notification.id;
    }

    /**
     * Create notification element
     */
    createNotification(options) {
        const {
            title = 'Notification',
            message = '',
            type = 'info',
            duration = this.defaultDuration,
            actions = [],
            persistent = false
        } = options;
        
        const id = this.generateId();
        const typeConfig = this.types[type] || this.types.info;
        
        // Create notification element
        const element = document.createElement('div');
        element.className = `notification ${typeConfig.className}`;
        element.dataset.id = id;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'notification-header';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        titleElement.innerHTML = `
            <span class="notification-icon">${typeConfig.icon}</span>
            <span>${this.escapeHtml(title)}</span>
        `;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => this.hide(id));
        
        header.appendChild(titleElement);
        if (!persistent) {
            header.appendChild(closeButton);
        }
        
        element.appendChild(header);
        
        // Create body if message exists
        if (message) {
            const body = document.createElement('div');
            body.className = 'notification-body';
            body.textContent = message;
            element.appendChild(body);
        }
        
        // Create actions if provided
        if (actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'notification-actions';
            
            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = `btn btn-sm ${action.primary ? 'btn-primary' : 'btn-secondary'}`;
                button.textContent = action.label;
                button.addEventListener('click', () => {
                    if (action.handler) {
                        action.handler();
                    }
                    if (action.dismiss !== false) {
                        this.hide(id);
                    }
                });
                actionsContainer.appendChild(button);
            });
            
            element.appendChild(actionsContainer);
        }
        
        // Create progress bar for timed notifications
        if (duration > 0) {
            const progress = document.createElement('div');
            progress.className = 'notification-progress';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress-bar';
            progressBar.style.transitionDuration = `${duration}ms`;
            
            progress.appendChild(progressBar);
            element.appendChild(progress);
            
            // Start progress animation
            requestAnimationFrame(() => {
                progressBar.classList.add('animate');
            });
        }
        
        return {
            id,
            element,
            type,
            duration,
            persistent,
            createdAt: Date.now()
        };
    }

    /**
     * Hide notification
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) {
            return;
        }
        
        // Add hide animation
        notification.element.classList.remove('show');
        notification.element.classList.add('hide');
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * Hide all notifications
     */
    hideAll() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }

    /**
     * Schedule notification hide
     */
    scheduleHide(id, duration) {
        setTimeout(() => {
            this.hide(id);
        }, duration);
    }

    /**
     * Limit number of notifications
     */
    limitNotifications() {
        const notificationArray = Array.from(this.notifications.values());
        
        if (notificationArray.length > this.maxNotifications) {
            // Remove oldest non-persistent notifications
            const sortedNotifications = notificationArray
                .filter(n => !n.persistent)
                .sort((a, b) => a.createdAt - b.createdAt);
            
            const toRemove = sortedNotifications.slice(0, notificationArray.length - this.maxNotifications);
            toRemove.forEach(notification => {
                this.hide(notification.id);
            });
        }
    }

    /**
     * Show success notification
     */
    success(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'success',
            ...options
        });
    }

    /**
     * Show error notification
     */
    error(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'error',
            duration: 0, // Errors don't auto-hide by default
            ...options
        });
    }

    /**
     * Show warning notification
     */
    warning(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'warning',
            ...options
        });
    }

    /**
     * Show info notification
     */
    info(title, message, options = {}) {
        return this.show({
            title,
            message,
            type: 'info',
            ...options
        });
    }

    /**
     * Get active notifications
     */
    getActiveNotifications() {
        return Array.from(this.notifications.values()).map(n => ({
            id: n.id,
            type: n.type,
            createdAt: n.createdAt,
            persistent: n.persistent
        }));
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Destroy the notification service
     */
    destroy() {
        // Hide all notifications
        this.hideAll();
        
        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // Clear notifications
        this.notifications.clear();
        
        this.container = null;
    }
}