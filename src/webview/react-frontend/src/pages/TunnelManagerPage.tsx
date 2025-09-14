import React, { useState, useEffect, useRef } from 'react';
import { TunnelForm } from '../components/tunnels/TunnelForm';
import { TunnelList } from '../components/tunnels/TunnelList';
import { TunnelActions } from '../components/tunnels/TunnelActions';
import { TunnelInfo, CreateTunnelRequest } from '../types/tunnel';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '../components/ui/toast';
import useConfirm from '../lib/hooks/useConfirm';
import { usePullToRefresh } from '../lib/hooks/usePullToRefresh';
import { useWebSocket } from '../components/WebSocketProvider';

// VS Code transport removed; WebSocket is the single transport

// All non-VSCode operations will go over WebSocket ACP via useWebSocket()

export const TunnelManagerPage: React.FC = () => {
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const { show } = useToast();
  const [confirm, ConfirmUI] = useConfirm();
  const containerRef = useRef<HTMLDivElement>(null);
  const ws = (() => { try { return useWebSocket(); } catch { return null as any; } })();

  // VS Code message handling removed

  // Load initial tunnel data
  useEffect(() => {
    (async () => {
      setRefreshing(true);
      try {
        if (ws) {
          const resp = await ws.sendRpc('tunnels', 'list');
          const tunnelsResp = resp?.tunnels || resp?.data?.tunnels || resp;
          if (Array.isArray(tunnelsResp)) setTunnels(tunnelsResp as TunnelInfo[]);
        }
      } catch (e) { /* ignore */ }
      finally { setRefreshing(false); }
    })();
  }, [ws]);

  const handleCreateTunnel = async (request: CreateTunnelRequest) => {
    setCreatingTunnel(true);
    try {
      if (!ws) throw new Error('WebSocket not connected');
      const res = await ws.sendRpc('tunnels', 'create', request);
      const tunnel = res?.tunnel || res?.data || res;
      if (tunnel && tunnel.url) {
        setTunnels(prev => [...prev, tunnel as TunnelInfo]);
        setNotification({ type: 'success', message: `Tunnel created successfully! Access at ${tunnel.url}` });
        show({ variant: 'success', title: 'Tunnel created', description: tunnel.url });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to create tunnel' });
      show({ variant: 'destructive', title: 'Create failed', description: e?.message });
    } finally {
      setCreatingTunnel(false);
    }
  };

  const handleStopTunnel = async (tunnelId: string) => {
    const target = tunnels.find(t => t.id === tunnelId);
    const ok = await confirm({
      title: 'Stop tunnel?',
      description: target?.name ? `This will stop “${target.name}” and close its public URL.` : 'This will stop the tunnel and close its public URL.',
      confirmLabel: 'Stop',
      cancelLabel: 'Cancel',
      confirmVariant: 'destructive',
    });
    if (!ok) return;
    try {
      if (!ws) throw new Error('WebSocket not connected');
      await ws.sendRpc('tunnels', 'stop', { id: tunnelId });
      // rely on broadcast; optimistically update
      setTunnels(prev => prev.filter(t => t.id !== tunnelId));
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to stop tunnel' });
      show({ variant: 'destructive', title: 'Stop failed', description: e?.message });
    }
  };

  const handleStopAll = async () => {
    const running = tunnels.filter(t => t.status === 'running').length;
    if (running > 0) {
      const ok = await confirm({
        title: 'Stop all tunnels?',
        description: `This will stop ${running} running tunnel${running === 1 ? '' : 's'} and close their URLs.`,
        confirmLabel: 'Stop All',
        cancelLabel: 'Cancel',
        confirmVariant: 'destructive',
      });
      if (!ok) return;
    }
    setLoading(true);
    try {
      if (!ws) throw new Error('WebSocket not connected');
      await ws.sendRpc('tunnels', 'stopAll');
      setTunnels([]);
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to stop tunnels' });
      show({ variant: 'destructive', title: 'Stop all failed', description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRestartTunnel = async (tunnelId: string) => {
    try {
      if (!ws) throw new Error('WebSocket not connected');
      await ws.sendRpc('tunnels', 'restart', { id: tunnelId });
      show({ variant: 'default', title: 'Restart requested' });
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to restart tunnel' });
      show({ variant: 'destructive', title: 'Restart failed', description: e?.message });
    }
  };

  const handleStartQuickTunnel = () => {
    let port = 3000;
    try {
      const saved = (typeof window !== 'undefined' && window.localStorage.getItem('KIRO_LAST_TUNNEL_PORT')) || '';
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 65535) port = n;
    } catch {}
    handleCreateTunnel({ type: 'quick', localPort: port });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!ws) throw new Error('WebSocket not connected');
      const res = await ws.sendRpc('tunnels', 'list');
      const tunnelsResp = res?.tunnels || res?.data?.tunnels || res;
      if (Array.isArray(tunnelsResp)) setTunnels(tunnelsResp as TunnelInfo[]);
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to refresh tunnels' });
      show({ variant: 'destructive', title: 'Refresh failed', description: e?.message });
    } finally {
      setRefreshing(false);
    }
  };

  // Enable pull-to-refresh on mobile
  usePullToRefresh(containerRef as any, handleRefresh, 70);

  // Listen to WebSocket tunnel events
  useEffect(() => {
    if (!ws) return;
    const unsub = ws.addMessageListener((msg: any) => {
      const type = msg?.type;
      switch (type) {
        case 'tunnelCreated':
          if (msg.tunnel) {
            setTunnels(prev => [...prev, msg.tunnel]);
            setNotification({ type: 'success', message: `Tunnel created successfully! Access at ${msg.tunnel.url}` });
            show({ variant: 'success', title: 'Tunnel created', description: msg.tunnel.url });
          }
          break;
        case 'tunnelStopped':
          if (msg.tunnelId) {
            setTunnels(prev => prev.filter(t => t.id !== msg.tunnelId));
            setNotification({ type: 'success', message: 'Tunnel stopped successfully.' });
            show({ variant: 'default', title: 'Tunnel stopped' });
          }
          break;
        case 'tunnelsUpdated':
          if (Array.isArray(msg.tunnels)) setTunnels(msg.tunnels);
          break;
        case 'tunnelError':
          setNotification({ type: 'error', message: msg.error || 'An error occurred with the tunnel.' });
          show({ variant: 'destructive', title: 'Tunnel error', description: msg.error });
          break;
      }
    });
    return () => { try { unsub?.(); } catch {} };
  }, [ws]);

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div ref={containerRef} className="space-y-6 overflow-y-auto pb-24 sm:pb-0">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' :
          notification.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {notification.type === 'info' && <Info className="w-5 h-5" />}
          <span className="text-sm">{notification.message}</span>
        </div>
      )}

      {/* Tunnel Actions */}
      <TunnelActions
        tunnels={tunnels}
        onRefresh={handleRefresh}
        onStopAll={handleStopAll}
        loading={loading || refreshing}
        disabled={creatingTunnel}
      />

      {/* Create Tunnel Form */}
      <TunnelForm
        onCreateTunnel={handleCreateTunnel}
        loading={creatingTunnel}
        disabled={loading || refreshing}
      />

      {/* Active Tunnels List */}
      <div className="space-y-4 neo:divide-y-[3px] neo:divide-border">
        <h3 className="text-lg font-semibold text-foreground">Active Tunnels</h3>
      <TunnelList
        tunnels={tunnels}
        onStopTunnel={handleStopTunnel}
        onRestartTunnel={handleRestartTunnel}
        onStartQuickTunnel={handleStartQuickTunnel}
        loading={refreshing}
      />

      <ConfirmUI />
      </div>

      {/* Status Summary */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <h4 className="text-sm font-medium text-foreground mb-2">Status Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total:</span>
            <span className="ml-2 font-medium">{tunnels.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Running:</span>
            <span className="ml-2 font-medium text-green-600">
              {tunnels.filter(t => t.status === 'running').length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Starting:</span>
            <span className="ml-2 font-medium text-blue-600">
              {tunnels.filter(t => t.status === 'starting').length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Errors:</span>
            <span className="ml-2 font-medium text-red-600">
              {tunnels.filter(t => t.status === 'error').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
