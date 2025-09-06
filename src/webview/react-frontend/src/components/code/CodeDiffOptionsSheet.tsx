import * as React from 'react'
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetFooter } from '../ui/bottom-sheet'
import { cn } from '../../lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  isNarrow: boolean
  mode: 'inline' | 'side-by-side'
  onModeChange: (m: 'inline' | 'side-by-side') => void
  wrap: boolean
  onToggleWrap: (next: boolean) => void
  ignoreWhitespace: boolean
  onToggleIgnoreWhitespace: (next: boolean) => void
  wordLevel: boolean
  onToggleWordLevel: (next: boolean) => void
  fontSize: 'sm' | 'base' | 'lg'
  onFontSizeChange: (s: 'sm' | 'base' | 'lg') => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

export const CodeDiffOptionsSheet: React.FC<Props> = ({ open, onClose, isNarrow, mode, onModeChange, wrap, onToggleWrap, ignoreWhitespace, onToggleIgnoreWhitespace, wordLevel, onToggleWordLevel, fontSize, onFontSizeChange, onExpandAll, onCollapseAll }) => {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Diff Options">
      <BottomSheetHeader>
        <BottomSheetTitle>Diff Options</BottomSheetTitle>
        <button onClick={onClose} className="px-2 py-1 text-xs rounded border border-border neo:rounded-none neo:border-[2px]">Close</button>
      </BottomSheetHeader>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">View</div>
          <div className="inline-flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
            {(['inline', 'side-by-side'] as const).map(m => (
              <button key={m} disabled={isNarrow && m === 'side-by-side'} onClick={() => onModeChange(m)} className={cn('px-3 py-2 text-xs capitalize', mode === m ? 'bg-primary text-primary-foreground' : 'bg-background', isNarrow && m === 'side-by-side' ? 'opacity-60 cursor-not-allowed' : '')}>{m === 'inline' ? 'Inline' : 'Side-by-side'}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Toggles</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onToggleWrap(!wrap)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', wrap ? 'bg-primary text-primary-foreground' : 'bg-background')}>Wrap</button>
            <button onClick={() => onToggleIgnoreWhitespace(!ignoreWhitespace)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', ignoreWhitespace ? 'bg-primary text-primary-foreground' : 'bg-background')}>Ignore WS</button>
            <button onClick={() => onToggleWordLevel(!wordLevel)} className={cn('px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]', wordLevel ? 'bg-primary text-primary-foreground' : 'bg-background')}>Word-level</button>
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Font Size</div>
          <div className="inline-flex rounded border border-border neo:rounded-none neo:border-[2px] overflow-hidden">
            {(['sm', 'base', 'lg'] as const).map(s => (
              <button key={s} onClick={() => onFontSizeChange(s)} className={cn('px-3 py-2 text-xs', fontSize === s ? 'bg-primary text-primary-foreground' : 'bg-background')}>{s === 'sm' ? 'S' : s === 'base' ? 'M' : 'L'}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onExpandAll} className="px-3 py-2 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]">Expand all</button>
          <button onClick={onCollapseAll} className="px-3 py-2 text-xs rounded border border-border bg-background hover:bg-muted neo:rounded-none neo:border-[2px]">Collapse all</button>
        </div>
      </div>

      <BottomSheetFooter>
        <button onClick={onClose} className="px-3 py-2 text-xs rounded border border-border neo:rounded-none neo:border-[2px]">Done</button>
      </BottomSheetFooter>
    </BottomSheet>
  )
}

export default CodeDiffOptionsSheet

