import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface SmartVirtualKeyboardProps {
  onInput: (data: string) => void;
  onClose: () => void;
  className?: string;
  terminalState?: 'idle' | 'active' | 'input' | 'running';
  currentDirectory?: string;
  commandHistory?: string[];
  autoHide?: boolean;
  predictiveText?: boolean;
}

interface KeyLayout {
  id: string;
  label: string;
  value: string;
  width?: 'normal' | 'wide' | 'extra-wide';
  type?: 'normal' | 'modifier' | 'special';
}

const PROGRAMMING_LAYOUT: KeyLayout[] = [
  // Row 1: Numbers and symbols
  { id: '1', label: '1', value: '1' },
  { id: '2', label: '2', value: '2' },
  { id: '3', label: '3', value: '3' },
  { id: '4', label: '4', value: '4' },
  { id: '5', label: '5', value: '5' },
  { id: '6', label: '6', value: '6' },
  { id: '7', label: '7', value: '7' },
  { id: '8', label: '8', value: '8' },
  { id: '9', label: '9', value: '9' },
  { id: '0', label: '0', value: '0' },
  
  // Row 2: Common programming symbols
  { id: 'minus', label: '-', value: '-' },
  { id: 'equals', label: '=', value: '=' },
  { id: 'underscore', label: '_', value: '_' },
  { id: 'plus', label: '+', value: '+' },
  { id: 'pipe', label: '|', value: '|' },
  { id: 'backslash', label: '\\', value: '\\' },
  { id: 'slash', label: '/', value: '/' },
  { id: 'asterisk', label: '*', value: '*' },
  { id: 'ampersand', label: '&', value: '&' },
  { id: 'percent', label: '%', value: '%' },
  
  // Row 3: Brackets and quotes
  { id: 'lparen', label: '(', value: '(' },
  { id: 'rparen', label: ')', value: ')' },
  { id: 'lbracket', label: '[', value: '[' },
  { id: 'rbracket', label: ']', value: ']' },
  { id: 'lbrace', label: '{', value: '{' },
  { id: 'rbrace', label: '}', value: '}' },
  { id: 'lt', label: '<', value: '<' },
  { id: 'gt', label: '>', value: '>' },
  { id: 'quote', label: '"', value: '"' },
  { id: 'apostrophe', label: "'", value: "'" },
  
  // Row 4: Special characters
  { id: 'tilde', label: '~', value: '~' },
  { id: 'backtick', label: '`', value: '`' },
  { id: 'exclamation', label: '!', value: '!' },
  { id: 'at', label: '@', value: '@' },
  { id: 'hash', label: '#', value: '#' },
  { id: 'dollar', label: '$', value: '$' },
  { id: 'caret', label: '^', value: '^' },
  { id: 'question', label: '?', value: '?' },
  { id: 'colon', label: ':', value: ':' },
  { id: 'semicolon', label: ';', value: ';' },
];

const MODIFIER_KEYS: KeyLayout[] = [
  { id: 'ctrl', label: 'Ctrl', value: 'ctrl', type: 'modifier', width: 'wide' },
  { id: 'alt', label: 'Alt', value: 'alt', type: 'modifier' },
  { id: 'shift', label: 'Shift', value: 'shift', type: 'modifier', width: 'wide' },
];

const SPECIAL_KEYS: KeyLayout[] = [
  { id: 'tab', label: 'Tab', value: '\t', type: 'special', width: 'wide' },
  { id: 'enter', label: 'Enter', value: '\r', type: 'special', width: 'wide' },
  { id: 'escape', label: 'Esc', value: '\u001b', type: 'special' },
  { id: 'backspace', label: '⌫', value: '\b', type: 'special' },
  { id: 'space', label: 'Space', value: ' ', type: 'special', width: 'extra-wide' },
];

const ARROW_KEYS: KeyLayout[] = [
  { id: 'up', label: '↑', value: '\u001b[A', type: 'special' },
  { id: 'down', label: '↓', value: '\u001b[B', type: 'special' },
  { id: 'left', label: '←', value: '\u001b[D', type: 'special' },
  { id: 'right', label: '→', value: '\u001b[C', type: 'special' },
];

