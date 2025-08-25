/**
 * Context Menu Service
 * Handles context menus for file operations and prompt management
 */

export class ContextMenuService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // State
        this.activeMenu = null;
        this.menuContainer = null;
        
        // Bind methods
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
    }

    /**
     * Initialize the service
     */
    async initialize() {
        this.createMenuContainer();
        this.setupEventListeners();
        console.log('✅ ContextMenuService initialized');
    }

    /**
     * Create menu container
     */
    createMenuContainer() {
        this.menuContainer = document.createElement('div');
        this.menuContainer.id = 'context-menu-container';
        this.menuContainer.className = 'context-menu-container';
        
        // Add styles
        const styles = `
            .context-menu-container {
                position: fixed;
                z-index: var(--z-context-menu, 1001);
                pointer-events: none;
            }
            
            .context-menu {
                background: var(--vscode-menu-background);
                border: 1px solid var(--vscode-menu-border);
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                min-width: 200px;
                max-width: 300px;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95);
                transition: all 0.1s ease-out;
                pointer-events: auto;
            }
            
            .context-menu.show {
                opacity: 1;
                transform: scale(1);
            }
            
            .context-menu-section {
                padding: 4px 0;
            }
            
            .context-menu-section:not(:last-child) {
                border-bottom: 1px solid var(--vscode-menu-separatorBackground);
            }
            
            .context-menu-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                cursor: pointer;
                font-size: 13px;
                color: var(--vscode-menu-foreground);
                transition: background-color 0.1s ease-out;
                user-select: none;
            }
            
            .context-menu-item:hover {
                background: var(--vscode-menu-selectionBackground);
                color: var(--vscode-menu-selectionForeground);
            }
            
            .context-menu-item.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .context-menu-item.disabled:hover {
                background: transparent;
                color: var(--vscode-menu-foreground);
            }
            
            .context-menu-item.danger:hover {
                background: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-inputValidation-errorForeground);
            }
            
            .context-menu-icon {
                width: 16px;
                height: 16px;
                margin-right: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .context-menu-label {
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .context-menu-shortcut {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                margin-left: 12px;
                font-family: var(--vscode-editor-font-family, monospace);
            }
            
            .context-menu-submenu-arrow {
                margin-left: 8px;
                font-size: 10px;
                color: var(--vscode-descriptionForeground);
            }
            
            /* Animation classes */
            .context-menu.fade-in {
                animation: contextMenuFadeIn 0.1s ease-out forwards;
            }
            
            .context-menu.fade-out {
                animation: contextMenuFadeOut 0.1s ease-out forwards;
            }
            
            @keyframes contextMenuFadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(-4px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            @keyframes contextMenuFadeOut {
                from {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: scale(0.95) translateY(-4px);
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        
        document.body.appendChild(this.menuContainer);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.addEventListener('click', this.handleDocumentClick);
        document.addEventListener('keydown', this.handleDocumentKeyDown);
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    }

    /**
     * Handle context menu events
     */
    handleContextMenu(event) {
        // Find the closest element with context menu data
        const target = event.target.closest('[data-context-menu]');
        if (!target) return;
        
        event.preventDefault();
        
        const menuType = target.dataset.contextMenu;
        const menuData = this.getContextMenuData(target);
        
        this.showContextMenu(event.clientX, event.clientY, menuType, menuData);
    }

    /**
     * Get context menu data from element
     */
    getContextMenuData(element) {
        const data = {};
        
        // Extract data attributes
        Object.keys(element.dataset).forEach(key => {
            if (key.startsWith('menu')) {
                const dataKey = key.replace('menu', '').toLowerCase();
                data[dataKey] = element.dataset[key];
            }
        });
        
        return data;
    }

    /**
     * Show context menu
     */
    showContextMenu(x, y, type, data = {}) {
        this.hideContextMenu();
        
        const menuItems = this.getMenuItems(type, data);
        if (!menuItems || menuItems.length === 0) return;
        
        const menu = this.createMenu(menuItems);
        this.menuContainer.appendChild(menu);
        
        // Position menu
        this.positionMenu(menu, x, y);
        
        // Show with animation
        requestAnimationFrame(() => {
            menu.classList.add('show', 'fade-in');
        });
        
        this.activeMenu = menu;
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        if (this.activeMenu) {
            this.activeMenu.classList.add('fade-out');
            
            setTimeout(() => {
                if (this.activeMenu && this.activeMenu.parentNode) {
                    this.activeMenu.parentNode.removeChild(this.activeMenu);
                }
                this.activeMenu = null;
            }, 100);
        }
    }

    /**
     * Get menu items for type
     */
    getMenuItems(type, data) {
        switch (type) {
            case 'file':
                return this.getFileMenuItems(data);
            case 'folder':
                return this.getFolderMenuItems(data);
            case 'prompt':
                return this.getPromptMenuItems(data);
            case 'commit':
                return this.getCommitMenuItems(data);
            case 'branch':
                return this.getBranchMenuItems(data);
            default:
                return [];
        }
    }

    /**
     * Get file menu items
     */
    getFileMenuItems(data) {
        return [
            {
                icon: '📂',
                label: 'Open',
                shortcut: 'Enter',
                action: () => this.openFile(data.path)
            },
            {
                icon: '👁️',
                label: 'Preview',
                action: () => this.previewFile(data.path)
            },
            { separator: true },
            {
                icon: '📋',
                label: 'Copy Path',
                shortcut: 'Ctrl+C',
                action: () => this.copyPath(data.path)
            },
            {
                icon: '📋',
                label: 'Copy Relative Path',
                action: () => this.copyRelativePath(data.path)
            },
            { separator: true },
            {
                icon: '🔄',
                label: 'Refresh',
                shortcut: 'F5',
                action: () => this.refreshFile(data.path)
            },
            { separator: true },
            {
                icon: '🗑️',
                label: 'Delete',
                shortcut: 'Del',
                danger: true,
                action: () => this.deleteFile(data.path)
            }
        ];
    }

    /**
     * Get folder menu items
     */
    getFolderMenuItems(data) {
        return [
            {
                icon: data.expanded ? '📂' : '📁',
                label: data.expanded ? 'Collapse' : 'Expand',
                shortcut: data.expanded ? '←' : '→',
                action: () => this.toggleFolder(data.path, data.expanded)
            },
            { separator: true },
            {
                icon: '📄',
                label: 'New File',
                shortcut: 'Ctrl+N',
                action: () => this.createFile(data.path)
            },
            {
                icon: '📁',
                label: 'New Folder',
                shortcut: 'Ctrl+Shift+N',
                action: () => this.createFolder(data.path)
            },
            { separator: true },
            {
                icon: '📋',
                label: 'Copy Path',
                action: () => this.copyPath(data.path)
            },
            { separator: true },
            {
                icon: '🔄',
                label: 'Refresh',
                shortcut: 'F5',
                action: () => this.refreshFolder(data.path)
            },
            { separator: true },
            {
                icon: '🗑️',
                label: 'Delete',
                shortcut: 'Del',
                danger: true,
                action: () => this.deleteFolder(data.path)
            }
        ];
    }

    /**
     * Get prompt menu items
     */
    getPromptMenuItems(data) {
        return [
            {
                icon: '🔄',
                label: 'Reuse Prompt',
                action: () => this.reusePrompt(data.id)
            },
            {
                icon: '✏️',
                label: 'Edit and Send',
                action: () => this.editPrompt(data.id)
            },
            { separator: true },
            {
                icon: '📋',
                label: 'Copy to Clipboard',
                shortcut: 'Ctrl+C',
                action: () => this.copyPrompt(data.id)
            },
            {
                icon: '🏷️',
                label: 'Add Tags',
                action: () => this.tagPrompt(data.id)
            },
            {
                icon: data.favorite ? '💔' : '❤️',
                label: data.favorite ? 'Remove from Favorites' : 'Add to Favorites',
                action: () => this.togglePromptFavorite(data.id, data.favorite)
            },
            { separator: true },
            {
                icon: '📤',
                label: 'Export',
                action: () => this.exportPrompt(data.id)
            },
            { separator: true },
            {
                icon: '🗑️',
                label: 'Delete',
                shortcut: 'Del',
                danger: true,
                action: () => this.deletePrompt(data.id)
            }
        ];
    }

    /**
     * Get commit menu items
     */
    getCommitMenuItems(data) {
        return [
            {
                icon: '👁️',
                label: 'View Changes',
                action: () => this.viewCommitChanges(data.hash)
            },
            {
                icon: '📋',
                label: 'Copy Hash',
                action: () => this.copyCommitHash(data.hash)
            },
            {
                icon: '📋',
                label: 'Copy Message',
                action: () => this.copyCommitMessage(data.message)
            },
            { separator: true },
            {
                icon: '🔄',
                label: 'Revert',
                danger: true,
                action: () => this.revertCommit(data.hash)
            }
        ];
    }

    /**
     * Get branch menu items
     */
    getBranchMenuItems(data) {
        const items = [];
        
        if (!data.current) {
            items.push({
                icon: '🔄',
                label: 'Switch to Branch',
                action: () => this.switchBranch(data.name)
            });
        }
        
        items.push(
            {
                icon: '🔀',
                label: 'Merge into Current',
                action: () => this.mergeBranch(data.name)
            },
            { separator: true },
            {
                icon: '📋',
                label: 'Copy Branch Name',
                action: () => this.copyBranchName(data.name)
            }
        );
        
        if (!data.current) {
            items.push(
                { separator: true },
                {
                    icon: '🗑️',
                    label: 'Delete Branch',
                    danger: true,
                    action: () => this.deleteBranch(data.name)
                }
            );
        }
        
        return items;
    }

    /**
     * Create menu element
     */
    createMenu(items) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        
        let currentSection = null;
        
        items.forEach(item => {
            if (item.separator) {
                if (currentSection) {
                    menu.appendChild(currentSection);
                }
                currentSection = document.createElement('div');
                currentSection.className = 'context-menu-section';
                return;
            }
            
            if (!currentSection) {
                currentSection = document.createElement('div');
                currentSection.className = 'context-menu-section';
            }
            
            const menuItem = document.createElement('div');
            menuItem.className = `context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`;
            
            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = 'context-menu-icon';
                icon.textContent = item.icon;
                menuItem.appendChild(icon);
            }
            
            const label = document.createElement('span');
            label.className = 'context-menu-label';
            label.textContent = item.label;
            menuItem.appendChild(label);
            
            if (item.shortcut) {
                const shortcut = document.createElement('span');
                shortcut.className = 'context-menu-shortcut';
                shortcut.textContent = item.shortcut;
                menuItem.appendChild(shortcut);
            }
            
            if (!item.disabled && item.action) {
                menuItem.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.hideContextMenu();
                    item.action();
                });
            }
            
            currentSection.appendChild(menuItem);
        });
        
        if (currentSection) {
            menu.appendChild(currentSection);
        }
        
        return menu;
    }

    /**
     * Position menu
     */
    positionMenu(menu, x, y) {
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Get menu dimensions
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        const menuRect = menu.getBoundingClientRect();
        menu.style.visibility = '';
        menu.style.display = '';
        
        // Calculate position
        let left = x;
        let top = y;
        
        // Adjust if menu would go off-screen
        if (left + menuRect.width > viewportWidth) {
            left = viewportWidth - menuRect.width - 8;
        }
        
        if (top + menuRect.height > viewportHeight) {
            top = viewportHeight - menuRect.height - 8;
        }
        
        // Ensure menu is not positioned off-screen
        left = Math.max(8, left);
        top = Math.max(8, top);
        
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    /**
     * Handle document click
     */
    handleDocumentClick(event) {
        if (this.activeMenu && !this.activeMenu.contains(event.target)) {
            this.hideContextMenu();
        }
    }

    /**
     * Handle document keydown
     */
    handleDocumentKeyDown(event) {
        if (event.key === 'Escape' && this.activeMenu) {
            this.hideContextMenu();
        }
    }

    // Action methods
    openFile(path) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'open-file', path }
        });
        document.dispatchEvent(event);
    }

    previewFile(path) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'preview-file', path }
        });
        document.dispatchEvent(event);
    }

    copyPath(path) {
        navigator.clipboard.writeText(path).then(() => {
            this.notificationService.success('Copied', `Path copied to clipboard: ${path}`);
        }).catch(() => {
            this.notificationService.error('Error', 'Failed to copy path to clipboard');
        });
    }

    copyRelativePath(path) {
        // Implement relative path logic
        const relativePath = path; // Simplified for now
        this.copyPath(relativePath);
    }

    refreshFile(path) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'refresh-file', path }
        });
        document.dispatchEvent(event);
    }

    deleteFile(path) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'delete-file', path }
        });
        document.dispatchEvent(event);
    }

    toggleFolder(path, expanded) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: expanded ? 'collapse-folder' : 'expand-folder', path }
        });
        document.dispatchEvent(event);
    }

    createFile(parentPath) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'create-file', parentPath }
        });
        document.dispatchEvent(event);
    }

    createFolder(parentPath) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'create-folder', parentPath }
        });
        document.dispatchEvent(event);
    }

    refreshFolder(path) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'refresh-folder', path }
        });
        document.dispatchEvent(event);
    }

    deleteFolder(path) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'delete-folder', path }
        });
        document.dispatchEvent(event);
    }

    reusePrompt(id) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'reuse-prompt', id }
        });
        document.dispatchEvent(event);
    }

    editPrompt(id) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'edit-prompt', id }
        });
        document.dispatchEvent(event);
    }

    copyPrompt(id) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'copy-prompt', id }
        });
        document.dispatchEvent(event);
    }

    tagPrompt(id) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'tag-prompt', id }
        });
        document.dispatchEvent(event);
    }

    togglePromptFavorite(id, favorite) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'toggle-prompt-favorite', id, favorite }
        });
        document.dispatchEvent(event);
    }

    exportPrompt(id) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'export-prompt', id }
        });
        document.dispatchEvent(event);
    }

    deletePrompt(id) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'delete-prompt', id }
        });
        document.dispatchEvent(event);
    }

    viewCommitChanges(hash) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'view-commit-changes', hash }
        });
        document.dispatchEvent(event);
    }

    copyCommitHash(hash) {
        this.copyPath(hash);
    }

    copyCommitMessage(message) {
        this.copyPath(message);
    }

    revertCommit(hash) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'revert-commit', hash }
        });
        document.dispatchEvent(event);
    }

    switchBranch(name) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'switch-branch', name }
        });
        document.dispatchEvent(event);
    }

    mergeBranch(name) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'merge-branch', name }
        });
        document.dispatchEvent(event);
    }

    copyBranchName(name) {
        this.copyPath(name);
    }

    deleteBranch(name) {
        const event = new CustomEvent('context-menu-action', {
            detail: { action: 'delete-branch', name }
        });
        document.dispatchEvent(event);
    }

    /**
     * Destroy the service
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleDocumentKeyDown);
        
        // Hide active menu
        this.hideContextMenu();
        
        // Remove container
        if (this.menuContainer && this.menuContainer.parentNode) {
            this.menuContainer.parentNode.removeChild(this.menuContainer);
        }
        
        console.log('✅ ContextMenuService destroyed');
    }
}