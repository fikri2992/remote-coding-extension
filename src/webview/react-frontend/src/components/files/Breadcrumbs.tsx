import React from 'react'
import { cn } from '../../lib/utils'

export interface Crumb { name: string; path: string }

export const Breadcrumbs: React.FC<{ items: Crumb[]; onNavigate: (path: string) => void; className?: string; rootLabel?: string }>
  = ({ items, onNavigate, className, rootLabel = 'root' }) => (
  <nav className={cn('text-sm text-muted-foreground', className)} aria-label="Breadcrumb">
    <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
      {/* Root item */}
      <li className="flex items-center min-w-0">
        <LongPressButton label={rootLabel} title="/" onClick={() => onNavigate('/')} copyValue="/" />
      </li>
      {items.map((c, idx) => (
        <li key={c.path} className="flex items-center min-w-0">
          {idx > 0 && <span className="px-1 text-muted-foreground/60">/</span>}
          <LongPressButton
            label={c.name}
            className={cn('truncate hover:underline', idx === items.length - 1 ? 'text-foreground font-medium' : 'text-foreground/90')}
            title={c.path}
            onClick={() => onNavigate(c.path)}
            copyValue={c.path}
          />
        </li>
      ))}
    </ol>
  </nav>
)

export default Breadcrumbs

// Internal: button with long-press to copy path
function LongPressButton({ label, onClick, copyValue, className, title }: { label: string; onClick: () => void; copyValue: string; className?: string; title?: string }) {
  const timerRef = React.useRef<number | null>(null)
  const pressedRef = React.useRef(false)

  const clear = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }

  const onPointerDown = () => {
    pressedRef.current = true
    clear()
    timerRef.current = window.setTimeout(async () => {
      try { await navigator.clipboard.writeText(copyValue) } catch {}
      pressedRef.current = false
    }, 500)
  }
  const onPointerUp = () => {
    if (pressedRef.current) onClick()
    pressedRef.current = false
    clear()
  }
  const onPointerLeave = clear

  return (
    <button
      className={className}
      onClick={(e) => { e.preventDefault(); /* handled by long press */ }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      title={title}
    >
      {label}
    </button>
  )
}
