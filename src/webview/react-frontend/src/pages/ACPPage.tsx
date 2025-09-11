import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Plug, Send, Trash2, RefreshCw } from 'lucide-react';

// Minimal types aligned with backend ContentBlock shapes

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource_link'; uri: string; text?: string }
  | { type: 'resource'; resource: { text: string; mimeType?: string } | { blob: string; mimeType?: string; uri: string } };

interface InitializeResponse {
  protocolVersion: number;
  agentCapabilities: any;
  authMethods: Array<{ id: string; name: string; description?: string }>;
}

interface SessionUpdate {
  type: string;
  [key: string]: any;
}

interface SessionMeta {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

// Removed REST helper; ACP is WS-only now

const ACPPage: React.FC = () => {
  const { addMessageListener, sendAcp, isConnected } = useWebSocket() as any;

  // Connect form state
  const [agentCmd, setAgentCmd] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [cwd, setCwd] = useState('');
  const [proxyUrl, setProxyUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [init, setInit] = useState<InitializeResponse | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [modes, setModes] = useState<any | null>(null);
  const [currentModeId, setCurrentModeId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Prompt composer
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Streaming updates log
  const [updates, setUpdates] = useState<SessionUpdate[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Permission request modal
  const [permissionReq, setPermissionReq] = useState<{ requestId: number; request: any } | null>(null);

  // Sessions list
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [lastSession, setLastSession] = useState<string | null>(null);
  const [authMethods, setAuthMethods] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<string>('');
  const [stderrLog, setStderrLog] = useState<string[]>([]);
  const [eventLog, setEventLog] = useState<any[]>([]);
  async function wsFirst<T = any>(op: string, payload: any): Promise<T> {
    // Strict WS-only pathway for ACP operations
    return await sendAcp(op, payload);
  }
  
  // Persist connect prefs (without API keys)
  const prefsKey = 'acp_connect_prefs_v1';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefsKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.agentCmd === 'string') setAgentCmd(p.agentCmd);
        if (typeof p.cwd === 'string') setCwd(p.cwd);
        if (typeof p.proxyUrl === 'string') setProxyUrl(p.proxyUrl);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(prefsKey, JSON.stringify({ agentCmd, cwd, proxyUrl })); } catch {}
  }, [agentCmd, cwd, proxyUrl]);

  // Terminal (optional)
  const [termCmd, setTermCmd] = useState('');
  const [termArgs, setTermArgs] = useState('');
  const [termId, setTermId] = useState<string | null>(null);
  const [termOutput, setTermOutput] = useState<string>('');
  const [termTruncated, setTermTruncated] = useState<boolean>(false);
  const [termExit, setTermExit] = useState<{ exitCode?: number; signal?: string } | null>(null);

