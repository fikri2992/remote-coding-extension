/**
 * VS Code Web Automation Tunnel - Frontend Application
 */

class WebAutomationClient {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;

        this.initializeUI();
        this.connect();
    }

    /**
     * Initialize UI elements and event listeners
     */
    initializeUI() {
        // Get UI elements
        this.elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            serverUrl: document.getElementById('serverUrl'),
            websocketPort: document.getElementById('websocketPort'),
            connectedClients: document.getElementById('connectedClients'),
            uptime: document.getElementById('uptime'),
            commandInput: document.getElementById('commandInput'),
            argsInput: document.getElementById('argsInput'),
            executeButton: document.getElementById('executeButton'),
            activeEditor: document.getElementById('activeEditor'),
            workspaceFolders: document.getElementById('workspaceFolders'),
            openEditors: document.getElementById('openEditors'),
            messageLog: document.getElementById('messageLog'),
            clearLogButton: document.getElementById('clearLogButton')
        };

        // Set initial server URL
        this.elements.serverUrl.textContent = window.location.origin;

        // Add event listeners
        this.elements.executeButton.addEventListener('click', () => this.executeCommand());
        this.elements.clearLogButton.addEventListener('click', () => this.clearLog());
        
        // Add quick command button listeners
        document.querySelectorAll('.quick-cmd-btn').forEach(button => {
            button.addEventListener('click', () => {
                const command = button.getAttribute('data-command');
                if (command) {
                    this.executeQuickCommand(command);
                }
            });
        });

        // Allow Enter key to execute command
        this.elements.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.executeCommand();
            }
        });

        // Update uptime every second
        setInterval(() => this.updateUptime(), 1000);
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        try {
            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const port = parseInt(window.location.port) + 1; // WebSocket port is HTTP port + 1
            const wsUrl = `${protocol}//${window.location.hostname}:${port}`;

            this.elements.websocketPort.textContent = port;
            this.updateConnectionStatus('connecting', 'Connecting...');
            this.log('info', `Connecting to WebSocket: ${wsUrl}`);

            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => this.onWebSocketOpen();
            this.websocket.onmessage = (event) => this.onWebSocketMessage(event);
            this.websocket.onclose = (event) => this.onWebSocketClose(event);
            this.websocket.onerror = (error) => this.onWebSocketError(error);

        } catch (error) {
            this.log('error', `Failed to create WebSocket connection: ${error.message}`);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket connection open
     */
    onWebSocketOpen() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionTime = new Date();
        this.updateConnectionStatus('connected', 'Connected');
        this.elements.executeButton.disabled = false;
        this.log('success', 'WebSocket connection established');

        // Request initial server status
        this.sendMessage({
            type: 'status',
            id: this.generateId()
        });
    }

    /**
     * Handle WebSocket message
     */
    onWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            this.log('info', `Received: ${message.type}`, message);

            switch (message.type) {
                case 'response':
                    this.handleCommandResponse(message);
                    break;
                case 'broadcast':
                    this.handleBroadcast(message);
                    break;
                case 'status':
                    this.handleStatusUpdate(message);
                    break;
                default:
                    this.log('warning', `Unknown message type: ${message.type}`);
            }
        } catch (error) {
            this.log('error', `Failed to parse WebSocket message: ${error.message}`);
        }
    }

    /**
     * Handle WebSocket connection close
     */
    onWebSocketClose(event) {
        this.isConnected = false;
        this.elements.executeButton.disabled = true;

        if (event.wasClean) {
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.log('info', 'WebSocket connection closed cleanly');
        } else {
            this.updateConnectionStatus('disconnected', 'Connection lost');
            this.log('warning', `WebSocket connection lost (code: ${event.code})`);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle WebSocket error
     */
    onWebSocketError(error) {
        this.log('error', 'WebSocket error occurred');
        this.updateConnectionStatus('disconnected', 'Connection error');
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.updateConnectionStatus('disconnected', 'Connection failed');
            this.log('error', 'Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        this.updateConnectionStatus('connecting', `Reconnecting in ${delay / 1000}s...`);
        this.log('info', `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

        setTimeout(() => this.connect(), delay);
    }

    /**
     * Send message via WebSocket
     */
    sendMessage(message) {
        if (!this.isConnected || !this.websocket) {
            this.log('error', 'Cannot send message: WebSocket not connected');
            return false;
        }

        try {
            this.websocket.send(JSON.stringify(message));
            this.log('info', `Sent: ${message.type}`, message);
            return true;
        } catch (error) {
            this.log('error', `Failed to send message: ${error.message}`);
            return false;
        }
    }

    /**
     * Execute VS Code command
     */
    executeCommand() {
        const command = this.elements.commandInput.value.trim();
        if (!command) {
            this.log('warning', 'Please enter a command');
            return;
        }

        let args = [];
        const argsText = this.elements.argsInput.value.trim();
        if (argsText) {
            try {
                args = JSON.parse(argsText);
                if (!Array.isArray(args)) {
                    args = [args];
                }
            } catch (error) {
                this.log('error', `Invalid arguments JSON: ${error.message}`);
                return;
            }
        }

        this.sendCommandMessage(command, args);
    }

    /**
     * Execute a quick command
     */
    executeQuickCommand(command) {
        this.sendCommandMessage(command, []);
    }

    /**
     * Send command message via WebSocket
     */
    sendCommandMessage(command, args) {
        const message = {
            type: 'command',
            id: this.generateId(),
            command: command,
            args: args
        };

        if (this.sendMessage(message)) {
            this.log('info', `Executing command: ${command}`, args.length > 0 ? args : undefined);
        }
    }

    /**
     * Handle command response
     */
    handleCommandResponse(message) {
        if (message.error) {
            this.log('error', `Command failed: ${message.error}`);
        } else if (message.data) {
            // Handle different response formats
            if (message.data.success === false) {
                this.log('error', `Command failed: ${message.data.error || 'Unknown error'}`);
            } else if (message.data.success === true) {
                this.log('success', `Command executed successfully: ${message.data.command || 'unknown'}`, message.data.result);
            } else {
                this.log('success', 'Command executed successfully', message.data);
            }
        } else {
            this.log('success', 'Command executed successfully');
        }
    }

    /**
     * Handle broadcast message
     */
    handleBroadcast(message) {
        if (message.data) {
            // Handle different types of broadcast messages
            if (message.data.changeType === 'workspaceState' && message.data.data) {
                this.updateWorkspaceState(message.data.data);
            } else if (message.data.workspaceState) {
                // Fallback for direct workspace state
                this.updateWorkspaceState(message.data.workspaceState);
            }
            
            // Log the broadcast for debugging
            this.log('info', `Broadcast received: ${message.data.changeType || 'unknown'}`, message.data);
        }
    }

    /**
     * Handle status update
     */
    handleStatusUpdate(message) {
        if (message.data) {
            this.updateServerInfo(message.data);
            
            // Update workspace state if included
            if (message.data.workspaceState) {
                this.updateWorkspaceState(message.data.workspaceState);
            }
        }
    }

    /**
     * Update workspace state display
     */
    updateWorkspaceState(state) {
        // Update active editor
        if (state.activeEditor) {
            const editor = state.activeEditor;
            this.elements.activeEditor.textContent =
                `${editor.fileName} (${editor.language})\n` +
                `Lines: ${editor.lineCount}\n` +
                `Selection: ${editor.selection.start.line}:${editor.selection.start.character} - ${editor.selection.end.line}:${editor.selection.end.character}`;
        } else {
            this.elements.activeEditor.textContent = 'No active editor';
        }

        // Update workspace folders
        if (state.workspaceFolders && state.workspaceFolders.length > 0) {
            this.elements.workspaceFolders.textContent = state.workspaceFolders.join('\n');
        } else {
            this.elements.workspaceFolders.textContent = 'No workspace folders';
        }

        // Update open editors
        if (state.openEditors && state.openEditors.length > 0) {
            this.elements.openEditors.textContent = state.openEditors.join('\n');
        } else {
            this.elements.openEditors.textContent = 'No open editors';
        }
    }

    /**
     * Update server information display
     */
    updateServerInfo(serverStatus) {
        if (serverStatus.connectedClients !== undefined) {
            this.elements.connectedClients.textContent = serverStatus.connectedClients;
        }
        
        // Update server time if available
        if (serverStatus.serverTime) {
            this.serverStartTime = new Date(serverStatus.serverTime);
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status, text) {
        this.elements.statusIndicator.className = `status-indicator ${status}`;
        this.elements.statusText.textContent = text;
        
        // Enable/disable quick command buttons based on connection status
        const isConnected = status === 'connected';
        document.querySelectorAll('.quick-cmd-btn').forEach(button => {
            button.disabled = !isConnected;
        });
    }

    /**
     * Update uptime display
     */
    updateUptime() {
        if (this.isConnected && this.connectionTime) {
            const now = new Date();
            const uptimeMs = now.getTime() - this.connectionTime.getTime();
            const uptimeSeconds = Math.floor(uptimeMs / 1000);
            
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;
            
            if (hours > 0) {
                this.elements.uptime.textContent = `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                this.elements.uptime.textContent = `${minutes}m ${seconds}s`;
            } else {
                this.elements.uptime.textContent = `${seconds}s`;
            }
        } else {
            this.elements.uptime.textContent = this.isConnected ? 'Connected' : 'Disconnected';
        }
    }

    /**
     * Log message to the message log
     */
    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level}`;

        const timestampSpan = document.createElement('div');
        timestampSpan.className = 'log-timestamp';
        timestampSpan.textContent = timestamp;

        const messageSpan = document.createElement('div');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;

        logEntry.appendChild(timestampSpan);
        logEntry.appendChild(messageSpan);

        if (data) {
            const dataSpan = document.createElement('div');
            dataSpan.className = 'log-message';
            dataSpan.style.color = '#9cdcfe';
            dataSpan.style.fontSize = '12px';
            dataSpan.textContent = JSON.stringify(data, null, 2);
            logEntry.appendChild(dataSpan);
        }

        this.elements.messageLog.appendChild(logEntry);
        this.elements.messageLog.scrollTop = this.elements.messageLog.scrollHeight;

        // Keep only last 100 log entries
        while (this.elements.messageLog.children.length > 100) {
            this.elements.messageLog.removeChild(this.elements.messageLog.firstChild);
        }
    }

    /**
     * Clear message log
     */
    clearLog() {
        this.elements.messageLog.innerHTML = '';
        this.log('info', 'Log cleared');
    }

    /**
     * Generate unique ID for messages
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebAutomationClient();
});