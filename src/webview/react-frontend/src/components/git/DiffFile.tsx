import React from 'react'

export interface DiffChunk {
  file: string
  type: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  content: string
}

type RowType = 'meta' | 'hunk' | 'add' | 'del' | 'ctx'
interface DiffRow {
  type: RowType
  text: string
  oldNo?: number | null
  newNo?: number | null
}

const hunkRe = /^@@\s*-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/

function parseUnified(content: string): DiffRow[] {
  const rows: DiffRow[] = []
  const lines = (content || '').split('\n')
  let oldNo: number | null = null
  let newNo: number | null = null

  for (const line of lines) {
    if (line.startsWith('diff ') || line.startsWith('index ')
      || line.startsWith('--- ') || line.startsWith('+++ ')) {
      rows.push({ type: 'meta', text: line, oldNo: null, newNo: null })
      continue
    }
    if (line.startsWith('@@')) {
      const m = line.match(hunkRe)
      if (m) {
        oldNo = parseInt(m[1], 10)
        newNo = parseInt(m[2], 10)
      }
      rows.push({ type: 'hunk', text: line, oldNo: null, newNo: null })
      continue
    }
    if (line.startsWith('+')) {
      rows.push({ type: 'add', text: line, oldNo: null, newNo: newNo ?? undefined })
      if (newNo !== null) newNo += 1
      continue
    }
    if (line.startsWith('-')) {
      rows.push({ type: 'del', text: line, oldNo: oldNo ?? undefined, newNo: null })
      if (oldNo !== null) oldNo += 1
      continue
    }
    rows.push({ type: 'ctx', text: line, oldNo: oldNo ?? undefined, newNo: newNo ?? undefined })
    if (oldNo !== null) oldNo += 1
    if (newNo !== null) newNo += 1
  }
  return rows
}

export const DiffFile: React.FC<{ chunk: DiffChunk; loading?: boolean; onExpand?: () => void }>
  = ({ chunk, loading, onExpand }) => {
  const [open, setOpen] = React.useState(false)
  const [wrapMode, setWrapMode] = React.useState(false)
  const badge = (n: number, color: string, label: string) => (
    <span className={`inline-flex items-center justify-center min-w-[36px] h-7 px-2 rounded-full text-xs ${color} neo:rounded-none neo:border-2 neo:border-border neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)]`}>
      {label} {n}
    </span>
  )
  const typeColor = {
    added: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    modified: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    renamed: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }[chunk.type]

  const rows = React.useMemo(() => parseUnified(chunk.content || ''), [chunk.content])

  const rowClass = (t: RowType) => {
    switch (t) {
      case 'hunk':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
      case 'add':
        return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
      case 'del':
        return 'bg-rose-500/10 text-rose-800 dark:text-rose-300'
      case 'meta':
        return 'text-muted-foreground'
      default:
        return ''
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-4 sm:py-3 text-left active:bg-muted/60 neo:duration-100 min-h-[60px] sm:min-h-[auto]"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && onExpand) onExpand()
        }}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium truncate neo:font-bold">{chunk.file}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize inline-flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded ${typeColor} neo:rounded-none neo:border-2 neo:border-border`}>{chunk.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge(chunk.additions, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', '+')}
          {badge(chunk.deletions, 'bg-rose-500/10 text-rose-700 dark:text-rose-300', '-')}
          <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.104l3.71-3.873a.75.75 0 111.08 1.04l-4.25 4.44a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
        </div>
      </button>
      {open && (
        <div className="border-t border-border neo:border-t-[2px]">
          {/* Mobile controls */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border lg:hidden">
            <span className="text-xs text-muted-foreground">View mode:</span>
            <button
              onClick={() => setWrapMode(!wrapMode)}
              className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]"
            >
              {wrapMode ? 'Scroll' : 'Wrap'}
            </button>
          </div>
          
          <div className="px-3 py-3 text-xs sm:text-[12px] leading-5">
            {loading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : (
              <div className={wrapMode ? "overflow-hidden" : "overflow-auto"}>
                {/* Scroll indicator for mobile */}
                {!wrapMode && (
                  <div className="lg:hidden mb-2 text-xs text-muted-foreground flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                    </svg>
                    Scroll horizontally to see more
                  </div>
                )}
                
                <div className="min-w-full font-mono">
                  {rows.map((r, i) => (
                    <div key={i} className={`grid items-start gap-x-1 sm:gap-x-2 px-1 py-0.5 rounded ${rowClass(r.type)} neo:rounded-none neo:border-b-2 neo:border-border ${
                      wrapMode 
                        ? 'grid-cols-[2.5rem_2.5rem_1fr] lg:grid-cols-[3rem_3rem_1fr]' 
                        : 'grid-cols-[2.5rem_2.5rem_1fr] lg:grid-cols-[3rem_3rem_1fr]'
                    }`}>
                      <div className="text-right pr-1 text-muted-foreground select-none font-mono text-[10px] sm:text-xs">{r.oldNo ?? ''}</div>
                      <div className="text-right pr-1 text-muted-foreground select-none font-mono text-[10px] sm:text-xs">{r.newNo ?? ''}</div>
                      <div className={`px-1 sm:px-2 ${
                        wrapMode 
                          ? 'whitespace-pre-wrap break-all' 
                          : 'whitespace-pre'
                      }`}>
                        {r.text || '\u00A0'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
