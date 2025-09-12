import React, { useState, useEffect } from 'react';
import { TunnelForm } from '../components/TunnelForm';
import { TunnelList } from '../components/TunnelList';
import { TunnelActions } from '../components/TunnelActions';
import { TunnelInfo, CreateTunnelRequest } from '../types/tunnel';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '../components/ui/toast';
import useConfirm from '../lib/hooks/useConfirm';

// VS Code API with fallback for development
declare const acquireVsCodeApi: () => any;
const isVSCode = typeof acquireVsCodeApi !== 'undefined';
const vscode = isVSCode ? acquireVsCodeApi() : null;

async function apiRequest(path: string, options?: RequestInit): Promise<any> {
  const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

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

  // Handle messages from extension
  useEffect(() => {
    if (!isVSCode) return;
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      const type = message.type || message.command;
      switch (type) {
        case 'tunnelCreated':
          if (message.tunnel) {
            setTunnels(prev => [...prev, message.tunnel]);
            setNotification({ type: 'success', message: `Tunnel created successfully! Access at ${message.tunnel.url}` });
            show({ variant: 'success', title: 'Tunnel created', description: message.tunnel.url });
          }
          break;
        case 'tunnelStopped':
          if (message.tunnelId) {
            setTunnels(prev => prev.filter(t => t.id !== message.tunnelId));
            setNotification({ type: 'success', message: 'Tunnel stopped successfully.' });
            show({ variant: 'default', title: 'Tunnel stopped' });
          }
          break;
        case 'tunnelError':
          setNotification({ type: 'error', message: message.error || 'An error occurred with the tunnel.' });
          show({ variant: 'destructive', title: 'Tunnel error', description: message.error });
          break;
        case 'tunnelsUpdated':
          if (Array.isArray(message.tunnels)) setTunnels(message.tunnels);
          break;
        case 'tunnelStatus':
        case 'tunnelStatusUpdate':
          if (message.tunnel) {
            setTunnels(prev => {
              const exists = prev.find(t => t.id === message.tunnel.id);
              if (exists) return prev.map(t => (t.id === message.tunnel.id ? message.tunnel : t));
              return [...prev, message.tunnel];
            });
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load initial tunnel data
  useEffect(() => {
    (async () => {
      if (isVSCode) {
        vscode!.postMessage({ type: 'getTunnels' });
        vscode!.postMessage({ type: 'getTunnelStatus' });
      } else {
        try {
          const list = await apiRequest('/api/tunnels');
          if (Array.isArray(list.tunnels)) setTunnels(list.tunnels);
        } catch (e) { /* ignore */ }
      }
    })();
  }, []);

  const handleCreateTunnel = async (request: CreateTunnelRequest) => {
    setCreatingTunnel(true);
    try {
      if (isVSCode) {
        vscode!.postMessage({ type: 'createTunnel', request });
      } else {
        const res = await apiRequest('/api/tunnels/create', { method: 'POST', body: JSON.stringify(request) });
        if (res?.tunnel) {
          setTunnels(prev => [...prev, res.tunnel as TunnelInfo]);
          setNotification({ type: 'success', message: `Tunnel created successfully! Access at ${res.tunnel.url}` });
          show({ variant: 'success', title: 'Tunnel created', description: res.tunnel.url });
        }
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
      if (isVSCode) {
        vscode!.postMessage({ type: 'stopTunnel', tunnelId });
      } else {
        await apiRequest('/api/tunnels/stop', { method: 'POST', body: JSON.stringify({ id: tunnelId }) });
        setTunnels(prev => prev.filter(t => t.id !== tunnelId));
      }
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
      if (isVSCode) {
        vscode!.postMessage({ type: 'stopAllTunnels' });
      } else {
        await apiRequest('/api/tunnels/stopAll', { method: 'POST' });
        setTunnels([]);
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to stop tunnels' });
      show({ variant: 'destructive', title: 'Stop all failed', description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (isVSCode) {
        vscode!.postMessage({ type: 'refreshTunnels' });
      } else {
        const list = await apiRequest('/api/tunnels');
        if (Array.isArray(list.tunnels)) setTunnels(list.tunnels);
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to refresh tunnels' });
      show({ variant: 'destructive', title: 'Refresh failed', description: e?.message });
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="space-y-6">
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
