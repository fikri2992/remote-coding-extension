import React, { useEffect, useRef, useState } from 'react';
import { TouchOptimizedTerminalUI, TouchOptimizedTerminalUIHandle } from '../components/terminal/TouchOptimizedTerminalUI';
import { TerminalView } from '../components/terminal/TerminalView';
import { TerminalActionBar } from '../components/terminal/TerminalActionBar';
import { useWebSocket } from '../components/WebSocketProvider';
import { Button } from '../components/ui/button';
import { useHapticFeedback } from '../components/terminal/HapticFeedback';

const EnhancedTerminalPage: React.FC = () => {
  const { sendJson, addMessageListener } = useWebSocket();
  const [output, setOutput] = useState('');
  const [fallbackExec, setFallbackExec] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(false);
  const [terminalState, setTerminalState] = useState<'idle' | 'active' | 'input' | 'running'>('idle');
  const [currentDirectory, setCurrentDirectory] = useState<string>('~');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const activeSessionRef = useRef<string | null>(null);
  const termRef = useRef<TouchOptimizedTerminalUIHandle | null>(null);
  const keepaliveRef = useRef<any>(null);
  const { success, error, keyPress } = useHapticFeedback();

  // Detect touch device
  useEffect(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchMode(hasTouch);
  }, []);

  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'terminal') return;
      const data = msg.data || {};
      
      // Stage 2 PTY streaming
      if (data.op === 'create' && data.event === 'ready') {
        activeSessionRef.current = data.sessionId;
        setOutput((prev) => prev + `\n[Session ${data.sessionId} ready] cwd=${data.cwd}\n`);
        setCurrentDirectory(data.cwd || '~');
        setTerminalState('active');
        success(); // Haptic feedback for successful connection
      }
      
      if (data.op === 'create' && data.ok === false) {
        setFallbackExec(true);
        setOutput((prev) => prev + `\n[Interactive shell unavailable, falling back to one-shot exec] ${data.error || ''}\n`);
        error(); // Haptic feedback for connection error
      }
      
      if (data.op === 'data') {
        if (!activeSessionRef.current || activeSessionRef.current !== data.sessionId) return;
        if (termRef.current) termRef.current.write(data.chunk || '');
        else setOutput((prev) => prev + (data.chunk || ''));
        
        // Update terminal state based on output
        const chunk = data.chunk || '';
        if (chunk.includes('$') || chunk.includes('#') || chunk.includes('>')) {
          setTerminalState('input');
        } else if (chunk.length > 0) {
          setTerminalState('running');
        }
      }
      
      if (data.op === 'exit') {
        if (!activeSessionRef.current || activeSessionRef.current !== data.sessionId) return;
        if (termRef.current) termRef.current.write(`\r\n[Exit ${data.code}]\r\n`);
        else setOutput((prev) => prev + `\n[Exit ${data.code}]\n`);
        activeSessionRef.current = null;
        setTerminalState('idle');
      }
    });
    return unsub;
  }, [success, error]);

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
    keyPress(); // Haptic feedback for command submission
    
    // Add to command history if it's a complete command
    if (text.trim() && !text.startsWith(' ')) {
      setCommandHistory(prev => {
        const newHistory = [...prev, text.trim()];
        // Keep only last 50 commands
        return newHistory.slice(-50);
      });
    }
    
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
    
    // Provide haptic feedback for key presses
    keyPress();
    
    ensureSession();
    const sid = activeSessionRef.current!;
    // data already includes Enter as \r when user hits Enter
    sendJson({ type: 'terminal', id: `in_${Date.now()}`, data: { op: 'input', sessionId: sid, data } });
  };

  const onActionKey = (seq: string) => {
    keyPress(); // Haptic feedback for action keys
    
    if (!activeSessionRef.current) return;
    const sid = activeSessionRef.current;
    sendJson({ type: 'terminal', id: `key_${Date.now()}`, data: { op: 'input', sessionId: sid, data: seq } });
  };

  const handleClear = () => {
    setOutput('');
    if (termRef.current) {
      termRef.current.clear();
    }
    keyPress(); // Haptic feedback
  };

  const handleNewSession = () => {
    activeSessionRef.current = null;
    ensureSession();
    success(); // Haptic feedback for new session
  };

  const handleFontSizeChange = (delta: number) => {
    if (termRef.current) {
      // This is a placeholder - the actual font size change would be handled by the ResponsiveFontSystem
      // For now, we'll just provide haptic feedback
      keyPress(); // Haptic feedback
      console.log('Font size change requested:', delta);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-foreground">
          {isTouchMode ? 'Touch-Optimized Terminal' : 'Terminal Sessions'}
        </h3>
        <div className="flex items-center gap-2">
          <Button 
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted min-h-[44px]" 
            onClick={handleClear}
          >
            Clear
          </Button>
          {!fallbackExec && (
            <Button 
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted min-h-[44px]" 
              onClick={handleNewSession}
            >
              New Session
            </Button>
          )}
          {isTouchMode && (
            <>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => handleFontSizeChange(1)}
                className="min-h-[44px] min-w-[44px]"
                title="Increase font size"
              >
                A+
              </Button>
              <Button 
                size="sm"
                variant="outline"
                onClick={() => handleFontSizeChange(-1)}
                className="min-h-[44px] min-w-[44px]"
                title="Decrease font size"
              >
                A-
              </Button>
            </>
          )}
        </div>
      </div>
      
      {fallbackExec ? (
        <TerminalView output={output} onSend={onSend} onActionKey={onActionKey} />
      ) : (
        <div className="space-y-2">
          <TouchOptimizedTerminalUI
            ref={termRef as any}
            onInput={onInput}
            onResize={(c, r) => {
              if (!activeSessionRef.current) return;
              sendJson({ 
                type: 'terminal', 
                id: `rs_${Date.now()}`, 
                data: { op: 'resize', sessionId: activeSessionRef.current, cols: c, rows: r } 
              });
            }}
            className="touch-optimized-terminal-container"
            terminalState={terminalState}
            currentDirectory={currentDirectory}
            commandHistory={commandHistory}
          />
          {!isTouchMode && (
            <TerminalActionBar onKey={onActionKey} />
          )}
        </div>
      )}
      

    </div>
  );
};

export default EnhancedTerminalPage;