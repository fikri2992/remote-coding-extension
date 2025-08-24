/**
 * FileTree Component - Hierarchical file tree with expand/collapse functionality
 */

import { Component } from '../base/Component.js';

export class FileTree extends Component {
    constructor(options) {
        super(options);

        this.nodes = options.nodes || [];
        this.selectedFile = options.selectedFile || null;
        this.expandedPaths = options.expandedPaths || new Set();
        this.fileIcons = options.fileIcons || {};
        
        // Callbacks
        this.onFileSelect = options.onFileSelect || (() => {});
        this.onFolderToggle = options.onFolderToggle || (() => {});
        this.onFileOpen = options.onFileOpen || (() => {});

        // Tree state
        this.renderedNodes = new Map(); // Cache rendered nodes for performance
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.element = this.createElement('div', {}, ['file-tree']);
        this.container.appendChild(this.element);
        this.renderNodes();
    }

    renderNodes() {
        this.element.innerHTML = '';
        this.renderedNodes.clear();

        if (this.nodes.length === 0) {
            this.element.innerHTML = `
                <div class="tree-empty">
                    <p>No files to display</p>
                </div>
            `;
            return;
        }

        const treeList = this.createElement('ul', {}, ['tree']);
        this.element.appendChild(treeList);

        this.nodes.forEach(node => {
            const nodeElement = this.renderNode(node, 0);
            treeList.appendChild(nodeElement);
        });
    }

    renderNode(node, depth) {
        const isDirectory = node.type === 'directory';
        const isExpanded = this.expandedPaths.has(node.path);
        const isSelected = this.selectedFile === node.path;
        const hasChildren = isDirectory && node.children && node.children.length > 0;

        // Create tree item
        const treeItem = this.createElement('li', {}, ['tree-item']);
        treeItem.dataset.path = node.path;
        treeItem.dataset.type = node.type;

        // Create item content
        const itemContent = this.createElement('div', {}, ['tree-item-content']);
        if (isSelected) {
            itemContent.classList.add('selected');
        }

        // Expand/collapse button
        const expandButton = this.createElement('button', {
            'aria-label': isExpanded ? 'Collapse' : 'Expand'
        }, ['tree-item-expand']);

        if (hasChildren) {
            expandButton.innerHTML = isExpanded ? '▼' : '▶';
            if (isExpanded) {
                expandButton.classList.add('expanded');
            }
        } else {
            expandButton.classList.add('empty');
            expandButton.innerHTML = '';
        }

        // File/folder icon
        const icon = this.createElement('span', {}, ['tree-item-icon']);
        icon.textContent = this.getNodeIcon(node, isExpanded);

        // File/folder label
        const label = this.createElement('span', {}, ['tree-item-label']);
        label.textContent = node.name;
        label.title = node.path;

        // File metadata (size, modified date)
        const metadata = this.createElement('span', {}, ['tree-item-metadata']);
        if (!isDirectory && node.size !== undefined) {
            metadata.textContent = this.formatFileSize(node.size);
            metadata.title = `Size: ${this.formatFileSize(node.size)}${node.modified ? `\nModified: ${this.formatDate(node.modified)}` : ''}`;
        }

        // Assemble item content
        itemContent.appendChild(expandButton);
        itemContent.appendChild(icon);
        itemContent.appendChild(label);
        if (metadata.textContent) {
            itemContent.appendChild(metadata);
        }

        treeItem.appendChild(itemContent);

        // Add children if expanded
        if (isDirectory && hasChildren && isExpanded) {
            const childrenContainer = this.createElement('ul', {}, ['tree-item-children']);
            
            node.children.forEach(childNode => {
                const childElement = this.renderNode(childNode, depth + 1);
                childrenContainer.appendChild(childElement);
            });

            treeItem.appendChild(childrenContainer);
        }

        // Cache the rendered node
        this.renderedNodes.set(node.path, {
            element: treeItem,
            node: node,
            depth: depth
        });

        return treeItem;
    }

    setupEventListeners() {
        // Use event delegation for better performance
        this.addEventListener(this.element, 'click', this.handleTreeClick);
        this.addEventListener(this.element, 'dblclick', this.handleTreeDoubleClick);
        this.addEventListener(this.element, 'keydown', this.handleTreeKeydown);
    }

    handleTreeClick(event) {
        const itemContent = event.target.closest('.tree-item-content');
        if (!itemContent) return;

        const treeItem = itemContent.closest('.tree-item');
        const path = treeItem.dataset.path;
        const type = treeItem.dataset.type;
        const isDirectory = type === 'directory';

        // Handle expand/collapse button click
        if (event.target.closest('.tree-item-expand')) {
            if (isDirectory) {
                this.toggleFolder(path);
            }
            return;
        }

        // Handle item selection
        this.selectItem(path);
    }

    handleTreeDoubleClick(event) {
        const itemContent = event.target.closest('.tree-item-content');
        if (!itemContent) return;

        const treeItem = itemContent.closest('.tree-item');
        const path = treeItem.dataset.path;
        const type = treeItem.dataset.type;

        if (type === 'file') {
            // Double-click on file opens it
            this.onFileOpen(path);
        } else if (type === 'directory') {
            // Double-click on folder toggles it
            this.toggleFolder(path);
        }
    }

