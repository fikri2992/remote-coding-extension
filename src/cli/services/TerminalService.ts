import { TerminalSession } from './TerminalSession';
import { TerminalConfigManager } from './TerminalConfig';
import { TerminalSafetyManager } from './TerminalSafety';
import {
    TerminalSessionInfo,
    TerminalCommandOptions,
    TerminalExecutionOptions,
    TerminalExecutionResult,
    SendToClientFunction,
    TerminalOperationResult
} from './TerminalTypes';

export class TerminalSessionManager {
    private sessions: Map<string, TerminalSession> = new Map();
    private sessionsByClient: Map<string, Set<string>> = new Map();
    private configManager: TerminalConfigManager;
    private safetyManager: TerminalSafetyManager;
    private reapTimer?: NodeJS.Timeout | undefined;

    constructor(configManager: TerminalConfigManager) {
        this.configManager = configManager;
        this.safetyManager = new TerminalSafetyManager(configManager);
        this.startSessionReaper();
    }

    private startSessionReaper(): void {
        this.reapTimer = setInterval(() => {
            this.reapIdleSessions();
        }, 60000); // Check every minute
    }

    private reapIdleSessions(): void {
        const now = Date.now();
        const reapedSessions: string[] = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            const timeoutMs = session.persistent ?
                this.configManager.getIdleTimeout(true) :
                this.configManager.getIdleTimeout(false);

            if (now - session.lastActivity > timeoutMs) {
                this.configManager.log(`Reaping idle terminal session: ${sessionId}`, 'info');
                this.killSession(sessionId);
                reapedSessions.push(sessionId);
            }
        }

