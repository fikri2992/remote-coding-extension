import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { Button } from '@/components/ui/button';
import useConfirm from '@/lib/hooks/useConfirm';
import { cn } from '@/lib/utils';
import { Send, CircleDot, MoreHorizontal, X } from 'lucide-react';
import { MentionSuggestions } from '@/components/chat/MentionSuggestions';
import MessageBubble from '@/components/chat/MessageBubble';
import ToolCallsGroup from '@/components/chat/ToolCallsGroup';
import Markdown from '@/components/chat/Markdown';
import DiffBlock from '@/components/chat/DiffBlock';
import TerminalBlock from '@/components/chat/TerminalBlock';
import TextAttachmentBlock from '@/components/chat/TextAttachmentBlock';
import ContextChip from '@/components/chat/ContextChip';
import ModeChip from '@/components/chat/ModeChip';
import ModelPickerSheet from '@/components/chat/ModelPickerSheet';
import { useToast } from '@/components/ui/toast';

// ContentBlock shape aligned with ACP
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource_link'; uri: string; text?: string }
  | { type: 'resource'; resource: { text: string; uri: string; mimeType?: string } | { blob: string; mimeType?: string; uri: string } }
  | { type: 'diff'; path?: string; newText?: string; diff?: { newText?: string } }
  | { type: 'terminal'; output?: string; terminalId?: string; id?: string };

type SessionUpdate = { type: string; [k: string]: any };

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  parts: ContentBlock[];
  meta?: Record<string, any>;
  ts: number;
};

type ContextItem = { id: string; type: 'file'; path: string; label: string; size?: number };

