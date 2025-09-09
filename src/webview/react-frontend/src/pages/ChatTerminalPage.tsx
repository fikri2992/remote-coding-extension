import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChatTerminal, ChatTerminalMessage } from '../components/terminal/ChatTerminal';
import { WorkspaceSwitcher } from '../components/terminal/WorkspaceSwitcher';
import { VisualFeedback } from '../components/terminal/VisualFeedback';
import { useWebSocket } from '../components/WebSocketProvider';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { Zap, Trash2, Plus, HelpCircle } from 'lucide-react';

const ChatTerminalPage: React.FC = () => {
  const { sendJson, addMessageListener, isConnected } = useWebSocket();
  const [messages, setMessages] = useState<ChatTerminalMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [workspaces] = useState([
    {
      id: 'frontend',
      name: 'Frontend',
      path: '/workspace/frontend',
      type: 'frontend' as const,
      runningProcesses: ['npm start'],
      lastActive: new Date()
    },
    {
      id: 'api',
      name: 'API Server',
      path: '/workspace/api',
      type: 'api' as const,
      runningProcesses: [],
      lastActive: new Date(Date.now() - 300000)
    }
  ]);
  const [feedback, setFeedback] = useState<{
    type: 'progress' | 'success' | 'error' | 'loading';
    message: string;
    progress?: number;
  } | null>(null);

  // Add welcome message on first load
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      type: 'system',
      content: '🚀 Welcome to Chat Terminal!\n\nThis is a revolutionary mobile-first terminal experience featuring:\n\n💬 Chat-style interface\n🎯 Smart command suggestions\n👆 Gesture navigation\n🏠 Workspace management\n📊 Visual feedback\n\nTry typing a command or swipe up for smart suggestions!',
      timestamp: new Date()
    }]);

    // Show welcome feedback
    setFeedback({
      type: 'success',
      message: 'Chat Terminal loaded! Ready for commands.'
    });
  }, []);

  // WebSocket message handler
  useEffect(() => {
    const unsub = addMessageListener((msg) => {
      if (msg?.type !== 'terminal') return;
      const data = msg.data || {};

      // Handle session creation
      if (data.op === 'create' && data.event === 'ready') {
        const sid = data.sessionId as string;
        activeSessionRef.current = sid;
        setCurrentSessionId(sid);
        
        addMessage({
          type: 'system',
          content: `✅ Terminal session ready\nSession ID: ${sid}\nWorking directory: ${data.cwd || 'unknown'}`,
          sessionId: sid
        });
      }

      // Handle session creation failure
      if (data.op === 'create' && data.ok === false) {
        addMessage({
          type: 'error',
          content: `❌ Failed to create terminal session\n${data.error || 'Unknown error'}`,
        });
      }

      // Handle command output
      if (data.op === 'data') {
        if (!activeSessionRef.current || activeSessionRef.current !== data.sessionId) return;
        
        // Find the last pending message and update it, or create new output message
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.status === 'pending' && lastMessage.type === 'command') {
            // Add output message after the command
            return [...prev, {
              id: `output-${Date.now()}`,
              type: 'output',
              content: data.chunk || '',
              timestamp: new Date(),
              sessionId: data.sessionId,
              status: 'complete'
            }];
          } else {
            // Update existing output or create new one
            const outputIndex = prev.findIndex(m => 
              m.sessionId === data.sessionId && 
              m.type === 'output' && 
              m.status !== 'complete'
            );
            
            if (outputIndex >= 0) {
              const updated = [...prev];
              updated[outputIndex] = {
                ...updated[outputIndex],
                content: updated[outputIndex].content + (data.chunk || ''),
                timestamp: new Date()
              };
              return updated;
            } else {
              return [...prev, {
                id: `output-${Date.now()}`,
                type: 'output',
                content: data.chunk || '',
                timestamp: new Date(),
                sessionId: data.sessionId
              }];
            }
          }
        });
      }

      // Handle command completion
      if (data.op === 'exit') {
        const sid = data.sessionId as string;
        if (activeSessionRef.current && activeSessionRef.current === sid) {
          addMessage({
            type: 'system',
            content: `🏁 Command completed with exit code: ${data.code}`,
            sessionId: sid
          });
          
          // Mark any pending commands as complete
          setMessages(prev => prev.map(msg => 
            msg.sessionId === sid && msg.status === 'pending'
              ? { ...msg, status: 'complete' as const }
              : msg
          ));
        }
      }
    });

    return unsub;
  }, [addMessageListener]);

  // Helper function to add messages
  const addMessage = useCallback((message: Omit<ChatTerminalMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date()
    }]);
  }, []);

  // Ensure we have an active session
  const ensureSession = useCallback(() => {
    if (!activeSessionRef.current) {
      const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      sendJson({ 
        type: 'terminal', 
        id, 
        data: { 
          op: 'create', 
          sessionId: id, 
          cols: 80, 
          rows: 24, 
          persistent: true, 
          engine: 'pipe' 
        } 
      });
      activeSessionRef.current = id;
      setCurrentSessionId(id);
      
      addMessage({
        type: 'system',
        content: '🔄 Creating new terminal session...',
      });
    }
  }, [sendJson, addMessage]);

  // Handle command execution
  const handleCommand = useCallback((command: string) => {
    if (!command.trim()) return;

    // Show command execution feedback
    setFeedback({
      type: 'loading',
      message: `Executing: ${command}`
    });

    // Add command to history
    setCommandHistory(prev => {
      const newHistory = [command, ...prev.filter(h => h !== command)].slice(0, 50);
      return newHistory;
    });

    // Add command message
    const commandMessage: ChatTerminalMessage = {
      id: `cmd-${Date.now()}`,
      type: 'command',
      content: command,
      timestamp: new Date(),
      sessionId: currentSessionId || undefined,
      status: 'pending'
    };
    
    setMessages(prev => [...prev, commandMessage]);

    // Ensure session exists
    ensureSession();

    // Send command to terminal
    if (activeSessionRef.current) {
      const sid = activeSessionRef.current;
      sendJson({ 
        type: 'terminal', 
        id: `cmd_${Date.now()}`, 
        data: { 
          op: 'input', 
          sessionId: sid, 
          data: command + '\r' 
        } 
      });
    }
  }, [currentSessionId, ensureSession, sendJson]);

  // Handle gestures
  const handleGesture = useCallback((gesture: string, data?: any) => {
    switch (gesture) {
      case 'showCommandPalette':
        // This will be handled by SmartInput component
        break;
        
      case 'hideKeyboard':
        // Blur any focused input
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        break;
        
      case 'previousCommand':
        if (commandHistory.length > 0) {
          const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
          setHistoryIndex(newIndex);
          // This would be handled by SmartInput
        }
        break;
        
      case 'nextCommand':
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
        }
        break;
        
      case 'showContextMenu':
        // Show context menu for message
        console.log('Context menu for:', data);
        break;
        
      case 'adjustFontSize':
        // Handle font size adjustment
        console.log('Adjust font size:', data);
        break;
        
      default:
        console.log('Unhandled gesture:', gesture, data);
    }
  }, [commandHistory, historyIndex]);

  // Auto-create session on mount if connected
  useEffect(() => {
    if (isConnected && !activeSessionRef.current) {
      // Don't auto-create, let user initiate
    }
  }, [isConnected]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Visual Feedback */}
      {feedback && (
        <VisualFeedback
          type={feedback.type}
          message={feedback.message}
          progress={feedback.progress}
          onComplete={() => setFeedback(null)}
        />
      )}

      {/* Header */}
      <Card className={cn(
        'border-b border-border bg-card/95 backdrop-blur-sm m-0 rounded-none',
        'neo:border-b-[3px] neo:rounded-none'
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">💬</div>
              <div>
                <h1 className={cn(
                  'text-lg font-semibold',
                  'neo:font-extrabold neo:text-xl'
                )}>Chat Terminal</h1>
                <p className={cn(
                  'text-xs text-muted-foreground',
                  'neo:font-medium neo:text-foreground neo:opacity-70'
                )}>
                  Revolutionary mobile-first experience
                </p>
              </div>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full transition-colors',
                'neo:rounded-none neo:w-3 neo:h-3',
                isConnected ? 'bg-green-500 animate-pulse neo:bg-green-400' : 'bg-red-500 neo:bg-red-400'
              )} />
              <span className={cn(
                'text-xs text-muted-foreground',
                'neo:font-medium neo:text-foreground neo:opacity-70'
              )}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Switcher */}
      <div className={cn(
        'p-4 border-b border-border bg-muted/30',
        'neo:border-b-[3px] neo:bg-muted/50'
      )}>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspace={currentSessionId || 'frontend'}
          onSwitch={(id) => {
            setCurrentSessionId(id);
            setFeedback({
              type: 'success',
              message: `Switched to ${workspaces.find(w => w.id === id)?.name || 'workspace'}`
            });
          }}
          onCreateNew={() => {
            ensureSession();
            setFeedback({
              type: 'loading',
              message: 'Creating new workspace...'
            });
          }}
        />
      </div>

      {/* Chat Terminal */}
      <div className="flex-1 overflow-hidden">
        <ChatTerminal
          messages={messages}
          onCommand={handleCommand}
          onGesture={handleGesture}
          isConnected={isConnected}
        />
      </div>

      {/* Quick Actions Bar (Mobile) */}
      <div className={cn(
        'md:hidden border-t border-border bg-background/95 backdrop-blur-sm p-2',
        'neo:border-t-[3px]'
      )}>
        <div className="flex items-center justify-around gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleGesture('showCommandPalette')}
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2',
              'neo:rounded-none neo:border-[2px] neo:border-transparent hover:neo:border-border'
            )}
          >
            <Zap className="w-5 h-5" />
            <span className={cn(
              'text-xs',
              'neo:font-bold'
            )}>Quick</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([{
                id: 'welcome-new',
                type: 'system',
                content: '🧹 Terminal cleared',
                timestamp: new Date()
              }]);
            }}
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2',
              'neo:rounded-none neo:border-[2px] neo:border-transparent hover:neo:border-border'
            )}
          >
            <Trash2 className="w-5 h-5" />
            <span className={cn(
              'text-xs',
              'neo:font-bold'
            )}>Clear</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={ensureSession}
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2',
              'neo:rounded-none neo:border-[2px] neo:border-transparent hover:neo:border-border'
            )}
          >
            <Plus className="w-5 h-5" />
            <span className={cn(
              'text-xs',
              'neo:font-bold'
            )}>New</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Show help message
              addMessage({
                type: 'system',
                content: '📚 Chat Terminal Help\n\n• Swipe up: Show command suggestions\n• Swipe down: Hide keyboard\n• Swipe left/right: Navigate command history\n• Long press: Copy message\n• Pinch: Adjust font size\n\nEnjoy the revolutionary mobile terminal experience!'
              });
            }}
            className={cn(
              'flex flex-col items-center gap-1 h-auto py-2',
              'neo:rounded-none neo:border-[2px] neo:border-transparent hover:neo:border-border'
            )}
          >
            <HelpCircle className="w-5 h-5" />
            <span className={cn(
              'text-xs',
              'neo:font-bold'
            )}>Help</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatTerminalPage;