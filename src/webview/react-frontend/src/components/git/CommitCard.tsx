import React from 'react'

export interface CommitCardProps {
  hash: string
  message: string
  author: string
  date: string | Date
  onPress?: () => void
}

export const CommitCard: React.FC<CommitCardProps> = ({ hash, message, author, date, onPress }) => {
  const ts = typeof date === 'string' ? new Date(date) : date
  const short = (hash || '').slice(0, 7)
  return (
    <button
      type="button"
      className="w-full text-left rounded-xl border border-border bg-background px-4 py-3 active:scale-[0.99] transition-transform cursor-pointer hover:bg-muted"
      onClick={onPress}
      aria-label={`Open commit ${short}`}
    >
      <div className="text-base font-semibold text-foreground leading-snug line-clamp-2">
        {message || '(no message)'}
      </div>
      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="truncate">{(author || '').trim() || 'Unknown'}</span>
        <span>•</span>
        <span>{ts.toLocaleString()}</span>
        <span>•</span>
        <span className="font-mono text-xs">{short}</span>
      </div>
    </button>
  )
}
