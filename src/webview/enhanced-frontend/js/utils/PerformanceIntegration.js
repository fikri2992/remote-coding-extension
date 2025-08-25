/**
 * Performance Integration
 * Integrates all performance optimizations across the enhanced web frontend
 */

import { globalOptimizer, MemoryManager } from './PerformanceOptimizer.js';
import { globalPerformanceMonitor } from './PerformanceMonitor.js';

export class PerformanceIntegration {
    constructor() {
        this.isInitialized = false;
        this.components = new Map();
        this.globalMemoryManager = new MemoryManager({
            maxCacheSize: 1000,
            cleanupInterval: 300000, // 5 minutes
            maxAge: 900000 // 15 minutes
        });

        // Performance settings
        this.settings = {
            enableVirtualScrolling: true,
            enableMessageBatching: true,
            enableStateBatching: true,
            enableMemoryCleanup: true,
            enablePerformanceMonitoring: true,
            virtualScrollingThreshold: 50,
            messageBatchSize: 10,
            stateBatchTimeout: 100,
            memoryCleanupInterval: 300000
        };

        // Cleanup intervals
        this.cleanupIntervals = new Map();
    }

    /**
     * Initialize performance optimizations
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('🚀 Initializing performance optimizations...');

        try {
            // Start performance monitoring if enabled
            if (this.settings.enablePerformanceMonitoring) {
                globalPerformanceMonitor.startMonitoring();
            }

            // Set up global memory cleanup
            if (this.settings.enableMemoryCleanup) {
                this.setupGlobalMemoryCleanup();
            }

            // Set up performance monitoring for components
            this.setupComponentMonitoring();

            // Set up periodic optimization
            this.setupPeriodicOptimization();

            this.isInitialized = true;
            console.log('✅ Performance optimizations initialized');

        } catch (error) {
            console.error('❌ Failed to initialize performance optimizations:', error);
        }
    }

    /**
     * Register a component for performance monitoring
     */
    registerComponent(name, component) {
        this.components.set(name, component);

        // Add performance monitoring hooks if component supports it
        if (component.getPerformanceMetrics) {
            console.log(`📊 Performance monitoring enabled for ${name}`);
        }

        // Enable virtual scrolling if supported and threshold is met
        if (component.enableVirtualScrolling && this.settings.enableVirtualScrolling) {
            const shouldEnable = this.shouldEnableVirtualScrolling(component);
            if (shouldEnable) {
                component.enableVirtualScrolling();
                console.log(`📜 Virtual scrolling enabled for ${name}`);
            }
        }
    }

    /**
     * Unregister a component
     */
    unregisterComponent(name) {
        const component = this.components.get(name);
        if (component) {
            // Cleanup component performance resources
            if (component.performMemoryCleanup) {
                component.performMemoryCleanup();
            }
            
            this.components.delete(name);
            console.log(`📊 Component ${name} unregistered from performance monitoring`);
        }
    }

    /**
     * Check if virtual scrolling should be enabled for a component
     */
    shouldEnableVirtualScrolling(component) {
        // Check if component has items that exceed threshold
        if (component.messages && component.messages.length > this.settings.virtualScrollingThreshold) {
            return true;
        }
        
        if (component.nodes && this.countTotalNodes(component.nodes) > this.settings.virtualScrollingThreshold) {
            return true;
        }

        return false;
    }

    /**
     * Count total nodes in a tree structure
     */
    countTotalNodes(nodes) {
        let count = 0;
        const countRecursive = (nodeList) => {
            nodeList.forEach(node => {
                count++;
                if (node.children) {
                    countRecursive(node.children);
                }
            });
        };
        countRecursive(nodes);
        return count;
    }

    /**
     * Set up global memory cleanup
     */
    setupGlobalMemoryCleanup() {
        const cleanupInterval = setInterval(() => {
            this.performGlobalMemoryCleanup();
        }, this.settings.memoryCleanupInterval);

        this.cleanupIntervals.set('global-memory', cleanupInterval);
    }

    /**
     * Perform global memory cleanup
     */
    performGlobalMemoryCleanup() {
        console.log('🧹 Performing global memory cleanup...');

        // Cleanup global optimizer
        const optimizerMetrics = globalOptimizer.getMetrics();
        console.log('Optimizer metrics before cleanup:', optimizerMetrics);

        // Cleanup global memory manager
        this.globalMemoryManager.cleanup();

        // Cleanup registered components
        this.components.forEach((component, name) => {
            if (component.performMemoryCleanup) {
                try {
                    component.performMemoryCleanup();
                    console.log(`✅ Memory cleanup completed for ${name}`);
                } catch (error) {
                    console.error(`❌ Memory cleanup failed for ${name}:`, error);
                }
            }
        });

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
            console.log('🗑️ Garbage collection triggered');
        }

