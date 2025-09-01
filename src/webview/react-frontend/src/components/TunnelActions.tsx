import React from 'react';
import { TunnelInfo } from '../types/tunnel';
import { RefreshCw, Square, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface TunnelActionsProps {
  tunnels: TunnelInfo[];
  onRefresh: () => void;
  onStopAll: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const TunnelActions: React.FC<TunnelActionsProps> = ({
  tunnels,
  onRefresh,
  onStopAll,
  loading = false,
  disabled = false
}) => {
  const runningTunnels = tunnels.filter(t => t.status === 'running');
  const hasErrors = tunnels.some(t => t.status === 'error');

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Active Tunnels:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              {runningTunnels.length}
            </span>
          </div>

          {hasErrors && (
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Some tunnels have errors</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={disabled || loading}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              disabled || loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>

          {runningTunnels.length > 0 && (
            <button
              onClick={onStopAll}
              disabled={disabled || loading}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                disabled || loading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              )}
            >
              <Square className="w-4 h-4" />
              Stop All
            </button>
          )}
        </div>
      </div>

      {runningTunnels.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            Quick actions for individual tunnels are available in the tunnel list below.
          </div>
        </div>
      )}
    </div>
  );
};
