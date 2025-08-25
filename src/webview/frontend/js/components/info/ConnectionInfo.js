/**
 * ConnectionInfo Component - Connection details and client information display
 */

import { Component } from '../base/Component.js';

export class ConnectionInfo extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Connection data
        this.connectionData = {};
        this.clientInfo = {};
        this.networkMetrics = {};
        
        // Update tracking
        this.lastUpdate = null;
        this.updateInterval = null;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.startPeriodicUpdates();
        this.gatherClientInfo();
    }

    render() {
        this.element = this.createElement('div', {}, ['connection-info']);

        this.element.innerHTML = `
            <div class="connection-cards">
                <div class="connection-card status-card">
                    <div class="card-header">
                        <div class="card-icon">🔗</div>
                        <div class="card-title">Status</div>
                    </div>
                    <div class="card-content" id="connectionStatusContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Checking connection...</div>
                        </div>
                    </div>
                </div>

                <div class="connection-card latency-card">
                    <div class="card-header">
                        <div class="card-icon">⚡</div>
                        <div class="card-title">Latency</div>
                    </div>
                    <div class="card-content" id="latencyContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Measuring...</div>
                        </div>
                    </div>
                </div>

                <div class="connection-card client-card">
                    <div class="card-header">
                        <div class="card-icon">💻</div>
                        <div class="card-title">Client</div>
                    </div>
                    <div class="card-content" id="clientInfoContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading client info...</div>
                        </div>
                    </div>
                </div>

                <div class="connection-card network-card">
                    <div class="card-header">
                        <div class="card-icon">📡</div>
                        <div class="card-title">Network</div>
                    </div>
                    <div class="card-content" id="networkContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Gathering network info...</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="connection-details" id="connectionDetails">
                <!-- Detailed connection information will be rendered here -->
            </div>

            <div class="connection-history" id="connectionHistory">
                <!-- Connection history and events will be rendered here -->
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references to content areas
        this.connectionStatusContent = this.querySelector('#connectionStatusContent');
        this.latencyContent = this.querySelector('#latencyContent');
        this.clientInfoContent = this.querySelector('#clientInfoContent');
        this.networkContent = this.querySelector('#networkContent');
        this.connectionDetails = this.querySelector('#connectionDetails');
        this.connectionHistory = this.querySelector('#connectionHistory');
    }

    setupEventListeners() {
        // Listen for connection state changes
        this.stateManager.subscribe('connection', this.handleConnectionStateChange.bind(this));
        
        // Listen for WebSocket events
        if (this.webSocketClient) {
            this.webSocketClient.on('connectionMetrics', this.handleConnectionMetrics.bind(this));
            this.webSocketClient.on('clientInfo', this.handleClientInfo.bind(this));
        }
    }

    startPeriodicUpdates() {
        // Update connection info every 2 seconds
        this.updateInterval = setInterval(() => {
            this.updateConnectionInfo();
        }, 2000);

        // Initial update
        this.updateConnectionInfo();
    }

    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    gatherClientInfo() {
        // Gather browser and client information
        this.clientInfo = {
            userAgent: navigator.userAgent,
            browser: this.getBrowserInfo(),
            platform: navigator.userAgentData?.platform || navigator.platform || 'Unknown',
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date()
        };

        this.updateClientInfo();
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';

        if (ua.includes('Chrome')) {
            browser = 'Chrome';
            const match = ua.match(/Chrome\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
            const match = ua.match(/Firefox\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser = 'Safari';
            const match = ua.match(/Version\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        } else if (ua.includes('Edge')) {
            browser = 'Edge';
            const match = ua.match(/Edge\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        }

        return { name: browser, version };
    }

    handleConnectionStateChange(connectionState) {
        this.connectionData = connectionState;
        this.lastUpdate = new Date();
        this.updateDisplay();
    }

    handleConnectionMetrics(metrics) {
        this.networkMetrics = { ...this.networkMetrics, ...metrics };
        this.updateNetworkInfo();
    }

    handleClientInfo(clientInfo) {
        this.clientInfo = { ...this.clientInfo, ...clientInfo };
        this.updateClientInfo();
    }

    updateConnectionInfo() {
        const connectionState = this.stateManager.getState().connection;
        if (connectionState) {
            this.handleConnectionStateChange(connectionState);
        }
    }

    updateDisplay() {
        this.updateConnectionStatus();
        this.updateLatencyInfo();
        this.updateClientInfo();
        this.updateNetworkInfo();
        this.updateConnectionDetails();
        this.updateConnectionHistory();
    }

    updateConnectionStatus() {
        const { status, lastConnected, reconnectAttempts, isOfflineMode } = this.connectionData;
        
        let statusIcon = '🔴';
        let statusText = 'Disconnected';
        let statusClass = 'disconnected';
        
        switch (status) {
            case 'connected':
                statusIcon = '🟢';
                statusText = 'Connected';
                statusClass = 'connected';
                break;
            case 'connecting':
                statusIcon = '🟡';
                statusText = 'Connecting';
                statusClass = 'connecting';
                break;
            case 'disconnected':
                statusIcon = '🔴';
                statusText = isOfflineMode ? 'Offline Mode' : 'Disconnected';
                statusClass = 'disconnected';
                break;
        }

        this.connectionStatusContent.innerHTML = `
            <div class="status-display ${statusClass}">
                <div class="status-indicator">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
                ${lastConnected ? `
                    <div class="status-detail">
                        <div class="detail-label">Last connected</div>
                        <div class="detail-value">${this.formatRelativeTime(lastConnected)}</div>
                    </div>
                ` : ''}
                ${reconnectAttempts > 0 ? `
                    <div class="status-detail">
                        <div class="detail-label">Reconnect attempts</div>
                        <div class="detail-value">${reconnectAttempts}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    updateLatencyInfo() {
        const { latency, averageLatency, connectionHealth } = this.connectionData;
        
        if (latency !== null && latency !== undefined) {
            let latencyClass = 'good';
            if (latency > 500) latencyClass = 'poor';
            else if (latency > 200) latencyClass = 'fair';
            
            this.latencyContent.innerHTML = `
                <div class="latency-display ${latencyClass}">
                    <div class="latency-current">
                        <div class="latency-value">${latency}ms</div>
                        <div class="latency-label">Current</div>
                    </div>
                    ${averageLatency ? `
                        <div class="latency-average">
                            <div class="latency-value">${averageLatency}ms</div>
                            <div class="latency-label">Average</div>
                        </div>
                    ` : ''}
                    ${connectionHealth ? `
                        <div class="connection-health">
                            <div class="health-bar">
                                <div class="health-fill" style="width: ${connectionHealth}%"></div>
                            </div>
                            <div class="health-label">${connectionHealth}% Health</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            this.latencyContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-message">No latency data</div>
                </div>
            `;
        }
    }

    updateClientInfo() {
        const { browser, platform, language, onLine } = this.clientInfo;
        
        this.clientInfoContent.innerHTML = `
            <div class="client-display">
                <div class="client-item">
                    <div class="client-label">Browser</div>
                    <div class="client-value">${browser.name} ${browser.version}</div>
                </div>
                <div class="client-item">
                    <div class="client-label">Platform</div>
                    <div class="client-value">${this.escapeHtml(platform)}</div>
                </div>
                <div class="client-item">
                    <div class="client-label">Language</div>
                    <div class="client-value">${this.escapeHtml(language)}</div>
                </div>
                <div class="client-item">
                    <div class="client-label">Online</div>
                    <div class="client-value">${onLine ? '✅ Yes' : '❌ No'}</div>
                </div>
            </div>
        `;
    }

    updateNetworkInfo() {
        // Get connection info if available
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        let networkInfo = {};
        if (connection) {
            networkInfo = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }

        const hasNetworkInfo = Object.keys(networkInfo).length > 0;
        const hasMetrics = Object.keys(this.networkMetrics).length > 0;

        if (hasNetworkInfo || hasMetrics) {
            let content = '<div class="network-display">';
            
            if (hasNetworkInfo) {
                content += `
                    <div class="network-item">
                        <div class="network-label">Connection</div>
                        <div class="network-value">${networkInfo.effectiveType || 'Unknown'}</div>
                    </div>
                `;
                
                if (networkInfo.downlink) {
                    content += `
                        <div class="network-item">
                            <div class="network-label">Downlink</div>
                            <div class="network-value">${networkInfo.downlink} Mbps</div>
                        </div>
                    `;
                }
                
                if (networkInfo.rtt) {
                    content += `
                        <div class="network-item">
                            <div class="network-label">RTT</div>
                            <div class="network-value">${networkInfo.rtt}ms</div>
                        </div>
                    `;
                }
            }
            
            if (hasMetrics) {
                Object.entries(this.networkMetrics).forEach(([key, value]) => {
                    content += `
                        <div class="network-item">
                            <div class="network-label">${key}</div>
                            <div class="network-value">${value}</div>
                        </div>
                    `;
                });
            }
            
            content += '</div>';
            this.networkContent.innerHTML = content;
        } else {
            this.networkContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-message">Network info unavailable</div>
                </div>
            `;
        }
    }

    updateConnectionDetails() {
        const details = [];
        
        // WebSocket details
        if (this.webSocketClient) {
            const wsStatus = this.webSocketClient.getConnectionStatus();
            details.push({
                title: 'WebSocket',
                items: [
                    { label: 'Protocol Version', value: this.webSocketClient.protocolVersion || '1.0' },
                    { label: 'Queued Messages', value: wsStatus.queuedMessages.toString() },
                    { label: 'Pending Messages', value: wsStatus.pendingMessages.toString() },
                    { label: 'Max Reconnect Attempts', value: this.webSocketClient.maxReconnectAttempts.toString() }
                ]
            });
        }

        // Client details
        if (this.clientInfo.screen) {
            details.push({
                title: 'Display',
                items: [
                    { label: 'Screen Resolution', value: `${this.clientInfo.screen.width}×${this.clientInfo.screen.height}` },
                    { label: 'Viewport Size', value: `${this.clientInfo.viewport.width}×${this.clientInfo.viewport.height}` },
                    { label: 'Color Depth', value: `${this.clientInfo.screen.colorDepth} bits` },
                    { label: 'Timezone', value: this.clientInfo.timezone }
                ]
            });
        }

        if (details.length === 0) {
            this.connectionDetails.innerHTML = '';
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

        this.connectionDetails.innerHTML = `
            <div class="details-header">
                <h4>Connection Details</h4>
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

    updateConnectionHistory() {
        // This would show connection events, reconnections, etc.
        // For now, show basic connection timeline
        const { lastConnected, reconnectAttempts } = this.connectionData;
        
        if (!lastConnected && reconnectAttempts === 0) {
            this.connectionHistory.innerHTML = '';
            return;
        }

        let historyItems = [];
        
        if (lastConnected) {
            historyItems.push({
                type: 'connection',
                message: 'Connected to server',
                timestamp: lastConnected,
                icon: '🟢'
            });
        }
        
        if (reconnectAttempts > 0) {
            historyItems.push({
                type: 'reconnection',
                message: `${reconnectAttempts} reconnection attempts`,
                timestamp: new Date(),
                icon: '🔄'
            });
        }

        if (historyItems.length > 0) {
            const historyHtml = historyItems.map(item => `
                <div class="history-item ${item.type}">
                    <div class="history-icon">${item.icon}</div>
                    <div class="history-content">
                        <div class="history-message">${this.escapeHtml(item.message)}</div>
                        <div class="history-time">${this.formatRelativeTime(item.timestamp)}</div>
                    </div>
                </div>
            `).join('');

            this.connectionHistory.innerHTML = `
                <div class="history-header">
                    <h4>Recent Activity</h4>
                </div>
                <div class="history-content">
                    ${historyHtml}
                </div>
            `;
        }
    }

    refresh() {
        this.gatherClientInfo();
        this.updateConnectionInfo();
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        this.stopPeriodicUpdates();
        super.destroy();
    }
}