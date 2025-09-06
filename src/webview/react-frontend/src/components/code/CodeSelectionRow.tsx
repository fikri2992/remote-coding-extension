import * as React from 'react'
import { cn } from '../../lib/utils'

interface Props {
  open: boolean
  selection: { chars: number; lines: number }
  onCopySelection: () => void
  onClear: () => void
}

export const CodeSelectionRow: React.FC<Props> = ({ open, selection, onCopySelection, onClear }) => {
  if (!open) return null
  return (
    <div className="fixed inset-x-0 bottom-[72px] z-40 px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className={cn(
        'mx-auto max-w-[900px] bg-card border border-border rounded-md shadow-md p-2'
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">Selection: {selection.chars} chars • {selection.lines} lines</div>
          <div className="flex items-center gap-2">
            <button onClick={onCopySelection} className="h-10 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">Copy Selection</button>
            <button onClick={onClear} className="h-10 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">Clear</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CodeSelectionRow