        if (reapedSessions.length > 0) {
            this.configManager.log(`Reaped ${reapedSessions.length} idle sessions`, 'info');
        }
    }

    async createSession(
        options: TerminalCommandOptions = {},
        clientId?: string
    ): Promise<{ sessionId: string; cwd: string }> {
        const sessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const cols = options.cols || 80;
        const rows = options.rows || 24;
        const cwd = this.safetyManager.getSafeWorkingDirectory(options.cwd);
        const persistent = options.persistent || false;
        const engineMode = options.engineMode || this.configManager.config.engineMode;

        const session = new TerminalSession(
            {
                sessionId,
                cols,
                rows,
                cwd,
                persistent,
                env: this.getEnhancedEnvironment(),
                engineMode
            },
            this.configManager,
            (clientId: string, message: any) => this.sendToClient(clientId, message)
        );

        this.sessions.set(sessionId, session);

        if (clientId) {
            if (!this.sessionsByClient.has(clientId)) {
                this.sessionsByClient.set(clientId, new Set());
            }
            this.sessionsByClient.get(clientId)!.add(sessionId);
        }

        this.configManager.log(`Created terminal session: ${sessionId} (persistent: ${persistent}, engine: ${engineMode})`, 'info');

        return { sessionId, cwd };
    }

    async executeCommand(
        command: string,
        options: TerminalCommandOptions = {},
        sendToClient: SendToClientFunction
    ): Promise<void> {
        const cwd = this.safetyManager.getSafeWorkingDirectory(options.cwd);
        const sessionId = options.sessionId || `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Send start event
        sendToClient(options.clientId || '', {
            type: 'terminal',
            data: {
                op: 'exec',
                sessionId,
                event: 'start',
                cwd
            }
        });

        // Execute command with safety validation
        const result = await this.safetyManager.executeCommandSafely(command, {
            cwd,
            timeout: options.timeout || 30000,
            env: this.getEnhancedEnvironment(),
            onOutput: (data: string, isStderr: boolean) => {
                sendToClient(options.clientId || '', {
                    type: 'terminal',
                    data: {
                        op: 'exec',
                        sessionId,
                        event: 'data',
                        channel: isStderr ? 'stderr' : 'stdout',
                        chunk: data
                    }
                });
            },
            onExit: (code, signal) => {
                sendToClient(options.clientId || '', {
                    type: 'terminal',
                    data: {
                        op: 'exec',
                        sessionId,
                        event: 'exit',
                        code,
                        signal,
                        done: true
                    }
                });
            }
        });

        if (!result.success) {
            sendToClient(options.clientId || '', {
                type: 'terminal',
                data: {
                    op: 'exec',
                    sessionId,
                    event: 'error',
                    error: result.error
                }
            });
        }
    }

    inputToSession(sessionId: string, data: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.configManager.log(`Session not found for input: ${sessionId}`, 'warn');
            return false;
        }

        session.input(data);
        session.updateActivity();
        return true;
    }

    resizeSession(sessionId: string, cols: number, rows: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.configManager.log(`Session not found for resize: ${sessionId}`, 'warn');
            return false;
        }

        session.resize(cols, rows);
        session.updateActivity();
        return true;
    }

    killSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.configManager.log(`Session not found for kill: ${sessionId}`, 'warn');
            return false;
        }

        // Remove from client mappings
        for (const [clientId, sessionIds] of this.sessionsByClient.entries()) {
            sessionIds.delete(sessionId);
            if (sessionIds.size === 0) {
                this.sessionsByClient.delete(clientId);
            }
        }

        session.kill();
        this.sessions.delete(sessionId);

        this.configManager.log(`Killed terminal session: ${sessionId}`, 'info');
        return true;
    }

    getSession(sessionId: string): TerminalSession | undefined {
        return this.sessions.get(sessionId);
    }

    listSessions(): TerminalSessionInfo[] {
        return Array.from(this.sessions.values()).map(session => session.getSessionInfo());
    }

    handleClientDisconnect(clientId: string): void {
        const sessionIds = this.sessionsByClient.get(clientId);
        if (sessionIds) {
            for (const sessionId of sessionIds) {
                const session = this.sessions.get(sessionId);
                if (session && !session.persistent) {
                    this.killSession(sessionId);
                } else if (session) {
                    // For persistent sessions, just remove the client association
                    sessionIds.delete(sessionId);
                }
            }

            if (sessionIds.size === 0) {
                this.sessionsByClient.delete(clientId);
            }
        }
    }

    private getEnhancedEnvironment(): NodeJS.ProcessEnv {
        const env = { ...process.env };

        // Inject AI credentials if enabled
        if (this.configManager.config.injectAICredentials) {
            const credentialManager = new (require('../../server/CredentialManager').CredentialManager)();
            Object.assign(env, credentialManager.getAllAICredentials());
        }

        // Set terminal type
        if (!env.TERM) {
            env.TERM = 'xterm-256color';
        }

        return env;
    }

    private sendToClient(clientId: string, message: any): boolean {
        // This will be overridden by the actual server implementation
        return true;
    }

    dispose(): void {
        if (this.reapTimer) {
            clearInterval(this.reapTimer);
            this.reapTimer = undefined;
        }

        // Kill all sessions
        for (const sessionId of this.sessions.keys()) {
            this.killSession(sessionId);
        }

        this.sessions.clear();
        this.sessionsByClient.clear();
    }

    getStats(): {
        totalSessions: number;
        persistentSessions: number;
        ephemeralSessions: number;
        activeSessions: number;
        idleSessions: number;
    } {
        const sessions = Array.from(this.sessions.values());
        const now = Date.now();

        let activeSessions = 0;
        let idleSessions = 0;

        for (const session of sessions) {
            const timeoutMs = session.persistent ?
                this.configManager.getIdleTimeout(true) :
                this.configManager.getIdleTimeout(false);

            if (now - session.lastActivity > timeoutMs) {
                idleSessions++;
            } else {
                activeSessions++;
            }
        }

        return {
            totalSessions: sessions.length,
            persistentSessions: sessions.filter(s => s.persistent).length,
            ephemeralSessions: sessions.filter(s => !s.persistent).length,
            activeSessions,
            idleSessions
        };
    }
}

// Main Terminal Service class that handles WebSocket operations
export class TerminalService {
  public sessionManager: TerminalSessionManager;
  private configManager: TerminalConfigManager;

    constructor(sendToClient: SendToClientFunction) {
        this.configManager = new TerminalConfigManager();
        this.sessionManager = new TerminalSessionManager(this.configManager);

        // Override the sendToClient function in session manager
        (this.sessionManager as any).sendToClient = sendToClient;
    }

    async handle(clientId: string, message: any): Promise<void> {
        const id: string | undefined = message.id;
        const data = (message?.data && (message.data.terminalData || message.data)) || {};
        const op: string | undefined = data.op || data.operation;

        if (this.configManager.config.enableDebug) {
            const payloadSize = JSON.stringify(message).length;
            this.configManager.log(`Terminal message: ${op} (client: ${clientId.substring(0, 8)}..., size: ${payloadSize})`, 'debug');
        }

        try {
            let result: TerminalOperationResult;

            switch (op) {
                case 'create':
                    const createResult = await this.sessionManager.createSession(data, clientId);
                    result = {
                        ok: true,
                        sessionId: createResult.sessionId,
                        cwd: createResult.cwd,
                        cols: data.cols || 80,
                        rows: data.rows || 24,
                        event: 'ready'
                    };
                    break;

                case 'exec':
                    await this.sessionManager.executeCommand(
                        data.command,
                        { ...data, clientId },
                        (clientId: string, msg: any) => this.sendToClient(clientId, msg)
                    );
                    return; // exec sends multiple messages, so we return early

                case 'input':
                    const inputSuccess = this.sessionManager.inputToSession(data.sessionId, data.data || data.chunk || '');
                    result = { ok: inputSuccess, op: 'input' };
                    if (!inputSuccess) {
                        result.error = 'Session not found';
                    }
                    break;

                case 'resize':
                    const resizeSuccess = this.sessionManager.resizeSession(data.sessionId, data.cols, data.rows);
                    result = { ok: resizeSuccess, op: 'resize', cols: data.cols, rows: data.rows };
                    if (!resizeSuccess) {
                        result.error = 'Session not found';
                    }
                    break;

                case 'dispose':
                    const disposeSuccess = this.sessionManager.killSession(data.sessionId);
                    result = { ok: disposeSuccess, op: 'dispose' };
                    if (!disposeSuccess) {
                        result.error = 'Session not found';
                    }
                    break;

                case 'keepalive':
                    const session = this.sessionManager.getSession(data.sessionId);
                    if (session) {
                        session.updateActivity();
                        result = { ok: true, op: 'keepalive' };
                    } else {
                        result = { ok: false, op: 'keepalive', error: 'Session not found' };
                    }
                    break;

                case 'list-sessions':
                    const sessions = this.sessionManager.listSessions();
                    result = { ok: true, op: 'list-sessions', sessions };
                    break;

                default:
                    result = { ok: false, error: `Unsupported terminal operation: ${op}` };
            }

            this.sendToClient(clientId, {
                type: 'terminal',
                id,
                data: result
            });

        } catch (error) {
            this.configManager.log(`Terminal operation error: ${op} - ${error}`, 'error');
            this.sendToClient(clientId, {
                type: 'terminal',
                id,
                data: {
                    ok: false,
                    op,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
        }
    }

    onClientDisconnect(clientId: string): void {
        this.sessionManager.handleClientDisconnect(clientId);
    }

    private sendToClient(clientId: string, message: any): boolean {
        // This will be provided by the server implementation
        return true;
    }

    dispose(): void {
        this.sessionManager.dispose();
    }

    getStats() {
        return this.sessionManager.getStats();
    }
}
