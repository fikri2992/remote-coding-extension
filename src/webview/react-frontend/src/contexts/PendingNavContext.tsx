import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type PendingType = 'directory' | 'file' | 'navigation'

interface PendingTarget {
  type: PendingType
  path?: string
  label?: string
  startedAt: number
}

interface PendingNavApi {
  start: (t: { type: PendingType; path?: string; label?: string }) => void
  finish: (path?: string) => void
  fail: (err?: unknown) => void
  isActive: boolean
  target?: PendingTarget | null
  isPendingPath: (path: string) => boolean
}

const PendingNavContext = createContext<PendingNavApi | undefined>(undefined)

export const usePendingNav = () => {
  const ctx = useContext(PendingNavContext)
  if (!ctx) throw new Error('usePendingNav must be used within PendingNavProvider')
  return ctx
}

export const PendingNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [target, setTarget] = useState<PendingTarget | null>(null)
  const stateRef = useRef<PendingTarget | null>(null)

  const start = useCallback((t: { type: PendingType; path?: string; label?: string }) => {
    const next: PendingTarget = { ...t, startedAt: Date.now() }
    stateRef.current = next
    setTarget(next)
  }, [])

  const finish = useCallback((path?: string) => {
    const cur = stateRef.current
    if (cur && (!path || cur.path === path)) {
      stateRef.current = null
      setTarget(null)
    }
  }, [])

  const fail = useCallback((_err?: unknown) => {
    stateRef.current = null
    setTarget(null)
  }, [])

  const isPendingPath = useCallback((path: string) => !!(stateRef.current && stateRef.current.path === path), [])

  const value = useMemo<PendingNavApi>(() => ({
    start, finish, fail,
    isActive: !!target,
    target,
    isPendingPath,
  }), [start, finish, fail, target, isPendingPath])

  return (
    <PendingNavContext.Provider value={value}>
      {children}
    </PendingNavContext.Provider>
  )
}

