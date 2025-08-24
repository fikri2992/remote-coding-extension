/**
 * ServerStatus Component - Real-time server status and metrics display
 */

import { Component } from '../base/Component.js';

export class ServerStatus extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Server status data
        this.serverInfo = {};
        this.serverMetrics = {};
        this.lastUpdate = null;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.requestServerStatus();
    }

    render() {
        this.element = this.createElement('div', {}, ['server-status']);

        this.element.innerHTML = `
            <div class="status-cards">
                <div class="status-card server-info-card">
                    <div class="card-header">
                        <div class="card-icon">🖥️</div>
                        <div class="card-title">Server</div>
                    </div>
                    <div class="card-content" id="serverInfoContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading server info...</div>
                        </div>
                    </div>
                </div>

                <div class="status-card extension-info-card">
                    <div class="card-header">
                        <div class="card-icon">🔌</div>
                        <div class="card-title">Extension</div>
                    </div>
                    <div class="card-content" id="extensionInfoContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading extension info...</div>
                        </div>
                    </div>
                </div>

                <div class="status-card uptime-card">
                    <div class="card-header">
                        <div class="card-icon">⏱️</div>
                        <div class="card-title">Uptime</div>
                    </div>
                    <div class="card-content" id="uptimeContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading uptime...</div>
                        </div>
                    </div>
                </div>

                <div class="status-card health-card">
                    <div class="card-header">
                        <div class="card-icon">💚</div>
                        <div class="card-title">Health</div>
                    </div>
                    <div class="card-content" id="healthContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Checking health...</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="server-details" id="serverDetails">
                <!-- Detailed server information will be rendered here -->
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references to content areas
        this.serverInfoContent = this.querySelector('#serverInfoContent');
        this.extensionInfoContent = this.querySelector('#extensionInfoContent');
        this.uptimeContent = this.querySelector('#uptimeContent');
        this.healthContent = this.querySelector('#healthContent');
        this.serverDetails = this.querySelector('#serverDetails');
    }

    setupEventListeners() {
        // Listen for connection state changes
        this.stateManager.subscribe('connection', this.handleConnectionStateChange.bind(this));
        
        // Listen for server status updates
        if (this.webSocketClient) {
            this.webSocketClient.on('serverStatus', this.handleServerStatusUpdate.bind(this));
        }
    }

    handleConnectionStateChange(connectionState) {
        if (connectionState.serverInfo) {
            this.serverInfo = connectionState.serverInfo;
            this.updateServerInfo();
        }

        // Update health based on connection status
        this.updateHealthStatus(connectionState);
    }

    handleServerStatusUpdate(data) {
        if (data.serverInfo) {
            this.serverInfo = { ...this.serverInfo, ...data.serverInfo };
        }
        if (data.metrics) {
            this.serverMetrics = { ...this.serverMetrics, ...data.metrics };
        }
        
        this.lastUpdate = new Date();
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateServerInfo();
        this.updateExtensionInfo();
        this.updateUptime();
        this.updateHealthStatus();
        this.updateServerDetails();
    }

    updateServerInfo() {
        const content = this.serverInfo.version ? `
            <div class="info-item">
                <div class="info-label">Version</div>
                <div class="info-value">${this.escapeHtml(this.serverInfo.version)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Node.js</div>
                <div class="info-value">${this.escapeHtml(this.serverInfo.nodeVersion || 'Unknown')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Platform</div>
                <div class="info-value">${this.escapeHtml(this.serverInfo.platform || 'Unknown')}</div>
            </div>
        ` : `
            <div class="empty-state">
                <div class="empty-message">Server info unavailable</div>
            </div>
        `;

        this.serverInfoContent.innerHTML = content;
    }

    updateExtensionInfo() {
        const extensionInfo = this.serverInfo.extension || {};
        
        const content = extensionInfo.name ? `
            <div class="info-item">
                <div class="info-label">Name</div>
                <div class="info-value">${this.escapeHtml(extensionInfo.name)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Version</div>
                <div class="info-value">${this.escapeHtml(extensionInfo.version || 'Unknown')}</div>
            </div>
            <div class="info-item">
                <div class="info-label">VS Code</div>
                <div class="info-value">${this.escapeHtml(extensionInfo.vscodeVersion || 'Unknown')}</div>
            </div>
        ` : `
            <div class="empty-state">
                <div class="empty-message">Extension info unavailable</div>
            </div>
        `;

        this.extensionInfoContent.innerHTML = content;
    }

    updateUptime() {
        const uptime = this.serverMetrics.uptime || this.serverInfo.uptime;
        
        if (uptime) {
            const uptimeMs = typeof uptime === 'number' ? uptime * 1000 : uptime;
            const uptimeFormatted = this.formatUptime(uptimeMs);
            
            this.uptimeContent.innerHTML = `
                <div class="uptime-display">
                    <div class="uptime-value">${uptimeFormatted}</div>
                    <div class="uptime-label">Server uptime</div>
                </div>
            `;
        } else {
            this.uptimeContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-message">Uptime unavailable</div>
                </div>
            `;
        }
    }

    updateHealthStatus(connectionState = null) {
        const connection = connectionState || this.stateManager.getState().connection;
        const isConnected = connection.status === 'connected';
        const latency = connection.latency;
        const connectionHealth = connection.connectionHealth || 100;
        
        let healthMessage = 'Status unknown';
        let healthColor = 'gray';
        
        if (isConnected) {
            if (connectionHealth >= 90) {
                healthMessage = 'Excellent';
                healthColor = 'green';
            } else if (connectionHealth >= 70) {
                healthMessage = 'Good';
                healthColor = 'lightgreen';
            } else if (connectionHealth >= 50) {
                healthMessage = 'Fair';
                healthColor = 'yellow';
            } else {
                healthMessage = 'Poor';
                healthColor = 'orange';
            }
        } else {
            healthMessage = 'Disconnected';
            healthColor = 'red';
        }

        this.healthContent.innerHTML = `
            <div class="health-display">
                <div class="health-indicator">
                    <div class="health-circle" style="background-color: ${healthColor}"></div>
                    <div class="health-status">${healthMessage}</div>
                </div>
                ${latency ? `
                    <div class="health-metric">
                        <div class="metric-label">Latency</div>
                        <div class="metric-value">${latency}ms</div>
                    </div>
                ` : ''}
                <div class="health-score">
                    <div class="score-label">Score</div>
                    <div class="score-value">${connectionHealth}/100</div>
                </div>
            </div>
        `;
    }

    updateServerDetails() {
        if (!this.serverInfo || Object.keys(this.serverInfo).length === 0) {
            this.serverDetails.innerHTML = '';
            return;
        }

        const details = [];
        
        // Environment details
        if (this.serverInfo.environment) {
            details.push({
                title: 'Environment',
                items: Object.entries(this.serverInfo.environment).map(([key, value]) => ({
                    label: key,
                    value: String(value)
                }))
            });
        }

        // Configuration details
        if (this.serverInfo.config) {
            details.push({
                title: 'Configuration',
                items: Object.entries(this.serverInfo.config).map(([key, value]) => ({
                    label: key,
                    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
                }))
            });
        }

        // Capabilities
        if (this.serverInfo.capabilities) {
            details.push({
                title: 'Capabilities',
                items: this.serverInfo.capabilities.map(capability => ({
                    label: capability,
                    value: '✓ Enabled'
                }))
            });
        }

        if (details.length === 0) {
            this.serverDetails.innerHTML = '';
            return;
        }

        const detailsHtml = details.map(section => `
            <div class="detail-section">
                <div class="detail-section-title">${this.escapeHtml(section.title)}</div>
                <div class="detail-items">
                    ${section.items.map(item => `
                        <div class="detail-item">
                            <div class="detail-label">${this.escapeHtml(item.label)}</div>
                            <div class="detail-value">${this.escapeHtml(item.value)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        this.serverDetails.innerHTML = `
            <div class="details-header">
                <h4>Server Details</h4>
                ${this.lastUpdate ? `
                    <div class="last-update">
                        Last updated: ${this.formatTime(this.lastUpdate)}
                    </div>
                ` : ''}
            </div>
            <div class="details-content">
                ${detailsHtml}
            </div>
        `;
    }

    requestServerStatus() {
        if (this.webSocketClient && this.webSocketClient.isConnected) {
            this.webSocketClient.sendMessage({
                type: 'status',
                id: this.webSocketClient.generateMessageId(),
                data: {
                    requestType: 'server-info'
                }
            });
        }
    }

    refresh() {
        this.requestServerStatus();
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

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}