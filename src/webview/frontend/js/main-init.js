/**
 * Main Initialization Script
 * Coordinates all modules and handles application startup
 */

// Main initialization function
async function initializeApplication() {
    try {
        console.log('🚀 Starting VS Code Web Automation Tunnel...');
        
        // Remove no-js class when JavaScript is available
        document.documentElement.classList.remove('no-js');
        document.documentElement.classList.add('js');
        
        // Initialize configuration
        initializeConfiguration();
        
        // Initialize performance monitoring early
        initializePerformanceMonitoring();
        
        // Setup global error handling
        setupGlobalErrorHandling();
        
        // Setup message handling for VS Code webview
        setupMessageHandling();
        
        // Setup UI toggle button
        setupUIToggle();
        
        // Initialize the UI
        await initializeUI();
        
        console.log('✅ Application initialization complete');
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        
        // Show critical error if initialization completely fails
        if (typeof showFinalErrorScreen === 'function') {
            showFinalErrorScreen(error);
        } else {
            // Fallback error display
            document.body.innerHTML = `
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #1e1e1e; color: #cccccc; display: flex; align-items: center; justify-content: center; font-family: sans-serif; padding: 2rem; text-align: center;">
                    <div>
                        <h1 style="color: #f14c4c; margin-bottom: 1rem;">⚠️ Critical Error</h1>
                        <p style="margin-bottom: 2rem;">The application failed to initialize. Please refresh the page.</p>
                        <button onclick="location.reload()" style="background: #007acc; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 14px;">Reload Page</button>
                        <div style="margin-top: 2rem; font-size: 12px; opacity: 0.7;">
                            <details>
                                <summary>Error Details</summary>
                                <pre style="text-align: left; background: #2d2d30; padding: 1rem; border-radius: 4px; margin-top: 1rem; overflow: auto; max-height: 200px;">${error.message}\n\n${error.stack || ''}</pre>
                            </details>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // DOM is already ready
    initializeApplication();
}