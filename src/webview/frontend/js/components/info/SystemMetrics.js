/**
 * SystemMetrics Component - System performance monitoring and metrics display
 */

import { Component } from '../base/Component.js';

export class SystemMetrics extends Component {
    constructor(options) {
        super(options);

        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;

        // Metrics data
        this.systemMetrics = {};
        this.performanceMetrics = {};
        this.browserMetrics = {};
        
        // Performance monitoring
        this.performanceObserver = null;
        this.metricsHistory = [];
        this.maxHistoryLength = 60; // Keep 60 data points (5 minutes at 5-second intervals)
        
        // Update tracking
        this.lastUpdate = null;
        this.updateInterval = null;
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.setupPerformanceMonitoring();
        this.startPeriodicUpdates();
        this.gatherInitialMetrics();
    }

    render() {
        this.element = this.createElement('div', {}, ['system-metrics']);

        this.element.innerHTML = `
            <div class="metrics-cards">
                <div class="metrics-card memory-card">
                    <div class="card-header">
                        <div class="card-icon">🧠</div>
                        <div class="card-title">Memory</div>
                    </div>
                    <div class="card-content" id="memoryContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading memory info...</div>
                        </div>
                    </div>
                </div>

                <div class="metrics-card cpu-card">
                    <div class="card-header">
                        <div class="card-icon">⚡</div>
                        <div class="card-title">Performance</div>
                    </div>
                    <div class="card-content" id="performanceContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Measuring performance...</div>
                        </div>
                    </div>
                </div>

                <div class="metrics-card browser-card">
                    <div class="card-header">
                        <div class="card-icon">🌐</div>
                        <div class="card-title">Browser</div>
                    </div>
                    <div class="card-content" id="browserContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Gathering browser metrics...</div>
                        </div>
                    </div>
                </div>

                <div class="metrics-card server-metrics-card">
                    <div class="card-header">
                        <div class="card-icon">🖥️</div>
                        <div class="card-title">Server</div>
                    </div>
                    <div class="card-content" id="serverMetricsContent">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">Loading server metrics...</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="metrics-charts" id="metricsCharts">
                <!-- Performance charts will be rendered here -->
            </div>

            <div class="metrics-details" id="metricsDetails">
                <!-- Detailed metrics information will be rendered here -->
            </div>
        `; 
       this.container.appendChild(this.element);

        // Get references to content areas
        this.memoryContent = this.querySelector('#memoryContent');
        this.performanceContent = this.querySelector('#performanceContent');
        this.browserContent = this.querySelector('#browserContent');
        this.serverMetricsContent = this.querySelector('#serverMetricsContent');
        this.metricsCharts = this.querySelector('#metricsCharts');
        this.metricsDetails = this.querySelector('#metricsDetails');
    }

