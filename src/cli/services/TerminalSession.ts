import { SessionEngine } from '../../server/pseudo/SessionEngine';
import { CredentialManager } from '../../server/CredentialManager';
import { TerminalConfigManager } from './TerminalConfig';
import { TerminalSessionOptions, TerminalSessionInfo, SendToClientFunction } from './TerminalTypes';

export class TerminalSession {
    public sessionId: string;
    public persistent: boolean;
    public createdAt: number;
    public lastActivity: number;
    public outputBuffer: { chunk: string; timestamp: number }[];
    public cwd: string;
    public cols: number;
    public rows: number;
    public engineMode: 'line' | 'pipe';

    private pty: any;
    private configManager: TerminalConfigManager;
    private credentialManager: CredentialManager;
    private sessionEngine: SessionEngine;
    private sendToClient: SendToClientFunction;

    constructor(
        private options: TerminalSessionOptions,
        configManager: TerminalConfigManager,
        sendToClient: SendToClientFunction
    ) {
        this.sessionId = options.sessionId;
        this.persistent = options.persistent;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.outputBuffer = [];
        this.cwd = options.cwd;
        this.cols = options.cols;
        this.rows = options.rows;
        this.engineMode = configManager.getEngineMode(options.engineMode);
        this.configManager = configManager;
        this.sendToClient = sendToClient;
        this.credentialManager = new CredentialManager();
        this.sessionEngine = new SessionEngine();

        this.initializeSession();
    }

    private initializeSession(): void {
        const sink = (chunk: string) => {
            const text = this.redactSensitiveData(chunk);
            this.outputBuffer.push({ chunk: text, timestamp: Date.now() });

            // Limit buffer size
            if (this.outputBuffer.length > 1000) {
                this.outputBuffer = this.outputBuffer.slice(-800);
            }
        };

        // Create pseudo-terminal session
        this.sessionEngine.create(this.sessionId, {
            cwd: this.cwd,
            env: this.getEnhancedEnvironment(),
            mode: this.engineMode,
            interceptClear: true,
            promptEnabled: this.configManager.config.enablePrompt,
            hiddenEchoEnabled: this.configManager.config.enableHiddenEcho
        }, sink);

        // Start the appropriate engine
        if (this.engineMode === 'pipe') {
            try {
                (this.sessionEngine as any).startPipeShell?.(this.sessionId);
            } catch (error) {
                this.configManager.log(`Failed to start pipe shell for session ${this.sessionId}: ${error}`, 'error');
            }
        }

        // Create PTY wrapper
        this.pty = {
            write: (data: string) => {
                try {
                    this.sessionEngine.input(this.sessionId, data);
                    this.lastActivity = Date.now();
                } catch (error) {
                    this.configManager.log(`Failed to write to session ${this.sessionId}: ${error}`, 'error');
                }
            },
            resize: (cols: number, rows: number) => {
                try {
                    this.sessionEngine.resize(this.sessionId, cols, rows);
                    this.lastActivity = Date.now();
                } catch (error) {
                    this.configManager.log(`Failed to resize session ${this.sessionId}: ${error}`, 'error');
                }
            },
            kill: () => {
                try {
                    this.sessionEngine.dispose(this.sessionId);
                } catch (error) {
                    this.configManager.log(`Failed to kill session ${this.sessionId}: ${error}`, 'error');
                }
            }
        };
    }

    private getEnhancedEnvironment(): NodeJS.ProcessEnv {
        const env = { ...this.options.env };

        // Inject AI credentials if enabled
        if (this.configManager.config.injectAICredentials) {
            Object.assign(env, this.credentialManager.getAllAICredentials());
        }

        // Set terminal type
        if (!env.TERM) {
            env.TERM = 'xterm-256color';
        }

        return env;
    }

    private redactSensitiveData(text: string): string {
        if (!this.configManager.config.enableRedaction) return text;

        try {
            let redacted = text;

            // GitHub personal access tokens
            redacted = redacted.replace(/ghp_[A-Za-z0-9]{20,}/g, '***');

            // OpenAI API keys
            redacted = redacted.replace(/sk-[A-Za-z0-9]{20,}/g, '***');

            // AWS access keys
            redacted = redacted.replace(/AKIA[0-9A-Z]{16}/g, '***');

            // Bearer tokens
            redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');

            // JWT tokens
            redacted = redacted.replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '***');

            // Long hex strings (potential secrets)
            redacted = redacted.replace(/[A-Fa-f0-9]{32,}/g, (match) =>
                match.length >= 32 ? '***' : match
            );

            return redacted;
        } catch (error) {
            this.configManager.log('Failed to redact sensitive data:', 'warn');
            return text;
        }
    }

    input(data: string): void {
        this.pty.write(data);
    }

    resize(cols: number, rows: number): void {
        this.cols = cols;
        this.rows = rows;
        this.pty.resize(cols, rows);
    }

    kill(): void {
        this.pty.kill();
    }

    isIdle(timeoutMs: number): boolean {
        return (Date.now() - this.lastActivity) > timeoutMs;
    }

    getStatus(): { status: 'active' | 'idle' | 'dead'; lastActivity: number } {
        const now = Date.now();
        const idleTime = now - this.lastActivity;
        const timeoutMs = this.persistent ?
            this.configManager.getIdleTimeout(true) :
            this.configManager.getIdleTimeout(false);

        return {
            status: idleTime > timeoutMs ? 'idle' : 'active',
            lastActivity: this.lastActivity
        };
    }

    getSessionInfo(): TerminalSessionInfo {
        const status = this.getStatus();
        return {
            sessionId: this.sessionId,
            persistent: this.persistent,
            status: status.status,
            lastActivity: this.lastActivity,
            createdAt: this.createdAt,
            cwd: this.cwd,
            cols: this.cols,
            rows: this.rows,
            engineMode: this.engineMode,
            availableProviders: this.credentialManager.getAvailableAIProviders()
        };
    }

    getOutputBuffer(): { chunk: string; timestamp: number }[] {
        return [...this.outputBuffer];
    }

    clearOutputBuffer(): void {
        this.outputBuffer = [];
    }

    updateActivity(): void {
        this.lastActivity = Date.now();
    }
}
