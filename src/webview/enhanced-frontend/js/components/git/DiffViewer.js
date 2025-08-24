/**
 * DiffViewer Component - Syntax highlighting diff viewer
 */

import { Component } from '../base/Component.js';

export class DiffViewer extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // State
        this.currentDiff = [];
        this.gitStatus = {
            staged: [],
            unstaged: [],
            untracked: [],
            conflicted: []
        };
        this.selectedFile = null;
        this.viewMode = 'unified'; // 'unified' or 'split'
        this.showWhitespace = false;
        this.contextLines = 3;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.element = this.createElement('div', {}, ['diff-viewer']);

        this.element.innerHTML = `
            <div class="diff-viewer-header">
                <div class="diff-controls">
                    <div class="view-mode-controls">
                        <button class="btn btn-sm ${this.viewMode === 'unified' ? 'active' : ''}" 
                                id="unifiedViewBtn" title="Unified view">
                            <span class="icon">📄</span>
                            Unified
                        </button>
                        <button class="btn btn-sm ${this.viewMode === 'split' ? 'active' : ''}" 
                                id="splitViewBtn" title="Split view">
                            <span class="icon">🔀</span>
                            Split
                        </button>
                    </div>
                    
                    <div class="diff-options">
                        <button class="btn btn-sm ${this.showWhitespace ? 'active' : ''}" 
                                id="whitespaceBtn" title="Show whitespace">
                            <span class="icon">⎵</span>
                        </button>
                        <select class="input" id="contextSelect" title="Context lines">
                            <option value="1">1 line</option>
                            <option value="3" selected>3 lines</option>
                            <option value="5">5 lines</option>
                            <option value="10">10 lines</option>
                            <option value="-1">All</option>
                        </select>
                    </div>
                </div>
                
                <div class="diff-stats" id="diffStats">
                    <!-- Diff statistics will be shown here -->
                </div>
            </div>
            
            <div class="diff-viewer-content">
                <div class="file-list" id="fileList">
                    <!-- Changed files list -->
                </div>
                
                <div class="diff-content" id="diffContent">
                    <div class="empty-state" id="emptyState">
                        <div class="empty-icon">📝</div>
                        <p>No changes to display</p>
                        <p class="empty-description">Make some changes to see the diff here.</p>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.unifiedViewBtn = this.querySelector('#unifiedViewBtn');
        this.splitViewBtn = this.querySelector('#splitViewBtn');
        this.whitespaceBtn = this.querySelector('#whitespaceBtn');
        this.contextSelect = this.querySelector('#contextSelect');
        this.diffStats = this.querySelector('#diffStats');
        this.fileList = this.querySelector('#fileList');
        this.diffContent = this.querySelector('#diffContent');
        this.emptyState = this.querySelector('#emptyState');
    }

    setupEventListeners() {
        // View mode controls
        this.addEventListener(this.unifiedViewBtn, 'click', () => this.setViewMode('unified'));
        this.addEventListener(this.splitViewBtn, 'click', () => this.setViewMode('split'));
        
        // Options
        this.addEventListener(this.whitespaceBtn, 'click', this.toggleWhitespace);
        this.addEventListener(this.contextSelect, 'change', this.handleContextChange);
    }

    updateDiff(diffData, gitStatus) {
        this.currentDiff = diffData || [];
        this.gitStatus = gitStatus || this.gitStatus;
        
        this.renderFileList();
        this.renderDiffStats();
        this.renderDiffContent();
    }

    renderFileList() {
        if (!this.fileList) return;

        // Combine all changed files
        const allFiles = [
            ...this.gitStatus.staged.map(file => ({ path: file, status: 'staged' })),
            ...this.gitStatus.unstaged.map(file => ({ path: file, status: 'unstaged' })),
            ...this.gitStatus.untracked.map(file => ({ path: file, status: 'untracked' })),
            ...this.gitStatus.conflicted.map(file => ({ path: file, status: 'conflicted' }))
        ];

        // Remove duplicates, preferring staged over unstaged
        const uniqueFiles = [];
        const seenFiles = new Set();
        
        for (const file of allFiles) {
            if (!seenFiles.has(file.path)) {
                uniqueFiles.push(file);
                seenFiles.add(file.path);
            }
        }

        if (uniqueFiles.length === 0) {
            this.fileList.innerHTML = '<div class="no-files">No changed files</div>';
            return;
        }

        this.fileList.innerHTML = `
            <div class="file-list-header">
                <h4>Changed Files (${uniqueFiles.length})</h4>
            </div>
            <div class="file-list-content">
                ${uniqueFiles.map(file => this.createFileListItem(file)).join('')}
            </div>
        `;

        // Add event listeners to file items
        const fileItems = this.fileList.querySelectorAll('.file-list-item');
        fileItems.forEach((item, index) => {
            this.addEventListener(item, 'click', () => {
                this.selectFile(uniqueFiles[index]);
            });
        });
    }

    createFileListItem(file) {
        const statusIcon = this.getStatusIcon(file.status);
        const statusClass = `status-${file.status}`;
        const isSelected = this.selectedFile && this.selectedFile.path === file.path;

        return `
            <div class="file-list-item ${isSelected ? 'selected' : ''}" data-file="${file.path}">
                <div class="file-status ${statusClass}">
                    <span class="status-icon">${statusIcon}</span>
                </div>
                <div class="file-info">
                    <div class="file-name">${this.getFileName(file.path)}</div>
                    <div class="file-path">${file.path}</div>
                </div>
                <div class="file-actions">
                    ${file.status === 'unstaged' ? `
                        <button class="btn btn-icon btn-sm stage-file-btn" title="Stage file">
                            <span class="icon">➕</span>
                        </button>
                    ` : ''}
                    ${file.status === 'staged' ? `
                        <button class="btn btn-icon btn-sm unstage-file-btn" title="Unstage file">
                            <span class="icon">➖</span>
                        </button>
                    ` : ''}
                    <button class="btn btn-icon btn-sm discard-file-btn" title="Discard changes">
                        <span class="icon">🗑️</span>
                    </button>
                </div>
            </div>
        `;
    }

    selectFile(file) {
        // Update selection in file list
        const previousSelected = this.fileList.querySelector('.file-list-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        const currentItem = this.fileList.querySelector(`[data-file="${file.path}"]`);
        if (currentItem) {
            currentItem.classList.add('selected');
        }

        this.selectedFile = file;
        this.loadFileDiff(file.path);
    }

    async loadFileDiff(filePath) {
        try {
            await this.sendGitCommand('diff', { file: filePath });
        } catch (error) {
            console.error('Failed to load file diff:', error);
            this.showError('Failed to load file diff');
        }
    }

    renderDiffStats() {
        if (!this.diffStats) return;

        const totalFiles = this.currentDiff.length;
        let totalAdditions = 0;
        let totalDeletions = 0;

        this.currentDiff.forEach(fileDiff => {
            totalAdditions += fileDiff.additions || 0;
            totalDeletions += fileDiff.deletions || 0;
        });

        this.diffStats.innerHTML = `
            <div class="diff-stat-item">
                <span class="stat-icon">📁</span>
                <span class="stat-value">${totalFiles}</span>
                <span class="stat-label">${totalFiles === 1 ? 'file' : 'files'}</span>
            </div>
            <div class="diff-stat-item additions">
                <span class="stat-icon">➕</span>
                <span class="stat-value">${totalAdditions}</span>
                <span class="stat-label">additions</span>
            </div>
            <div class="diff-stat-item deletions">
                <span class="stat-icon">➖</span>
                <span class="stat-value">${totalDeletions}</span>
                <span class="stat-label">deletions</span>
            </div>
        `;
    }

    renderDiffContent() {
        if (!this.diffContent) return;

        if (this.currentDiff.length === 0) {
            this.diffContent.innerHTML = this.emptyState.outerHTML;
            return;
        }

        let content = '';
        
        if (this.selectedFile) {
            // Show diff for selected file
            const fileDiff = this.currentDiff.find(diff => diff.file === this.selectedFile.path);
            if (fileDiff) {
                content = this.renderFileDiff(fileDiff);
            }
        } else {
            // Show all diffs
            content = this.currentDiff.map(fileDiff => this.renderFileDiff(fileDiff)).join('');
        }

        this.diffContent.innerHTML = `<div class="diff-container">${content}</div>`;
    }

    renderFileDiff(fileDiff) {
        const fileName = this.getFileName(fileDiff.file);
        const fileExtension = this.getFileExtension(fileDiff.file);
        
        return `
            <div class="file-diff" data-file="${fileDiff.file}">
                <div class="file-diff-header">
                    <div class="file-diff-title">
                        <span class="file-icon">${this.getFileIcon(fileDiff.file)}</span>
                        <span class="file-name">${fileName}</span>
                        <span class="file-path">${fileDiff.file}</span>
                    </div>
                    <div class="file-diff-stats">
                        <span class="additions">+${fileDiff.additions || 0}</span>
                        <span class="deletions">-${fileDiff.deletions || 0}</span>
                    </div>
                </div>
                <div class="file-diff-content">
                    ${this.renderDiffLines(fileDiff.content || '', fileExtension)}
                </div>
            </div>
        `;
    }

    renderDiffLines(diffContent, fileExtension) {
        if (!diffContent) {
            return '<div class="no-diff">No changes in this file</div>';
        }

        const lines = diffContent.split('\n');
        let html = '';
        let lineNumber = 1;
        let oldLineNumber = 1;
        let newLineNumber = 1;

        if (this.viewMode === 'unified') {
            html += '<div class="diff-unified">';
            
            lines.forEach(line => {
                const lineType = this.getDiffLineType(line);
                const lineContent = this.escapeHtml(line.substring(1)); // Remove +/- prefix
                const highlightedContent = this.highlightSyntax(lineContent, fileExtension);
                
                html += `
                    <div class="diff-line ${lineType}" data-line="${lineNumber}">
                        <div class="line-numbers">
                            <span class="old-line-number">${lineType !== 'added' ? oldLineNumber : ''}</span>
                            <span class="new-line-number">${lineType !== 'removed' ? newLineNumber : ''}</span>
                        </div>
                        <div class="line-content">
                            <span class="line-prefix">${line.charAt(0)}</span>
                            <span class="line-text">${highlightedContent}</span>
                        </div>
                    </div>
                `;
                
                if (lineType !== 'added') oldLineNumber++;
                if (lineType !== 'removed') newLineNumber++;
                lineNumber++;
            });
            
            html += '</div>';
        } else {
            // Split view implementation
            html += this.renderSplitView(lines, fileExtension);
        }

        return html;
    }

    renderSplitView(lines, fileExtension) {
        let html = '<div class="diff-split">';
        html += '<div class="diff-split-old"><div class="split-header">Before</div>';
        html += '<div class="diff-split-new"><div class="split-header">After</div>';
        
        // Split view is more complex - simplified implementation
        lines.forEach(line => {
            const lineType = this.getDiffLineType(line);
            const lineContent = this.escapeHtml(line.substring(1));
            const highlightedContent = this.highlightSyntax(lineContent, fileExtension);
            
            if (lineType === 'removed') {
                html += `<div class="diff-line removed">${highlightedContent}</div>`;
            } else if (lineType === 'added') {
                html += `<div class="diff-line added">${highlightedContent}</div>`;
            } else {
                html += `<div class="diff-line context">${highlightedContent}</div>`;
            }
        });
        
        html += '</div></div>';
        return html;
    }

    getDiffLineType(line) {
        if (line.startsWith('+')) return 'added';
        if (line.startsWith('-')) return 'removed';
        if (line.startsWith('@@')) return 'hunk-header';
        return 'context';
    }

    highlightSyntax(content, fileExtension) {
        // Basic syntax highlighting - can be enhanced with a proper syntax highlighter
        if (!content.trim()) return content;

        // Simple keyword highlighting for common languages
        const keywords = {
            'js': ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export'],
            'ts': ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export', 'interface', 'type'],
            'py': ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'try', 'except'],
            'java': ['public', 'private', 'protected', 'class', 'interface', 'if', 'else', 'for', 'while', 'return'],
            'css': ['color', 'background', 'margin', 'padding', 'border', 'width', 'height', 'display', 'position']
        };

        let highlighted = this.escapeHtml(content);
        
        if (keywords[fileExtension]) {
            keywords[fileExtension].forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                highlighted = highlighted.replace(regex, `<span class="syntax-keyword">${keyword}</span>`);
            });
        }

        // Highlight strings
        highlighted = highlighted.replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="syntax-string">$1$2$1</span>');
        
        // Highlight comments
        if (['js', 'ts', 'java', 'css'].includes(fileExtension)) {
            highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, '<span class="syntax-comment">$&</span>');
            highlighted = highlighted.replace(/\/\/.*$/gm, '<span class="syntax-comment">$&</span>');
        } else if (fileExtension === 'py') {
            highlighted = highlighted.replace(/#.*$/gm, '<span class="syntax-comment">$&</span>');
        }

        return highlighted;
    }

    // Event Handlers
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button states
        this.unifiedViewBtn.classList.toggle('active', mode === 'unified');
        this.splitViewBtn.classList.toggle('active', mode === 'split');
        
        // Re-render diff content
        this.renderDiffContent();
    }

    toggleWhitespace() {
        this.showWhitespace = !this.showWhitespace;
        this.whitespaceBtn.classList.toggle('active', this.showWhitespace);
        
        // Re-render diff content with whitespace visibility
        this.renderDiffContent();
    }

    handleContextChange() {
        this.contextLines = parseInt(this.contextSelect.value);
        
        // Request new diff with updated context
        if (this.selectedFile) {
            this.loadFileDiff(this.selectedFile.path);
        }
    }

    // Utility Methods
    getStatusIcon(status) {
        const icons = {
            'staged': '✅',
            'unstaged': '📝',
            'untracked': '❓',
            'conflicted': '⚠️'
        };
        return icons[status] || '📄';
    }

    getFileName(filePath) {
        return filePath.split('/').pop();
    }

    getFileExtension(filePath) {
        return filePath.split('.').pop().toLowerCase();
    }

    getFileIcon(filePath) {
        const extension = this.getFileExtension(filePath);
        
        const iconMap = {
            'js': '📜', 'ts': '📘', 'jsx': '⚛️', 'tsx': '⚛️',
            'html': '🌐', 'css': '🎨', 'scss': '🎨', 'sass': '🎨',
            'json': '📋', 'md': '📝', 'txt': '📄',
            'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
            'php': '🐘', 'rb': '💎', 'go': '🐹', 'rs': '🦀'
        };

        return iconMap[extension] || '📄';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async sendGitCommand(operation, options = {}) {
        if (!this.webSocketClient) {
            throw new Error('WebSocket client not available');
        }

        const message = {
            type: 'git',
            id: this.generateMessageId(),
            data: {
                operation,
                options
            }
        };

        return this.webSocketClient.sendMessage(message);
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

    generateMessageId() {
        return `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}