import React, { useState } from 'react';
import { ChatTerminalMessage } from './ChatTerminal';
import { cn } from '../../lib/utils';


interface MessageBubbleProps {
  message: ChatTerminalMessage;
  onLongPress?: (message: ChatTerminalMessage) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onLongPress }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);


  const handleTouchStart = () => {
    setIsPressed(true);
    const timer = setTimeout(() => {
      onLongPress?.(message);
      setIsPressed(false);
    }, 500); // 500ms for long press
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const getBubbleStyle = () => {
    switch (message.type) {
      case 'command':
        return {
          container: 'ml-auto max-w-[85%]',
          bubble: cn(
            // Default theme
            'bg-primary/10 border border-primary/20 text-primary rounded-2xl rounded-br-md shadow-sm',
            // Neobrutalist overrides
            'neo:rounded-none neo:border-[3px] neo:border-primary neo:bg-primary neo:text-primary-foreground',
            'neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
          ),
          icon: '💻'
        };
      case 'output':
        return {
          container: 'mr-auto max-w-[90%]',
          bubble: cn(
            // Default theme
            'bg-card border border-border text-foreground rounded-2xl rounded-bl-md shadow-sm',
            // Neobrutalist overrides
            'neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
          ),
          icon: '📄'
        };
      case 'error':
        return {
          container: 'mr-auto max-w-[90%]',
          bubble: cn(
            // Default theme
            'bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl rounded-bl-md shadow-sm',
            // Neobrutalist overrides
            'neo:rounded-none neo:border-[3px] neo:border-destructive neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
          ),
          icon: '❌'
        };
      case 'system':
        return {
          container: 'mx-auto max-w-[80%]',
          bubble: cn(
            // Default theme
            'bg-secondary/50 text-secondary-foreground border border-secondary/20 rounded-xl shadow-sm',
            // Neobrutalist overrides
            'neo:rounded-none neo:border-[3px] neo:border-secondary neo:bg-secondary neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
          ),
          icon: '⚙️'
        };
      default:
        return {
          container: 'mr-auto max-w-[90%]',
          bubble: cn(
            // Default theme
            'bg-muted text-foreground rounded-2xl rounded-bl-md shadow-sm border border-border',
            // Neobrutalist overrides
            'neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
          ),
          icon: '💬'
        };
    }
  };

  const style = getBubbleStyle();
  const isCommand = message.type === 'command';

  return (
    <div className={cn('flex flex-col', style.container)}>
      <div
        className={cn(
          'px-4 py-3 transition-all duration-200',
          style.bubble,
          isPressed && 'scale-95 neo:scale-[0.98]',
          message.status === 'pending' && 'animate-pulse',
          // Neobrutalist active state
          'neo:active:shadow-[2px_2px_0_0_rgba(0,0,0,1)] dark:neo:active:shadow-[2px_2px_0_0_rgba(255,255,255,0.9)]'
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {/* Message Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">{style.icon}</span>
          <span className={cn(
            'text-xs font-medium text-muted-foreground',
            'neo:font-bold neo:text-current neo:opacity-80'
          )}>
            {isCommand ? 'You' : 'Terminal'}
          </span>
          {message.status === 'pending' && (
            <div className="flex space-x-1">
              <div className={cn(
                'w-1 h-1 bg-current rounded-full animate-bounce',
                'neo:rounded-none neo:w-1.5 neo:h-1.5'
              )} style={{ animationDelay: '0ms' }} />
              <div className={cn(
                'w-1 h-1 bg-current rounded-full animate-bounce',
                'neo:rounded-none neo:w-1.5 neo:h-1.5'
              )} style={{ animationDelay: '150ms' }} />
              <div className={cn(
                'w-1 h-1 bg-current rounded-full animate-bounce',
                'neo:rounded-none neo:w-1.5 neo:h-1.5'
              )} style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="space-y-2">
          {message.type === 'command' ? (
            <div className={cn(
              'font-mono text-sm bg-background/50 border border-border/50 rounded px-2 py-1',
              'neo:rounded-none neo:border-[2px] neo:bg-background neo:border-border'
            )}>
              <span className="text-green-500 mr-2 neo:text-green-400 neo:font-bold">$</span>
              <span className="neo:font-semibold">{message.content}</span>
            </div>
          ) : (
            <div className={cn(
              'whitespace-pre-wrap text-sm leading-relaxed',
              'neo:font-medium neo:leading-normal'
            )}>
              {message.content}
            </div>
          )}
        </div>

        {/* Message Footer */}
        <div className={cn(
          'flex items-center justify-between mt-2 text-xs text-muted-foreground',
          'neo:text-current neo:opacity-70 neo:font-medium'
        )}>
          <span>{message.timestamp.toLocaleTimeString()}</span>
          {message.sessionId && (
            <span className="font-mono neo:font-bold">#{message.sessionId.slice(-4)}</span>
          )}
        </div>
      </div>

      {/* Status Indicators */}
      {message.status === 'error' && (
        <div className={cn(
          'text-xs text-destructive mt-1 px-2',
          'neo:font-bold neo:text-destructive'
        )}>
          Command failed
        </div>
      )}
    </div>
  );
};