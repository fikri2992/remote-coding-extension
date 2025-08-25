/**
 * WebAutomation Component - VS Code integration and command execution
 */

import { Component } from './base/Component.js';

export class WebAutomation extends Component {
    constructor(options) {
        super(options);
        
        this.stateManager = options.stateManager;
        this.webAutomationService = options.webAutomationService;
        this.notificationService = options.notificationService;
        
        // State
        this.serverStatus = null;
        this.connectedClients = [];
        this.configuration = null;
        this.isExecutingCommand = false;
        
        // Bind methods
        this.handleStartServer = this.handleStartServer.bind(this);
        this.handleStopServer = this.handleStopServer.bind(this);
        this.handleExecuteCommand = this.handleExecuteCommand.bind(this);
        this.handleQuickCommand = this.handleQuickCommand.bind(this);
        this.handleRefresh = this.handleRefresh.bind(this);
    }

    async initialize() {
        await super.initialize();
        
        // Subscribe to state changes
        this.stateManager.subscribe('webAutomation', this.handleWebAutomationStateChange.bind(this));
        this.stateManager.subscribe('connection', this.handleConnectionStateChange.bind(this));
        
        this.render();
        this.setupEventListeners();
        
        // Request initial status
        if (this.webAutomationService) {
            this.webAutomationService.getServerStatus();
        }
    }

    render() {
        this.element = this.createElement('div', {}, ['web-automation']);
        
        this.element.innerHTML = `
            <div class="automation-header">
                <h2>VS Code Web Automation</h2>
                <div class="automation-actions">
                    <button id="refreshButton" class="action-button" title="Refresh Status">
                        <span class="icon">🔄</span>
                        Refresh
                    </button>
                </div>
            </div>
            
            <div class="automation-content">
                <!-- Server Status Section -->
                <section class="server-status-section">
                    <h3>Server Status</h3>
                    <div class="status-grid">
                        <div class="status-item">
                            <label>Status:</label>
                            <span id="serverStatusText" class="status-value">Unknown</span>
                        </div>
                        <div class="status-item">
                            <label>Server URL:</label>
                            <span id="serverUrl" class="status-value">-</span>
                        </div>
                        <div class="status-item">
                            <label>WebSocket Port:</label>
                            <span id="websocketPort" class="status-value">-</span>
                        </div>
                        <div class="status-item">
                            <label>HTTP Port:</label>
                            <span id="httpPort" class="status-value">-</span>
                        </div>
                        <div class="status-item">
                            <label>Connected Clients:</label>
                            <span id="connectedClients" class="status-value">0</span>
                        </div>
                        <div class="status-item">
                            <label>Uptime:</label>
                            <span id="uptime" class="status-value">-</span>
                        </div>
                    </div>
                    
                    <div class="server-controls">
                        <button id="startServerButton" class="primary-button">Start Server</button>
                        <button id="stopServerButton" class="secondary-button">Stop Server</button>
                    </div>
                </section>

                <!-- Quick Commands Section -->
                <section class="quick-commands-section">
                    <h3>Quick Commands</h3>
                    <div class="command-grid">
                        <button class="quick-cmd-btn" data-command="workbench.action.files.newUntitledFile">
                            <span class="icon">📄</span>
                            New File
                        </button>
                        <button class="quick-cmd-btn" data-command="workbench.action.files.save">
                            <span class="icon">💾</span>
                            Save File
                        </button>
                        <button class="quick-cmd-btn" data-command="workbench.action.showCommands">
                            <span class="icon">⌘</span>
                            Command Palette
                        </button>
                        <button class="quick-cmd-btn" data-command="workbench.action.quickOpen">
                            <span class="icon">🔍</span>
                            Quick Open
                        </button>
                        <button class="quick-cmd-btn" data-command="workbench.action.toggleSidebarVisibility">
                            <span class="icon">📁</span>
                            Toggle Sidebar
                        </button>
                        <button class="quick-cmd-btn" data-command="workbench.action.terminal.toggleTerminal">
                            <span class="icon">💻</span>
                            Toggle Terminal
                        </button>
                        <button class="quick-cmd-btn" data-command="editor.action.formatDocument">
                            <span class="icon">✨</span>
                            Format Document
                        </button>
                        <button class="quick-cmd-btn" data-command="workbench.action.reloadWindow">
                            <span class="icon">🔄</span>
                            Reload Window
                        </button>
                    </div>
                </section>

                <!-- Custom Command Section -->
                <section class="custom-command-section">
                    <h3>Custom Command</h3>
                    <div class="command-form">
                        <div class="input-group">
                            <label for="commandInput">VS Code Command:</label>
                            <input type="text" id="commandInput" placeholder="e.g., workbench.action.files.newUntitledFile">
                        </div>
                        <div class="input-group">
                            <label for="argsInput">Arguments (JSON):</label>
                            <textarea id="argsInput" placeholder='["arg1", "arg2"] or leave empty'></textarea>
                        </div>
                        <button id="executeButton" class="primary-button" disabled>Execute Command</button>
                    </div>
                </section>

                <!-- VS Code State Section -->
                <section class="vscode-state-section">
                    <h3>VS Code State</h3>
                    <div class="state-display">
                        <div class="state-section">
                            <h4>Active Editor</h4>
                            <div id="activeEditor" class="state-content">No active editor</div>
                        </div>
                        <div class="state-section">
                            <h4>Workspace Folders</h4>
                            <div id="workspaceFolders" class="state-content">No workspace folders</div>
                        </div>
                        <div class="state-section">
                            <h4>Open Editors</h4>
                            <div id="openEditors" class="state-content">No open editors</div>
                        </div>
                    </div>
                </section>

                <!-- Connection Info Section -->
                <section class="connection-info-section">
                    <h3>Connection Info</h3>
                    <div class="connection-stats" id="connectionStats">
                        <div class="stat-item">
                            <label>VS Code API:</label>
                            <span id="vsCodeApiStatus">Unknown</span>
                        </div>
                        <div class="stat-item">
                            <label>Connection Health:</label>
                            <span id="connectionHealth">Unknown</span>
                        </div>
                        <div class="stat-item">
                            <label>Latency:</label>
                            <span id="latency">-</span>
                        </div>
                        <div class="stat-item">
                            <label>Pending Commands:</label>
                            <span id="pendingCommands">0</span>
                        </div>
                    </div>
                </section>
            </div>
        `;
        
        this.container.appendChild(this.element);
    }

