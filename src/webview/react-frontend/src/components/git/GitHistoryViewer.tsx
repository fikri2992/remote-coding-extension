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
    <div className="flex flex-col gap-3">
      {commits.length === 0 && !loading && (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          No commits yet.
        </div>
      )}

      {commits.map((c) => (
        <CommitCard key={c.hash} hash={c.hash} message={c.message} author={c.author} date={c.date}
          onPress={() => onSelect && onSelect(c)} />
      ))}

      <div className="py-2">
        {loading && (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!loading && onLoadMore && canLoadMore && (
          <button className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" onClick={onLoadMore}>
            Load more
          </button>
        )}
      </div>
      {/* Infinite loader sentinel */}
      {canLoadMore && <div ref={sentinelRef} aria-hidden className="h-1" />}
    </div>
  )
}

