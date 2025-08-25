/**
 * Keyboard Shortcut Service
 * Handles keyboard shortcuts and accessibility features
 */

export class KeyboardShortcutService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // Shortcut registry
        this.shortcuts = new Map();
        this.contexts = new Map();
        this.activeContext = 'global';
        
        // State
        this.enabled = true;
        this.showHints = false;
        
        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        // Initialize default shortcuts
        this.initializeDefaultShortcuts();
    }

    /**
     * Initialize the service
     */
    async initialize() {
        // Add event listeners
        document.addEventListener('keydown', this.handleKeyDown, true);
        document.addEventListener('keyup', this.handleKeyUp, true);
        
        // Create shortcut hint overlay
        this.createHintOverlay();
        
        console.log('✅ KeyboardShortcutService initialized');
    }

    /**
     * Initialize default shortcuts
     */
    initializeDefaultShortcuts() {
        // Global shortcuts
        this.registerShortcut('global', {
            key: 'k',
            modifiers: ['cmd'],
            description: 'Focus command input',
            action: () => this.focusCommandInput()
        });

        this.registerShortcut('global', {
            key: 'b',
            modifiers: ['cmd'],
            description: 'Toggle sidebar',
            action: () => this.toggleSidebar()
        });

        this.registerShortcut('global', {
            key: 'p',
            modifiers: ['cmd', 'shift'],
            description: 'Show command palette',
            action: () => this.showCommandPalette()
        });

        this.registerShortcut('global', {
            key: '1',
            modifiers: ['cmd'],
            description: 'Switch to Prompt section',
            action: () => this.switchToSection('prompt')
        });

        this.registerShortcut('global', {
            key: '2',
            modifiers: ['cmd'],
            description: 'Switch to Git section',
            action: () => this.switchToSection('git')
        });

        this.registerShortcut('global', {
            key: '3',
            modifiers: ['cmd'],
            description: 'Switch to Files section',
            action: () => this.switchToSection('files')
        });

        this.registerShortcut('global', {
            key: '4',
            modifiers: ['cmd'],
            description: 'Switch to Info section',
            action: () => this.switchToSection('info')
        });

        this.registerShortcut('global', {
            key: 'Escape',
            modifiers: [],
            description: 'Close overlays',
            action: () => this.closeOverlays()
        });

        this.registerShortcut('global', {
            key: '?',
            modifiers: ['cmd'],
            description: 'Show keyboard shortcuts',
            action: () => this.toggleShortcutHints()
        });

        // Chat context shortcuts
        this.registerShortcut('chat', {
            key: 'Enter',
            modifiers: ['cmd'],
            description: 'Send message',
            action: () => this.sendMessage()
        });

        this.registerShortcut('chat', {
            key: 'ArrowUp',
            modifiers: [],
            description: 'Previous message in history',
            action: () => this.navigateMessageHistory('up')
        });

        this.registerShortcut('chat', {
            key: 'ArrowDown',
            modifiers: [],
            description: 'Next message in history',
            action: () => this.navigateMessageHistory('down')
        });

        // File manager shortcuts
        this.registerShortcut('files', {
            key: 'Enter',
            modifiers: [],
            description: 'Open selected file',
            action: () => this.openSelectedFile()
        });

        this.registerShortcut('files', {
            key: 'ArrowRight',
            modifiers: [],
            description: 'Expand folder',
            action: () => this.expandSelectedFolder()
        });

        this.registerShortcut('files', {
            key: 'ArrowLeft',
            modifiers: [],
            description: 'Collapse folder',
            action: () => this.collapseSelectedFolder()
        });

        // Git shortcuts
        this.registerShortcut('git', {
            key: 'r',
            modifiers: ['cmd'],
            description: 'Refresh git status',
            action: () => this.refreshGitStatus()
        });
    }

    /**
     * Register a keyboard shortcut
     */
    registerShortcut(context, shortcut) {
        if (!this.contexts.has(context)) {
            this.contexts.set(context, new Map());
        }
        
        const contextShortcuts = this.contexts.get(context);
        const key = this.createShortcutKey(shortcut.key, shortcut.modifiers);
        
        contextShortcuts.set(key, {
            ...shortcut,
            id: `${context}-${key}`
        });
        
        this.shortcuts.set(`${context}-${key}`, shortcut);
    }

    /**
     * Unregister a keyboard shortcut
     */
    unregisterShortcut(context, key, modifiers = []) {
        const contextShortcuts = this.contexts.get(context);
        if (contextShortcuts) {
            const shortcutKey = this.createShortcutKey(key, modifiers);
            contextShortcuts.delete(shortcutKey);
            this.shortcuts.delete(`${context}-${shortcutKey}`);
        }
    }

    /**
     * Set active context
     */
    setContext(context) {
        this.activeContext = context;
    }

    /**
     * Handle keydown events
     */
    handleKeyDown(event) {
        if (!this.enabled) return;
        
        // Skip if in input fields (unless specifically handled)
        if (this.isInputElement(event.target) && !this.shouldHandleInInput(event)) {
            return;
        }
        
        const shortcutKey = this.createShortcutKeyFromEvent(event);
        
        // Try context-specific shortcuts first
        const contextShortcuts = this.contexts.get(this.activeContext);
        if (contextShortcuts && contextShortcuts.has(shortcutKey)) {
            const shortcut = contextShortcuts.get(shortcutKey);
            event.preventDefault();
            event.stopPropagation();
            shortcut.action(event);
            return;
        }
        
        // Try global shortcuts
        const globalShortcuts = this.contexts.get('global');
        if (globalShortcuts && globalShortcuts.has(shortcutKey)) {
            const shortcut = globalShortcuts.get(shortcutKey);
            event.preventDefault();
            event.stopPropagation();
            shortcut.action(event);
            return;
        }
    }

    /**
     * Handle keyup events
     */
    handleKeyUp(event) {
        // Handle any keyup-specific logic here
    }

    /**
     * Create shortcut key string
     */
    createShortcutKey(key, modifiers = []) {
        const normalizedModifiers = modifiers
            .map(mod => mod.toLowerCase())
            .sort()
            .join('+');
        
        return normalizedModifiers ? `${normalizedModifiers}+${key.toLowerCase()}` : key.toLowerCase();
    }

    /**
     * Create shortcut key from keyboard event
     */
    createShortcutKeyFromEvent(event) {
        const modifiers = [];
        
        if (event.ctrlKey || event.metaKey) modifiers.push('cmd');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');
        
        return this.createShortcutKey(event.key, modifiers);
    }

    /**
     * Check if element is an input element
     */
    isInputElement(element) {
        const inputTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        return inputTags.includes(element.tagName) || 
               element.contentEditable === 'true' ||
               element.isContentEditable;
    }

    /**
     * Check if shortcut should be handled in input elements
     */
    shouldHandleInInput(event) {
        // Allow certain shortcuts in input elements
        const allowedInInput = [
            'cmd+a', 'cmd+c', 'cmd+v', 'cmd+x', 'cmd+z', 'cmd+y',
            'cmd+enter', 'escape'
        ];
        
        const shortcutKey = this.createShortcutKeyFromEvent(event);
        return allowedInInput.includes(shortcutKey);
    }

    /**
     * Create hint overlay
     */
    createHintOverlay() {
        this.hintOverlay = document.createElement('div');
        this.hintOverlay.className = 'shortcut-hints-overlay';
        this.hintOverlay.innerHTML = `
            <div class="shortcut-hints-container">
                <div class="shortcut-hints-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="shortcut-hints-close" aria-label="Close shortcuts">×</button>
                </div>
                <div class="shortcut-hints-content">
                    <!-- Shortcuts will be populated here -->
                </div>
            </div>
        `;
        
        // Add styles
        const styles = `
            .shortcut-hints-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: var(--z-modal, 1000);
                display: none;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s ease-out;
            }
            
            .shortcut-hints-overlay.show {
                display: flex;
                opacity: 1;
            }
            
            .shortcut-hints-container {
                background: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                max-width: 600px;
                max-height: 80vh;
                overflow: hidden;
                transform: scale(0.9);
                transition: transform 0.2s ease-out;
            }
            
            .shortcut-hints-overlay.show .shortcut-hints-container {
                transform: scale(1);
            }
            
            .shortcut-hints-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid var(--vscode-dropdown-border);
                background: var(--vscode-editorGroupHeader-tabsBackground);
            }
            
            .shortcut-hints-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--vscode-foreground);
            }
            
            .shortcut-hints-close {
                background: none;
                border: none;
                color: var(--vscode-icon-foreground);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                font-size: 18px;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .shortcut-hints-close:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }
            
            .shortcut-hints-content {
                padding: 20px;
                max-height: 60vh;
                overflow-y: auto;
            }
            
            .shortcut-section {
                margin-bottom: 24px;
            }
            
            .shortcut-section:last-child {
                margin-bottom: 0;
            }
            
            .shortcut-section-title {
                font-size: 14px;
                font-weight: 600;
                color: var(--vscode-foreground);
                margin-bottom: 12px;
                padding-bottom: 4px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            
            .shortcut-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .shortcut-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 0;
            }
            
            .shortcut-description {
                font-size: 13px;
                color: var(--vscode-foreground);
            }
            
            .shortcut-keys {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .shortcut-key {
                background: var(--vscode-keybindingLabel-background);
                border: 1px solid var(--vscode-keybindingLabel-border);
                color: var(--vscode-keybindingLabel-foreground);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                font-family: var(--vscode-editor-font-family, monospace);
                min-width: 20px;
                text-align: center;
            }
            
            .shortcut-plus {
                color: var(--vscode-descriptionForeground);
                font-size: 10px;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        
        // Add event listeners
        this.hintOverlay.querySelector('.shortcut-hints-close').addEventListener('click', () => {
            this.hideShortcutHints();
        });
        
        this.hintOverlay.addEventListener('click', (event) => {
            if (event.target === this.hintOverlay) {
                this.hideShortcutHints();
            }
        });
        
        document.body.appendChild(this.hintOverlay);
    }

    /**
     * Toggle shortcut hints
     */
    toggleShortcutHints() {
        if (this.showHints) {
            this.hideShortcutHints();
        } else {
            this.showShortcutHints();
        }
    }

    /**
     * Show shortcut hints
     */
    showShortcutHints() {
        this.populateShortcutHints();
        this.hintOverlay.classList.add('show');
        this.showHints = true;
    }

    /**
     * Hide shortcut hints
     */
    hideShortcutHints() {
        this.hintOverlay.classList.remove('show');
        this.showHints = false;
    }

    /**
     * Populate shortcut hints
     */
    populateShortcutHints() {
        const content = this.hintOverlay.querySelector('.shortcut-hints-content');
        content.innerHTML = '';
        
        // Group shortcuts by context
        const contextGroups = {
            'Global': 'global',
            'Chat': 'chat',
            'Files': 'files',
            'Git': 'git'
        };
        
        Object.entries(contextGroups).forEach(([title, context]) => {
            const contextShortcuts = this.contexts.get(context);
            if (!contextShortcuts || contextShortcuts.size === 0) return;
            
            const section = document.createElement('div');
            section.className = 'shortcut-section';
            
            const sectionTitle = document.createElement('div');
            sectionTitle.className = 'shortcut-section-title';
            sectionTitle.textContent = title;
            section.appendChild(sectionTitle);
            
            const shortcutList = document.createElement('div');
            shortcutList.className = 'shortcut-list';
            
            contextShortcuts.forEach(shortcut => {
                const item = document.createElement('div');
                item.className = 'shortcut-item';
                
                const description = document.createElement('div');
                description.className = 'shortcut-description';
                description.textContent = shortcut.description;
                
                const keys = document.createElement('div');
                keys.className = 'shortcut-keys';
                keys.innerHTML = this.formatShortcutKeys(shortcut.key, shortcut.modifiers);
                
                item.appendChild(description);
                item.appendChild(keys);
                shortcutList.appendChild(item);
            });
            
            section.appendChild(shortcutList);
            content.appendChild(section);
        });
    }

    /**
     * Format shortcut keys for display
     */
    formatShortcutKeys(key, modifiers = []) {
        const keyMap = {
            'cmd': navigator.platform.includes('Mac') ? '⌘' : 'Ctrl',
            'shift': '⇧',
            'alt': navigator.platform.includes('Mac') ? '⌥' : 'Alt',
            'Enter': '↵',
            'ArrowUp': '↑',
            'ArrowDown': '↓',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'Escape': 'Esc'
        };
        
        const parts = [];
        
        modifiers.forEach(mod => {
            parts.push(`<span class="shortcut-key">${keyMap[mod] || mod}</span>`);
            parts.push('<span class="shortcut-plus">+</span>');
        });
        
        parts.push(`<span class="shortcut-key">${keyMap[key] || key.toUpperCase()}</span>`);
        
        return parts.join('');
    }

    // Action methods
    focusCommandInput() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'focus-command-input' }
        });
        document.dispatchEvent(event);
    }

    toggleSidebar() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'toggle-sidebar' }
        });
        document.dispatchEvent(event);
    }

    showCommandPalette() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'show-command-palette' }
        });
        document.dispatchEvent(event);
    }

    switchToSection(section) {
        this.stateManager.updateNavigation({ activeSection: section });
    }

    closeOverlays() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'close-overlays' }
        });
        document.dispatchEvent(event);
    }

    sendMessage() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'send-message' }
        });
        document.dispatchEvent(event);
    }

    navigateMessageHistory(direction) {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'navigate-message-history', direction }
        });
        document.dispatchEvent(event);
    }

    openSelectedFile() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'open-selected-file' }
        });
        document.dispatchEvent(event);
    }

    expandSelectedFolder() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'expand-selected-folder' }
        });
        document.dispatchEvent(event);
    }

    collapseSelectedFolder() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'collapse-selected-folder' }
        });
        document.dispatchEvent(event);
    }

    refreshGitStatus() {
        const event = new CustomEvent('keyboard-shortcut', {
            detail: { action: 'refresh-git-status' }
        });
        document.dispatchEvent(event);
    }

    /**
     * Enable/disable shortcuts
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Get all shortcuts for a context
     */
    getShortcuts(context) {
        return this.contexts.get(context) || new Map();
    }

    /**
     * Destroy the service
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown, true);
        document.removeEventListener('keyup', this.handleKeyUp, true);
        
        // Remove hint overlay
        if (this.hintOverlay && this.hintOverlay.parentNode) {
            this.hintOverlay.parentNode.removeChild(this.hintOverlay);
        }
        
        // Clear shortcuts
        this.shortcuts.clear();
        this.contexts.clear();
        
        console.log('✅ KeyboardShortcutService destroyed');
    }
}