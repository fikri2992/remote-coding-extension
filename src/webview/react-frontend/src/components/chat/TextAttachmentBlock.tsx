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
  alwaysShowToggle?: boolean
}

export const TextAttachmentBlock: React.FC<TextAttachmentBlockProps> = ({ label, text, initiallyCollapsed, className, alwaysShowToggle }) => {
  const [collapsed, setCollapsed] = React.useState<boolean>(!!initiallyCollapsed)
  const [hidden, setHidden] = React.useState<boolean>(false)
  const copy = useClipboard()
  React.useEffect(() => { if (typeof initiallyCollapsed === 'boolean') setCollapsed(initiallyCollapsed) }, [initiallyCollapsed])
  const lines = React.useMemo(() => (text || '').split(/\r?\n/), [text])
  const tooLong = lines.length > 200 || text.length > 12000
  const showToggle = alwaysShowToggle || tooLong
  const view = React.useMemo(() => {
    if (hidden) return ''
    if (collapsed && tooLong) return lines.slice(0, 200).join('\n') + '\n…'
    return text
  }, [hidden, collapsed, tooLong, lines, text])
  return (
    <div className={cn('border border-border rounded-lg neo:rounded-none neo:border-[3px] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-2 py-1 bg-muted/40 text-xs">
        <div className="opacity-80 truncate">@{label || 'context'}</div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => copy(text)} className="h-7">Copy</Button>
          {showToggle && (
            <Button size="sm" variant="secondary" onClick={() => setCollapsed((v) => !v)} className="h-7">{collapsed ? 'Expand' : 'Collapse'}</Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setHidden((v) => !v)} className="h-7">{hidden ? 'Show' : 'Hide'}</Button>
        </div>
      </div>
      <pre className={cn(
        "p-2 text-xs whitespace-pre-wrap overflow-auto max-h-[520px]",
        hidden && "bg-muted/30 text-muted-foreground italic"
      )}>
        {hidden ? "Content hidden" : view}
      </pre>
    </div>
  )
}

export default TextAttachmentBlock

