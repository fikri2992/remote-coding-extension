/**
 * Performance Monitor
 * Monitors and reports performance metrics for the enhanced web frontend
 */

export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            renderTimes: [],
            memoryUsage: [],
            messageProcessingTimes: [],
            stateUpdateTimes: [],
            networkLatency: [],
            frameRates: []
        };

        this.observers = new Map();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.frameCount = 0;
        this.lastFrameTime = 0;

        // Performance thresholds
        this.thresholds = {
            renderTime: 16, // 60fps = 16.67ms per frame
            memoryUsage: 100, // MB
            messageProcessing: 50, // ms
            stateUpdate: 10, // ms
            networkLatency: 500, // ms
            frameRate: 55 // fps
        };

        this.warnings = [];
        this.maxWarnings = 50;
    }

    /**
     * Start performance monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        console.log('🔍 Performance monitoring started');

        // Monitor frame rate
        this.startFrameRateMonitoring();

        // Monitor memory usage
        this.startMemoryMonitoring();

        // Monitor long tasks
        this.startLongTaskMonitoring();

        // Periodic metrics collection
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, 5000); // Every 5 seconds
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        console.log('🔍 Performance monitoring stopped');

        // Stop frame rate monitoring
        this.stopFrameRateMonitoring();

        // Clear monitoring interval
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }

    /**
     * Start frame rate monitoring
     */
    startFrameRateMonitoring() {
        this.frameCount = 0;
        this.lastFrameTime = performance.now();

        const measureFrameRate = (currentTime) => {
            if (!this.isMonitoring) return;

            this.frameCount++;
            const elapsed = currentTime - this.lastFrameTime;

            // Calculate FPS every second
            if (elapsed >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / elapsed);
                this.recordMetric('frameRates', fps);

                if (fps < this.thresholds.frameRate) {
                    this.addWarning('Low frame rate detected', { fps, threshold: this.thresholds.frameRate });
                }

                this.frameCount = 0;
                this.lastFrameTime = currentTime;
            }

            requestAnimationFrame(measureFrameRate);
        };

        requestAnimationFrame(measureFrameRate);
    }

    /**
     * Stop frame rate monitoring
     */
    stopFrameRateMonitoring() {
        this.frameCount = 0;
        this.lastFrameTime = 0;
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        if (!performance.memory) {
            console.warn('Memory monitoring not supported in this browser');
            return;
        }

        const monitorMemory = () => {
            if (!this.isMonitoring) return;

            const memoryInfo = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };

            this.recordMetric('memoryUsage', memoryInfo.used);

            if (memoryInfo.used > this.thresholds.memoryUsage) {
                this.addWarning('High memory usage detected', { 
                    used: memoryInfo.used, 
                    threshold: this.thresholds.memoryUsage 
                });
            }

            setTimeout(monitorMemory, 10000); // Every 10 seconds
        };

        monitorMemory();
    }

    /**
     * Start long task monitoring
     */
    startLongTaskMonitoring() {
        if (!window.PerformanceObserver) {
            console.warn('Long task monitoring not supported in this browser');
            return;
        }

        try {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        this.addWarning('Long task detected', {
                            duration: entry.duration,
                            startTime: entry.startTime,
                            name: entry.name
                        });
                    }
                });
            });

            longTaskObserver.observe({ entryTypes: ['longtask'] });
            this.observers.set('longtask', longTaskObserver);
        } catch (error) {
            console.warn('Failed to start long task monitoring:', error);
        }
    }

    /**
     * Record render time
     */
    recordRenderTime(componentName, duration) {
        this.recordMetric('renderTimes', duration, { component: componentName });

        if (duration > this.thresholds.renderTime) {
            this.addWarning('Slow render detected', {
                component: componentName,
                duration,
                threshold: this.thresholds.renderTime
            });
        }
    }

    /**
     * Record message processing time
     */
    recordMessageProcessingTime(messageType, duration) {
        this.recordMetric('messageProcessingTimes', duration, { messageType });

        if (duration > this.thresholds.messageProcessing) {
            this.addWarning('Slow message processing detected', {
                messageType,
                duration,
                threshold: this.thresholds.messageProcessing
            });
        }
    }

    /**
     * Record state update time
     */
    recordStateUpdateTime(section, duration) {
        this.recordMetric('stateUpdateTimes', duration, { section });

        if (duration > this.thresholds.stateUpdate) {
            this.addWarning('Slow state update detected', {
                section,
                duration,
                threshold: this.thresholds.stateUpdate
            });
        }
    }

    /**
     * Record network latency
     */
    recordNetworkLatency(latency) {
        this.recordMetric('networkLatency', latency);

        if (latency > this.thresholds.networkLatency) {
            this.addWarning('High network latency detected', {
                latency,
                threshold: this.thresholds.networkLatency
            });
        }
    }

    /**
     * Record a metric
     */
    recordMetric(type, value, metadata = {}) {
        if (!this.metrics[type]) {
            this.metrics[type] = [];
        }

        const metric = {
            value,
            timestamp: Date.now(),
            ...metadata
        };

        this.metrics[type].push(metric);

        // Keep only last 100 entries per metric type
        if (this.metrics[type].length > 100) {
            this.metrics[type] = this.metrics[type].slice(-100);
        }
    }

    /**
     * Add performance warning
     */
    addWarning(message, data = {}) {
        const warning = {
            message,
            data,
            timestamp: Date.now()
        };

        this.warnings.push(warning);

        // Keep only recent warnings
        if (this.warnings.length > this.maxWarnings) {
            this.warnings = this.warnings.slice(-this.maxWarnings);
        }

        console.warn('⚠️ Performance warning:', message, data);
    }

    /**
     * Collect current metrics
     */
    collectMetrics() {
        const metrics = {
            timestamp: Date.now(),
            renderTimes: this.getMetricSummary('renderTimes'),
            memoryUsage: this.getMetricSummary('memoryUsage'),
            messageProcessingTimes: this.getMetricSummary('messageProcessingTimes'),
            stateUpdateTimes: this.getMetricSummary('stateUpdateTimes'),
            networkLatency: this.getMetricSummary('networkLatency'),
            frameRates: this.getMetricSummary('frameRates'),
            warnings: this.warnings.length
        };

        return metrics;
    }

    /**
     * Get metric summary
     */
    getMetricSummary(type) {
        const metrics = this.metrics[type] || [];
        if (metrics.length === 0) {
            return { count: 0, avg: 0, min: 0, max: 0 };
        }

        const values = metrics.map(m => m.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return {
            count: values.length,
            avg: Math.round(avg * 100) / 100,
            min,
            max
        };
    }

    /**
     * Get performance report
     */
    getPerformanceReport() {
        return {
            isMonitoring: this.isMonitoring,
            metrics: this.collectMetrics(),
            warnings: this.warnings.slice(-10), // Last 10 warnings
            thresholds: this.thresholds,
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Get performance recommendations
     */
    getRecommendations() {
        const recommendations = [];
        const metrics = this.collectMetrics();

        // Check render performance
        if (metrics.renderTimes.avg > this.thresholds.renderTime) {
            recommendations.push({
                type: 'render',
                message: 'Consider optimizing component rendering or enabling virtual scrolling',
                priority: 'high'
            });
        }

        // Check memory usage
        if (metrics.memoryUsage.avg > this.thresholds.memoryUsage) {
            recommendations.push({
                type: 'memory',
                message: 'High memory usage detected. Consider implementing memory cleanup',
                priority: 'high'
            });
        }

        // Check frame rate
        if (metrics.frameRates.avg < this.thresholds.frameRate) {
            recommendations.push({
                type: 'framerate',
                message: 'Low frame rate detected. Consider reducing DOM updates or animations',
                priority: 'medium'
            });
        }

        // Check message processing
        if (metrics.messageProcessingTimes.avg > this.thresholds.messageProcessing) {
            recommendations.push({
                type: 'messaging',
                message: 'Slow message processing. Consider implementing message batching',
                priority: 'medium'
            });
        }

        // Check network latency
        if (metrics.networkLatency.avg > this.thresholds.networkLatency) {
            recommendations.push({
                type: 'network',
                message: 'High network latency. Consider implementing offline mode or caching',
                priority: 'low'
            });
        }

        return recommendations;
    }

    /**
     * Clear all metrics and warnings
     */
    clearMetrics() {
        Object.keys(this.metrics).forEach(key => {
            this.metrics[key] = [];
        });
        this.warnings = [];
        console.log('🔍 Performance metrics cleared');
    }

    /**
     * Set performance thresholds
     */
    setThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        console.log('🔍 Performance thresholds updated:', this.thresholds);
    }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();