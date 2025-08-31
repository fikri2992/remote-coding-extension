import React, { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { AppSidebar } from './components/AppSidebar';
import { AppFooter } from './components/AppFooter';
import { WebSocketProvider, useWebSocket } from './components/WebSocketProvider';
import { cn } from './lib/utils';

const MainContent: React.FC = () => {
  const { isConnected, connectionCount, lastActivity } = useWebSocket();
  const [activeItem, setActiveItem] = useState('home');

  const renderContent = () => {
    switch (activeItem) {
      case 'home':
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
      case 'server':
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
      case 'files':
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">File Explorer</h3>
          <p className="text-gray-600">File management interface will be implemented here.</p>
        </div>;
      case 'git':
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Git Operations</h3>
          <p className="text-gray-600">Git management interface will be implemented here.</p>
        </div>;
      case 'terminal':
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Terminal Sessions</h3>
          <p className="text-gray-600">Terminal interface will be implemented here.</p>
        </div>;
      case 'chat':
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Chat & Messaging</h3>
          <p className="text-gray-600">Chat interface will be implemented here.</p>
        </div>;
      case 'settings':
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Settings</h3>
          <p className="text-gray-600">Application settings will be implemented here.</p>
        </div>;
      default:
        return <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-600">Select an option from the sidebar menu.</p>
        </div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        isConnected={isConnected}
        connectionCount={connectionCount}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          activeItem={activeItem}
          onItemClick={setActiveItem}
        />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 capitalize">{activeItem}</h2>
            {renderContent()}
          </div>
        </main>
      </div>

      <AppFooter
        isConnected={isConnected}
        connectionCount={connectionCount}
        lastActivity={lastActivity || undefined}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <MainContent />
    </WebSocketProvider>
  );
};

export default App;
