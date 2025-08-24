/**
 * MainContent Component - Main content area that displays different sections
 */

import { Component } from './base/Component.js';

export class MainContent extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        this.currentSection = 'prompt';
        this.sections = new Map();
        this.chatInterface = null;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.initializeSections();
    }

    render() {
        this.element = this.createElement('div', {}, ['main-content']);

        this.element.innerHTML = `
            <div class="content-header">
                <button class="mobile-menu-button" id="mobileMenuButton" title="Toggle Menu">
                    <span class="icon">☰</span>
                </button>
                <div class="content-title" id="contentTitle">Prompt</div>
                <div class="content-actions" id="contentActions">
                    <!-- Section-specific actions will be added here -->
                </div>
            </div>
            <div class="content-body" id="contentBody">
                <!-- Section content will be rendered here -->
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references
        this.mobileMenuButton = this.querySelector('#mobileMenuButton');
        this.titleElement = this.querySelector('#contentTitle');
        this.actionsElement = this.querySelector('#contentActions');
        this.bodyElement = this.querySelector('#contentBody');

        // Set up mobile menu button
        this.setupMobileMenuButton();
    }

    async initializeSections() {
        // For now, create placeholder sections
        // These will be replaced with actual components in later tasks

        this.sections.set('prompt', {
            title: 'Prompt',
            render: () => this.renderPromptSection()
        });

        this.sections.set('git', {
            title: 'Git',
            render: () => this.renderGitSection()
        });

        this.sections.set('files', {
            title: 'Files',
            render: () => this.renderFilesSection()
        });

        this.sections.set('info', {
            title: 'Info',
            render: () => this.renderInfoSection()
        });

        // Show initial section
        await this.showSection(this.currentSection);
    }

    setupMobileMenuButton() {
        if (this.mobileMenuButton) {
            this.addEventListener(this.mobileMenuButton, 'click', this.handleMobileMenuClick);
        }
    }

    handleMobileMenuClick() {
        // Emit event to parent AppShell to toggle sidebar
        this.emit('mobile-menu-toggle');
    }

    async showSection(sectionId) {
        const section = this.sections.get(sectionId);
        if (!section) {
            console.warn(`Unknown section: ${sectionId}`);
            return;
        }

        this.currentSection = sectionId;

        // Update title
        this.titleElement.textContent = section.title;

        // Clear existing child components
        if (this.chatInterface) {
            this.removeChildComponent(this.chatInterface);
            this.chatInterface.destroy();
            this.chatInterface = null;
        }

        if (this.gitDashboard) {
            this.removeChildComponent(this.gitDashboard);
            this.gitDashboard.destroy();
            this.gitDashboard = null;
        }

        // Clear and render content
        this.bodyElement.innerHTML = '';
        await section.render();
    }

    async renderPromptSection() {
        // Clear existing content
        this.bodyElement.innerHTML = '';

        // Import and initialize ChatInterface component
        const { ChatInterface } = await import('./ChatInterface.js');
        
        // Create chat interface container
        const chatContainer = this.createElement('div', {}, ['prompt-section']);
        this.bodyElement.appendChild(chatContainer);

        // Initialize ChatInterface component
        this.chatInterface = new ChatInterface({
            container: chatContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });

        await this.chatInterface.initialize();
        this.addChildComponent(this.chatInterface);

        // Listen for chat events
        this.addEventListener(chatContainer, 'message-added', (event) => {
            const { message } = event.detail;
            console.log('Message added:', message);
        });

        this.addEventListener(chatContainer, 'messages-cleared', () => {
            console.log('Chat messages cleared');
        });
    }

    async renderGitSection() {
        // Clear existing content
        this.bodyElement.innerHTML = '';

        // Import and initialize GitDashboard component
        const { GitDashboard } = await import('./GitDashboard.js');
        
        // Create git dashboard container
        const gitContainer = this.createElement('div', {}, ['git-section']);
        this.bodyElement.appendChild(gitContainer);

        // Initialize GitDashboard component
        this.gitDashboard = new GitDashboard({
            container: gitContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });

        await this.gitDashboard.initialize();
        this.addChildComponent(this.gitDashboard);

        // Listen for git events
        this.addEventListener(gitContainer, 'git-branch-changed', (event) => {
            const { branch } = event.detail;
            console.log('Branch changed:', branch);
        });

        this.addEventListener(gitContainer, 'git-commit-selected', (event) => {
            const { commit } = event.detail;
            console.log('Commit selected:', commit);
        });

        this.addEventListener(gitContainer, 'git-file-selected', (event) => {
            const { file } = event.detail;
            console.log('File selected:', file);
        });
    }

    renderFilesSection() {
        this.bodyElement.innerHTML = `
            <div class="files-section">
                <div class="files-placeholder">
                    <h3>File Manager</h3>
                    <p>Interactive file tree with VS Code integration will be implemented here.</p>
                    <div class="placeholder-tree">
                        <div class="tree-item">
                            <span class="tree-item-icon">📁</span>
                            <span class="tree-item-label">src/</span>
                        </div>
                        <div class="tree-item" style="margin-left: 20px;">
                            <span class="tree-item-icon">📄</span>
                            <span class="tree-item-label">main.js</span>
                        </div>
                        <div class="tree-item" style="margin-left: 20px;">
                            <span class="tree-item-icon">📄</span>
                            <span class="tree-item-label">styles.css</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderInfoSection() {
        this.bodyElement.innerHTML = `
            <div class="info-section">
                <div class="info-placeholder">
                    <h3>System Information</h3>
                    <p>Server status, connection info, and system metrics will be displayed here.</p>
                    <div class="info-cards">
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title">Connection Status</div>
                            </div>
                            <div class="card-body">
                                <div class="status-indicator">
                                    <span class="status-dot connected"></span>
                                    <span>Connected</span>
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <div class="card-title">Server Info</div>
                            </div>
                            <div class="card-body">
                                <p>Server information will be displayed here</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    focusCommandInput() {
        if (this.currentSection === 'prompt' && this.chatInterface) {
            this.chatInterface.focusInput();
        }
    }

    closeOverlays() {
        // Close any section-specific overlays
        // This will be implemented as sections are added
    }

    handleResize() {
        // Handle resize for current section
        // This will be implemented as sections are added
    }
}