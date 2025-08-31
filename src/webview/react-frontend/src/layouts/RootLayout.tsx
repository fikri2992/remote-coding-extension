import React from 'react';
import { Outlet } from '@tanstack/react-router';
import { AppHeader } from '../components/AppHeader';
import { AppSidebar } from '../components/AppSidebar';
import { AppFooter } from '../components/AppFooter';
import { WebSocketProvider, useWebSocket } from '../components/WebSocketProvider';

const LayoutContent: React.FC = () => {
  const { isConnected, connectionCount, lastActivity } = useWebSocket();
  const [activeItem, setActiveItem] = React.useState('home');

  // Update active item based on current route
  React.useEffect(() => {
    const path = window.location.pathname;
    const routeMap: { [key: string]: string } = {
      '/': 'home',
      '/server': 'server',
      '/files': 'files',
      '/git': 'git',
      '/terminal': 'terminal',
      '/chat': 'chat',
      '/settings': 'settings',
    };
    setActiveItem(routeMap[path] || 'home');
  }, []);

  const handleItemClick = (item: string) => {
    setActiveItem(item);
    // Navigate to the corresponding route
    const routeMap: { [key: string]: string } = {
      'home': '/',
      'server': '/server',
      'files': '/files',
      'git': '/git',
      'terminal': '/terminal',
      'chat': '/chat',
      'settings': '/settings',
    };
    window.location.href = routeMap[item] || '/';
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
          onItemClick={handleItemClick}
        />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
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

const RootLayout: React.FC = () => {
  return (
    <WebSocketProvider>
      <LayoutContent />
    </WebSocketProvider>
  );
};

export default RootLayout;
