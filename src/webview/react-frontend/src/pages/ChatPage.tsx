import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { Button } from '@/components/ui/button';
import useConfirm from '@/lib/hooks/useConfirm';
import { cn } from '@/lib/utils';
import { Send, CircleDot } from 'lucide-react';
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
  const { addMessageListener, sendAcp, isConnected, sendJson } = useWebSocket() as any;

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
  const [confirm, ConfirmUI] = useConfirm();
  const [collapseTools, setCollapseTools] = useState<boolean>(true);
  const [openToolMap, setOpenToolMap] = useState<Record<string, boolean>>({});

  // Persist tool-collapse preference per session
  useEffect(() => {
    const key = sessionId ? `chatToolsCollapsed:${sessionId}` : 'chatToolsCollapsed';
    try {
      const v = localStorage.getItem(key);
      if (v === '0') setCollapseTools(false);
      else if (v === '1') setCollapseTools(true);
      else setCollapseTools(true);
    } catch {}
  }, [sessionId]);

  // Per-call open/close persisted per session
  useEffect(() => {
    const key = sessionId ? `chatToolOpenMap:${sessionId}` : 'chatToolOpenMap';
    try {
      const raw = localStorage.getItem(key);
      if (raw) setOpenToolMap(JSON.parse(raw));
      else setOpenToolMap({});
    } catch { setOpenToolMap({}); }
  }, [sessionId]);

  const handleToolOpenChange = (id: string, open: boolean) => {
    setOpenToolMap((prev) => {
      const next = { ...prev, [id]: open } as Record<string, boolean>;
      try {
        const key = sessionId ? `chatToolOpenMap:${sessionId}` : 'chatToolOpenMap';
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
  const [mentionPos, setMentionPos] = useState<{ left: number; top: number } | null>(null);

  // Messages & updates
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [updates, setUpdates] = useState<SessionUpdate[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Context chips
  const [selectedContext, setSelectedContext] = useState<ContextItem[]>([]);

  // Permission modal
  const [permissionReq, setPermissionReq] = useState<{ requestId: number; request: any } | null>(null);

  // FS results for mention search (workspace root only for now)
  const [fsResults, setFsResults] = useState<Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>>([]);
  const [gitChangedFiles, setGitChangedFiles] = useState<string[]>([]);
  const [threads, setThreads] = useState<Array<{ id: string; title?: string; createdAt: string; updatedAt: string }>>([]);

  const canPrompt = useMemo(() => !!sessionId && input.trim().length > 0 && !sending, [sessionId, input, sending]);

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

  // First time: auto-connect, create session, prime workspace data
  useEffect(() => {
    (async () => {
      if (connecting) return;
      setConnecting(true);
      try {
        await safeConnect();
        // Prefer last session if available; do not auto-create
        let sid: string | null = null;
        try {
          const last = await wsFirst<any>('session.last', {});
          sid = (last?.sessionId || last?.session_id || last?.id || null) as string | null;
        } catch {}
        // No new session is created automatically here
        if (sid) {
          setSessionId(sid);
          // Load existing transcript for this session into chat
          try { await loadThreadHistory(sid); } catch {}
        }
        // prime lists
        fetchGitStatus().catch(() => {});
        discoverFiles('/').catch(() => {});
        // load models if supported
        refreshModels().catch(() => {});
        // load threads list for picker
        refreshThreads().catch(() => {});
      } catch (e) {
        console.warn('[chat] auto-connect failed', e);
      } finally { setConnecting(false); }
    })();
  }, []);

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
      const result = await wsRpc<any>('fileSystem', { fileSystemData: { operation: 'tree', path: pathStr, options: { depth: 1 } } });
      const children = Array.isArray(result?.children) ? result.children : [];
      setFsResults(children.map((c: any) => ({ name: c.name, path: c.path, type: c.type, size: c.size })));
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
    // estimate caret overlay position
    try {
      const cs = getComputedStyle(el);
      const div = document.createElement('div');
      const marker = document.createElement('span');
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordWrap = 'break-word';
      const props = ['boxSizing','width','height','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','fontFamily','fontSize','lineHeight','letterSpacing','textTransform'] as const;
      props.forEach((p) => { (div.style as any)[p] = (cs as any)[p]; });
      div.textContent = input.substring(0, pos);
      marker.textContent = '\u200b';
      div.appendChild(marker);
      el.parentElement?.appendChild(div);
      const rect = marker.getBoundingClientRect();
      const host = el.getBoundingClientRect();
      setMentionPos({ left: rect.left - host.left + 4, top: rect.top - host.top + 18 });
      el.parentElement?.removeChild(div);
    } catch {}
  }, [input]);

  function updateMentionSuggestions(text: string, caret: number) {
    const m = detectMention(text, caret);
    if (!m) { setMentionOpen(false); return; }
    setMentionQuery(m.query);
    const fsItems = fsResults.filter((n) => n.type === 'file').map((n) => ({ key: `file:${n.path}`, label: n.name, path: n.path }));
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
      await wsFirst('prompt', { sessionId, prompt });
    } catch (err: any) {
      alert(err?.message || String(err));
    } finally { setSending(false); }
  }

  async function handleCancel() {
    try { await wsFirst('cancel', { sessionId: sessionId || undefined }); } catch (e: any) { alert(e?.message || String(e)); }
  }

  async function handlePermission(outcome: 'selected' | 'cancelled', optionId?: string) {
    if (!permissionReq) return;
    try { await wsFirst('permission', { requestId: permissionReq.requestId, outcome, optionId }); } catch (e: any) { alert(e?.message || String(e)); } finally { setPermissionReq(null); }
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
    try { await wsFirst('model.select', { sessionId, modelId }); setCurrentModelId(modelId); setModelSheetOpen(false); } catch (e: any) { alert(e?.message || String(e)); }
  }

  async function handleSelectMode(modeId: string) {
    if (!sessionId) return;
    try { await wsFirst('session.setMode', { sessionId, modeId }); setCurrentModeId(modeId); setModeSheetOpen(false); } catch (e: any) { alert(e?.message || String(e)); }
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

  async function handleSelectSession(id: string) {
    try {
      await wsFirst('session.select', { sessionId: id });
      setSessionId(id);
      await loadThreadHistory(id);
      setSessionSheetOpen(false);
    } catch (e: any) { alert(e?.message || String(e)); }
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
        setMessages([]);
        if (nextId) {
          try {
            await wsFirst('session.select', { sessionId: nextId });
            await loadThreadHistory(nextId);
          } catch {}
        }
      }
      await refreshThreads();
    } catch (e: any) { alert(e?.message || String(e)); }
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
        setMessages([]);
      }
      await refreshThreads();
      setSessionSheetOpen(false);
    } catch (e: any) { alert(e?.message || String(e)); }
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
          if (part.type === 'diff' && (part.newText || part.diff?.newText)) { const path = part.path || part.file || part.filepath || part.uri || ''; const text = String(part.diff?.newText || part.newText || ''); return (<DiffBlock key={i} path={path || '(unknown path)'} diffText={text} initiallyCollapsed onApply={async () => { try { const pth = String(path || ''); await wsFirst('diff.apply', { path: pth, newText: text }); alert('Applied diff to ' + (pth || '(unknown)')); } catch (e: any) { alert(e?.message || String(e)); } }} />); }
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
      const toolCall = u.tool_call || {
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
    return nu;
  }

  function isNonEmptyBlock(b: any) {
    const isMeaningfulText = (t: any) => typeof t === 'string' && t.trim().length > 0 && t.trim().toLowerCase() !== '(no content)';
    return b && (b.type !== 'text' || isMeaningfulText(b.text));
  }

  function buildToolCallParts(tc: any): ContentBlock[] {
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
            next[idx] = { ...cur, parts: merged, meta: { ...(cur.meta || {}), ...(meta || {}) }, ts: now } as any;
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
        const tc = update.tool_call || { id: update.toolCallId, status: update.status, name: update.title || update.name || update.kind, kind: update.kind, content: Array.isArray(update.content) ? update.content : [], rawInput: update.rawInput, locations: update.locations };
        const parts = buildToolCallParts(tc);
        if (parts.length) add('tool', parts, { id: tc?.id, status: tc?.status, name: tc?.name });
        break;
      }
      case 'mode_updated': {
        const mId = update.modeId || update.mode_id; if (mId) add('system', [{ type: 'text', text: `Mode: ${mId}` } as any]); break;
      }
      case 'current_mode_update': {
        const mId = update.current_mode_id || update.modeId || update.mode_id; if (mId) add('system', [{ type: 'text', text: `Mode: ${mId}` } as any]); break;
      }
      case 'plan': {
        const plan = update.plan; const text = (Array.isArray(plan?.entries) ? plan.entries.map((e: any) => `• ${e.name || e.id || e.title || ''}`).join('\n') : JSON.stringify(plan || {})); add('system', [{ type: 'text', text } as any]); break;
      }
      case 'available_commands_update': {
        const items = update.availableCommands || update.available_commands || update.commands || []; const text = Array.isArray(items) ? items.map((e: any) => `• ${e.name || e.id || ''}`).join('\n') : ''; add('system', [{ type: 'text', text } as any]); break;
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
      setMessages([]);
      for (const raw of updatesArr) {
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
    <div className="flex flex-col min-h-[80vh]">
      {/* Header (minimal) */}
      <div className="border-b border-border p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Chat</div>
          <ModeChip modeId={currentModeId} hidden={!modes} onClick={() => setModeSheetOpen(true)} />
          <button className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted" onClick={() => { setSessionSheetOpen(true); refreshThreads().catch(()=>{}); refreshModels().catch(()=>{}); }}>
            Sessions
          </button>
          <button
            className={cn(
              'text-xs px-2 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted',
              !collapseTools && 'bg-primary/10 border-primary'
            )}
            title="Toggle tool call visibility"
            onClick={() => setCollapseTools((v) => {
              const nv = !v;
              try { const key = sessionId ? `chatToolsCollapsed:${sessionId}` : 'chatToolsCollapsed'; localStorage.setItem(key, nv ? '1' : '0'); } catch {}
              return nv;
            })}
          >
            {collapseTools ? 'Tools: collapsed' : 'Tools: expanded'}
          </button>
          {!!models.length && (
            <button className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted" onClick={() => setModelSheetOpen(true)}>
              {currentModelId ? `Model: ${currentModelId}` : 'Model'}
            </button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{sessionId ? `Session: ${sessionId.slice(0,8)}…` : connecting ? 'Connecting…' : 'Idle'}</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
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
                return { id: meta.id || tm.id, name: meta.name, status: meta.status, content: renderMessageParts(parts as any) };
              });
              const running = items.some((it) => /running|in_progress|progress|execut/i.test(String(it.status || '')));
              nodes.push((
                <MessageBubble key={group[0].id + '-group'} role="tool">
                  <ToolCallsGroup items={items} initiallyOpen={!collapseTools || running} openMap={openToolMap} onItemOpenChange={handleToolOpenChange} />
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

      {/* Mention overlay */}
      <div className="pointer-events-none fixed z-50" style={{ left: (mentionPos?.left ?? 16) + 'px', bottom: '96px', right: 'auto' }} aria-hidden={!mentionOpen}>
        <MentionSuggestions
          visible={mentionOpen}
          query={mentionQuery}
          items={mentionItems}
          onSelect={(it) => { acceptMentionSelection(it); }}
          onClose={() => setMentionOpen(false)}
        />
      </div>

      {/* Composer - pinned to bottom by flex layout */}
      <div className="border-t border-border p-3">
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
            className="flex-1 min-h-[44px] max-h-40 resize-none rounded-lg border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder={'Type a message…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
          />
          <Button disabled={!canPrompt} onClick={handleSend} className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send
          </Button>
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
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
              {!!(modes && (modes.available_modes || modes.availableModes)?.length) && (
                <Button variant="secondary" onClick={() => setModeSheetOpen(true)}>
                  {currentModeId ? `Mode: ${currentModeId}` : 'Modes'}
                </Button>
              )}
              {!!models.length && (
                <Button variant="secondary" onClick={() => setModelSheetOpen(true)}>
                  {currentModelId ? `Model: ${currentModelId}` : 'Models'}
                </Button>
              )}
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-auto">
              {/* Modes inline (like sessions) */}
              {modes && (modes.available_modes || modes.availableModes)?.length ? (
                <div className="space-y-1">
                  <div className="text-xs font-semibold opacity-70 px-1">Modes</div>
                  {(modes.available_modes || modes.availableModes || []).map((m: any) => (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center gap-3 rounded px-3 py-2 border',
                        currentModeId === m.id ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted'
                      )}
                    >
                      <button
                        className={cn('text-left text-sm flex-1', currentModeId === m.id ? 'font-semibold' : 'font-normal')}
                        onClick={() => handleSelectMode(m.id)}
                      >
                        {m.name || m.id}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

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
                const active = t.id === sessionId;
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
                    <button
                      className={cn('text-left text-sm flex-1 inline-flex items-start gap-2', active ? 'font-semibold' : 'font-normal')}
                      onClick={() => handleSelectSession(t.id)}
                    >
                      {active && <CircleDot className="w-4 h-4 mt-[2px] text-primary" />}
                      <div className="min-w-0">
                        <div className="truncate">{t.title || t.id}</div>
                        <div className="text-[11px] opacity-70">{t.updatedAt || t.createdAt}</div>
                      </div>
                    </button>
                    <Button variant="secondary" size="sm" onClick={() => handleDeleteSession(t.id)}>Delete</Button>
                  </div>
                );
              })}
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

export default ChatPage;
