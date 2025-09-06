import * as React from 'react'
import { cn } from '../../lib/utils'

interface Props {
  open: boolean
  query: string
  options: { caseSensitive: boolean; regexp: boolean; wholeWord: boolean }
  onChange: (q: string) => void
  onToggleCase: () => void
  onToggleRegex: () => void
  onToggleWord: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

export const CodeSearchBar: React.FC<Props> = ({ open, query, options, onChange, onToggleCase, onToggleRegex, onToggleWord, onPrev, onNext, onClose }) => {
  if (!open) return null
  return (
    <div className={cn(
      'fixed inset-x-2 bottom-20 md:bottom-auto md:top-20 z-40 max-w-[720px] mx-auto',
      'bg-card border border-border rounded-md shadow-lg p-2',
      'neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]'
    )}>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find"
          className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm neo:rounded-none neo:border-[2px]"
        />
        <button onClick={onPrev} className="h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">Prev</button>
        <button onClick={onNext} className="h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">Next</button>
        <button onClick={onClose} className="h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">Close</button>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={options.caseSensitive} onChange={onToggleCase} /> match case
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={options.regexp} onChange={onToggleRegex} /> regexp
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" checked={options.wholeWord} onChange={onToggleWord} /> by word
        </label>
      </div>
    </div>
  )
}

export default CodeSearchBar

