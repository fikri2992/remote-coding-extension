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
          {badge(chunk.deletions, 'bg-rose-500/10 text-rose-700 dark:text-rose-300', '-')}
          <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.104l3.71-3.873a.75.75 0 111.08 1.04l-4.25 4.44a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
        </div>
      </button>
      {open && (
        <div className="px-3 py-3 border-t border-border text-[12px] leading-5">
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-auto">
              <div className="min-w-full font-mono">
                {rows.map((r, i) => (
                  <div key={i} className={`grid grid-cols-[3rem_3rem_1fr] items-start gap-x-2 px-1 py-0.5 rounded ${rowClass(r.type)}`}>
                    <div className="text-right pr-1 text-muted-foreground select-none font-mono">{r.oldNo ?? ''}</div>
                    <div className="text-right pr-1 text-muted-foreground select-none font-mono">{r.newNo ?? ''}</div>
                    <div className="whitespace-pre px-2">{r.text || '\u00A0'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

