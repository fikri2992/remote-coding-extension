import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/components/WebSocketProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import { MentionSuggestions } from '@/components/chat/MentionSuggestions';
import MessageBubble from '@/components/chat/MessageBubble';
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
        const s = await wsFirst<any>('session.new', {});
        if (s?.sessionId) setSessionId(s.sessionId);
        if (s?.modes) {
          setModes(s.modes);
          const cm = s.modes.current_mode_id || s.modes.currentModeId;
          if (cm) setCurrentModeId(cm);
        }
        // prime lists
        fetchGitStatus().catch(() => {});
        discoverFiles('/').catch(() => {});
        // load models if supported
        refreshModels().catch(() => {});
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
      await wsFirst('prompt', { sessionId, prompt });
    } catch (err: any) {
      const msg = err?.message || '';
      if (/Session not found/i.test(msg) || /no sessionId/i.test(msg)) {
        try { const resp = await wsFirst<any>('session.new', {}); if (resp?.sessionId) { setSessionId(resp.sessionId); await wsFirst('prompt', { sessionId: resp.sessionId, prompt: [{ type: 'text', text }] }); return; } } catch {}
      }
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

  // Render helpers
  function renderMessageParts(parts: any[]) {
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.type === 'text') return <div key={i} className="whitespace-pre-wrap text-sm leading-relaxed">{String(part.text || '')}</div>;
          if (part.type === 'resource_link') { const uri = String(part.uri || ''); const name = uri.split('/').pop() || uri; return (<div key={i} className="text-xs"><a className="underline" href={uri} target="_blank" rel="noreferrer">@{name}</a></div>); }
          if (part.type === 'resource' && 'text' in (part.resource || {})) { const uri = String((part.resource as any).uri || ''); const name = uri ? (uri.split('/').pop() || uri) : 'context'; return (<div key={i} className="border border-border rounded p-2"><div className="text-[10px] opacity-70 mb-1">@{name}</div><pre className="text-xs whitespace-pre-wrap">{String((part.resource as any).text || '').slice(0, 4000)}</pre></div>); }
          if (part.type === 'diff' && (part.newText || part.diff?.newText)) { const path = part.path || part.file || part.filepath || part.uri || ''; return (<div key={i} className="border border-border rounded"><div className="flex items-center justify-between px-2 py-1 bg-muted/40 text-xs"><div className="opacity-70 truncate">{path || '(unknown path)'}</div><button className="px-2 py-0.5 border border-input rounded text-xs hover:bg-muted" onClick={async () => { try { const pth = String(path || ''); const newText = String(part.diff?.newText || part.newText || ''); await wsFirst('diff.apply', { path: pth, newText }); alert('Applied diff to ' + (pth || '(unknown)')); } catch (e: any) { alert(e?.message || String(e)); } }}>Apply</button></div><pre className="p-2 text-xs whitespace-pre-wrap">{String(part.diff?.newText || part.newText).slice(0, 4000)}</pre></div>); }
          if (part.type === 'terminal') { const out = typeof part.output === 'string' ? part.output : ''; if (out) return <pre key={i} className="bg-background p-2 rounded border border-border whitespace-pre-wrap">{out.slice(0, 4000)}</pre>; const tid = part.terminalId || part.id; return <div key={i} className="text-xs text-muted-foreground">[terminal]{tid ? ` (${tid})` : ''}</div>; }
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
    const add = (role: ChatMessage['role'], parts: ContentBlock[], meta?: any) => push((prev) => [...prev, { id: `${now}-${prev.length}`, role, parts, meta, ts: now }]);
    const t = update?.type;
    switch (t) {
      case 'user_message_chunk': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('user', list as any); break;
      }
      case 'agent_message_chunk': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('assistant', list as any); break;
      }
      case 'agent_thought_chunk': {
        const c = update.content; const list = Array.isArray(c) ? c.filter(isNonEmptyBlock) : (isNonEmptyBlock(c) ? [c] : []); if (list.length) add('assistant', list as any, { thought: true }); break;
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

  return (
    <div className="flex flex-col min-h-[80vh]">
      {/* Header (minimal) */}
      <div className="border-b border-border p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Chat</div>
          <ModeChip modeId={currentModeId} hidden={!modes} onClick={() => setModeSheetOpen(true)} />
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
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role}>
            {renderMessageParts(m.parts)}
          </MessageBubble>
        ))}
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
