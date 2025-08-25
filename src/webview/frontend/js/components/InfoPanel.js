/**
 * InfoPanel Component - System information and monitoring display
 */

import { Component } from './base/Component.js';

export class InfoPanel extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Sub-components
        this.serverStatus = null;
        this.connectionInfo = null;
        this.systemMetrics = null;
        this.errorLog = null;

        // Update intervals
        this.metricsUpdateInterval = null;
        this.statusUpdateInterval = null;

        // Error log storage
        this.errorHistory = [];
        this.maxErrorHistory = 50;
    }

    async initialize() {
        await super.initialize();
        this.render();
        await this.initializeSubComponents();
        this.setupEventListeners();
        this.startPeriodicUpdates();
    }

    render() {
        this.element = this.createElement('div', {}, ['info-panel']);

        this.element.innerHTML = `
            <div class="info-panel-header">
                <h2 class="panel-title">System Information</h2>
                <div class="panel-actions">
                    <button class="btn btn-sm" id="refreshButton" title="Refresh All">
                        <span class="icon">🔄</span>
                        Refresh
                    </button>
                    <button class="btn btn-sm" id="clearErrorsButton" title="Clear Error Log">
                        <span class="icon">🗑️</span>
                        Clear Errors
                    </button>
                </div>
            </div>
            
            <div class="info-panel-content">
                <div class="info-grid">
                    <!-- Server Status Section -->
                    <div class="info-section server-status-section">
                        <div class="section-header">
                            <h3 class="section-title">Server Status</h3>
                            <div class="section-indicator" id="serverStatusIndicator">
                                <span class="status-dot"></span>
                            </div>
                        </div>
                        <div class="section-content" id="serverStatusContent">
                            <!-- ServerStatus component will be rendered here -->
                        </div>
                    </div>

                    <!-- Connection Info Section -->
                    <div class="info-section connection-info-section">
                        <div class="section-header">
                            <h3 class="section-title">Connection</h3>
                            <div class="section-indicator" id="connectionStatusIndicator">
                                <span class="status-dot"></span>
                            </div>
                        </div>
                        <div class="section-content" id="connectionInfoContent">
                            <!-- ConnectionInfo component will be rendered here -->
                        </div>
                    </div>

                    <!-- System Metrics Section -->
                    <div class="info-section system-metrics-section">
                        <div class="section-header">
                            <h3 class="section-title">Performance</h3>
                            <div class="section-indicator" id="metricsStatusIndicator">
                                <span class="status-dot"></span>
                            </div>
                        </div>
                        <div class="section-content" id="systemMetricsContent">
                            <!-- SystemMetrics component will be rendered here -->
                        </div>
                    </div>

                    <!-- Error Log Section -->
                    <div class="info-section error-log-section full-width">
                        <div class="section-header">
                            <h3 class="section-title">Error Log</h3>
                            <div class="section-actions">
                                <span class="error-count" id="errorCount">0 errors</span>
                                <button class="btn btn-xs" id="toggleErrorLog" title="Toggle Error Log">
                                    <span class="icon">📋</span>
                                </button>
                            </div>
                        </div>
                        <div class="section-content error-log-content" id="errorLogContent">
                            <!-- Error log will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.appendChild(this.element);

        // Get references to key elements
        this.refreshButton = this.querySelector('#refreshButton');
        this.clearErrorsButton = this.querySelector('#clearErrorsButton');
        this.toggleErrorLogButton = this.querySelector('#toggleErrorLog');
        this.errorCountElement = this.querySelector('#errorCount');
        
        this.serverStatusIndicator = this.querySelector('#serverStatusIndicator');
        this.connectionStatusIndicator = this.querySelector('#connectionStatusIndicator');
        this.metricsStatusIndicator = this.querySelector('#metricsStatusIndicator');
        
        this.serverStatusContent = this.querySelector('#serverStatusContent');
        this.connectionInfoContent = this.querySelector('#connectionInfoContent');
        this.systemMetricsContent = this.querySelector('#systemMetricsContent');
        this.errorLogContent = this.querySelector('#errorLogContent');
    }

    async initializeSubComponents() {
        // Import and initialize ServerStatus component
        const { ServerStatus } = await import('./info/ServerStatus.js');
        this.serverStatus = new ServerStatus({
            container: this.serverStatusContent,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });
        await this.serverStatus.initialize();
        this.addChildComponent(this.serverStatus);

        // Import and initialize ConnectionInfo component
        const { ConnectionInfo } = await import('./info/ConnectionInfo.js');
        this.connectionInfo = new ConnectionInfo({
            container: this.connectionInfoContent,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });
        await this.connectionInfo.initialize();
        this.addChildComponent(this.connectionInfo);

        // Import and initialize SystemMetrics component
        const { SystemMetrics } = await import('./info/SystemMetrics.js');
        this.systemMetrics = new SystemMetrics({
            container: this.systemMetricsContent,
            stateManager: this.stateManager,
            webSocketClient: this.webSocketClient,
            notificationService: this.notificationService
        });
        await this.systemMetrics.initialize();
        this.addChildComponent(this.systemMetrics);

        // Initialize error log display
        this.initializeErrorLog();
    }

    setupEventListeners() {
        // Refresh button
        this.addEventListener(this.refreshButton, 'click', this.handleRefreshAll);

        // Clear errors button
        this.addEventListener(this.clearErrorsButton, 'click', this.handleClearErrors);

        // Toggle error log button
        this.addEventListener(this.toggleErrorLogButton, 'click', this.handleToggleErrorLog);

        // Listen for state changes
        this.stateManager.subscribe('connection', this.handleConnectionStateChange.bind(this));
        this.stateManager.subscribe('system', this.handleSystemStateChange.bind(this));

        // Listen for WebSocket errors
        if (this.webSocketClient) {
            this.webSocketClient.on('error', this.handleWebSocketError.bind(this));
            this.webSocketClient.on('connectionError', this.handleConnectionError.bind(this));
        }

        // Listen for global errors
        window.addEventListener('error', this.handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }

    startPeriodicUpdates() {
        // Update metrics every 5 seconds
        this.metricsUpdateInterval = setInterval(() => {
            this.requestMetricsUpdate();
        }, 5000);

        // Update server status every 10 seconds
        this.statusUpdateInterval = setInterval(() => {
            this.requestStatusUpdate();
        }, 10000);

        // Initial updates
        this.requestStatusUpdate();
        this.requestMetricsUpdate();
    }

    stopPeriodicUpdates() {
        if (this.metricsUpdateInterval) {
            clearInterval(this.metricsUpdateInterval);
            this.metricsUpdateInterval = null;
        }

        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
            this.statusUpdateInterval = null;
        }
    }

    initializeErrorLog() {
        this.renderErrorLog();
        this.updateErrorCount();
    }

    handleRefreshAll() {
        console.log('🔄 Refreshing all system information');
        
        // Request fresh data from server
        this.requestStatusUpdate();
        this.requestMetricsUpdate();
        
        // Refresh sub-components
        if (this.serverStatus) {
            this.serverStatus.refresh();
        }
        if (this.connectionInfo) {
            this.connectionInfo.refresh();
        }
        if (this.systemMetrics) {
            this.systemMetrics.refresh();
        }

        // Show refresh notification
        if (this.notificationService) {
            this.notificationService.show({
                type: 'info',
                message: 'System information refreshed',
                duration: 2000
            });
        }
    }

    handleClearErrors() {
        this.errorHistory = [];
        this.renderErrorLog();
        this.updateErrorCount();
        
        if (this.notificationService) {
            this.notificationService.show({
                type: 'success',
                message: 'Error log cleared',
                duration: 2000
            });
        }
    }

    handleToggleErrorLog() {
        const errorLogSection = this.querySelector('.error-log-section');
        const isExpanded = errorLogSection.classList.contains('expanded');
        
        if (isExpanded) {
            errorLogSection.classList.remove('expanded');
            this.toggleErrorLogButton.title = 'Show Error Log';
        } else {
            errorLogSection.classList.add('expanded');
            this.toggleErrorLogButton.title = 'Hide Error Log';
        }
    }

    handleConnectionStateChange(connectionState) {
        // Update connection status indicator
        const indicator = this.connectionStatusIndicator.querySelector('.status-dot');
        indicator.className = 'status-dot';
        
        switch (connectionState.status) {
            case 'connected':
                indicator.classList.add('connected');
                break;
            case 'connecting':
                indicator.classList.add('connecting');
                break;
            case 'disconnected':
                indicator.classList.add('disconnected');
                break;
        }
    }

    handleSystemStateChange(systemState) {
        // Update system metrics indicator based on performance
        const indicator = this.metricsStatusIndicator.querySelector('.status-dot');
        indicator.className = 'status-dot';
        
        if (systemState.performance) {
            const { cpu, memory } = systemState.performance;
            if (cpu > 80 || memory > 90) {
                indicator.classList.add('warning');
            } else if (cpu > 90 || memory > 95) {
                indicator.classList.add('error');
            } else {
                indicator.classList.add('connected');
            }
        }
    }

    handleWebSocketError(error) {
        this.addError('WebSocket Error', error.message || error.toString(), 'websocket');
    }

    handleConnectionError(error) {
        this.addError('Connection Error', error.message || error.toString(), 'connection');
    }

    handleGlobalError(event) {
        this.addError('JavaScript Error', event.error?.message || event.message, 'javascript', {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    }

    handleUnhandledRejection(event) {
        this.addError('Unhandled Promise Rejection', event.reason?.message || event.reason, 'promise');
    }

    addError(type, message, category, details = {}) {
        const error = {
            id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            type,
            message,
            category,
            details,
            timestamp: new Date(),
            count: 1
        };

        // Check if this is a duplicate error
        const existingError = this.errorHistory.find(e => 
            e.type === type && e.message === message && e.category === category
        );

        if (existingError) {
            existingError.count++;
            existingError.timestamp = new Date();
        } else {
            this.errorHistory.unshift(error);
            
            // Limit error history size
            if (this.errorHistory.length > this.maxErrorHistory) {
                this.errorHistory = this.errorHistory.slice(0, this.maxErrorHistory);
            }
        }

        this.renderErrorLog();
        this.updateErrorCount();
    }

    renderErrorLog() {
        if (this.errorHistory.length === 0) {
            this.errorLogContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <div class="empty-message">No errors logged</div>
                </div>
            `;
            return;
        }

        const errorItems = this.errorHistory.map(error => `
            <div class="error-item ${error.category}" data-error-id="${error.id}">
                <div class="error-header">
                    <div class="error-type">${this.escapeHtml(error.type)}</div>
                    <div class="error-meta">
                        <span class="error-time">${this.formatTime(error.timestamp)}</span>
                        ${error.count > 1 ? `<span class="error-count">${error.count}x</span>` : ''}
                    </div>
                </div>
                <div class="error-message">${this.escapeHtml(error.message)}</div>
                ${error.details && Object.keys(error.details).length > 0 ? `
                    <div class="error-details">
                        ${Object.entries(error.details).map(([key, value]) => 
                            `<div class="detail-item"><strong>${key}:</strong> ${this.escapeHtml(String(value))}</div>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');

        this.errorLogContent.innerHTML = `
            <div class="error-list">
                ${errorItems}
            </div>
        `;
    }

    updateErrorCount() {
        const count = this.errorHistory.length;
        this.errorCountElement.textContent = count === 0 ? 'No errors' : 
            count === 1 ? '1 error' : `${count} errors`;
    }

    requestStatusUpdate() {
        if (this.webSocketClient && this.webSocketClient.isConnected) {
            this.webSocketClient.sendMessage({
                type: 'status',
                id: this.webSocketClient.generateMessageId(),
                data: {
                    requestType: 'server-status'
                }
            });
        }
    }

    requestMetricsUpdate() {
        if (this.webSocketClient && this.webSocketClient.isConnected) {
            this.webSocketClient.sendMessage({
                type: 'status',
                id: this.webSocketClient.generateMessageId(),
                data: {
                    requestType: 'system-metrics'
                }
            });
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

    destroy() {
        this.stopPeriodicUpdates();
        
        // Remove global error listeners
        window.removeEventListener('error', this.handleGlobalError.bind(this));
        window.removeEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        
        super.destroy();
    }
}