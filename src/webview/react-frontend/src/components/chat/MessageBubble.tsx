import React from 'react';
import { cn } from '@/lib/utils';

export type MessageBubbleProps = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  children: React.ReactNode;
  className?: string;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, children, className }) => {
  return (
    <div className={cn('max-w-[900px] w-full', role === 'user' ? 'ml-auto' : '', className)}>
      <div className={cn('rounded border border-border p-2', role === 'user' ? 'bg-primary/5' : 'bg-background')}>
        {children}
      </div>
    </div>
  );
};

export default MessageBubble;

