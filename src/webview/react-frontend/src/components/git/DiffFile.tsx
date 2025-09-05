import React from 'react'

export interface DiffChunk {
  file: string
  type: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  content: string
}

export const DiffFile: React.FC<{ chunk: DiffChunk; loading?: boolean; onExpand?: () => void }>
  = ({ chunk, loading, onExpand }) => {
  const [open, setOpen] = React.useState(false)
  const badge = (n: number, color: string, label: string) => (
    <span className={`inline-flex items-center justify-center min-w-[36px] h-7 px-2 rounded-full text-xs ${color}`}>
      {label} {n}
    </span>
  )
  const typeColor = {
    added: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    modified: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    renamed: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }[chunk.type]

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:bg-muted/60"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && onExpand) onExpand()
        }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{chunk.file}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize inline-flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded ${typeColor}`}>{chunk.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge(chunk.additions, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', '+')}
          {badge(chunk.deletions, 'bg-rose-500/10 text-rose-700 dark:text-rose-300', '−')}
          <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.104l3.71-3.873a.75.75 0 111.08 1.04l-4.25 4.44a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-border text-xs">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap leading-relaxed">{chunk.content || 'No diff content'}</pre>
          )}
        </div>
      )}
    </div>
  )
}
