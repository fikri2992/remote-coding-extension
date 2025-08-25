/**
 * Error Handling and Recovery Functions
 * Handles various error scenarios and recovery mechanisms
 */

// Enhanced Error Handling and Recovery Functions

// Create timeout error screen with recovery options
function createTimeoutErrorScreen() {
    return createErrorScreen(
        'Initialization Timeout',
        'The UI failed to load within 30 seconds. This may be due to missing dependencies or network issues.',
        [
            { text: 'Retry Enhanced UI', action: () => { window.location.search = '?ui=enhanced'; location.reload(); } },
            { text: 'Try Basic UI', action: () => { window.location.search = '?ui=basic'; location.reload(); } },
            { text: 'Debug Mode', action: () => { window.location.search = '?debug&ui=enhanced'; location.reload(); } },
            { text: 'Force Reload', action: () => location.reload() }
        ]
    );
}

// Create critical error screen
function createCriticalErrorScreen(primaryError, emergencyError) {
    const combinedError = new Error(
        `Primary: ${primaryError.message}\nEmergency: ${emergencyError.message}`
    );
    combinedError.stack = `Primary Error:\n${primaryError.stack}\n\nEmergency Error:\n${emergencyError.stack}`;
    
    return createErrorScreen(
        'Critical UI Failure',
        'Both Enhanced and Basic UIs failed to load. The application cannot start properly.',
        [
            { text: 'Reload Page', action: () => location.reload() },
            { text: 'Clear Cache & Reload', action: () => { 
                if ('caches' in window) {
                    caches.keys().then(names => {
                        names.forEach(name => caches.delete(name));
                        location.reload();
                    });
                } else {
                    location.reload(true);
                }
            }},
            { text: 'Report Issue', action: () => window.open('https://github.com/microsoft/vscode/issues/new', '_blank') },
            { text: 'Download Logs', action: () => downloadErrorLogs() }
        ],
        combinedError
    );
}

