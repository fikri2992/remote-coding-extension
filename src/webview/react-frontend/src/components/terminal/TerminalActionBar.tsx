import React, { useState } from 'react'
import { Button } from '../ui/button'

export const TerminalActionBar: React.FC<{ 
  onKey: (seq: string) => void; 
  onClear?: () => void;
  className?: string 
}> = ({ onKey, onClear, className }) => {
  const [ctrl, setCtrl] = useState(false)
  const [alt, setAlt] = useState(false)

  const send = (seq: string) => onKey(seq)
  const combo = (ch: string) => {
    // Ctrl: map A-Z to control codes
    if (ctrl && /^[A-Za-z]$/.test(ch)) {
      const code = ch.toUpperCase().charCodeAt(0) - 64
      send(String.fromCharCode(code))
      setCtrl(false)
      return
    }
    // Alt: prefix ESC
    if (alt) {
      setAlt(false)
      return send("\u001b" + ch)
    }
    send(ch)
  }
  
  const handleClear = () => {
    if (onClear) {
      onClear()
    } else {
      // Fallback: send clear command
      send('clear\r')
    }
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
      {/* Terminal actions */}
      <Button size="sm" variant="ghost" onClick={handleClear} title="Clear terminal screen">Clear</Button>
      {/* quick combos */}
      <Button size="sm" variant="secondary" onClick={() => send("\u0003")/* Ctrl+C */}>Ctrl+C</Button>
      <Button size="sm" variant="secondary" onClick={() => combo('c')}>c</Button>
      <Button size="sm" variant="secondary" onClick={() => combo('z')}>z</Button>
    </div>
  )
}
