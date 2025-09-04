import { useEffect, useRef } from 'react'

export function usePullToRefresh(ref: React.RefObject<HTMLElement>, onRefresh: () => void, threshold = 60) {
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop !== 0) return
      startY.current = e.touches[0]?.clientY ?? null
      pulling.current = true
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current == null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > threshold) {
        pulling.current = false
        startY.current = null
        onRefresh()
      }
    }
    const onTouchEnd = () => {
      pulling.current = false
      startY.current = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [ref, onRefresh, threshold])
}

