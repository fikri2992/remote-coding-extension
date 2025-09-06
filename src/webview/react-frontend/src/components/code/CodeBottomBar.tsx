import * as React from 'react'
import { cn } from '../../lib/utils'
import { Search, WrapText, MoreHorizontal, Clipboard, Hash } from 'lucide-react'

interface CodeBottomBarProps {
  wrap: boolean
  onToggleWrap: () => void
  onFind: () => void
  onGoto: () => void
  onCopy: () => void
  onMore: () => void
  lines?: number
  selection?: { chars: number; lines: number }
  className?: string
}

export const CodeBottomBar: React.FC<CodeBottomBarProps> = ({
  wrap,
  onToggleWrap,
  onFind,
  onGoto,
  onCopy,
  onMore,
  lines,
  selection,
  className
}) => {
  return (
    <div
      className={cn(
        'md:hidden fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur border-t border-border',
        'px-3 pt-2 pb-2',
        'neo:border-t-[3px] neo:shadow-[0_-4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[0_-4px_0_0_rgba(255,255,255,0.9)]',
        className
      )}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onFind} className="h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px]">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={onGoto} className="h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px]">
            <Hash className="w-4 h-4" />
          </button>
          <button onClick={onToggleWrap} className={cn('h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px]', wrap ? 'bg-primary text-primary-foreground' : 'bg-background')}>
            <WrapText className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCopy} className="h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px]">
            <Clipboard className="w-4 h-4" />
          </button>
          <button onClick={onMore} className="h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px]">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{typeof lines === 'number' ? `${lines} lines` : ''}</span>
        <span>{selection && selection.chars > 0 ? `Sel: ${selection.chars} chars • ${selection.lines} lines` : 'Sel: —'}</span>
      </div>
    </div>
  )
}

export default CodeBottomBar

