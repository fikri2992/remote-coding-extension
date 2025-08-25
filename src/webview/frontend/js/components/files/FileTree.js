/**
 * FileTree Component - Hierarchical file tree with expand/collapse functionality
 */

import { Component } from '../base/Component.js';
import { VirtualScroller, PerformanceOptimizer, MemoryManager } from '../../utils/PerformanceOptimizer.js';

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

        // Performance optimizations
        this.optimizer = new PerformanceOptimizer();
        this.memoryManager = new MemoryManager({
            maxCacheSize: 300,
            cleanupInterval: 45000,
            maxAge: 240000
        });

        // Virtual scrolling for large trees
        this.virtualScroller = null;
        this.flattenedNodes = [];
        this.virtualScrollingThreshold = 100;

        // Tree state with caching
        this.renderedNodes = new Map(); // Cache rendered nodes for performance
        this.nodeHeights = new Map(); // Cache node heights
        this.lastUpdateTime = 0;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.checkVirtualScrollingNeed();
    }

    render() {
        this.element = this.createElement('div', {}, ['file-tree']);
        this.container.appendChild(this.element);
        this.renderNodes();
    }

    renderNodes() {
        // Debounce rendering for better performance
        this.optimizer.debounce('file-tree-render', () => {
            this.performRender();
        }, 100);
    }

    performRender() {
        const startTime = performance.now();
        
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

        // Check if we should use virtual scrolling
        this.flattenedNodes = this.flattenNodes(this.nodes);
        
        if (this.flattenedNodes.length > this.virtualScrollingThreshold) {
            this.enableVirtualScrolling();
        } else {
            this.renderTraditional();
        }

        const renderTime = performance.now() - startTime;
        console.log(`File tree rendered in ${renderTime.toFixed(2)}ms (${this.flattenedNodes.length} nodes)`);
    }

    renderTraditional() {
        const treeList = this.createElement('ul', {}, ['tree']);
        this.element.appendChild(treeList);

        this.nodes.forEach(node => {
            const nodeElement = this.renderNodeOptimized(node, 0);
            treeList.appendChild(nodeElement);
        });
    }

    /**
     * Flatten tree nodes for virtual scrolling
     */
    flattenNodes(nodes, depth = 0, result = []) {
        nodes.forEach(node => {
            result.push({ ...node, depth });
            
            if (node.type === 'directory' && 
                node.children && 
                node.children.length > 0 && 
                this.expandedPaths.has(node.path)) {
                this.flattenNodes(node.children, depth + 1, result);
            }
        });
        
        return result;
    }

    /**
     * Enable virtual scrolling for large trees
     */
    enableVirtualScrolling() {
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
        }

        this.virtualScroller = new VirtualScroller({
            container: this.element,
            itemHeight: 28, // Estimated height per tree item
            bufferSize: 10,
            renderItem: (nodeData, index) => this.renderVirtualNode(nodeData, index),
            getItemCount: () => this.flattenedNodes.length,
            getItemData: (index) => this.flattenedNodes[index]
        });

        console.log(`Virtual scrolling enabled for file tree (${this.flattenedNodes.length} nodes)`);
    }

    /**
     * Render node for virtual scrolling
     */
    renderVirtualNode(nodeData, index) {
        const cacheKey = `vnode-${nodeData.path}-${nodeData.depth}-${this.expandedPaths.has(nodeData.path)}`;
        
        // Check cache first
        let cachedElement = this.memoryManager.get(cacheKey);
        if (cachedElement) {
            return cachedElement.cloneNode(true);
        }

        const nodeElement = this.renderNode(nodeData, nodeData.depth);
        
        // Cache the rendered element
        this.memoryManager.set(cacheKey, nodeElement.cloneNode(true));
        
        return nodeElement;
    }

    /**
     * Optimized node rendering with caching
     */
    renderNodeOptimized(node, depth) {
        const cacheKey = `node-${node.path}-${depth}-${this.expandedPaths.has(node.path)}`;
        
        // Check cache first
        let cachedElement = this.memoryManager.get(cacheKey);
        if (cachedElement) {
            const clonedElement = cachedElement.cloneNode(true);
            this.renderedNodes.set(node.path, { element: clonedElement, node, depth });
            return clonedElement;
        }

        const nodeElement = this.renderNode(node, depth);
        
        // Cache the rendered element
        this.memoryManager.set(cacheKey, nodeElement.cloneNode(true));
        
        return nodeElement;
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
        // Use event delegation with optimized handlers
        this.optimizer.addEventListenerWithCleanup(
            this.element,
            'click',
            (e) => this.optimizer.throttle('tree-click', () => this.handleTreeClick(e), 50)
        );
        
        this.optimizer.addEventListenerWithCleanup(
            this.element,
            'dblclick',
            (e) => this.optimizer.throttle('tree-dblclick', () => this.handleTreeDoubleClick(e), 100)
        );
        
        this.optimizer.addEventListenerWithCleanup(
            this.element,
            'keydown',
            (e) => this.handleTreeKeydown(e)
        );
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
        if (this.virtualScroller) {
            // Find index in flattened nodes
            const index = this.flattenedNodes.findIndex(node => node.path === filePath);
            if (index !== -1) {
                this.virtualScroller.scrollToIndex(index);
            }
        } else {
            const treeItem = this.element.querySelector(`[data-path="${filePath}"]`);
            if (treeItem) {
                treeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    /**
     * Check if virtual scrolling is needed
     */
    checkVirtualScrollingNeed() {
        const totalNodes = this.countTotalNodes(this.nodes);
        
        if (totalNodes > this.virtualScrollingThreshold && !this.virtualScroller) {
            this.flattenedNodes = this.flattenNodes(this.nodes);
            this.enableVirtualScrolling();
        } else if (totalNodes <= this.virtualScrollingThreshold && this.virtualScroller) {
            this.disableVirtualScrolling();
        }
    }

    /**
     * Count total nodes in tree
     */
    countTotalNodes(nodes) {
        let count = 0;
        
        const countRecursive = (nodeList) => {
            nodeList.forEach(node => {
                count++;
                if (node.children && this.expandedPaths.has(node.path)) {
                    countRecursive(node.children);
                }
            });
        };
        
        countRecursive(nodes);
        return count;
    }

    /**
     * Disable virtual scrolling
     */
    disableVirtualScrolling() {
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
            this.virtualScroller = null;
            this.renderTraditional();
            console.log('Virtual scrolling disabled for file tree');
        }
    }

    /**
     * Optimized folder expansion
     */
    expandFolderOptimized(path) {
        if (this.expandedPaths.has(path)) return;

        this.expandedPaths.add(path);
        this.onFolderToggle(path, true);

        // Batch UI updates
        this.optimizer.debounce('folder-expand', () => {
            if (this.virtualScroller) {
                // Refresh virtual scroller with new flattened nodes
                this.flattenedNodes = this.flattenNodes(this.nodes);
                this.virtualScroller.refresh();
            } else {
                this.expandFolder(path);
            }
        }, 50);
    }

    /**
     * Optimized folder collapse
     */
    collapseFolderOptimized(path) {
        if (!this.expandedPaths.has(path)) return;

        this.expandedPaths.delete(path);
        this.onFolderToggle(path, false);

        // Batch UI updates
        this.optimizer.debounce('folder-collapse', () => {
            if (this.virtualScroller) {
                // Refresh virtual scroller with new flattened nodes
                this.flattenedNodes = this.flattenNodes(this.nodes);
                this.virtualScroller.refresh();
            } else {
                this.collapseFolder(path);
            }
        }, 50);
    }

    /**
     * Batch node updates for better performance
     */
    batchUpdateNodes(newNodes) {
        this.optimizer.requestAnimationFrame('batch-node-update', () => {
            this.nodes = newNodes;
            this.checkVirtualScrollingNeed();
            this.renderNodes();
        });
    }

    /**
     * Memory cleanup for large trees
     */
    performMemoryCleanup() {
        // Clean up old rendered nodes
        const maxCachedNodes = 200;
        if (this.renderedNodes.size > maxCachedNodes) {
            const keysToDelete = Array.from(this.renderedNodes.keys())
                .slice(0, this.renderedNodes.size - maxCachedNodes);
            
            keysToDelete.forEach(key => this.renderedNodes.delete(key));
        }

        // Clean up node height cache
        if (this.nodeHeights.size > maxCachedNodes) {
            const heightKeysToDelete = Array.from(this.nodeHeights.keys())
                .slice(0, this.nodeHeights.size - maxCachedNodes);
            
            heightKeysToDelete.forEach(key => this.nodeHeights.delete(key));
        }

        console.log('File tree memory cleanup completed');
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            nodeCount: this.nodes.length,
            flattenedNodeCount: this.flattenedNodes.length,
            renderedNodes: this.renderedNodes.size,
            cachedHeights: this.nodeHeights.size,
            virtualScrollingEnabled: !!this.virtualScroller,
            expandedPaths: this.expandedPaths.size,
            memoryStats: this.memoryManager.getStats(),
            optimizerMetrics: this.optimizer.getMetrics()
        };
    }

    /**
     * Override original methods to use optimized versions
     */
    expandFolder(path) {
        this.expandFolderOptimized(path);
    }

    collapseFolder(path) {
        this.collapseFolderOptimized(path);
    }

    setNodes(nodes) {
        this.batchUpdateNodes(nodes);
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
        this.renderedNodes.clear();
        this.nodeHeights.clear();
        this.flattenedNodes = [];

        super.destroy();
    }
}