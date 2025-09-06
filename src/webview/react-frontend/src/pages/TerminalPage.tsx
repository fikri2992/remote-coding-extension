import React, { useEffect, useRef, useState } from 'react';
import { TerminalView } from '../components/terminal/TerminalView';
import { TerminalXterm, TerminalXtermHandle } from '../components/terminal/TerminalXterm';
import { TerminalActionBar } from '../components/terminal/TerminalActionBar';
import { useWebSocket } from '../components/WebSocketProvider';

const TerminalPage: React.FC = () => {
  const { sendJson, addMessageListener } = useWebSocket();
  const [output, setOutput] = useState('');
  const [fallbackExec, setFallbackExec] = useState(false);
  const activeSessionRef = useRef<string | null>(null);
  const termRef = useRef<TerminalXtermHandle | null>(null);
  const keepaliveRef = useRef<any>(null);

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'terminal') return;
      const data = msg.data || {};
      // Stage 2 PTY streaming
      if (data.op === 'create' && data.event === 'ready') {
        activeSessionRef.current = data.sessionId;
        setOutput((prev) => prev + `\n[Session ${data.sessionId} ready] cwd=${data.cwd}\n`);
      }
      if (data.op === 'create' && data.ok === false) {
        setFallbackExec(true);
        setOutput((prev) => prev + `\n[Interactive shell unavailable, falling back to one-shot exec] ${data.error || ''}\n`);
      }
      if (data.op === 'data') {
        if (!activeSessionRef.current || activeSessionRef.current !== data.sessionId) return;
        if (termRef.current) termRef.current.write(data.chunk || '');
        else setOutput((prev) => prev + (data.chunk || ''));
      }
      if (data.op === 'exit') {
        if (!activeSessionRef.current || activeSessionRef.current !== data.sessionId) return;
        if (termRef.current) termRef.current.write(`\r\n[Exit ${data.code}]\r\n`);
        else setOutput((prev) => prev + `\n[Exit ${data.code}]\n`);
        activeSessionRef.current = null;
      }
    });
    return unsub;
  }, []);

  const ensureSession = () => {
    if (!activeSessionRef.current) {
      const id = `pty_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      sendJson({ type: 'terminal', id, data: { op: 'create', sessionId: id, cols: 80, rows: 24 } });
      activeSessionRef.current = id;
    }
  };

  useEffect(() => {
    // create on first visit
    ensureSession();
    // session keepalive
    keepaliveRef.current = setInterval(() => {
      if (activeSessionRef.current) {
        sendJson({ type: 'terminal', id: `ka_${Date.now()}`, data: { op: 'keepalive', sessionId: activeSessionRef.current } });
      }
    }, 30000);
    return () => { if (keepaliveRef.current) clearInterval(keepaliveRef.current) };
  }, []);

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
    ensureSession();
    const sid = activeSessionRef.current!;
    // data already includes Enter as \r when user hits Enter
    sendJson({ type: 'terminal', id: `in_${Date.now()}`, data: { op: 'input', sessionId: sid, data } });
  };

  const onActionKey = (seq: string) => {
    if (!activeSessionRef.current) return;
    const sid = activeSessionRef.current;
    sendJson({ type: 'terminal', id: `key_${Date.now()}`, data: { op: 'input', sessionId: sid, data: seq } });
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[5px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.35)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">Terminal Sessions</h3>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[5px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.35)]" onClick={() => { setOutput(''); }}>Clear</button>
          {!fallbackExec && (
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted neo:rounded-none neo:border-[5px] neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.35)]" onClick={() => { activeSessionRef.current = null; ensureSession(); }}>New Session</button>
          )}
        </div>
      </div>
      {fallbackExec ? (
        <TerminalView output={output} onSend={onSend} onActionKey={onActionKey} />
      ) : (
        <div className="space-y-2">
          <TerminalXterm
            ref={termRef as any}
            onInput={onInput}
            onResize={(c, r) => {
              if (!activeSessionRef.current) return;
              sendJson({ type: 'terminal', id: `rs_${Date.now()}`, data: { op: 'resize', sessionId: activeSessionRef.current, cols: c, rows: r } });
            }}
          />
          <TerminalActionBar onKey={onActionKey} />
        </div>
      )}
    </div>
  );
};

export default TerminalPage;
