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

  const send = () => {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="rounded-md border border-border bg-background p-3 h-64 overflow-auto text-xs whitespace-pre-wrap neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]">
        {output || 'Run a command to see output here.'}
      </div>
      <TerminalActionBar onKey={(seq) => onActionKey && onActionKey(seq)} />
      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          placeholder="Type a command"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <Button onClick={send}>Run</Button>
      </div>
    </div>
  )
}

