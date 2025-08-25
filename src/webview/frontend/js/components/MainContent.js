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
        this.animationService = options.animationService;
        this.keyboardShortcutService = options.keyboardShortcutService;
        this.contextMenuService = options.contextMenuService;
        this.dragDropService = options.dragDropService;

        this.currentSection = 'prompt';
        this.sections = new Map();
        this.chatInterface = null;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.initializeSections();
        this.setupResponsiveHandlers();
    }

    setupResponsiveHandlers() {
        // Listen for layout changes
        document.addEventListener('layout-change', this.handleLayoutChange.bind(this));

        // Listen for window resize as fallback
        window.addEventListener('resize', this.handleResize.bind(this));

        // Initial update
        this.updateMobileMenuVisibility();
    }

    handleLayoutChange(event) {
        const { type, breakpoint } = event.detail;

        if (type === 'breakpoint') {
            this.updateMobileMenuVisibility();
            this.updateContentLayout(breakpoint);
        }
    }

    handleResize() {
        this.updateMobileMenuVisibility();
    }

    updateContentLayout(breakpoint) {
        // Update content layout based on breakpoint
        if (breakpoint === 'mobile') {
            this.element.classList.add('mobile-layout');
            this.element.classList.remove('tablet-layout', 'desktop-layout');
        } else if (breakpoint === 'tablet') {
            this.element.classList.add('tablet-layout');
            this.element.classList.remove('mobile-layout', 'desktop-layout');
        } else {
            this.element.classList.add('desktop-layout');
            this.element.classList.remove('mobile-layout', 'tablet-layout');
        }
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

        this.sections.set('automation', {
            title: 'Web Automation',
            render: () => this.renderAutomationSection()
        });

        // Show initial section
        await this.showSection(this.currentSection);
    }

    setupMobileMenuButton() {
        if (this.mobileMenuButton) {
            // Add touch-friendly classes
            this.mobileMenuButton.classList.add('touch-feedback', 'touch-target');

            // Click handler
            this.addEventListener(this.mobileMenuButton, 'click', this.handleMobileMenuClick);

            // Touch handlers for better feedback
            this.addEventListener(this.mobileMenuButton, 'touchstart', this.handleMobileMenuTouchStart);
            this.addEventListener(this.mobileMenuButton, 'touchend', this.handleMobileMenuTouchEnd);

            // Update visibility based on screen size
            this.updateMobileMenuVisibility();
        }
    }

    handleMobileMenuClick(e) {
        e.preventDefault();
        e.stopPropagation();

        // Add haptic feedback simulation
        this.mobileMenuButton.classList.add('haptic-light');
        setTimeout(() => {
            this.mobileMenuButton.classList.remove('haptic-light');
        }, 100);

        // Emit event to parent AppShell to toggle sidebar
        this.emit('mobile-menu-toggle');
    }

    handleMobileMenuTouchStart(e) {
        this.mobileMenuButton.classList.add('touching');
    }

    handleMobileMenuTouchEnd(e) {
        this.mobileMenuButton.classList.remove('touching');
    }

    updateMobileMenuVisibility() {
        if (this.mobileMenuButton) {
            const isMobile = window.innerWidth <= 768;
            this.mobileMenuButton.style.display = isMobile ? 'flex' : 'none';
        }
    }

    async showSection(sectionId, direction = 'forward') {
        const section = this.sections.get(sectionId);
        if (!section) {
            console.warn(`Unknown section: ${sectionId}`);
            return;
        }

        const previousSection = this.currentSection;
        this.currentSection = sectionId;

        // Update title with animation
        if (this.animationService && previousSection !== sectionId) {
            await this.animationService.animate(this.titleElement, 'fadeOut', { duration: 150 });
            this.titleElement.textContent = section.title;
            await this.animationService.animate(this.titleElement, 'fadeIn', { duration: 150 });
        } else {
            this.titleElement.textContent = section.title;
        }

        // Store current content for animation
        const currentContent = this.bodyElement.firstElementChild;

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

        if (this.fileManager) {
            this.removeChildComponent(this.fileManager);
            this.fileManager.destroy();
            this.fileManager = null;
        }

        if (this.infoPanel) {
            this.removeChildComponent(this.infoPanel);
            this.infoPanel.destroy();
            this.infoPanel = null;
        }

        // Create new content container
        const newContent = this.createElement('div', {}, ['section-content']);

        // Render new section content
        const oldBodyContent = this.bodyElement.innerHTML;
        this.bodyElement.innerHTML = '';
        this.bodyElement.appendChild(newContent);

        // Set up the section render context
        const originalBodyElement = this.bodyElement;
        this.bodyElement = newContent;

        try {
            await section.render();
        } finally {
            this.bodyElement = originalBodyElement;
        }

        // Animate section transition if animation service is available
        if (this.animationService && previousSection !== sectionId && currentContent) {
            await this.animationService.animateSectionTransition(
                currentContent,
                newContent,
                direction
            );
        }

        // Add hover animations to new content
        if (this.animationService) {
            this.animationService.addHoverAnimations(newContent);
        }
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
            notificationService: this.notificationService,
            animationService: this.animationService,
            keyboardShortcutService: this.keyboardShortcutService,
            contextMenuService: this.contextMenuService,
            dragDropService: this.dragDropService
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
            notificationService: this.notificationService,
            animationService: this.animationService,
            keyboardShortcutService: this.keyboardShortcutService,
            contextMenuService: this.contextMenuService,
            dragDropService: this.dragDropService
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

    async renderFilesSection() {
        // Clear existing content
        this.bodyElement.innerHTML = '';

        // Import and initialize FileManager component
        const { FileManager } = await import('./FileManager.js');

        // Create file manager container
        const fileManagerContainer = this.createElement('div', {}, ['files-section']);
        this.bodyElement.appendChild(fileManagerContainer);

        // Initialize FileManager component
        this.fileManager = new FileManager({
            container: fileManagerContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService,
            animationService: this.animationService,
            keyboardShortcutService: this.keyboardShortcutService,
            contextMenuService: this.contextMenuService,
            dragDropService: this.dragDropService
        });

        await this.fileManager.initialize();
        this.addChildComponent(this.fileManager);

        // Listen for file manager events
        this.addEventListener(fileManagerContainer, 'file-selected', (event) => {
            const { file } = event.detail;
            console.log('File selected:', file);
        });

        this.addEventListener(fileManagerContainer, 'file-opened', (event) => {
            const { file } = event.detail;
            console.log('File opened:', file);
        });
    }

    async renderInfoSection() {
        // Clear existing content
        this.bodyElement.innerHTML = '';

        // Import and initialize InfoPanel component
        const { InfoPanel } = await import('./InfoPanel.js');

        // Create info panel container
        const infoPanelContainer = this.createElement('div', {}, ['info-section']);
        this.bodyElement.appendChild(infoPanelContainer);

        // Initialize InfoPanel component
        this.infoPanel = new InfoPanel({
            container: infoPanelContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService,
            animationService: this.animationService,
            keyboardShortcutService: this.keyboardShortcutService,
            contextMenuService: this.contextMenuService,
            dragDropService: this.dragDropService
        });

        await this.infoPanel.initialize();
        this.addChildComponent(this.infoPanel);

        // Listen for info panel events
        this.addEventListener(infoPanelContainer, 'error-logged', (event) => {
            const { error } = event.detail;
            console.log('Error logged:', error);
        });

        this.addEventListener(infoPanelContainer, 'metrics-updated', (event) => {
            const { metrics } = event.detail;
            console.log('Metrics updated:', metrics);
        });
    }

    async renderAutomationSection() {
        // Clear existing content
        this.bodyElement.innerHTML = '';

        // Create automation container
        const automationContainer = this.createElement('div', {}, ['automation-section']);
        this.bodyElement.appendChild(automationContainer);

        // Initialize WebAutomation component
        this.webAutomation = new WebAutomation({
            container: automationContainer,
            stateManager: this.stateManager,
            webAutomationService: this.webAutomationService,
            notificationService: this.notificationService
        });

        await this.webAutomation.initialize();
        this.addChildComponent(this.webAutomation);
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