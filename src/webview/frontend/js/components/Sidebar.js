/**
 * Sidebar Component - Navigation sidebar with menu items
 */

import { Component } from './base/Component.js';

export class Sidebar extends Component {
    constructor(options) {
        super(options);
        
        this.onToggle = options.onToggle;
        this.onSectionChange = options.onSectionChange;
        this.stateManager = options.stateManager;
        
        this.collapsed = false;
        this.activeSection = 'prompt';
        
        // Navigation items
        this.navItems = [
            { 
                id: 'prompt', 
                label: 'Prompt', 
                icon: '💬', 
                description: 'Chat interface for sending prompts to VS Code',
                shortcut: 'Ctrl+K'
            },
            { 
                id: 'git', 
                label: 'Git', 
                icon: '🔀', 
                description: 'Git integration with branch info and commit history',
                shortcut: 'Ctrl+G'
            },
            { 
                id: 'files', 
                label: 'Files', 
                icon: '📁', 
                description: 'File manager with workspace navigation',
                shortcut: 'Ctrl+E'
            },
            { 
                id: 'terminal', 
                label: 'Terminal', 
                icon: '⚡', 
                description: 'Terminal interface for command execution',
                shortcut: 'Ctrl+T'
            },
            { 
                id: 'info', 
                label: 'Info', 
                icon: 'ℹ️', 
                description: 'System information and connection status',
                shortcut: 'Ctrl+I'
            }
        ];
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.subscribeToStateChanges();
    }

    subscribeToStateChanges() {
        if (this.stateManager) {
            // Subscribe to connection state changes
            this.stateManager.subscribe('connection', (connectionState) => {
                this.updateConnectionStatus(connectionState);
            });
        }
    }

    updateConnectionStatus(connectionState) {
        const statusDot = this.querySelector('#statusDot');
        const statusText = this.querySelector('#statusText');
        
        if (statusDot && statusText) {
            // Remove all status classes
            statusDot.classList.remove('connected', 'connecting', 'disconnected');
            
            // Add current status class
            statusDot.classList.add(connectionState.status);
            
            // Update status text
            switch (connectionState.status) {
                case 'connected':
                    statusText.textContent = 'Connected';
                    break;
                case 'connecting':
                    statusText.textContent = 'Connecting...';
                    break;
                case 'disconnected':
                default:
                    statusText.textContent = 'Disconnected';
                    break;
            }
        }
    }

    render() {
        this.element = this.createElement('div', {}, ['sidebar']);
        
        this.element.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-title">Enhanced UI</div>
                <button class="sidebar-toggle" title="Toggle Sidebar (Ctrl+B)">
                    <span class="icon">☰</span>
                </button>
            </div>
            <nav class="sidebar-nav">
                ${this.navItems.map(item => `
                    <button class="nav-item ${item.id === this.activeSection ? 'active' : ''}" 
                            data-section="${item.id}" 
                            title="${item.description}${item.shortcut ? ' (' + item.shortcut + ')' : ''}">
                        <span class="nav-item-icon">${item.icon}</span>
                        <span class="nav-item-text">${item.label}</span>
                        ${item.shortcut ? `<span class="nav-item-shortcut">${item.shortcut}</span>` : ''}
                    </button>
                `).join('')}
            </nav>
            <div class="sidebar-footer">
                <div class="connection-status" id="connectionStatus">
                    <span class="status-dot disconnected" id="statusDot"></span>
                    <span class="status-text" id="statusText">Disconnected</span>
                </div>
            </div>
        `;
        
        this.container.appendChild(this.element);
    }

    setupEventListeners() {
        // Toggle button
        const toggleButton = this.querySelector('.sidebar-toggle');
        if (toggleButton) {
            this.addEventListener(toggleButton, 'click', this.handleToggle);
        }
        
        // Navigation items
        const navItems = this.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            this.addEventListener(item, 'click', this.handleNavItemClick);
        });
    }

    handleToggle() {
        if (this.onToggle) {
            this.onToggle();
        }
    }

    handleNavItemClick(event) {
        const section = event.currentTarget.dataset.section;
        if (section && this.onSectionChange) {
            this.onSectionChange(section);
        }
    }

    setActiveSection(section) {
        this.activeSection = section;
        
        // Update active state
        const navItems = this.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.dataset.section === section) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    collapse() {
        this.collapsed = true;
        this.element.classList.add('collapsed');
    }

    expand() {
        this.collapsed = false;
        this.element.classList.remove('collapsed');
    }
}