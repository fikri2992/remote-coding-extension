/**
 * Terminal Component - Terminal interface for command execution
 */

import { Component } from './base/Component.js';

export class Terminal extends Component {
    constructor(options) {
        super(options);
        
        this.stateManager = options.stateManager;
        this.webSocketClient = options.webSocketClient;
        this.notificationService = options.notificationService;
        this.animationService = options.animationService;
        this.keyboardShortcutService = options.keyboardShortcutService;
        
        // Terminal state
        this.history = [];
        this.historyIndex = -1;
        this.currentPath = '~';
        this.isConnected = false;
        this.commandBuffer = '';
        
        // Terminal elements
        this.terminalOutput = null;
        this.commandInput = null;
        this.promptElement = null;
        
        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleCommand = this.handleCommand.bind(this);
        this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    }

    async initialize() {
        await super.initialize();
        this.render();
        this.setupEventListeners();
        this.subscribeToWebSocket();
        this.registerKeyboardShortcuts();
        
        // Focus input when component is initialized
        setTimeout(() => {
            this.focusInput();
        }, 100);
    }

    render() {
        this.element = this.createElement('div', {}, ['terminal-container']);
        
        this.element.innerHTML = `
            <div class="terminal-header">
                <div class="terminal-title">
                    <span class="terminal-icon">⚡</span>
                    <span class="terminal-title-text">Terminal</span>
                </div>
                <div class="terminal-actions">
                    <button class="terminal-action-btn" id="clearBtn" title="Clear Terminal (Ctrl+L)">
                        <span class="icon">🗑️</span>
                    </button>
                    <button class="terminal-action-btn" id="connectBtn" title="Connect to WebSocket">
                        <span class="icon">🔌</span>
                    </button>
                    <button class="terminal-action-btn" id="settingsBtn" title="Terminal Settings">
                        <span class="icon">⚙️</span>
                    </button>
                </div>
            </div>
            
            <div class="terminal-body">
                <div class="terminal-output" id="terminalOutput">
                    <div class="terminal-welcome">
                        <div class="welcome-line">VS Code Terminal Interface</div>
                        <div class="welcome-line">Type 'help' for available commands</div>
                        <div class="welcome-line">---</div>
                    </div>
                </div>
                
                <div class="terminal-input-container">
                    <div class="terminal-prompt" id="terminalPrompt">
                        <span class="prompt-path">${this.currentPath}</span>
                        <span class="prompt-symbol">$</span>
                    </div>
                    <input type="text" 
                           class="terminal-input" 
                           id="terminalInput"
                           placeholder="Enter command..."
                           autocomplete="off"
                           spellcheck="false">
                </div>
            </div>
            
            <div class="terminal-status">
                <div class="status-indicator ${this.isConnected ? 'connected' : 'disconnected'}" 
                     id="connectionStatus">
                    <span class="status-dot"></span>
                    <span class="status-text">${this.isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <div class="terminal-info">
                    <span class="history-count">${this.history.length} commands in history</span>
                </div>
            </div>
        `;
        
        this.container.appendChild(this.element);
        
        // Get element references
        this.terminalOutput = this.querySelector('#terminalOutput');
        this.commandInput = this.querySelector('#terminalInput');
        this.promptElement = this.querySelector('#terminalPrompt');
        this.connectionStatus = this.querySelector('#connectionStatus');
        this.clearBtn = this.querySelector('#clearBtn');
        this.connectBtn = this.querySelector('#connectBtn');
        this.settingsBtn = this.querySelector('#settingsBtn');
    }

    setupEventListeners() {
        // Command input handlers
        this.addEventListener(this.commandInput, 'keydown', this.handleKeyDown);
        this.addEventListener(this.commandInput, 'input', this.handleInput);
        
        // Action button handlers
        this.addEventListener(this.clearBtn, 'click', this.clearTerminal);
        this.addEventListener(this.connectBtn, 'click', this.toggleConnection);
        this.addEventListener(this.settingsBtn, 'click', this.showSettings);
        
        // Auto-scroll to bottom when new content is added
        this.setupAutoScroll();
    }

    handleKeyDown(event) {
        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                this.handleCommand();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.navigateHistory(-1);
                break;
                
            case 'ArrowDown':
                event.preventDefault();
                this.navigateHistory(1);
                break;
                
            case 'Tab':
                event.preventDefault();
                this.handleTabCompletion();
                break;
                
            case 'l':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.clearTerminal();
                }
                break;
                
