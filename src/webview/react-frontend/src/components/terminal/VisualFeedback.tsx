import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';

interface VisualFeedbackProps {
  type: 'progress' | 'success' | 'error' | 'loading';
  message: string;
  progress?: number;
  duration?: number;
  onComplete?: () => void;
}

export const VisualFeedback: React.FC<VisualFeedbackProps> = ({
  type,
  message,
  progress = 0,
  duration = 3000,
  onComplete
}) => {
  const [visible, setVisible] = useState(true);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    if (type === 'progress') {
      setAnimatedProgress(progress);
    }
  }, [progress, type]);

  useEffect(() => {
    if (type !== 'loading' && type !== 'progress') {
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [type, duration, onComplete]);

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'progress':
        return '📊';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'loading':
        return '⏳';
      default:
        return '💬';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'progress':
        return cn(
          'bg-blue-50 border-blue-200 text-blue-800',
          'dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
          'neo:bg-blue-100 neo:border-blue-400 neo:text-blue-900 dark:neo:bg-blue-900 dark:neo:text-blue-100'
        );
      case 'success':
        return cn(
          'bg-green-50 border-green-200 text-green-800',
          'dark:bg-green-950 dark:border-green-800 dark:text-green-200',
          'neo:bg-green-100 neo:border-green-400 neo:text-green-900 dark:neo:bg-green-900 dark:neo:text-green-100'
        );
      case 'error':
        return cn(
          'bg-destructive/10 border-destructive/20 text-destructive',
          'neo:bg-red-100 neo:border-red-400 neo:text-red-900 dark:neo:bg-red-900 dark:neo:text-red-100'
        );
      case 'loading':
        return cn(
          'bg-yellow-50 border-yellow-200 text-yellow-800',
          'dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
          'neo:bg-yellow-100 neo:border-yellow-400 neo:text-yellow-900 dark:neo:bg-yellow-900 dark:neo:text-yellow-100'
        );
      default:
        return cn(
          'bg-card border-border text-foreground',
          'neo:bg-background neo:border-border'
        );
    }
  };

  return (
    <Card className={cn(
      'fixed top-4 right-4 z-50 p-4 shadow-lg backdrop-blur-sm',
      'transform transition-all duration-300 ease-out',
      'max-w-sm',
      'neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]',
      getColors(),
      visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    )}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{getIcon()}</span>
        <div className="flex-1">
          <p className={cn(
            'text-sm font-medium',
            'neo:font-bold'
          )}>{message}</p>
          {type === 'progress' && (
            <div className="mt-2">
              <div className={cn(
                'w-full bg-background/50 rounded-full h-2 border border-border/50',
                'neo:rounded-none neo:border-[2px] neo:border-current neo:bg-background'
              )}>
                <div 
                  className={cn(
                    'bg-current h-full rounded-full transition-all duration-300 ease-out',
                    'neo:rounded-none'
                  )}
                  style={{ width: `${animatedProgress}%` }}
                />
              </div>
              <p className={cn(
                'text-xs mt-1 opacity-70',
                'neo:font-medium neo:opacity-80'
              )}>{Math.round(animatedProgress)}% complete</p>
            </div>
          )}
          {type === 'loading' && (
            <div className="mt-2 flex space-x-1">
              <div className={cn(
                'w-2 h-2 bg-current rounded-full animate-bounce',
                'neo:rounded-none neo:w-2.5 neo:h-2.5'
              )} style={{ animationDelay: '0ms' }} />
              <div className={cn(
                'w-2 h-2 bg-current rounded-full animate-bounce',
                'neo:rounded-none neo:w-2.5 neo:h-2.5'
              )} style={{ animationDelay: '150ms' }} />
              <div className={cn(
                'w-2 h-2 bg-current rounded-full animate-bounce',
                'neo:rounded-none neo:w-2.5 neo:h-2.5'
              )} style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};