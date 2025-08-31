import React from 'react';
import { useWebSocket } from '../components/WebSocketProvider';

const HomePage: React.FC = () => {
  const { isConnected, connectionCount } = useWebSocket();

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Welcome Section */}
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4">Welcome to Kiro Remote</h3>
        <p className="text-sm lg:text-base text-gray-600 mb-4 lg:mb-6">
          Manage your remote connections and server operations from this centralized dashboard.
        </p>

        {/* Stats Grid - Mobile: Stack vertically, Desktop: Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          <div className="bg-blue-50 p-3 lg:p-4 rounded-lg text-center">
            <div className="text-2xl lg:text-3xl font-bold text-blue-600 mb-1 lg:mb-2">
              {connectionCount}
            </div>
            <div className="text-xs lg:text-sm text-blue-600">Active Connections</div>
          </div>
          <div className="bg-green-50 p-3 lg:p-4 rounded-lg text-center">
            <div className="text-2xl lg:text-3xl font-bold text-green-600 mb-1 lg:mb-2">
              {isConnected ? 'Online' : 'Offline'}
            </div>
            <div className="text-xs lg:text-sm text-green-600">Server Status</div>
          </div>
          <div className="bg-purple-50 p-3 lg:p-4 rounded-lg text-center sm:col-span-2 lg:col-span-1">
            <div className="text-2xl lg:text-3xl font-bold text-purple-600 mb-1 lg:mb-2">0</div>
            <div className="text-xs lg:text-sm text-purple-600">Active Sessions</div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button className="flex flex-col items-center p-3 lg:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-blue-600 text-lg lg:text-xl">📁</span>
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Files</span>
          </button>

          <button className="flex flex-col items-center p-3 lg:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-green-600 text-lg lg:text-xl">💻</span>
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Terminal</span>
          </button>

          <button className="flex flex-col items-center p-3 lg:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-yellow-600 text-lg lg:text-xl">🔧</span>
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Git</span>
          </button>

          <button className="flex flex-col items-center p-3 lg:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-purple-600 text-lg lg:text-xl">⚙️</span>
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
