import React, { useState, useEffect } from 'react';
import { TunnelForm } from '../components/TunnelForm';
import { TunnelList } from '../components/TunnelList';
import { TunnelActions } from '../components/TunnelActions';
import { TunnelInfo, CreateTunnelRequest } from '../types/tunnel';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

// VS Code API with fallback for development
declare const acquireVsCodeApi: () => any;
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : {
  postMessage: (message: any) => {
    console.log('VS Code message (development mode):', message);
  }
};

export const TunnelManagerPage: React.FC = () => {
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingTunnel, setCreatingTunnel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'tunnelCreated':
          setTunnels(prev => [...prev, message.tunnel]);
          setNotification({
            type: 'success',
            message: `Tunnel created successfully! Access at ${message.tunnel.url}`
          });
          break;
        case 'tunnelStopped':
          setTunnels(prev => prev.filter(t => t.id !== message.tunnelId));
          setNotification({
            type: 'success',
            message: 'Tunnel stopped successfully.'
          });
          break;
        case 'tunnelError':
          setNotification({
            type: 'error',
            message: message.error || 'An error occurred with the tunnel.'
          });
          break;
        case 'tunnelsUpdated':
          setTunnels(message.tunnels);
          break;
        case 'tunnelStatus':
          // Update specific tunnel status
          setTunnels(prev => prev.map(t =>
            t.id === message.tunnel.id ? message.tunnel : t
          ));
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load initial tunnel data
  useEffect(() => {
    vscode.postMessage({ type: 'getTunnels' });
    vscode.postMessage({ type: 'getTunnelStatus' });
  }, []);

  const handleCreateTunnel = async (request: CreateTunnelRequest) => {
    setCreatingTunnel(true);
    vscode.postMessage({
      type: 'createTunnel',
      request: request
    });
    // The response will be handled by the message listener
    setCreatingTunnel(false);
  };

  const handleStopTunnel = async (tunnelId: string) => {
    vscode.postMessage({
      type: 'stopTunnel',
      tunnelId: tunnelId
    });
  };

  const handleStopAll = async () => {
    setLoading(true);
    vscode.postMessage({
      type: 'stopAllTunnels'
    });
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    vscode.postMessage({
      type: 'refreshTunnels'
    });
    setRefreshing(false);
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
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Active Tunnels</h3>
        <TunnelList
          tunnels={tunnels}
          onStopTunnel={handleStopTunnel}
          loading={refreshing}
        />
      </div>

      {/* Status Summary */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Status Summary</h4>
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
