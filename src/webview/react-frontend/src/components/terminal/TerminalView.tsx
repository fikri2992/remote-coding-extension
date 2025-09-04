import React from 'react'
import { TerminalActionBar } from './TerminalActionBar'
import { cn } from '../../lib/utils'

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
      <div className="rounded-md border border-border bg-background p-3 h-64 overflow-auto text-xs whitespace-pre-wrap">
        {output || 'Run a command to see output here.'}
      </div>
      <TerminalActionBar onKey={(seq) => onActionKey && onActionKey(seq)} />
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          placeholder="Type a command"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className="rounded-md bg-primary px-3 py-2 text-white text-sm hover:bg-primary/90" onClick={send}>Run</button>
      </div>
    </div>
  )
}

