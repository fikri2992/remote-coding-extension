import React from 'react'
import { useReducedMotion } from '../../contexts/ReducedMotionContext'

type Ripple = { id: number; x: number; y: number; size: number }

export function useRipple() {
  const [ripples, setRipples] = React.useState<Ripple[]>([])
  const counter = React.useRef(0)
  const reduced = useReducedMotion()

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (reduced) return
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    const id = ++counter.current
    const r: Ripple = { id, x, y, size }
    setRipples((prev) => [...prev, r])
    window.setTimeout(() => setRipples((prev) => prev.filter((rr) => rr.id !== id)), 500)
  }

  const RippleEl = (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {ripples.map((r) => (
        <span
          key={r.id}
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          className="absolute rounded-full bg-foreground/15 dark:bg-foreground/20 animate-[ripple_500ms_ease-out]"
        />
      ))}
      <style>{`
        @keyframes ripple {
          0% { transform: scale(0); opacity: 0.5; }
          80% { transform: scale(1); opacity: 0.15; }
          100% { transform: scale(1.1); opacity: 0; }
        }
      `}</style>
    </span>
  )

  return { onPointerDown, Ripple: RippleEl }
}
