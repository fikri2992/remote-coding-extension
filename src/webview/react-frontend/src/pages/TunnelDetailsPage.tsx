import React from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { TunnelInfo } from '../types/tunnel'
import { TunnelStatusPill } from '../components/tunnels/TunnelStatusPill'
import { Button } from '../components/ui/button'
import { ExternalLink, Copy, Share2, ArrowLeft } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { TunnelLogs } from '../components/tunnels/TunnelLogs'
import { useWebSocket } from '../components/WebSocketProvider'

// WebSocket is the only transport

export const TunnelDetailsPage: React.FC = () => {
  const { id } = useParams({ from: '/tunnels/$id' }) as { id: string }
  const [tunnel, setTunnel] = React.useState<TunnelInfo | null>(null)
  const [loading, setLoading] = React.useState(true)
  const { show } = useToast()
  const ws = useWebSocket()
  const [tab, setTab] = React.useState<'overview' | 'logs' | 'diagnostics'>('overview')

  React.useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        if (!ws) throw new Error('WebSocket not connected')
        const resp = await ws.sendRpc('tunnels', 'list')
        const items = Array.isArray(resp?.tunnels) ? resp.tunnels : (Array.isArray(resp) ? resp : resp?.data?.tunnels)
        if (Array.isArray(items)) {
          const found = items.find((t: TunnelInfo) => String(t.id) === id)
          if (mounted) setTunnel(found || null)
        }
      } catch {}
      finally { if (mounted) setLoading(false) }
    }
    load()
    return () => { mounted = false }
  }, [id, ws])

  // Subscribe to WS events to keep detail page updated
  React.useEffect(() => {
    if (!ws) return
    const unsub = ws.addMessageListener((msg: any) => {
      try {
        if (msg?.type === 'tunnelsUpdated' && Array.isArray(msg.tunnels)) {
          const found = msg.tunnels.find((t: TunnelInfo) => String(t.id) === id)
          setTunnel(found || null)
        }
        if ((msg?.type === 'tunnelCreated' || msg?.type === 'tunnelStatusUpdate') && msg.tunnel?.id === id) {
          setTunnel(msg.tunnel as TunnelInfo)
        }
        if (msg?.type === 'tunnelStopped' && msg.tunnelId === id) {
          setTunnel((prev) => prev ? { ...prev, status: 'stopped' } as TunnelInfo : prev)
        }
      } catch {}
    })
    return () => { try { unsub?.() } catch {} }
  }, [ws, id])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      show({ variant: 'info', title: 'Copied', description: 'URL copied to clipboard' })
    } catch {
      show({ variant: 'destructive', title: 'Copy failed' })
    }
  }

  const share = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kiro Tunnel', url })
        show({ variant: 'default', title: 'Shared', description: 'Link shared' })
      } else {
        await copy(url)
      }
    } catch {}
  }

  const stop = async () => {
    if (!tunnel) return
    try {
      if (!ws) throw new Error('WebSocket not connected')
      await ws.sendRpc('tunnels', 'stop', { id: tunnel.id })
      show({ variant: 'default', title: 'Tunnel stopped' })
    } catch (e: any) {
      show({ variant: 'destructive', title: 'Stop failed', description: e?.message })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/tunnels" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4" /> Back to Tunnels
        </Link>
      </div>
      {loading && (
        <div className="animate-pulse bg-card p-6 rounded-lg border border-border min-h-[160px]" />
      )}
      {!loading && !tunnel && (
        <div className="p-6 rounded-lg border border-border text-sm">Tunnel not found</div>
      )}
      {tunnel && (
        <div className="bg-card p-6 rounded-lg border border-border space-y-4">
          {/* Header with tabs */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-xl font-semibold truncate">{tunnel.name || `Tunnel ${tunnel.id.slice(-4)}`}</h2>
              <TunnelStatusPill status={tunnel.status} />
            </div>
            <div className="inline-flex items-center rounded-md overflow-hidden border border-border neo:rounded-none neo:border-[2px]">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm ${tab === 'overview' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                onClick={() => setTab('overview')}
              >Overview</button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm border-l border-border ${tab === 'logs' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                onClick={() => setTab('logs')}
              >Logs</button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm border-l border-border ${tab === 'diagnostics' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                onClick={() => setTab('diagnostics')}
              >Diagnostics</button>
            </div>
          </div>

          {/* Overview */}
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">URL:</span>
                  <a href={tunnel.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    <span className="truncate max-w-[60vw] sm:max-w-none">{tunnel.url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex flex-wrap gap-4">
                  <span><span className="font-medium">Local Port:</span> {tunnel.localPort}</span>
                  <span><span className="font-medium">Type:</span> {tunnel.type}</span>
                  <span><span className="font-medium">PID:</span> {tunnel.pid}</span>
                </div>
                <div>
                  <span className="font-medium">Created:</span> {new Date(tunnel.createdAt as any).toLocaleString()}
                </div>
                {tunnel.error && <div className="text-red-600">{tunnel.error}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => copy(tunnel.url)}><Copy className="w-4 h-4 mr-2" /> Copy URL</Button>
                <Button variant="secondary" onClick={() => share(tunnel.url)}><Share2 className="w-4 h-4 mr-2" /> Share</Button>
                <Button variant="destructive" onClick={stop}>Stop</Button>
              </div>
            </div>
          )}

          {/* Logs */}
          {tab === 'logs' && (
            <TunnelLogs tunnelId={id} />
          )}

          {/* Diagnostics (placeholder) */}
          {tab === 'diagnostics' && (
            <div className="text-sm text-muted-foreground">
              Diagnostics coming soon.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