// Common terminal commands for predictive text
const COMMON_COMMANDS = [
  'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'cat', 'less', 'more',
  'grep', 'find', 'which', 'whereis', 'man', 'help', 'history', 'clear', 'exit',
  'sudo', 'chmod', 'chown', 'ps', 'top', 'kill', 'killall', 'jobs', 'bg', 'fg',
  'git', 'npm', 'node', 'python', 'pip', 'curl', 'wget', 'ssh', 'scp', 'rsync',
  'tar', 'gzip', 'unzip', 'vim', 'nano', 'emacs', 'code', 'claude-code'
];

// File extensions for context-aware suggestions
const FILE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.css',
  '.html', '.json', '.xml', '.md', '.txt', '.log', '.conf', '.yml', '.yaml'
];

interface PredictiveTextSuggestion {
  text: string;
  type: 'command' | 'file' | 'directory' | 'option' | 'history';
  confidence: number;
  description?: string;
}

export const SmartVirtualKeyboard: React.FC<SmartVirtualKeyboardProps> = ({
  onInput,
  onClose,
  className,
  terminalState = 'idle',
  currentDirectory = '~',
  commandHistory = [],
  autoHide = true,
  predictiveText = true
}) => {
  const [activeModifiers, setActiveModifiers] = useState<Set<string>>(new Set());
  const [currentLayout, setCurrentLayout] = useState<'programming' | 'alpha'>('programming');
  const [stickyModifiers, setStickyModifiers] = useState<Set<string>>(new Set());
  const [currentInput, setCurrentInput] = useState<string>('');
  const [suggestions, setSuggestions] = useState<PredictiveTextSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [lastInteraction, setLastInteraction] = useState<number>(Date.now());
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Predictive text engine
  const generateSuggestions = useCallback((input: string): PredictiveTextSuggestion[] => {
    if (!predictiveText || input.length < 1) return [];

    const suggestions: PredictiveTextSuggestion[] = [];
    const inputLower = input.toLowerCase();

    // Command suggestions
    COMMON_COMMANDS.forEach(cmd => {
      if (cmd.toLowerCase().startsWith(inputLower)) {
        const confidence = cmd.length === input.length ? 1.0 : 0.8 - (cmd.length - input.length) * 0.1;
        suggestions.push({
          text: cmd,
          type: 'command',
          confidence: Math.max(0.1, confidence),
          description: `Terminal command: ${cmd}`
        });
      }
    });

    // History suggestions
    commandHistory.forEach(histCmd => {
      if (histCmd.toLowerCase().includes(inputLower)) {
        const confidence = histCmd.toLowerCase().startsWith(inputLower) ? 0.9 : 0.6;
        suggestions.push({
          text: histCmd,
          type: 'history',
          confidence,
          description: 'From command history'
        });
      }
    });

    // File extension suggestions for common patterns
    if (input.includes('.') || input.includes('/')) {
      FILE_EXTENSIONS.forEach(ext => {
        if (ext.startsWith('.' + input.split('.').pop()?.toLowerCase())) {
          suggestions.push({
            text: input + ext.substring(input.split('.').pop()?.length || 0),
            type: 'file',
            confidence: 0.7,
            description: `File with ${ext} extension`
          });
        }
      });
    }

    // Sort by confidence and return top 5
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }, [predictiveText, commandHistory]);

  // Update suggestions when input changes
  useEffect(() => {
    if (currentInput.trim()) {
      const newSuggestions = generateSuggestions(currentInput);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [currentInput, generateSuggestions]);

  // Auto-hide logic based on terminal state and user interaction
  useEffect(() => {
    if (!autoHide) return;

    const resetAutoHideTimer = () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }

      // Auto-hide after 10 seconds of inactivity when terminal is running
      if (terminalState === 'running') {
        autoHideTimerRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 10000);
      }
      // Auto-hide after 30 seconds when terminal is idle
      else if (terminalState === 'idle') {
        autoHideTimerRef.current = setTimeout(() => {
          setIsVisible(false);
        }, 30000);
      }
    };

    resetAutoHideTimer();
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [terminalState, lastInteraction, autoHide]);

  // Show keyboard when terminal becomes active
  useEffect(() => {
    if (terminalState === 'input' || terminalState === 'active') {
      setIsVisible(true);
    }
  }, [terminalState]);

  // Track user interactions
  const trackInteraction = useCallback(() => {
    setLastInteraction(Date.now());
    setIsVisible(true);
  }, []);

  // Handle key press with modifier support
  const handleKeyPress = useCallback((key: KeyLayout) => {
    trackInteraction();
    let output = key.value;

    // Handle modifier keys
    if (key.type === 'modifier') {
      const newModifiers = new Set(activeModifiers);
      if (newModifiers.has(key.id)) {
        newModifiers.delete(key.id);
        // Remove from sticky if it was sticky
        const newSticky = new Set(stickyModifiers);
        newSticky.delete(key.id);
        setStickyModifiers(newSticky);
      } else {
        newModifiers.add(key.id);
      }
      setActiveModifiers(newModifiers);
      return;
    }

    // Apply modifiers to regular keys
    if (activeModifiers.has('ctrl') && key.value.length === 1) {
      // Convert to control character
      const char = key.value.toUpperCase();
      if (char >= 'A' && char <= 'Z') {
        output = String.fromCharCode(char.charCodeAt(0) - 64);
      } else if (char === 'C') {
        output = '\u0003'; // Ctrl+C
      } else if (char === 'Z') {
        output = '\u001a'; // Ctrl+Z
      } else if (char === 'D') {
        output = '\u0004'; // Ctrl+D
      }
    }

    if (activeModifiers.has('alt')) {
      // Prefix with ESC for Alt combinations
      output = '\u001b' + output;
    }

    // Update current input for predictive text
    if (key.value === '\r') {
      // Enter pressed - reset input
      setCurrentInput('');
    } else if (key.value === '\b') {
      // Backspace - remove last character
      setCurrentInput(prev => prev.slice(0, -1));
    } else if (key.value.length === 1 && !activeModifiers.has('ctrl')) {
      // Regular character - add to input
      setCurrentInput(prev => prev + key.value);
    }

    // Send the key
    onInput(output);

    // Clear non-sticky modifiers
    const newModifiers = new Set<string>();
    activeModifiers.forEach(mod => {
      if (stickyModifiers.has(mod)) {
        newModifiers.add(mod);
      }
    });
    setActiveModifiers(newModifiers);

    // Provide haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }, [activeModifiers, stickyModifiers, onInput]);

  // Handle long press for sticky modifiers
  const handleLongPress = useCallback((key: KeyLayout) => {
    trackInteraction();
    
    if (key.type === 'modifier') {
      const newSticky = new Set(stickyModifiers);
      if (newSticky.has(key.id)) {
        newSticky.delete(key.id);
      } else {
        newSticky.add(key.id);
      }
      setStickyModifiers(newSticky);
      
      // Provide haptic feedback for sticky toggle
      if ('vibrate' in navigator) {
        navigator.vibrate([25, 25, 25]);
      }
    }
  }, [stickyModifiers, trackInteraction]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: PredictiveTextSuggestion) => {
    trackInteraction();
    
    // Clear current input and replace with suggestion
    const clearInput = '\b'.repeat(currentInput.length);
    onInput(clearInput + suggestion.text);
    setCurrentInput(suggestion.text);
    setShowSuggestions(false);
    
    // Provide haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [currentInput, onInput, trackInteraction]);

  // Render a key button
  const renderKey = (key: KeyLayout) => {
    const isActive = activeModifiers.has(key.id);
    const isSticky = stickyModifiers.has(key.id);
    
    return (
      <Button
        key={key.id}
        size="sm"
        variant={isActive ? 'default' : 'secondary'}
        className={cn(
          'virtual-keyboard-key text-sm font-medium',
          'touch-manipulation select-none',
          'transition-all duration-150',
          key.width === 'wide' && 'min-w-[88px]',
          key.width === 'extra-wide' && 'min-w-[132px]',
          key.type === 'modifier' && isSticky && 'ring-2 ring-primary',
          key.type === 'special' && 'bg-muted hover:bg-muted/80'
        )}
        onClick={() => handleKeyPress(key)}
        onContextMenu={(e) => {
          e.preventDefault();
          handleLongPress(key);
        }}
        onTouchStart={() => {
          // Handle long press on touch devices
          const timer = setTimeout(() => handleLongPress(key), 500);
          const cleanup = () => {
            clearTimeout(timer);
            document.removeEventListener('touchend', cleanup);
            document.removeEventListener('touchcancel', cleanup);
          };
          document.addEventListener('touchend', cleanup);
          document.addEventListener('touchcancel', cleanup);
        }}
      >
        {key.label}
      </Button>
    );
  };

  // Don't render if auto-hidden
  if (!isVisible) {
    return (
      <div className={cn('virtual-keyboard-minimized', className)}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsVisible(true);
            trackInteraction();
          }}
          className="min-h-[44px] w-full"
        >
          Show Keyboard
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('virtual-keyboard', className)}>
      {/* Predictive text suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mb-3 p-2 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">Suggestions</div>
          <div className="flex gap-2 flex-wrap">
            {suggestions.map((suggestion, index) => (
              <Button
                key={`${suggestion.text}-${index}`}
                size="sm"
                variant="ghost"
                onClick={() => handleSuggestionSelect(suggestion)}
                className="min-h-[36px] text-xs"
                title={suggestion.description}
              >
                <span className="mr-1">
                  {suggestion.type === 'command' && '⚡'}
                  {suggestion.type === 'history' && '🕒'}
                  {suggestion.type === 'file' && '📄'}
                  {suggestion.type === 'directory' && '📁'}
                  {suggestion.type === 'option' && '⚙️'}
                </span>
                {suggestion.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Header with layout toggle and close button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={currentLayout === 'programming' ? 'default' : 'secondary'}
            onClick={() => {
              setCurrentLayout('programming');
              trackInteraction();
            }}
            className="min-h-[44px]"
          >
            Symbols
          </Button>
          <Button
            size="sm"
            variant={currentLayout === 'alpha' ? 'default' : 'secondary'}
            onClick={() => {
              setCurrentLayout('alpha');
              trackInteraction();
            }}
            className="min-h-[44px]"
          >
            ABC
          </Button>
        </div>
        <div className="flex gap-2">
          {autoHide && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsVisible(false)}
              className="min-h-[44px] min-w-[44px]"
              title="Hide keyboard"
            >
              ⬇
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px]"
            title="Close keyboard"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Modifier keys row */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {MODIFIER_KEYS.map(renderKey)}
      </div>

      {/* Special keys row */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {SPECIAL_KEYS.map(renderKey)}
      </div>

      {/* Arrow keys */}
      <div className="flex gap-2 mb-3 justify-center">
        {ARROW_KEYS.map(renderKey)}
      </div>

      {/* Main keyboard layout */}
      {currentLayout === 'programming' && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {PROGRAMMING_LAYOUT.map(renderKey)}
        </div>
      )}

      {currentLayout === 'alpha' && (
        <div className="space-y-2">
          {/* QWERTY layout for alpha mode */}
          <div className="flex gap-1 justify-center">
            {['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'].map(char => 
              renderKey({ id: char, label: char.toUpperCase(), value: char })
            )}
          </div>
          <div className="flex gap-1 justify-center">
            {['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'].map(char => 
              renderKey({ id: char, label: char.toUpperCase(), value: char })
            )}
          </div>
          <div className="flex gap-1 justify-center">
            {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(char => 
              renderKey({ id: char, label: char.toUpperCase(), value: char })
            )}
          </div>
        </div>
      )}

      {/* Context-aware quick commands */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2">
          Quick Commands {currentDirectory && `(${currentDirectory})`}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInput('ls -la\r');
              trackInteraction();
            }}
            className="min-h-[44px]"
          >
            ls -la
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInput('cd ');
              trackInteraction();
            }}
            className="min-h-[44px]"
          >
            cd
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInput('pwd\r');
              trackInteraction();
            }}
            className="min-h-[44px]"
          >
            pwd
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInput('clear\r');
              trackInteraction();
            }}
            className="min-h-[44px]"
          >
            clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onInput('\u0003'); // Ctrl+C
              trackInteraction();
            }}
            className="min-h-[44px]"
            title="Send Ctrl+C (interrupt)"
          >
            Cancel
          </Button>
          {terminalState === 'running' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onInput('\u001a'); // Ctrl+Z
                trackInteraction();
              }}
              className="min-h-[44px]"
              title="Send Ctrl+Z (suspend)"
            >
              Suspend
            </Button>
          )}
        </div>
        
        {/* Recent commands from history */}
        {commandHistory.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-2">Recent Commands</div>
            <div className="flex gap-2 flex-wrap">
              {commandHistory.slice(-3).reverse().map((cmd, index) => (
                <Button
                  key={`history-${index}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onInput(cmd + '\r');
                    trackInteraction();
                  }}
                  className="min-h-[44px] max-w-[120px] truncate text-xs"
                  title={cmd}
                >
                  {cmd}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};