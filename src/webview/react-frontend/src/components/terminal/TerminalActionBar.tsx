import React from 'react'
import { Button } from '../ui/button'

export const TerminalActionBar: React.FC<{ onKey: (seq: string) => void; className?: string }>
  = ({ onKey, className }) => {
  const keys = [
    { label: 'Ctrl', seq: '\u0000CTRL' },
    { label: 'Alt', seq: '\u0000ALT' },
    { label: 'Tab', seq: '\t' },
    { label: 'Esc', seq: '\u001b' },
    { label: '↑', seq: '\u001b[A' },
    { label: '↓', seq: '\u001b[B' },
    { label: '←', seq: '\u001b[D' },
    { label: '→', seq: '\u001b[C' },
  ]
  return (
    <div className={`flex items-center gap-1 overflow-x-auto ${className || ''}`}>
      {keys.map(k => (
        <Button key={k.label} size="sm" variant="secondary" onClick={() => onKey(k.seq)}>{k.label}</Button>
      ))}
    </div>
  )
}

