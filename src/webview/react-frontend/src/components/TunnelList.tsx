import React from 'react';
import { TunnelInfo } from '../types/tunnel';
import { StopCircle, ExternalLink, Clock, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

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
        return <Activity className="w-4 h-4" />;
      case 'starting':
      case 'stopping':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white p-6 rounded-lg shadow-sm border border-gray-200">
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
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
        <div className="text-gray-400 mb-4">
          <Activity className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Tunnels</h3>
        <p className="text-gray-600">
          Create your first tunnel to get started with remote access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tunnels.map((tunnel) => (
        <div
          key={tunnel.id}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {tunnel.name || `Tunnel ${tunnel.id.slice(-4)}`}
                </h3>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  getStatusColor(tunnel.status)
                )}>
                  {getStatusIcon(tunnel.status)}
                  {tunnel.status}
                </span>
              </div>

              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">URL:</span>
                  <a
                    href={tunnel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {tunnel.url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-4">
                  <span>
                    <span className="font-medium">Local Port:</span> {tunnel.localPort}
                  </span>
                  <span>
                    <span className="font-medium">Type:</span> {tunnel.type}
                  </span>
                  <span>
                    <span className="font-medium">PID:</span> {tunnel.pid}
                  </span>
                </div>

                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(tunnel.createdAt).toLocaleString()}
                </div>

                {tunnel.error && (
                  <div className="text-red-600 mt-2 p-2 bg-red-50 rounded">
                    <span className="font-medium">Error:</span> {tunnel.error}
                  </div>
                )}
              </div>
            </div>

            <div className="ml-4">
              <button
                onClick={() => onStopTunnel(tunnel.id)}
                disabled={tunnel.status === 'stopping' || tunnel.status === 'stopped'}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  tunnel.status === 'running'
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <StopCircle className="w-4 h-4" />
                Stop
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
