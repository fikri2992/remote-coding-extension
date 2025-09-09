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
        'md:hidden sticky bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border',
        'px-3 pt-3 pb-3 mx-0',
        'neo:border-t-[3px] neo:shadow-[0_-4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[0_-4px_0_0_rgba(255,255,255,0.9)]',
        className
      )}
      style={{ 
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        marginLeft: 0,
        marginRight: 0,
        width: '100%'
      }}
    >
      <div className="flex items-center justify-between gap-3 max-w-full">
        <div className="flex items-center gap-2 flex-1">
          <button 
            onClick={onFind} 
            className="h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px] touch-manipulation"
            title="Find"
          >
            <Search className="w-4 h-4" />
          </button>
          <button 
            onClick={onGoto} 
            className="h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px] touch-manipulation"
            title="Go to line"
          >
            <Hash className="w-4 h-4" />
          </button>
          <button 
            onClick={onToggleWrap} 
            className={cn(
              'h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px] touch-manipulation',
              wrap ? 'bg-primary text-primary-foreground' : 'bg-background'
            )}
            title={wrap ? 'Disable wrap' : 'Enable wrap'}
          >
            <WrapText className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onCopy} 
            className="h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px] touch-manipulation"
            title="Copy all"
          >
            <Clipboard className="w-4 h-4" />
          </button>
          <button 
            onClick={onMore} 
            className="h-10 min-w-10 px-3 inline-flex items-center justify-center rounded-md border border-border neo:rounded-none neo:border-[2px] touch-manipulation"
            title="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>{typeof lines === 'number' ? `${lines} lines` : ''}</span>
        <span>{selection && selection.chars > 0 ? `Sel: ${selection.chars} chars • ${selection.lines} lines` : 'Sel: —'}</span>
      </div>
    </div>
  )
}

export default CodeBottomBar

