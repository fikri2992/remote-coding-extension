import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, Wrench } from 'lucide-react'

export interface ToolCallBlockProps {
  name?: string
  status?: string
  id?: string
  kind?: string
  initiallyOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children?: React.ReactNode
}

const statusStyle = (status?: string) => {
  const s = String(status || '').toLowerCase()
  if (/success|completed|ok|done/.test(s)) return 'bg-green-500/15 text-green-400 border-green-500/30'
  if (/error|fail|denied|cancel/.test(s)) return 'bg-red-500/15 text-red-400 border-red-500/30'
  if (/running|in_progress|progress|execut/.test(s)) return 'bg-blue-500/15 text-blue-300 border-blue-500/30'
  if (/pending|wait/.test(s)) return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
  return 'bg-muted text-foreground/80 border-border'
}

export const ToolCallBlock: React.FC<ToolCallBlockProps> = ({ name, status, id, kind, initiallyOpen, open: openProp, onOpenChange, className, children }) => {
  const isControlled = typeof openProp === 'boolean'
  const [openState, setOpenState] = React.useState<boolean>(!!initiallyOpen)
  React.useEffect(() => { if (!isControlled && typeof initiallyOpen === 'boolean') setOpenState(initiallyOpen) }, [initiallyOpen, isControlled])
  const open = isControlled ? (openProp as boolean) : openState
  const setOpen = (v: boolean | ((b: boolean) => boolean)) => {
    const next = typeof v === 'function' ? (v as any)(open) : v
    if (isControlled) { onOpenChange?.(next) } else { setOpenState(next) }
  }
  const label = name || 'tool'
  const showKindBadge = !!(kind && kind.toLowerCase() !== String(label).toLowerCase())
  return (
    <div className={cn('border rounded-lg neo:rounded-none neo:border-[3px] overflow-hidden', className)}>
      <button
        type="button"
        className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-muted/40 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id ? `tool-body-${id}` : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className="w-4 h-4 shrink-0" />
          <div className="truncate font-medium">{label}</div>
          {showKindBadge && (
            <span className={cn('ml-1 inline-flex items-center px-2 py-0.5 rounded border text-[11px] shrink-0 bg-muted text-foreground/80 border-border')}>{kind}</span>
          )}
          {status && (
            <span className={cn('ml-2 inline-flex items-center px-2 py-0.5 rounded border text-[11px] shrink-0', statusStyle(status))}>{status}</span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform duration-150', open ? 'rotate-180' : '')} />
      </button>
      <div id={id ? `tool-body-${id}` : undefined} className={cn('p-3 border-t border-border', !open && 'hidden')}>
        {children}
      </div>
    </div>
  )
}

export default ToolCallBlock
