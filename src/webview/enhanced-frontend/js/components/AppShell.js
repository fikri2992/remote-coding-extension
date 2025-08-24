/**
 * AppShell Component - Main application layout and navigation
 */

import { Component } from './base/Component.js';
import { Sidebar } from './Sidebar.js';
import { MainContent } from './MainContent.js';

export class AppShell extends Component {
    constructor(options) {
        super(options);
        
        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;
        this.animationService = options.animationService;
        this.keyboardShortcutService = options.keyboardShortcutService;
        this.contextMenuService = options.contextMenuService;
        this.dragDropService = options.dragDropService;
        
        // Child components
        this.sidebar = null;
        this.mainContent = null;
        
        // State
        this.sidebarCollapsed = false;
        this.isMobile = false;
        this.sidebarOpen = false; // For mobile
        
        // Bind methods
        this.handleSidebarToggle = this.handleSidebarToggle.bind(this);
        this.handleSectionChange = this.handleSectionChange.bind(this);
        this.handleMobileOverlayClick = this.handleMobileOverlayClick.bind(this);
    }

    async initialize() {
        await super.initialize();
        
        // Create app shell structure
        this.render();
        
        // Initialize child components
        await this.initializeComponents();
        
        // Set up responsive behavior
        this.setupResponsive();
        
        // Subscribe to state changes
        this.subscribeToStateChanges();
    }

    render() {
        this.container.innerHTML = `
            <div class="app-shell" id="appShell">
                <div class="sidebar-container" id="sidebarContainer">
                    <!-- Sidebar will be rendered here -->
                </div>
                <div class="main-content-container" id="mainContentContainer">
                    <!-- Main content will be rendered here -->
                </div>
                <div class="mobile-overlay" id="mobileOverlay"></div>
            </div>
        `;
        
        // Get references to containers
        this.appShellElement = this.container.querySelector('#appShell');
        this.sidebarContainer = this.container.querySelector('#sidebarContainer');
        this.mainContentContainer = this.container.querySelector('#mainContentContainer');
        this.mobileOverlay = this.container.querySelector('#mobileOverlay');
    }

    async initializeComponents() {
        // Initialize sidebar
        this.sidebar = new Sidebar({
            container: this.sidebarContainer,
            stateManager: this.stateManager,
            onToggle: this.handleSidebarToggle,
            onSectionChange: this.handleSectionChange
        });
        
        await this.sidebar.initialize();
        
        // Initialize main content
        this.mainContent = new MainContent({
            container: this.mainContentContainer,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService,
            animationService: this.animationService,
            keyboardShortcutService: this.keyboardShortcutService,
            contextMenuService: this.contextMenuService,
            dragDropService: this.dragDropService
        });
        
        await this.mainContent.initialize();
        
        // Listen for mobile menu toggle events
        this.mainContentContainer.addEventListener('mobile-menu-toggle', () => {
            this.handleSidebarToggle();
        });
    }