export const ChatPage: React.FC = () => {
  const { addMessageListener, sendAcp, isConnected, sendJson, connect } = useWebSocket() as any;
  const { show } = useToast();

  // Auto-connect/session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  // Modes/Models
  const [modes, setModes] = useState<any | null>(null);
  const [currentModeId, setCurrentModeId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirm, ConfirmUI] = useConfirm();
  // Group open persisted per thread
  // Track the selected thread independently of agent session id
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [toolsGroupOpen, setToolsGroupOpen] = useState<boolean>(false);
  const [openToolMap, setOpenToolMap] = useState<Record<string, boolean>>({});

  // Persist group open preference per thread
  useEffect(() => {
    const key = activeThreadId ? `chatToolsGroupOpen:${activeThreadId}` : 'chatToolsGroupOpen';
    try {
      const v = localStorage.getItem(key);
      if (v === '1') setToolsGroupOpen(true);
      else if (v === '0') setToolsGroupOpen(false);
      else setToolsGroupOpen(false);
    } catch {}
  }, [activeThreadId]);

  // Per-call open/close persisted per session
  useEffect(() => {
    const key = activeThreadId ? `chatToolOpenMap:${activeThreadId}` : 'chatToolOpenMap';
    try {
      const raw = localStorage.getItem(key);
      if (raw) setOpenToolMap(JSON.parse(raw));
      else setOpenToolMap({});
    } catch { setOpenToolMap({}); }
  }, [activeThreadId]);

  const handleToolOpenChange = (id: string, open: boolean) => {
    setOpenToolMap((prev) => {
      const next = { ...prev, [id]: open } as Record<string, boolean>;
      try {
        const key = activeThreadId ? `chatToolOpenMap:${activeThreadId}` : 'chatToolOpenMap';
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Composer
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionItems, setMentionItems] = useState<Array<{ key: string; label: string; path: string }>>([]);


  // Messages & updates
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [updates, setUpdates] = useState<SessionUpdate[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  // Cached tool-call metadata by id, used to backfill missing fields on later updates
  const toolCallsByIdRef = useRef<Record<string, { kind?: string; name?: string; title?: string }>>({});

  // Context chips
  const [selectedContext, setSelectedContext] = useState<ContextItem[]>([]);

  // Permission modal
  const [permissionReq, setPermissionReq] = useState<{ requestId: number; request: any } | null>(null);

  // FS results for mention search (workspace root only for now)
  const [fsResults, setFsResults] = useState<Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>>([]);
  const [gitChangedFiles, setGitChangedFiles] = useState<string[]>([]);
  const [threads, setThreads] = useState<Array<{ id: string; title?: string; createdAt: string; updatedAt: string }>>([]);
  const [threadName, setThreadName] = useState<string>('Default Chat');

  const canPrompt = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const wsFirst = async <T = any,>(op: string, payload: any): Promise<T> => await sendAcp(op, payload);

  // Auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  // WS listener: parse ACP updates into messages; capture permissions
  useEffect(() => {
    const unsub = addMessageListener((msg: any) => {
      if (!msg) return;
      if (msg.type === 'session_update') {
        const update = normalizeUpdateShape(msg.update);
        setUpdates((prev: any) => [...prev, update]);
        try { mapUpdateToMessages(update, setMessages); } catch {}
        // track current mode id updates
        if ((update as any).type === 'current_mode_update' && (update as any).current_mode_id) {
          setCurrentModeId((update as any).current_mode_id);
        } else if ((update as any).type === 'mode_updated' && ((update as any).modeId || (update as any).mode_id)) {
          const mId = (update as any).modeId || (update as any).mode_id;
          setCurrentModeId(mId);
        }
      } else if (msg.type === 'session_recovered') {
        // Adopt new session id when server recovered from missing session
        const newId = msg.newSessionId || msg.sessionId;
        if (newId && typeof newId === 'string') {
          setSessionId(newId);
          // Treat recovered session as the active thread id
          try {
            setActiveThreadId(newId);
            localStorage.setItem('chat:activeThreadId', newId);
          } catch {}
          // Best-effort refresh threads and current transcript for the new session
          try { refreshThreads(); } catch {}
          try { loadThreadHistory(newId); } catch {}
        }
      } else if (msg.type === 'permission_request') {
        setPermissionReq({ requestId: msg.requestId, request: msg.request });
      }
    });
    return unsub;
  }, [addMessageListener]);

  // Restore once after WebSocket connects
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (!isConnected || didRestoreRef.current) return;
    (async () => {
      if (connecting) return;
      setConnecting(true);
      try {
        try { connect?.(); } catch {}
        await safeConnect();
        // Try to restore the last selected thread from localStorage first
        let restored = null as string | null;
        try { restored = localStorage.getItem('chat:activeThreadId'); } catch {}
        if (restored) {
          try { setActiveThreadId(restored); } catch {}
          // Ensure backend associates this thread, and adopt its session id
          try {
            const sel = await wsFirst<any>('session.selectThread', { threadId: restored });
            const sid = (sel?.sessionId || sel?.session_id || sel?.data?.sessionId || sel?.data?.session_id || null) as string | null;
            if (sid) setSessionId(sid);
            // Capture modes if backend provides them
            const m = (sel?.modes || sel?.data?.modes) as any;
            if (m) {
              setModes(m);
              const cm = (m as any).current_mode_id || (m as any).currentModeId;
              if (cm) setCurrentModeId(cm);
            }
          } catch {}
          try { await loadThreadHistory(restored); } catch {}
        } else {
          // Fall back to server state (last session) if no persisted thread
          try {
            const st = await wsFirst<any>('session.state', {});
            const sid = (st?.sessionId || null) as string | null;
            if (sid) {
              setSessionId(sid);
              try { setActiveThreadId(sid); localStorage.setItem('chat:activeThreadId', sid); } catch {}
              try { await loadThreadHistory(sid); } catch {}
            }
            // Also restore modes if available from state()
            const m = (st?.modes as any) || null;
            if (m) {
              setModes(m);
              const cm = (m as any).current_mode_id || (m as any).currentModeId;
              if (cm) setCurrentModeId(cm);
            }
          } catch {}
          // As an offline-friendly fallback, try local last-session id
          if (!sessionId) {
            try {
              const last = localStorage.getItem('chat:lastSessionId');
              if (last) {
                setSessionId(last);
                try { setActiveThreadId(last); localStorage.setItem('chat:activeThreadId', last); } catch {}
                try { await loadThreadHistory(last); } catch {}
              }
            } catch {}
          }
        }
        // prime lists
        fetchGitStatus().catch(() => {});
        discoverFiles('/').catch(() => {});
        // load models if supported
        refreshModels().catch(() => {});
        // load threads list for picker
        refreshThreads().catch(() => {});
      } catch (e) {
        console.warn('[chat] auto-restore failed', e);
      } finally {
        didRestoreRef.current = true;
        setConnecting(false);
      }
    })();
  }, [isConnected]);

  // Persist last seen session id for faster local restore
  useEffect(() => {
    try {
      if (sessionId) localStorage.setItem('chat:lastSessionId', sessionId);
    } catch {}
  }, [sessionId]);

  async function safeConnect() {
    try { await wsFirst('connect', {}); } catch {}
  }

  // Minimal generic WS RPC for FS/Git
  function wsRpc<T = any>(type: 'fileSystem' | 'git', payload: any, timeoutMs = 10000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      let done = false;
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
      if (!sent) { try { unsub(); } catch {}; return reject(new Error('WebSocket send failed')); }
      const t = setTimeout(() => { if (!done) { try { unsub(); } catch {}; reject(new Error('Request timeout')); } }, timeoutMs);
      try { (t as any).unref?.(); } catch {}
    });
  }

  async function discoverFiles(pathStr: string) {
    try {
      const result = await wsRpc<any>('fileSystem', { fileSystemData: { operation: 'tree', path: pathStr, options: { depth: 4 } } });
      const all: any[] = [];
      const walk = (node: any) => {
        if (!node) return;
        if (Array.isArray(node.children)) {
          for (const ch of node.children) { all.push(ch); if (ch.children) walk(ch); }
        }
      };
      walk(result);
      const items = all.map((c: any) => ({ name: c.name, path: c.path, type: c.type, size: c.size }));
      setFsResults(items);
    } catch { setFsResults([]); }
  }

  async function openFileText(relPath: string): Promise<{ text?: string; size?: number }> {
    try {
      const res = await wsRpc<any>('fileSystem', { fileSystemData: { operation: 'open', path: relPath } }, 15000);
      if (res?.encoding === 'utf8' && typeof res?.content === 'string') return { text: res.content, size: res.size };
      return { text: undefined, size: res?.size };
    } catch { return {}; }
  }

  async function fetchGitStatus() {
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
    } catch { setGitChangedFiles([]); }
  }

  // Mentions
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

  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    const pos = typeof el.selectionStart === 'number' ? el.selectionStart : input.length;
    updateMentionSuggestions(input, pos);
  }, [input]);

  function updateMentionSuggestions(text: string, caret: number) {
    const m = detectMention(text, caret);
    if (!m) { setMentionOpen(false); return; }
    setMentionQuery(m.query);
    const fsItems = fsResults.map((n) => ({ key: `${n.type}:${n.path}`, label: n.type === 'directory' ? `${n.name}/` : n.name, path: n.path }));
    const gitItems = gitChangedFiles.map((p) => ({ key: `file:${p}`, label: p.split('/').pop() || p, path: p }));
    const map = new Map<string, { key: string; label: string; path: string }>();
    [...fsItems, ...gitItems].forEach((it) => map.set(it.key, it));
    const list = Array.from(map.values());
    const filtered = simpleFuzzy(m.query, list, 8);
    setMentionItems(filtered);
    setMentionOpen(true);
  }

  function acceptMentionSelection(item: { key: string; label: string; path: string }) {
    addCtx({ id: item.key, type: 'file', path: item.path, label: item.label });
    const el = inputRef.current; if (!el) return;
    const caret = el.selectionStart || input.length;
    const m = detectMention(input, caret); if (!m) return;
    const before = input.slice(0, m.start);
    const after = input.slice(m.end);
    const next = before + '@' + item.label + ' ' + after;
    setInput(next); setMentionOpen(false);
    try { setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = (before + '@' + item.label + ' ').length; }, 0); } catch {}
  }

  function simpleFuzzy<T extends { label: string; path?: string }>(query: string, items: T[], limit = 10): T[] {
    const q = (query || '').toLowerCase();
    const scored = items.map((it) => {
      const t = (it.label + ' ' + (it.path || '')).toLowerCase();
      const idx = t.indexOf(q);
      const s = q ? (idx >= 0 ? 100 - idx * 2 - (t.length - q.length) * 0.1 : -Infinity) : 0.1;
      return { it, s };
    }).filter(x => x.s > -Infinity).sort((a,b)=>b.s-a.s).slice(0, limit).map(x=>x.it);
    return scored;
  }

  function addCtx(item: ContextItem) {
    setSelectedContext((prev) => prev.find((p) => p.id === item.id) ? prev : [...prev, item]);
  }
  function removeCtx(id: string) { setSelectedContext((prev) => prev.filter((p) => p.id !== id)); }

  // Prompt send
  async function handleSend() {
    if (!canPrompt) return;
    const text = input.trim(); setInput(''); setSending(true);
    try {
      const prompt: ContentBlock[] = [{ type: 'text', text } as any];
      try { if (!threadName || threadName === 'Default Chat') setThreadName((text || '').slice(0, 10) + '...'); } catch {}
      // Attach selected context
      for (const ctx of selectedContext) {
        const opened = await openFileText(ctx.path);
        const uri = `file://${ctx.path}`;
        if (opened?.text && (opened.size ?? 0) <= 256 * 1024) prompt.push({ type: 'resource', resource: { text: opened.text, uri } } as any);
        else prompt.push({ type: 'resource_link', uri } as any);
      }
      // Local-echo user's message so it appears immediately
      try {
        const now = Date.now();
        setMessages((prev) => [...prev, { id: `local-${now}-${prev.length}`, role: 'user', parts: prompt, ts: now } as any]);
      } catch {}
      try {
        const resp: any = await wsFirst('prompt', { prompt });
        if (resp && typeof resp === 'object' && resp.success === false) {
          throw new Error(String(resp.error || 'prompt failed'));
        }
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (/not connected/i.test(msg) || /ACP service not available/i.test(msg)) {
          try { await wsFirst('connect', {}); } catch {}
          await wsFirst('prompt', { prompt });
        } else {
          throw e;
        }
      }
    } catch (err: any) {
      show({ title: 'Prompt Error', description: err?.message || String(err), variant: 'destructive' });
    } finally { setSending(false); }
  }

  async function handleCancel() {
    try { await wsFirst('cancel', { sessionId: sessionId || undefined }); } catch (e: any) { show({ title: 'Cancel Error', description: e?.message || String(e), variant: 'destructive' }); }
  }

  async function handlePermission(outcome: 'selected' | 'cancelled', optionId?: string) {
    if (!permissionReq) return;
    try { await wsFirst('permission', { requestId: permissionReq.requestId, outcome, optionId }); } catch (e: any) { show({ title: 'Permission Error', description: e?.message || String(e), variant: 'destructive' }); } finally { setPermissionReq(null); }
  }

  async function refreshModels() {
    if (!sessionId) return;
    try {
      const res = await wsFirst<any>('models.list', { sessionId });
      const list: string[] = Array.isArray(res?.models) ? res.models.map((m: any) => (typeof m === 'string' ? m : (m?.id || m?.name))).filter(Boolean) : [];
      setModels(list);
      // current model is not guaranteed to be returned; leave as-is
    } catch {}
  }

  async function handleSelectModel(modelId: string) {
    if (!sessionId) return;
    try { await wsFirst('model.select', { sessionId, modelId }); setCurrentModelId(modelId); setModelSheetOpen(false); } catch (e: any) { show({ title: 'Model Selection Error', description: e?.message || String(e), variant: 'destructive' }); }
  }

  async function handleSelectMode(modeId: string) {
    if (!sessionId) return;
    try { await wsFirst('session.setMode', { sessionId, modeId }); setCurrentModeId(modeId); setModeSheetOpen(false); } catch (e: any) { show({ title: 'Mode Selection Error', description: e?.message || String(e), variant: 'destructive' }); }
  }

  // Sessions picker helpers
  async function refreshThreads() {
    // Use sessions.list so UI reflects created/selected sessions even before updates exist
    try {
      const res = await wsFirst<any>('sessions.list', {});
      const list = Array.isArray(res?.sessions) ? res.sessions : [];
      setThreads(list);
    } catch { setThreads([]); }
  }

  // Helper: extract a session id from various response shapes
  function pickSessionId(res: any): string | null {
    try {
      if (!res || typeof res !== 'object') return null;
      // Common shapes we might receive
      if (typeof res.sessionId === 'string' && res.sessionId) return res.sessionId;
      if (typeof res.session_id === 'string' && res.session_id) return res.session_id;
      if (res.data && typeof res.data === 'object') {
        if (typeof res.data.sessionId === 'string' && res.data.sessionId) return res.data.sessionId;
        if (typeof res.data.session_id === 'string' && res.data.session_id) return res.data.session_id;
      }
      return null;
    } catch { return null; }
  }

  async function handleSelectSession(id: string) {
    try {
      const res = await wsFirst<any>('session.selectThread', { threadId: id });
      // Prefer server-reported session id; fall back to thread id for UI state
      const sid = pickSessionId(res) || id || null;
      try { setActiveThreadId(id); localStorage.setItem('chat:activeThreadId', id); } catch {}
      if (sid) setSessionId(sid);
      await loadThreadHistory(id);
      setSessionSheetOpen(false);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (/not connected/i.test(msg) || /ACP service not available/i.test(msg)) {
        try { await wsFirst('connect', {}); } catch {}
        try {
          const res2 = await wsFirst<any>('session.selectThread', { threadId: id });
          const sid2 = pickSessionId(res2) || id || null;
          try { setActiveThreadId(id); localStorage.setItem('chat:activeThreadId', id); } catch {}
          if (sid2) setSessionId(sid2);
          await loadThreadHistory(id);
          setSessionSheetOpen(false);
          return;
        } catch (e2: any) {
          show({ title: 'Session Selection Error', description: e2?.message || String(e2), variant: 'destructive' });
        }
      } else {
        show({ title: 'Session Selection Error', description: e?.message || String(e), variant: 'destructive' });
      }
    }
  }

  async function handleDeleteSession(id: string) {
    const ok = await confirm({
      title: 'Delete session?',
      description: 'This will remove the session’s local history and cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      confirmVariant: 'destructive',
    });
    if (!ok) return;
    try {
      const resp = await wsFirst<any>('session.delete', { sessionId: id });
      const nextId: string | null = (resp?.lastSessionId || null) as any;
      if (sessionId === id) {
        setSessionId(nextId);
        try {
          if (nextId) { setActiveThreadId(nextId); localStorage.setItem('chat:activeThreadId', nextId); }
          else { setActiveThreadId(null); localStorage.removeItem('chat:activeThreadId'); }
        } catch {}
        setMessages([]);
        if (nextId) {
          try {
            await wsFirst('session.select', { sessionId: nextId });
            await loadThreadHistory(nextId);
          } catch {}
        }
      }
      await refreshThreads();
    } catch (e: any) { show({ title: 'Session Deletion Error', description: e?.message || String(e), variant: 'destructive' }); }
  }

  async function handleNewSession() {
    try {
      const s = await wsFirst<any>('session.new', {});
      const sid = (s?.sessionId || s?.session_id) as string | undefined;
      if (s?.modes) {
        setModes(s.modes);
        const cm = s.modes.current_mode_id || s.modes.currentModeId;
        if (cm) setCurrentModeId(cm);
      }
      if (sid) {
        setSessionId(sid);
        try { setActiveThreadId(sid); localStorage.setItem('chat:activeThreadId', sid); } catch {}
        setMessages([]);
        setThreadName('Default Chat');
      }
      await refreshThreads();
      setSessionSheetOpen(false);
    } catch (e: any) { show({ title: 'New Session Error', description: e?.message || String(e), variant: 'destructive' }); }
  }

  // Render helpers
  function renderMessageParts(parts: any[]) {
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.type === 'text') return <Markdown key={i} className="prose prose-invert max-w-none text-sm leading-relaxed" text={String(part.text || '')} />;
          if (part.type === 'resource_link') { const uri = String(part.uri || ''); const name = uri.split('/').pop() || uri; return (<div key={i} className="text-xs"><a className="underline" href={uri} target="_blank" rel="noreferrer">@{name}</a></div>); }
          if (part.type === 'resource' && 'text' in (part.resource || {})) { const uri = String((part.resource as any).uri || ''); const name = uri ? (uri.split('/').pop() || uri) : 'context'; return (<TextAttachmentBlock key={i} label={name} text={String((part.resource as any).text || '')} initiallyCollapsed />); }
          if (part.type === 'diff' && (part.newText || part.diff?.newText)) { const path = part.path || part.file || part.filepath || part.uri || ''; const text = String(part.diff?.newText || part.newText || ''); return (<DiffBlock key={i} path={path || '(unknown path)'} diffText={text} initiallyCollapsed onApply={async () => { try { const pth = String(path || ''); await wsFirst('diff.apply', { path: pth, newText: text }); show({ title: 'Diff Applied', description: 'Applied diff to ' + (pth || '(unknown)'), variant: 'success' }); } catch (e: any) { show({ title: 'Diff Apply Error', description: e?.message || String(e), variant: 'destructive' }); } }} />); }
          if (part.type === 'terminal') { const out = typeof part.output === 'string' ? part.output : ''; if (out) return <TerminalBlock key={i} output={out} terminalId={String(part.terminalId || part.id || '') || undefined} initiallyCollapsed />; const tid = part.terminalId || part.id; return <div key={i} className="text-xs text-muted-foreground">[terminal]{tid ? ` (${tid})` : ''}</div>; }
          if (part.type === 'image') { try { const url = `data:${part.mimeType};base64,${part.data}`; return <img key={i} src={url} alt="image" className="max-w-full rounded border border-border" />; } catch { return <div key={i} className="text-xs text-muted-foreground">[image]</div>; } }
          if (part.type === 'audio') { try { const url = `data:${part.mimeType};base64,${part.data}`; return (<audio key={i} controls className="w-full"><source src={url} type={String(part.mimeType || 'audio/mpeg')} /></audio>); } catch { return <div key={i} className="text-xs text-muted-foreground">[audio]</div>; } }
          return <pre key={i} className="text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">{JSON.stringify(part, null, 2)}</pre>;
        })}
      </div>
    );
  }

  // Mapping updates → chat messages (normalized)
  function normalizeUpdateShape(u: any) {
    const unwrapContent = (c: any) => (c && c.type === 'content' && c.content ? c.content : c);
    const normalizeContentList = (list: any): any[] => Array.isArray(list) ? list.map(unwrapContent).filter(Boolean) : [];
    const t = u?.type || u?.sessionUpdate || u?.updateType;
    const nu: any = { ...u, type: t };
    if ('content' in u) {
      if (Array.isArray(u.content)) nu.content = normalizeContentList(u.content);
      else nu.content = unwrapContent(u.content);
    }
    if (t === 'tool_call' || t === 'tool_call_update') {
      if (u.tool_call && typeof u.tool_call === 'object') {
        const tc: any = { ...u.tool_call };
        if (!tc.id) tc.id = u.toolCallId || u.id;
        if (!tc.status && u.status) tc.status = u.status;
        if (!tc.name) tc.name = u.title || u.name || u.kind;
        if (!tc.kind && u.kind) tc.kind = u.kind;
        if (!tc.rawInput && u.rawInput) tc.rawInput = u.rawInput;
        if (!tc.locations && u.locations) tc.locations = u.locations;
        // normalize content list
        if (Array.isArray(tc.content)) tc.content = normalizeContentList(tc.content);
        else if (Array.isArray(u.content)) tc.content = normalizeContentList(u.content);
        else if (u.content) tc.content = normalizeContentList([u.content]);
        nu.tool_call = tc;
      } else {
        const toolCall = {
          id: u.toolCallId || u.id,
          status: u.status,
          name: u.title || u.name || u.kind,
          kind: u.kind,
          content: Array.isArray(u.content) ? normalizeContentList(u.content) : [],
          rawInput: u.rawInput,
          locations: u.locations,
        };
        nu.tool_call = toolCall;
      }
    }
    return nu;
  }

  function isNonEmptyBlock(b: any) {
    const isMeaningfulText = (t: any) => typeof t === 'string' && t.trim().length > 0 && t.trim().toLowerCase() !== '(no content)';
    return b && (b.type !== 'text' || isMeaningfulText(b.text));
  }

  // Format tool call "name" if it looks like a file path.
  // Goal: turn absolute paths like "C:\\...\\project\\src\\acp\\File.ts" into ".\\src\\acp\\File.ts"
  // and generic long paths into a short relative-looking tail like ".\\a\\b\\c" (or "./a/b/c" on slash style)
  function formatToolName(n: any): string {
    const s = (typeof n === 'string' ? n : (n ? String(n) : '')).trim();
    if (!s) return s;
    const hasSep = /[\\/]/.test(s);
    if (!hasSep) return s;
    const lower = s.toLowerCase();
    let idx = lower.indexOf('\\src\\');
    if (idx === -1) idx = lower.indexOf('/src/');
    if (idx >= 0) {
      // Keep the original slash style; prefix with .
      return '.' + s.slice(idx);
    }
    // Fallback: keep last 3 segments
    const parts = s.split(/[\\/]+/).filter(Boolean);
    const tail = parts.slice(Math.max(0, parts.length - 3));
    const sep = s.includes('\\') ? '\\' : '/';
    const dot = sep === '\\' ? '.\\' : './';
    return dot + tail.join(sep);
  }

  function buildToolCallParts(tc: any): ContentBlock[] {
    const headerBits: string[] = [];
    const rawKind = typeof tc?.kind === 'string' ? tc.kind.trim() : (tc?.kind ? String(tc.kind) : '');
    const rawName = typeof tc?.name === 'string' ? tc.name.trim() : (tc?.name ? String(tc.name) : '');
    const formattedName = rawName ? formatToolName(rawName) : '';
    const displayKind = rawKind || '';
    const displayName = formattedName || '';
    let title = '';
    if (displayKind && displayName && displayKind.toLowerCase() !== displayName.toLowerCase()) {
      title = `"${displayKind}" • ${displayName}`;
    } else if (displayKind) {
      title = `"${displayKind}"`;
    } else if (displayName) {
      title = `"${displayName}"`;
    } else {
      title = '"tool"';
    }
    const callId = tc?.id || tc?.toolCallId;
    headerBits.push(`[tool ${tc?.status || 'pending'}] ${title}` + (callId ? ` (${callId})` : ''));
    if (tc?.rawInput && typeof tc.rawInput === 'object') {
      const ri: any = tc.rawInput;
      if (ri.path) headerBits.push(`path: ${ri.path}`);
      if (ri.abs_path) headerBits.push(`abs_path: ${ri.abs_path}`);
      if (ri.pattern) headerBits.push(`pattern: ${ri.pattern}`);
      if (ri.glob) headerBits.push(`glob: ${ri.glob}`);
      if (ri.output_mode) headerBits.push(`output: ${ri.output_mode}`);
      if (ri.query) headerBits.push(`query: ${ri.query}`);
      if (ri.command) headerBits.push(`cmd: ${ri.command}`);
    }
    if (Array.isArray(tc?.locations) && tc.locations.length) headerBits.push(`${tc.locations.length} location(s)`);
    const parts: ContentBlock[] = [] as any;
    const header = headerBits.join(' • ');
    if (header) parts.push({ type: 'text', text: header } as any);
    const contentList = Array.isArray(tc?.content) ? tc.content : [];
    for (const c of contentList) { if (isNonEmptyBlock(c)) parts.push(c); }
    return parts;
  }

  function mapUpdateToMessages(update: any, push: React.Dispatch<React.SetStateAction<ChatMessage[]>>) {
    const now = Date.now();
    const mergeBlocks = (a: ContentBlock[], b: ContentBlock[]): ContentBlock[] => {
      const out = [...a];
      for (const p of b) {
        let dup = false;
        try { dup = out.some((x) => JSON.stringify(x) === JSON.stringify(p)); } catch {}
        if (!dup) out.push(p as any);
      }
      return out;
    };
    const add = (role: ChatMessage['role'], parts: ContentBlock[], meta?: any) =>
      push((prev) => {
        // Upsert tool calls by id so updates replace the same call
        const toolId = role === 'tool' ? (meta?.id || meta?.toolCallId || meta?.tool_id) : undefined;
        if (role === 'tool' && toolId) {
          const idx = prev.findIndex((m) => m.role === 'tool' && (m.meta?.id === toolId));
          if (idx >= 0) {
            const cur = prev[idx];
            const merged = mergeBlocks(cur.parts, parts);
            const next = [...prev];
            const mergedMeta: any = { ...(cur.meta || {}) };
            if (meta && typeof meta === 'object') {
              for (const k of Object.keys(meta)) {
                const v = (meta as any)[k];
                if (v !== undefined && v !== null) mergedMeta[k] = v;
              }
            }
            next[idx] = { ...cur, parts: merged, meta: mergedMeta, ts: now } as any;
            return next;
          }
        }
        // de-duplicate recent identical bubbles (helps with repeated plan/summary frames)
        const recent = prev.slice(-8);
        const isDup = recent.some((m) => {
          if (m.role !== role) return false;
          try { return JSON.stringify(m.parts) === JSON.stringify(parts); } catch { return false; }
        });
        if (isDup) return prev;
        return [...prev, { id: `${now}-${prev.length}`, role, parts, meta, ts: now }];
      });
    const t = update?.type;
    switch (t) {
      case 'user_message_chunk': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('user', list as any); break;
      }
      case 'user_message': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('user', list as any); break;
      }
      case 'agent_message_chunk': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('assistant', list as any); break;
      }
      case 'agent_message':
      case 'assistant_message': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('assistant', list as any); break;
      }
      case 'agent_thought_chunk': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('assistant', list as any, { thought: true }); break;
      }
      case 'message': {
        const role = (update.role || update.message?.role || '').toLowerCase();
        const c = update.content || update.message?.content;
        const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []);
        if (!list.length) break;
        if (role === 'user') add('user', list as any);
        else if (role === 'tool') add('tool', list as any);
        else add('assistant', list as any);
        break;
      }
      case 'tool_call':
      case 'tool_call_update': {
        let tc = update.tool_call || { id: update.toolCallId, status: update.status, name: update.title || update.name || update.kind, kind: update.kind, content: Array.isArray(update.content) ? update.content : [], rawInput: update.rawInput, locations: update.locations };
        // Backfill missing kind/name from cached metadata by id
        try {
          const key = tc?.id || update.toolCallId || update.id;
          if (key) {
            const prev = toolCallsByIdRef.current[key] || {};
            const merged = {
              kind: tc.kind || prev.kind,
              name: tc.name || prev.name || update.title || prev.title,
              title: update.title || prev.title,
            };
            toolCallsByIdRef.current[key] = merged;
            tc = { ...tc, kind: merged.kind, name: merged.name };
          }
        } catch {}
        const parts = buildToolCallParts(tc);
        if (parts.length) add('tool', parts, { id: tc?.id, status: tc?.status, name: tc?.name, kind: tc?.kind, title: (update as any)?.title });
        break;
      }
      case 'mode_updated': {
        // Suppress noisy mode-change system bubble; state is tracked elsewhere
        break;
      }
      case 'current_mode_update': {
        // Suppress noisy mode-change system bubble; state is tracked elsewhere
        break;
      }
      case 'plan': {
        // Hide initialization/plan announcements (e.g., init, pt-comments-review, security-review)
        break;
      }
      case 'available_commands_update': {
        // Hide available commands list from chat transcript
        break;
      }
      default: {
        const maybeText = update?.content?.text || update?.text; if (typeof maybeText === 'string' && maybeText.trim()) add('system', [{ type: 'text', text: String(maybeText) } as any]); break;
      }
    }
  }

  // Load existing transcript for a session id and map them into message bubbles
  async function loadThreadHistory(sid: string) {
    try {
      const thread = await wsFirst<any>('thread.get', { id: sid });
      const updatesArr: any[] = Array.isArray(thread?.updates) ? thread.updates : [];
      // Derive and set a human-readable thread name
      try {
        let name = (typeof thread?.title === 'string' && thread.title.trim()) ? thread.title.trim() : '';
        if (!name) {
          const pickText = (u: any): string | null => {
            try {
              if (!u) return null;
              const t = u?.type || u?.updateType;
              if (t === 'user_message') {
                const c = u.content;
                const list = Array.isArray(c) ? c : (c ? [c] : []);
                for (const it of list) {
                  if (!it) continue;
                  if (typeof it === 'string' && it.trim()) return it.trim();
                  if (typeof it?.text === 'string' && it.text.trim()) return it.text.trim();
                }
              } else if (t === 'message') {
                const role = (u.role || u.message?.role || '').toLowerCase();
                if (role === 'user') {
                  const c = u.content || u.message?.content;
                  const list = Array.isArray(c) ? c : (c ? [c] : []);
                  for (const it of list) {
                    if (!it) continue;
                    if (typeof it === 'string' && it.trim()) return it.trim();
                    if (typeof it?.text === 'string' && it.text.trim()) return it.text.trim();
                  }
                }
              }
            } catch {}
            return null;
          };
          for (const u of updatesArr) { const txt = pickText(u); if (txt) { name = txt.slice(0, 10) + '...'; break; } }
        }
        setThreadName(name || 'Default Chat');
      } catch { setThreadName('Default Chat'); }
      // Hide legacy synthetic markers like "Thread continued"
      const filtered = updatesArr.filter((raw: any) => {
        try {
          if (raw && raw.type === 'system' && typeof raw.text === 'string') {
            const t = raw.text.trim().toLowerCase();
            if (t === 'thread continued') return false;
          }
        } catch {}
        return true;
      });
      setMessages([]);
      try { setActiveThreadId(sid); localStorage.setItem('chat:activeThreadId', sid); } catch {}
      for (const raw of filtered) {
        try {
          const nu = normalizeUpdateShape(raw);
          // keep current mode id in sync when replaying
          if ((nu as any).type === 'current_mode_update' && (nu as any).current_mode_id) {
            setCurrentModeId((nu as any).current_mode_id);
          } else if ((nu as any).type === 'mode_updated' && ((nu as any).modeId || (nu as any).mode_id)) {
            const mId = (nu as any).modeId || (nu as any).mode_id;
            setCurrentModeId(mId);
          }
          mapUpdateToMessages(nu, setMessages);
        } catch {}
      }
    } catch (e) {
      try { console.warn('[chat] failed loading thread history', (e as any)?.message || String(e)); } catch {}
    }
  }

  return (
    <div className="flex flex-col h-[100svh] md:h-[100vh] overflow-hidden">
      {/* Header (hidden on mobile to save space; global app header remains) */}
      <div className="hidden sm:flex border-b border-border p-2 items-center justify-between gap-2 flex-none">
        {/* Left: thread name (keep minimal on mobile) */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs sm:text-sm font-medium truncate">{threadName || 'Default Chat'}</div>
        </div>
        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Full controls on sm+ */}
          <div className="hidden sm:flex items-center gap-2">
            <ModeChip modeId={currentModeId} hidden={!modes} onClick={() => setModeSheetOpen(true)} />
            <button
              className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted"
              onClick={() => { setSessionSheetOpen(true); refreshThreads().catch(()=>{}); refreshModels().catch(()=>{}); wsFirst('session.state', {}).catch(()=>{}); }}
            >
              Sessions
            </button>
            {!!models.length && (
              <button
                className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted"
                onClick={() => setModelSheetOpen(true)}
              >
                {currentModelId ? `Model: ${currentModelId}` : 'Model'}
              </button>
            )}
            <div className="text-xs text-muted-foreground">{connecting ? 'Connecting…' : (isConnected ? 'Connected' : 'Idle')}</div>
          </div>
          {/* Mobile: overflow menu */}
          <button
            className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-muted/40 hover:bg-muted"
            aria-label="More actions"
            onClick={() => setActionsOpen(true)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 space-y-2 sm:space-y-2 pb-12 sm:pb-0">
        {(() => {
          const nodes: React.ReactNode[] = [];
          for (let i = 0; i < messages.length; ) {
            const m = messages[i];
            if (m.role === 'tool') {
              const group: any[] = [];
              while (i < messages.length && messages[i].role === 'tool') {
                group.push(messages[i]);
                i++;
              }
              const items = group.map((tm) => {
                const meta: any = tm.meta || {};
                const parts = Array.isArray(tm.parts) && tm.parts.length > 0 && (tm.parts as any)[0]?.type === 'text' && String((tm.parts as any)[0].text || '').trim().toLowerCase().startsWith('[tool')
                  ? (tm.parts as any).slice(1)
                  : tm.parts;
                const id = meta.id || tm.id;
                const cached = id ? (toolCallsByIdRef.current[id] || {}) : {};
                const nameRaw = meta.name || cached.name || meta.title || cached.title;
                const name = nameRaw ? formatToolName(nameRaw) : nameRaw;
                const kind = meta.kind || cached.kind;
                return { id, name, status: meta.status, kind, content: renderMessageParts(parts as any) };
              });
              const running = items.some((it) => /running|in_progress|progress|execut/i.test(String(it.status || '')));
              nodes.push((
                <MessageBubble key={group[0].id + '-group'} role="tool">
                  <ToolCallsGroup
                    items={items}
                    open={toolsGroupOpen || running}
                    onOpenChange={(o) => {
                      setToolsGroupOpen(o);
                      try { const key = activeThreadId ? `chatToolsGroupOpen:${activeThreadId}` : 'chatToolsGroupOpen'; localStorage.setItem(key, o ? '1' : '0'); } catch {}
                    }}
                    openMap={openToolMap}
                    onItemOpenChange={handleToolOpenChange}
                  />
                </MessageBubble>
              ));
            } else {
              nodes.push((
                <MessageBubble key={m.id} role={m.role}>
                  {renderMessageParts(m.parts)}
                </MessageBubble>
              ));
              i++;
            }
          }
          return nodes;
        })()}
        <div ref={endRef} />
      </div>

      {/* Mention overlay - positioned right above composer */}
      {mentionOpen && (
        <div className="fixed z-[60] pointer-events-auto">
          {/* Desktop positioning - right above desktop composer */}
          <div className="hidden sm:block fixed bottom-[70px] left-2 right-2 sm:left-3 sm:right-3">
            <div className="max-w-md mb-1">
              <MentionSuggestions
                visible={mentionOpen}
                query={mentionQuery}
                items={mentionItems}
                onSelect={(it) => { acceptMentionSelection(it); }}
                onClose={() => setMentionOpen(false)}
                className="w-full"
              />
            </div>
          </div>
          {/* Mobile positioning - right above mobile composer */}
          <div className="sm:hidden fixed bottom-[45px] left-2 right-2">
            <div className="mb-1">
              <MentionSuggestions
                visible={mentionOpen}
                query={mentionQuery}
                items={mentionItems}
                onSelect={(it) => { acceptMentionSelection(it); }}
                onClose={() => setMentionOpen(false)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile floating actions button (replaces hidden header actions) */}
      <button
        className="sm:hidden fixed right-2 bottom-[60px] z-40 inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-muted/60 hover:bg-muted"
        aria-label="More actions"
        onClick={() => setActionsOpen(true)}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {/* Mobile composer (fixed) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border p-0.5 pb-[calc(env(safe-area-inset-bottom)+4px)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 min-h-[32px] max-h-28 resize-none rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder={'Type a message…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { try { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch {} }}
            rows={1}
          />
          <Button size="sm" disabled={!canPrompt} onClick={handleSend} className="inline-flex items-center justify-center w-9 h-9">
            <Send className="h-4 w-4" />
          </Button>
          {sending && (
            <Button size="sm" variant="secondary" onClick={handleCancel} aria-label="Cancel" className="inline-flex items-center justify-center w-9 h-9">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Composer - desktop/tablet */}
      <div className="hidden sm:block border-t border-border p-2 sm:p-3 pb-[env(safe-area-inset-bottom)] flex-none">
        {!sessionId && (
          <div className="mb-2 text-xs text-amber-600 bg-amber-600/10 border border-amber-600/30 rounded px-2 py-1">
            No active session. Start typing and Send to create one, or pick an existing session via the Sessions button.
          </div>
        )}
        {/* Context chips */}
        {selectedContext.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedContext.map((c) => (
              <ContextChip key={c.id} label={c.label} onRemove={() => removeCtx(c.id)} />
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 min-h-[40px] max-h-32 resize-none rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder={'Type a message…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { try { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch {} }}
            rows={1}
          />
          <Button size="sm" disabled={!canPrompt} onClick={handleSend} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
          {sending && (
            <Button size="sm" variant="secondary" onClick={handleCancel} aria-label="Cancel">
              <X className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Permission Modal */}
      {permissionReq && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4 w-[min(90vw,540px)]">
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
      {/* Model Picker */}
      <ModelPickerSheet
        open={modelSheetOpen}
        onClose={() => setModelSheetOpen(false)}
        models={models}
        current={currentModelId}
        onSelect={handleSelectModel}
      />
      {/* Sessions Picker */}
      {sessionSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSessionSheetOpen(false)} />
          <div className="relative bg-card border border-border rounded-t-lg md:rounded-lg w-full md:w-[560px] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Sessions</div>
              <Button variant="secondary" onClick={() => setSessionSheetOpen(false)}>Close</Button>
            </div>
            <div className="mb-4 flex gap-2 pr-2">
              <Button onClick={handleNewSession}>New Session</Button>
              <Button variant="secondary" onClick={() => refreshThreads()}>Refresh</Button>
              {/* Hide Modes control within session picker */}
              {!!models.length && (
                <Button variant="secondary" onClick={() => setModelSheetOpen(true)}>
                  {currentModelId ? `Model: ${currentModelId}` : 'Models'}
                </Button>
              )}
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-auto">
              {/* Modes list intentionally not shown in session picker */}

              {/* Models inline (like sessions) */}
              {models.length ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold opacity-70 px-1">Models</div>
                  {models.map((mid) => (
                    <div
                      key={mid}
                      className={cn(
                        'flex items-center gap-3 rounded px-3 py-2 border',
                        currentModelId === mid ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted'
                      )}
                    >
                      <button
                        className={cn('text-left text-sm flex-1', currentModelId === mid ? 'font-semibold' : 'font-normal')}
                        onClick={() => handleSelectModel(mid)}
                      >
                        {mid}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {threads.length === 0 && (
                <div className="text-xs text-muted-foreground">No sessions yet</div>
              )}
              {threads.map((t) => {
                const active = t.id === (activeThreadId || sessionId || '');
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'relative flex items-center gap-3 rounded px-3 py-2 border',
                      active ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted'
                    )}
                    aria-current={active ? 'true' : undefined}
                  >
                    {active && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l" aria-hidden />
                    )}
                    <ThreadListItem
                      key={t.id}
                      active={active}
                      id={t.id}
                      title={t.title}
                      timestamp={t.updatedAt || t.createdAt}
                      onSelect={handleSelectSession}
                      onRenamed={(id, name) => { try { setThreads(prev => prev.map(x => x.id === id ? { ...x, title: name } : x)); } catch {}; if ((activeThreadId || sessionId) === id) setThreadName(name || 'Default Chat'); }}
                      request={wsFirst}
                    />
                    <Button variant="secondary" size="sm" onClick={() => handleDeleteSession(t.id)}>Delete</Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Mobile overflow actions sheet */}
      {actionsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActionsOpen(false)} />
          <div className="relative bg-card border border-border rounded-t-2xl w-[calc(100%-1rem)] mx-auto p-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+16px)] space-y-3 shadow-lg">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-sm font-semibold">Chat Actions</div>
              <Button size="sm" variant="secondary" onClick={() => setActionsOpen(false)}>Close</Button>
            </div>
            <div className="flex flex-col gap-3">
              {modes && (
                <Button variant="secondary" onClick={() => { setModeSheetOpen(true); setActionsOpen(false); }}>
                  {currentModelId ? `Mode: ${currentModelId}` : 'Mode'}
                </Button>
              )}
              <Button onClick={() => { setSessionSheetOpen(true); refreshThreads().catch(()=>{}); refreshModels().catch(()=>{}); wsFirst('session.state', {}).catch(()=>{}); setActionsOpen(false); }}>
                Sessions
              </Button>
              {!!models.length && (
                <Button variant="secondary" onClick={() => { setModelSheetOpen(true); setActionsOpen(false); }}>
                  {currentModelId ? `Model: ${currentModelId}` : 'Models'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Global confirm dialog host */}
      <ConfirmUI />
      {/* Mode Picker (simple) */}
      {modeSheetOpen && modes && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModeSheetOpen(false)} />
          <div className="relative bg-card border border-border rounded-t-lg md:rounded-lg w-full md:w-[520px] p-4">
            <div className="font-semibold mb-2">Select Mode</div>
            <div className="space-y-1 max-h-[50vh] overflow-auto">
              {(modes.available_modes || modes.availableModes || []).map((m: any) => (
                <button key={m.id} className="w-full text-left border border-input rounded px-2 py-1 hover:bg-muted text-sm" onClick={() => handleSelectMode(m.id)}>
                  {m.name || m.id}{currentModeId === m.id ? ' (current)' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ThreadListItem: React.FC<{
  id: string;
  title?: string;
  timestamp: string;
  active?: boolean;
  onSelect: (id: string) => void;
  onRenamed: (id: string, name: string) => void;
  request: <T=any>(op: string, payload: any) => Promise<T>;
}> = ({ id, title, timestamp, active, onSelect, onRenamed, request }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState<string>(title || 'Default Chat');
  const lastTapRef = React.useRef<{ id: string; ts: number } | null>(null);

  React.useEffect(() => { setValue(title || 'Default Chat'); }, [title]);

  const commit = async () => {
    const name = (value || '').trim() || 'Default Chat';
    try { await request('thread.rename', { id, title: name }); onRenamed(id, name); } catch {}
    setEditing(false);
  };

  const handleTouch = () => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === id && (now - last.ts) < 300) {
      setEditing(true);
    }
    lastTapRef.current = { id, ts: now };
  };

  if (editing) {
    return (
      <div className={cn('flex-1 inline-flex items-start gap-2')}
           onDoubleClick={(e) => e.stopPropagation()}
           onTouchEnd={(e) => e.stopPropagation()}>
        {active && <CircleDot className="w-4 h-4 mt-[2px] text-primary" />}
        <input
          className={cn('flex-1 bg-transparent outline-none text-sm border-b border-input focus:border-primary')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') setEditing(false); }}
        />
        <div className="text-[11px] opacity-70 ml-2 mt-[2px]">{timestamp}</div>
      </div>
    );
  }

  return (
    <button
      className={cn('text-left text-sm flex-1 inline-flex items-start gap-2', active ? 'font-semibold' : 'font-normal')}
      onClick={() => onSelect(id)}
      onDoubleClick={() => setEditing(true)}
      onTouchEnd={handleTouch}
    >
      {active && <CircleDot className="w-4 h-4 mt-[2px] text-primary" />}
      <div className="min-w-0">
        <div className="truncate">{title || 'Default Chat'}</div>
        <div className="text-[11px] opacity-70">{timestamp}</div>
      </div>
    </button>
  );
};

export default ChatPage;
