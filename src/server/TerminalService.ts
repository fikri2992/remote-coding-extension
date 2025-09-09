/**
 * TerminalService - PseudoTerminal session manager over WebSocket
 */

// VS Code is optional in CLI mode; access lazily when present
function getVSCode(): any | null {
  try { return require('vscode'); } catch { return null; }
}
import { spawn } from 'child_process';
import * as path from 'path';
import { CredentialManager } from './CredentialManager';
import { SessionEngine } from './pseudo/SessionEngine';

type SendFn = (clientId: string, message: any) => boolean;

type SessionWrapper = {
  sessionId: string;
  pty: { write: (d: string) => void; resize?: (c: number, r: number) => void; kill?: () => void; child?: any };
  clientId?: string | null;
  persistent: boolean;
  isFallback: boolean; // retained for protocol compatibility
  createdAt: number;
  lastActivity: number;
  outputBuffer: { chunk: string; timestamp: number }[];
};

export class TerminalService {
  private sendToClient: SendFn;
  private processesByClient: Map<string, Set<number>> = new Map();
  private sessions: Map<string, SessionWrapper> = new Map();
  private idleMsEphemeral = 15 * 60 * 1000;
  private idleMsPersistent = 30 * 60 * 1000;
  private credentialManager: CredentialManager;
  private debug = false;
  private pseudoEngine: SessionEngine;

  constructor(sendFn: SendFn) {
    this.sendToClient = sendFn;
    this.credentialManager = new CredentialManager();
    this.pseudoEngine = new SessionEngine();

    try {
      const vs = getVSCode();
      if (vs?.workspace?.getConfiguration) {
        const cfg = vs.workspace.getConfiguration('webAutomationTunnel');
        this.debug = !!((cfg.get('terminal.debug', false) as boolean) || process.env.KIRO_DEBUG_TERMINAL === '1');
      } else {
        this.debug = process.env.KIRO_DEBUG_TERMINAL === '1';
      }
    } catch {
      this.debug = process.env.KIRO_DEBUG_TERMINAL === '1';
    }
    if (this.debug) console.log('[TerminalService] Debug mode enabled');

    setInterval(() => {
      const now = Date.now();
      for (const [sid, sw] of this.sessions.entries()) {
        const idleMs = sw.persistent ? this.idleMsPersistent : this.idleMsEphemeral;
        const last = sw.lastActivity || sw.createdAt;
        if (now - last > idleMs) {
          if (this.debug) console.log(`[TerminalService] Reaping idle session ${sid} (persistent=${sw.persistent})`);
          try { sw.pty?.kill?.() } catch {}
          this.sessions.delete(sid);
        }
      }
    }, 60 * 1000);
  }

  async handle(clientId: string, message: any): Promise<void> {
    const id: string | undefined = message.id;
    const data = (message?.data && (message.data.terminalData || message.data)) || {};
    const op: string | undefined = data.op || data.operation;
    if (this.debug) {
      const payloadSize = JSON.stringify(message).length;
      console.log('[TerminalService] Message', { op, sessionId: data.sessionId, messageId: id, payloadSize });
    }
    switch (op) {
      case 'exec':
        await this.exec(clientId, id, data); break;
      case 'create':
        await this.create(clientId, id, data); break;
      case 'input':
        await this.input(clientId, id, data); break;
      case 'resize':
        await this.resize(clientId, id, data); break;
      case 'dispose':
        await this.dispose(clientId, id, data); break;
      case 'keepalive':
        await this.keepalive(clientId, id, data); break;
      case 'list-sessions':
        await this.listSessions(clientId, id); break;
      default:
        this.reply(clientId, id, { ok: false, error: `Unsupported terminal op: ${op}` });
    }
  }

  onClientDisconnect(clientId: string) {
    const pset = this.processesByClient.get(clientId);
    if (pset) {
      try { for (const pid of pset) { try { process.kill(pid); } catch {} } } finally { this.processesByClient.delete(clientId); }
    }
    for (const [sid, sw] of this.sessions.entries()) {
      if (!sw.persistent) { try { sw.pty?.kill?.() } catch {} this.sessions.delete(sid); }
      else { if (sw.clientId === clientId) sw.clientId = null; }
    }
  }

  private reply(clientId: string, id: string | undefined, payload: any) {
    const message = { type: 'terminal', id, data: payload };
    if (this.debug) {
      const payloadSize = JSON.stringify(message).length;
      console.log('[TerminalService] Response', { op: payload?.op || 'response', sessionId: payload?.sessionId, messageId: id, hasError: !!payload?.error, payloadSize });
    }
    this.sendToClient(clientId, message);
  }

