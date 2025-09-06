import * as React from 'react'
import { cn } from '../../lib/utils'
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'

interface Props {
  open: boolean
  query: string
  options: { caseSensitive: boolean; regexp: boolean; wholeWord: boolean }
  onChange: (q: string) => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onOptionsChange: (opts: { caseSensitive: boolean; regexp: boolean; wholeWord: boolean }) => void
  className?: string
}

export const CodeSearchRow: React.FC<Props> = ({ open, query, options, onChange, onPrev, onNext, onClose, onOptionsChange, className }) => {
  const [showOpts, setShowOpts] = React.useState(false)
  if (!open) return null
  return (
    <div className={cn('fixed inset-x-0 bottom-[72px] z-40 px-2', className)} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className={cn(
        'mx-auto max-w-[900px] bg-card border border-border rounded-md shadow-md p-2'
      )}>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Find"
            className="flex-1 h-10 px-3 rounded-md border border-border bg-background text-sm neo:rounded-none neo:border-[2px]"
          />
          <button onClick={onPrev} className="h-10 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={onNext} className="h-10 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setShowOpts(v => !v)} className="h-10 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]" aria-expanded={showOpts}>
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="h-10 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm neo:rounded-none neo:border-[2px]">Close</button>
        </div>
        {showOpts && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={options.caseSensitive} onChange={() => onOptionsChange({ ...options, caseSensitive: !options.caseSensitive })} /> match case
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={options.regexp} onChange={() => onOptionsChange({ ...options, regexp: !options.regexp })} /> regexp
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={options.wholeWord} onChange={() => onOptionsChange({ ...options, wholeWord: !options.wholeWord })} /> by word
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export default CodeSearchRow