    setupEventListeners() {
        // Listen for system state changes
        this.stateManager.subscribe('system', this.handleSystemStateChange.bind(this));
        
        // Listen for server metrics updates
        if (this.webSocketClient) {
            this.webSocketClient.on('systemMetrics', this.handleServerMetrics.bind(this));
        }

        // Listen for visibility changes to pause/resume monitoring
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    setupPerformanceMonitoring() {
        // Set up Performance Observer if available
        if ('PerformanceObserver' in window) {
            try {
                this.performanceObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    this.processPerformanceEntries(entries);
                });

                // Observe different types of performance entries
                this.performanceObserver.observe({ 
                    entryTypes: ['navigation', 'resource', 'measure', 'mark'] 
                });
            } catch (error) {
                console.warn('Performance Observer not fully supported:', error);
            }
        }
    }

    startPeriodicUpdates() {
        // Update metrics every 5 seconds
        this.updateInterval = setInterval(() => {
            this.gatherMetrics();
        }, 5000);

        // Initial metrics gathering
        this.gatherMetrics();
    }

    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    gatherInitialMetrics() {
        this.gatherBrowserMetrics();
        this.gatherMemoryMetrics();
        this.gatherPerformanceMetrics();
    }

    gatherMetrics() {
        this.gatherBrowserMetrics();
        this.gatherMemoryMetrics();
        this.gatherPerformanceMetrics();
        this.requestServerMetrics();
        this.updateDisplay();
    }

    gatherBrowserMetrics() {
        // Gather browser-specific metrics
        this.browserMetrics = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.userAgentData?.platform || navigator.platform || 'Unknown',
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            hardwareConcurrency: navigator.hardwareConcurrency,
            maxTouchPoints: navigator.maxTouchPoints,
            screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio
            },
            timestamp: new Date()
        };

        // Get connection information if available
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            this.browserMetrics.connection = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
    }

    gatherMemoryMetrics() {
        // Gather memory information if available
        if ('memory' in performance) {
            this.browserMetrics.memory = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                usedPercent: Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100)
            };
        }
    }

    gatherPerformanceMetrics() {
        // Gather performance timing information
        if ('performance' in window && performance.timing) {
            const timing = performance.timing;
            const navigation = performance.getEntriesByType('navigation')[0];
            
            this.performanceMetrics = {
                pageLoad: {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart,
                    domInteractive: timing.domInteractive - timing.navigationStart,
                    firstPaint: this.getFirstPaint(),
                    firstContentfulPaint: this.getFirstContentfulPaint()
                },
                navigation: navigation ? {
                    type: navigation.type,
                    redirectCount: navigation.redirectCount,
                    transferSize: navigation.transferSize,
                    encodedBodySize: navigation.encodedBodySize,
                    decodedBodySize: navigation.decodedBodySize
                } : null,
                timestamp: new Date()
            };
        }

        // Add current performance metrics
        if ('now' in performance) {
            this.performanceMetrics.currentTime = performance.now();
        }
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    getFirstContentfulPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return firstContentfulPaint ? firstContentfulPaint.startTime : null;
    }

    processPerformanceEntries(entries) {
        // Process performance entries for real-time monitoring
        entries.forEach(entry => {
            if (entry.entryType === 'resource' && entry.duration > 1000) {
                // Log slow resources
                console.warn('Slow resource detected:', entry.name, `${entry.duration}ms`);
            }
        });
    }

    handleSystemStateChange(systemState) {
        if (systemState.metrics) {
            this.systemMetrics = { ...this.systemMetrics, ...systemState.metrics };
            this.updateServerMetrics();
        }
    }

    handleServerMetrics(metrics) {
        this.systemMetrics = { ...this.systemMetrics, ...metrics };
        this.lastUpdate = new Date();
        this.updateServerMetrics();
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Pause intensive monitoring when tab is hidden
            this.stopPeriodicUpdates();
        } else {
            // Resume monitoring when tab becomes visible
            this.startPeriodicUpdates();
        }
    }

    updateDisplay() {
        this.updateMemoryInfo();
        this.updatePerformanceInfo();
        this.updateBrowserInfo();
        this.updateServerMetrics();
        this.updateMetricsCharts();
        this.updateMetricsDetails();
    }

    updateMemoryInfo() {
        const memory = this.browserMetrics.memory;
        
        if (memory) {
            const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
            const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
            const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
            
            this.memoryContent.innerHTML = `
                <div class="memory-display">
                    <div class="memory-usage">
                        <div class="usage-bar">
                            <div class="usage-fill" style="width: ${memory.usedPercent}%"></div>
                        </div>
                        <div class="usage-text">${memory.usedPercent}% used</div>
                    </div>
                    <div class="memory-details">
                        <div class="memory-item">
                            <div class="memory-label">Used</div>
                            <div class="memory-value">${usedMB} MB</div>
                        </div>
                        <div class="memory-item">
                            <div class="memory-label">Total</div>
                            <div class="memory-value">${totalMB} MB</div>
                        </div>
                        <div class="memory-item">
                            <div class="memory-label">Limit</div>
                            <div class="memory-value">${limitMB} MB</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            this.memoryContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-message">Memory info unavailable</div>
                </div>
            `;
        }
    }

    updatePerformanceInfo() {
        const perf = this.performanceMetrics;
        
        if (perf && perf.pageLoad) {
            const { domContentLoaded, loadComplete, domInteractive, firstPaint, firstContentfulPaint } = perf.pageLoad;
            
            this.performanceContent.innerHTML = `
                <div class="performance-display">
                    <div class="performance-item">
                        <div class="perf-label">DOM Ready</div>
                        <div class="perf-value">${Math.round(domContentLoaded)}ms</div>
                    </div>
                    <div class="performance-item">
                        <div class="perf-label">Load Complete</div>
                        <div class="perf-value">${Math.round(loadComplete)}ms</div>
                    </div>
                    ${firstPaint ? `
                        <div class="performance-item">
                            <div class="perf-label">First Paint</div>
                            <div class="perf-value">${Math.round(firstPaint)}ms</div>
                        </div>
                    ` : ''}
                    ${firstContentfulPaint ? `
                        <div class="performance-item">
                            <div class="perf-label">First Content</div>
                            <div class="perf-value">${Math.round(firstContentfulPaint)}ms</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            this.performanceContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-message">Performance data unavailable</div>
                </div>
            `;
        }
    }

    updateBrowserInfo() {
        const browser = this.browserMetrics;
        
        if (browser) {
            this.browserContent.innerHTML = `
                <div class="browser-display">
                    <div class="browser-item">
                        <div class="browser-label">CPU Cores</div>
                        <div class="browser-value">${browser.hardwareConcurrency || 'Unknown'}</div>
                    </div>
                    <div class="browser-item">
                        <div class="browser-label">Pixel Ratio</div>
                        <div class="browser-value">${browser.viewport.devicePixelRatio}x</div>
                    </div>
                    <div class="browser-item">
                        <div class="browser-label">Viewport</div>
                        <div class="browser-value">${browser.viewport.width}×${browser.viewport.height}</div>
                    </div>
                    <div class="browser-item">
                        <div class="browser-label">Online</div>
                        <div class="browser-value">${browser.onLine ? '✅' : '❌'}</div>
                    </div>
                </div>
            `;
        }
    }

    updateServerMetrics() {
        const metrics = this.systemMetrics;
        
        if (metrics && Object.keys(metrics).length > 0) {
            let content = '<div class="server-metrics-display">';
            
            // CPU usage
            if (metrics.cpu !== undefined) {
                content += `
                    <div class="server-metric-item">
                        <div class="metric-label">CPU</div>
                        <div class="metric-value">${Math.round(metrics.cpu)}%</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${metrics.cpu}%"></div>
                        </div>
                    </div>
                `;
            }
            
            // Memory usage
            if (metrics.memory !== undefined) {
                content += `
                    <div class="server-metric-item">
                        <div class="metric-label">Memory</div>
                        <div class="metric-value">${Math.round(metrics.memory)}%</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${metrics.memory}%"></div>
                        </div>
                    </div>
                `;
            }
            
            // Uptime
            if (metrics.uptime !== undefined) {
                content += `
                    <div class="server-metric-item">
                        <div class="metric-label">Uptime</div>
                        <div class="metric-value">${this.formatUptime(metrics.uptime)}</div>
                    </div>
                `;
            }
            
            // Load average
            if (metrics.loadAverage) {
                content += `
                    <div class="server-metric-item">
                        <div class="metric-label">Load Avg</div>
                        <div class="metric-value">${metrics.loadAverage.join(', ')}</div>
                    </div>
                `;
            }
            
            content += '</div>';
            this.serverMetricsContent.innerHTML = content;
        } else {
            this.serverMetricsContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-message">Server metrics unavailable</div>
                </div>
            `;
        }
    }

    updateMetricsCharts() {
        // Add metrics to history for charting
        const currentMetrics = {
            timestamp: new Date(),
            memory: this.browserMetrics.memory?.usedPercent || 0,
            serverCpu: this.systemMetrics.cpu || 0,
            serverMemory: this.systemMetrics.memory || 0
        };
        
        this.metricsHistory.push(currentMetrics);
        
        // Keep only recent history
        if (this.metricsHistory.length > this.maxHistoryLength) {
            this.metricsHistory = this.metricsHistory.slice(-this.maxHistoryLength);
        }
        
        // Simple ASCII-style chart for now
        if (this.metricsHistory.length > 1) {
            this.renderSimpleChart();
        }
    }

    renderSimpleChart() {
        const history = this.metricsHistory.slice(-20); // Last 20 data points
        
        if (history.length < 2) return;
        
        const chartHtml = `
            <div class="metrics-chart">
                <div class="chart-header">
                    <h4>Performance Trends (Last ${history.length} samples)</h4>
                </div>
                <div class="chart-content">
                    <div class="chart-legend">
                        <div class="legend-item">
                            <div class="legend-color browser-memory"></div>
                            <div class="legend-label">Browser Memory</div>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color server-cpu"></div>
                            <div class="legend-label">Server CPU</div>
                        </div>
                        <div class="legend-item">
                            <div class="legend-color server-memory"></div>
                            <div class="legend-label">Server Memory</div>
                        </div>
                    </div>
                    <div class="chart-bars">
                        ${history.map((point, index) => `
                            <div class="chart-bar-group" title="${this.formatTime(point.timestamp)}">
                                <div class="chart-bar browser-memory" style="height: ${point.memory}%"></div>
                                <div class="chart-bar server-cpu" style="height: ${point.serverCpu}%"></div>
                                <div class="chart-bar server-memory" style="height: ${point.serverMemory}%"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.metricsCharts.innerHTML = chartHtml;
    }

    updateMetricsDetails() {
        const details = [];
        
        // Browser details
        if (this.browserMetrics.connection) {
            details.push({
                title: 'Network',
                items: [
                    { label: 'Connection Type', value: this.browserMetrics.connection.effectiveType || 'Unknown' },
                    { label: 'Downlink Speed', value: this.browserMetrics.connection.downlink ? `${this.browserMetrics.connection.downlink} Mbps` : 'Unknown' },
                    { label: 'Round Trip Time', value: this.browserMetrics.connection.rtt ? `${this.browserMetrics.connection.rtt}ms` : 'Unknown' },
                    { label: 'Data Saver', value: this.browserMetrics.connection.saveData ? 'Enabled' : 'Disabled' }
                ]
            });
        }
        
        // Performance details
        if (this.performanceMetrics.navigation) {
            const nav = this.performanceMetrics.navigation;
            details.push({
                title: 'Navigation',
                items: [
                    { label: 'Navigation Type', value: this.getNavigationType(nav.type) },
                    { label: 'Redirect Count', value: nav.redirectCount.toString() },
                    { label: 'Transfer Size', value: this.formatBytes(nav.transferSize) },
                    { label: 'Encoded Size', value: this.formatBytes(nav.encodedBodySize) },
                    { label: 'Decoded Size', value: this.formatBytes(nav.decodedBodySize) }
                ]
            });
        }

        if (details.length === 0) {
            this.metricsDetails.innerHTML = '';
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

        this.metricsDetails.innerHTML = `
            <div class="details-header">
                <h4>Detailed Metrics</h4>
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

    requestServerMetrics() {
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

    refresh() {
        this.gatherMetrics();
    }

    getNavigationType(type) {
        const types = {
            0: 'Navigate',
            1: 'Reload',
            2: 'Back/Forward',
            255: 'Reserved'
        };
        return types[type] || 'Unknown';
    }

    formatUptime(uptimeSeconds) {
        const seconds = Math.floor(uptimeSeconds);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${seconds}s`;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
        
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
            this.performanceObserver = null;
        }
        
        document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        super.destroy();
    }
}