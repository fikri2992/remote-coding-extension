/**
 * GitDashboard Component - Comprehensive git status and history visualization
 */

import { Component } from './base/Component.js';

export class GitDashboard extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Child components
        this.branchInfo = null;
        this.commitHistory = null;
        this.diffViewer = null;

        // State
        this.gitState = {
            currentBranch: '',
            status: {
                staged: [],
                unstaged: [],
                untracked: [],
                conflicted: []
            },
            recentCommits: [],
            currentDiff: [],
            remoteStatus: {
                ahead: 0,
                behind: 0,
                remote: ''
            }
        };

        this.refreshInterval = null;
        this.refreshIntervalMs = 30000; // 30 seconds
    }

    async initialize() {
        await super.initialize();
        this.render();
        await this.initializeChildComponents();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        
        // Request initial git data
        await this.refreshGitData();
    }

    render() {
        this.element = this.createElement('div', {}, ['git-dashboard']);

        this.element.innerHTML = `
            <div class="git-dashboard-header">
                <div class="dashboard-title">
                    <div class="icon">🔀</div>
                    <h3>Git Integration</h3>
                </div>
                <div class="dashboard-actions">
                    <button class="btn btn-icon" id="refreshButton" title="Refresh Git Status">
                        <span class="icon">🔄</span>
                    </button>
                    <button class="btn btn-icon" id="settingsButton" title="Git Settings">
                        <span class="icon">⚙️</span>
                    </button>
                </div>
            </div>
            
            <div class="git-dashboard-content">
                <div class="git-section branch-section">
                    <div id="branchInfoContainer"></div>
                </div>
                
                <div class="git-section commits-section">
                    <div class="section-header">
                        <h4>Recent Commits</h4>
                        <div class="section-actions">
                            <button class="btn btn-sm" id="viewAllCommitsButton">View All</button>
                        </div>
                    </div>
                    <div id="commitHistoryContainer"></div>
                </div>
                
                <div class="git-section diff-section">
                    <div class="section-header">
                        <h4>Current Changes</h4>
                        <div class="section-actions">
                            <button class="btn btn-sm" id="stageAllButton">Stage All</button>
                            <button class="btn btn-sm" id="commitButton">Commit</button>
                        </div>
                    </div>
                    <div id="diffViewerContainer"></div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.refreshButton = this.querySelector('#refreshButton');
        this.settingsButton = this.querySelector('#settingsButton');
        this.viewAllCommitsButton = this.querySelector('#viewAllCommitsButton');
        this.stageAllButton = this.querySelector('#stageAllButton');
        this.commitButton = this.querySelector('#commitButton');
        
        this.branchInfoContainer = this.querySelector('#branchInfoContainer');
        this.commitHistoryContainer = this.querySelector('#commitHistoryContainer');
        this.diffViewerContainer = this.querySelector('#diffViewerContainer');
    }

    async initializeChildComponents() {
        // Import and initialize child components
        const [
            { BranchInfo },
            { CommitHistory },
            { DiffViewer }
        ] = await Promise.all([
            import('./git/BranchInfo.js'),
            import('./git/CommitHistory.js'),
            import('./git/DiffViewer.js')
        ]);

        // Initialize BranchInfo component
        this.branchInfo = new BranchInfo({
            container: this.branchInfoContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });

        // Initialize CommitHistory component
        this.commitHistory = new CommitHistory({
            container: this.commitHistoryContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });

        // Initialize DiffViewer component
        this.diffViewer = new DiffViewer({
            container: this.diffViewerContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });

        // Initialize all child components
        await Promise.all([
            this.branchInfo.initialize(),
            this.commitHistory.initialize(),
            this.diffViewer.initialize()
        ]);

        // Add child components
        this.addChildComponent(this.branchInfo);
        this.addChildComponent(this.commitHistory);
        this.addChildComponent(this.diffViewer);
    }

    setupEventListeners() {
        // Button event listeners
        this.addEventListener(this.refreshButton, 'click', this.handleRefresh);
        this.addEventListener(this.settingsButton, 'click', this.handleSettings);
        this.addEventListener(this.viewAllCommitsButton, 'click', this.handleViewAllCommits);
        this.addEventListener(this.stageAllButton, 'click', this.handleStageAll);
        this.addEventListener(this.commitButton, 'click', this.handleCommit);

        // State manager listeners
        this.stateManager.subscribe('git', this.handleGitStateChange.bind(this));

        // WebSocket message listeners
        this.addEventListener(this.element, 'git-branch-changed', this.handleBranchChanged);
        this.addEventListener(this.element, 'git-commit-selected', this.handleCommitSelected);
        this.addEventListener(this.element, 'git-file-selected', this.handleFileSelected);
    }

    startRealTimeUpdates() {
        // Start periodic refresh
        this.refreshInterval = setInterval(() => {
            this.refreshGitData();
        }, this.refreshIntervalMs);

        // Listen for file system changes that might affect git status
        this.stateManager.subscribe('fileSystem', (fileSystemState) => {
            if (fileSystemState.lastModified) {
                // Debounce git status refresh when files change
                this.debounceGitRefresh();
            }
        });
    }

    debounceGitRefresh() {
        if (this.gitRefreshTimeout) {
            clearTimeout(this.gitRefreshTimeout);
        }
        
        this.gitRefreshTimeout = setTimeout(() => {
            this.refreshGitStatus();
        }, 2000); // 2 second debounce
    }

    async refreshGitData() {
        try {
            // Request all git data
            await Promise.all([
                this.refreshGitStatus(),
                this.refreshBranchInfo(),
                this.refreshCommitHistory(),
                this.refreshCurrentDiff()
            ]);
        } catch (error) {
            console.error('Failed to refresh git data:', error);
            this.showError('Failed to refresh git data');
        }
    }

    async refreshGitStatus() {
        return this.sendGitCommand('status');
    }

    async refreshBranchInfo() {
        return this.sendGitCommand('branch');
    }

    async refreshCommitHistory() {
        return this.sendGitCommand('log', { limit: 10 });
    }

    async refreshCurrentDiff() {
        return this.sendGitCommand('diff');
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

    handleGitStateChange(gitState) {
        this.gitState = { ...this.gitState, ...gitState };
        this.updateUI();
    }

    updateUI() {
        // Update child components with new state
        if (this.branchInfo) {
            this.branchInfo.updateBranchInfo(this.gitState);
        }

        if (this.commitHistory) {
            this.commitHistory.updateCommits(this.gitState.recentCommits);
        }

        if (this.diffViewer) {
            this.diffViewer.updateDiff(this.gitState.currentDiff, this.gitState.status);
        }

        // Update action button states
        this.updateActionButtons();
    }

    updateActionButtons() {
        const hasChanges = this.gitState.status.unstaged.length > 0 || 
                          this.gitState.status.untracked.length > 0;
        const hasStaged = this.gitState.status.staged.length > 0;

        // Update stage all button
        if (this.stageAllButton) {
            this.stageAllButton.disabled = !hasChanges;
            this.stageAllButton.textContent = hasChanges ? 
                `Stage All (${hasChanges ? this.gitState.status.unstaged.length + this.gitState.status.untracked.length : 0})` : 
                'Stage All';
        }

        // Update commit button
        if (this.commitButton) {
            this.commitButton.disabled = !hasStaged;
            this.commitButton.textContent = hasStaged ? 
                `Commit (${this.gitState.status.staged.length})` : 
                'Commit';
        }
    }

    // Event Handlers
    async handleRefresh() {
        this.setRefreshButtonLoading(true);
        
        try {
            await this.refreshGitData();
            this.showSuccess('Git data refreshed');
        } catch (error) {
            this.showError('Failed to refresh git data');
        } finally {
            this.setRefreshButtonLoading(false);
        }
    }

    handleSettings() {
        // Open git settings dialog
        this.emit('git-settings-requested');
    }

    handleViewAllCommits() {
        // Open commit history view
        this.emit('git-commits-view-requested');
    }

    async handleStageAll() {
        try {
            await this.sendGitCommand('add', { files: ['.'] });
            this.showSuccess('All changes staged');
            await this.refreshGitStatus();
        } catch (error) {
            this.showError('Failed to stage changes');
        }
    }

    async handleCommit() {
        // Open commit dialog
        this.emit('git-commit-dialog-requested');
    }

    handleBranchChanged(event) {
        const { branch } = event.detail;
        this.emit('git-branch-switch-requested', { branch });
    }

    handleCommitSelected(event) {
        const { commit } = event.detail;
        this.emit('git-commit-details-requested', { commit });
    }

    handleFileSelected(event) {
        const { file } = event.detail;
        this.emit('git-file-diff-requested', { file });
    }

    // Utility Methods
    setRefreshButtonLoading(loading) {
        if (this.refreshButton) {
            const icon = this.refreshButton.querySelector('.icon');
            if (loading) {
                icon.textContent = '⏳';
                this.refreshButton.disabled = true;
            } else {
                icon.textContent = '🔄';
                this.refreshButton.disabled = false;
            }
        }
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
        return `git-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    destroy() {
        // Stop real-time updates
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        if (this.gitRefreshTimeout) {
            clearTimeout(this.gitRefreshTimeout);
            this.gitRefreshTimeout = null;
        }

        super.destroy();
    }
}