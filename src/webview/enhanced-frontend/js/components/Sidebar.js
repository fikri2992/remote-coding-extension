/**
 * Sidebar Component - Navigation sidebar with menu items
 */

import { Component } from './base/Component.js';

export class Sidebar extends Component {
    constructor(options) {
        super(options);
        
        this.onToggle = options.onToggle;
        this.onSectionChange = options.onSectionChange;
        
        this.collapsed = false;
        this.activeSection = 'prompt';
        
        // Navigation items
        this.navItems = [
            { id: 'prompt', label: 'Prompt', icon: '💬', description: 'Chat interface' },
            { id: 'git', label: 'Git', icon: '🔀', description: 'Git integration' },
            { id: 'files', label: 'Files', icon: '📁', description: 'File manager' },
            { id: 'info', label: 'Info', icon: 'ℹ️', description: 'System information' }
        ];
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.element = this.createElement('div', {}, ['sidebar']);
        
        this.element.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-title">Enhanced UI</div>
                <button class="sidebar-toggle" title="Toggle Sidebar">
                    <span class="icon">☰</span>
                </button>
            </div>
            <nav class="sidebar-nav">
                ${this.navItems.map(item => `
                    <button class="nav-item ${item.id === this.activeSection ? 'active' : ''}" 
                            data-section="${item.id}" 
                            title="${item.description}">
                        <span class="nav-item-icon">${item.icon}</span>
                        <span class="nav-item-text">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
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