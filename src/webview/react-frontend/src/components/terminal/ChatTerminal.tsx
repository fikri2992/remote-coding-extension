import React, { useRef, useEffect, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { SmartInput } from './SmartInput';
import { GestureHandler } from './GestureHandler';
import { cn } from '../../lib/utils';

export interface ChatTerminalMessage {
  id: string;
  type: 'command' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
  sessionId?: string;
  status?: 'pending' | 'complete' | 'error';
}

interface ChatTerminalProps {
  messages: ChatTerminalMessage[];
  onCommand: (command: string) => void;
  onGesture?: (gesture: string, data?: any) => void;
  isConnected?: boolean;
  className?: string;
}

export const ChatTerminal: React.FC<ChatTerminalProps> = ({
  messages,
  onCommand,
  onGesture,
  isConnected = true,
  className
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle scroll to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGesture = (gesture: string, data?: any) => {
    switch (gesture) {
      case 'swipeUp':
        onGesture?.('showCommandPalette');
        break;
      case 'swipeDown':
        onGesture?.('hideKeyboard');
        break;
      case 'swipeLeft':
        onGesture?.('previousCommand');
        break;
      case 'swipeRight':
        onGesture?.('nextCommand');
        break;
      case 'longPress':
        onGesture?.('showContextMenu', data);
        break;
      case 'pinch':
        onGesture?.('adjustFontSize', data);
        break;
      default:
        onGesture?.(gesture, data);
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      <GestureHandler onGesture={handleGesture}>
        {/* Messages Container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-3"
          style={{ 
            minHeight: '300px',
            maxHeight: 'calc(100vh - 200px)',
            scrollBehavior: 'smooth'
          }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-lg font-semibold mb-2">Welcome to Chat Terminal</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Start typing a command below or swipe up to see smart suggestions
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onLongPress={(msg) => handleGesture('longPress', msg)}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </GestureHandler>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute right-4 bottom-20 bg-primary text-primary-foreground rounded-full p-2 shadow-lg z-10 transition-all duration-200 hover:scale-110"
          aria-label="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Smart Input */}
      <div className="border-t border-border bg-background/95 backdrop-blur-sm">
        <SmartInput
          onCommand={onCommand}
          onGesture={handleGesture}
          isConnected={isConnected}
          placeholder="Type a command or swipe up for suggestions..."
        />
      </div>
    </div>
  );
};