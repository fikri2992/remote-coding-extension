import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function useClipboard() {
  return React.useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }, [])
}

export interface TerminalBlockProps {
  output: string
  terminalId?: string
  initiallyCollapsed?: boolean
  className?: string
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({ output, terminalId, initiallyCollapsed, className }) => {
  const [collapsed, setCollapsed] = React.useState<boolean>(!!initiallyCollapsed)
  const copy = useClipboard()
  React.useEffect(() => { if (typeof initiallyCollapsed === 'boolean') setCollapsed(initiallyCollapsed) }, [initiallyCollapsed])
  const lines = React.useMemo(() => (output || '').split(/\r?\n/), [output])
  const tooLong = lines.length > 120 || output.length > 8000
  const view = collapsed && tooLong ? lines.slice(0, 120).join('\n') + '\n…' : output
  return (
    <div className={cn('border border-border rounded-lg neo:rounded-none neo:border-[3px] overflow-hidden', className)}>
      <div className="flex items-center justify-between px-2 py-1 bg-muted/40 text-xs">
        <div className="opacity-80 truncate">terminal{terminalId ? ` (${terminalId})` : ''}</div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={() => copy(output)} className="h-7">Copy</Button>
          {tooLong && (
            <Button size="sm" variant="secondary" onClick={() => setCollapsed((v) => !v)} className="h-7">{collapsed ? 'Expand' : 'Collapse'}</Button>
          )}
        </div>
      </div>
      <pre className="p-2 text-xs whitespace-pre-wrap overflow-auto max-h-[520px]">{view}</pre>
    </div>
  )
}

export default TerminalBlock

