import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function useClipboard() {
  return React.useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }, [])
}

export interface TextAttachmentBlockProps {
  label?: string
  text: string
  initiallyCollapsed?: boolean
  className?: string
}

export const TextAttachmentBlock: React.FC<TextAttachmentBlockProps> = ({ label, text, initiallyCollapsed, className }) => {
  const [collapsed, setCollapsed] = React.useState<boolean>(!!initiallyCollapsed)
  const copy = useClipboard()
  React.useEffect(() => { if (typeof initiallyCollapsed === 'boolean') setCollapsed(initiallyCollapsed) }, [initiallyCollapsed])
  const lines = React.useMemo(() => (text || '').split(/\r?\n/), [text])
  const tooLong = lines.length > 200 || text.length > 12000
  const view = collapsed && tooLong ? lines.slice(0, 200).join('\n') + '\n…' : text
  return (
    <div className={cn('border border-border rounded-lg neo:rounded-none neo:border-[3px] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-2 py-1 bg-muted/40 text-xs">
        <div className="opacity-80 truncate">@{label || 'context'}</div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => copy(text)} className="h-7">Copy</Button>
          {tooLong && (
            <Button size="sm" variant="secondary" onClick={() => setCollapsed((v) => !v)} className="h-7">{collapsed ? 'Expand' : 'Collapse'}</Button>
          )}
        </div>
      </div>
      <pre className="p-2 text-xs whitespace-pre-wrap overflow-auto max-h-[520px]">{view}</pre>
    </div>
  )
}

export default TextAttachmentBlock

