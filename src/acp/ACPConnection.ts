import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';
import { JsonRpcStdioClient } from './jsonrpc';
import type {
  InitializeRequest,
  InitializeResponse,
  PromptRequest,
  PromptResponse,
  RequestPermissionRequest,
  SessionId,
  SessionUpdate,
} from './types';
import { promises as fs } from 'fs';

export interface AgentCommand {
  path: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

type TerminalExitStatus = { exitCode?: number; signal?: string } | null;

type TerminalRecord = {
  id: string;
  proc: ChildProcess;
  buffer: Buffer;
  byteLimit: number | null;
  exitStatus: TerminalExitStatus;
};

function limitBuffer(buf: Buffer, limit: number): Buffer {
  if (buf.length <= limit) return buf;
  const start = buf.length - limit;
  let out = buf.subarray(start);
  const nl = out.indexOf(0x0a);
  if (nl > 0 && nl < 64) {
    out = out.subarray(nl + 1);
  }
  return out;
}

export interface EnvVar { name: string; value: string }

export class ACPConnection extends EventEmitter {
  private child?: ChildProcess;
  private rpc: JsonRpcStdioClient | null = null;
  private initialized?: InitializeResponse;
  private pendingPermissionIds = new Set<number>();
  private terminals = new Map<string, TerminalRecord>();
  private termSeq = 0;
  private adapterName: 'claude' | 'gemini' | 'generic' = 'generic';

  constructor(private serverName = 'acp-agent') { super(); }

  get isConnected() { return !!this.rpc; }

  getInitializeInfo(): InitializeResponse | undefined {
    return this.initialized;
  }

