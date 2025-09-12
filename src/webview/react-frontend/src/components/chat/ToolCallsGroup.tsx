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
}

const statusSummary = (items: ToolCallItem[]) => {
  const counts: Record<string, number> = {}
  for (const it of items) {
    const s = String(it.status || 'unknown').toLowerCase()
    counts[s] = (counts[s] || 0) + 1
  }
  return counts
}

export const ToolCallsGroup: React.FC<ToolCallsGroupProps> = ({ items, initiallyOpen, className }) => {
  const [open, setOpen] = React.useState<boolean>(!!initiallyOpen)
  React.useEffect(() => { if (typeof initiallyOpen === 'boolean') setOpen(initiallyOpen) }, [initiallyOpen])
  const counts = React.useMemo(() => statusSummary(items), [items])
  const running = Object.keys(counts).some((k) => /running|in_progress|progress|execut/i.test(k))
  const total = items.length
  return (
    <div className={cn('border border-border rounded-lg neo:rounded-none neo:border-[3px] overflow-hidden', className)}>
      <button
        type="button"
        className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-muted/40 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className="w-4 h-4 shrink-0" />
          <div className="truncate font-medium">Tool Calls</div>
          <div className="text-[11px] opacity-70">({total})</div>
          {running && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded border text-[11px] bg-blue-500/15 text-blue-300 border-blue-500/30">running</span>}
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform duration-150', open ? 'rotate-180' : '')} />
      </button>
      <div className={cn('p-2 space-y-2 border-t border-border', !open && 'hidden')}>
        {items.map((it) => (
          <ToolCallBlock key={it.id} id={it.id} name={it.name} status={it.status} initiallyOpen={/running|in_progress|progress|execut/i.test(String(it.status || ''))}>
            {it.content}
          </ToolCallBlock>
        ))}
      </div>
    </div>
  )
}

export default ToolCallsGroup

