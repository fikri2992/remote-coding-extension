import React from 'react'
import CodeDiffViewer, { type CodeDiffViewerHandle } from '../code/CodeDiffViewer'
import CodeDiffOptionsSheet from '../code/CodeDiffOptionsSheet'
import { cn } from '../../lib/utils'
import { useMediaQuery } from '../../lib/hooks/useMediaQuery'

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
  const [fontSize, setFontSize] = React.useState<'sm' | 'base' | 'lg'>('base')
  const [mode, setMode] = React.useState<'inline' | 'side-by-side'>('inline')
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(false)
  const isNarrow = useMediaQuery('(max-width: 767px)')
  const [wordLevel, setWordLevel] = React.useState(true)
  const [optionsOpen, setOptionsOpen] = React.useState(false)
  const viewerRef = React.useRef<CodeDiffViewerHandle | null>(null)
  const badge = (n: number, color: string, label: string) => (
    <span className={`inline-flex items-center justify-center min-w-[36px] h-7 px-2 rounded-full text-xs ${color} neo:rounded-none neo:border-2 neo:border-border neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)]`}>
      {label} {n}
    </span>
  )
  const typeColor = {
    added: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    modified: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    renamed: 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
  }[chunk.type]

  const rows = React.useMemo(() => parseUnified(chunk.content || ''), [chunk.content])

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
          {/* Enhanced controls */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border neo:border-b-[2px]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">View:</span>
                <button
                  onClick={() => setWrapMode(!wrapMode)}
                  className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]"
                >
                  {wrapMode ? 'Scroll' : 'Wrap'}
                </button>
                <button
                  onClick={() => !isNarrow && setMode(mode === 'inline' ? 'side-by-side' : 'inline')}
                  disabled={isNarrow}
                  className={cn('px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', isNarrow ? 'opacity-60 cursor-not-allowed' : 'bg-background hover:bg-muted')}
                >
                  {isNarrow ? 'Inline' : (mode === 'inline' ? 'Inline' : 'Side-by-Side')}
                </button>
                <button
                  onClick={() => setIgnoreWhitespace(v => !v)}
                  className={cn('px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', ignoreWhitespace ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                  title="Ignore whitespace"
                >
                  WS-
                </button>
                <button
                  onClick={() => setOptionsOpen(true)}
                  className="px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]"
                >
                  More
                </button>
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Size:</span>
                <div className="flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
                  {(['sm', 'base', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={cn(
                        'px-2 py-1 text-xs transition-colors',
                        fontSize === size 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-background hover:bg-muted'
                      )}
                    >
                      {size === 'sm' ? 'S' : size === 'base' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              {chunk.file.split('.').pop()?.toUpperCase()} • {rows.length} lines
            </div>
          </div>
          
          <div className="bg-background">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Loading diff...
                </div>
              </div>
            ) : (
              <div className={wrapMode ? "overflow-hidden" : "overflow-auto"}>
                {/* Scroll indicator for mobile */}
                {!wrapMode && (
                  <div className="lg:hidden px-3 py-2 text-xs text-muted-foreground flex items-center gap-1 bg-muted/20">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM8.5 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM15.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                    </svg>
                    Scroll horizontally to see more
                  </div>
                )}
                
                {/* Enhanced diff display */}
                <CodeDiffViewer
                  ref={viewerRef as any}
                  file={chunk.file}
                  content={chunk.content}
                  mode={isNarrow ? 'inline' : mode}
                  wrap={wrapMode}
                  fontSize={fontSize}
                  ignoreWhitespace={ignoreWhitespace}
                  wordLevel={wordLevel}
                />
                
                {/* Summary footer */}
                {rows.length > 0 && (
                  <div className="px-3 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground flex items-center justify-between neo:border-t-[2px]">
                    <span>{rows.length} lines • {chunk.additions} additions • {chunk.deletions} deletions</span>
                    <span className="font-mono">{chunk.file}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <CodeDiffOptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        isNarrow={isNarrow}
        mode={mode}
        onModeChange={(m) => !isNarrow && setMode(m)}
        wrap={wrapMode}
        onToggleWrap={setWrapMode}
        ignoreWhitespace={ignoreWhitespace}
        onToggleIgnoreWhitespace={setIgnoreWhitespace}
        wordLevel={wordLevel}
        onToggleWordLevel={setWordLevel}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        onExpandAll={() => viewerRef.current?.expandAll()}
        onCollapseAll={() => viewerRef.current?.collapseAll()}
      />
    </div>
  )
}

// (placeholder removed)
