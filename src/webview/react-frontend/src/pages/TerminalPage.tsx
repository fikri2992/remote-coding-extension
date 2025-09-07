import React, { useEffect, useRef, useState } from 'react';
import { TerminalView } from '../components/terminal/TerminalView';
import { TerminalXterm, TerminalXtermHandle } from '../components/terminal/TerminalXterm';
import { TerminalActionBar } from '../components/terminal/TerminalActionBar';
import { useWebSocket } from '../components/WebSocketProvider';

const TerminalPage: React.FC = () => {
  const { sendJson, addMessageListener, isConnected } = useWebSocket();
  const [output, setOutput] = useState('');
  const [fallbackExec, setFallbackExec] = useState(false);
  const [engineBadge, setEngineBadge] = useState<null | { kind: 'pseudo-line' | 'pseudo-pipe' | 'fallback' | 'pty', label: string }>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [sessions, setSessions] = useState<Map<string, SessionInfo>>(new Map());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const termRef = useRef<TerminalXtermHandle | null>(null);
  const keepaliveRef = useRef<any>(null);
  const [showSessions, setShowSessions] = useState(false);

  interface SessionInfo {
    sessionId: string;
    persistent: boolean;
    status: 'active' | 'reconnecting' | 'disconnected';
    lastActivity: number;
    createdAt?: number;
    availableProviders?: string[];
  }

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'terminal') return;
      const data = msg.data || {};
      // Stage 2 PTY streaming
      if (data.op === 'create' && data.event === 'ready') {
        const sid = data.sessionId as string;
        activeSessionRef.current = sid;
        setCurrentSessionId(sid);
        setOutput((prev) => prev + `\n[Session ${sid} ready] cwd=${data.cwd}\n`);
        // Badge based on note/engine
        const note = String(data.note || '');
        const eng = String(data.engine || '').toLowerCase();
        if (note === 'pseudo-terminal') {
          if (eng === 'pipe') setEngineBadge({ kind: 'pseudo-pipe', label: 'Pseudo (pipe)' });
          else setEngineBadge({ kind: 'pseudo-line', label: 'Pseudo (line)' });
        } else if (note === 'pty-fallback') {
          setEngineBadge({ kind: 'fallback', label: 'PTY Fallback' });
        } else {
          setEngineBadge({ kind: 'pty', label: 'PTY' });
        }
        setSessions(prev => {
          const updated = new Map(prev);
          updated.set(sid, {
            sessionId: sid,
            persistent: !!data.persistent,
            status: 'active',
            lastActivity: Date.now(),
            createdAt: Date.now(),
            availableProviders: data.availableProviders || []
          });
          return updated;
        });
        // Autofocus terminal after session is ready
        try { termRef.current?.focus(); } catch {}
      }
      if (data.op === 'create' && data.ok === false) {
        setFallbackExec(true);
        setEngineBadge({ kind: 'fallback', label: 'Exec Mode' });
        setOutput((prev) => prev + `\n[Interactive shell unavailable, falling back to one-shot exec] ${data.error || ''}\n`);
      }
      if (data.op === 'data') {
        if (!activeSessionRef.current || activeSessionRef.current !== data.sessionId) return;
        if (termRef.current) termRef.current.write(data.chunk || '');
        else setOutput((prev) => prev + (data.chunk || ''));
        const sid = data.sessionId as string;
        setSessions(prev => {
          const updated = new Map(prev);
          const s = updated.get(sid);
          if (s) {
            s.lastActivity = Date.now();
            s.status = 'active';
            updated.set(sid, s);
          }
          return updated;
        });
      }
      if (data.op === 'exit') {
        const sid = data.sessionId as string;
        if (activeSessionRef.current && activeSessionRef.current === sid) {
          if (termRef.current) termRef.current.write(`\r\n[Exit ${data.code}]\r\n`);
          else setOutput((prev) => prev + `\n[Exit ${data.code}]\n`);
          activeSessionRef.current = null;
          setCurrentSessionId(null);
        }
        setSessions(prev => {
          const updated = new Map(prev);
          updated.delete(sid);
          return updated;
        });
      }

      // Handle list-sessions response
      if (data.op === 'list-sessions' && data.ok && Array.isArray(data.sessions)) {
        const next = new Map<string, SessionInfo>();
        for (const s of data.sessions) {
          next.set(s.sessionId, {
            sessionId: s.sessionId,
            persistent: !!s.persistent,
            status: isConnected ? 'active' : 'disconnected',
            lastActivity: s.lastActivity || Date.now(),
            createdAt: s.createdAt || Date.now(),
            availableProviders: s.availableProviders || [],
          });
        }
        setSessions(next);
      }
    });
    return unsub;
  }, []);

  const ensureSession = () => {
    if (!activeSessionRef.current) {
      const id = `pty_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      sendJson({ type: 'terminal', id, data: { op: 'create', sessionId: id, cols: 80, rows: 24, persistent: true , engine: 'line' } });
      activeSessionRef.current = id;
      setCurrentSessionId(id);
    }
  };

  useEffect(() => {
    // Manual session start: do not auto-create; only keepalive when a session exists
    keepaliveRef.current = setInterval(() => {
      if (activeSessionRef.current) {
        sendJson({ type: 'terminal', id: `ka_${Date.now()}`, data: { op: 'keepalive', sessionId: activeSessionRef.current } });
      }
    }, 30000);
    return () => { if (keepaliveRef.current) clearInterval(keepaliveRef.current) };
  }, []);

  // Reflect connection state for UI; try to refresh sessions when connected
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    if (isConnected) {
      refreshSessions();
    }
  }, [isConnected]);

  // For non-PTY fallback view: submit full commands
  const onSend = (text: string) => {
    if (fallbackExec) {
      const sessionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setOutput((prev) => prev + `\n$ ${text}\n`);
      sendJson({ type: 'terminal', id: sessionId, data: { op: 'exec', sessionId, command: text } });
      return;
    }
    // In interactive xterm mode we do not use this path; onInput handles keystrokes
    ensureSession();
    const sid = activeSessionRef.current!;
    sendJson({ type: 'terminal', id: `in_${Date.now()}`, data: { op: 'input', sessionId: sid, data: text } });
  };

  // Interactive keystrokes from xterm.js
  const onInput = (data: string) => {
    if (fallbackExec) return; // Not used in exec mode
    if (!activeSessionRef.current) return; // Require manual session creation
    const sid = activeSessionRef.current!;
    // data already includes Enter as \r when user hits Enter
    sendJson({ type: 'terminal', id: `in_${Date.now()}`, data: { op: 'input', sessionId: sid, data } });
  };
  
  // Clear terminal screen
  const onClear = () => {
    if (termRef.current) {
      // Clear xterm.js display immediately
      termRef.current.clear();
    }
    if (!fallbackExec && activeSessionRef.current) {
      // Also send clear command to server for proper shell state
      const sid = activeSessionRef.current;
      sendJson({ type: 'terminal', id: `clear_${Date.now()}`, data: { op: 'input', sessionId: sid, data: 'clear\r' } });
    }
  };

  const onActionKey = (seq: string) => {
    if (!activeSessionRef.current) return;
    const sid = activeSessionRef.current;
    sendJson({ type: 'terminal', id: `key_${Date.now()}`, data: { op: 'input', sessionId: sid, data: seq } });
  };

  const refreshSessions = () => {
    sendJson({ type: 'terminal', id: `list_${Date.now()}`, data: { op: 'list-sessions' } });
  };

  const switchToSession = (sid: string) => {
    setCurrentSessionId(sid);
    activeSessionRef.current = sid;
    try { termRef.current?.clear(); } catch {}
    // Send empty input to trigger buffered output flush
    sendJson({ type: 'terminal', id: `re_${Date.now()}`, data: { op: 'input', sessionId: sid, data: '' } });
    // Refocus terminal for typing
    setTimeout(() => { try { termRef.current?.focus(); } catch {} }, 0);
  };

  return (
    <div className="p-3">
      {/* Top compact header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Terminal</h3>
        <span className={`px-2 py-1 text-xs rounded-md border ${connectionStatus === 'connected' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'}`}>
          {connectionStatus}
        </span>
      </div>

      {/* Terminal area */}
      <div className="flex flex-col" style={{ minHeight: '60vh' }}>
        {!activeSessionRef.current && (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground mb-2">
            No active terminal session. Use the toolbar below to create one.
          </div>
        )}
        {fallbackExec ? (
          <TerminalView output={output} onSend={onSend} onActionKey={onActionKey} />
        ) : (
          <TerminalXterm
            ref={termRef as any}
            onInput={onInput}
            onResize={(c, r) => {
              if (!activeSessionRef.current) return;
              sendJson({ type: 'terminal', id: `rs_${Date.now()}`, data: { op: 'resize', sessionId: activeSessionRef.current, cols: c, rows: r } });
            }}
            autoFocus={false}
          />
        )}
        <div className="mt-1 text-xs text-muted-foreground">Tap terminal to focus/open keyboard.</div>
      </div>

      {/* Bottom sticky toolbar */}
      <div className="sticky bottom-0 left-0 right-0 pt-2 pb-[env(safe-area-inset-bottom)] bg-background z-10">
        <div className="flex items-center gap-2 mb-2">
          <button
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
            onClick={() => { try { termRef.current?.focus(); } catch {} }}
          >
            Focus
          </button>
          <button
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
            onClick={() => {
              setShowSessions(true);
            }}
          >
            Sessions
          </button>
          <button
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
            onClick={() => {
              const id = `pty_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
              const size = termRef.current?.getSize() || { cols: 80, rows: 24 };
              sendJson({ type: 'terminal', id, data: { op: 'create', sessionId: id, cols: size.cols, rows: size.rows, persistent: true , engine: 'line' } });
              activeSessionRef.current = id;
              setCurrentSessionId(id);
              setTimeout(() => { try { termRef.current?.focus(); } catch {} }, 0);
            }}
          >
            Create
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {/* Engine badge and quick toggle */}
          <div className="flex items-center gap-2 flex-1">
            {engineBadge && (
              <span className="inline-flex items-center px-2 py-1 rounded-md border border-border text-xs">
                {engineBadge.label}
              </span>
            )}
          </div>
          <button className="flex-1 rounded-md border border-border px-3 py-2 text-sm" onClick={refreshSessions}>Refresh</button>
          <button className="flex-1 rounded-md border border-border px-3 py-2 text-sm" onClick={() => setOutput('')}>Clear</button>
        </div>
        <div className="overflow-x-auto">
          <TerminalActionBar onKey={onActionKey} onClear={onClear} />
        </div>
      </div>

      {/* Sessions overlay */}
      <SessionsOverlay
        open={showSessions}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onClose={() => setShowSessions(false)}
        onSwitch={(sid) => { setShowSessions(false); switchToSession(sid); }}
      />
    </div>
  );
};

export default TerminalPage;

// Lightweight sessions overlay for mobile session switching
const SessionsOverlay: React.FC<{
  open: boolean;
  sessions: Map<string, any>;
  currentSessionId: string | null;
  onClose: () => void;
  onSwitch: (sid: string) => void;
}> = ({ open, sessions, currentSessionId, onClose, onSwitch }) => {
  if (!open) return null;
  const items = Array.from(sessions.values());
  return (
    <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose}>
      <div className="absolute left-0 right-0 bottom-0 bg-background border-t border-border p-3 rounded-t-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Sessions</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground">No active sessions.</div>
        )}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {items.map((s: any) => (
            <button
              key={s.sessionId}
              onClick={() => onSwitch(s.sessionId)}
              className={`w-full text-left px-3 py-2 rounded-md border border-border flex items-center gap-2 ${currentSessionId === s.sessionId ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${s.status === 'active' ? 'bg-green-500' : s.status === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span className="font-mono">{(s.sessionId || '').slice(-8)}</span>
              {s.availableProviders && s.availableProviders.length > 0 && (
                <span className="text-xs opacity-70">AI: {s.availableProviders.join(',')}</span>
              )}
              <span className="ml-auto text-xs opacity-70">{new Date(s.lastActivity).toLocaleTimeString()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};



