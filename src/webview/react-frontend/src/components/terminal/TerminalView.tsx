import React from 'react'
import { TerminalActionBar } from './TerminalActionBar'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export const TerminalView: React.FC<{
  output: string
  onSend: (input: string) => void
  onActionKey?: (seq: string) => void
  className?: string
}>
  = ({ output, onSend, onActionKey, className }) => {
  const [input, setInput] = React.useState('')
  const [fontSize, setFontSize] = React.useState<'sm' | 'base' | 'lg'>('base')

  const send = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  const fontSizeClass = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg'
  }[fontSize]

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Enhanced terminal controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Font size:</span>
          <div className="flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
            {(['sm', 'base', 'lg'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={cn(
                  'px-2 py-1 text-xs transition-colors',
                  fontSize === size 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-background hover:bg-muted'
                )}
              >
                {size === 'sm' ? 'S' : size === 'base' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {output.split('\n').length} lines
        </div>
      </div>
      
      {/* Enhanced terminal output */}
      <div className={cn(
        'rounded-md border border-border bg-black text-green-400 p-4 h-80 overflow-auto font-mono leading-relaxed',
        'neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]',
        fontSizeClass
      )}>
        {output ? (
          <div className="whitespace-pre-wrap">
            {output.split('\n').map((line, index) => (
              <div key={index} className="hover:bg-green-400/10 transition-colors">
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-green-400/60 italic">
            Run a command to see output here...
          </div>
        )}
      </div>
      
      <TerminalActionBar onKey={(seq) => onActionKey && onActionKey(seq)} />
      
      {/* Enhanced input area */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 neo:rounded-none neo:border-[2px]">
          <span className="text-green-600 font-mono font-semibold">$</span>
          <Input
            className={cn(
              'flex-1 border-0 bg-transparent p-0 font-mono focus-visible:ring-0',
              fontSizeClass
            )}
            placeholder="Type a command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                send() 
              } 
            }}
          />
        </div>
        <Button 
          onClick={send}
          className="neo:rounded-none neo:border-[2px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]"
        >
          Run
        </Button>
      </div>
    </div>
  )
}

