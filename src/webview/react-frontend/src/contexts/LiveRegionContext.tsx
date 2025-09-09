import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface LiveRegionApi {
  announce: (msg: string) => void
}

const LiveRegionContext = createContext<LiveRegionApi | undefined>(undefined)

export const useLiveRegion = () => {
  const ctx = useContext(LiveRegionContext)
  if (!ctx) throw new Error('useLiveRegion must be used within LiveRegionProvider')
  return ctx
}

export const LiveRegionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState('')

  const announce = useCallback((msg: string) => {
    setMessage('')
    // ensure SR re-announces even identical text
    setTimeout(() => setMessage(msg), 40)
  }, [])

  const value = useMemo(() => ({ announce }), [announce])

  return (
    <LiveRegionContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
        {message}
      </div>
    </LiveRegionContext.Provider>
  )
}

