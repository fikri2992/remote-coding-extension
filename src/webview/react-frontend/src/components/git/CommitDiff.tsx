import React from 'react'
import { DiffFile, type DiffChunk } from './DiffFile'

export interface CommitItem {
  hash: string
  message: string
  author: string
  date: string | Date
}

interface Props {
  commit: CommitItem
  files: DiffChunk[]
  loading?: boolean
  onBack: () => void
  onExpandFile?: (file: string) => void
}

export const CommitDiff: React.FC<Props> = ({ commit, files, loading, onBack, onExpandFile }) => {
  const ts = typeof commit.date === 'string' ? new Date(commit.date) : commit.date
  const short = (commit.hash || '').slice(0, 7)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          className="h-12 w-12 sm:h-10 sm:w-10 inline-flex items-center justify-center rounded-lg border border-border hover:bg-muted active:bg-muted neo:rounded-none neo:border-[3px] neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)]"
          onClick={onBack}
          aria-label="Back to history"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.78 15.22a.75.75 0 01-1.06 0l-5-5a.75.75 0 010-1.06l5-5a.75.75 0 111.06 1.06L6.56 9H16a.75.75 0 010 1.5H6.56l4.22 4.22a.75.75 0 010 1.06z"/></svg>
        </button>
        <div className="min-w-0">
          <div className="text-base font-semibold line-clamp-2">{commit.message || '(no message)'}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="truncate">{commit.author || 'Unknown'}</span>
            <span>•</span>
            <span>{ts.toLocaleString()}</span>
            <span>•</span>
            <span className="font-mono">{short}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {loading && files.length === 0 && (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Loading commit…</div>
        )}
        {!loading && files.length === 0 && (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">No changes in this commit.</div>
        )}
        {files.map((d, i) => (
          <DiffFile key={`${d.file}:${i}`} chunk={d} onExpand={() => onExpandFile && onExpandFile(d.file)} />
        ))}
      </div>
    </div>
  )
}
