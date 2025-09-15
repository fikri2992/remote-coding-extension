import React, { useState, useEffect, useRef } from 'react';
import { TunnelForm } from '../components/tunnels/TunnelForm';
import { TunnelList } from '../components/tunnels/TunnelList';
import { TunnelInfo, CreateTunnelRequest } from '../types/tunnel';
import { AlertCircle, CheckCircle, Info, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '../components/ui/toast';
import useConfirm from '../lib/hooks/useConfirm';
import { usePullToRefresh } from '../lib/hooks/usePullToRefresh';
import { useWebSocket } from '../components/WebSocketProvider';

// VS Code transport removed; WebSocket is the single transport

// All non-VSCode operations will go over WebSocket ACP via useWebSocket()

export const TunnelManagerPage: React.FC = () => {
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listCollapsed, setListCollapsed] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const { show } = useToast();
  const [confirm, ConfirmUI] = useConfirm();
  const containerRef = useRef<HTMLDivElement>(null);
  const ws = useWebSocket();
  const isConnected = ws?.isConnected ?? false;

  type PendingAction = { op: 'create' | 'stop' | 'stopAll' | 'restart'; payload: any; tempId?: string };
  const [actionQueue, setActionQueue] = useState<PendingAction[]>([]);

  const upsertById = (list: TunnelInfo[], item: TunnelInfo): TunnelInfo[] => {
    const idx = list.findIndex(t => t.id === item.id);
    if (idx >= 0) {
      const next = [...list];
      next[idx] = item;
      return next;
    }
    return [...list, item];
  };

  const removeTempFor = (list: TunnelInfo[], real: TunnelInfo): TunnelInfo[] => {
    return list.filter(t => !(t.pid === 0 && t.url === '' && t.localPort === real.localPort && t.type === real.type));
  };

  const dedupeList = (list: TunnelInfo[]): TunnelInfo[] => {
    const map = new Map<string, TunnelInfo>();
    // Prefer URL when present to collapse duplicates pointing to same public URL
    for (const t of list) {
      const key = t.url ? `url:${t.url}` : `id:${t.id}`;
      map.set(key, t);
    }
    return Array.from(map.values());
  };

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
    // Insert optimistic placeholder card (avoid duplicates for same port/type)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const placeholder: TunnelInfo = {
      id: tempId,
      name: request.name,
      url: '',
      localPort: request.localPort,
      pid: 0,
      status: 'starting',
      type: request.type,
      token: (request as any).token,
      createdAt: new Date(),
    } as TunnelInfo;
    setTunnels(prev => {
      const exists = prev.some(t => t.pid === 0 && t.url === '' && t.localPort === placeholder.localPort && t.type === placeholder.type);
      return exists ? prev : [...prev, placeholder];
    });

    try {
      if (!ws || !isConnected) {
        // Queue for when we reconnect
        setActionQueue(q => [...q, { op: 'create', payload: request, tempId }]);
        show({ variant: 'default', title: 'Queued', description: 'Will create tunnel when connection restores' });
        return;
      }
      const res = await ws.sendRpc('tunnels', 'create', request);
      const tunnel = res?.tunnel || res?.data || res;
      if (tunnel && tunnel.url) {
        // Do not append or notify here; rely on server 'tunnelCreated' event to avoid duplicates
      }
    } catch (e: any) {
      // Remove optimistic placeholder on error
      setTunnels(prev => prev.filter(t => t.id !== tempId));
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
      if (!ws || !isConnected) {
        // Queue and optimistically remove
        setActionQueue(q => [...q, { op: 'stop', payload: { id: tunnelId } }]);
        setTunnels(prev => prev.filter(t => t.id !== tunnelId));
        show({ variant: 'default', title: 'Queued', description: 'Stop will be sent when reconnected' });
        return;
      }
      await ws.sendRpc('tunnels', 'stop', { id: tunnelId });
      // rely on broadcast; optimistically update
      setTunnels(prev => prev.filter(t => t.id !== tunnelId));
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to stop tunnel' });
      show({ variant: 'destructive', title: 'Stop failed', description: e?.message });
    }
  };

  const handleRestartTunnel = async (tunnelId: string) => {
    try {
      if (!ws || !isConnected) {
        setActionQueue(q => [...q, { op: 'restart', payload: { id: tunnelId } }]);
        // Optimistically mark as starting
        setTunnels(prev => prev.map(t => t.id === tunnelId ? { ...t, status: 'starting' } as TunnelInfo : t));
        show({ variant: 'default', title: 'Queued', description: 'Restart will be sent when reconnected' });
        return;
      }
      await ws.sendRpc('tunnels', 'restart', { id: tunnelId });
      show({ variant: 'default', title: 'Restart requested' });
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to restart tunnel' });
      show({ variant: 'destructive', title: 'Restart failed', description: e?.message });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!ws || !isConnected) throw new Error('WebSocket not connected');
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
            setTunnels(prev => dedupeList(upsertById(removeTempFor(prev, msg.tunnel), msg.tunnel as TunnelInfo)));
            // Use toast only; avoid page-level notification duplication
            show({ variant: 'success', title: 'Tunnel created', description: msg.tunnel.url });
          }
          break;
        case 'tunnelStopped':
          if (msg.tunnelId) {
            setTunnels(prev => prev.filter(t => t.id !== msg.tunnelId));
            // Use toast only
            show({ variant: 'default', title: 'Tunnel stopped' });
          }
          break;
        case 'tunnelsUpdated':
          if (Array.isArray(msg.tunnels)) setTunnels(dedupeList(msg.tunnels as TunnelInfo[]));
          break;
        case 'tunnelError':
          // Use toast only for errors to keep UI consistent
          show({ variant: 'destructive', title: 'Tunnel error', description: msg.error });
          break;
      }
    });
    return () => { try { unsub?.(); } catch {} };
  }, [ws]);

  // Flush queued actions when connection is restored
  const prevConnectedRef = useRef<boolean>(isConnected);
  useEffect(() => {
    if (!ws) return;
    const wasConnected = prevConnectedRef.current;
    if (!wasConnected && isConnected && actionQueue.length > 0) {
      (async () => {
        for (const a of actionQueue) {
          try {
            await ws.sendRpc('tunnels', a.op, a.payload);
          } catch (e: any) {
            show({ variant: 'destructive', title: 'Queued action failed', description: e?.message });
          }
        }
        setActionQueue([]);
      })();
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected]);

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div ref={containerRef} className="space-y-4 overflow-y-auto pb-24 sm:pb-0">
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

      {/* Offline Banner */}
      {!isConnected && (
        <div className="p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200">
          You are offline. Actions will be queued and sent when reconnected.
        </div>
      )}

      {/* Summary Header */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3 neo:rounded-none neo:border-[3px]">
        <button
          type="button"
          onClick={() => setListCollapsed(c => !c)}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
          aria-expanded={!listCollapsed}
        >
          {listCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>Active Tunnels</span>
          <span className="ml-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span>Total: {tunnels.length}</span>
            <span>Running: {tunnels.filter(t => t.status === 'running').length}</span>
            <span>Starting: {tunnels.filter(t => t.status === 'starting').length}</span>
            <span>Errors: {tunnels.filter(t => t.status === 'error').length}</span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh"
            disabled={refreshing}
            className="p-2 rounded hover:bg-muted disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
        </div>
      </div>

      {/* Create Tunnel Form */}
      <TunnelForm
        onCreateTunnel={handleCreateTunnel}
        loading={creatingTunnel}
        disabled={refreshing}
      />

      {/* Active Tunnels List (collapsible) */}
      {!listCollapsed && (
        <div className="space-y-4">
          <TunnelList
            tunnels={tunnels}
            onStopTunnel={handleStopTunnel}
            onRestartTunnel={handleRestartTunnel}
            loading={refreshing}
          />
          <ConfirmUI />
        </div>
      )}
    </div>
  );
};