        console.log('✅ Global memory cleanup completed');
    }

    /**
     * Set up component performance monitoring
     */
    setupComponentMonitoring() {
        // Monitor component render times
        const originalRender = HTMLElement.prototype.render;
        if (originalRender) {
            HTMLElement.prototype.render = function(...args) {
                const startTime = performance.now();
                const result = originalRender.apply(this, args);
                const duration = performance.now() - startTime;
                
                globalPerformanceMonitor.recordRenderTime(
                    this.constructor.name || 'Unknown',
                    duration
                );
                
                return result;
            };
        }
    }

    /**
     * Set up periodic optimization
     */
    setupPeriodicOptimization() {
        // Periodic performance check
        const optimizationInterval = setInterval(() => {
            this.performPeriodicOptimization();
        }, 60000); // Every minute

        this.cleanupIntervals.set('periodic-optimization', optimizationInterval);
    }

    /**
     * Perform periodic optimization
     */
    performPeriodicOptimization() {
        // Check if virtual scrolling should be enabled/disabled for components
        this.components.forEach((component, name) => {
            if (component.checkVirtualScrollingThreshold) {
                component.checkVirtualScrollingThreshold();
            }
        });

        // Get performance report
        const report = globalPerformanceMonitor.getPerformanceReport();
        
        // Apply recommendations
        this.applyPerformanceRecommendations(report.recommendations);

        // Log performance summary
        if (report.warnings.length > 0) {
            console.warn(`⚠️ Performance issues detected: ${report.warnings.length} warnings`);
        }
    }

    /**
     * Apply performance recommendations
     */
    applyPerformanceRecommendations(recommendations) {
        recommendations.forEach(rec => {
            switch (rec.type) {
                case 'memory':
                    if (rec.priority === 'high') {
                        this.performGlobalMemoryCleanup();
                    }
                    break;
                    
                case 'render':
                    if (rec.priority === 'high') {
                        // Enable virtual scrolling for components that support it
                        this.components.forEach((component, name) => {
                            if (component.enableVirtualScrolling && !component.virtualScroller) {
                                component.enableVirtualScrolling();
                                console.log(`📜 Auto-enabled virtual scrolling for ${name}`);
                            }
                        });
                    }
                    break;
                    
                case 'messaging':
                    // Increase batch sizes for better performance
                    this.settings.messageBatchSize = Math.min(this.settings.messageBatchSize + 2, 20);
                    console.log(`📦 Increased message batch size to ${this.settings.messageBatchSize}`);
                    break;
            }
        });
    }

    /**
     * Get comprehensive performance report
     */
    getPerformanceReport() {
        const componentMetrics = {};
        
        this.components.forEach((component, name) => {
            if (component.getPerformanceMetrics) {
                componentMetrics[name] = component.getPerformanceMetrics();
            }
        });

        return {
            global: {
                optimizer: globalOptimizer.getMetrics(),
                memoryManager: this.globalMemoryManager.getStats(),
                monitor: globalPerformanceMonitor.getPerformanceReport()
            },
            components: componentMetrics,
            settings: this.settings,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Update performance settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Apply settings changes
        if (newSettings.enablePerformanceMonitoring !== undefined) {
            if (newSettings.enablePerformanceMonitoring) {
                globalPerformanceMonitor.startMonitoring();
            } else {
                globalPerformanceMonitor.stopMonitoring();
            }
        }

        console.log('⚙️ Performance settings updated:', this.settings);
    }

    /**
     * Optimize for mobile devices
     */
    optimizeForMobile() {
        console.log('📱 Optimizing for mobile device...');
        
        this.updateSettings({
            virtualScrollingThreshold: 25, // Lower threshold for mobile
            messageBatchSize: 5, // Smaller batches
            stateBatchTimeout: 150, // Longer timeout for slower devices
            memoryCleanupInterval: 180000 // More frequent cleanup (3 minutes)
        });

        // Enable virtual scrolling for all supported components
        this.components.forEach((component, name) => {
            if (component.enableVirtualScrolling) {
                component.enableVirtualScrolling();
                console.log(`📜 Mobile optimization: enabled virtual scrolling for ${name}`);
            }
        });
    }

    /**
     * Optimize for desktop devices
     */
    optimizeForDesktop() {
        console.log('🖥️ Optimizing for desktop device...');
        
        this.updateSettings({
            virtualScrollingThreshold: 100, // Higher threshold for desktop
            messageBatchSize: 15, // Larger batches
            stateBatchTimeout: 50, // Shorter timeout for faster devices
            memoryCleanupInterval: 600000 // Less frequent cleanup (10 minutes)
        });
    }

    /**
     * Destroy performance integration
     */
    destroy() {
        console.log('🔄 Destroying performance integration...');

        // Stop performance monitoring
        globalPerformanceMonitor.stopMonitoring();

        // Clear all cleanup intervals
        this.cleanupIntervals.forEach((interval, name) => {
            clearInterval(interval);
            console.log(`⏹️ Stopped ${name} interval`);
        });
        this.cleanupIntervals.clear();

        // Cleanup global resources
        globalOptimizer.cleanup();
        this.globalMemoryManager.destroy();

        // Cleanup all registered components
        this.components.forEach((component, name) => {
            if (component.destroy) {
                component.destroy();
            }
        });
        this.components.clear();

        this.isInitialized = false;
        console.log('✅ Performance integration destroyed');
    }
}

// Global performance integration instance
export const globalPerformanceIntegration = new PerformanceIntegration();