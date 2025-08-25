/**
 * FileManager Component - Interactive file browser with VS Code integration
 */

import { Component } from './base/Component.js';
import { FileTree } from './files/FileTree.js';

export class FileManager extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // File manager state
        this.rootNodes = [];
        this.selectedFile = null;
        this.expandedPaths = new Set();
        this.searchQuery = '';
        this.filteredNodes = null;
        this.isLoading = false;

        // Child components
        this.fileTree = null;

        // File type icons mapping
        this.fileIcons = {
            // Folders
            'folder': '📁',
            'folder-open': '📂',
            
            // JavaScript/TypeScript
            'js': '📄',
            'ts': '📘',
            'jsx': '⚛️',
            'tsx': '⚛️',
            'json': '📋',
            
            // Web files
            'html': '🌐',
            'css': '🎨',
            'scss': '🎨',
            'sass': '🎨',
            'less': '🎨',
            
            // Images
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'svg': '🖼️',
            'ico': '🖼️',
            
            // Documents
            'md': '📝',
            'txt': '📄',
            'pdf': '📕',
            'doc': '📄',
            'docx': '📄',
            
            // Config files
            'gitignore': '🚫',
            'env': '⚙️',
            'config': '⚙️',
            'yml': '⚙️',
            'yaml': '⚙️',
            'toml': '⚙️',
            'ini': '⚙️',
            
            // Default
            'default': '📄'
        };
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        await this.loadFileTree();
    }

    render() {
        this.element = this.createElement('div', {}, ['file-manager']);

        this.element.innerHTML = `
            <div class="file-manager-header">
                <div class="manager-title">
                    <span class="icon">📁</span>
                    <h3>File Manager</h3>
                </div>
                <div class="header-actions">
                    <button class="btn btn-icon" id="refreshButton" title="Refresh">
                        <span class="icon">🔄</span>
                    </button>
                    <button class="btn btn-icon" id="searchToggle" title="Search Files">
                        <span class="icon">🔍</span>
                    </button>
                </div>
            </div>
            
            <div class="search-container hidden" id="searchContainer">
                <div class="search-input-wrapper">
                    <input type="text" class="input search-input" id="searchInput" 
                           placeholder="Search files and folders..." />
                    <button class="btn btn-icon search-clear" id="searchClear" title="Clear Search">
                        <span class="icon">✕</span>
                    </button>
                </div>
            </div>
            
            <div class="file-manager-content" id="fileManagerContent">
                <div class="loading-indicator" id="loadingIndicator">
                    <div class="spinner"></div>
                    <span>Loading files...</span>
                </div>
                
                <div class="file-tree-container" id="fileTreeContainer">
                    <!-- FileTree component will be rendered here -->
                </div>
                
                <div class="empty-state hidden" id="emptyState">
                    <p>No files found in workspace</p>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.refreshButton = this.querySelector('#refreshButton');
        this.searchToggle = this.querySelector('#searchToggle');
        this.searchContainer = this.querySelector('#searchContainer');
        this.searchInput = this.querySelector('#searchInput');
        this.searchClear = this.querySelector('#searchClear');
        this.loadingIndicator = this.querySelector('#loadingIndicator');
        this.fileTreeContainer = this.querySelector('#fileTreeContainer');
        this.emptyState = this.querySelector('#emptyState');
    }

    setupEventListeners() {
        // Header actions
        this.addEventListener(this.refreshButton, 'click', this.handleRefresh);
        this.addEventListener(this.searchToggle, 'click', this.handleSearchToggle);
        
        // Search functionality
        this.addEventListener(this.searchInput, 'input', this.handleSearchInput);
        this.addEventListener(this.searchInput, 'keydown', this.handleSearchKeydown);
        this.addEventListener(this.searchClear, 'click', this.handleSearchClear);

        // File system updates are handled through state manager
        // The WebSocket client already handles fileSystem messages and updates the state

        // Listen for state changes
        if (this.stateManager) {
            this.stateManager.subscribe('fileSystem', this.handleStateChange.bind(this));
        }
    }

    async loadFileTree() {
        this.setLoading(true);
        
        try {
            // Request file tree from server
            await this.sendFileSystemCommand('tree', '.');
        } catch (error) {
            console.error('Failed to load file tree:', error);
            this.showError('Failed to load file tree');
        }
    }

    async sendFileSystemCommand(operation, path = '', options = {}) {
        if (!this.webSocketClient) {
            throw new Error('WebSocket client not available');
        }

        return this.webSocketClient.sendFileSystemCommand(operation, path, options);
    }

    handleFileSystemUpdate(message) {
        if (!message.data) return;

        const { operation, content, path } = message.data;

        switch (operation) {
            case 'tree':
                this.handleFileTreeUpdate(content);
                break;
            case 'watch':
                this.handleFileSystemChange(content);
                break;
            case 'search':
                this.handleSearchResults(content);
                break;
            default:
                console.warn('Unknown file system operation:', operation);
        }
    }

    handleFileTreeUpdate(nodes) {
        this.rootNodes = nodes || [];
        this.setLoading(false);
        this.renderFileTree();
    }

    handleFileSystemChange(changeData) {
        // Handle real-time file system changes
        if (changeData.type === 'file' && changeData.event === 'change') {
            // File was modified - could update file metadata
            this.updateFileMetadata(changeData.path, changeData.stats);
        } else if (changeData.type === 'directory') {
            // Directory structure changed - refresh tree
            this.loadFileTree();
        }
    }

    handleSearchResults(results) {
        this.filteredNodes = results;
        this.renderFileTree();
    }

    async renderFileTree() {
        if (!this.fileTreeContainer) return;

        // Clear existing tree
        if (this.fileTree) {
            this.removeChildComponent(this.fileTree);
            this.fileTree.destroy();
            this.fileTree = null;
        }

        // Show/hide empty state
        const hasFiles = this.rootNodes.length > 0;
        this.emptyState.classList.toggle('hidden', hasFiles);
        this.fileTreeContainer.classList.toggle('hidden', !hasFiles);

        if (!hasFiles) {
            return;
        }

        // Create FileTree component
        this.fileTree = new FileTree({
            container: this.fileTreeContainer,
            nodes: this.filteredNodes || this.rootNodes,
            selectedFile: this.selectedFile,
            expandedPaths: this.expandedPaths,
            fileIcons: this.fileIcons,
            onFileSelect: this.handleFileSelect.bind(this),
            onFolderToggle: this.handleFolderToggle.bind(this),
            onFileOpen: this.handleFileOpen.bind(this)
        });

        await this.fileTree.initialize();
        this.addChildComponent(this.fileTree);
    }

    handleFileSelect(filePath) {
        this.selectedFile = filePath;
        
        // Update state
        if (this.stateManager) {
            this.stateManager.updateFileSystem({ selectedFile: filePath });
        }

        // Emit event
        this.emit('file-selected', { file: filePath });
    }

    handleFolderToggle(folderPath, isExpanded) {
        if (isExpanded) {
            this.expandedPaths.add(folderPath);
        } else {
            this.expandedPaths.delete(folderPath);
        }

        // Update state
        if (this.stateManager) {
            this.stateManager.updateFileSystem({ 
                expandedPaths: Array.from(this.expandedPaths) 
            });
        }
    }

    async handleFileOpen(filePath) {
        try {
            // Send command to VS Code to open file
            await this.sendFileSystemCommand('open', filePath);
            
            // Show notification
            if (this.notificationService) {
                this.notificationService.show({
                    type: 'info',
                    message: `Opening ${this.getFileName(filePath)} in VS Code`,
                    duration: 2000
                });
            }

            // Emit event
            this.emit('file-opened', { file: filePath });
            
        } catch (error) {
            console.error('Failed to open file:', error);
            
            if (this.notificationService) {
                this.notificationService.show({
                    type: 'error',
                    message: `Failed to open ${this.getFileName(filePath)}`,
                    duration: 4000
                });
            }
        }
    }

    handleRefresh() {
        this.loadFileTree();
    }

    handleSearchToggle() {
        const isVisible = !this.searchContainer.classList.contains('hidden');
        
        if (isVisible) {
            // Hide search
            this.searchContainer.classList.add('hidden');
            this.searchToggle.classList.remove('active');
            this.clearSearch();
        } else {
            // Show search
            this.searchContainer.classList.remove('hidden');
            this.searchToggle.classList.add('active');
            this.searchInput.focus();
        }
    }

    handleSearchInput() {
        const query = this.searchInput.value.trim();
        this.searchQuery = query;
        
        if (query.length === 0) {
            this.clearSearchResults();
        } else if (query.length >= 2) {
            this.performSearch(query);
        }
    }

    handleSearchKeydown(event) {
        if (event.key === 'Escape') {
            this.handleSearchToggle();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.performSearch(this.searchInput.value.trim());
        }
    }

    handleSearchClear() {
        this.searchInput.value = '';
        this.clearSearch();
        this.searchInput.focus();
    }

    async performSearch(query) {
        if (!query) return;

        try {
            await this.sendFileSystemCommand('search', '', { query });
        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Search failed');
        }
    }

    clearSearch() {
        this.searchQuery = '';
        this.searchInput.value = '';
        this.clearSearchResults();
    }

    clearSearchResults() {
        this.filteredNodes = null;
        this.renderFileTree();
    }

    updateFileMetadata(filePath, stats) {
        // Update file metadata in the tree
        const updateNode = (nodes) => {
            for (const node of nodes) {
                if (node.path === filePath) {
                    node.size = stats.size;
                    node.modified = new Date(stats.mtime);
                    return true;
                }
                if (node.children && updateNode(node.children)) {
                    return true;
                }
            }
            return false;
        };

        if (updateNode(this.rootNodes)) {
            this.renderFileTree();
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.loadingIndicator.classList.toggle('hidden', !loading);
        this.fileTreeContainer.classList.toggle('hidden', loading);
    }

    showError(message) {
        if (this.notificationService) {
            this.notificationService.show({
                type: 'error',
                message,
                duration: 5000
            });
        }
    }

    handleStateChange(fileSystemState) {
        if (fileSystemState.rootNodes !== undefined) {
            this.rootNodes = fileSystemState.rootNodes;
            this.setLoading(false);
            this.renderFileTree();
        }

        if (fileSystemState.selectedFile !== undefined) {
            this.selectedFile = fileSystemState.selectedFile;
            if (this.fileTree) {
                this.fileTree.setSelectedFile(fileSystemState.selectedFile);
            }
        }

        if (fileSystemState.expandedPaths !== undefined) {
            this.expandedPaths = new Set(fileSystemState.expandedPaths);
            if (this.fileTree) {
                this.fileTree.setExpandedPaths(this.expandedPaths);
            }
        }

        if (fileSystemState.filteredNodes !== undefined) {
            this.filteredNodes = fileSystemState.filteredNodes;
            this.renderFileTree();
        }
    }

    getFileName(filePath) {
        return filePath.split('/').pop() || filePath;
    }

    getFileIcon(fileName, isDirectory = false) {
        if (isDirectory) {
            return this.fileIcons['folder'];
        }

        const extension = fileName.split('.').pop()?.toLowerCase();
        return this.fileIcons[extension] || this.fileIcons['default'];
    }

    generateMessageId() {
        return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    refresh() {
        this.loadFileTree();
    }

    selectFile(filePath) {
        this.handleFileSelect(filePath);
    }

    expandFolder(folderPath) {
        this.expandedPaths.add(folderPath);
        if (this.fileTree) {
            this.fileTree.expandFolder(folderPath);
        }
    }

    collapseFolder(folderPath) {
        this.expandedPaths.delete(folderPath);
        if (this.fileTree) {
            this.fileTree.collapseFolder(folderPath);
        }
    }

    search(query) {
        this.searchInput.value = query;
        this.performSearch(query);
    }

    clearSelection() {
        this.selectedFile = null;
        if (this.fileTree) {
            this.fileTree.setSelectedFile(null);
        }
    }
}