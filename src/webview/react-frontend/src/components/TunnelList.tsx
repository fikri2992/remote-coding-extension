import React from 'react';
import { TunnelInfo } from '../types/tunnel';
import { StopCircle, ExternalLink, Clock, Activity, Copy, QrCode } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';
import { QRCodeModal } from './QRCodeModal';
import { useToast } from './ui/toast';

interface TunnelListProps {
  tunnels: TunnelInfo[];
  onStopTunnel: (tunnelId: string) => void;
  loading?: boolean;
}

export const TunnelList: React.FC<TunnelListProps> = ({
  tunnels,
  onStopTunnel,
  loading = false
}) => {
  const { show } = useToast();
  const [qr, setQr] = React.useState<{ open: boolean; url: string }>({ open: false, url: '' });
  const getStatusColor = (status: TunnelInfo['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'starting':
        return 'bg-blue-100 text-blue-800';
      case 'stopping':
        return 'bg-yellow-100 text-yellow-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: TunnelInfo['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4" strokeWidth={2.5} />;
      case 'starting':
      case 'stopping':
        return <Clock className="w-4 h-4" strokeWidth={2.5} />;
      default:
        return null;
    }
  };

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
    );
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
    );
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      show({ variant: 'info', title: 'Copied', description: 'URL copied to clipboard' });
    } catch {
      show({ variant: 'destructive', title: 'Copy failed' });
    }
  };

  return (
    <div className="space-y-4">
      {tunnels.map((tunnel) => (
        <Card key={tunnel.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="truncate text-lg font-semibold text-gray-900">
                    {tunnel.name || `Tunnel ${tunnel.id.slice(-4)}`}
                  </h3>
                  <Badge className={cn(getStatusColor(tunnel.status))}>{getStatusIcon(tunnel.status)}{tunnel.status}</Badge>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 font-medium">URL:</span>
                    <a href={tunnel.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:text-blue-800 flex items-center gap-1">
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

              <div className="sm:ml-4 flex items-center gap-2">
                <Tooltip content="Copy URL">
                  <Button variant="secondary" size="icon" onClick={() => copy(tunnel.url)}>
                    <Copy className="w-4 h-4" strokeWidth={2.5} />
                  </Button>
                </Tooltip>
                <Tooltip content="Show QR">
                  <Button variant="secondary" size="icon" onClick={() => setQr({ open: true, url: tunnel.url })}>
                    <QrCode className="w-4 h-4" strokeWidth={2.5} />
                  </Button>
                </Tooltip>
                <Button
                  onClick={() => onStopTunnel(tunnel.id)}
                  className={cn('px-3 py-2 text-sm', tunnel.status === 'running' ? '' : 'opacity-50 cursor-not-allowed')}
                  variant="destructive"
                  disabled={tunnel.status !== 'running'}
                >
                  <StopCircle className="w-4 h-4" strokeWidth={2.5} /> Stop
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <QRCodeModal open={qr.open} onClose={() => setQr({ open: false, url: '' })} url={qr.url} />
    </div>
  );
};
