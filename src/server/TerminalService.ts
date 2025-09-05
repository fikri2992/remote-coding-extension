/**
 * TerminalService - Stage 1 Command Runner over WebSocket
 */

import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
let nodePty: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodePty = require('node-pty');
} catch (_) {
  nodePty = null;
}

type SendFn = (clientId: string, message: any) => boolean;

export class TerminalService {
  private sendToClient: SendFn;
  private processesByClient: Map<string, Set<number>> = new Map();
  private sessions: Map<string, any> = new Map(); // sessionId -> pty
  private sessionLastSeen: Map<string, number> = new Map();
  private idleMs: number = 15 * 60 * 1000; // 15 minutes

  constructor(sendFn: SendFn) {
    this.sendToClient = sendFn;
    // Idle reaper for PTY sessions
    setInterval(() => {
      const now = Date.now();
      for (const [sid, pty] of this.sessions.entries()) {
        const last = this.sessionLastSeen.get(sid) || now;
        if (now - last > this.idleMs) {
          try { pty.kill(); } catch {}
          this.sessions.delete(sid);
          this.sessionLastSeen.delete(sid);
        }
      }
    }, 60 * 1000);
  }

  public async handle(clientId: string, message: any): Promise<void> {
    const id: string | undefined = message.id;
    const data = (message?.data && (message.data.terminalData || message.data)) || {};
    const op: string | undefined = data.op || data.operation;

    switch (op) {
      case 'exec':
        await this.exec(clientId, id, data);
        break;
      case 'create':
        await this.create(clientId, id, data);
        break;
      case 'input':
        await this.input(clientId, id, data);
        break;
      case 'resize':
        await this.resize(clientId, id, data);
        break;
      case 'dispose':
        await this.dispose(clientId, id, data);
        break;
      case 'keepalive':
        await this.keepalive(clientId, id, data);
        break;
      default:
        this.reply(clientId, id, { ok: false, error: `Unsupported terminal op: ${op}` });
    }
  }

  public onClientDisconnect(clientId: string) {
    const pset = this.processesByClient.get(clientId);
    if (pset) {
      try {
        for (const pid of pset) {
          try { process.kill(pid); } catch {}
        }
      } finally {
        this.processesByClient.delete(clientId);
      }
    }
    // Dispose all PTY sessions
    for (const [sid, pty] of this.sessions.entries()) {
      try { pty.kill(); } catch {}
      this.sessions.delete(sid);
    }
  }

  private reply(clientId: string, id: string | undefined, payload: any) {
    this.sendToClient(clientId, { type: 'terminal', id, data: payload });
  }

  private getWorkspaceRoot(): string {
    const wf = vscode.workspace.workspaceFolders;
    if (!wf || wf.length === 0) {
      return process.cwd();
    }
    return wf[0].uri.fsPath;
  }