  async connect(command: AgentCommand, framingOverride?: 'lsp' | 'ndjson'): Promise<InitializeResponse> {
    if (this.rpc) return this.initialized!;

    // Helper to wait for spawn or error
    const awaitStart = (child: ChildProcess) => new Promise<void>((resolve, reject) => {
      let settled = false;
      const onError = (err: any) => {
        if (settled) return;
        settled = true;
        try { this.emit('agent_stderr', `[spawn] ${err?.message || String(err)}\n`); } catch {}
        reject(err);
      };
      const onSpawn = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      child.once('error', onError);
      child.once('spawn', onSpawn);
      setTimeout(() => { if (!settled) { settled = true; resolve(); } }, 200);
    });

    const exeLower = (command.path || '').toLowerCase();
    const isWin = process.platform === 'win32';
    const mayNeedCmd = isWin && (
      exeLower.endsWith('.cmd') ||
      exeLower.endsWith('.bat') ||
      exeLower === 'npm' || exeLower === 'npx' ||
      exeLower === 'npm.cmd' || exeLower === 'npx.cmd' ||
      // Add common CLI shim names that are typically .cmd on Windows
      exeLower === 'gemini' || exeLower === 'gemini.cmd'
    );

    const spawnDirect = () => spawn(command.path, command.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(command.env ?? {}) },
      cwd: command.cwd ?? process.cwd(),
      shell: false,
      windowsHide: true,
    });
    const spawnViaCmd = () => {
      const cmdStr = [command.path, ...(command.args ?? [])].join(' ');
      return spawn('cmd.exe', ['/d', '/s', '/c', cmdStr], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...(command.env ?? {}) },
        cwd: command.cwd ?? process.cwd(),
        windowsHide: true,
        shell: false,
      });
    };

    try {
      if (mayNeedCmd) {
        this.child = spawnViaCmd();
        await awaitStart(this.child);
      } else {
        this.child = spawnDirect();
        await awaitStart(this.child);
      }
    } catch (err: any) {
      if (mayNeedCmd) {
        // If first attempt via cmd failed, try direct as a fallback
        try {
          this.child = spawnDirect();
          await awaitStart(this.child);
        } catch (err2: any) {
          throw new Error(`Failed to start agent: ${err2?.message || err?.message || String(err2 || err)}`);
        }
      } else if (isWin) {
        // On Windows, try cmd fallback once for any odd cases
        try {
          this.child = spawnViaCmd();
          await awaitStart(this.child);
        } catch (err2: any) {
          throw new Error(`Failed to start agent: ${err2?.message || err?.message || String(err2 || err)}`);
        }
      } else {
        throw new Error(`Failed to start agent: ${err?.message || String(err)}`);
      }
    }

    this.child.stderr?.on('data', (d) => this.emit('agent_stderr', String(d)));
    this.child.on('exit', (code, signal) => {
      try { this.rpc?.abortAllPending(new Error('agent exited')); } catch {}
      this.rpc = null;
      this.emit('agent_exit', { code, signal });
    });
    this.child.on('close', () => {
      try { this.rpc?.abortAllPending(new Error('agent closed')); } catch {}
      this.rpc = null;
    });

    const usesClaude =
      (command.path && command.path.toLowerCase().includes('claude-code-acp')) ||
      (command.args ?? []).some((a) => a.toLowerCase().includes('claude-code-acp'));
    const usesGemini =
      (command.path && command.path.toLowerCase().includes('gemini')) ||
      (command.args ?? []).some((a) => a.toLowerCase().includes('@google/gemini') || a.toLowerCase() === 'gemini');
    const framing: 'lsp' | 'ndjson' = framingOverride || (usesClaude ? 'ndjson' : (usesGemini ? 'ndjson' : 'lsp'));
    this.adapterName = usesClaude ? 'claude' : (usesGemini ? 'gemini' : 'generic');

    this.rpc = new JsonRpcStdioClient(this.child.stdin!, this.child.stdout!, framing);
    this.rpc.on('error', (err: any) => {
      const msg = (err && err.message) ? err.message : String(err);
      this.emit('agent_stderr', `[rpc] ${msg}\n`);
    });

    // Debug stream events for overlay
    try {
      this.rpc.on('outgoing_request', ({ id, method, params }) => {
        this.emit('rpc_debug', { type: 'rpc_debug', direction: 'outgoing', kind: 'request', id, method, params });
      });
      this.rpc.on('outgoing_notification', ({ method, params }) => {
        this.emit('rpc_debug', { type: 'rpc_debug', direction: 'outgoing', kind: 'notification', method, params });
      });
      this.rpc.on('incoming_response', ({ id, result, error }) => {
        this.emit('rpc_debug', { type: 'rpc_debug', direction: 'incoming', kind: 'response', id, result, error, hasError: !!error });
      });
    } catch {}

    this.rpc.onNotification('session/update', (params) => {
      const p: any = params;
      const update = (p && p.update) ? (p.update as SessionUpdate) : (p as SessionUpdate);
      const sid: string | undefined = p?.sessionId || p?.session_id || p?.sessionID || p?.session?.sessionId;
      this.emit('session_update', update, sid);
    });

    this.rpc.onRequest(async ({ id, method, params }) => {
      // Emit debug for incoming request
      try { this.emit('rpc_debug', { type: 'rpc_debug', direction: 'incoming', kind: 'request', id, method, params }); } catch {}
      if (method === 'session/request_permission') {
        this.pendingPermissionIds.add(id);
        const p = params as RequestPermissionRequest;
        const mapped = {
          ...p,
          options: (p.options || []).map((o: any) => ({ id: o.optionId ?? o.id, name: o.name, kind: o.kind }))
        };
        this.emit('permission_request', { requestId: id, request: mapped });
        return;
      }
      if (method === 'fs/read_text_file') {
        try {
          const p = params as { path: string; line?: number; limit?: number };
          const raw = await fs.readFile(p.path, 'utf8');
          if (p.line || p.limit) {
            const lines = raw.split(/\r?\n/);
            const start = Math.max(0, ((p.line ?? 1) - 1));
            const end = p.limit ? Math.min(lines.length, start + p.limit) : lines.length;
            const slice = lines.slice(start, end).join('\n');
            this.rpc?.respond(id, { content: slice });
          } else {
            this.rpc?.respond(id, { content: raw });
          }
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32001, message: err?.message || String(err) });
        }
        return;
      }
      if (method === 'fs/write_text_file') {
        try {
          const p = params as { path: string; content: string };
          await fs.writeFile(p.path, p.content, 'utf8');
          this.rpc?.respond(id, {});
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32002, message: err?.message || String(err) });
        }
        return;
      }
      if (method === 'terminal/create') {
        try {
          const p = params as { command: string; args?: string[]; env?: { name: string; value: string }[]; cwd?: string; outputByteLimit?: number };
          const termId = this.newTerminal(p.command, p.args ?? [], p.env ?? [], p.cwd, p.outputByteLimit);
          this.rpc?.respond(id, { terminalId: termId });
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32010, message: err?.message || String(err) });
        }
        return;
      }
      if (method === 'terminal/output') {
        try {
          const p = params as { terminalId: string };
          const out = this.terminalOutput(p.terminalId);
          this.rpc?.respond(id, out);
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32011, message: err?.message || String(err) });
        }
        return;
      }
      if (method === 'terminal/kill') {
        try {
          const p = params as { terminalId: string };
          this.killTerminal(p.terminalId);
          this.rpc?.respond(id, {});
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32012, message: err?.message || String(err) });
        }
        return;
      }
      if (method === 'terminal/release') {
        try {
          const p = params as { terminalId: string };
          this.releaseTerminal(p.terminalId);
          this.rpc?.respond(id, {});
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32013, message: err?.message || String(err) });
        }
        return;
      }
      if (method === 'terminal/wait_for_exit') {
        try {
          const p = params as { terminalId: string };
          this.waitForTerminalExit(p.terminalId).then((exitStatus) => {
            this.rpc?.respond(id, { exitStatus });
          }).catch((err) => {
            this.rpc?.respond(id, undefined, { code: -32014, message: err?.message || String(err) });
          });
        } catch (err: any) {
          this.rpc?.respond(id, undefined, { code: -32014, message: err?.message || String(err) });
        }
        return;
      }
      const error = { code: -32601, message: `Method not implemented: ${method}` };
      this.rpc?.respond(id, undefined, error);
      this.emit('unhandled_request', { id, method });
    });

    const initReq: InitializeRequest = {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true },
    };
    const res = await this.rpc!.request<InitializeResponse>('initialize', initReq);
    this.initialized = res;
    this.emit('initialized', res);
    return res;
  }

  getAdapterName(): 'claude' | 'gemini' | 'generic' {
    return this.adapterName;
  }

  supportsModelListing(): boolean {
    return this.adapterName !== 'claude';
  }

  async authenticate(methodId: string): Promise<void> {
    await this.rpc?.request('authenticate', { methodId });
  }

  async newSession(args: { cwd: string; mcpServers?: any[] }): Promise<{ sessionId: SessionId; modes?: any }>{
    const req = { cwd: args.cwd, mcpServers: args.mcpServers ?? [] };
    const res = await this.rpc?.request('session/new', req);
    return res as { sessionId: SessionId; modes?: any };
  }

  async prompt(req: PromptRequest): Promise<PromptResponse> {
    // Normalize payload for different adapters (claude vs generic)
    let payload: any = req;
    if (this.adapterName === 'claude') {
      payload = req;
    } else if (this.adapterName === 'gemini') {
      // Gemini expects camelCase params (sessionId, prompt)
      payload = req;
    } else {
      // Generic fallback (legacy agents) use snake_case
      payload = { ...req, session_id: (req as any).sessionId, sessionId: undefined } as any;
    }
    const res = await this.rpc?.request('session/prompt', payload);
    return res as PromptResponse;
  }

  async cancel(sessionId: SessionId): Promise<void> {
    const payload = this.adapterName === 'claude'
      ? { sessionId }
      : (this.adapterName === 'gemini' ? { sessionId } : { session_id: sessionId });
    await this.rpc?.notify('session/cancel', payload);
  }

  respondPermission(requestId: number, outcome: 'cancelled' | 'selected', optionId?: string) {
    if (!this.rpc || !this.pendingPermissionIds.has(requestId)) return;
    const payload = outcome === 'cancelled'
      ? { outcome: { outcome: 'cancelled' } }
      : { outcome: { outcome: 'selected', optionId } };
    this.rpc!.respond(requestId, payload);
    this.pendingPermissionIds.delete(requestId);
  }

  async setMode(sessionId: SessionId, modeId: string): Promise<void> {
    const payload = this.adapterName === 'claude'
      ? { sessionId, modeId }
      : (this.adapterName === 'gemini' ? { sessionId, modeId } : { session_id: sessionId, mode_id: modeId });
    await this.rpc?.request('session/set_mode', payload);
  }

  async listModels(sessionId: SessionId): Promise<any> {
    if (!this.supportsModelListing()) return [];
    try {
      const res = await this.rpc?.request('session/list_models', this.adapterName === 'gemini' ? { sessionId } : { session_id: sessionId });
      return res;
    } catch (err) {
      try {
        const res = await this.rpc?.request('agent/list_models', this.adapterName === 'gemini' ? { sessionId } : { session_id: sessionId });
        return res;
      } catch (err2) {
        return [];
      }
    }
  }

  async selectModel(sessionId: SessionId, modelId: string): Promise<void> {
    if (!this.supportsModelListing()) throw new Error('Model selection is not supported by this agent');
    try {
      await this.rpc?.request('session/select_model', this.adapterName === 'gemini' ? { sessionId, modelId } : { session_id: sessionId, model_id: modelId });
      return;
    } catch (err) {
      try {
        await this.rpc?.request('agent/select_model', this.adapterName === 'gemini' ? { sessionId, modelId } : { session_id: sessionId, model_id: modelId });
      } catch (err2) {
        const e: any = err2 ?? err;
        const msg = (e && e.message) ? e.message : 'Model selection failed';
        throw new Error(msg);
      }
    }
  }

  private newTerminal(command: string, args: string[], env: EnvVar[], cwd?: string, outputByteLimit?: number): string {
    const id = `term_${++this.termSeq}`;
    let cmd = command;
    let argv = [...args];
    if (process.platform === 'win32') {
      const c = cmd.toLowerCase();
      if (c === 'mkdir' || c === 'md') {
        argv = argv.filter(a => a !== '-p' && a !== '--parents');
      }
    }

    const proc = spawn(cmd, argv, {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, ...Object.fromEntries(env.map(e => [e.name, e.value])) },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    const rec: TerminalRecord = { id, proc, buffer: Buffer.alloc(0), byteLimit: outputByteLimit ?? null, exitStatus: null };
    proc.stdout?.on('data', (d: Buffer) => {
      rec.buffer = Buffer.concat([rec.buffer, d]);
      if (rec.byteLimit) rec.buffer = limitBuffer(rec.buffer, rec.byteLimit);
      this.emit('terminal_output', { terminalId: id, chunk: d.toString('utf8'), stream: 'stdout' });
    });
    proc.stderr?.on('data', (d: Buffer) => {
      rec.buffer = Buffer.concat([rec.buffer, d]);
      if (rec.byteLimit) rec.buffer = limitBuffer(rec.buffer, rec.byteLimit);
      this.emit('terminal_output', { terminalId: id, chunk: d.toString('utf8'), stream: 'stderr' });
    });
    proc.on('exit', (code, signal) => {
      const status: { exitCode?: number; signal?: string } = {};
      if (code !== null) status.exitCode = code;
      if (signal !== null) status.signal = String(signal);
      rec.exitStatus = status;
      this.emit('terminal_exit', { terminalId: id, exitStatus: rec.exitStatus });
    });
    this.terminals.set(id, rec);
    return id;
  }

  private terminalOutput(terminalId: string): { output: string; truncated: boolean; exitStatus: TerminalExitStatus } {
    const rec = this.terminals.get(terminalId);
    if (!rec) throw new Error(`terminal not found: ${terminalId}`);
    const output = rec.buffer.toString('utf8');
    const truncated = !!(rec.byteLimit && rec.buffer.length >= rec.byteLimit);
    return { output, truncated, exitStatus: rec.exitStatus };
  }

  private killTerminal(terminalId: string): void {
    const rec = this.terminals.get(terminalId);
    if (!rec) throw new Error(`terminal not found: ${terminalId}`);
    try { rec.proc.kill(); } catch {}
  }

  private releaseTerminal(terminalId: string): void {
    const rec = this.terminals.get(terminalId);
    if (!rec) throw new Error(`terminal not found: ${terminalId}`);
    this.terminals.delete(terminalId);
  }

  private waitForTerminalExit(terminalId: string): Promise<TerminalExitStatus> {
    const rec = this.terminals.get(terminalId);
    if (!rec) return Promise.reject(new Error(`terminal not found: ${terminalId}`));
    if (rec.exitStatus) return Promise.resolve(rec.exitStatus);
    return new Promise((resolve) => {
      rec.proc.once('exit', () => resolve(rec.exitStatus));
    });
  }

  public createTerminal(opts: { command: string; args?: string[]; env?: EnvVar[]; cwd?: string; outputByteLimit?: number }): { terminalId: string } {
    const id = this.newTerminal(opts.command, opts.args ?? [], opts.env ?? [], opts.cwd, opts.outputByteLimit);
    return { terminalId: id };
  }
  public readTerminalOutput(terminalId: string) { return this.terminalOutput(terminalId); }
  public killTerminalById(terminalId: string) { this.killTerminal(terminalId); }
  public releaseTerminalById(terminalId: string) { this.releaseTerminal(terminalId); }
  public async waitTerminalExit(terminalId: string) { return this.waitForTerminalExit(terminalId); }

  dispose() {
    try { this.child?.kill(); } catch {}
    this.rpc?.removeAllListeners();
    this.removeAllListeners();
    this.rpc = null;
  }
}
