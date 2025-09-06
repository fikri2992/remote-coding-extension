import React, { useEffect, useRef } from 'react'
import { CommitCard } from './CommitCard'

export interface CommitItem {
  hash: string
  message: string
  author: string
  date: string | Date
  files?: string[]
}

interface Props {
  commits: CommitItem[]
  loading?: boolean
  canLoadMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  onSelect?: (commit: CommitItem) => void
}

export const GitHistoryViewer: React.FC<Props> = ({ commits, loading, canLoadMore = false, onLoadMore, onRefresh: _onRefresh, onSelect }) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const cooldownRef = useRef<number | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!onLoadMore || !canLoadMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          if (!loading && canLoadMore && !requestedRef.current) {
            requestedRef.current = true
            onLoadMore()
            if (cooldownRef.current) window.clearTimeout(cooldownRef.current)
            cooldownRef.current = window.setTimeout(() => { requestedRef.current = false }, 600)
          }
        }
      })
    })
    io.observe(sentinel)
    return () => { try { io.disconnect() } catch {} }
  }, [onLoadMore, canLoadMore, loading, commits.length])

  return (
    <div className="flex flex-col gap-4 pr-1">
      {/* Loading skeleton for initial load */}
      {loading && commits.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-4 animate-pulse neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]">
              <div className="h-5 bg-muted-foreground/20 rounded mb-3 neo:rounded-none"></div>
              <div className="flex items-center gap-3">
                <div className="h-3 bg-muted-foreground/15 rounded w-20 neo:rounded-none"></div>
                <div className="h-3 bg-muted-foreground/15 rounded w-24 neo:rounded-none"></div>
                <div className="h-3 bg-muted-foreground/15 rounded w-16 neo:rounded-none"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {commits.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center neo:rounded-none neo:border-[3px]">
          <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="text-sm font-medium text-muted-foreground mb-2">No commits yet</div>
          <div className="text-xs text-muted-foreground/80">This repository doesn't have any commits. Make your first commit to see history here.</div>
        </div>
      )}

      {/* Commit list */}
      {commits.map((c) => (
        <CommitCard key={c.hash} hash={c.hash} message={c.message} author={c.author} date={c.date}
          onPress={() => onSelect && onSelect(c)} />
      ))}

      {/* Load more section */}
      <div className="py-2">
        {loading && commits.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-muted-foreground">Loading more commits...</span>
          </div>
        )}
        {!loading && onLoadMore && canLoadMore && commits.length > 0 && (
          <button 
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm hover:bg-muted active:bg-muted transition-colors neo:rounded-none neo:border-[3px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)] neo:hover:bg-accent neo:hover:text-accent-foreground neo:duration-100" 
            onClick={onLoadMore}
          >
            Load more commits
          </button>
        )}
        {!loading && !canLoadMore && commits.length > 0 && (
          <div className="text-center py-4">
            <span className="text-xs text-muted-foreground">All commits loaded</span>
          </div>
        )}
      </div>
      {/* Infinite loader sentinel */}
      {canLoadMore && <div ref={sentinelRef} aria-hidden className="h-1" />}
    </div>
  )
}