            case 'c':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.handleInterrupt();
                }
                break;
        }
    }

    handleInput(event) {
        this.commandBuffer = event.target.value;
    }

    async handleCommand() {
        const command = this.commandInput.value.trim();
        if (!command) return;
        
        // Add command to history
        this.history.push(command);
        this.historyIndex = this.history.length;
        
        // Display command in output
        this.addOutputLine(`${this.currentPath}$ ${command}`, 'command');
        
        // Clear input
        this.commandInput.value = '';
        this.commandBuffer = '';
        
        // Process command
        await this.processCommand(command);
        
        // Update history count
        this.updateStatusInfo();
    }

    async processCommand(command) {
        const args = command.split(' ');
        const cmd = args[0].toLowerCase();
        
        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
                
            case 'clear':
                this.clearTerminal();
                break;
                
            case 'history':
                this.showHistory();
                break;
                
            case 'connect':
                await this.connectWebSocket();
                break;
                
            case 'disconnect':
                this.disconnectWebSocket();
                break;
                
            case 'status':
                this.showStatus();
                break;
                
            case 'echo':
                this.addOutputLine(args.slice(1).join(' '), 'output');
                break;
                
            case 'pwd':
                this.addOutputLine(this.currentPath, 'output');
                break;
                
            case 'whoami':
                this.addOutputLine('vscode-user', 'output');
                break;
                
            case 'date':
                this.addOutputLine(new Date().toString(), 'output');
                break;
                
            case 'uptime':
                const uptime = Math.floor((Date.now() - window.startTime) / 1000);
                this.addOutputLine(`System uptime: ${uptime} seconds`, 'output');
                break;
                
            default:
                if (this.isConnected && this.webSocketClient) {
                    // Send command via WebSocket
                    this.sendCommand(command);
                } else {
                    this.addOutputLine(`Command not found: ${cmd}`, 'error');
                    this.addOutputLine('Type "help" for available commands', 'info');
                }
                break;
        }
    }

    showHelp() {
        const helpText = [
            'Available Commands:',
            '  help          - Show this help message',
            '  clear         - Clear terminal output',
            '  history       - Show command history',
            '  connect       - Connect to WebSocket server',
            '  disconnect    - Disconnect from WebSocket server',
            '  status        - Show connection and system status',
            '  echo <text>   - Echo text to output',
            '  pwd           - Show current directory',
            '  whoami        - Show current user',
            '  date          - Show current date and time',
            '  uptime        - Show system uptime',
            '',
            'Keyboard Shortcuts:',
            '  Ctrl+L        - Clear terminal',
            '  Ctrl+C        - Interrupt current command',
            '  Up/Down       - Navigate command history',
            '  Tab           - Command completion (when available)',
            ''
        ];
        
        helpText.forEach(line => this.addOutputLine(line, 'info'));
    }

    showHistory() {
        if (this.history.length === 0) {
            this.addOutputLine('No commands in history', 'info');
            return;
        }
        
        this.addOutputLine('Command History:', 'info');
        this.history.forEach((cmd, index) => {
            this.addOutputLine(`  ${index + 1}: ${cmd}`, 'output');
        });
    }

    showStatus() {
        const status = [
            `Connection: ${this.isConnected ? 'Connected' : 'Disconnected'}`,
            `Current Path: ${this.currentPath}`,
            `Commands in History: ${this.history.length}`,
            `WebSocket Client: ${this.webSocketClient ? 'Available' : 'Not Available'}`,
            `Browser: ${navigator.userAgent.split(' ')[0]}`,
            `Timestamp: ${new Date().toISOString()}`
        ];
        
        status.forEach(line => this.addOutputLine(line, 'info'));
    }

    navigateHistory(direction) {
        if (this.history.length === 0) return;
        
        this.historyIndex += direction;
        
        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length;
            this.commandInput.value = '';
            return;
        }
        
        this.commandInput.value = this.history[this.historyIndex] || '';
    }

    handleTabCompletion() {
        // Basic tab completion for built-in commands
        const currentInput = this.commandInput.value;
        const commands = ['help', 'clear', 'history', 'connect', 'disconnect', 'status', 'echo', 'pwd', 'whoami', 'date', 'uptime'];
        
        const matches = commands.filter(cmd => cmd.startsWith(currentInput));
        
        if (matches.length === 1) {
            this.commandInput.value = matches[0] + ' ';
        } else if (matches.length > 1) {
            this.addOutputLine('Available completions:', 'info');
            matches.forEach(match => this.addOutputLine(`  ${match}`, 'output'));
        }
    }

    handleInterrupt() {
        this.addOutputLine('^C', 'interrupt');
        this.commandInput.value = '';
        this.commandBuffer = '';
    }

    addOutputLine(text, type = 'output') {
        const line = this.createElement('div', {}, [`terminal-line`, `line-${type}`]);
        
        if (type === 'command') {
            line.innerHTML = `<span class="line-prompt">${this.currentPath}$</span> <span class="line-text">${text.substring(text.indexOf('$') + 1).trim()}</span>`;
        } else {
            line.textContent = text;
        }
        
        // Add timestamp for non-command lines
        if (type !== 'command') {
            const timestamp = this.createElement('span', {}, ['line-timestamp']);
            timestamp.textContent = new Date().toLocaleTimeString();
            line.appendChild(timestamp);
        }
        
        this.terminalOutput.appendChild(line);
        
        // Auto-scroll to bottom
        this.scrollToBottom();
        
        // Add fade-in animation
        if (this.animationService) {
            this.animationService.animate(line, 'fadeIn', { duration: 200 });
        }
    }

    clearTerminal() {
        const welcomeMessage = this.terminalOutput.querySelector('.terminal-welcome');
        this.terminalOutput.innerHTML = '';
        if (welcomeMessage) {
            this.terminalOutput.appendChild(welcomeMessage);
        }
        
        this.addOutputLine('Terminal cleared', 'info');
        this.focusInput();
    }

    setupAutoScroll() {
        // Create intersection observer to auto-scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    this.scrollToBottom();
                }
            });
        });
        
        // Observe the last line for auto-scroll
        const observeLastLine = () => {
            const lastLine = this.terminalOutput.lastElementChild;
            if (lastLine) {
                observer.observe(lastLine);
            }
        };
        
        // Monitor new lines being added
        new MutationObserver(observeLastLine).observe(this.terminalOutput, {
            childList: true
        });
    }

    scrollToBottom() {
        this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
    }

    subscribeToWebSocket() {
        if (this.webSocketClient) {
            this.webSocketClient.on('message', this.handleWebSocketMessage);
            this.webSocketClient.on('connect', () => {
                this.isConnected = true;
                this.updateConnectionStatus();
                this.addOutputLine('WebSocket connected', 'success');
            });
            this.webSocketClient.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus();
                this.addOutputLine('WebSocket disconnected', 'warning');
            });
        }
    }

    handleWebSocketMessage(message) {
        if (message.type === 'terminal-output') {
            this.addOutputLine(message.data, 'output');
        } else if (message.type === 'terminal-error') {
            this.addOutputLine(message.data, 'error');
        } else if (message.type === 'terminal-prompt') {
            this.currentPath = message.path || this.currentPath;
            this.updatePrompt();
        }
    }

    sendCommand(command) {
        if (this.webSocketClient && this.isConnected) {
            this.webSocketClient.send({
                type: 'terminal-command',
                command: command,
                timestamp: Date.now()
            });
        } else {
            this.addOutputLine('Not connected to WebSocket server', 'error');
        }
    }

    async connectWebSocket() {
        if (this.webSocketClient) {
            try {
                await this.webSocketClient.connect();
                this.addOutputLine('Attempting to connect to WebSocket...', 'info');
            } catch (error) {
                this.addOutputLine(`Connection failed: ${error.message}`, 'error');
            }
        } else {
            this.addOutputLine('WebSocket client not available', 'error');
        }
    }

    disconnectWebSocket() {
        if (this.webSocketClient) {
            this.webSocketClient.disconnect();
            this.addOutputLine('Disconnecting from WebSocket...', 'info');
        }
    }

    toggleConnection() {
        if (this.isConnected) {
            this.disconnectWebSocket();
        } else {
            this.connectWebSocket();
        }
    }

    showSettings() {
        this.addOutputLine('Terminal settings not yet implemented', 'info');
        // TODO: Implement settings modal
    }

    updateConnectionStatus() {
        if (this.connectionStatus) {
            this.connectionStatus.className = `status-indicator ${this.isConnected ? 'connected' : 'disconnected'}`;
            const statusText = this.connectionStatus.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = this.isConnected ? 'Connected' : 'Disconnected';
            }
        }
    }

    updatePrompt() {
        if (this.promptElement) {
            const pathElement = this.promptElement.querySelector('.prompt-path');
            if (pathElement) {
                pathElement.textContent = this.currentPath;
            }
        }
    }

    updateStatusInfo() {
        const historyCount = this.querySelector('.history-count');
        if (historyCount) {
            historyCount.textContent = `${this.history.length} commands in history`;
        }
    }

    registerKeyboardShortcuts() {
        if (this.keyboardShortcutService) {
            this.keyboardShortcutService.register('terminal', [
                {
                    key: 'Ctrl+L',
                    description: 'Clear terminal',
                    handler: () => this.clearTerminal()
                },
                {
                    key: 'Ctrl+T',
                    description: 'Focus terminal input',
                    handler: () => this.focusInput()
                }
            ]);
        }
    }

    focusInput() {
        if (this.commandInput) {
            this.commandInput.focus();
        }
    }

    destroy() {
        // Unregister keyboard shortcuts
        if (this.keyboardShortcutService) {
            this.keyboardShortcutService.unregister('terminal');
        }
        
        // Disconnect WebSocket listeners
        if (this.webSocketClient) {
            this.webSocketClient.off('message', this.handleWebSocketMessage);
        }
        
        super.destroy();
    }
}