    setupEventListeners() {
        // Server controls
        const startButton = this.querySelector('#startServerButton');
        const stopButton = this.querySelector('#stopServerButton');
        const refreshButton = this.querySelector('#refreshButton');
        
        if (startButton) startButton.addEventListener('click', this.handleStartServer);
        if (stopButton) stopButton.addEventListener('click', this.handleStopServer);
        if (refreshButton) refreshButton.addEventListener('click', this.handleRefresh);
        
        // Quick command buttons
        const quickCmdButtons = this.querySelectorAll('.quick-cmd-btn');
        quickCmdButtons.forEach(button => {
            button.addEventListener('click', this.handleQuickCommand);
        });
        
        // Custom command form
        const commandInput = this.querySelector('#commandInput');
        const argsInput = this.querySelector('#argsInput');
        const executeButton = this.querySelector('#executeButton');
        
        if (commandInput) {
            commandInput.addEventListener('input', this.updateExecuteButtonState.bind(this));
        }
        if (executeButton) {
            executeButton.addEventListener('click', this.handleExecuteCommand);
        }
    }

    handleWebAutomationStateChange(webAutomationState) {
        if (webAutomationState.serverStatus) {
            this.updateServerStatus(webAutomationState.serverStatus);
        }
        
        if (webAutomationState.connectedClients) {
            this.updateConnectedClients(webAutomationState.connectedClients);
        }
        
        if (webAutomationState.configuration) {
            this.updateConfiguration(webAutomationState.configuration);
        }
        
        // Update VS Code API status
        const vsCodeApiStatus = this.querySelector('#vsCodeApiStatus');
        if (vsCodeApiStatus) {
            vsCodeApiStatus.textContent = webAutomationState.vsCodeApiAvailable ? 'Available' : 'Not Available';
            vsCodeApiStatus.className = webAutomationState.vsCodeApiAvailable ? 'status-good' : 'status-error';
        }
    }

    handleConnectionStateChange(connectionState) {
        // Update connection health
        const healthElement = this.querySelector('#connectionHealth');
        if (healthElement && connectionState.connectionHealth) {
            healthElement.textContent = connectionState.connectionHealth;
            healthElement.className = `status-${connectionState.connectionHealth}`;
        }
        
        // Update latency
        const latencyElement = this.querySelector('#latency');
        if (latencyElement && connectionState.latency !== undefined) {
            latencyElement.textContent = `${connectionState.latency}ms`;
        }
        
        // Update server info from connection state
        if (connectionState.serverUrl) {
            const serverUrlElement = this.querySelector('#serverUrl');
            if (serverUrlElement) {
                serverUrlElement.textContent = connectionState.serverUrl;
            }
        }
        
        if (connectionState.websocketPort) {
            const wsPortElement = this.querySelector('#websocketPort');
            if (wsPortElement) {
                wsPortElement.textContent = connectionState.websocketPort;
            }
        }
        
        if (connectionState.httpPort) {
            const httpPortElement = this.querySelector('#httpPort');
            if (httpPortElement) {
                httpPortElement.textContent = connectionState.httpPort;
            }
        }
    }

