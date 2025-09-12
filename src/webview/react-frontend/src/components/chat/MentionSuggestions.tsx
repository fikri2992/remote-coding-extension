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
    <div className={cn('absolute z-50 w-full max-h-56 overflow-auto border border-border bg-card rounded shadow-sm neo:rounded-none neo:border-[3px]', className)}>
      <div className="px-2 py-1 text-[11px] text-muted-foreground">@ mention: {query || 'files'}</div>
      {items.length === 0 && (
        <div className="px-2 pb-2 text-xs text-muted-foreground">No matches</div>
      )}
      <div className="py-1">
        {items.map((it) => (
          <button
            key={it.key}
            className="w-full text-left px-2 py-1 text-sm hover:bg-muted"
            onClick={() => { onSelect(it); onClose(); }}
          >
            <div className="truncate"><span className="opacity-70">@</span>{it.label}</div>
            <div className="text-[11px] opacity-60 truncate">{it.path}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