    handleTreeKeydown(event) {
        const itemContent = event.target.closest('.tree-item-content');
        if (!itemContent) return;

        const treeItem = itemContent.closest('.tree-item');
        const path = treeItem.dataset.path;
        const type = treeItem.dataset.type;

        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (type === 'file') {
                    this.onFileOpen(path);
                } else {
                    this.toggleFolder(path);
                }
                break;

            case 'ArrowRight':
                if (type === 'directory' && !this.expandedPaths.has(path)) {
                    event.preventDefault();
                    this.expandFolder(path);
                }
                break;

            case 'ArrowLeft':
                if (type === 'directory' && this.expandedPaths.has(path)) {
                    event.preventDefault();
                    this.collapseFolder(path);
                }
                break;

            case 'ArrowDown':
                event.preventDefault();
                this.selectNextItem(path);
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.selectPreviousItem(path);
                break;
        }
    }

    selectItem(path) {
        // Remove previous selection
        const previousSelected = this.element.querySelector('.tree-item-content.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        // Add new selection
        const newSelected = this.element.querySelector(`[data-path="${path}"] .tree-item-content`);
        if (newSelected) {
            newSelected.classList.add('selected');
            newSelected.focus();
        }

        this.selectedFile = path;
        this.onFileSelect(path);
    }

    toggleFolder(path) {
        const isExpanded = this.expandedPaths.has(path);
        
        if (isExpanded) {
            this.collapseFolder(path);
        } else {
            this.expandFolder(path);
        }
    }

    expandFolder(path) {
        if (this.expandedPaths.has(path)) return;

        this.expandedPaths.add(path);
        this.onFolderToggle(path, true);

        // Update UI
        const treeItem = this.element.querySelector(`[data-path="${path}"]`);
        if (treeItem) {
            const expandButton = treeItem.querySelector('.tree-item-expand');
            const icon = treeItem.querySelector('.tree-item-icon');
            
            if (expandButton) {
                expandButton.innerHTML = '▼';
                expandButton.classList.add('expanded');
                expandButton.setAttribute('aria-label', 'Collapse');
            }

            if (icon) {
                const renderedNode = this.renderedNodes.get(path);
                if (renderedNode) {
                    icon.textContent = this.getNodeIcon(renderedNode.node, true);
                }
            }

            // Add children if they exist
            const renderedNode = this.renderedNodes.get(path);
            if (renderedNode && renderedNode.node.children && renderedNode.node.children.length > 0) {
                const existingChildren = treeItem.querySelector('.tree-item-children');
                if (!existingChildren) {
                    const childrenContainer = this.createElement('ul', {}, ['tree-item-children']);
                    
                    renderedNode.node.children.forEach(childNode => {
                        const childElement = this.renderNode(childNode, renderedNode.depth + 1);
                        childrenContainer.appendChild(childElement);
                    });

                    treeItem.appendChild(childrenContainer);
                }
            }
        }
    }

    collapseFolder(path) {
        if (!this.expandedPaths.has(path)) return;

        this.expandedPaths.delete(path);
        this.onFolderToggle(path, false);

        // Update UI
        const treeItem = this.element.querySelector(`[data-path="${path}"]`);
        if (treeItem) {
            const expandButton = treeItem.querySelector('.tree-item-expand');
            const icon = treeItem.querySelector('.tree-item-icon');
            const children = treeItem.querySelector('.tree-item-children');
            
            if (expandButton) {
                expandButton.innerHTML = '▶';
                expandButton.classList.remove('expanded');
                expandButton.setAttribute('aria-label', 'Expand');
            }

            if (icon) {
                const renderedNode = this.renderedNodes.get(path);
                if (renderedNode) {
                    icon.textContent = this.getNodeIcon(renderedNode.node, false);
                }
            }

            if (children) {
                children.remove();
            }
        }
    }

    selectNextItem(currentPath) {
        const allItems = Array.from(this.element.querySelectorAll('.tree-item-content'));
        const currentIndex = allItems.findIndex(item => 
            item.closest('.tree-item').dataset.path === currentPath
        );
        
        if (currentIndex >= 0 && currentIndex < allItems.length - 1) {
            const nextItem = allItems[currentIndex + 1];
            const nextPath = nextItem.closest('.tree-item').dataset.path;
            this.selectItem(nextPath);
        }
    }

    selectPreviousItem(currentPath) {
        const allItems = Array.from(this.element.querySelectorAll('.tree-item-content'));
        const currentIndex = allItems.findIndex(item => 
            item.closest('.tree-item').dataset.path === currentPath
        );
        
        if (currentIndex > 0) {
            const previousItem = allItems[currentIndex - 1];
            const previousPath = previousItem.closest('.tree-item').dataset.path;
            this.selectItem(previousPath);
        }
    }

    getNodeIcon(node, isExpanded = false) {
        if (node.type === 'directory') {
            return isExpanded ? 
                (this.fileIcons['folder-open'] || '📂') : 
                (this.fileIcons['folder'] || '📁');
        }

        const extension = node.name.split('.').pop()?.toLowerCase();
        return this.fileIcons[extension] || this.fileIcons['default'] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    // Public API methods
    setNodes(nodes) {
        this.nodes = nodes;
        this.renderNodes();
    }

    setSelectedFile(filePath) {
        this.selectedFile = filePath;
        
        // Update UI
        const previousSelected = this.element.querySelector('.tree-item-content.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        if (filePath) {
            const newSelected = this.element.querySelector(`[data-path="${filePath}"] .tree-item-content`);
            if (newSelected) {
                newSelected.classList.add('selected');
            }
        }
    }

    setExpandedPaths(expandedPaths) {
        this.expandedPaths = expandedPaths;
        this.renderNodes(); // Re-render to apply expanded state
    }

    getSelectedFile() {
        return this.selectedFile;
    }

    getExpandedPaths() {
        return this.expandedPaths;
    }

    scrollToFile(filePath) {
        const treeItem = this.element.querySelector(`[data-path="${filePath}"]`);
        if (treeItem) {
            treeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}