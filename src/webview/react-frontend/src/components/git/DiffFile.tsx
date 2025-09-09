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
    <span className={`inline-flex items-center justify-center min-w-[40px] sm:min-w-[36px] h-8 sm:h-7 px-2 rounded-full text-xs font-medium ${color} neo:rounded-none neo:border-2 neo:border-border neo:shadow-[3px_3px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[3px_3px_0_0_rgba(255,255,255,0.9)]`}>
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
        className="w-full flex items-center justify-between gap-3 px-4 py-4 sm:py-3 text-left active:bg-muted/60 neo:duration-100 min-h-[72px] sm:min-h-[auto] touch-manipulation"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && onExpand) onExpand()
        }}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm sm:text-base font-medium truncate neo:font-bold">{chunk.file}</div>
          <div className="text-xs text-muted-foreground mt-1 capitalize inline-flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs ${typeColor} neo:rounded-none neo:border-2 neo:border-border`}>{chunk.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
            {badge(chunk.additions, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', '+')}
            {badge(chunk.deletions, 'bg-rose-500/10 text-rose-700 dark:text-rose-300', '-')}
          </div>
          <svg className={`w-6 h-6 sm:w-5 sm:h-5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.104l3.71-3.873a.75.75 0 111.08 1.04l-4.25 4.44a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
        </div>
      </button>
      {open && (
        <div className="border-t border-border neo:border-t-[2px]">
          {/* Enhanced controls - Mobile responsive */}
          <div className="px-3 py-2 bg-muted/30 border-b border-border neo:border-b-[2px] space-y-2 md:space-y-0">
            {/* Mobile: Stack controls vertically, Desktop: Single row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
              {/* Primary controls */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {/* View controls */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground shrink-0">View:</span>
                  <button
                    onClick={() => setWrapMode(!wrapMode)}
                    className="px-3 py-2 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px] min-h-[32px] touch-manipulation"
                  >
                    {wrapMode ? 'Scroll' : 'Wrap'}
                  </button>
                  <button
                    onClick={() => !isNarrow && setMode(mode === 'inline' ? 'side-by-side' : 'inline')}
                    disabled={isNarrow}
                    className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px] min-h-[32px] touch-manipulation', isNarrow ? 'opacity-60 cursor-not-allowed' : 'bg-background hover:bg-muted')}
                  >
                    {isNarrow ? 'Inline' : (mode === 'inline' ? 'Inline' : 'Split')}
                  </button>
                  <button
                    onClick={() => setIgnoreWhitespace(v => !v)}
                    className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px] min-h-[32px] touch-manipulation', ignoreWhitespace ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                    title="Ignore whitespace"
                  >
                    WS-
                  </button>
                  <button
                    onClick={() => setOptionsOpen(true)}
                    className="px-3 py-2 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px] min-h-[32px] touch-manipulation"
                  >
                    More
                  </button>
                </div>
                
                {/* Size controls */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground shrink-0">Size:</span>
                  <div className="flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
                    {(['sm', 'base', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={cn(
                          'px-3 py-2 text-xs transition-colors min-h-[32px] min-w-[40px] touch-manipulation',
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
              
              {/* File info - Hidden on mobile, shown on desktop */}
              <div className="hidden md:block text-xs text-muted-foreground">
                {chunk.file.split('.').pop()?.toUpperCase()} • {rows.length} lines
              </div>
            </div>
            
            {/* Mobile file info */}
            <div className="md:hidden text-xs text-muted-foreground text-center">
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
                {/* Enhanced scroll indicator for mobile */}
                {!wrapMode && (
                  <div className="lg:hidden px-3 py-3 text-sm text-center bg-blue-50 dark:bg-blue-950/30 border-y border-blue-200 dark:border-blue-800 neo:border-y-[2px]">
                    <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
                      <svg className="w-4 h-4 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" transform="rotate(90 10 10)" />
                      </svg>
                      <span className="font-medium">Swipe left/right to see more code</span>
                      <svg className="w-4 h-4 animate-pulse" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" transform="rotate(-90 10 10)" />
                      </svg>
                    </div>
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
