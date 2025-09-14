import * as React from 'react'
import { Button } from '../ui/button'
import { useToast } from '../ui/toast'
import { useWebSocket } from '../WebSocketProvider'

interface TunnelLogsProps {
  tunnelId: string
}

export const TunnelLogs: React.FC<TunnelLogsProps> = ({ tunnelId }) => {
  const [lines, setLines] = React.useState<string[]>([])
  const [paused, setPaused] = React.useState(false)
  const { show } = useToast()
  let ws: ReturnType<typeof useWebSocket> | null = null
  try { ws = useWebSocket() } catch { ws = null }

  const pushLine = React.useCallback((text: string) => {
    if (paused) return
    setLines(prev => {
      const next = [...prev, text]
      if (next.length > 500) next.splice(0, next.length - 500)
      return next
    })
  }, [paused])

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      const type = msg?.type || msg?.command
      if (!type) return
      if (type === 'tunnelLog' && (msg?.tunnelId === tunnelId || msg?.id === tunnelId)) {
        if (typeof msg.line === 'string') pushLine(msg.line)
        if (Array.isArray(msg.lines)) msg.lines.forEach((l: any) => pushLine(String(l)))
      }
      else if (type === 'tunnelLogs' && (msg?.tunnelId === tunnelId || msg?.id === tunnelId) && Array.isArray(msg.lines)) {
        msg.lines.forEach((l: any) => pushLine(String(l)))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [tunnelId, pushLine])

  React.useEffect(() => {
    if (!ws) return
    const unsub = ws.addMessageListener((data: any) => {
      try {
        const t = data?.type
        if (t === 'tunnel' && data?.data?.op === 'log' && (data?.data?.tunnelId === tunnelId || data?.data?.id === tunnelId)) {
          const line = data?.data?.line
          if (typeof line === 'string') pushLine(line)
        }
      } catch {}
    })
    return () => { try { unsub?.() } catch {} }
  }, [ws, tunnelId, pushLine])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      show({ variant: 'info', title: 'Copied logs' })
    } catch {}
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Logs</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</Button>
          <Button size="sm" variant="secondary" onClick={() => setLines([])}>Clear</Button>
          <Button size="sm" variant="secondary" onClick={copy}>Copy</Button>
        </div>
      </div>
      <div className="rounded-md border border-border bg-muted/30 p-2 max-h-64 overflow-auto text-xs font-mono whitespace-pre-wrap">
        {lines.length === 0 ? (
          <div className="text-muted-foreground">No logs yet.</div>
        ) : (
          lines.map((l, i) => <div key={i} className="leading-relaxed">{l}</div>)
        )}
      </div>
    </div>
  )
}
