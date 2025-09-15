import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Plug, Send, Trash2, RefreshCw, FolderOpen, FileText, GitMerge, X, Search } from 'lucide-react';
import { MentionSuggestions } from '@/components/chat/MentionSuggestions';
import { fuzzySearch } from '@/lib/fuzzy';
import { SyntaxHighlighter } from '@/components/code/SyntaxHighlighter';
import { useToast } from '@/components/ui/toast';

// Minimal types aligned with backend ContentBlock shapes

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource_link'; uri: string; text?: string }
  // include uri on text resources to aid agent-side context linking
  | { type: 'resource'; resource: { text: string; uri: string; mimeType?: string } | { blob: string; mimeType?: string; uri: string } };

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

// Revamp: Chat-first layout with context panel and unified controls

const ACPPage: React.FC = () => {
  const { addMessageListener, sendAcp, isConnected, sendJson, registeredServices } = useWebSocket() as any;
  const { show } = useToast();
  const showIfNotTimeout = (title: string, description: any, variant: 'destructive' | 'default' | 'success' | 'info' = 'destructive') => {
    const msg = String(description ?? '');
    if (/timeout/i.test(msg)) return;
    show({ title, description, variant });
  };

  // Connect form state
  const [agentCmd, setAgentCmd] = useState('');
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionItems, setMentionItems] = useState<Array<{ key: string; label: string; path: string }>>([]);
  const [mentionPos, setMentionPos] = useState<{ left: number; top: number } | null>(null);
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
  const [agents, setAgents] = useState<Array<{ id: string; title: string; framing: string; envKeys?: string[] }>>([]);
  const [agentStatus, setAgentStatus] = useState<any>(null);
  // Active agent selection and env inputs
  const [activeAgentId, setActiveAgentId] = useState<string>('claude');
  const [envMap, setEnvMap] = useState<Record<string, string>>({});
  async function wsFirst<T = any>(op: string, payload: any): Promise<T> {
    // Always include agentId for multi-agent routing
    return await sendAcp(op, { agentId: activeAgentId || provider, ...(payload || {}) });
  }
  
  // Persist connect prefs (without API keys)
  const provider = (typeof window !== 'undefined' && window.location.pathname === '/gemini') ? 'gemini' : 'claude';
  const prefsKey = `acp_connect_prefs_v2_${provider}`;
  useEffect(() => {
    // Initialize selection from route provider on mount
    setActiveAgentId(provider);
  }, []);
  useEffect(() => {
    let savedRaw: string | null = null;
    try {
      savedRaw = localStorage.getItem(prefsKey);
      if (savedRaw) {
        const p = JSON.parse(savedRaw);
        let savedCmd = typeof p.agentCmd === 'string' ? p.agentCmd : '';
        // Migration: for Gemini route, switch legacy --experimental-acp to 'acp' subcommand
        try {
          const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
          if (path === '/gemini' && /gemini-cli/i.test(savedCmd) && /--experimental-acp/i.test(savedCmd)) {
            savedCmd = savedCmd.replace(/--experimental-acp/ig, 'acp');
            try { localStorage.setItem(prefsKey, JSON.stringify({ ...p, agentCmd: savedCmd })); } catch {}
          }
        } catch {}
        if (savedCmd) setAgentCmd(savedCmd);
        if (typeof p.cwd === 'string') setCwd(p.cwd);
        if (typeof p.proxyUrl === 'string') setProxyUrl(p.proxyUrl);
      }
    } catch {}
    // Apply route-based presets (non-destructive: only if no saved agentCmd)
    try {
      const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const noSaved = !savedRaw || !JSON.parse(savedRaw || '{}')?.agentCmd;
      if (noSaved) {
        if (path === '/gemini') {
          // Prefer npx to avoid global install assumptions
          setAgentCmd('npx -y @google/gemini-cli --experimental-acp');
        }
      }
    } catch {}
  }, []);

  // Load agents list and current status when WS is connected
  useEffect(() => {
    if (!isConnected) return;
    (async () => {
      try {
        const res = await (sendAcp as any)('agents.list', {});
        const list = Array.isArray(res?.agents) ? res.agents : [];
        setAgents(list);
        // Ensure activeAgentId is valid
        const ids = new Set(list.map((a: { id: any; }) => a.id));
        if (!ids.has(activeAgentId)) {
          if (ids.has(provider)) setActiveAgentId(provider);
          else if (list[0]?.id) setActiveAgentId(list[0].id);
        }
      } catch {}
      try {
        const s = await (sendAcp as any)('agent.status', { agentId: activeAgentId || provider });
        setAgentStatus(s);
      } catch {}
    })();
  }, [provider, isConnected]);

  // When agent changes, refresh status and reset env inputs for its keys
  useEffect(() => {
    (async () => {
      try { const s = await (sendAcp as any)('agent.status', { agentId: activeAgentId }); setAgentStatus(s); } catch {}
      const agent = agents.find(a => a.id === activeAgentId);
      const keys = (agent?.envKeys || []) as string[];
      setEnvMap(prev => {
        const next: Record<string, string> = {};
        for (const k of keys) next[k] = prev[k] || '';
        return next;
      });
    })();
  }, [activeAgentId, agents]);

  // When opening Gemini route, proactively disconnect any existing agent
  useEffect(() => {
    try {
      const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      if (path === '/gemini') {
        wsFirst('disconnect', {}).catch(() => {});
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(prefsKey, JSON.stringify({ agentCmd, cwd, proxyUrl })); } catch {}
  }, [agentCmd, cwd, proxyUrl]);

  // UI toggles
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  // debug and connection settings toggles can be added later if needed

  // Context panel (skeleton for now)
  type ContextItem = { id: string; type: 'file' | 'git_diff'; path?: string; label: string; size?: number; changed?: boolean };
  const [selectedContext, setSelectedContext] = useState<ContextItem[]>([]);
  const [ctxPreview, setCtxPreview] = useState<Record<string, { open: boolean; loading?: boolean; text?: string; size?: number }>>({});
  const [contextQuery, setContextQuery] = useState('/');
  const [fsResults, setFsResults] = useState<Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>>([]);
  const [gitChangedFiles, setGitChangedFiles] = useState<string[]>([]);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxTab, setCtxTab] = useState<'files' | 'git'>('files');
  const [threads, setThreads] = useState<Array<{ id: string; title?: string; updatedAt?: string }>>([]);
  const [selectedThreadId] = useState<string | null>(null);

  // Chat messages derived from streaming updates
  type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    parts: ContentBlock[];
    meta?: Record<string, any>;
    ts: number;
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Terminal (optional)
  const [termCmd, setTermCmd] = useState('');
  const [termArgs, setTermArgs] = useState('');
  const [termId, setTermId] = useState<string | null>(null);
  const [termOutput, setTermOutput] = useState<string>('');
  const [termTruncated, setTermTruncated] = useState<boolean>(false);
  const [termExit, setTermExit] = useState<{ exitCode?: number; signal?: string } | null>(null);

  // Auto-scroll new messages
  useEffect(() => {
    const el = endRef.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // WS subscriptions
  useEffect(() => {
    const unsub = addMessageListener(async (msg: any) => {
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
      // Filter to current agent if tagged
      if (msg.agentId && msg.agentId !== (activeAgentId || provider)) return;
      if (msg.type === 'agent_initialized' || msg.type === 'agent_exit') {
        try { const s = await (sendAcp as any)('agent.status', { agentId: activeAgentId || provider }); setAgentStatus(s); } catch {}
      }
      if (msg.type === 'agent_initialized') {
        setInit(msg.init as InitializeResponse);
        // refresh auth methods
        refreshAuthMethods().catch(() => {});
      } else if (msg.type === 'session_update') {
        // --- Normalization helpers for flexible agent payloads ---
        const unwrapContent = (c: any) => (c && c.type === 'content' && c.content ? c.content : c);
        const normalizeContentList = (list: any): any[] => Array.isArray(list) ? list.map(unwrapContent).filter(Boolean) : [];
        const isMeaningfulText = (t: any) => typeof t === 'string' && t.trim().length > 0 && t.trim().toLowerCase() !== '(no content)';
        const isNonEmptyBlock = (b: any) => b && (b.type !== 'text' || isMeaningfulText(b.text));
        const normalizeUpdateShape = (u: any) => {
          const t = u?.type || u?.sessionUpdate || u?.updateType;
          const nu: any = { ...u, type: t };
          if ('content' in u) {
            if (Array.isArray(u.content)) nu.content = normalizeContentList(u.content);
            else nu.content = unwrapContent(u.content);
          }
          if (t === 'tool_call' || t === 'tool_call_update') {
            const toolCall = u.tool_call || {
              id: u.toolCallId || u.id,
              status: u.status,
              name: u.title || u.name || u.kind,
              kind: u.kind,
              content: normalizeContentList(u.content),
              rawInput: u.rawInput,
              locations: u.locations,
            };
            nu.tool_call = toolCall;
          }
          return nu;
        };
        const buildToolCallParts = (tc: any): ContentBlock[] => {
          const headerBits: string[] = [];
          headerBits.push(`[tool ${tc?.status || 'pending'}] ${tc?.name || 'tool'}` + (tc?.id ? ` (${tc.id})` : ''));
          if (tc?.rawInput && typeof tc.rawInput === 'object') {
            if (tc.rawInput.path) headerBits.push(`path: ${tc.rawInput.path}`);
            if (tc.rawInput.abs_path) headerBits.push(`abs_path: ${tc.rawInput.abs_path}`);
          }
          if (Array.isArray(tc?.locations) && tc.locations.length) headerBits.push(`${tc.locations.length} location(s)`);
          const parts: ContentBlock[] = [] as any;
          const header = headerBits.join(' • ');
          if (header) parts.push({ type: 'text', text: header } as any);
          const contentList = Array.isArray(tc?.content) ? tc.content : [];
          for (const c of contentList.map(unwrapContent)) {
            if (isNonEmptyBlock(c)) parts.push(c);
          }
          return parts;
        };

        const rawUpdate: SessionUpdate = msg.update;
        const update: any = normalizeUpdateShape(rawUpdate);
        setUpdates((prev) => [...prev, update]);
        // Update mode state
        if ((update as any).type === 'current_mode_update' && (update as any).current_mode_id) {
          setCurrentModeId((update as any).current_mode_id);
        } else if ((update as any).type === 'mode_updated' && ((update as any).modeId || (update as any).mode_id)) {
          const mId = (update as any).modeId || (update as any).mode_id;
          setCurrentModeId(mId);
        }
        // Map streaming updates to chat messages (progressive disclosure)
        try {
          const now = Date.now();
          const pushMessage = (role: ChatMessage['role'], parts: ContentBlock[], meta?: any) => {
            setMessages((prev) => [...prev, { id: `${now}-${prev.length}`, role, parts, meta, ts: now }]);
          };
          switch ((update as any).type) {
            case 'user_message_chunk': {
              const cAny = (update as any).content as any;
              if (Array.isArray(cAny)) {
                const parts = cAny.filter(isNonEmptyBlock);
                if (parts.length) pushMessage('user', parts as any);
              } else if (isNonEmptyBlock(cAny)) {
                pushMessage('user', [cAny]);
              }
              break;
            }
            case 'agent_message_chunk': {
              const cAny = (update as any).content as any;
              if (Array.isArray(cAny)) {
                const parts = cAny.filter(isNonEmptyBlock);
                if (parts.length) pushMessage('assistant', parts as any);
              } else if (isNonEmptyBlock(cAny)) {
                pushMessage('assistant', [cAny]);
              }
              break;
            }
            case 'agent_thought_chunk': {
              const cAny = (update as any).content as any;
              if (Array.isArray(cAny)) {
                const parts = cAny.filter(isNonEmptyBlock);
                if (parts.length) pushMessage('assistant', parts as any, { thought: true });
              } else if (isNonEmptyBlock(cAny)) {
                pushMessage('assistant', [cAny], { thought: true });
              }
              break;
            }
            case 'tool_call':
            case 'tool_call_update': {
              const tc = (update as any).tool_call || {
                id: (update as any).toolCallId,
                status: (update as any).status,
                name: (update as any).title || (update as any).name || (update as any).kind,
                kind: (update as any).kind,
                content: Array.isArray((update as any).content) ? normalizeContentList((update as any).content) : [],
                rawInput: (update as any).rawInput,
                locations: (update as any).locations,
              };
              const parts = buildToolCallParts(tc);
              if (parts.length) pushMessage('tool', parts, { id: tc?.id, status: tc?.status, name: tc?.name });
              break;
            }
            case 'mode_updated': {
              const mId = (update as any).modeId || (update as any).mode_id;
              if (mId) pushMessage('system', [{ type: 'text', text: `Mode: ${mId}` } as any]);
              break;
            }
            case 'plan': {
              const plan = (update as any).plan;
              const text = (Array.isArray(plan?.entries) ? plan.entries.map((e: any) => `• ${e.name || e.id || e.title || ''}`).join('\n') : JSON.stringify(plan || {}));
              pushMessage('system', [{ type: 'text', text } as any]);
              break;
            }
            case 'available_commands_update': {
              const items = (update as any).availableCommands || (update as any).available_commands || (update as any).commands || [];
              const text = Array.isArray(items) ? items.map((e: any) => `• ${e.name || e.id || ''}`).join('\n') : '';
              pushMessage('system', [{ type: 'text', text } as any]);
              break;
            }
            default: {
              // Unknown updates: surface small status messages rather than flooding the chat
              const maybeText = (update as any).content?.text || (update as any).text;
              if (isMeaningfulText(maybeText)) {
                pushMessage('system', [{ type: 'text', text: String(maybeText) } as any]);
              }
              break;
            }
          }
        } catch {}
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
        // Also reflect as assistant output message in chat
        if (typeof msg.chunk === 'string' && msg.chunk.length) {
          const now = Date.now();
          setMessages((prev) => [...prev, { id: `${now}-${prev.length}`, role: 'assistant', parts: [{ type: 'text', text: msg.chunk } as any], ts: now, meta: { terminal: true } }]);
        }
        // If this matches current terminal panel, append live
        if (termId && msg.terminalId === termId && typeof msg.chunk === 'string') {
          setTermOutput((prev) => (prev || '') + msg.chunk);
        }
      }
      // agent_stderr / terminal_* are available via debug panel
    });
    return unsub;
  }, [addMessageListener, termId]);

  // Context: simple discovery hooks
  useEffect(() => {
    if (!isConnected) return;
    // On first connect, try to fetch git status for changed files
    fetchGitStatus().catch(() => {});
    // Also list workspace root
    discoverFiles(contextQuery).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Do not load sessions until WS is connected to avoid HTTP fallback
  // Also refresh once WS is connected to avoid HTTP fallback at startup
  useEffect(() => {
    if (isConnected) refreshSessions().catch(() => {});
  }, [isConnected]);
  // Auto-select last session when list refreshes
  useEffect(() => {
    if (!sessionId && lastSession) setSessionId(lastSession);
  }, [lastSession]);
  // Load threads on session change
  useEffect(() => {
    (async () => { try { const res = await wsFirst<any>('threads.list', { sessionId }); const list = Array.isArray(res?.threads) ? res.threads : []; setThreads(list.map((t: any) => ({ id: t.id || t.threadId || String(t), title: t.title, updatedAt: t.updatedAt }))); } catch { setThreads([]); } })();
  }, [sessionId]);

  // Poll terminal output when a terminal is active
  useEffect(() => {
    if (!termId) return;
    const h = setInterval(() => {
      handleReadTerminal().catch(() => {});
    }, 1000);
    return () => clearInterval(h);
  }, [termId]);

  // Update mention suggestions on input changes
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const pos = typeof el.selectionStart === 'number' ? el.selectionStart : input.length;
    updateMentionSuggestions(input, pos);
    // compute caret position for local overlay
    try {
      const cs = getComputedStyle(el);
      const div = document.createElement('div');
      const marker = document.createElement('span');
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordWrap = 'break-word';
      const props = ['boxSizing','width','height','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','fontFamily','fontSize','lineHeight','letterSpacing','textTransform'];
      // @ts-ignore
      props.forEach(p => (div.style[p] = cs[p]));
      div.textContent = input.substring(0, pos);
      marker.textContent = '\u200b';
      div.appendChild(marker);
      el.parentElement?.appendChild(div);
      const rect = marker.getBoundingClientRect();
      const host = el.getBoundingClientRect();
      setMentionPos({ left: rect.left - host.left + 4, top: rect.top - host.top + 18 });
      el.parentElement?.removeChild(div);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const canConnect = useMemo(() => !connecting, [connecting]);
  const canStartStop = useMemo(() => !!activeAgentId && isConnected, [activeAgentId, isConnected]);
  const canPrompt = useMemo(() => !!sessionId && input.trim().length > 0 && !sending, [sessionId, input, sending]);

  // Minimal generic WS RPC helper for non-ACP services
  async function wsRpc<T = any>(type: 'fileSystem' | 'git', payload: any, timeoutMs = 10000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      let done = false as boolean;
      const unsub = addMessageListener((msg: any) => {
        if (msg?.type !== type) return;
        if (msg?.id !== id) return;
        done = true;
        try { unsub(); } catch {}
        const ok = msg?.data?.ok !== false;
        if (!ok) return reject(new Error(String(msg?.data?.error || 'request failed')));
        resolve(msg?.data?.result ?? msg?.data?.gitData?.result ?? msg?.data);
      });
      const sent = sendJson({ type, id, data: payload });
      if (!sent) {
        try { unsub(); } catch {}
        return reject(new Error('WebSocket send failed'));
      }
      const t = setTimeout(() => {
        if (!done) {
          try { unsub(); } catch {}
          reject(new Error('Request timeout'));
        }
      }, timeoutMs);
      // Avoid Node warning on long timers in dev
      try { (t as any).unref?.(); } catch {}
    });
  }

  async function discoverFiles(pathStr: string) {
    setCtxLoading(true);
    try {
      const result = await wsRpc<any>('fileSystem', { fileSystemData: { operation: 'tree', path: pathStr, options: { depth: 1 } } });
      const children = Array.isArray(result?.children) ? result.children : [];
      setFsResults(children.map((c: any) => ({ name: c.name, path: c.path, type: c.type, size: c.size })));
    } catch (e) {
      setFsResults([]);
    } finally {
      setCtxLoading(false);
    }
  }

  async function openFileText(relPath: string): Promise<{ text?: string; size?: number }> {
    try {
      const res = await wsRpc<any>('fileSystem', { fileSystemData: { operation: 'open', path: relPath } }, 15000);
      if (res?.encoding === 'utf8' && typeof res?.content === 'string') {
        return { text: res.content, size: res.size };
      }
      return { text: undefined, size: res?.size };
    } catch {
      return {};
    }
  }

  async function toggleCtxPreview(item: ContextItem) {
    if (!item.id) return;
    setCtxPreview((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), open: !(prev[item.id]?.open) } }));
    const current = ctxPreview[item.id];
    if ((!current || !current.text) && item.path) {
      setCtxPreview((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), loading: true } }));
      const res = await openFileText(item.path);
      setCtxPreview((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] || {}), loading: false, text: res.text, size: res.size } }));
    }
  }

  async function fetchGitStatus() {
    const hasGit = Array.isArray(registeredServices) && registeredServices.includes('git');
    if (!hasGit) { setGitChangedFiles([]); return; }
    try {
      const result = await wsRpc<any>('git', { gitData: { operation: 'status', options: {} } });
      const changed = new Set<string>();
      if (result?.status) {
        (result.status.staged || []).forEach((f: string) => changed.add(f));
        (result.status.unstaged || []).forEach((f: string) => changed.add(f));
        (result.status.untracked || []).forEach((f: string) => changed.add(f));
        (result.status.conflicted || []).forEach((f: string) => changed.add(f));
      }
      setGitChangedFiles(Array.from(changed));
    } catch {
      setGitChangedFiles([]);
    }
  }

  function addCtx(item: ContextItem) {
    setSelectedContext((prev) => {
      if (prev.find((p) => p.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  function removeCtx(id: string) {
    setSelectedContext((prev) => prev.filter((p) => p.id !== id));
  }

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
      showIfNotTimeout('Authentication Error', e?.message || String(e), 'destructive');
    }
  }

  async function handleConnect() {
    if (!canConnect) { try { console.log('[acp] handleConnect: ignored (already connecting)'); } catch {}; return; }
    try { console.log('[acp] handleConnect: click', { activeAgentId, agentCmd, cwd, proxyUrl, envKeys: Object.keys(envMap||{}).length }); } catch {}
    setConnecting(true);
    try {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(envMap)) { if (String(v || '').trim()) env[k] = String(v).trim(); }
      const body = {
        agentCmd,
        env: Object.keys(env).length ? env : undefined,
        cwd: cwd.trim() || undefined,
        proxy: proxyUrl.trim() || undefined,
        // Force a fresh agent process to avoid any stale reuse
        forceRestart: true,
      };
      try { console.log('[acp] /api/connect body', body); } catch {}
      const resp = await (sendAcp as any)('connect', { agentId: activeAgentId || provider, ...body }, { timeoutMs: 120000 });
      try { console.log('[acp] /api/connect resp', resp); } catch {}
      if (resp?.debug) {
        try { console.log('[acp] /api/connect resp.debug', resp.debug); } catch {}
      }
      setInit(resp.init);
      try { await refreshAuthMethods(); } catch {}
      // Auto-start a fresh session for a seamless flow, but don't fail overall on auth or race conditions
      try { await handleNewSession(); } catch (err: any) {
        const msg = err?.message || '';
        if (err?.authRequired) {
          show({ title: 'Authentication Required', description: 'Open the Authentication panel to authorize, then start a session.', variant: 'default' });
        } else if (/not connected/i.test(msg)) {
          // Agent may still be warming up; allow user to retry
          show({ title: 'Agent Warming Up', description: 'Agent connected. Starting a session may take a moment. Try again shortly.', variant: 'default' });
        }
      }
    } catch (e: any) {
      try { console.error('[acp] handleConnect error', e); } catch {}
      showIfNotTimeout('Connection Error', e?.message || String(e), 'destructive');
    } finally {
      setConnecting(false);
    }
  }

  async function handleNewSession() {
    try {
      const resp = await wsFirst('session.new', { cwd: cwd.trim() || undefined });
      setSessionId(resp.sessionId);
            const m = resp.modes || null;
      const normModes = m ? {
        current_mode_id: m.current_mode_id || (m as any).currentModeId || (m as any).currentMode?.id || null,
        available_modes: (m as any).available_modes || (m as any).availableModes || (m as any).modes || []
      } : null;
      setModes(normModes);
      setCurrentModeId(normModes?.current_mode_id || null);
      await refreshSessions();
      // Try models
      const mdlRes = await wsFirst('models.list', { sessionId: resp.sessionId });
      setModels(Array.isArray(mdlRes.models) ? mdlRes.models : []);
    } catch (err: any) {
      if (err?.authRequired) {
        // show a minimal hint; full auth UI can be built later if needed
        show({ title: 'Authentication Required', description: 'Available methods: ' + (err?.authMethods?.map((m: any) => m.name).join(', ') || 'unknown'), variant: 'info' });
      } else {
        showIfNotTimeout('Session Error', err?.message || String(err), 'destructive');
      }
    }
  }

  // Disconnect logic inlined in connect area if needed
  async function handleSendPrompt() {
    if (!canPrompt) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const prompt: ContentBlock[] = [{ type: 'text', text }];
      // Attach selected context as resources (inline for small text files)
      for (const ctx of selectedContext) {
        if (ctx.type === 'file' && ctx.path) {
          // Try to inline content for small files, else link
          const opened = await openFileText(ctx.path);
          const uri = `file://${ctx.path}`;
          if (opened?.text && (opened.size ?? 0) <= 256 * 1024) {
            prompt.push({ type: 'resource', resource: { text: opened.text, uri } } as any);
          } else {
            prompt.push({ type: 'resource_link', uri });
          }
        }
      }
      try {
        await wsFirst('prompt', { sessionId, prompt });
      } catch (e: any) {
        const msg = e?.message || '';
        // Auto-recover if agent disconnected (e.g., gemini CLI exited after connect)
        if (/not connected/i.test(msg)) {
          try {
            const env: Record<string, string> = {};
            for (const [k, v] of Object.entries(envMap)) { if (String(v || '').trim()) env[k] = String(v).trim(); }
            const body = {
              agentCmd,
              env: Object.keys(env).length ? env : undefined,
              cwd: cwd.trim() || undefined,
              proxy: proxyUrl.trim() || undefined,
              forceRestart: true,
            };
            await (sendAcp as any)('connect', { agentId: activeAgentId || provider, ...body }, { timeoutMs: 120000 });
            const resp = await wsFirst('session.new', { cwd: cwd.trim() || undefined });
            if (resp?.sessionId) {
              setSessionId(resp.sessionId);
              await wsFirst('prompt', { sessionId: resp.sessionId, prompt });
              return;
            }
          } catch {}
        }
        throw e;
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (/Session not found/i.test(msg) || /no sessionId/i.test(msg)) {
        // Recover transparently by creating a new session and retrying once
        try {
          const resp = await wsFirst('session.new', { cwd: cwd.trim() || undefined });
          if (resp?.sessionId) {
            setSessionId(resp.sessionId);
            const prompt: ContentBlock[] = [{ type: 'text', text }];
            for (const ctx of selectedContext) {
              if (ctx.type === 'file' && ctx.path) {
                const opened = await openFileText(ctx.path);
                const uri = `file://${ctx.path}`;
                if (opened?.text && (opened.size ?? 0) <= 256 * 1024) prompt.push({ type: 'resource', resource: { text: opened.text, uri } } as any);
                else prompt.push({ type: 'resource_link', uri });
              }
            }
            await wsFirst('prompt', { sessionId: resp.sessionId, prompt });
            return;
          }
        } catch {}
      }
      if (err?.authRequired) {
        show({ title: 'Authentication Required', description: 'Available methods: ' + (err?.authMethods?.map((m: any) => m.name).join(', ') || 'unknown'), variant: 'info' });
      } else {
        showIfNotTimeout('Prompt Error', err?.message || String(err), 'destructive');
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    try {
      await wsFirst('cancel', { sessionId: sessionId || undefined });
    } catch (e: any) {
      showIfNotTimeout('Cancel Error', e?.message || String(e), 'destructive');
    }
  }

  async function handlePermission(outcome: 'selected' | 'cancelled', optionId?: string) {
    if (!permissionReq) return;
    try {
      await wsFirst('permission', { requestId: permissionReq.requestId, outcome, optionId });
    } catch (e: any) {
      showIfNotTimeout('Permission Error', e?.message || String(e), 'destructive');
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
      showIfNotTimeout('Session Selection Error', e?.message || String(e), 'destructive');
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await wsFirst('session.delete', { sessionId: id });
      if (sessionId === id) setSessionId(null);
      await refreshSessions();
    } catch (e: any) {
      showIfNotTimeout('Session Deletion Error', e?.message || String(e), 'destructive');
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
      showIfNotTimeout('Terminal Creation Error', e?.message || String(e), 'destructive');
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
      showIfNotTimeout('Terminal Kill Error', e?.message || String(e), 'destructive');
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
      showIfNotTimeout('Terminal Release Error', e?.message || String(e), 'destructive');
    }
  }

  async function handleWaitExitTerminal() {
    if (!termId) return;
    try {
      const resp = await wsFirst('terminal.waitForExit', { terminalId: termId });
      setTermExit(resp.exitStatus ?? null);
    } catch (e: any) {
      showIfNotTimeout('Terminal Wait Error', e?.message || String(e), 'destructive');
    }
  }

  async function handleSelectModel() {
    try {
      if (!selectedModelId) return;
      await wsFirst('model.select', { sessionId, modelId: selectedModelId });
    } catch (e: any) {
      showIfNotTimeout('Model Selection Error', e?.message || String(e), 'destructive');
    }
  }

  // --- Local session export/import (UI-only, not persisted server-side) ---
  function handleExportLocal() {
    try {
      const data = { sessionId, messages, selectedContext };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acp-session-${sessionId || 'unsaved'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { showIfNotTimeout('Export Failed', 'Failed to export session data', 'destructive'); }
  }

  async function handleImportLocal(file: File) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (Array.isArray(obj?.messages)) setMessages(obj.messages);
      if (Array.isArray(obj?.selectedContext)) setSelectedContext(obj.selectedContext);
      show({ title: 'Import Successful', description: 'Imported conversation locally. (Not persisted to server)', variant: 'success' });
    } catch (e: any) {
      showIfNotTimeout('Import Failed', e?.message || 'Import failed', 'destructive');
    }
  }

  // --- Chat render helpers ---
  function renderMessageParts(parts: any[]) {
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.type === 'text') {
            return <div key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{String(part.text || '')}</div>;
          }
          if (part.type === 'resource_link') {
            const uri = String(part.uri || '');
            const name = uri.split('/').pop() || uri;
            return (
              <div key={i} className="text-xs">
                <a className="underline" href={uri} target="_blank" rel="noreferrer">@{name}</a>
              </div>
            );
          }
          if (part.type === 'resource' && 'text' in (part.resource || {})) {
            const uri = String((part.resource as any).uri || '');
            const name = uri ? (uri.split('/').pop() || uri) : 'context';
            return (
              <div key={i} className="border border-border rounded p-2">
                {uri && (
                  <div className="text-[10px] opacity-70 mb-1">@{name}</div>
                )}
                <pre className="text-xs whitespace-pre-wrap">
{String((part.resource as any).text || '').slice(0, 4000)}
                </pre>
              </div>
            );
          }
          if (part.type === 'image') {
            try {
              const url = `data:${part.mimeType};base64,${part.data}`;
              return <img key={i} src={url} alt="image" className="max-w-full rounded border border-border" />;
            } catch { return <div key={i} className="text-xs text-muted-foreground">[image]</div>; }
          }
          if (part.type === 'audio') {
            try {
              const url = `data:${part.mimeType};base64,${part.data}`;
              return (
                <audio key={i} controls className="w-full">
                  <source src={url} type={String(part.mimeType || 'audio/mpeg')} />
                </audio>
              );
            } catch { return <div key={i} className="text-xs text-muted-foreground">[audio]</div>; }
          }
          if (part.type === 'terminal') {
            const out = typeof part.output === 'string' ? part.output : '';
            if (out) return <pre key={i} className="bg-background p-2 rounded border border-border whitespace-pre-wrap">{out.slice(0, 4000)}</pre>;
            const tid = part.terminalId || part.id;
            return <div key={i} className="text-xs text-muted-foreground">[terminal]{tid ? ` (${tid})` : ''}</div>;
          }
          if (part.type === 'diff' && (part.newText || part.diff?.newText)) {
            const path = part.path || part.file || part.filepath || part.uri || '';
            return (
              <div key={i} className="border border-border rounded">
                <div className="flex items-center justify-between px-2 py-1 bg-muted/40 text-xs">
                  <div className="opacity-70 truncate">{path || '(unknown path)'}</div>
                  <button
                    className="px-2 py-0.5 border border-input rounded text-xs hover:bg-muted"
                    onClick={async () => {
                      try {
                        const pth = String(path || '');
                        const newText = String(part.diff?.newText || part.newText || '');
                        await wsFirst('diff.apply', { path: pth, newText });
                        show({ title: 'Diff Applied', description: 'Applied diff to ' + (pth || '(unknown)'), variant: 'success' });
                      } catch (e: any) { showIfNotTimeout('Diff Apply Error', e?.message || String(e), 'destructive'); }
                    }}
                  >Apply</button>
                </div>
                <pre className="p-2 text-xs whitespace-pre-wrap">{String(part.diff?.newText || part.newText).slice(0, 4000)}</pre>
              </div>
            );
          }
          return <pre key={i} className="text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">{JSON.stringify(part, null, 2)}</pre>;
        })}
      </div>
    );
  }

  // reserved helper for message text aggregation (future use)

  // --- Mention handling ---
  function detectMention(text: string, caret: number): { query: string; start: number; end: number } | null {
    const upto = text.slice(0, caret);
    let i = upto.length - 1;
    while (i >= 0 && !['\n', '\r', '\t', ' '].includes(upto[i])) i--;
    const tokenStart = i + 1;
    if (text[tokenStart] !== '@') return null;
    const token = text.slice(tokenStart + 1, caret);
    if (token.includes('@') || token.includes(' ')) return null;
    return { query: token, start: tokenStart, end: caret };
  }

  function updateMentionSuggestions(text: string, caret: number) {
    const m = detectMention(text, caret);
    if (!m) { setMentionOpen(false); return; }
    setMentionQuery(m.query);
    const fsItems = fsResults.filter((n) => n.type === 'file').map((n) => ({ key: `file:${n.path}`, label: n.name, path: n.path }));
    const gitItems = gitChangedFiles.map((p) => ({ key: `file:${p}`, label: p.split('/').pop() || p, path: p }));
    const all = new Map<string, { key: string; label: string; path: string }>();
    for (const it of [...fsItems, ...gitItems]) all.set(it.key, it);
    const list = Array.from(all.values());
    const filtered = fuzzySearch(m.query, list, 8);
    setMentionItems(filtered);
    setMentionOpen(true);
  }

  function acceptMentionSelection(item: { key: string; label: string; path: string }) {
    addCtx({ id: item.key, type: 'file', path: item.path, label: item.label });
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart || input.length;
    const m = detectMention(input, caret);
    if (!m) return;
    const before = input.slice(0, m.start);
    const after = input.slice(m.end);
    const next = before + '@' + item.label + ' ' + after;
    setInput(next);
    setMentionOpen(false);
    try { setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = (before + '@' + item.label + ' ').length; }, 0); } catch {}
  }

  return (
    <div className="space-y-6">
      {/* Global mention overlay (fallback positioning) */}
      <div className="pointer-events-none fixed z-50" style={{ left: (mentionPos?.left ?? 16) + 'px', bottom: '96px', right: 'auto' }} aria-hidden={!mentionOpen}>
        <MentionSuggestions
          visible={mentionOpen}
          query={mentionQuery}
          items={mentionItems}
          onSelect={(it) => { acceptMentionSelection(it); }}
          onClose={() => setMentionOpen(false)}
        />
      </div>
      {/* Unified Chat + Context */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Unified Chat</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setContextPanelOpen(v => !v)} className="inline-flex items-center gap-2">
              {contextPanelOpen ? <X className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
              {contextPanelOpen ? 'Hide Context' : 'Show Context'}
            </Button>
          </div>
        </div>
        <div className={cn('grid gap-4', contextPanelOpen ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1')}>
          {contextPanelOpen && (
            <div className="lg:col-span-2 border border-border rounded p-2 neo:rounded-none neo:border-[3px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Context</div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={ctxTab === 'files' ? 'default' : 'secondary'} onClick={() => setCtxTab('files')}>Files</Button>
                  <Button size="sm" variant={ctxTab === 'git' ? 'default' : 'secondary'} onClick={() => { setCtxTab('git'); fetchGitStatus().catch(()=>{}); }}>Git</Button>
                </div>
              </div>
              {/* Files tab */}
              {ctxTab === 'files' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <input className="w-full border border-input rounded px-2 py-1 text-sm pr-7" value={contextQuery} onChange={(e) => setContextQuery(e.target.value)} placeholder="/ or /src or /docs" />
                      <Search className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-60" />
                    </div>
                    <Button size="sm" onClick={() => discoverFiles(contextQuery)} disabled={ctxLoading}>Go</Button>
                  </div>
                  <div className="max-h-56 overflow-auto divide-y">
                    {fsResults.map((n) => (
                      <div key={n.path} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {n.type === 'directory' ? <FolderOpen className="h-3.5 w-3.5 opacity-70" /> : <FileText className="h-3.5 w-3.5 opacity-70" />}
                          <div className="truncate" title={n.path}>{n.path}</div>
                        </div>
                        {n.type === 'file' ? (
                          <Button size="sm" onClick={() => addCtx({ id: `file:${n.path}`, type: 'file', path: n.path, label: n.path.split('/').pop() || n.path, size: n.size })}>Add</Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => discoverFiles(n.path)}>Open</Button>
                        )}
                      </div>
                    ))}
                    {fsResults.length === 0 && (
                      <div className="text-xs text-muted-foreground py-6 text-center">No items. Try another path.</div>
                    )}
                  </div>
                </div>
              )}
              {/* Git tab */}
              {ctxTab === 'git' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GitMerge className="h-4 w-4 opacity-70" />
                    <div className="text-xs text-muted-foreground">Changed files</div>
                  </div>
                  <div className="max-h-56 overflow-auto divide-y">
                    {gitChangedFiles.map((p) => (
                      <div key={p} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <div className="truncate" title={p}>{p}</div>
                        <Button size="sm" onClick={() => addCtx({ id: `file:${p}`, type: 'file', path: p, label: p.split('/').pop() || p, changed: true })}>Add</Button>
                      </div>
                    ))}
                    {gitChangedFiles.length === 0 && (
                      <div className="text-xs text-muted-foreground py-6 text-center">No changes detected.</div>
                    )}
                  </div>
                </div>
              )}
              {/* Selected context */}
              <div className="mt-3">
                <div className="text-xs font-medium mb-1">Selected</div>
                <div className="flex flex-wrap gap-1">
                  {selectedContext.map((c) => (
                    <div key={c.id} className="px-2 py-0.5 rounded border border-border text-xs flex items-center gap-1 bg-muted/40 neo:rounded-none neo:border-[2px]">
                      <span className="truncate max-w-[12rem]" title={c.label}>{c.label}</span>
                      <button className="opacity-70 hover:opacity-100" onClick={() => removeCtx(c.id)}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  {selectedContext.length === 0 && (
                    <div className="text-xs text-muted-foreground">None</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Chat column */}
          <div className={cn(contextPanelOpen ? 'lg:col-span-3' : 'col-span-1')}>
            <div className="border border-border rounded p-2 neo:rounded-none neo:border-[3px] min-h-[40vh] max-h-[60vh] overflow-auto space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  No messages yet. Connect and start a session.
                </div>
              )}
              {messages.map((m, idx) => (
                <div key={m.id} className={cn('border border-border rounded p-2 neo:rounded-none neo:border-[2px] group', m.role === 'user' ? 'bg-primary/5' : m.role === 'assistant' ? 'bg-muted/30' : m.role === 'tool' ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-background') }>
                  <div className="text-[11px] opacity-70 mb-1">{m.role}{m.meta?.thought ? ' • thought' : ''}</div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] mb-1">
                    <button className="underline mr-2" onClick={() => { try { navigator.clipboard?.writeText((m.parts||[]).map((p:any)=>p?.text||'').join('\n')); } catch {} }}>Copy</button>
                    <button className="underline mr-2" onClick={() => { const prevUser = [...messages].slice(0, idx+1).reverse().find(x=>x.role==='user'); const t = (prevUser?.parts||[]).map((p:any)=>p?.text||'').join('\n') || (m.parts||[]).map((p:any)=>p?.text||'').join('\n'); setInput(t); try { (inputRef.current as any)?.focus?.(); } catch {} }}>Retry</button>
                    <button className="underline" onClick={() => { const t = (m.parts||[]).map((p:any)=>p?.text||'').join('\n'); setInput(t); try { (inputRef.current as any)?.focus?.(); } catch {} }}>Edit</button>
                  </div>
                  {renderMessageParts(m.parts)}
                </div>
              ))}
              <div ref={endRef} />
            </div>
            {/* Composer */}
            <div className="mt-3 flex items-end gap-2">
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
        </div>
      </div>
      {/* History / Threads */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">History</h2>
          <div className="text-xs text-muted-foreground">{threads.length} threads</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {threads.map((t) => (
            <div key={t.id} className={cn('px-2 py-1 rounded border text-xs flex items-center gap-2', t.id === selectedThreadId ? 'bg-primary/10 border-primary' : 'border-border')}>
              <button onClick={async () => { try { const res = await wsFirst<any>('thread.get', { sessionId, threadId: t.id }); const msgs: any[] = Array.isArray(res?.messages) ? res.messages : []; const now = Date.now(); const converted: any[] = []; for (const msg of msgs) { if (msg?.role && Array.isArray(msg?.content)) { converted.push({ id: `${now}-${converted.length}`, role: msg.role, parts: msg.content, ts: now }); } } if (converted.length) setMessages(converted as any); } catch (e: any) { showIfNotTimeout('Thread Error', e?.message || 'Failed to open thread', 'destructive'); } }} className="underline">{(t.title || t.id).slice(0, 24)}</button>
            </div>
          ))}
          {threads.length === 0 && (
            <div className="text-xs text-muted-foreground">No threads yet.</div>
          )}
        </div>
      </div>

      {/* Context Previews */}
      {selectedContext.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Context Previews</h2>
            <div className="text-xs text-muted-foreground">{selectedContext.length} items</div>
          </div>
          <div className="space-y-2">
            {selectedContext.map((c) => (
              <div key={c.id} className="border border-border rounded p-2 neo:rounded-none neo:border-[2px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs truncate">@{c.label}</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => toggleCtxPreview(c)}>{ctxPreview[c.id]?.open ? 'Hide' : 'Preview'}</Button>
                    <button className="opacity-70 hover:opacity-100" onClick={() => removeCtx(c.id)}><X className="h-3 w-3" /></button>
                  </div>
                </div>
                {ctxPreview[c.id]?.open && (
                  <div className="mt-2">
                    {ctxPreview[c.id]?.loading ? (
                      <div className="text-[11px] opacity-60">Loading…</div>
                    ) : ctxPreview[c.id]?.text ? (
                      <div className="max-h-48 overflow-auto">
                        <SyntaxHighlighter code={ctxPreview[c.id]?.text || ''} language={undefined} showLineNumbers={false} className="text-xs" />
                      </div>
                    ) : (
                      <div className="text-[11px] opacity-60">No preview available</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect Panel */}
      <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[3px]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">ACP Connect</h2>
          <div className="text-xs text-muted-foreground">{agentStatus?.connected ? 'Agent: Connected' : 'Agent: Disconnected'}</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Agent</label>
            <select
              className="w-full border border-input rounded px-2 py-1 text-sm"
              value={activeAgentId}
              onChange={(e) => setActiveAgentId(e.target.value)}
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.title || a.id}</option>
              ))}
            </select>
            <div className="mt-1 text-[11px] text-muted-foreground">Framing: {agents.find(a=>a.id===activeAgentId)?.framing || 'n/a'}</div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Agent Command (optional)</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" placeholder={(typeof window !== 'undefined' && window.location.pathname === '/gemini') ? 'e.g. npx -y @google/gemini-cli --experimental-acp' : 'auto: local claude-code-acp'} value={agentCmd} onChange={(e) => setAgentCmd(e.target.value)} />
          </div>
          {(agents.find(a => a.id === activeAgentId)?.envKeys || []).map((k) => (
            <div key={k}>
              <label className="block text-xs text-muted-foreground mb-1">{k}</label>
              <input
                className="w-full border border-input rounded px-2 py-1 text-sm"
                type={/key|token|secret/i.test(k) ? 'password' : 'text'}
                value={envMap[k] ?? ''}
                onChange={(e) => setEnvMap(m => ({ ...m, [k]: e.target.value }))}
                placeholder={k}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Working Directory</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Proxy URL (optional)</label>
            <input className="w-full border border-input rounded px-2 py-1 text-sm" value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="http://localhost:7890" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <Button disabled={!canConnect} onClick={handleConnect} className="inline-flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Connect
          </Button>
          <Button variant="secondary" disabled={!canStartStop} onClick={async () => { try { await (sendAcp as any)('agent.start', { agentId: activeAgentId }); const s = await (sendAcp as any)('agent.status', { agentId: activeAgentId }); setAgentStatus(s); } catch {} }}>Start</Button>
          <Button variant="destructive" disabled={!canStartStop} onClick={async () => { try { await (sendAcp as any)('agent.stop', { agentId: activeAgentId }); const s = await (sendAcp as any)('agent.status', { agentId: activeAgentId }); setAgentStatus(s); } catch {} }}>Stop</Button>
          <Button variant="secondary" disabled={!activeAgentId || !isConnected} onClick={async () => { try { const s = await (sendAcp as any)('agent.status', { agentId: activeAgentId }); setAgentStatus(s); } catch {} }}>Refresh Status</Button>
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
              <label className="text-xs text-muted-foreground hidden">Mode</label>
            <select
              className="border border-input rounded px-2 py-1 text-sm"
              value={currentModeId || ''}
              onChange={() => { /* mode selection disabled */ }}
              disabled={true}
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
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium">Saved Sessions</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleExportLocal}>Export</Button>
              <input id="acp-import-json" type="file" accept="application/json" className="hidden" onChange={(e) => { const f=e.target.files?.[0]; if (f) handleImportLocal(f); (e.currentTarget as HTMLInputElement).value=''; }} />
              <Button size="sm" variant="secondary" onClick={() => { try { (document.getElementById('acp-import-json') as HTMLInputElement)?.click(); } catch {} }}>Import</Button>
            </div>
          </div>
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
            const t = (u as any).type || (u as any).sessionUpdate;
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
                  if (c.type === 'image' && c.data) {
                    try {
                      const url = `data:${c.mimeType};base64,${c.data}`;
                      return <img key={i} src={url} alt="image" className="max-w-full rounded border border-border" />;
                    } catch { return <div key={i} className="text-xs text-muted-foreground">[image]</div>; }
                  }
                  if (c.type === 'audio' && c.data) {
                    try {
                      const url = `data:${c.mimeType};base64,${c.data}`;
                      return (
                        <audio key={i} controls className="w-full">
                          <source src={url} type={String(c.mimeType || 'audio/mpeg')} />
                        </audio>
                      );
                    } catch { return <div key={i} className="text-xs text-muted-foreground">[audio]</div>; }
                  }
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
                              show({ title: 'Diff Applied', description: 'Applied diff to ' + (pth || '(unknown path)'), variant: 'success' });
                            } catch (e: any) {
                              showIfNotTimeout('Diff Apply Error', e?.message || String(e), 'destructive');
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
                {renderText((u as any).content?.text || (u as any).text)}
                {/* Specific handlers */}
                {t === 'plan' && renderList((u as any).plan?.entries || (u as any).entries || [])}
                {t === 'available_commands_update' && renderList((u as any).available_commands || (u as any).commands || [])}
                {t === 'token_usage' && (
                  <div className="mt-1 opacity-80">usedTokens: {(u as any).usedTokens ?? (u as any).used} / maxTokens: {(u as any).maxTokens ?? (u as any).max}</div>
                )}
                {(t === 'tool_call' || t === 'tool_call_update') && (() => {
                  const unwrap = (c: any) => (c && c.type === 'content' && c.content ? c.content : c);
                  const normList = (list: any) => Array.isArray(list) ? list.map(unwrap).filter(Boolean) : [];
                  const toolCall = (u as any).tool_call || { id: (u as any).toolCallId || (u as any).id, status: (u as any).status, content: normList((u as any).content), name: (u as any).title || (u as any).name || (u as any).kind, rawInput: (u as any).rawInput };
                  return (
                    <div className="mt-1">
                      <div className="opacity-70">id: {toolCall?.id || '(n/a)'} • status: {toolCall?.status || '(n/a)'}{toolCall?.name ? ` • ${toolCall.name}` : ''}{toolCall?.rawInput?.path ? ` • path: ${toolCall.rawInput.path}` : ''}</div>
                      {Array.isArray(toolCall?.content) && renderToolCallContent(toolCall.content)}
                    </div>
                  );
                })()}
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
