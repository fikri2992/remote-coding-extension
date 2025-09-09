import React, { useState, useRef, useEffect } from 'react';
import { CommandPalette } from './CommandPalette';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { Send, Zap, Mic } from 'lucide-react';

interface SmartInputProps {
  onCommand: (command: string) => void;
  onGesture?: (gesture: string, data?: any) => void;
  isConnected?: boolean;
  placeholder?: string;
  className?: string;
}

export const SmartInput: React.FC<SmartInputProps> = ({
  onCommand,
  onGesture: _onGesture,
  isConnected = true,
  placeholder = "Type a command...",
  className
}) => {
  const [input, setInput] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);


  // Handle command submission
  const handleSubmit = (command?: string) => {
    const cmd = command || input.trim();
    if (!cmd) return;

    // Add to history
    setCommandHistory(prev => {
      const newHistory = [cmd, ...prev.filter(h => h !== cmd)].slice(0, 50);
      return newHistory;
    });

    // Execute command
    onCommand(cmd);
    
    // Clear input
    setInput('');
    setHistoryIndex(-1);
    setShowPalette(false);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        if (!e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex] || '');
        }
        break;
      
      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput('');
        }
        break;
      
      case 'Escape':
        setShowPalette(false);
        inputRef.current?.blur();
        break;
      
      case 'Tab':
        e.preventDefault();
        setShowPalette(!showPalette);
        break;
    }
  };

  // Handle gesture from parent
  useEffect(() => {
    // This would be called from parent component
    // For now, we'll handle it internally
  }, [commandHistory, historyIndex]);

  return (
    <div className={cn('relative', className)}>
      {/* Command Palette */}
      {showPalette && (
        <div className="absolute bottom-full left-0 right-0 mb-2">
          <CommandPalette
            onCommand={handleSubmit}
            onClose={() => setShowPalette(false)}
            currentInput={input}
            commandHistory={commandHistory}
          />
        </div>
      )}

      {/* Input Container */}
      <div className="flex items-center gap-3 p-4">
        {/* Status Indicator & Quick Actions */}
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full transition-colors',
            'neo:rounded-none neo:w-3 neo:h-3',
            isConnected ? 'bg-green-500 neo:bg-green-400' : 'bg-red-500 neo:bg-red-400'
          )} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPalette(!showPalette)}
            className={cn(
              'h-10 w-10',
              'neo:rounded-none neo:border-[2px] neo:border-border',
              showPalette && 'bg-primary/10 neo:bg-primary neo:text-primary-foreground'
            )}
            aria-label="Show command palette"
          >
            <Zap className="w-4 h-4" />
          </Button>
        </div>

        {/* Input Field */}
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={!isConnected}
            className={cn(
              'text-base pr-12', // Prevent iOS zoom, space for send button
              'neo:border-[3px] neo:rounded-none neo:font-medium',
              isFocused && 'shadow-lg neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]'
            )}
          />
          
          {/* Send Button */}
          {input.trim() && (
            <Button
              size="icon"
              onClick={() => handleSubmit()}
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8',
                'neo:rounded-none neo:border-[2px] neo:shadow-[2px_2px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[2px_2px_0_0_rgba(255,255,255,0.9)]'
              )}
              aria-label="Send command"
            >
              <Send className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Voice Input Button (Future Enhancement) */}
        <Button
          variant="ghost"
          size="icon"
          disabled
          className={cn(
            'h-10 w-10 opacity-50 cursor-not-allowed',
            'neo:rounded-none neo:border-[2px] neo:border-border'
          )}
          aria-label="Voice input (coming soon)"
        >
          <Mic className="w-4 h-4" />
        </Button>
      </div>

      {/* Input Hints */}
      {isFocused && !showPalette && (
        <div className={cn(
          'px-4 pb-2 text-xs text-muted-foreground',
          'neo:font-medium neo:text-foreground neo:opacity-70'
        )}>
          <div className="flex items-center justify-between">
            <span>↑↓ History • Tab for suggestions • Enter to send</span>
            <span className="font-mono neo:font-bold">{input.length}/1000</span>
          </div>
        </div>
      )}
    </div>
  );
};