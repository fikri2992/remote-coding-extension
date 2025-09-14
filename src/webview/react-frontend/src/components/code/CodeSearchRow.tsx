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
  const ref = React.useRef<HTMLDivElement | null>(null)

  // Close when clicking outside
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = ref.current
      if (!el) return
      const target = e.target as Node
      if (!el.contains(target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className={cn('fixed inset-x-0 z-50 px-2', className)}
      style={{
        // Keep above the bottom bar and respect safe area on mobile
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)'
      }}
    >
      <div
        ref={ref}
        className={cn(
          'mx-auto w-full max-w-[900px] bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70',
          'border border-border rounded-md shadow-lg p-2'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <input
            autoFocus
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Find"
            className="flex-1 h-10 px-3 rounded-md border border-border bg-background text-sm neo:rounded-none neo:border-[2px] min-w-0"
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
