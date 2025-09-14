import React from 'react'
import { Link } from '@tanstack/react-router'
import { TunnelInfo } from '../../types/tunnel'
import { StopCircle, ExternalLink, Activity, Copy, QrCode } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'
import { QRCodeModal } from '../QRCodeModal'
import { useToast } from '../ui/toast'
import { TunnelStatusPill } from './TunnelStatusPill'

interface TunnelListProps {
  tunnels: TunnelInfo[];
  onStopTunnel: (tunnelId: string) => void;
  loading?: boolean;
  onRestartTunnel?: (tunnelId: string) => void;
  onStartQuickTunnel?: () => void;
}

export const TunnelList: React.FC<TunnelListProps> = ({
  tunnels,
  onStopTunnel,
  loading = false,
  onRestartTunnel,
  onStartQuickTunnel,
}) => {
  const { show } = useToast()
  const [qr, setQr] = React.useState<{ open: boolean; url: string }>({ open: false, url: '' })

  // Compute sorted list early to keep hooks order consistent across renders
  const sorted = React.useMemo(() => {
    const order: Record<TunnelInfo['status'], number> = {
      running: 0,
      starting: 1,
      error: 2,
      stopping: 3,
      stopped: 4,
    }
    return [...tunnels].sort((a, b) => {
      const sa = order[a.status] ?? 99
      const sb = order[b.status] ?? 99
      if (sa !== sb) return sa - sb
      const ta = new Date(a.createdAt as any).getTime()
      const tb = new Date(b.createdAt as any).getTime()
      return tb - ta
    })
  }, [tunnels])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      show({ variant: 'info', title: 'Copied', description: 'URL copied to clipboard' })
    } catch {
      show({ variant: 'destructive', title: 'Copy failed' })
    }
  }

  // Share disabled per request; keep only copy & QR

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-card p-6 rounded-lg shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tunnels.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <Activity className="w-12 h-12 mx-auto" strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Tunnels</h3>
          <p className="text-gray-600">Create your first tunnel to get started with remote access.</p>
        </CardContent>
      </Card>
    )
  }

  // 'sorted' already computed above to maintain consistent hook order

  return (
    <div className="space-y-4">
      {sorted.map((tunnel) => (
        <Card key={tunnel.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="truncate text-lg font-semibold text-gray-900">
                    {tunnel.name || `Tunnel ${tunnel.id.slice(-4)}`}
                  </h3>
                  <TunnelStatusPill status={tunnel.status} />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 font-medium">URL:</span>
                    <a href={tunnel.url} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex items-center gap-1">
                      <span className="truncate">{tunnel.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <span><span className="font-medium">Local Port:</span> {tunnel.localPort}</span>
                    <span><span className="font-medium">Type:</span> {tunnel.type}</span>
                    <span><span className="font-medium">PID:</span> {tunnel.pid}</span>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {new Date(tunnel.createdAt).toLocaleString()}
                  </div>
                  {tunnel.error && (
                    <div className="text-red-600 mt-2 p-2 bg-red-50 rounded neo:rounded-none neo:border-2 neo:border-border">
                      <span className="font-medium">Error:</span> {tunnel.error}
                    </div>
                  )}
                </div>
              </div>

              <div className="sm:ml-4 flex items-center gap-3">
                <Link to="/tunnels/$id" params={{ id: tunnel.id }} className="text-sm text-primary hover:underline">
                  Details
                </Link>
                <Tooltip content="Copy URL">
                  <Button variant="ghost" size="icon" onClick={() => copy(tunnel.url)} aria-label="Copy URL">
                    <Copy className="w-4 h-4" strokeWidth={2.5} />
                  </Button>
                </Tooltip>
                <Tooltip content="Show QR">
                  <Button variant="ghost" size="icon" onClick={() => setQr({ open: true, url: tunnel.url })}>
                    <QrCode className="w-4 h-4" strokeWidth={2.5} />
                  </Button>
                </Tooltip>
                <button
                  onClick={() => onStopTunnel(tunnel.id)}
                  className={cn('px-2 py-1 text-sm text-red-600 hover:text-red-700', tunnel.status === 'running' ? '' : 'opacity-50 cursor-not-allowed')}
                  disabled={tunnel.status !== 'running'}
                  aria-label="Stop Tunnel"
                >
                  <span className="inline-flex items-center gap-1"><StopCircle className="w-4 h-4" strokeWidth={2.5} /> Stop</span>
                </button>
                {onRestartTunnel && (
                  <button
                    onClick={() => onRestartTunnel(tunnel.id)}
                    className="px-2 py-1 text-sm text-foreground hover:underline disabled:opacity-50"
                    disabled={tunnel.status === 'starting' || tunnel.status === 'stopping'}
                  >
                    Restart
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <QRCodeModal open={qr.open} onClose={() => setQr({ open: false, url: '' })} url={qr.url} />
    </div>
  )
}
