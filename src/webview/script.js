// Get reference to VSCode API
const vscode = (window.vscode || acquireVsCodeApi());

// Tab management
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Get UI elements
const startServerBtn = document.getElementById('startServerBtn');
const stopServerBtn = document.getElementById('stopServerBtn');
const openWebInterfaceBtn = document.getElementById('openWebInterfaceBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const errorMessage = document.getElementById('errorMessage');
const serverInfoSection = document.getElementById('serverInfoSection');
const clientsSection = document.getElementById('clientsSection');

// Server info elements
const serverStatus = document.getElementById('serverStatus');
const webInterfaceUrl = document.getElementById('webInterfaceUrl');
const publicUrl = document.getElementById('publicUrl');
const httpPort = document.getElementById('httpPort');
// websocketPort removed
const uptime = document.getElementById('uptime');
const clientCount = document.getElementById('clientCount');
const clientsList = document.getElementById('clientsList');

// Settings elements
const settingsForm = document.getElementById('settingsForm');
const httpPortInput = document.getElementById('httpPortInput');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const settingsMessage = document.getElementById('settingsMessage');

// Cloudflare elements
const startQuickTunnelBtn = document.getElementById('startQuickTunnelBtn');
const startNamedTunnelBtn = document.getElementById('startNamedTunnelBtn');
const stopTunnelBtn = document.getElementById('stopTunnelBtn');
const installCloudflaredBtn = document.getElementById('installCloudflaredBtn');
const copyTunnelUrlBtn = document.getElementById('copyTunnelUrlBtn');
const tunnelStatus = document.getElementById('tunnelStatus');
const tunnelUrl = document.getElementById('tunnelUrl');
const tunnelError = document.getElementById('tunnelError');

// Current server state
let currentServerState = {
    isRunning: false,
    isLoading: false
};

// Tab switching functionality
tabButtons.forEach(button => {
    button.addEventListener('click', function() {
        const tabName = this.getAttribute('data-tab');
        switchTab(tabName);
    });
});

// Keyboard navigation for tabs
tabButtons.forEach(button => {
    button.addEventListener('keydown', onTabKeydown);
});

function switchTab(tabName) {
    // Remove active class/selection from all buttons and contents
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to selected button and content
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.setAttribute('aria-selected', 'true');
    }
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Update tabindex for accessibility: only active tab is tabbable
    tabButtons.forEach(btn => {
        btn.setAttribute('tabindex', btn === activeBtn ? '0' : '-1');
    });
}

function onTabKeydown(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();

    const buttons = Array.from(tabButtons);
    const currentIndex = buttons.indexOf(document.activeElement);
    let newIndex = currentIndex;
    if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % buttons.length;
    if (e.key === 'ArrowLeft') newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    if (e.key === 'Home') newIndex = 0;
    if (e.key === 'End') newIndex = buttons.length - 1;

    const newTabName = buttons[newIndex].getAttribute('data-tab');
    switchTab(newTabName);
    buttons[newIndex].focus();
}

// Initialize tabs accessibility state for the default active tab
const initialActive = document.querySelector('.tab-button.active');
const initialTab = initialActive?.getAttribute('data-tab') || 'main';
switchTab(initialTab);

// Settings form handling
settingsForm.addEventListener('submit', function(e) {
    e.preventDefault();
    saveSettings();
});

resetSettingsBtn.addEventListener('click', function() {
    resetSettings();
});

function saveSettings() {
    const settings = {
        'webAutomationTunnel.httpPort': parseInt(httpPortInput.value) || 3900
    };
    vscode.postMessage({ command: 'updateConfiguration', data: settings });
}

function resetSettings() {
    vscode.postMessage({
        command: 'resetConfiguration'
    });
}

// Load current configuration
function loadConfiguration(config) {
    if (config) {
        httpPortInput.value = config.httpPort || 3900;
    }
}

// Show settings message
function showSettingsMessage(message, isError = false) {
    settingsMessage.textContent = message;
    settingsMessage.className = isError ? 'error-message' : 'success-message';
    settingsMessage.classList.remove('hidden');
    setTimeout(() => {
        settingsMessage.classList.add('hidden');
    }, 3000);
}

// Add click handlers for server control buttons
startServerBtn.addEventListener('click', function() {
    if (currentServerState.isLoading) return;

    setLoadingState(true, 'Starting server...');
    vscode.postMessage({
        command: 'startServer'
    });
});

stopServerBtn.addEventListener('click', function() {
    if (currentServerState.isLoading) return;

    setLoadingState(true, 'Stopping server...');
    vscode.postMessage({
        command: 'stopServer'
    });
});

// Open web interface button
openWebInterfaceBtn.addEventListener('click', function() {
    vscode.postMessage({
        command: 'openWebInterface'
    });
});

