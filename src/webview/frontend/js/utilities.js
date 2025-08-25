/**
 * Utility Functions and Configuration
 * Contains helper functions, configuration, and shared utilities
 */

// Global configuration setup
function initializeConfiguration() {
    window.webAutomationConfig = {
        isVSCodeWebview: typeof acquireVsCodeApi !== 'undefined',
        vscode: null,
        useEnhancedUI: true, // Will be set dynamically
        debugMode: false
    };

    // Initialize VS Code API if available
    if (window.webAutomationConfig.isVSCodeWebview) {
        try {
            window.webAutomationConfig.vscode = acquireVsCodeApi();
            window.vscode = window.webAutomationConfig.vscode;
        } catch (error) {
            console.warn('Failed to acquire VS Code API:', error);
        }
    }
}

// Load script using traditional method (compatible with VS Code webviews) - Enhanced version
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if script is already loaded
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
            console.log(`✅ Script already loaded: ${src}`);
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.type = 'text/javascript';
        script.async = true; // Ensure async loading
        
        // Add timeout for script loading
        const timeout = setTimeout(() => {
            script.onload = null;
            script.onerror = null;
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error(`Script loading timeout: ${src}`));
        }, 15000); // 15 second timeout
        
        script.onload = () => {
            clearTimeout(timeout);
            console.log(`✅ Script loaded: ${src}`);
            resolve();
        };
        
        script.onerror = (error) => {
            clearTimeout(timeout);
            console.error(`❌ Failed to load script: ${src}`, error);
            reject(new Error(`Failed to load script: ${src}`));
        };
        
        document.head.appendChild(script);
    });
}

// Load script with retry mechanism
async function loadScriptWithRetry(src, expectedClass, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await loadScript(src);
            
            // Verify the expected class is available
            if (expectedClass && !window[expectedClass]) {
                throw new Error(`Expected class ${expectedClass} not found after loading ${src}`);
            }
            
            return;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            console.warn(`Script loading attempt ${attempt} failed, retrying...`, error);
            await delay(500 * attempt);
        }
    }
}

// Update Basic UI element IDs (remove 'basic' prefix for compatibility)
function updateBasicUIElementIds() {
    const elementMapping = {
        'basicConnectionStatus': 'connectionStatus',
        'basicStatusIndicator': 'statusIndicator', 
        'basicStatusText': 'statusText',
        'basicServerUrl': 'serverUrl',
        'basicWebsocketPort': 'websocketPort',
        'basicConnectedClients': 'connectedClients',
        'basicUptime': 'uptime',
        'basicCommandInput': 'commandInput',
        'basicArgsInput': 'argsInput',
        'basicExecuteButton': 'executeButton',
        'basicActiveEditor': 'activeEditor',
        'basicWorkspaceFolders': 'workspaceFolders',
        'basicOpenEditors': 'openEditors',
        'basicMessageLog': 'messageLog',
        'basicClearLogButton': 'clearLogButton'
    };

    for (const [basicId, targetId] of Object.entries(elementMapping)) {
        const element = document.getElementById(basicId);
        if (element && !document.getElementById(targetId)) {
            element.id = targetId;
        }
    }
}

// Legacy UI Loading Functions (Updated for compatibility)
async function loadEnhancedUI() {
    console.log('🎨 Loading Enhanced UI (legacy function)...');
    
    // Show enhanced container
    document.getElementById('enhancedApp').style.display = 'block';
    document.getElementById('basicApp').style.display = 'none';
    
    // Load enhanced styles only
    document.getElementById('basicStyles').disabled = true;
    document.getElementById('enhancedStyles').disabled = false;
    document.getElementById('componentsStyles').disabled = false;
    document.getElementById('themesStyles').disabled = false;
    document.getElementById('animationsStyles').disabled = false;
    document.getElementById('touchStyles').disabled = false;

    console.log('Enhanced styles loaded');

    // Set up enhanced UI container elements
    const enhancedContainer = document.getElementById('enhancedApp');
    
    // Create app element if it doesn't exist (enhanced UI expects 'app' id)
    let appElement = document.getElementById('app');
    if (!appElement) {
        appElement = document.createElement('div');
        appElement.id = 'app';
        appElement.className = 'app-container';
        enhancedContainer.appendChild(appElement);
    }

    console.log('Enhanced UI container prepared');

    // Implement 30-second timeout mechanism
    const initializationTimeout = setTimeout(() => {
        console.error('❌ Enhanced UI initialization timeout (30 seconds)');
        showTimeoutError();
    }, 30000);

    // Load enhanced JavaScript modules with graceful degradation
    try {
        console.log('Loading Enhanced JavaScript modules...');
        
        // Use traditional script loading instead of dynamic imports
        await loadScript('./js/enhanced.js');
        
        console.log('Enhanced modules loaded, initializing app...');
        
        // Check if EnhancedApp class is available
        if (typeof window.EnhancedApp !== 'undefined') {
            window.enhancedApp = new window.EnhancedApp();
            await window.enhancedApp.initialize();
            
            console.log('Enhanced UI initialization complete ✅');
            clearTimeout(initializationTimeout);
        } else if (typeof window.EnhancedWebApp !== 'undefined') {
            window.enhancedApp = new window.EnhancedWebApp();
            await window.enhancedApp.initialize();
            
            console.log('Enhanced Web UI initialization complete ✅');
            clearTimeout(initializationTimeout);
        } else {
            throw new Error('Enhanced UI class not found after loading script');
        }
        
    } catch (error) {
        clearTimeout(initializationTimeout);
        console.error('❌ Failed to load enhanced UI:', error);
        
        // Graceful degradation - fallback to basic UI
        console.log('🔄 Falling back to Basic UI due to Enhanced UI failure');
        await loadBasicUI();
    }
}

// Load Basic UI (Updated)
async function loadBasicUI() {
    console.log('🔧 Loading Basic UI (legacy function)...');
    
    // Show basic container
    document.getElementById('basicApp').style.display = 'block';
    document.getElementById('enhancedApp').style.display = 'none';
    
    // Load basic styles only
    document.getElementById('basicStyles').disabled = false;
    document.getElementById('enhancedStyles').disabled = true;
    document.getElementById('componentsStyles').disabled = true;
    document.getElementById('themesStyles').disabled = true;
    document.getElementById('animationsStyles').disabled = true;
    document.getElementById('touchStyles').disabled = true;

    console.log('Basic styles loaded');

    // Load Basic UI template
    try {
        await window.templateLoader.loadBasicUI();
        console.log('Basic UI template loaded');
    } catch (error) {
        console.warn('Failed to load Basic UI template, using fallback:', error);
        // Fallback: create basic UI structure programmatically if template fails
        const basicApp = document.getElementById('basicApp');
        basicApp.innerHTML = `
            <div class="container">
                <header role="banner" class="app-header">
                    <div class="header-content">
                        <h1 class="app-title">VS Code Web Automation Tunnel</h1>
                        <nav role="navigation" aria-label="Connection status and settings">
                            <div class="connection-status" id="basicConnectionStatus" role="status" aria-live="polite">
                                <span class="status-indicator" id="basicStatusIndicator" aria-hidden="true"></span>
                                <span id="basicStatusText" aria-label="Connection status">Connecting...</span>
                            </div>
                        </nav>
                    </div>
                </header>
                <main id="main-content" role="main" class="app-main" aria-label="Main application content">
                    <section class="server-info" aria-labelledby="server-info-heading">
                        <h2 id="server-info-heading" class="section-heading">Server Information</h2>
                        <div class="info-grid" role="group" aria-label="Server status information">
                            <div class="info-item" role="group">
                                <label for="basicServerUrl" class="info-label">Server URL:</label>
                                <span id="basicServerUrl" class="info-value" aria-live="polite">-</span>
                            </div>
                        </div>
                    </section>
                    <section class="command-interface" aria-labelledby="command-interface-heading">
                        <h2 id="command-interface-heading" class="section-heading">Command Interface</h2>
                        <div class="command-form" aria-labelledby="custom-command-heading">
                            <h3 id="custom-command-heading" class="subsection-heading">Custom Command</h3>
                            <form role="form" aria-label="Custom VS Code command execution">
                                <div class="input-group">
                                    <label for="basicCommandInput" class="input-label">VS Code Command:</label>
                                    <input type="text" id="basicCommandInput" class="command-input" 
                                           placeholder="e.g., workbench.action.files.newUntitledFile"
                                           aria-describedby="command-help" autocomplete="off" spellcheck="false">
                                    <div id="command-help" class="input-help">Enter a VS Code command identifier</div>
                                </div>
                                <button id="basicExecuteButton" type="button" class="execute-btn" disabled 
                                        aria-label="Execute the custom command">
                                    <span class="btn-icon" aria-hidden="true">▶️</span>
                                    <span class="btn-text">Execute Command</span>
                                </button>
                            </form>
                        </div>
                    </section>
                    <section class="message-log" aria-labelledby="message-log-heading">
                        <h2 id="message-log-heading" class="section-heading">Message Log</h2>
                        <div class="log-controls" role="toolbar" aria-label="Log controls">
                            <button id="basicClearLogButton" type="button" class="clear-log-btn" 
                                    aria-label="Clear all log messages">
                                <span class="btn-icon" aria-hidden="true">🗑️</span>
                                <span class="btn-text">Clear Log</span>
                            </button>
                        </div>
                        <div class="log-container" id="basicMessageLog" role="log" aria-live="polite" 
                             aria-label="Application message log" tabindex="0"></div>
                    </section>
                </main>
            </div>
        `;
    }

    // Update element IDs for basic UI (it expects elements without 'basic' prefix)
    updateBasicUIElementIds();

    console.log('Basic UI elements prepared');

    // Implement 30-second timeout mechanism
    const initializationTimeout = setTimeout(() => {
        console.error('❌ Basic UI initialization timeout (30 seconds)');
        showTimeoutError();
    }, 30000);

    // Load basic JavaScript
    try {
        // Use traditional script loading instead of dynamic imports
        await loadScript('./js/basic.js');
        
        // Check if BasicApp class is available
        if (typeof window.BasicApp !== 'undefined') {
            window.basicApp = new window.BasicApp();
            await window.basicApp.initialize();
            
            console.log('Basic UI initialization complete ✅');
            clearTimeout(initializationTimeout);
        } else {
            throw new Error('BasicApp class not found after loading script');
        }
        
    } catch (error) {
        clearTimeout(initializationTimeout);
        console.error('❌ Failed to load basic UI:', error);
        
        // Show final error screen
        showFinalErrorScreen(error);
    }
}

