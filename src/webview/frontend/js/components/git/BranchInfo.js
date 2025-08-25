/**
 * BranchInfo Component - Current branch and remote status display
 */

import { Component } from '../base/Component.js';

export class BranchInfo extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // State
        this.branchData = {
            currentBranch: '',
            remoteStatus: {
                ahead: 0,
                behind: 0,
                remote: ''
            },
            branches: [],
            isDirty: false,
            lastFetch: null
        };
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.element = this.createElement('div', {}, ['branch-info']);

        this.element.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="branch-icon">🌿</div>
                        Current Branch
                    </div>
                    <div class="branch-actions">
                        <button class="btn btn-icon btn-sm" id="fetchButton" title="Fetch from remote">
                            <span class="icon">⬇️</span>
                        </button>
                        <button class="btn btn-icon btn-sm" id="branchMenuButton" title="Branch menu">
                            <span class="icon">⋮</span>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="branch-main-info">
                        <div class="current-branch">
                            <div class="branch-name" id="branchName">
                                <span class="branch-icon">🔀</span>
                                <span class="name">main</span>
                            </div>
                            <div class="branch-status" id="branchStatus">
                                <div class="status-indicator">
                                    <span class="status-dot connected"></span>
                                    <span>Up to date</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="remote-info" id="remoteInfo">
                            <div class="remote-status">
                                <div class="remote-name">
                                    <span class="icon">🌐</span>
                                    <span id="remoteName">origin</span>
                                </div>
                                <div class="sync-status" id="syncStatus">
                                    <div class="sync-item ahead" id="aheadStatus">
                                        <span class="icon">⬆️</span>
                                        <span class="count">0</span>
                                        <span class="label">ahead</span>
                                    </div>
                                    <div class="sync-item behind" id="behindStatus">
                                        <span class="icon">⬇️</span>
                                        <span class="count">0</span>
                                        <span class="label">behind</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="branch-details" id="branchDetails">
                        <div class="detail-item">
                            <span class="label">Last fetch:</span>
                            <span class="value" id="lastFetchTime">Never</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">Working tree:</span>
                            <span class="value" id="workingTreeStatus">Clean</span>
                        </div>
                    </div>
                    
                    <div class="branch-actions-bar" id="branchActionsBar">
                        <button class="btn btn-sm" id="pullButton">
                            <span class="icon">⬇️</span>
                            Pull
                        </button>
                        <button class="btn btn-sm" id="pushButton">
                            <span class="icon">⬆️</span>
                            Push
                        </button>
                        <button class="btn btn-sm" id="switchBranchButton">
                            <span class="icon">🔀</span>
                            Switch
                        </button>
                        <button class="btn btn-sm" id="newBranchButton">
                            <span class="icon">➕</span>
                            New Branch
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="branch-menu" id="branchMenu" style="display: none;">
                <div class="menu-content">
                    <div class="menu-header">
                        <h4>Branches</h4>
                        <button class="btn btn-icon btn-sm" id="closeBranchMenu">
                            <span class="icon">✕</span>
                        </button>
                    </div>
                    <div class="menu-body">
                        <div class="branch-list" id="branchList">
                            <!-- Branch list will be populated here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.fetchButton = this.querySelector('#fetchButton');
        this.branchMenuButton = this.querySelector('#branchMenuButton');
        this.branchName = this.querySelector('#branchName .name');
        this.branchStatus = this.querySelector('#branchStatus');
        this.remoteName = this.querySelector('#remoteName');
        this.syncStatus = this.querySelector('#syncStatus');
        this.aheadStatus = this.querySelector('#aheadStatus');
        this.behindStatus = this.querySelector('#behindStatus');
        this.lastFetchTime = this.querySelector('#lastFetchTime');
        this.workingTreeStatus = this.querySelector('#workingTreeStatus');
        
        // Action buttons
        this.pullButton = this.querySelector('#pullButton');
        this.pushButton = this.querySelector('#pushButton');
        this.switchBranchButton = this.querySelector('#switchBranchButton');
        this.newBranchButton = this.querySelector('#newBranchButton');
        
        // Branch menu
        this.branchMenu = this.querySelector('#branchMenu');
        this.closeBranchMenu = this.querySelector('#closeBranchMenu');
        this.branchList = this.querySelector('#branchList');
    }

    setupEventListeners() {
        // Button event listeners
        this.addEventListener(this.fetchButton, 'click', this.handleFetch);
        this.addEventListener(this.branchMenuButton, 'click', this.handleBranchMenu);
        this.addEventListener(this.closeBranchMenu, 'click', this.handleCloseBranchMenu);
        
        this.addEventListener(this.pullButton, 'click', this.handlePull);
        this.addEventListener(this.pushButton, 'click', this.handlePush);
        this.addEventListener(this.switchBranchButton, 'click', this.handleSwitchBranch);
        this.addEventListener(this.newBranchButton, 'click', this.handleNewBranch);

        // Close menu when clicking outside
        this.addEventListener(document, 'click', (event) => {
            if (!this.branchMenu.contains(event.target) && 
                !this.branchMenuButton.contains(event.target)) {
                this.hideBranchMenu();
            }
        });
    }

    updateBranchInfo(gitState) {
        this.branchData = {
            currentBranch: gitState.currentBranch || '',
            remoteStatus: gitState.remoteStatus || { ahead: 0, behind: 0, remote: '' },
            branches: gitState.branches || [],
            isDirty: this.calculateDirtyState(gitState.status),
            lastFetch: gitState.lastFetch || null
        };

        this.updateUI();
    }

    calculateDirtyState(status) {
        if (!status) return false;
        
        return status.staged.length > 0 || 
               status.unstaged.length > 0 || 
               status.untracked.length > 0 || 
               status.conflicted.length > 0;
    }

    updateUI() {
        this.updateBranchName();
        this.updateBranchStatus();
        this.updateRemoteInfo();
        this.updateBranchDetails();
        this.updateActionButtons();
    }

    updateBranchName() {
        if (this.branchName) {
            this.branchName.textContent = this.branchData.currentBranch || 'Unknown';
        }
    }

    updateBranchStatus() {
        if (!this.branchStatus) return;

        const statusIndicator = this.branchStatus.querySelector('.status-indicator');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('span:last-child');

        // Determine status based on remote sync and working tree
        let status = 'up-to-date';
        let statusClass = 'connected';
        let statusMessage = 'Up to date';

        if (this.branchData.isDirty) {
            status = 'dirty';
            statusClass = 'warning';
            statusMessage = 'Working tree dirty';
        } else if (this.branchData.remoteStatus.behind > 0) {
            status = 'behind';
            statusClass = 'warning';
            statusMessage = `${this.branchData.remoteStatus.behind} commits behind`;
        } else if (this.branchData.remoteStatus.ahead > 0) {
            status = 'ahead';
            statusClass = 'warning';
            statusMessage = `${this.branchData.remoteStatus.ahead} commits ahead`;
        }

        // Update status dot class
        statusDot.className = `status-dot ${statusClass}`;
        statusText.textContent = statusMessage;
    }

    updateRemoteInfo() {
        if (!this.remoteName || !this.syncStatus) return;

        // Update remote name
        this.remoteName.textContent = this.branchData.remoteStatus.remote || 'origin';

        // Update ahead/behind counts
        const aheadCount = this.aheadStatus.querySelector('.count');
        const behindCount = this.behindStatus.querySelector('.count');

        aheadCount.textContent = this.branchData.remoteStatus.ahead || 0;
        behindCount.textContent = this.branchData.remoteStatus.behind || 0;

        // Show/hide sync items based on counts
        this.aheadStatus.style.display = this.branchData.remoteStatus.ahead > 0 ? 'flex' : 'none';
        this.behindStatus.style.display = this.branchData.remoteStatus.behind > 0 ? 'flex' : 'none';

        // If both are 0, show "in sync" message
        if (this.branchData.remoteStatus.ahead === 0 && this.branchData.remoteStatus.behind === 0) {
            this.syncStatus.innerHTML = `
                <div class="sync-item in-sync">
                    <span class="icon">✅</span>
                    <span class="label">In sync</span>
                </div>
            `;
        }
    }

    updateBranchDetails() {
        // Update last fetch time
        if (this.lastFetchTime) {
            if (this.branchData.lastFetch) {
                const fetchTime = new Date(this.branchData.lastFetch);
                this.lastFetchTime.textContent = this.formatRelativeTime(fetchTime);
            } else {
                this.lastFetchTime.textContent = 'Never';
            }
        }

        // Update working tree status
        if (this.workingTreeStatus) {
            this.workingTreeStatus.textContent = this.branchData.isDirty ? 'Dirty' : 'Clean';
            this.workingTreeStatus.className = `value ${this.branchData.isDirty ? 'warning' : 'success'}`;
        }
    }

    updateActionButtons() {
        // Update pull button
        if (this.pullButton) {
            this.pullButton.disabled = this.branchData.remoteStatus.behind === 0;
            if (this.branchData.remoteStatus.behind > 0) {
                this.pullButton.innerHTML = `
                    <span class="icon">⬇️</span>
                    Pull (${this.branchData.remoteStatus.behind})
                `;
            } else {
                this.pullButton.innerHTML = `
                    <span class="icon">⬇️</span>
                    Pull
                `;
            }
        }

        // Update push button
        if (this.pushButton) {
            this.pushButton.disabled = this.branchData.remoteStatus.ahead === 0;
            if (this.branchData.remoteStatus.ahead > 0) {
                this.pushButton.innerHTML = `
                    <span class="icon">⬆️</span>
                    Push (${this.branchData.remoteStatus.ahead})
                `;
            } else {
                this.pushButton.innerHTML = `
                    <span class="icon">⬆️</span>
                    Push
                `;
            }
        }
    }

    // Event Handlers
    async handleFetch() {
        this.setFetchButtonLoading(true);
        
        try {
            await this.sendGitCommand('fetch');
            this.showSuccess('Fetched from remote');
            this.branchData.lastFetch = new Date();
            this.updateBranchDetails();
        } catch (error) {
            this.showError('Failed to fetch from remote');
        } finally {
            this.setFetchButtonLoading(false);
        }
    }

    handleBranchMenu() {
        this.showBranchMenu();
    }

    handleCloseBranchMenu() {
        this.hideBranchMenu();
    }

    async handlePull() {
        try {
            await this.sendGitCommand('pull');
            this.showSuccess('Pulled changes from remote');
            this.emit('git-branch-changed', { branch: this.branchData.currentBranch });
        } catch (error) {
            this.showError('Failed to pull changes');
        }
    }

    async handlePush() {
        try {
            await this.sendGitCommand('push');
            this.showSuccess('Pushed changes to remote');
            this.emit('git-branch-changed', { branch: this.branchData.currentBranch });
        } catch (error) {
            this.showError('Failed to push changes');
        }
    }

    handleSwitchBranch() {
        this.showBranchMenu();
    }

    handleNewBranch() {
        this.emit('git-new-branch-requested');
    }

    // Branch Menu Methods
    showBranchMenu() {
        this.loadBranches();
        this.branchMenu.style.display = 'block';
    }

    hideBranchMenu() {
        this.branchMenu.style.display = 'none';
    }

    async loadBranches() {
        try {
            await this.sendGitCommand('branch', { all: true });
        } catch (error) {
            console.error('Failed to load branches:', error);
        }
    }

    updateBranchList(branches) {
        if (!this.branchList || !branches) return;

        this.branchList.innerHTML = '';

        branches.forEach(branch => {
            const branchItem = this.createElement('div', {}, ['branch-item']);
            
            const isCurrent = branch.name === this.branchData.currentBranch;
            if (isCurrent) {
                branchItem.classList.add('current');
            }

            branchItem.innerHTML = `
                <div class="branch-item-content">
                    <div class="branch-item-icon">
                        ${isCurrent ? '🌿' : '🔀'}
                    </div>
                    <div class="branch-item-info">
                        <div class="branch-item-name">${branch.name}</div>
                        <div class="branch-item-details">
                            ${branch.remote ? `${branch.remote}/` : ''}${branch.lastCommit || ''}
                        </div>
                    </div>
                    <div class="branch-item-actions">
                        ${!isCurrent ? `<button class="btn btn-sm" data-branch="${branch.name}">Switch</button>` : ''}
                    </div>
                </div>
            `;

            // Add click handler for switching branches
            if (!isCurrent) {
                const switchButton = branchItem.querySelector('button');
                this.addEventListener(switchButton, 'click', () => {
                    this.switchToBranch(branch.name);
                });
            }

            this.branchList.appendChild(branchItem);
        });
    }

    async switchToBranch(branchName) {
        try {
            await this.sendGitCommand('checkout', { branch: branchName });
            this.showSuccess(`Switched to branch: ${branchName}`);
            this.hideBranchMenu();
            this.emit('git-branch-changed', { branch: branchName });
        } catch (error) {
            this.showError(`Failed to switch to branch: ${branchName}`);
        }
    }

    // Utility Methods
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

    setFetchButtonLoading(loading) {
        if (this.fetchButton) {
            const icon = this.fetchButton.querySelector('.icon');
            if (loading) {
                icon.textContent = '⏳';
                this.fetchButton.disabled = true;
            } else {
                icon.textContent = '⬇️';
                this.fetchButton.disabled = false;
            }
        }
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
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
        return `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}