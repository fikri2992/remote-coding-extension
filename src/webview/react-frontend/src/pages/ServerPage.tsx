import React from 'react';
import { useWebSocket } from '../components/WebSocketProvider';
import { cn } from '../lib/utils';

const ServerPage: React.FC = () => {
  const { isConnected, connectionCount, lastActivity } = useWebSocket();

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Server Status Card */}
      <div className="bg-card p-4 lg:p-6 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <h3 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6">Server Controls</h3>

        <div className="space-y-4">
          {/* Server Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
            <div className="flex-1">
              <div className="font-medium text-sm lg:text-base mb-1">WebSocket Server</div>
              <div className="text-xs lg:text-sm text-gray-600">
                Status: {isConnected ? 'Running' : 'Stopped'}
              </div>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-xs lg:text-sm font-medium self-start sm:self-center",
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            )}>
              {isConnected ? 'Active' : 'Inactive'}
            </div>
          </div>

          {/* Connection Details */}
          <div className="bg-card border border-border rounded-lg p-4 neo:rounded-none neo:border-[4px] neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[6px_6px_0_0_rgba(255,255,255,0.9)]">
            <h4 className="font-medium text-sm lg:text-base mb-3">Connection Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-xs lg:text-sm text-blue-700 font-medium">Active Connections</span>
                <span className="text-lg lg:text-xl font-bold text-blue-600">{connectionCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-xs lg:text-sm text-green-700 font-medium">Server Status</span>
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  <span className="text-xs lg:text-sm font-medium text-green-600">
                    {isConnected ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {lastActivity && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-xs lg:text-sm text-gray-600">
                  <span className="font-medium">Last Activity:</span> {lastActivity}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center p-3 lg:p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[48px] neo:rounded-none neo:border-[3px] neo:border-black neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)]">
              <span className="text-sm lg:text-base font-medium">Refresh Status</span>
            </button>
            <button className="flex items-center justify-center p-3 lg:p-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors min-h-[48px] neo:rounded-none neo:border-[3px] neo:border-black neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)]">
              <span className="text-sm lg:text-base font-medium">View Logs</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerPage;
