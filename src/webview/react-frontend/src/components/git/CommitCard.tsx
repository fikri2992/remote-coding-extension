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
        "w-full text-left rounded-xl border border-border bg-background px-4 py-4 sm:py-3 active:scale-[0.99] transition-transform cursor-pointer hover:bg-muted min-h-[80px] sm:min-h-[auto] " +
        "neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)] " +
        "neo:hover:bg-accent neo:hover:text-accent-foreground neo:transition-[background,box-shadow,transform] neo:duration-100"
      }
      onClick={onPress}
      aria-label={`Open commit ${short}`}
    >
      <div className="text-base font-semibold text-foreground leading-snug line-clamp-3 sm:line-clamp-2 neo:font-extrabold">
        {message || '(no message)'}
      </div>
      <div className="mt-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 text-sm text-muted-foreground neo:text-foreground">
        <span className="truncate neo:uppercase neo:font-semibold max-w-[120px] sm:max-w-none">{(author || '').trim() || 'Unknown'}</span>
        <span className="hidden sm:inline">•</span>
        <span className="text-xs sm:text-sm">{ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="hidden sm:inline">•</span>
        <span className="font-mono text-xs neo:text-foreground bg-muted px-1 rounded neo:rounded-none neo:bg-accent">{short}</span>
      </div>
    </button>
  )
}
