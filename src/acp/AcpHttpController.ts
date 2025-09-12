import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { ACPConnection, AgentCommand } from './ACPConnection';
import SessionsStore from './SessionsStore';
import ThreadsStore from './ThreadsStore';
import type { PromptRequest, SessionUpdate } from './types';
import { AcpEventBus } from './AcpEventBus';

export class AcpHttpController {
  private conn: ACPConnection | null = null;
  private lastSessionId: string | null = null;
  private sessions: SessionsStore;
  private threads: ThreadsStore;

  constructor(
    private dataRoot: string = path.join(process.cwd(), '.on-the-go', 'acp')
  ) {
    this.sessions = new SessionsStore(path.join(this.dataRoot, 'sessions.json'));
    this.threads = new ThreadsStore(path.join(this.dataRoot, 'threads'));
  }

  // Zod Schemas
  private static ConnectSchema = z.object({
    agentCmd: z.string().optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
    proxy: z.string().optional(),
  });
  private static AuthSchema = z.object({ methodId: z.string().min(1) });
  private static NewSessionSchema = z.object({ cwd: z.string().optional(), mcpServers: z.array(z.any()).optional() });
  private static SetModeSchema = z.object({ sessionId: z.string().optional(), modeId: z.string().min(1) });
  private static CancelSchema = z.object({ sessionId: z.string().optional() });
  private static PromptSchema = z.object({ sessionId: z.string().optional(), prompt: z.array(z.any()).min(1) });
  private static PermissionSchema = z.object({ requestId: z.number(), outcome: z.enum(['selected', 'cancelled']), optionId: z.string().optional() });
  private static TerminalCreateSchema = z.object({
    command: z.string().min(1),
    args: z.array(z.string()).optional(),
    env: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    cwd: z.string().optional(),
    outputByteLimit: z.number().optional(),
  });
  private static TerminalIdSchema = z.object({ terminalId: z.string().min(1) });
  private static ApplyDiffSchema = z.object({
    path: z.string().min(1),
    newText: z.string(),
  });

  async init(): Promise<void> {
    await this.sessions.init();
    await this.threads.init();
    this.lastSessionId = this.sessions.getLast();
  }

