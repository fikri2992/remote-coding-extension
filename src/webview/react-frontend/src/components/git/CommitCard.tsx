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
      className={
        "w-full text-left rounded-xl border border-border bg-background px-4 py-3 active:scale-[0.99] transition-transform cursor-pointer hover:bg-muted " +
        "neo:rounded-none neo:border-[5px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.35)] " +
        "neo:hover:bg-accent neo:hover:text-accent-foreground neo:transition-[background,box-shadow,transform] neo:duration-100"
      }
      onClick={onPress}
      aria-label={`Open commit ${short}`}
    >
      <div className="text-base font-semibold text-foreground leading-snug line-clamp-2 neo:font-extrabold">
        {message || '(no message)'}
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground neo:text-foreground">
        <span className="truncate neo:uppercase neo:font-semibold">{(author || '').trim() || 'Unknown'}</span>
        <span>•</span>
        <span>{ts.toLocaleString()}</span>
        <span>•</span>
        <span className="font-mono text-xs neo:text-foreground">{short}</span>
      </div>
    </button>
  )
}
