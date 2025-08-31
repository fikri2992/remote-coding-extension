import React from 'react';
import { useWebSocket } from '../components/WebSocketProvider';

const HomePage: React.FC = () => {
  const { isConnected, connectionCount } = useWebSocket();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Welcome to Kiro Remote</h3>
        <p className="text-gray-600 mb-4">
          Manage your remote connections and server operations from this centralized dashboard.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{connectionCount}</div>
            <div className="text-sm text-blue-600">Active Connections</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {isConnected ? 'Online' : 'Offline'}
            </div>
            <div className="text-sm text-green-600">Server Status</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">0</div>
            <div className="text-sm text-purple-600">Active Sessions</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
