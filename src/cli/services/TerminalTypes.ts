import { TerminalServiceConfig } from './TerminalConfig';

export interface TerminalSessionOptions {
    sessionId: string;
    cols: number;
    rows: number;
    cwd: string;
    persistent: boolean;
    env: NodeJS.ProcessEnv;
    engineMode: 'auto' | 'line' | 'pipe';
}

export interface TerminalSessionInfo {
    sessionId: string;
    persistent: boolean;
    status: 'active' | 'idle' | 'dead';
    lastActivity: number;
    createdAt: number;
    cwd: string;
    cols: number;
    rows: number;
    engineMode: 'line' | 'pipe';
    availableProviders?: string[];
}

export interface TerminalOperationResult {
  ok: boolean;
  op?: string;
  sessionId?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  error?: string;
  event?: string;
  code?: number;
  signal?: NodeJS.Signals | null;
  done?: boolean;
  sessions?: TerminalSessionInfo[];
}

export interface TerminalMessage {
    type: 'terminal';
    id?: string;
    data: TerminalOperationResult | {
        op: string;
        sessionId?: string;
        event?: string;
        chunk?: string;
        channel?: 'stdout' | 'stderr';
        command?: string;
        cwd?: string;
        cols?: number;
        rows?: number;
        persistent?: boolean;
        engineMode?: string;
        error?: string;
    };
}

export interface TerminalCommandOptions {
    cols?: number;
    rows?: number;
    cwd?: string;
    persistent?: boolean;
    engineMode?: 'auto' | 'line' | 'pipe';
    timeout?: number;
    clientId?: string;
    sessionId?: string;
}

export interface TerminalExecutionOptions {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
    onOutput?: (data: string, isStderr: boolean) => void;
    onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface TerminalExecutionResult {
    success: boolean;
    output?: string;
    error?: string;
    code?: number;
    signal?: NodeJS.Signals | null;
}

export type SendToClientFunction = (clientId: string, message: any) => boolean;

export interface SessionEngineMode {
    mode: 'line' | 'pipe';
    interceptClear: boolean;
    promptEnabled: boolean;
    hiddenEchoEnabled: boolean;
}

export interface TerminalSafetyValidation {
    valid: boolean;
    reason?: string;
}