  private async exec(clientId: string, id: string | undefined, data: any) {
    const cmdline: string = data.command || data.cmd || '';
    const sessionId: string = data.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cwdRaw: string | undefined = data.cwd;
    const cwd = cwdRaw ? (path.isAbsolute(cwdRaw) ? cwdRaw : path.join(this.getWorkspaceRoot(), cwdRaw)) : this.getWorkspaceRoot();

    if (!cmdline || typeof cmdline !== 'string') {
      this.reply(clientId, id, { op: 'exec', sessionId, ok: false, error: 'command is required' });
      return;
    }

    // Secure allowlist for exec (override with env KIRO_EXEC_ALLOW_UNSAFE=1)
    const allowUnsafe = process.env.KIRO_EXEC_ALLOW_UNSAFE === '1';
    const allowed = new Set(['ls','dir','echo','git','npm','pnpm','yarn','node','python','pip','go','dotnet','cargo','bash','powershell','pwsh','cmd']);
    const first = String(cmdline).trim().split(/\s+/)[0]?.toLowerCase();
    if (!allowUnsafe && first && !allowed.has(first)) {
      this.reply(clientId, id, { op: 'exec', sessionId, ok: false, error: `Command '${first}' not in allowlist. Set KIRO_EXEC_ALLOW_UNSAFE=1 to override.` });
      return;
    }

    // Notify start
    this.reply(clientId, id, { op: 'exec', sessionId, event: 'start', cwd });

    const child = spawn(cmdline, { shell: true, cwd });

    // Track by client to cleanup on disconnect
    let pset = this.processesByClient.get(clientId);
    if (!pset) { pset = new Set(); this.processesByClient.set(clientId, pset); }
    pset.add(child.pid);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = this.redact(chunk.toString('utf8'));
      this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'data', channel: 'stdout', chunk: text } });
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = this.redact(chunk.toString('utf8'));
      this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'data', channel: 'stderr', chunk: text } });
    });

    child.on('close', (code, signal) => {
      this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'exit', code, signal, done: true } });
      // remove from tracking
      try { this.processesByClient.get(clientId)?.delete(child.pid); } catch {}
    });

    child.on('error', (err) => {
      this.sendToClient(clientId, { type: 'terminal', data: { op: 'exec', sessionId, event: 'error', error: err.message } });
      try { this.processesByClient.get(clientId)?.delete(child.pid); } catch {}
    });
  }

  // --- Stage 2: Interactive PTY ---
  private async create(clientId: string, id: string | undefined, data: any) {
    if (!nodePty) {
      this.reply(clientId, id, { op: 'create', ok: false, error: 'node-pty not available on backend' });
      return;
    }
    const sessionId: string = data.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cols: number = Number(data.cols || 80);
    const rows: number = Number(data.rows || 24);
    const cwdRaw: string | undefined = data.cwd;
    const cwd = cwdRaw ? (path.isAbsolute(cwdRaw) ? cwdRaw : path.join(this.getWorkspaceRoot(), cwdRaw)) : this.getWorkspaceRoot();

    const shell = process.platform === 'win32'
      ? (process.env.COMSPEC || 'C\\\Windows\\System32\\cmd.exe')
      : (process.env.SHELL || '/bin/bash');

    try {
      const pty = nodePty.spawn(shell, [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd,
        env: { ...process.env },
      });

      this.sessions.set(sessionId, pty);

      pty.onData((chunk: string) => {
        this.sessionLastSeen.set(sessionId, Date.now());
        this.sendToClient(clientId, { type: 'terminal', data: { op: 'data', sessionId, chunk: this.redact(chunk) } });
      });

      pty.onExit((e: any) => {
        this.sendToClient(clientId, { type: 'terminal', data: { op: 'exit', sessionId, code: e?.exitCode } });
        try { this.sessions.delete(sessionId); } catch {}
        this.sessionLastSeen.delete(sessionId);
      });

      this.reply(clientId, id, { op: 'create', ok: true, sessionId, cwd, cols, rows, event: 'ready' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.reply(clientId, id, { op: 'create', ok: false, error: msg });
    }
  }

  private async input(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const pty = this.sessions.get(sid);
    if (!pty) {
      this.reply(clientId, id, { op: 'input', ok: false, error: 'invalid session' });
      return;
    }
    const text: string = data.data || data.chunk || '';
    pty.write(text);
    this.sessionLastSeen.set(sid, Date.now());
    this.reply(clientId, id, { op: 'input', ok: true });
  }

  private async resize(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const cols: number = Number(data.cols || 80);
    const rows: number = Number(data.rows || 24);
    const pty = this.sessions.get(sid);
    if (!pty) {
      this.reply(clientId, id, { op: 'resize', ok: false, error: 'invalid session' });
      return;
    }
    try {
      pty.resize(cols, rows);
      this.sessionLastSeen.set(sid, Date.now());
      this.reply(clientId, id, { op: 'resize', ok: true, cols, rows });
    } catch (err) {
      this.reply(clientId, id, { op: 'resize', ok: false, error: (err as Error).message });
    }
  }

  private async dispose(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    const pty = this.sessions.get(sid);
    if (!pty) {
      this.reply(clientId, id, { op: 'dispose', ok: false, error: 'invalid session' });
      return;
    }
    try {
      pty.kill();
      this.sessions.delete(sid);
      this.sessionLastSeen.delete(sid);
      this.reply(clientId, id, { op: 'dispose', ok: true });
    } catch (err) {
      this.reply(clientId, id, { op: 'dispose', ok: false, error: (err as Error).message });
    }
  }

  private async keepalive(clientId: string, id: string | undefined, data: any) {
    const sid: string = data.sessionId;
    if (sid && this.sessions.has(sid)) {
      this.sessionLastSeen.set(sid, Date.now());
      this.reply(clientId, id, { op: 'keepalive', ok: true });
    } else {
      this.reply(clientId, id, { op: 'keepalive', ok: false, error: 'invalid session' });
    }
  }

  private redact(text: string): string {
    try {
      let t = text;
      // Common token patterns
      t = t.replace(/ghp_[A-Za-z0-9]{20,}/g, '***');
      t = t.replace(/sk-[A-Za-z0-9]{20,}/g, '***');
      t = t.replace(/AKIA[0-9A-Z]{16}/g, '***');
      t = t.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');
      t = t.replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '***'); // JWT-like
      t = t.replace(/[A-Fa-f0-9]{32,}/g, (m) => (m.length >= 32 ? '***' : m));
      return t;
    } catch {
      return text;
    }
  }
}
