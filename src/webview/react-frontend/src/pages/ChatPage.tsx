import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Bot, User, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/components/WebSocketProvider';
import { cn } from '@/lib/utils';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
}

const storageKey = 'kiro_chat_messages_v1';

const ChatPage: React.FC = () => {
  const { isConnected, addMessageListener, sendJson } = useWebSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        setMessages(parsed);
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = endRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  // Subscribe to websocket chat messages
  useEffect(() => {
    const unsubscribe = addMessageListener((data) => {
      if (data?.type === 'chat_message') {
        const msg: ChatMessage = {
          id: data.id || `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: (data.role as Role) || 'assistant',
          text: data.text || data.content || '',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
      }
    });
    return unsubscribe;
  }, [addMessageListener]);

  const handleClearChat = () => {
    setMessages([]);
    try {
      localStorage.setItem(storageKey, JSON.stringify([]));
    } catch {}
  };

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const handleSend = async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');

    setSending(true);
    try {
      // Send to server. Message will be broadcast back to all clients including this one.
      sendJson({ type: 'chat_message', text, role: 'user', clientTs: Date.now() });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MessageAvatar: React.FC<{ role: Role }>
    = ({ role }) => (
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full shadow-sm',
        role === 'user' ? 'bg-blue-600 text-white' : role === 'assistant' ? 'bg-purple-600 text-white' : 'bg-gray-300 text-gray-700'
      )}>
        {role === 'user' ? <User className="h-4 w-4" /> : role === 'assistant' ? <Bot className="h-4 w-4" /> : <span className="text-xs">SYS</span>}
      </div>
    );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-11rem)] sm:h-[calc(100vh-12rem)]">
      {/* Connection banner for mobile */}
      <div className="flex items-center justify-between px-3 py-2 text-xs sm:text-sm bg-amber-50 text-amber-800 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>Not connected to server. Messages are kept locally.</span>
        </div>
        {messages.length > 0 && (
          <Button
            onClick={handleClearChat}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-amber-800 hover:bg-amber-100"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-10">
            Start a conversation. Shift+Enter for newline.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex w-full gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role !== 'user' && <MessageAvatar role={m.role} />}
            <div className={cn(
              'max-w-[80%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm',
              m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            )}>
              <div className="whitespace-pre-wrap break-words">{m.text}</div>
              <div className={cn('mt-1 text-[10px] opacity-70', m.role === 'user' ? 'text-blue-100' : 'text-gray-500')}>
                {new Date(m.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {m.role === 'user' && <MessageAvatar role={m.role} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 p-3 sm:p-4 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 min-h-[44px] max-h-40 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={isConnected ? 'Type a message…' : 'Type a message (offline)…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="h-10 w-12 sm:w-auto"
          >
            <Send className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
        <div className="mt-1 text-[11px] text-gray-500 flex justify-between">
          <span>Press Enter to send • Shift+Enter for newline</span>
          <span className={cn('font-medium', isConnected ? 'text-green-600' : 'text-amber-600')}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