// Toggle UI Mode (for debugging)
function toggleUI() {
    window.webAutomationConfig.useEnhancedUI = !window.webAutomationConfig.useEnhancedUI;
    location.reload();
}

// UI Mode Detection and Loading (Updated)
async function initializeUI() {
    // Check if EnhancedUILoader is available
    if (typeof window.EnhancedUILoader !== 'function') {
        console.warn('⚠️ EnhancedUILoader not available, falling back to basic initialization');
        // Fallback to basic UI initialization
        try {
            await loadBasicUI();
            return window.basicApp;
        } catch (error) {
            console.error('❌ Basic UI fallback failed:', error);
            throw error;
        }
    }
    
    const loader = new window.EnhancedUILoader();
    window.currentUILoader = loader; // Store for error logging
    return await loader.initialize();
}

// Enhanced Performance Monitoring
function initializePerformanceMonitoring() {
    // Monitor Core Web Vitals if available
    if (typeof PerformanceObserver !== 'undefined') {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    console.log(`Performance metric: ${entry.name} = ${entry.value}`);
                    
                    // Log critical metrics
                    if (entry.name === 'first-contentful-paint') {
                        console.log(`🎨 First Contentful Paint: ${entry.value}ms`);
                    } else if (entry.name === 'largest-contentful-paint') {
                        console.log(`🖼️ Largest Contentful Paint: ${entry.value}ms`);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
        } catch (error) {
            console.warn('Performance monitoring setup failed:', error);
        }
    }
}

// Utility delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced message handling for VS Code webview
function setupMessageHandling() {
    if (window.webAutomationConfig.isVSCodeWebview) {
        window.addEventListener('message', event => {
            const message = event.data;
            
            // Forward messages to active UI
            if (window.webAutomationConfig.useEnhancedUI && window.enhancedApp) {
                if (typeof window.enhancedApp.handleMessage === 'function') {
                    window.enhancedApp.handleMessage(message);
                }
            } else if (window.basicApp) {
                if (typeof window.basicApp.handleMessage === 'function') {
                    window.basicApp.handleMessage(message);
                }
            }
        });
    }
}

// Global error handling with enhanced reporting
function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('Global error caught:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
        
        // If no UI has been loaded yet and this is a critical error, show fallback
        if (!window.enhancedApp && !window.basicApp && event.error) {
            const criticalErrors = ['Script error', 'NetworkError', 'TypeError: Failed to fetch'];
            if (criticalErrors.some(errType => event.message.includes(errType))) {
                showFinalErrorScreen(event.error);
            }
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Log rejection details
        if (event.reason instanceof Error) {
            console.error('Rejection stack:', event.reason.stack);
        }
    });
}

// Setup toggle UI button if it exists
function setupUIToggle() {
    const toggleUIButton = document.getElementById('toggleUIButton');
    if (toggleUIButton) {
        toggleUIButton.addEventListener('click', toggleUI);
    }
}

// Export functions to window for global access
window.initializeConfiguration = initializeConfiguration;
window.loadScript = loadScript;
window.loadScriptWithRetry = loadScriptWithRetry;
window.updateBasicUIElementIds = updateBasicUIElementIds;
window.loadEnhancedUI = loadEnhancedUI;
window.loadBasicUI = loadBasicUI;
window.toggleUI = toggleUI;
window.initializeUI = initializeUI;
window.initializePerformanceMonitoring = initializePerformanceMonitoring;
window.delay = delay;
window.setupMessageHandling = setupMessageHandling;
window.setupGlobalErrorHandling = setupGlobalErrorHandling;
window.setupUIToggle = setupUIToggle;