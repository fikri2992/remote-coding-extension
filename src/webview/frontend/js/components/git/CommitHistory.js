/**
 * CommitHistory Component - Card-based commit visualization
 */

import { Component } from '../base/Component.js';

export class CommitHistory extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // State
        this.commits = [];
        this.selectedCommit = null;
        this.loadingMore = false;
        this.hasMore = true;
        this.limit = 10;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.element = this.createElement('div', {}, ['commit-history']);

        this.element.innerHTML = `
            <div class="commit-history-container">
                <div class="commit-list" id="commitList">
                    <!-- Commits will be rendered here -->
                </div>
                
                <div class="commit-history-footer" id="commitHistoryFooter">
                    <button class="btn btn-sm" id="loadMoreButton">
                        <span class="icon">⬇️</span>
                        Load More Commits
                    </button>
                </div>
                
                <div class="loading-indicator" id="loadingIndicator" style="display: none;">
                    <div class="spinner"></div>
                    <span>Loading commits...</span>
                </div>
                
                <div class="empty-state" id="emptyState" style="display: none;">
                    <div class="empty-icon">📝</div>
                    <p>No commits found</p>
                    <p class="empty-description">This repository doesn't have any commits yet.</p>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.commitList = this.querySelector('#commitList');
        this.loadMoreButton = this.querySelector('#loadMoreButton');
        this.loadingIndicator = this.querySelector('#loadingIndicator');
        this.emptyState = this.querySelector('#emptyState');
        this.commitHistoryFooter = this.querySelector('#commitHistoryFooter');
    }

    setupEventListeners() {
        this.addEventListener(this.loadMoreButton, 'click', this.handleLoadMore);
    }

    updateCommits(commits) {
        this.commits = commits || [];
        this.renderCommits();
    }

    renderCommits() {
        if (!this.commitList) return;

        // Show/hide empty state
        if (this.commits.length === 0) {
            this.commitList.style.display = 'none';
            this.commitHistoryFooter.style.display = 'none';
            this.emptyState.style.display = 'block';
            return;
        }

        this.commitList.style.display = 'block';
        this.commitHistoryFooter.style.display = 'block';
        this.emptyState.style.display = 'none';

        // Clear existing commits
        this.commitList.innerHTML = '';

        // Render each commit
        this.commits.forEach((commit, index) => {
            const commitCard = this.createCommitCard(commit, index);
            this.commitList.appendChild(commitCard);
        });

        // Update load more button
        this.updateLoadMoreButton();
    }

    createCommitCard(commit, index) {
        const commitCard = this.createElement('div', {}, ['commit-card']);
        
        if (this.selectedCommit && this.selectedCommit.hash === commit.hash) {
            commitCard.classList.add('selected');
        }

        const shortHash = commit.hash ? commit.hash.substring(0, 7) : 'unknown';
        const authorName = commit.author || 'Unknown';
        const commitDate = commit.date ? new Date(commit.date) : new Date();
        const relativeTime = this.formatRelativeTime(commitDate);
        const filesChanged = commit.files ? commit.files.length : 0;

        commitCard.innerHTML = `
            <div class="commit-card-header">
                <div class="commit-hash">
                    <span class="hash-icon">🔗</span>
                    <span class="hash-text">${shortHash}</span>
                    <button class="btn btn-icon btn-sm copy-hash-btn" title="Copy hash">
                        <span class="icon">📋</span>
                    </button>
                </div>
                <div class="commit-actions">
                    <button class="btn btn-icon btn-sm" title="View commit details">
                        <span class="icon">👁️</span>
                    </button>
                    <button class="btn btn-icon btn-sm" title="Cherry-pick commit">
                        <span class="icon">🍒</span>
                    </button>
                </div>
            </div>
            
            <div class="commit-card-body">
                <div class="commit-message">
                    <div class="message-title">${this.escapeHtml(commit.message || 'No commit message')}</div>
                </div>
                
                <div class="commit-meta">
                    <div class="commit-author">
                        <span class="author-icon">👤</span>
                        <span class="author-name">${this.escapeHtml(authorName)}</span>
                    </div>
                    <div class="commit-date">
                        <span class="date-icon">🕒</span>
                        <span class="date-text" title="${commitDate.toLocaleString()}">${relativeTime}</span>
                    </div>
                </div>
                
                <div class="commit-stats">
                    <div class="stat-item files">
                        <span class="stat-icon">📁</span>
                        <span class="stat-value">${filesChanged}</span>
                        <span class="stat-label">${filesChanged === 1 ? 'file' : 'files'}</span>
                    </div>
                    ${commit.additions !== undefined ? `
                        <div class="stat-item additions">
                            <span class="stat-icon">➕</span>
                            <span class="stat-value">${commit.additions}</span>
                            <span class="stat-label">additions</span>
                        </div>
                    ` : ''}
                    ${commit.deletions !== undefined ? `
                        <div class="stat-item deletions">
                            <span class="stat-icon">➖</span>
                            <span class="stat-value">${commit.deletions}</span>
                            <span class="stat-label">deletions</span>
                        </div>
                    ` : ''}
                </div>
                
                ${commit.files && commit.files.length > 0 ? `
                    <div class="commit-files">
                        <div class="files-header">
                            <span class="files-title">Changed files:</span>
                            <button class="btn btn-sm toggle-files-btn">
                                <span class="icon">👁️</span>
                                <span class="toggle-text">Show</span>
                            </button>
                        </div>
                        <div class="files-list" style="display: none;">
                            ${commit.files.map(file => `
                                <div class="file-item">
                                    <span class="file-icon">${this.getFileIcon(file)}</span>
                                    <span class="file-path">${this.escapeHtml(file)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Add event listeners
        this.setupCommitCardEventListeners(commitCard, commit);

        return commitCard;
    }

    setupCommitCardEventListeners(commitCard, commit) {
        // Click to select commit
        this.addEventListener(commitCard, 'click', (event) => {
            // Don't select if clicking on buttons
            if (event.target.closest('button')) return;
            
            this.selectCommit(commit);
        });

        // Copy hash button
        const copyHashBtn = commitCard.querySelector('.copy-hash-btn');
        this.addEventListener(copyHashBtn, 'click', (event) => {
            event.stopPropagation();
            this.copyToClipboard(commit.hash);
        });

        // View details button
        const viewDetailsBtn = commitCard.querySelector('.commit-actions .btn:first-child');
        this.addEventListener(viewDetailsBtn, 'click', (event) => {
            event.stopPropagation();
            this.viewCommitDetails(commit);
        });

        // Cherry-pick button
        const cherryPickBtn = commitCard.querySelector('.commit-actions .btn:last-child');
        this.addEventListener(cherryPickBtn, 'click', (event) => {
            event.stopPropagation();
            this.cherryPickCommit(commit);
        });

        // Toggle files button
        const toggleFilesBtn = commitCard.querySelector('.toggle-files-btn');
        if (toggleFilesBtn) {
            this.addEventListener(toggleFilesBtn, 'click', (event) => {
                event.stopPropagation();
                this.toggleCommitFiles(commitCard);
            });
        }

        // File item clicks
        const fileItems = commitCard.querySelectorAll('.file-item');
        fileItems.forEach(fileItem => {
            this.addEventListener(fileItem, 'click', (event) => {
                event.stopPropagation();
                const filePath = fileItem.querySelector('.file-path').textContent;
                this.viewFileDiff(commit, filePath);
            });
        });
    }

    selectCommit(commit) {
        // Remove previous selection
        const previousSelected = this.commitList.querySelector('.commit-card.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        // Add selection to current commit
        const currentCard = Array.from(this.commitList.children).find(card => {
            const hashText = card.querySelector('.hash-text').textContent;
            return commit.hash.startsWith(hashText);
        });

        if (currentCard) {
            currentCard.classList.add('selected');
        }

        this.selectedCommit = commit;
        this.emit('git-commit-selected', { commit });
    }

    toggleCommitFiles(commitCard) {
        const filesList = commitCard.querySelector('.files-list');
        const toggleBtn = commitCard.querySelector('.toggle-files-btn');
        const toggleText = toggleBtn.querySelector('.toggle-text');
        const toggleIcon = toggleBtn.querySelector('.icon');

        if (filesList.style.display === 'none') {
            filesList.style.display = 'block';
            toggleText.textContent = 'Hide';
            toggleIcon.textContent = '🙈';
        } else {
            filesList.style.display = 'none';
            toggleText.textContent = 'Show';
            toggleIcon.textContent = '👁️';
        }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Commit hash copied to clipboard');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showError('Failed to copy commit hash');
        }
    }

    viewCommitDetails(commit) {
        this.emit('git-commit-details-requested', { commit });
    }

    async cherryPickCommit(commit) {
        try {
            await this.sendGitCommand('cherry-pick', { commit: commit.hash });
            this.showSuccess(`Cherry-picked commit ${commit.hash.substring(0, 7)}`);
        } catch (error) {
            this.showError('Failed to cherry-pick commit');
        }
    }

    viewFileDiff(commit, filePath) {
        this.emit('git-file-diff-requested', { commit, file: filePath });
    }

    async handleLoadMore() {
        if (this.loadingMore || !this.hasMore) return;

        this.loadingMore = true;
        this.setLoadMoreButtonLoading(true);

        try {
            const offset = this.commits.length;
            await this.sendGitCommand('log', { 
                limit: this.limit, 
                offset 
            });
        } catch (error) {
            this.showError('Failed to load more commits');
        } finally {
            this.loadingMore = false;
            this.setLoadMoreButtonLoading(false);
        }
    }

    updateLoadMoreButton() {
        if (this.loadMoreButton) {
            this.loadMoreButton.style.display = this.hasMore ? 'block' : 'none';
        }
    }

    setLoadMoreButtonLoading(loading) {
        if (this.loadMoreButton) {
            const icon = this.loadMoreButton.querySelector('.icon');
            if (loading) {
                icon.textContent = '⏳';
                this.loadMoreButton.disabled = true;
            } else {
                icon.textContent = '⬇️';
                this.loadMoreButton.disabled = false;
            }
        }
    }

    // Utility Methods
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const diffWeeks = Math.floor(diffMs / 604800000);
        const diffMonths = Math.floor(diffMs / 2629746000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffWeeks < 4) return `${diffWeeks}w ago`;
        if (diffMonths < 12) return `${diffMonths}mo ago`;
        
        const diffYears = Math.floor(diffMonths / 12);
        return `${diffYears}y ago`;
    }

    getFileIcon(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        
        const iconMap = {
            'js': '📜',
            'ts': '📘',
            'jsx': '⚛️',
            'tsx': '⚛️',
            'html': '🌐',
            'css': '🎨',
            'scss': '🎨',
            'sass': '🎨',
            'json': '📋',
            'md': '📝',
            'txt': '📄',
            'py': '🐍',
            'java': '☕',
            'cpp': '⚙️',
            'c': '⚙️',
            'php': '🐘',
            'rb': '💎',
            'go': '🐹',
            'rs': '🦀',
            'xml': '📰',
            'yml': '⚙️',
            'yaml': '⚙️',
            'dockerfile': '🐳',
            'gitignore': '🙈',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'svg': '🎨'
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

    showSuccess(message) {
        if (this.notificationService) {
            this.notificationService.show({
                type: 'success',
                message,
                duration: 3000
            });
        }
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
        return `commits-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}