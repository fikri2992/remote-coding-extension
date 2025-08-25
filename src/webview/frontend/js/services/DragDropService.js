/**
 * Drag and Drop Service
 * Handles drag-and-drop functionality for file organization
 */

export class DragDropService {
    constructor(stateManager, notificationService) {
        this.stateManager = stateManager;
        this.notificationService = notificationService;
        
        // State
        this.draggedElement = null;
        this.draggedData = null;
        this.dropZones = new Map();
        this.isDragging = false;
        
        // Visual feedback elements
        this.dragPreview = null;
        this.dropIndicator = null;
        
        // Bind methods
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleDragEnter = this.handleDragEnter.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
    }

    /**
     * Initialize the service
     */
    async initialize() {
        this.createDragElements();
        this.setupEventListeners();
        console.log('✅ DragDropService initialized');
    }

    /**
     * Create drag visual elements
     */
    createDragElements() {
        // Create drag preview
        this.dragPreview = document.createElement('div');
        this.dragPreview.className = 'drag-preview';
        
        // Create drop indicator
        this.dropIndicator = document.createElement('div');
        this.dropIndicator.className = 'drop-indicator';
        
        // Add styles
        const styles = `
            .drag-preview {
                position: fixed;
                z-index: var(--z-drag-preview, 1002);
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-focusBorder);
                border-radius: 4px;
                padding: 8px 12px;
                font-size: 13px;
                color: var(--vscode-foreground);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                pointer-events: none;
                opacity: 0.9;
                transform: translate(-50%, -50%);
                white-space: nowrap;
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: none;
            }
            
            .drag-preview.show {
                display: block;
            }
            
            .drag-preview-icon {
                margin-right: 8px;
            }
            
            .drop-indicator {
                position: absolute;
                background: var(--vscode-focusBorder);
                border-radius: 2px;
                opacity: 0;
                transition: opacity 0.1s ease-out;
                pointer-events: none;
                z-index: var(--z-drop-indicator, 999);
            }
            
            .drop-indicator.show {
                opacity: 1;
            }
            
            .drop-indicator.horizontal {
                height: 2px;
                left: 0;
                right: 0;
            }
            
            .drop-indicator.vertical {
                width: 2px;
                top: 0;
                bottom: 0;
            }
            
            /* Draggable elements */
            [draggable="true"] {
                cursor: grab;
            }
            
            [draggable="true"]:active {
                cursor: grabbing;
            }
            
            .dragging {
                opacity: 0.5;
                transform: scale(0.95);
                transition: all 0.1s ease-out;
            }
            
            /* Drop zones */
            .drop-zone {
                position: relative;
                transition: background-color 0.1s ease-out;
            }
            
            .drop-zone.drag-over {
                background: var(--vscode-list-dropBackground);
            }
            
            .drop-zone.drag-over-valid {
                background: var(--vscode-inputValidation-infoBackground);
                border: 1px dashed var(--vscode-focusBorder);
            }
            
            .drop-zone.drag-over-invalid {
                background: var(--vscode-inputValidation-errorBackground);
                border: 1px dashed var(--vscode-inputValidation-errorBorder);
            }
            
            /* File tree specific styles */
            .tree-item.dragging {
                opacity: 0.5;
            }
            
            .tree-item.drop-target {
                background: var(--vscode-list-dropBackground);
            }
            
            .tree-item.drop-target-valid {
                background: var(--vscode-inputValidation-infoBackground);
            }
            
            .tree-item.drop-target-invalid {
                background: var(--vscode-inputValidation-errorBackground);
            }
            
            /* Prompt item specific styles */
            .prompt-item.dragging {
                opacity: 0.5;
                transform: scale(0.95);
            }
            
            .prompt-category-zone.drag-over {
                background: var(--vscode-list-dropBackground);
                border: 2px dashed var(--vscode-focusBorder);
                border-radius: 6px;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        
        document.body.appendChild(this.dragPreview);
        document.body.appendChild(this.dropIndicator);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Global drag events
        document.addEventListener('dragstart', this.handleDragStart);
        document.addEventListener('dragend', this.handleDragEnd);
        document.addEventListener('dragover', this.handleDragOver);
        document.addEventListener('drop', this.handleDrop);
        document.addEventListener('dragenter', this.handleDragEnter);
        document.addEventListener('dragleave', this.handleDragLeave);
        
        // Mouse events for custom drag preview
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    /**
     * Make element draggable
     */
    makeDraggable(element, data) {
        element.draggable = true;
        element.dataset.dragData = JSON.stringify(data);
        
        // Add visual feedback
        element.addEventListener('mousedown', () => {
            element.style.cursor = 'grabbing';
        });
        
        element.addEventListener('mouseup', () => {
            element.style.cursor = 'grab';
        });
    }

    /**
     * Register drop zone
     */
    registerDropZone(element, config) {
        const id = this.generateId();
        element.dataset.dropZoneId = id;
        element.classList.add('drop-zone');
        
        this.dropZones.set(id, {
            element,
            config: {
                accepts: config.accepts || [],
                onDrop: config.onDrop,
                onDragOver: config.onDragOver,
                onDragEnter: config.onDragEnter,
                onDragLeave: config.onDragLeave,
                validateDrop: config.validateDrop
            }
        });
        
        return id;
    }

    /**
     * Unregister drop zone
     */
    unregisterDropZone(id) {
        const dropZone = this.dropZones.get(id);
        if (dropZone) {
            dropZone.element.classList.remove('drop-zone', 'drag-over', 'drag-over-valid', 'drag-over-invalid');
            delete dropZone.element.dataset.dropZoneId;
            this.dropZones.delete(id);
        }
    }

    /**
     * Handle drag start
     */
    handleDragStart(event) {
        const element = event.target.closest('[draggable="true"]');
        if (!element) return;
        
        this.draggedElement = element;
        this.draggedData = JSON.parse(element.dataset.dragData || '{}');
        this.isDragging = true;
        
        // Add dragging class
        element.classList.add('dragging');
        
        // Set drag data
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
        
        // Create custom drag preview
        this.createDragPreview(this.draggedData);
        
        // Hide default drag image
        const dragImage = document.createElement('div');
        dragImage.style.opacity = '0';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
        
        // Notify about drag start
        this.notifyDragStart(this.draggedData);
    }

    /**
     * Handle drag end
     */
    handleDragEnd(event) {
        if (!this.isDragging) return;
        
        // Remove dragging class
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }
        
        // Hide drag preview
        this.hideDragPreview();
        
        // Hide drop indicator
        this.hideDropIndicator();
        
        // Clear drag over states
        this.clearDragOverStates();
        
        // Reset state
        this.draggedElement = null;
        this.draggedData = null;
        this.isDragging = false;
        
        // Notify about drag end
        this.notifyDragEnd();
    }

    /**
     * Handle drag over
     */
    handleDragOver(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        
        const dropZone = this.getDropZoneFromEvent(event);
        if (dropZone) {
            const isValid = this.validateDrop(dropZone, this.draggedData);
            event.dataTransfer.dropEffect = isValid ? 'move' : 'none';
            
            // Update drop indicator
            this.updateDropIndicator(event, dropZone, isValid);
            
            // Call custom drag over handler
            if (dropZone.config.onDragOver) {
                dropZone.config.onDragOver(event, this.draggedData, isValid);
            }
        }
    }

    /**
     * Handle drag enter
     */
    handleDragEnter(event) {
        if (!this.isDragging) return;
        
        const dropZone = this.getDropZoneFromEvent(event);
        if (dropZone) {
            const isValid = this.validateDrop(dropZone, this.draggedData);
            
            // Add drag over class
            dropZone.element.classList.add('drag-over');
            if (isValid) {
                dropZone.element.classList.add('drag-over-valid');
            } else {
                dropZone.element.classList.add('drag-over-invalid');
            }
            
            // Call custom drag enter handler
            if (dropZone.config.onDragEnter) {
                dropZone.config.onDragEnter(event, this.draggedData, isValid);
            }
        }
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(event) {
        if (!this.isDragging) return;
        
        const dropZone = this.getDropZoneFromEvent(event);
        if (dropZone) {
            // Remove drag over classes
            dropZone.element.classList.remove('drag-over', 'drag-over-valid', 'drag-over-invalid');
            
            // Call custom drag leave handler
            if (dropZone.config.onDragLeave) {
                dropZone.config.onDragLeave(event, this.draggedData);
            }
        }
    }

    /**
     * Handle drop
     */
    handleDrop(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        
        const dropZone = this.getDropZoneFromEvent(event);
        if (dropZone) {
            const isValid = this.validateDrop(dropZone, this.draggedData);
            
            if (isValid && dropZone.config.onDrop) {
                const dropData = this.getDropData(event, dropZone);
                dropZone.config.onDrop(this.draggedData, dropData, event);
                
                // Show success notification
                this.notificationService.success(
                    'Moved',
                    `${this.draggedData.name || 'Item'} moved successfully`
                );
            } else {
                // Show error notification
                this.notificationService.warning(
                    'Invalid Drop',
                    'Cannot move item to this location'
                );
            }
        }
    }

    /**
     * Handle mouse move for custom drag preview
     */
    handleMouseMove(event) {
        if (this.isDragging && this.dragPreview.classList.contains('show')) {
            this.dragPreview.style.left = `${event.clientX}px`;
            this.dragPreview.style.top = `${event.clientY}px`;
        }
    }

    /**
     * Create drag preview
     */
    createDragPreview(data) {
        const icon = this.getDragIcon(data.type);
        const name = data.name || 'Item';
        
        this.dragPreview.innerHTML = `
            <span class="drag-preview-icon">${icon}</span>
            <span>${name}</span>
        `;
        
        this.dragPreview.classList.add('show');
    }

    /**
     * Hide drag preview
     */
    hideDragPreview() {
        this.dragPreview.classList.remove('show');
    }

    /**
     * Update drop indicator
     */
    updateDropIndicator(event, dropZone, isValid) {
        if (!isValid) {
            this.hideDropIndicator();
            return;
        }
        
        const rect = dropZone.element.getBoundingClientRect();
        const insertPosition = this.getInsertPosition(event, dropZone);
        
        if (insertPosition) {
            this.dropIndicator.className = `drop-indicator show ${insertPosition.orientation}`;
            
            if (insertPosition.orientation === 'horizontal') {
                this.dropIndicator.style.left = `${rect.left}px`;
                this.dropIndicator.style.right = 'auto';
                this.dropIndicator.style.width = `${rect.width}px`;
                this.dropIndicator.style.top = `${insertPosition.y}px`;
                this.dropIndicator.style.bottom = 'auto';
                this.dropIndicator.style.height = '2px';
            } else {
                this.dropIndicator.style.top = `${rect.top}px`;
                this.dropIndicator.style.bottom = 'auto';
                this.dropIndicator.style.height = `${rect.height}px`;
                this.dropIndicator.style.left = `${insertPosition.x}px`;
                this.dropIndicator.style.right = 'auto';
                this.dropIndicator.style.width = '2px';
            }
        } else {
            this.hideDropIndicator();
        }
    }

    /**
     * Hide drop indicator
     */
    hideDropIndicator() {
        this.dropIndicator.classList.remove('show');
    }

    /**
     * Get drop zone from event
     */
    getDropZoneFromEvent(event) {
        const element = event.target.closest('[data-drop-zone-id]');
        if (element) {
            const id = element.dataset.dropZoneId;
            return this.dropZones.get(id);
        }
        return null;
    }

    /**
     * Validate drop
     */
    validateDrop(dropZone, dragData) {
        // Check if drop zone accepts this type
        if (dropZone.config.accepts.length > 0 && 
            !dropZone.config.accepts.includes(dragData.type)) {
            return false;
        }
        
        // Custom validation
        if (dropZone.config.validateDrop) {
            return dropZone.config.validateDrop(dragData);
        }
        
        return true;
    }

    /**
     * Get drop data
     */
    getDropData(event, dropZone) {
        const rect = dropZone.element.getBoundingClientRect();
        const insertPosition = this.getInsertPosition(event, dropZone);
        
        return {
            element: dropZone.element,
            position: {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            },
            insertPosition,
            rect
        };
    }

    /**
     * Get insert position
     */
    getInsertPosition(event, dropZone) {
        // This can be customized based on drop zone type
        const rect = dropZone.element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const midX = rect.left + rect.width / 2;
        
        // Determine orientation and position
        if (Math.abs(event.clientY - midY) > Math.abs(event.clientX - midX)) {
            // Horizontal insertion
            return {
                orientation: 'horizontal',
                y: event.clientY < midY ? rect.top : rect.bottom,
                position: event.clientY < midY ? 'before' : 'after'
            };
        } else {
            // Vertical insertion
            return {
                orientation: 'vertical',
                x: event.clientX < midX ? rect.left : rect.right,
                position: event.clientX < midX ? 'before' : 'after'
            };
        }
    }

    /**
     * Get drag icon for type
     */
    getDragIcon(type) {
        const icons = {
            file: '📄',
            folder: '📁',
            prompt: '💬',
            image: '🖼️',
            code: '📝',
            default: '📋'
        };
        
        return icons[type] || icons.default;
    }

    /**
     * Clear drag over states
     */
    clearDragOverStates() {
        this.dropZones.forEach(dropZone => {
            dropZone.element.classList.remove('drag-over', 'drag-over-valid', 'drag-over-invalid');
        });
    }

    /**
     * Notify drag start
     */
    notifyDragStart(data) {
        const event = new CustomEvent('drag-start', {
            detail: { data }
        });
        document.dispatchEvent(event);
    }

    /**
     * Notify drag end
     */
    notifyDragEnd() {
        const event = new CustomEvent('drag-end');
        document.dispatchEvent(event);
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `drop-zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Setup file tree drag and drop
     */
    setupFileTreeDragDrop(fileTreeElement) {
        // Make file items draggable
        const fileItems = fileTreeElement.querySelectorAll('.tree-item[data-type="file"]');
        fileItems.forEach(item => {
            const path = item.dataset.path;
            const name = item.dataset.name;
            this.makeDraggable(item, {
                type: 'file',
                path,
                name
            });
        });
        
        // Make folder items drop zones
        const folderItems = fileTreeElement.querySelectorAll('.tree-item[data-type="folder"]');
        folderItems.forEach(item => {
            const path = item.dataset.path;
            this.registerDropZone(item, {
                accepts: ['file', 'folder'],
                onDrop: (dragData, dropData) => {
                    this.handleFileMove(dragData, path);
                },
                validateDrop: (dragData) => {
                    return dragData.path !== path && !dragData.path.startsWith(path + '/');
                }
            });
        });
    }

    /**
     * Setup prompt drag and drop
     */
    setupPromptDragDrop(promptContainer) {
        // Make prompt items draggable
        const promptItems = promptContainer.querySelectorAll('.prompt-item');
        promptItems.forEach(item => {
            const id = item.dataset.promptId;
            const category = item.dataset.category;
            this.makeDraggable(item, {
                type: 'prompt',
                id,
                category,
                name: item.querySelector('.prompt-preview')?.textContent?.substring(0, 50) + '...'
            });
        });
        
        // Make category zones drop zones
        const categoryZones = promptContainer.querySelectorAll('.prompt-category-zone');
        categoryZones.forEach(zone => {
            const category = zone.dataset.category;
            this.registerDropZone(zone, {
                accepts: ['prompt'],
                onDrop: (dragData, dropData) => {
                    this.handlePromptCategoryChange(dragData.id, category);
                },
                validateDrop: (dragData) => {
                    return dragData.category !== category;
                }
            });
        });
    }

    /**
     * Handle file move
     */
    handleFileMove(dragData, targetPath) {
        const event = new CustomEvent('file-move', {
            detail: {
                sourcePath: dragData.path,
                targetPath: targetPath,
                type: dragData.type
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Handle prompt category change
     */
    handlePromptCategoryChange(promptId, newCategory) {
        const event = new CustomEvent('prompt-category-change', {
            detail: {
                promptId,
                newCategory
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Destroy the service
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('dragstart', this.handleDragStart);
        document.removeEventListener('dragend', this.handleDragEnd);
        document.removeEventListener('dragover', this.handleDragOver);
        document.removeEventListener('drop', this.handleDrop);
        document.removeEventListener('dragenter', this.handleDragEnter);
        document.removeEventListener('dragleave', this.handleDragLeave);
        
        // Remove visual elements
        if (this.dragPreview && this.dragPreview.parentNode) {
            this.dragPreview.parentNode.removeChild(this.dragPreview);
        }
        
        if (this.dropIndicator && this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }
        
        // Clear drop zones
        this.dropZones.clear();
        
        console.log('✅ DragDropService destroyed');
    }
}