    setupResponsive() {
        // Check if mobile on initialization
        this.checkMobile();
        
        // Set up resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.checkMobile();
            });
            this.resizeObserver.observe(document.body);
        }
        
        // Set up mobile overlay click handler
        this.mobileOverlay.addEventListener('click', this.handleMobileOverlayClick);
    }

    checkMobile() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;
        
        if (wasMobile !== this.isMobile) {
            this.updateResponsiveState();
        }
    }

    updateResponsiveState() {
        if (this.isMobile) {
            this.appShellElement.classList.add('mobile');
            // On mobile, sidebar is hidden by default
            if (this.sidebarOpen) {
                this.showMobileSidebar();
            } else {
                this.hideMobileSidebar();
            }
        } else {
            this.appShellElement.classList.remove('mobile');
            this.hideMobileSidebar();
            
            // Restore desktop sidebar state
            if (this.sidebarCollapsed) {
                this.sidebar.collapse();
            } else {
                this.sidebar.expand();
            }
        }
        
        // Update state manager with responsive state
        this.stateManager.updateNavigation({
            isMobile: this.isMobile,
            sidebarOpen: this.sidebarOpen
        });
    }

    subscribeToStateChanges() {
        // Subscribe to navigation state changes
        this.stateManager.subscribe('navigation', (state) => {
            this.handleNavigationStateChange(state);
        });
        
        // Subscribe to UI preferences
        this.stateManager.subscribe('preferences', (preferences) => {
            this.handlePreferencesChange(preferences);
        });
    }

    handleNavigationStateChange(navigationState) {
        // Update sidebar active section
        if (this.sidebar) {
            this.sidebar.setActiveSection(navigationState.activeSection);
        }
        
        // Update main content with animation
        if (this.mainContent) {
            const direction = navigationState.previousSection ? 'forward' : 'none';
            this.mainContent.showSection(navigationState.activeSection, direction);
        }
        
        // Update keyboard shortcut context
        if (this.keyboardShortcutService) {
            this.keyboardShortcutService.setContext(navigationState.activeSection);
        }
        
        // On mobile, hide sidebar after navigation
        if (this.isMobile && this.sidebarOpen) {
            this.hideMobileSidebar();
        }
    }

    handlePreferencesChange(preferences) {
        // Update sidebar collapsed state
        if (preferences.sidebarCollapsed !== undefined) {
            this.sidebarCollapsed = preferences.sidebarCollapsed;
            
            if (!this.isMobile) {
                if (this.sidebarCollapsed) {
                    this.sidebar.collapse();
                } else {
                    this.sidebar.expand();
                }
            }
        }
    }

    handleSidebarToggle() {
        if (this.isMobile) {
            // On mobile, toggle sidebar visibility
            this.sidebarOpen = !this.sidebarOpen;
            
            if (this.sidebarOpen) {
                this.showMobileSidebar();
            } else {
                this.hideMobileSidebar();
            }
        } else {
            // On desktop, toggle sidebar collapsed state
            this.sidebarCollapsed = !this.sidebarCollapsed;
            
            // Update state manager
            this.stateManager.updatePreferences({
                sidebarCollapsed: this.sidebarCollapsed
            });
            
            // Update sidebar with animation
            if (this.sidebarCollapsed) {
                this.sidebar.collapse();
                if (this.animationService) {
                    this.animationService.animateSidebarToggle(this.sidebar.element, true);
                }
            } else {
                this.sidebar.expand();
                if (this.animationService) {
                    this.animationService.animateSidebarToggle(this.sidebar.element, false);
                }
            }
        }
    }

    handleSectionChange(section) {
        // Update navigation state
        this.stateManager.updateNavigation({
            activeSection: section,
            previousSection: this.stateManager.getState().navigation?.activeSection
        });
    }

    handleMobileOverlayClick() {
        if (this.isMobile && this.sidebarOpen) {
            this.hideMobileSidebar();
        }
    }

    showMobileSidebar() {
        this.sidebar.element.classList.add('open');
        this.mobileOverlay.classList.add('visible');
        this.sidebarOpen = true;
    }

    hideMobileSidebar() {
        this.sidebar.element.classList.remove('open');
        this.mobileOverlay.classList.remove('visible');
        this.sidebarOpen = false;
    }

    // Public API methods

    toggleSidebar() {
        this.handleSidebarToggle();
    }

    focusCommandInput() {
        // Delegate to main content
        if (this.mainContent) {
            this.mainContent.focusCommandInput();
        }
    }

    showCommandPalette() {
        // Show command palette (future implementation)
        console.log('Command palette not yet implemented');
    }

    closeOverlays() {
        // Close any open overlays
        if (this.isMobile && this.sidebarOpen) {
            this.hideMobileSidebar();
        }
        
        // Delegate to child components
        if (this.mainContent) {
            this.mainContent.closeOverlays();
        }
    }

    handleResize() {
        this.checkMobile();
        
        // Delegate to child components
        if (this.sidebar) {
            this.sidebar.handleResize();
        }
        
        if (this.mainContent) {
            this.mainContent.handleResize();
        }
    }

    destroy() {
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Clean up event listeners
        if (this.mobileOverlay) {
            this.mobileOverlay.removeEventListener('click', this.handleMobileOverlayClick);
        }
        
        // Destroy child components
        if (this.sidebar) {
            this.sidebar.destroy();
            this.sidebar = null;
        }
        
        if (this.mainContent) {
            this.mainContent.destroy();
            this.mainContent = null;
        }
        
        super.destroy();
    }
}