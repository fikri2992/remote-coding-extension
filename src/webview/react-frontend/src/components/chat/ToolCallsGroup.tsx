import * as React from 'react'
import { cn } from '@/lib/utils'
import { Wrench, ChevronDown } from 'lucide-react'
import ToolCallBlock from './ToolCallBlock'

export interface ToolCallItem {
  id: string
  name?: string
  status?: string
  content: React.ReactNode
}

export interface ToolCallsGroupProps {
  items: ToolCallItem[]
  initiallyOpen?: boolean
  className?: string
  openMap?: Record<string, boolean>
  onItemOpenChange?: (id: string, open: boolean) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const normalize = (s?: string): 'running' | 'ok' | 'failed' | 'pending' | 'unknown' => {
  const t = String(s || '').toLowerCase()
  if (/success|completed|ok|done|finished/.test(t)) return 'ok'
  if (/error|fail|denied|cancel|aborted/.test(t)) return 'failed'
  if (/running|in_progress|progress|execut/.test(t)) return 'running'
  if (/pending|wait/.test(t)) return 'pending'
  return 'unknown'
}

const statusSummary = (items: ToolCallItem[]) => {
  const counts: Record<string, number> = {}
  for (const it of items) {
    const key = normalize(it.status)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts as Partial<Record<'running' | 'ok' | 'failed' | 'pending' | 'unknown', number>>
}

export const ToolCallsGroup: React.FC<ToolCallsGroupProps> = ({ items, initiallyOpen, className, openMap, onItemOpenChange, open: controlledOpen, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(!!initiallyOpen)
  React.useEffect(() => { if (typeof initiallyOpen === 'boolean') setInternalOpen(initiallyOpen) }, [initiallyOpen])
  const open = typeof controlledOpen === 'boolean' ? controlledOpen : internalOpen
  const counts = React.useMemo(() => statusSummary(items), [items])
  const running = !!counts.running
  const total = items.length
  const summary = React.useMemo(() => {
    const parts: string[] = []
    const order: Array<'running' | 'failed' | 'pending' | 'ok' | 'unknown'> = ['running','failed','pending','ok','unknown']
    for (const key of order) {
      const n = (counts as any)[key]
      if (n) parts.push(`${n} ${key}`)
    }
    return parts.join(', ')
  }, [counts])
  return (
    <div className={cn('border border-border rounded-lg neo:rounded-none neo:border-[3px] overflow-hidden', className)}>
      <button
        type="button"
        className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-muted/40 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring')}
        onClick={() => {
          const next = !open
          if (typeof controlledOpen === 'boolean') {
            onOpenChange?.(next)
          } else {
            setInternalOpen(next)
            onOpenChange?.(next)
          }
        }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className="w-4 h-4 shrink-0" />
          <div className="truncate font-medium">Tool Calls</div>
          <div className="text-[11px] opacity-70">({total})</div>
          {summary && <div className="text-[11px] opacity-70 truncate">• {summary}</div>}
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform duration-150', open ? 'rotate-180' : '')} />
      </button>
      <div className={cn('p-2 space-y-2 border-t border-border', !open && 'hidden')}>
        {items.map((it) => {
          const defOpen = /running|in_progress|progress|execut/i.test(String(it.status || ''))
          const itemOpen = openMap && Object.prototype.hasOwnProperty.call(openMap, it.id) ? openMap[it.id] : undefined
          return (
            <ToolCallBlock
              key={it.id}
              id={it.id}
              name={it.name}
              status={it.status}
              initiallyOpen={defOpen}
              open={typeof itemOpen === 'boolean' ? itemOpen : undefined}
              onOpenChange={(v) => onItemOpenChange?.(it.id, v)}
            >
              {it.content}
            </ToolCallBlock>
          )
        })}
      </div>
    </div>
  )
}

export default ToolCallsGroup