// Show recovery notification
function showRecoveryNotification() {
    const notification = document.createElement('div');
    notification.className = 'recovery-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">⚠️</div>
            <div class="notification-body">
                <div class="notification-title">UI Recovery Mode</div>
                <div class="notification-message">Enhanced UI failed to load. Running in Basic UI mode with reduced features.</div>
                <div class="notification-actions">
                    <button class="notification-btn" onclick="this.closest('.recovery-notification').remove()">Dismiss</button>
                    <button class="notification-btn secondary" onclick="window.location.search='?ui=enhanced&debug'; location.reload();">Debug Mode</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

// Download error logs for debugging
function downloadErrorLogs() {
    const loader = window.currentUILoader; // Assuming we store the loader instance
    const errorData = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorHistory: loader?.errorHistory || [],
        capabilities: loader?.progressiveEnhancement?.capabilities || 'Not detected',
        networkConditions: loader?.progressiveEnhancement?.networkConditions || 'Not detected',
        loadingStrategy: loader?.loadingStrategy || 'Not determined',
        consoleLogs: console.history || 'Console history not available'
    };
    
    const blob = new Blob([JSON.stringify(errorData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vscode-ui-error-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Create standardized error screen (Enhanced version)
function createErrorScreen(title, message, actions = [], error = null) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'enhanced-error-screen';
    
    let errorDetails = '';
    if (error) {
        errorDetails = `
            <details style="margin: 1.5rem 0; text-align: left; background: var(--vscode-textCodeBlock-background, #2d2d30); border-radius: 6px; padding: 1rem;">
                <summary style="cursor: pointer; font-weight: 600; padding: 8px; color: var(--vscode-textLink-foreground, #4daafc);">Technical Details & Stack Trace</summary>
                <div style="margin-top: 1rem; font-family: 'Courier New', Consolas, monospace; font-size: 11px; line-height: 1.4; white-space: pre-wrap; background: var(--vscode-editor-background, #1e1e1e); padding: 12px; border-radius: 4px; overflow: auto; max-height: 300px; border: 1px solid var(--vscode-widget-border, #454545);">${error.message}\n\n${error.stack || ''}</div>
            </details>
        `;
    }
    
    const actionButtons = actions.map(action => 
        `<button onclick="(${action.action.toString()})()" style="
            background: var(--vscode-button-background, #0e639c); 
            color: var(--vscode-button-foreground, #ffffff); 
            border: none; 
            padding: 12px 20px; 
            margin: 6px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 14px; 
            font-weight: 500;
            transition: background-color 0.2s ease;
            min-width: 120px;
        " onmouseover="this.style.background='var(--vscode-button-hoverBackground, #1177bb)'" onmouseout="this.style.background='var(--vscode-button-background, #0e639c)'">${action.text}</button>`
    ).join('');
    
    errorContainer.innerHTML = `
        <div class="error-container">
            <div class="error-icon">⚠️</div>
            <h1 class="error-title">${title}</h1>
            <p class="error-message">${message}</p>
            ${errorDetails}
            <div class="error-actions">
                ${actionButtons}
            </div>
            <div class="error-footer">
                <p>VS Code Web Automation Tunnel</p>
                <p>If this problem persists, please check the browser console (F12) for additional information or try refreshing the page.</p>
            </div>
        </div>
    `;
    
    return errorContainer;
}

// Legacy Error Handling Functions (Updated for compatibility)

// Show timeout error screen (Legacy compatibility)
function showTimeoutError() {
    const errorScreen = createErrorScreen(
        'Initialization Timeout',
        'The UI failed to load within 30 seconds. This may be due to missing dependencies or network issues.',
        [
            { text: 'Retry', action: () => location.reload() },
            { text: 'Try Basic UI', action: () => { window.location.search = '?ui=basic'; location.reload(); } },
            { text: 'Debug Mode', action: () => { window.location.search = '?debug&ui=' + (window.webAutomationConfig.useEnhancedUI ? 'enhanced' : 'basic'); location.reload(); } }
        ]
    );
    document.body.appendChild(errorScreen);
}

// Show final error screen when both UIs fail (Legacy compatibility)
function showFinalErrorScreen(error) {
    const errorScreen = createErrorScreen(
        'Critical UI Failure',
        'Both Enhanced and Basic UIs failed to load. Please check the browser console for details.',
        [
            { text: 'Reload Page', action: () => location.reload() },
            { text: 'Report Issue', action: () => window.open('https://github.com/microsoft/vscode/issues/new', '_blank') }
        ],
        error
    );
    document.body.appendChild(errorScreen);
}

// Create standardized error screen (Legacy compatibility function)
function createLegacyErrorScreen(title, message, actions = [], error = null) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-screen';
    
    let errorDetails = '';
    if (error) {
        errorDetails = `
            <details style="margin: 1rem 0; text-align: left;">
                <summary>Technical Details</summary>
                <pre style="background: var(--vscode-textCodeBlock-background, #2d2d30); padding: 1rem; border-radius: 4px; overflow: auto; max-height: 200px; font-size: 12px; white-space: pre-wrap;">${error.message}\n${error.stack || ''}</pre>
            </details>
        `;
    }
    
    const actionButtons = actions.map(action => 
        `<button onclick="(${action.action.toString()})()" style="background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #ffffff); border: none; padding: 8px 16px; margin: 0 8px; border-radius: 2px; cursor: pointer; font-size: 14px;">${action.text}</button>`
    ).join('');
    
    errorContainer.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #cccccc); display: flex; align-items: center; justify-content: center; z-index: 10000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="max-width: 600px; padding: 2rem; text-align: center;">
                <h1 style="color: var(--vscode-errorForeground, #f14c4c); font-size: 24px; margin-bottom: 16px;">⚠️ ${title}</h1>
                <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">${message}</p>
                ${errorDetails}
                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap;">
                    ${actionButtons}
                </div>
                <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--vscode-widget-border, #454545); color: var(--vscode-descriptionForeground, #9d9d9d); font-size: 12px;">
                    <p>VS Code Web Automation Tunnel</p>
                    <p>If this problem persists, please check the browser console (F12) for additional information.</p>
                </div>
            </div>
        </div>
    `;
    
    return errorContainer;
}

// Export functions to window for global access
window.createTimeoutErrorScreen = createTimeoutErrorScreen;
window.createCriticalErrorScreen = createCriticalErrorScreen;
window.showRecoveryNotification = showRecoveryNotification;
window.downloadErrorLogs = downloadErrorLogs;
window.createErrorScreen = createErrorScreen;
window.showTimeoutError = showTimeoutError;
window.showFinalErrorScreen = showFinalErrorScreen;
window.createLegacyErrorScreen = createLegacyErrorScreen;