  // --- Connect & Auth ---
  async connect(body: any): Promise<{ ok: true; init: any }> {
    const parsed = AcpHttpController.ConnectSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('invalid connect body');
    const { agentCmd, cwd, env, proxy, provided, reason } = this.validateConnectBody(parsed.data);

    const { exe, args } = this.parseAgentCmd(agentCmd, proxy);

    if (this.conn) {
      try { this.conn.dispose(); } catch {}
    }
    this.conn = new ACPConnection('kiro-remote');

    // Wire ACP events => EventBus + persistence
    this.conn.on('session_update', (update: SessionUpdate, sid?: string) => {
      AcpEventBus.emit('session_update', { type: 'session_update', update });
      const threadId = sid || this.lastSessionId;
      if (threadId) {
        this.threads.append(threadId, update).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn('[ACP] threads.append error', e?.message || e);
        });
      }
    });
    this.conn.on('agent_stderr', (line: string) => {
      AcpEventBus.emit('agent_stderr', { type: 'agent_stderr', line });
    });
    this.conn.on('permission_request', (payload: any) => {
      AcpEventBus.emit('permission_request', { type: 'permission_request', ...payload });
    });
    this.conn.on('terminal_output', ({ terminalId, chunk, stream }) => {
      AcpEventBus.emit('terminal_output', { type: 'terminal_output', terminalId, chunk, stream });
    });
    this.conn.on('terminal_exit', ({ terminalId, exitStatus }) => {
      AcpEventBus.emit('terminal_exit', { type: 'terminal_exit', terminalId, exitStatus });
    });
    this.conn.on('initialized', (init: any) => {
      AcpEventBus.emit('agent_initialized', { type: 'agent_initialized', init });
    });
    this.conn.on('agent_exit', (payload: any) => {
      try { AcpEventBus.emit('agent_exit', { type: 'agent_exit', ...payload }); } catch {}
    });

    // Emit debug info about the command we will spawn
    try {
      AcpEventBus.emit('agent_connect', { type: 'agent_connect', exe, args, cwd: cwd || process.cwd(), envKeys: env ? Object.keys(env) : [], providedCmd: provided, reason });
    } catch {}

    // Merge proxy into env for agent consumption (common Node proxy vars)
    const envWithProxy: Record<string, string> | undefined = (() => {
      if (!env && !proxy) return env as any;
      const out: Record<string, string> = { ...(env || {}) };
      if (proxy) {
        if (!out.HTTPS_PROXY) out.HTTPS_PROXY = proxy;
        if (!out.HTTP_PROXY) out.HTTP_PROXY = proxy;
      }
      return out;
    })();

    const init = await this.conn.connect({ path: exe, args, cwd: cwd || process.cwd(), env: envWithProxy as any });
    if (!init || typeof (init as any).protocolVersion === 'undefined') {
      const e: any = new Error('Agent failed to initialize');
      e.code = 500;
      e.debug = { exe, args, cwd: cwd || process.cwd(), providedCmd: provided, reason };
      throw e;
    }
    // On fresh connect, clear lastSessionId to avoid pointing at stale threads from a previous agent instance
    try { await this.sessions.clearLast(); } catch {}
    this.lastSessionId = null;
    return { ok: true, init, debug: { exe, args, cwd: cwd || process.cwd(), providedCmd: provided, reason } } as any;
  }

  getAuthMethods(): any[] {
    if (!this.conn) return [];
    return this.conn.getInitializeInfo()?.authMethods ?? [];
  }

  async authenticate(body: any): Promise<{ ok: true }> {
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.AuthSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('methodId required');
    await this.conn.authenticate(parsed.data.methodId);
    return { ok: true };
  }

  // --- Session ---
  async newSession(body: any): Promise<{ sessionId: string; modes?: any }>{
    if (!this.conn) throw this.authMapError(new Error('not connected'));
    const parsed = AcpHttpController.NewSessionSchema.safeParse(body ?? {});
    const cwd = parsed.success && parsed.data.cwd ? parsed.data.cwd : process.cwd();
    const mcpServers = parsed.success && Array.isArray(parsed.data.mcpServers) ? parsed.data.mcpServers : [];
    try {
      const resp = await this.conn.newSession({ cwd, mcpServers });
      // Normalize response to ensure camelCase sessionId is present
      const sessionId: string = (resp as any).sessionId || (resp as any).session_id;
      if (!sessionId) throw new Error('Agent did not return sessionId');
      this.lastSessionId = sessionId;
      try { await this.sessions.add(sessionId); } catch {}
      const modes = (resp as any).modes;
      return { sessionId, modes } as any;
    } catch (err: any) {
      throw this.authMapError(err);
    }
  }

  async setMode(body: any): Promise<{ ok: true }>{
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.SetModeSchema.safeParse(body ?? {});
    const sessionId = String(parsed.success && parsed.data.sessionId ? parsed.data.sessionId : (this.lastSessionId || ''));
    const modeId = parsed.success ? parsed.data.modeId : '';
    if (!sessionId) throw new Error('no sessionId');
    if (!modeId) throw new Error('modeId required');
    await this.conn.setMode(sessionId, modeId);
    return { ok: true };
  }

  async cancel(body: any): Promise<{ ok: true }>{
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.CancelSchema.safeParse(body ?? {});
    const sessionId = String(parsed.success && parsed.data.sessionId ? parsed.data.sessionId : (this.lastSessionId || ''));
    if (!sessionId) throw new Error('no sessionId');
    await this.conn.cancel(sessionId);
    return { ok: true };
  }

  // --- Prompt ---
  async prompt(body: any): Promise<any> {
    if (!this.conn) throw this.authMapError(new Error('not connected'));
    const parsed = AcpHttpController.PromptSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('prompt array required');
    const prompt = parsed.data.prompt;
    let sessionId = String(parsed.data.sessionId || this.lastSessionId || '');
    if (!sessionId) throw new Error('no sessionId');
    let req: PromptRequest = { sessionId, prompt } as PromptRequest;
    try {
      const resp = await this.conn.prompt(req);
      try { await this.sessions.touch(sessionId); } catch {}
      return resp;
    } catch (err: any) {
      // Seamless recovery: if the agent reports the session is missing, create a new one and retry once
      const msg = err?.message || '';
      const code = typeof err?.code === 'number' ? err.code : undefined;
      const notFound = /Session not found/i.test(msg) || (code === -32603 && /Session not found/i.test(String(err?.data?.details || '')));
      if (notFound) {
        try {
          const resp = await this.conn.newSession({ cwd: process.cwd(), mcpServers: [] });
          const newSid: string = (resp as any).sessionId || (resp as any).session_id;
          if (newSid) {
            this.lastSessionId = newSid;
            try { await this.sessions.add(newSid); } catch {}
            // Notify UI about recovery so it can update selected session
            try { AcpEventBus.emit('session_recovered', { type: 'session_recovered', oldSessionId: sessionId, newSessionId: newSid, reason: 'not_found' }); } catch {}
            // Retry prompt on the new session
            sessionId = newSid;
            req = { sessionId: newSid, prompt } as PromptRequest;
            const retry = await this.conn.prompt(req);
            try { await this.sessions.touch(newSid); } catch {}
            return retry;
          }
        } catch {}
      }
      throw this.authMapError(err);
    }
  }

  // Graceful disconnect from agent
  async disconnect(): Promise<{ ok: true }>{
    if (this.conn) {
      try { this.conn.dispose(); } catch {}
      this.conn = null;
    }
    return { ok: true };
  }

  // --- Models ---
  async listModels(sessionId?: string): Promise<{ models: any[] }>{
    if (!this.conn) return { models: [] };
    const sid = String(sessionId || this.lastSessionId || '');
    if (!sid) return { models: [] };
    const models = await this.conn.listModels(sid);
    return { models };
  }

  async selectModel(body: any): Promise<{ ok: true }>{
    if (!this.conn) throw new Error('not connected');
    const sessionId = String((body && typeof body.sessionId === 'string' ? body.sessionId : this.lastSessionId) || '');
    const modelId = String(body?.modelId || '');
    if (!sessionId) throw new Error('no sessionId');
    if (!modelId) throw new Error('modelId required');
    await this.conn.selectModel(sessionId, modelId);
    return { ok: true };
  }

  // --- Permissions ---
  async permission(body: any): Promise<{ ok: true }>{
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.PermissionSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('invalid permission body');
    if (parsed.data.outcome === 'selected' && !parsed.data.optionId) throw new Error('optionId required for selected');
    this.conn.respondPermission(parsed.data.requestId, parsed.data.outcome, parsed.data.optionId);
    return { ok: true };
  }

  // --- Terminals ---
  terminalCreate(body: any) {
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.TerminalCreateSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('invalid terminal/create body');
    const { command, args, env, cwd, outputByteLimit } = parsed.data;
    const payload: { command: string; args?: string[]; env?: { name: string; value: string }[]; cwd?: string; outputByteLimit?: number } = { command };
    if (args && args.length) payload.args = args;
    if (env && env.length) payload.env = env;
    if (cwd) payload.cwd = cwd;
    if (typeof outputByteLimit === 'number') payload.outputByteLimit = outputByteLimit;
    return this.conn.createTerminal(payload);
  }
  terminalOutput(body: any) {
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.TerminalIdSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('terminalId required');
    return this.conn.readTerminalOutput(parsed.data.terminalId);
  }
  terminalKill(body: any) {
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.TerminalIdSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('terminalId required');
    this.conn.killTerminalById(parsed.data.terminalId);
    return { ok: true };
  }
  terminalRelease(body: any) {
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.TerminalIdSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('terminalId required');
    this.conn.releaseTerminalById(parsed.data.terminalId);
    return { ok: true };
  }
  async terminalWaitForExit(body: any) {
    if (!this.conn) throw new Error('not connected');
    const parsed = AcpHttpController.TerminalIdSchema.safeParse(body ?? {});
    if (!parsed.success) throw new Error('terminalId required');
    const exitStatus = await this.conn.waitTerminalExit(parsed.data.terminalId);
    return { exitStatus };
  }

  // --- Sessions persistence ---
  listSessions() { return { sessions: this.sessions.list(), lastSessionId: this.sessions.getLast() }; }
  lastSession() { return { sessionId: this.sessions.getLast() }; }
  async selectSession(body: any) { const sessionId = String(body?.sessionId || ''); if (!sessionId) throw new Error('sessionId required'); await this.sessions.select(sessionId); this.lastSessionId = sessionId; return { ok: true, sessionId }; }
  async deleteSession(body: any) { const sessionId = String(body?.sessionId || ''); if (!sessionId) throw new Error('sessionId required'); await this.sessions.delete(sessionId); this.lastSessionId = this.sessions.getLast(); return { ok: true, lastSessionId: this.lastSessionId }; }

  // --- Threads persistence ---
  async listThreads() { const threads = await this.threads.list(); return { threads }; }
  async getThread(id: string) { const thread = await this.threads.get(id); if (!thread) throw new Error('not found'); return thread; }

  // --- helpers ---
  private validateConnectBody(body: any) {
    const cwd = typeof body?.cwd === 'string' ? body.cwd : undefined;
    const env = (body?.env && typeof body.env === 'object') ? body.env : undefined;
    const proxy = typeof body?.proxy === 'string' && body.proxy.length > 0 ? body.proxy : undefined;

    const provided = (typeof body?.agentCmd === 'string') ? body.agentCmd.trim() : '';
    const allowAny = process.env.KIRO_ALLOW_ANY_AGENT_CMD === '1';

    const resolveDefault = (): string => {
      const nodeExe = process.execPath || 'node';
      const nmScript = path.join(process.cwd(), 'node_modules', '@zed-industries', 'claude-code-acp', 'dist', 'index.js');
      const localScript = path.join(process.cwd(), 'claude-code-acp', 'dist', 'index.js');
      const preferLocal = process.env.KIRO_PREFER_LOCAL_AGENT === '1';
      if (preferLocal) {
        if (fs.existsSync(localScript)) return `"${nodeExe}" "${localScript}"`;
        if (fs.existsSync(nmScript)) return `"${nodeExe}" "${nmScript}"`;
        return 'npx -y @zed-industries/claude-code-acp';
      } else {
        if (fs.existsSync(nmScript)) return `"${nodeExe}" "${nmScript}"`;
        if (fs.existsSync(localScript)) return `"${nodeExe}" "${localScript}"`;
        return 'npx -y @zed-industries/claude-code-acp';
      }
    };

    const isAllowed = (cmd: string): boolean => {
      if (!cmd) return false;
      return /claude-code-acp/i.test(cmd);
    };

    let reason: string | undefined;
    let cmd = provided;
    if (!cmd) {
      cmd = resolveDefault();
      reason = 'default';
    } else if (!allowAny && !isAllowed(cmd)) {
      cmd = resolveDefault();
      reason = 'not_allowed_fallback_default';
    } else {
      reason = 'provided_allowed';
    }

    // Validate syntactic correctness of provided command; if it cannot be parsed, fall back to default
    try {
      // Just to validate; ignore returned value
      this.parseAgentCmd(cmd, proxy);
    } catch {
      const fallback = resolveDefault();
      if (fallback !== cmd) {
        cmd = fallback;
        reason = 'invalid_provided_fallback_default';
      }
    }

    return { agentCmd: cmd, cwd, env, proxy, provided, reason };
  }

  private parseAgentCmd(agentCmd: string, proxy?: string): { exe: string; args: string[] } {
    const matches = agentCmd.match(/(?:"[^"]+"|'[^']+'|\S+)/g);
    let parts: string[] = matches ? Array.from(matches) : [];
    const exe = parts.shift()?.replace(/^\"|\"$/g, '').replace(/^'|'$/g, '');
    if (!exe) throw new Error('invalid agentCmd');
    // Sanitize quotes for executable and arguments now that we've tokenized
    const dequote = (s: string): string => {
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      return s;
    };
    const sanitizedExe = dequote(exe);
    let sanitizedArgs = parts.map(dequote);
    if (proxy && !sanitizedArgs.includes('--proxy')) sanitizedArgs = sanitizedArgs.concat(['--proxy', proxy]);
    return { exe: sanitizedExe, args: sanitizedArgs };
  }

  // --- Diffs ---
  async applyDiff(body: any): Promise<{ ok: true; path: string }>{
    const parsed = AcpHttpController.ApplyDiffSchema.safeParse(body ?? {});
    if (!parsed.success) {
      const e: any = new Error('invalid diff body');
      e.code = 400; throw e;
    }
    const relOrAbs = parsed.data.path;
    const newText = parsed.data.newText;
    const cwd = process.cwd();
    const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(cwd, relOrAbs);
    const norm = path.normalize(abs);
    const rootNorm = path.normalize(cwd);
    if (!norm.startsWith(rootNorm)) {
      const e: any = new Error('path outside workspace'); e.code = 400; throw e;
    }
    await fs.promises.mkdir(path.dirname(norm), { recursive: true }).catch(() => {});
    await fs.promises.writeFile(norm, newText, 'utf8');
    return { ok: true, path: norm };
  }

  private authMapError(err: any): any {
    const msg = err?.message || String(err);
    const code = err?.code;
    if (code === -32000 || /Authentication required/i.test(msg)) {
      const init = this.conn?.getInitializeInfo();
      const e: any = new Error('Authentication required');
      (e.code = 401);
      (e.authRequired = true);
      (e.authMethods = init?.authMethods ?? []);
      return e;
    }
    return err;
  }
}
