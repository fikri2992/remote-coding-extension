import React from 'react'
import { cn } from '../../lib/utils'
import { usePendingNav } from '../../contexts/PendingNavContext'
import { PendingSpinner } from '../feedback/PendingSpinner'
import { useToast } from '../ui/toast'

export interface Crumb { name: string; path: string }

export const Breadcrumbs: React.FC<{ items: Crumb[]; onNavigate: (path: string) => void; className?: string; rootLabel?: string }>
  = ({ items, onNavigate, className, rootLabel = 'root' }) => {
  const pending = usePendingNav()
  const { show } = useToast()
  const isPendingPath = (p: string) => pending?.isPendingPath(p)
  return (
    <nav className={cn('text-sm text-muted-foreground', className)} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
        {/* Root item */}
        <li className="flex items-center min-w-0">
          <LongPressButton label={rootLabel} title="/" onClick={() => onNavigate('/')} copyValue="/" onCopied={() => show({ title: 'Path copied', description: '/', variant: 'success' })} />
          {isPendingPath('/') && <PendingSpinner className="ml-1" size="xs" />}
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
              onCopied={() => show({ title: 'Path copied', description: c.path, variant: 'success' })}
            />
            {isPendingPath(c.path) && <PendingSpinner className="ml-1" size="xs" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumbs

// Internal: button with long-press to copy path
function LongPressButton({ label, onClick, copyValue, className, title, onCopied }: { label: string; onClick: () => void; copyValue: string; className?: string; title?: string; onCopied?: () => void }) {
  const timerRef = React.useRef<number | null>(null)
  const pressedRef = React.useRef(false)

  const clear = () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }

  const onPointerDown = () => {
    pressedRef.current = true
    clear()
    timerRef.current = window.setTimeout(async () => {
      try { await navigator.clipboard.writeText(copyValue); onCopied && onCopied() } catch {}
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
