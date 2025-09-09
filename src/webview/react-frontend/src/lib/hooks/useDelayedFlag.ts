import React from 'react'

export function useDelayedFlag(active: boolean, delayMs: number = 200) {
  const [delayed, setDelayed] = React.useState(false)

  React.useEffect(() => {
    let t: any
    if (active) {
      t = setTimeout(() => setDelayed(true), delayMs)
    } else {
      setDelayed(false)
    }
    return () => t && clearTimeout(t)
  }, [active, delayMs])

  return delayed
}