    updateServerStatus(status) {
        const statusElement = this.querySelector('#serverStatusText');
        if (statusElement) {
            statusElement.textContent = status.running ? 'Running' : 'Stopped';
            statusElement.className = status.running ? 'status-good' : 'status-error';
        }
        
        // Update uptime
        const uptimeElement = this.querySelector('#uptime');
        if (uptimeElement && status.uptime) {
            uptimeElement.textContent = this.formatUptime(status.uptime);
        }
        
        // Update button states
        const startButton = this.querySelector('#startServerButton');
        const stopButton = this.querySelector('#stopServerButton');
        
        if (startButton) {
            startButton.disabled = status.running;
        }
        if (stopButton) {
            stopButton.disabled = !status.running;
        }
    }

    updateConnectedClients(clients) {
        const clientsElement = this.querySelector('#connectedClients');
        if (clientsElement) {
            clientsElement.textContent = clients.length || 0;
        }
    }

    updateConfiguration(config) {
        this.configuration = config;
        // Update UI based on configuration if needed
    }

    async handleStartServer() {
        if (!this.webAutomationService) {
            this.notificationService.error('Error', 'Web automation service not available');
            return;
        }
        
        try {
            await this.webAutomationService.startServer();
        } catch (error) {
            this.notificationService.error('Server Error', `Failed to start server: ${error.message}`);
        }
    }

    async handleStopServer() {
        if (!this.webAutomationService) {
            this.notificationService.error('Error', 'Web automation service not available');
            return;
        }
        
        try {
            await this.webAutomationService.stopServer();
        } catch (error) {
            this.notificationService.error('Server Error', `Failed to stop server: ${error.message}`);
        }
    }

    async handleQuickCommand(event) {
        const command = event.currentTarget.dataset.command;
        if (!command) return;
        
        if (!this.webAutomationService) {
            this.notificationService.error('Error', 'Web automation service not available');
            return;
        }
        
        try {
            await this.webAutomationService.executeQuickCommand(command);
        } catch (error) {
            console.error('Quick command error:', error);
        }
    }

    async handleExecuteCommand() {
        const commandInput = this.querySelector('#commandInput');
        const argsInput = this.querySelector('#argsInput');
        
        if (!commandInput || !this.webAutomationService) return;
        
        const command = commandInput.value.trim();
        if (!command) return;
        
        let args = [];
        if (argsInput && argsInput.value.trim()) {
            try {
                args = JSON.parse(argsInput.value.trim());
            } catch (error) {
                this.notificationService.error('Invalid Arguments', 'Arguments must be valid JSON');
                return;
            }
        }
        
        this.setExecutingState(true);
        
        try {
            await this.webAutomationService.executeCommand(command, args);
            this.notificationService.success('Command', `Executed: ${command}`);
            
            // Clear inputs
            commandInput.value = '';
            if (argsInput) argsInput.value = '';
            this.updateExecuteButtonState();
            
        } catch (error) {
            this.notificationService.error('Command Error', `Failed to execute ${command}: ${error.message}`);
        } finally {
            this.setExecutingState(false);
        }
    }

    handleRefresh() {
        if (this.webAutomationService) {
            this.webAutomationService.getServerStatus();
        }
        
        // Update connection stats
        this.updateConnectionStats();
    }

    updateConnectionStats() {
        if (!this.webAutomationService) return;
        
        const stats = this.webAutomationService.getConnectionStats();
        
        const pendingElement = this.querySelector('#pendingCommands');
        if (pendingElement) {
            pendingElement.textContent = stats.pendingCommands || 0;
        }
    }

    updateExecuteButtonState() {
        const commandInput = this.querySelector('#commandInput');
        const executeButton = this.querySelector('#executeButton');
        
        if (commandInput && executeButton) {
            executeButton.disabled = !commandInput.value.trim() || this.isExecutingCommand;
        }
    }

    setExecutingState(executing) {
        this.isExecutingCommand = executing;
        
        const executeButton = this.querySelector('#executeButton');
        if (executeButton) {
            executeButton.disabled = executing;
            executeButton.textContent = executing ? 'Executing...' : 'Execute Command';
        }
    }

    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    destroy() {
        // Unsubscribe from state changes
        this.stateManager.unsubscribe('webAutomation', this.handleWebAutomationStateChange);
        this.stateManager.unsubscribe('connection', this.handleConnectionStateChange);
        
        super.destroy();
    }
}