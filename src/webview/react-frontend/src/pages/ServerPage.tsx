import React from 'react';
import { useWebSocket } from '../components/WebSocketProvider';
import { cn } from '../lib/utils';

const ServerPage: React.FC = () => {
  const { isConnected, connectionCount, lastActivity } = useWebSocket();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Server Controls</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-medium">WebSocket Server</div>
              <div className="text-sm text-gray-600">
                Status: {isConnected ? 'Running' : 'Stopped'}
              </div>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            )}>
              {isConnected ? 'Active' : 'Inactive'}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Connections: {connectionCount} | Last Activity: {lastActivity || 'None'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerPage;
