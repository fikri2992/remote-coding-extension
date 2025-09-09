import React from 'react'

const ReducedMotionContext = React.createContext<boolean>(false)

export const useReducedMotion = () => React.useContext(ReducedMotionContext)

export const ReducedMotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(!!mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  return (
    <ReducedMotionContext.Provider value={reduced}>
      {children}
    </ReducedMotionContext.Provider>
  )
}

