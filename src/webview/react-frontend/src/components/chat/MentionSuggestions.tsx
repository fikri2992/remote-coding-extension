import React from 'react'
import { cn } from '../../lib/utils'

export interface MentionItem {
  key: string
  label: string
  path: string
}

interface MentionSuggestionsProps {
  query: string
  items: MentionItem[]
  visible: boolean
  onSelect: (item: MentionItem) => void
  onClose: () => void
  className?: string
}

export const MentionSuggestions: React.FC<MentionSuggestionsProps> = ({
  query,
  items,
  visible,
  onSelect,
  onClose,
  className,
}) => {
  if (!visible) return null
  return (
    <div className={cn('z-50 w-full max-h-56 overflow-auto border border-border bg-card text-foreground rounded-md shadow-lg', className)}>
      <div className="px-2 py-1 text-[11px] text-muted-foreground">@ mention: {query || 'files'}</div>
      {items.length === 0 && (
        <div className="px-2 pb-2 text-xs text-muted-foreground">No matches</div>
      )}
      <div className="py-1">
        {items.map((it) => (
          <button
            key={it.key}
            className="w-full text-left px-2 py-1 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
            onClick={() => { onSelect(it); onClose(); }}
          >
            <div className="truncate text-foreground"><span className="opacity-70">@</span>{it.label}</div>
            <div className="text-[11px] text-muted-foreground truncate">{it.path}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

