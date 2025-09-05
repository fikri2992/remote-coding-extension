import React, { useState } from 'react'
import { Button } from '../ui/button'

export const TerminalActionBar: React.FC<{ onKey: (seq: string) => void; className?: string }>
  = ({ onKey, className }) => {
  const [ctrl, setCtrl] = useState(false)
  const [alt, setAlt] = useState(false)

  const send = (seq: string) => onKey(seq)
  const combo = (ch: string) => {
    // Ctrl: map A-Z to control codes
    if (ctrl && /^[A-Za-z]$/.test(ch)) {
      const code = ch.toUpperCase().charCodeAt(0) - 64
      return String.fromCharCode(code)
    }
    // Alt: prefix ESC
    if (alt) return "\u001b" + ch
    return ch
  }

  return (
    <div className={`flex items-center gap-1 overflow-x-auto ${className || ''}`}>
      <Button size="sm" variant={ctrl ? 'default' : 'secondary'} onClick={() => setCtrl(!ctrl)}>Ctrl</Button>
      <Button size="sm" variant={alt ? 'default' : 'secondary'} onClick={() => setAlt(!alt)}>Alt</Button>
      <Button size="sm" variant="secondary" onClick={() => send("\t")}>Tab</Button>
      <Button size="sm" variant="secondary" onClick={() => send("\u001b")}>Esc</Button>
      <Button size="sm" variant="secondary" onClick={() => send("\u001b[A")}>↑</Button>
      <Button size="sm" variant="secondary" onClick={() => send("\u001b[B")}>↓</Button>
      <Button size="sm" variant="secondary" onClick={() => send("\u001b[D")}>←</Button>
      <Button size="sm" variant="secondary" onClick={() => send("\u001b[C")}>→</Button>
      {/* quick combos */}
      <Button size="sm" variant="secondary" onClick={() => send("\u0003")/* Ctrl+C */}>Ctrl+C</Button>
      <Button size="sm" variant="secondary" onClick={() => send(combo('c'))}>c</Button>
      <Button size="sm" variant="secondary" onClick={() => send(combo('z'))}>z</Button>
    </div>
  )
}