  private getWorkspaceRoot(): string {
    const vs = getVSCode();
    try {
      const folders = vs?.workspace?.workspaceFolders;
      if (folders && folders.length > 0) return folders[0]!.uri.fsPath;
    } catch {}
    return process.cwd();
  }

  private async exec(clientId: string, id: string | undefined, data: any) {
    const cmdline: string = data.command || data.cmd || '';
    const sessionId: string = data.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cwdRaw: string | undefined = data.cwd;
    const cwd = cwdRaw ? (path.isAbsolute(cwdRaw) ? cwdRaw : path.join(this.getWorkspaceRoot(), cwdRaw)) : this.getWorkspaceRoot();
    if (!cmdline || typeof cmdline !== 'string') { this.reply(clientId, id, { op: 'exec', sessionId, ok: false, error: 'command is required' }); return; }
    const allowUnsafe = process.env.KIRO_EXEC_ALLOW_UNSAFE === '1';
    const allowed = new Set(['ls','dir','echo','git','npm','pnpm','yarn','node','python','pip','go','dotnet','cargo','bash','powershell','pwsh','cmd']);
    const first = String(cmdline).trim().split(/\s+/)[0]?.toLowerCase();
    if (!allowUnsafe && first && !allowed.has(first)) { this.reply(clientId, id, { op: 'exec', sessionId, ok: false, error: `Command '${first}' not in allowlist. Set KIRO_EXEC_ALLOW_UNSAFE=1 to override.` }); return; }
    this.reply(clientId, id, { op: 'exec', sessionId, event: 'start', cwd });
    const child = spawn(cmdline, { shell: true, cwd });
    let pset = this.processesByClient.get(clientId); if (!pset) { pset = new Set(); this.processesByClient.set(clientId, pset); }
    if (child.pid) pset.add(child.pid);
    child.stdout.on('data', (chunk: Buffer) => { const text = this.redact(chunk.toString('utf8')); this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'data', channel: 'stdout', chunk: text } }); });
    child.stderr.on('data', (chunk: Buffer) => { const text = this.redact(chunk.toString('utf8')); this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'data', channel: 'stderr', chunk: text } }); });
    child.on('close', (code, signal) => { this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'exit', code, signal, done: true } }); if (child.pid) { try { this.processesByClient.get(clientId)?.delete(child.pid); } catch {} } });
    child.on('error', (err) => { this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'error', error: err.message } }); if (child.pid) { try { this.processesByClient.get(clientId)?.delete(child.pid); } catch {} } });
  }

  private async create(clientId: string, id: string | undefined, data: any) {
    const sessionId: string = data.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cols: number = Number(data.cols || 80);
    const rows: number = Number(data.rows || 24);
    const cwdRaw: string | undefined = data.cwd;
    const cwd = cwdRaw ? (path.isAbsolute(cwdRaw) ? cwdRaw : path.join(this.getWorkspaceRoot(), cwdRaw)) : this.getWorkspaceRoot();
    const persistent: boolean = !!data.persistent;
    const vs = getVSCode();
    const cfg = vs?.workspace?.getConfiguration?.('webAutomationTunnel');
    const inject = (cfg?.get?.('terminal.injectAICredentials', false) as boolean | undefined) || process.env.KIRO_INJECT_AI_CREDS === '1';
    const enhancedEnv = ({ ...process.env } as NodeJS.ProcessEnv);
    if (inject) Object.assign(enhancedEnv, this.credentialManager.getAllAICredentials());
    if (!enhancedEnv.TERM) (enhancedEnv as any).TERM = 'xterm-256color';
    const engineMode = (cfg?.get?.('terminal.engineMode', 'auto') as string | undefined) || (process.env.KIRO_TERMINAL_ENGINE || 'line');
    const override = (process.env.KIRO_TERMINAL_ENGINE || '').toLowerCase();
    const requestedEngine = (String(data.engine || data.engineMode || '')).toLowerCase();
    const usePseudoPipe = requestedEngine === 'pipe' || engineMode === 'pipe' || override === 'pipe';

    let sw: SessionWrapper;
    const sink = (chunk: string) => {
      const text = this.redact(chunk);
      if (sw?.clientId) {
        const sent = this.sendToClient(sw.clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: text } });
        if (!sent) {
          sw.outputBuffer.push({ chunk: text, timestamp: Date.now() });
          if (sw.outputBuffer.length > 1000) sw.outputBuffer = sw.outputBuffer.slice(-800);
        }
      }
    };
    const promptEnabled = (cfg?.get?.('terminal.prompt.enabled', true) as boolean | undefined) ?? true;
    const hiddenEchoEnabled = (cfg?.get?.('terminal.hiddenEcho.enabled', true) as boolean | undefined) ?? true;
    this.pseudoEngine.create(sessionId, { cwd, env: enhancedEnv, mode: usePseudoPipe ? 'pipe' : 'line', interceptClear: true, promptEnabled, hiddenEchoEnabled }, sink);
    if (usePseudoPipe) { try { (this.pseudoEngine as any).startPipeShell?.(sessionId) } catch {} }
    const wrapper = {
      write: (d: string) => { try { this.pseudoEngine.input(sessionId, d); } catch {} },
      resize: (_c: number, _r: number) => { try { this.pseudoEngine.resize(sessionId, _c, _r); } catch {} },
      kill: () => { try { this.pseudoEngine.dispose(sessionId); } catch {} },
    } as any;
    sw = { sessionId, pty: wrapper, clientId, persistent, isFallback: false, createdAt: Date.now(), lastActivity: Date.now(), outputBuffer: [] };
    this.sessions.set(sessionId, sw);
    this.reply(clientId, id, { op: 'create', ok: true, sessionId, cwd, cols, rows, event: 'ready', note: 'pseudo-terminal', engine: usePseudoPipe ? 'pipe' : 'line', persistent, availableProviders: this.credentialManager.getAvailableAIProviders() });
    return;
  }

  private async input(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const sw = this.sessions.get(sid);
    if (!sw) { this.reply(clientId, id, { op: 'input', ok: false, error: 'invalid session' }); return; }
    let text: string = data.data || data.chunk || '';
    try {
      if (sw.persistent) {
        sw.clientId = clientId;
        if (sw.outputBuffer.length > 0) {
          for (const b of sw.outputBuffer) this.sendToClient(clientId, { type: 'terminal', data: { op: 'data', sessionId: sid, chunk: b.chunk } });
          sw.outputBuffer = [];
        }
      }
      const pty = sw.pty;
      if (typeof pty.write === 'function') pty.write(text);
      else if (pty.child?.stdin && typeof pty.child.stdin.write === 'function') pty.child.stdin.write(text);
    } catch {}
    sw.lastActivity = Date.now();
    this.reply(clientId, id, { op: 'input', ok: true });
  }

  private async resize(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const cols: number = Number(data.cols || 80);
    const rows: number = Number(data.rows || 24);
    const sw = this.sessions.get(sid);
    if (!sw) { this.reply(clientId, id, { op: 'resize', ok: false, error: 'invalid session' }); return; }
    if (this.debug) console.log('[TerminalService] Resize', { client: clientId.substring(0, 8) + '...', cols, rows });
    try {
      if (typeof sw.pty.resize === 'function') sw.pty.resize(cols, rows);
      sw.lastActivity = Date.now();
      this.reply(clientId, id, { op: 'resize', ok: true, cols, rows, note: 'pseudo' });
    } catch (err) {
      this.reply(clientId, id, { op: 'resize', ok: false, error: (err as Error).message });
    }
  }

  private async dispose(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const sw = this.sessions.get(sid);
    if (!sw) { this.reply(clientId, id, { op: 'dispose', ok: false, error: 'invalid session' }); return; }
    if (this.debug) console.log('[TerminalService] Dispose', { client: clientId.substring(0, 8) + '...', persistent: sw.persistent });
    try { if (typeof sw.pty.kill === 'function') sw.pty.kill(); else if (sw.pty.child?.kill) sw.pty.child.kill(); this.sessions.delete(sid); this.reply(clientId, id, { op: 'dispose', ok: true }); }
    catch (err) { this.reply(clientId, id, { op: 'dispose', ok: false, error: (err as Error).message }); }
  }

  private async keepalive(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const sw = sid ? this.sessions.get(sid) : undefined;
    if (sw) { sw.lastActivity = Date.now(); this.reply(clientId, id, { op: 'keepalive', ok: true }); }
    else { this.reply(clientId, id, { op: 'keepalive', ok: false, error: 'invalid session' }); }
  }

  private async listSessions(clientId: string, id: string | undefined) {
    const sessions = Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      persistent: s.persistent,
      status: 'active',
      lastActivity: s.lastActivity,
      createdAt: s.createdAt,
      availableProviders: this.credentialManager.getAvailableAIProviders(),
    }));
    this.reply(clientId, id, { op: 'list-sessions', ok: true, sessions });
  }

  private redact(text: string): string {
    try {
      let t = text;
      t = t.replace(/ghp_[A-Za-z0-9]{20,}/g, '***');
      t = t.replace(/sk-[A-Za-z0-9]{20,}/g, '***');
      t = t.replace(/AKIA[0-9A-Z]{16}/g, '***');
      t = t.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');
      t = t.replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '***');
      t = t.replace(/[A-Fa-f0-9]{32,}/g, (m) => (m.length >= 32 ? '***' : m));
      return t;
    } catch {
      return text;
    }
  }
}
