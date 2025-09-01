import React from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { AppHeader } from './components/AppHeader';
import { AppSidebar } from './components/AppSidebar';
import { AppFooter } from './components/AppFooter';
import { WebSocketProvider, useWebSocket } from './components/WebSocketProvider';

const MainContent: React.FC = () => {
  const { isConnected, connectionCount, lastActivity } = useWebSocket();
  const location = useLocation();

  // Get active item from current path
  const getActiveItemFromPath = (pathname: string): string => {
    if (pathname === '/') return 'home';
    return pathname.substring(1); // Remove leading slash
  };

  const activeItem = getActiveItemFromPath(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader
        isConnected={isConnected}
        connectionCount={connectionCount}
      />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar activeItem={activeItem} />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 capitalize">{activeItem}</h2>
            <Outlet />
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
