import React from 'react';
import { cn } from '@/lib/utils';

export type MessageBubbleProps = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, children, className, title }) => {
  const alignClass = role === 'user' ? 'ml-auto' : 'mr-auto';
  const widthClass = role === 'assistant' ? 'max-w-[80ch]' : 'max-w-[70ch]';
  const baseShell = 'relative w-full ' + widthClass;

  const shellClass = cn(baseShell, alignClass, className);
  const bodyClass = cn(
    'relative border p-3 sm:p-4 text-sm leading-relaxed',
    'rounded-lg neo:rounded-none',
    'border-border neo:border-[3px] bg-background',
    role === 'user' && 'bg-primary/5',
    role === 'tool' && 'bg-muted/40',
    role === 'system' && 'bg-muted/20 text-muted-foreground'
  );

  return (
    <div className={shellClass} aria-label={`message ${role}`} data-role={role} title={title}>
      {/* Assistant accent bar */}
      {role === 'assistant' && (
        <div className="absolute -left-2 top-1.5 bottom-1.5 w-1 bg-primary rounded" aria-hidden />
      )}
      <div className={bodyClass}>
        {children}
      </div>
    </div>
  );
};

export default MessageBubble;