  // Auto-scroll updates
  useEffect(() => {
    const el = endRef.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [updates]);

  // WS subscriptions
  useEffect(() => {
    const unsub = addMessageListener((msg: any) => {
      // Raw log (truncate)
      setEventLog((prev) => {
        const next = [...prev, msg];
        return next.slice(-200);
      });
      if (!msg) return;
      // Console visibility for key WS events
      if (msg.type === 'agent_connect' || msg.type === 'agent_initialized' || msg.type === 'rpc_debug' || msg.type === 'agent_exit') {
        try { console.log('[acp][ws]', msg.type, msg); } catch {}
      }
      if (msg.type === 'agent_initialized') {
        setInit(msg.init as InitializeResponse);
        // refresh auth methods
        refreshAuthMethods().catch(() => {});
      } else if (msg.type === 'session_update') {
        const update: SessionUpdate = msg.update;
        setUpdates((prev) => [...prev, update]);
        if (update.type === 'current_mode_update' && update.current_mode_id) {
          setCurrentModeId(update.current_mode_id);
        }
      } else if (msg.type === 'permission_request') {
        setPermissionReq({ requestId: msg.requestId, request: msg.request });
      } else if (msg.type === 'agent_stderr') {
        setStderrLog((prev) => {
          const next = [...prev, String(msg.line || '')];
          return next.slice(-200);
        });
      } else if (msg.type === 'terminal_output') {
        // Surface terminal stream in updates for now
        setUpdates((prev) => [...prev, { type: 'terminal_output', stream: msg.stream, chunk: msg.chunk }]);
        // If this matches current terminal panel, append live
        if (termId && msg.terminalId === termId && typeof msg.chunk === 'string') {
          setTermOutput((prev) => (prev || '') + msg.chunk);
        }
      }
      // agent_stderr / terminal_* can be added to a debug panel if desired
    });
    return unsub;
  }, [addMessageListener, termId]);

  // Do not load sessions until WS is connected to avoid HTTP fallback
  // Also refresh once WS is connected to avoid HTTP fallback at startup
  useEffect(() => {
    if (isConnected) refreshSessions().catch(() => {});
  }, [isConnected]);
  // Auto-select last session when list refreshes
  useEffect(() => {
    if (!sessionId && lastSession) setSessionId(lastSession);
  }, [lastSession]);

  // Poll terminal output when a terminal is active
  useEffect(() => {
    if (!termId) return;
    const h = setInterval(() => {
      handleReadTerminal().catch(() => {});
    }, 1000);
    return () => clearInterval(h);
  }, [termId]);

  const canConnect = useMemo(() => !connecting, [connecting]);
  const canPrompt = useMemo(() => !!sessionId && input.trim().length > 0 && !sending, [sessionId, input, sending]);

  async function refreshSessions() {
    try {
      const list = await wsFirst('sessions.list', {});
      setSessions(list.sessions || []);
      setLastSession(list.lastSessionId || null);
    } catch (e) {
      // ignore
    }
  }

  async function refreshAuthMethods() {
    try {
      const payload = await wsFirst('authMethods', {});
      const methods = Array.isArray(payload.methods) ? payload.methods : [];
      setAuthMethods(methods);
      if (methods.length && !selectedAuthMethod) setSelectedAuthMethod(methods[0].id);
    } catch {}
  }

  async function handleAuthenticate() {
    try {
      if (!selectedAuthMethod) return;
      await wsFirst('authenticate', { methodId: selectedAuthMethod });
      await refreshAuthMethods();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleConnect() {
    if (!canConnect) { try { console.log('[acp] handleConnect: ignored (already connecting)'); } catch {}; return; }
    try { console.log('[acp] handleConnect: click', { agentCmd, cwd, proxyUrl, anthropicKeyPresent: !!anthropicKey }); } catch {}
    setConnecting(true);
    try {
      const env: Record<string, string> = {};
      if (anthropicKey.trim()) env.ANTHROPIC_API_KEY = anthropicKey.trim();
      const body = {
        agentCmd,
        env: Object.keys(env).length ? env : undefined,
        cwd: cwd.trim() || undefined,
        proxy: proxyUrl.trim() || undefined,
      };
      try { console.log('[acp] /api/connect body', body); } catch {}
      const resp = await wsFirst('connect', body);
      try { console.log('[acp] /api/connect resp', resp); } catch {}
      if (resp?.debug) {
        try { console.log('[acp] /api/connect resp.debug', resp.debug); } catch {}
      }
      setInit(resp.init);
      await refreshAuthMethods();
    } catch (e: any) {
      try { console.error('[acp] handleConnect error', e); } catch {}
      alert(e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function handleNewSession() {
    try {
      const resp = await wsFirst('session.new', { cwd: cwd.trim() || undefined });
      setSessionId(resp.sessionId);
      setModes(resp.modes || null);
      setCurrentModeId(resp.modes?.current_mode_id || null);
      await refreshSessions();
      // Try models
      const m = await wsFirst('models.list', { sessionId: resp.sessionId });
      setModels(Array.isArray(m.models) ? m.models : []);
    } catch (err: any) {
      if (err?.authRequired) {
        // show a minimal hint; full auth UI can be built later if needed
        alert('Authentication required. Available methods: ' + (err?.authMethods?.map((m: any) => m.name).join(', ') || 'unknown'));
      } else {
        alert(err?.message || String(err));
      }
    }
  }

  async function handleSetMode(modeId: string) {
    try {
      await wsFirst('session.setMode', { sessionId, modeId });
      setCurrentModeId(modeId);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleSendPrompt() {
    if (!canPrompt) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const prompt: ContentBlock[] = [{ type: 'text', text }];
      await wsFirst('prompt', { sessionId, prompt });
    } catch (err: any) {
      if (err?.authRequired) {
        alert('Authentication required. Available methods: ' + (err?.authMethods?.map((m: any) => m.name).join(', ') || 'unknown'));
      } else {
        alert(err?.message || String(err));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    try {
      await wsFirst('cancel', { sessionId: sessionId || undefined });
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handlePermission(outcome: 'selected' | 'cancelled', optionId?: string) {
    if (!permissionReq) return;
    try {
      await wsFirst('permission', { requestId: permissionReq.requestId, outcome, optionId });
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setPermissionReq(null);
    }
  }

  async function handleSelectSession(id: string) {
    try {
      await wsFirst('session.select', { sessionId: id });
      setSessionId(id);
      await refreshSessions();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await wsFirst('session.delete', { sessionId: id });
      if (sessionId === id) setSessionId(null);
      await refreshSessions();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  // Terminal helpers
  function parseArgs(input: string): string[] {
    if (!input.trim()) return [];
    // naive split by whitespace; for quoted args, users can use Agent or refine later
    return input.match(/(?:"[^"]*"|'[^']*'|\S+)/g)?.map(s => s.replace(/^"|"$/g, '').replace(/^'|'$/g, '')) || [];
  }

  async function handleCreateTerminal() {
    try {
      const args = parseArgs(termArgs);
      const resp = await wsFirst('terminal.create', { command: termCmd, args, cwd: cwd.trim() || undefined });
      const id = resp.terminalId || resp.terminalID || resp.id;
      if (!id) throw new Error('terminalId missing');
      setTermId(id);
      setTermOutput('');
      setTermTruncated(false);
      setTermExit(null);
      // initial read
      await handleReadTerminal();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleReadTerminal() {
    if (!termId) return;
    try {
      const resp = await wsFirst('terminal.output', { terminalId: termId });
      setTermOutput(resp.output || '');
      setTermTruncated(!!resp.truncated);
      setTermExit(resp.exitStatus ?? null);
    } catch (e: any) {
      // ignore during rapid polling
    }
  }

  async function handleKillTerminal() {
    if (!termId) return;
    try {
      await wsFirst('terminal.kill', { terminalId: termId });
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleReleaseTerminal() {
    if (!termId) return;
    try {
      await wsFirst('terminal.release', { terminalId: termId });
      setTermId(null);
      setTermOutput('');
      setTermExit(null);
      setTermTruncated(false);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleWaitExitTerminal() {
    if (!termId) return;
    try {
      const resp = await wsFirst('terminal.waitForExit', { terminalId: termId });
      setTermExit(resp.exitStatus ?? null);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  async function handleSelectModel() {
    try {
      if (!selectedModelId) return;
      await wsFirst('model.select', { sessionId, modelId: selectedModelId });
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  return (
    <div className="space-y-6">
      {/* Connect Panel */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">ACP Connect</h2>
          <div className="text-xs text-muted-foreground">{init ? 'Initialized' : 'Not initialized'}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Agent Command (optional)</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" placeholder="auto: local claude-code-acp" value={agentCmd} onChange={(e) => setAgentCmd(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Anthropic API Key</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Working Directory</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Proxy URL (optional)</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="http://localhost:7890" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button disabled={!canConnect} onClick={handleConnect} className="inline-flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Connect
          </Button>
        </div>
        {init && (
          <div className="mt-3 text-xs text-muted-foreground">
            <div>Protocol: {init.protocolVersion}</div>
            <div>Auth Methods: {init.authMethods.map((m) => m.name).join(', ') || 'None'}</div>
          </div>
        )}
      </div>

      {/* Auth Panel */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Authentication</h2>
          <div className="text-xs text-muted-foreground">{authMethods.length ? `${authMethods.length} methods` : 'No methods'}</div>
        </div>
        <div className="flex gap-2 items-end">
          <select
            className="border border-input rounded px-2 py-1 text-sm"
            value={selectedAuthMethod}
            onChange={(e) => setSelectedAuthMethod(e.target.value)}
          >
            {authMethods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <Button onClick={handleAuthenticate} disabled={!authMethods.length}>Authenticate</Button>
          <Button variant="secondary" onClick={() => refreshAuthMethods()}>Refresh Methods</Button>
        </div>
      </div>

      {/* Terminal (optional) */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Terminal</h2>
          <div className="text-xs text-muted-foreground">{termId ? `ID: ${termId}` : 'No terminal'}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Command</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={termCmd} onChange={(e) => setTermCmd(e.target.value)} placeholder="node -v" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Args (space-separated)</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={termArgs} onChange={(e) => setTermArgs(e.target.value)} placeholder="" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <button onClick={handleCreateTerminal} className="px-3 py-1 border border-input rounded text-sm hover:bg-muted" disabled={!termCmd || !!termId}>Start</button>
          <button onClick={handleReadTerminal} className="px-3 py-1 border border-input rounded text-sm hover:bg-muted" disabled={!termId}>Refresh</button>
          <button onClick={handleKillTerminal} className="px-3 py-1 border border-input rounded text-sm hover:bg-muted" disabled={!termId}>Kill</button>
          <button onClick={handleReleaseTerminal} className="px-3 py-1 border border-input rounded text-sm hover:bg-muted" disabled={!termId}>Release</button>
          <button onClick={handleWaitExitTerminal} className="px-3 py-1 border border-input rounded text-sm hover:bg-muted" disabled={!termId || !!termExit}>Wait Exit</button>
          {termExit && (
            <span className="text-xs text-muted-foreground">exitCode: {String(termExit.exitCode ?? '')} signal: {String(termExit.signal ?? '')}</span>
          )}
          {termTruncated && (
            <span className="text-xs text-amber-600">(output truncated)</span>
          )}
        </div>
        <div className="mt-2">
          <pre className="text-xs bg-background p-2 rounded border border-border max-h-48 overflow-auto whitespace-pre-wrap">{termOutput}</pre>
        </div>
      </div>

      {/* Session Controls */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Session</h2>
          <div className="text-xs text-muted-foreground">Current: {sessionId || '(none)'}{lastSession ? ` • Last: ${lastSession.slice(0,8)}…` : ''}</div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <Button onClick={handleNewSession} className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            New Session
          </Button>
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Mode</label>
            <select
              className="border border-input rounded px-2 py-1 text-sm"
              value={currentModeId || ''}
              onChange={(e) => handleSetMode(e.target.value)}
              disabled={!modes || !modes?.available_modes}
            >
              <option value="" disabled>
                {modes ? 'Select mode' : 'No modes'}
              </option>
              {modes?.available_modes?.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Model</label>
            <select
              className="border border-input rounded px-2 py-1 text-sm"
              value={selectedModelId || ''}
              onChange={(e) => setSelectedModelId(e.target.value)}
              disabled={!models.length}
            >
              <option value="" disabled>
                {models.length ? 'Select model' : 'No models'}
              </option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button onClick={handleSelectModel} disabled={!selectedModelId}>Apply</Button>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs font-medium mb-1">Saved Sessions</div>
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <div key={s.id} className={cn('px-2 py-1 rounded border text-xs flex items-center gap-2', s.id === sessionId ? 'bg-primary/10 border-primary' : 'border-border')}>
                <button onClick={() => handleSelectSession(s.id)} className="underline">{s.id.slice(0, 8)}…</button>
                <button onClick={() => handleDeleteSession(s.id)} title="Delete session" className="text-red-600">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt Composer */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Prompt</h2>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 min-h-[44px] max-h-40 resize-none rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder={'Type a message…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
          />
          <Button disabled={!canPrompt} onClick={handleSendPrompt} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>

      {/* Streaming Updates */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Streaming Updates</h2>
          <div className="text-xs text-muted-foreground">{updates.length} items</div>
        </div>
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {updates.length === 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              No updates yet. Connect and start a session.
            </div>
          )}
          {updates.map((u, idx) => {
            const t = u.type;
            const renderText = (text?: string) => text ? <div className="mt-1 whitespace-pre-wrap">{text}</div> : null;
            const renderList = (items?: any[]) => Array.isArray(items) && items.length ? (
              <ul className="mt-1 list-disc ml-4 space-y-1">
                {items.map((it, i) => <li key={i} className="whitespace-pre-wrap">{String(it.name || it.id || it.title || it)}</li>)}
              </ul>
            ) : null;
            const renderToolCallContent = (content: any[]) => (
              <div className="mt-1 space-y-1">
                {content.map((c, i) => {
                  if (!c) return null;
                  if (c.type === 'text' && typeof c.text === 'string') return <div key={i} className="whitespace-pre-wrap">{c.text}</div>;
                  if (c.type === 'resource_link' && typeof c.uri === 'string') return <div key={i}><a href={c.uri} target="_blank" rel="noreferrer" className="underline">{c.text || c.uri}</a></div>;
                  if (c.type === 'diff' && (c.diff?.newText || c.newText)) return (
                    <div key={i}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs opacity-70">{c.path || c.file || c.filepath || c.uri || '(unknown path)'}</div>
                        <button
                          className="px-2 py-0.5 border border-input rounded text-xs hover:bg-muted"
                          onClick={async () => {
                            try {
                              const pth = (typeof c.path === 'string' && c.path) || (typeof c.file === 'string' && c.file) || (typeof c.filepath === 'string' && c.filepath) || (typeof c.uri === 'string' && (c.uri.startsWith('file://') ? c.uri.replace(/^file:\/\//, '') : c.uri)) || '';
                              const body = { path: pth, newText: String(c.diff?.newText || c.newText || '') };
                              await wsFirst('diff.apply', body);
                              alert('Applied diff to ' + (pth || '(unknown path)'));
                            } catch (e: any) {
                              alert(e?.message || String(e));
                            }
                          }}
                        >Apply</button>
                      </div>
                      <pre className="mt-1 bg-muted p-2 rounded whitespace-pre-wrap">{String(c.diff?.newText || c.newText).slice(0, 2000)}</pre>
                    </div>
                  );
                  if (c.type === 'terminal' && c.output) return <pre key={i} className="bg-background p-2 rounded border border-border whitespace-pre-wrap">{String(c.output).slice(0, 2000)}</pre>;
                  return <pre key={i} className="text-muted-foreground overflow-auto whitespace-pre-wrap">{JSON.stringify(c)}</pre>;
                })}
              </div>
            );
            return (
              <div key={idx} className="border border-border rounded p-2 text-xs bg-background">
                <div className="font-medium">{t}</div>
                {/* Generic content text */}
                {renderText(u.content?.text || u.text)}
                {/* Specific handlers */}
                {t === 'plan' && renderList(u.plan?.entries || u.entries || [])}
                {t === 'available_commands_update' && renderList(u.available_commands || u.commands || [])}
                {t === 'token_usage' && (
                  <div className="mt-1 opacity-80">usedTokens: {u.usedTokens ?? u.used} / maxTokens: {u.maxTokens ?? u.max}</div>
                )}
                {(t === 'tool_call' || t === 'tool_call_update') && (
                  <div className="mt-1">
                    <div className="opacity-70">id: {u.tool_call?.id || u.id || '(n/a)'} • status: {u.tool_call?.status || u.status || '(n/a)'}</div>
                    {Array.isArray(u.tool_call?.content) && renderToolCallContent(u.tool_call.content)}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {/* Agent STDERR */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Agent STDERR</h2>
          <div className="text-xs text-muted-foreground">{stderrLog.length} lines</div>
        </div>
        <pre className="text-xs bg-background p-2 rounded border border-border max-h-48 overflow-auto whitespace-pre-wrap">
{stderrLog.join('\n')}
        </pre>
      </div>

      {/* Raw WS Events (debug) */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Raw Events</h2>
          <div className="text-xs text-muted-foreground">{eventLog.length} events</div>
        </div>
        <div className="text-xs grid grid-cols-1 gap-1 max-h-48 overflow-auto">
          {eventLog.slice(-100).map((e, i) => (
            <pre key={i} className="border border-border rounded p-2 bg-background overflow-auto whitespace-pre-wrap">{JSON.stringify(e)}</pre>
          ))}
        </div>
      </div>

      {/* Permission Modal */}
      {permissionReq && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4 w-[min(90vw,540px)] neo:rounded-none neo:border-[3px]">
            <div className="font-semibold mb-2">Permission Request</div>
            <div className="text-xs text-muted-foreground mb-2">The agent is requesting permission to run a tool.</div>
            <div className="space-y-1 text-sm">
              {(permissionReq.request?.options || []).map((opt: any) => (
                <button
                  key={opt.id}
                  className="w-full text-left border border-input rounded px-2 py-1 hover:bg-muted"
                  onClick={() => handlePermission('selected', opt.id)}
                >
                  {opt.name} ({opt.kind})
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => handlePermission('cancelled')}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ACPPage;
