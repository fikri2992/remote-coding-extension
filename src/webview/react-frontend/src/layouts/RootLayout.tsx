import React, { useState } from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { AppSidebar } from '../components/AppSidebar';
import { AppFooter } from '../components/AppFooter';
import { useWebSocket } from '../components/WebSocketProvider';
import { useTheme } from '../components/theme/ThemeProvider';
import { cn } from '../lib/utils';

const LayoutContent: React.FC = () => {
  const { isConnected, connectionCount, lastActivity } = useWebSocket();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get active item from current path
  const getActiveItemFromPath = (pathname: string): string => {
    if (pathname === '/') return 'home';
    const first = pathname.split('/')[1] || 'home';
    return first; // highlight by first segment (e.g., /files/view -> files)
  };

  const activeItem = getActiveItemFromPath(location.pathname);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header with Hamburger Menu */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <h1 className="text-lg font-semibold text-foreground">
              Kiro Remote
            </h1>
          </div>

          {/* Mobile actions: connection status + theme toggle */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="hidden sm:inline">
                {isConnected ? `(${connectionCount})` : 'Offline'}
              </span>
            </div>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Header - Hidden on mobile */}
      <div className="hidden lg:block">
        <AppHeader
          isConnected={isConnected}
          connectionCount={connectionCount}
        />
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-1 min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-80px)]">
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Mobile: Overlay, Desktop: Fixed */}
        <div className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 lg:z-auto",
          "w-64 lg:w-64 bg-card border-r border-border",
          "transform transition-transform duration-200 ease-out lg:transition-none",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full">
            <AppSidebar
              activeItem={activeItem}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Footer - Hidden on mobile, shown on desktop */}
      <div className="hidden lg:block">
        <AppFooter
          isConnected={isConnected}
          connectionCount={connectionCount}
          lastActivity={lastActivity || undefined}
        />
      </div>

      {/* Mobile Footer - Simplified */}
      <div className="lg:hidden bg-card border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-3">
            <span className={cn(
              "flex items-center space-x-1",
              isConnected ? "text-green-600" : "text-red-600"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )} />
              <span>
                {isConnected ? `Online (${connectionCount})` : 'Offline'}
              </span>
            </span>
          </div>
          <span className="text-muted-foreground">
            v1.0
          </span>
        </div>
      </div>
    </div>
  );
};

const RootLayout: React.FC = () => {
  return <LayoutContent />
};

export default RootLayout;