// Cloudflare buttons
startQuickTunnelBtn.addEventListener('click', function() {
    vscode.postMessage({ command: 'startTunnel', data: {} });
});
startNamedTunnelBtn.addEventListener('click', function() {
    // Let the extension prompt for name/token
    vscode.postMessage({ command: 'startTunnel', data: { mode: 'named' } });
});
stopTunnelBtn.addEventListener('click', function() {
    vscode.postMessage({ command: 'stopTunnel' });
});
installCloudflaredBtn.addEventListener('click', function() {
    vscode.postMessage({ command: 'installCloudflared' });
});
copyTunnelUrlBtn.addEventListener('click', function() {
    if (tunnelUrl.textContent && tunnelUrl.textContent !== '-') {
        vscode.postMessage({ command: 'copyToClipboard', data: { text: tunnelUrl.textContent } });
    }
});
// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;

    switch (message.command) {
        case 'serverStatusUpdate':
            updateServerStatus(message.data.status, message.data.clients);
            break;
        case 'statusUpdate':
            handleStatusUpdate(message.data);
            break;
        case 'configurationUpdate':
            // message.data contains { config, schema }
            loadConfiguration(message.data?.config);
            break;
        case 'tunnelStatusUpdate':
            // { publicUrl, isRunning, error }
            if (message.data?.error) {
                tunnelError.textContent = message.data.error;
                tunnelError.classList.remove('hidden');
            } else {
                tunnelError.classList.add('hidden');
            }
            if (message.data?.isRunning && message.data?.publicUrl) {
                tunnelStatus.textContent = 'Active';
                tunnelUrl.textContent = message.data.publicUrl;
                copyTunnelUrlBtn.disabled = false;
                stopTunnelBtn.disabled = false;
            } else {
                tunnelStatus.textContent = 'Inactive';
                tunnelUrl.textContent = '-';
                copyTunnelUrlBtn.disabled = true;
                stopTunnelBtn.disabled = true;
            }
            break;
        case 'configurationUpdated':
            showSettingsMessage('Settings saved successfully!');
            break;
        case 'configurationResetSuccess':
            showSettingsMessage('Settings reset to defaults!');
            break;
        case 'configurationError':
            showSettingsMessage(message.data.error, true);
            break;
        default:
            console.log('Unknown message from extension:', message);
            break;
    }
});

// Update server status display
function updateServerStatus(status, clients) {
    currentServerState.isRunning = status.isRunning;
    currentServerState.isLoading = false;

    // Update status indicator
    statusDot.className = 'status-dot ' + (status.isRunning ? 'running' : 'stopped');
    statusText.textContent = status.isRunning ? 'Server Running' : 'Server Stopped';

    // Update button states
    startServerBtn.disabled = status.isRunning;
    stopServerBtn.disabled = !status.isRunning;
    startServerBtn.innerHTML = '<span>▶</span> Start Server';
    stopServerBtn.innerHTML = '<span>⏹</span> Stop Server';

    // Update server information
    if (status.isRunning) {
        serverInfoSection.classList.remove('hidden');
        serverStatus.textContent = 'Running';
        webInterfaceUrl.textContent = status.webInterfaceUrl || `http://localhost:${status.httpPort || 3900}`;
        publicUrl.textContent = status.publicUrl || '-';
        httpPort.textContent = status.httpPort || '-';
        uptime.textContent = formatUptime(status.uptime);
        clientCount.textContent = status.connectedClients || 0;

        // Tunnel UI
        if (status.publicUrl) {
            tunnelStatus.textContent = 'Active';
            tunnelUrl.textContent = status.publicUrl;
            copyTunnelUrlBtn.disabled = false;
            stopTunnelBtn.disabled = false;
        } else {
            tunnelStatus.textContent = 'Inactive';
            tunnelUrl.textContent = '-';
            copyTunnelUrlBtn.disabled = true;
            stopTunnelBtn.disabled = true;
        }

        // Show clients section if there are connected clients
        if (status.connectedClients > 0) {
            clientsSection.classList.remove('hidden');
            updateClientsList(clients);
        } else {
            clientsSection.classList.add('hidden');
        }
    } else {
        serverInfoSection.classList.add('hidden');
        clientsSection.classList.add('hidden');
    }

    // Handle errors
    if (status.lastError) {
        showError(status.lastError);
    } else {
        hideError();
    }
}

// Handle status updates (loading states, errors)
function handleStatusUpdate(update) {
    switch (update.type) {
        case 'serverStarting':
            setLoadingState(true, 'Starting server...');
            break;
        case 'serverStopping':
            setLoadingState(true, 'Stopping server...');
            break;
        case 'serverError':
            setLoadingState(false);
            showError(update.error);
            break;
    }
}

// Set loading state for buttons
function setLoadingState(isLoading, message = '') {
    currentServerState.isLoading = isLoading;

    if (isLoading) {
        statusDot.className = 'status-dot loading';
        statusText.textContent = message;
        startServerBtn.disabled = true;
        stopServerBtn.disabled = true;
        startServerBtn.innerHTML = '<span>⏳</span> ' + message;
    }
}

// Update clients list
function updateClientsList(clients) {
    if (!clients || clients.length === 0) {
        clientsList.innerHTML = '<div class="client-item">No clients connected</div>';
        return;
    }

    const clientsHtml = clients.map(client => `
        <div class="client-item">
            <div class="client-id">${client.id}</div>
            <div class="client-time">Connected: ${formatTime(client.connectedAt)}</div>
        </div>
    `).join('');

    clientsList.innerHTML = clientsHtml;
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Format uptime in human readable format
function formatUptime(milliseconds) {
    if (!milliseconds) return '-';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

// Format time for display
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString();
}

// Handle keyboard events for accessibility
[startServerBtn, stopServerBtn, executeButton, openWebInterfaceBtn].forEach(button => {
    button.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            button.click();
        }
    });
});

// Request initial server status
vscode.postMessage({
    command: 'getServerStatus'
});

// Request initial configuration
vscode.postMessage({
    command: 'getConfiguration'
});

// Log that webview is ready
console.log('Web Automation Tunnel webview loaded and ready');
