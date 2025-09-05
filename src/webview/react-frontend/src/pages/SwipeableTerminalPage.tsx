import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TouchOptimizedTerminalUI, TouchOptimizedTerminalUIHandle } from '../components/terminal/TouchOptimizedTerminalUI';
import { SwipeableSessionContainer } from '../components/terminal/SwipeableSessionContainer';
import { useSessionNavigation } from '../components/terminal/useSessionNavigation';
import { TerminalSession } from '../components/terminal/SessionManager';
import { useWebSocket } from '../components/WebSocketProvider';
import { cn } from '../lib/utils';
import '../components/terminal/session-navigation.css';

const SwipeableTerminalPage: React.FC = () => {
  const { sendJson, addMessageListener } = useWebSocket();
  const [output, setOutput] = useState('');
  const [fallbackExec, setFallbackExec] = useState(false);
  const [terminalState, setTerminalState] = useState<'idle' | 'active' | 'input' | 'running'>('idle');
  const [currentDirectory, setCurrentDirectory] = useState<string>('~');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  
  const termRefs = useRef<Map<string, TouchOptimizedTerminalUIHandle>>(new Map());
  const keepaliveRef = useRef<any>(null);
  const sessionOutputs = useRef<Map<string, string>>(new Map());

  // Initialize session navigation
  const { state, actions } = useSessionNavigation({
    autoCreateFirstSession: true,
    maxSessions: 8,
    onSessionSwitch: (fromSessionId, toSessionId) => {
      console.log(`Switching from session ${fromSessionId} to ${toSessionId}`);
      
      // Save current output for the previous session
      if (fromSessionId) {
        sessionOutputs.current.set(fromSessionId, output);
      }
      
      // Load output for the new session
      const newOutput = sessionOutputs.current.get(toSessionId) || '';
      setOutput(newOutput);
      
      // Update terminal state
      const newSession = actions.getSessionById(toSessionId);
      if (newSession) {
        setCurrentDirectory(newSession.cwd);
        setTerminalState(newSession.status === 'active' ? 'active' : 'idle');
      }
    },
    onSessionCreate: (session) => {
      console.log(`Created new session: ${session.id}`);
      
      // Initialize session with PTY
      ensureSessionPTY(session.id);
    },
    onSessionClose: (session) => {
      console.log(`Closed session: ${session.id}`);
      
      // Clean up session data
      sessionOutputs.current.delete(session.id);
      termRefs.current.delete(session.id);
      
      // Send close command to server
      sendJson({ 
        type: 'terminal', 
        id: `close_${Date.now()}`, 
        data: { op: 'close', sessionId: session.id } 
      });
    }
  });

  // WebSocket message handler
  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'terminal') return;
      const data = msg.data || {};
      
      // Handle PTY session creation
      if (data.op === 'create' && data.event === 'ready') {
        const session = actions.getSessionById(data.sessionId);
        if (session) {
          actions.updateSession(data.sessionId, {
            cwd: data.cwd || '~',
            status: 'active',
            lastActivity: new Date()
          });
          
          if (data.sessionId === state.activeSessionId) {
            setCurrentDirectory(data.cwd || '~');
            setTerminalState('active');
            setOutput((prev) => prev + `\n[Session ${data.sessionId} ready] cwd=${data.cwd}\n`);
          }
        }
      }
      
      // Handle PTY creation failure
      if (data.op === 'create' && data.ok === false) {
        setFallbackExec(true);
        setOutput((prev) => prev + `\n[Interactive shell unavailable, falling back to one-shot exec] ${data.error || ''}\n`);
      }
      
      // Handle PTY data
      if (data.op === 'data') {
        const session = actions.getSessionById(data.sessionId);
        if (!session) return;
        
        // Update session activity
        actions.updateSession(data.sessionId, {
          lastActivity: new Date(),
          status: 'active'
        });
        
        // Update output for the session
        const currentOutput = sessionOutputs.current.get(data.sessionId) || '';
        const newOutput = currentOutput + (data.chunk || '');
        sessionOutputs.current.set(data.sessionId, newOutput);
        
        // Update display if this is the active session
        if (data.sessionId === state.activeSessionId) {
          const termRef = termRefs.current.get(data.sessionId);
          if (termRef) {
            termRef.write(data.chunk || '');
          } else {
            setOutput(newOutput);
          }
        }
      }
      
      // Handle PTY exit
      if (data.op === 'exit') {
        const session = actions.getSessionById(data.sessionId);
        if (!session) return;
        
        actions.updateSession(data.sessionId, {
          status: 'disconnected',
          lastActivity: new Date()
        });
        
        if (data.sessionId === state.activeSessionId) {
          const termRef = termRefs.current.get(data.sessionId);
          if (termRef) {
            termRef.write(`\r\n[Exit ${data.code}]\r\n`);
          } else {
            setOutput((prev) => prev + `\n[Exit ${data.code}]\n`);
          }
          setTerminalState('idle');
        }
      }
    });
    
    return unsub;
  }, [addMessageListener, actions, state.activeSessionId]);

  // Ensure PTY session exists
  const ensureSessionPTY = useCallback((sessionId: string) => {
    const session = actions.getSessionById(sessionId);
    if (!session) return;
    
    // Create PTY session on server
    sendJson({ 
      type: 'terminal', 
      id: `create_${Date.now()}`, 
      data: { op: 'create', sessionId, cols: 80, rows: 24 } 
    });
  }, [actions, sendJson]);

  // Session keepalive
  useEffect(() => {
    keepaliveRef.current = setInterval(() => {
      state.sessions.forEach(session => {
        if (session.status === 'active') {
          sendJson({ 
            type: 'terminal', 
            id: `ka_${Date.now()}`, 
            data: { op: 'keepalive', sessionId: session.id } 
          });
        }
      });
    }, 30000);
    
    return () => {
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
      }
    };
  }, [state.sessions, sendJson]);

  // Handle terminal input
  const handleInput = useCallback((data: string) => {
    if (fallbackExec || !state.activeSessionId) return;
    
    const session = actions.getActiveSession();
    if (!session) return;
    
    // Update session activity
    actions.updateSession(session.id, {
      lastActivity: new Date(),
      status: 'running'
    });
    
    setTerminalState('running');
    
    // Send input to PTY
    sendJson({ 
      type: 'terminal', 
      id: `in_${Date.now()}`, 
      data: { op: 'input', sessionId: session.id, data } 
    });
  }, [fallbackExec, state.activeSessionId, actions, sendJson]);

  // Handle terminal resize
  const handleResize = useCallback((cols: number, rows: number) => {
    if (!state.activeSessionId) return;
    
    sendJson({ 
      type: 'terminal', 
      id: `rs_${Date.now()}`, 
      data: { op: 'resize', sessionId: state.activeSessionId, cols, rows } 
    });
  }, [state.activeSessionId, sendJson]);

  // Handle session creation
  const handleSessionCreate = useCallback(() => {
    const sessionId = actions.createSession({
      title: `Session ${state.sessions.length + 1}`,
      cwd: currentDirectory,
      status: 'active'
    });
    
    // Switch to new session and initialize PTY
    actions.switchToSession(sessionId);
  }, [actions, state.sessions.length, currentDirectory]);

  // Handle fallback command execution
  const handleFallbackSend = useCallback((text: string) => {
    if (!fallbackExec) return;
    
    const sessionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setOutput((prev) => prev + `\n$ ${text}\n`);
    sendJson({ 
      type: 'terminal', 
      id: sessionId, 
      data: { op: 'exec', sessionId, command: text } 
    });
    
    // Add to command history
    setCommandHistory(prev => [...prev.slice(-49), text]);
  }, [fallbackExec, sendJson]);

  // Render terminal content for a session
  const renderSessionContent = useCallback((session: TerminalSession) => {
    const isActive = session.id === state.activeSessionId;
    
    return (
      <div className="h-full flex flex-col">
        {/* Session Info Header */}
        <div className="flex items-center justify-between p-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              session.status === 'active' && 'bg-green-500 animate-pulse',
              session.status === 'background' && 'bg-yellow-500',
              session.status === 'disconnected' && 'bg-red-500'
            )} />
            <span className="text-sm font-medium">
              {session.title || `Session ${session.id.slice(-6)}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {session.cwd}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {session.lastActivity.toLocaleTimeString()}
          </div>
        </div>
        
        {/* Terminal Content */}
        <div className="flex-1">
          {fallbackExec ? (
            <div className="h-full p-4">
              <div className="h-64 overflow-auto text-xs whitespace-pre-wrap bg-background border border-border rounded p-3 mb-3">
                {sessionOutputs.current.get(session.id) || 'Run a command to see output here.'}
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Type a command"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const input = e.currentTarget.value;
                      if (input.trim()) {
                        handleFallbackSend(input);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <button 
                  className="rounded-md bg-primary px-3 py-2 text-white text-sm hover:bg-primary/90"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement)?.value;
                    if (input?.trim()) {
                      handleFallbackSend(input);
                      (e.currentTarget.previousElementSibling as HTMLInputElement).value = '';
                    }
                  }}
                >
                  Run
                </button>
              </div>
            </div>
          ) : (
            <TouchOptimizedTerminalUI
              ref={(ref) => {
                if (ref) {
                  termRefs.current.set(session.id, ref);
                } else {
                  termRefs.current.delete(session.id);
                }
              }}
              onInput={isActive ? handleInput : () => {}}
              onResize={isActive ? handleResize : () => {}}
              className="h-full"
              terminalState={isActive ? terminalState : 'idle'}
              currentDirectory={session.cwd}
              commandHistory={commandHistory}
              enableMobileLayout={true}
              enableKeyboardAvoidance={true}
              enableSafeArea={true}
              enableCompactMode={true}
            />
          )}
        </div>
      </div>
    );
  }, [state.activeSessionId, fallbackExec, terminalState, commandHistory, handleInput, handleResize, handleFallbackSend]);

  return (
    <div className="h-full bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">
          Enhanced Terminal Sessions
        </h3>
        <div className="flex items-center gap-2">
          <button 
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOutput('')}
          >
            Clear
          </button>
          <button 
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm hover:bg-primary/90"
            onClick={handleSessionCreate}
          >
            New Session
          </button>
        </div>
      </div>
      
      {/* Swipeable Session Container */}
      <div className="flex-1 h-[calc(100%-80px)]">
        <SwipeableSessionContainer
          sessions={state.sessions}
          activeSessionId={state.activeSessionId}
          onSessionSwitch={actions.switchToSession}
          onSessionCreate={handleSessionCreate}
          onSessionClose={actions.closeSession}
          onSessionReorder={actions.reorderSessions}
          showSessionTabs={true}
          showSessionManager={false}
          enableSwipeNavigation={true}
          enableDragReorder={true}
          animationDuration={300}
          swipeThreshold={80}
        >
          {renderSessionContent}
        </SwipeableSessionContainer>
      </div>
    </div>
  );
};

export default SwipeableTerminalPage;