import React from 'react';
import { useWebSocket } from '../components/WebSocketProvider';
import { Link } from '@tanstack/react-router';
import { Folder, Terminal as TerminalIcon, GitBranch, Settings as SettingsIcon } from 'lucide-react';

const HomePage: React.FC = () => {
  const { isConnected, connectionCount } = useWebSocket();

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Welcome Section */}
      <div className="bg-card p-4 lg:p-6 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <h3 className="text-lg lg:text-xl font-semibold mb-3 lg:mb-4">Welcome to Kiro Remote</h3>
        <p className="text-sm lg:text-base text-muted-foreground mb-4 lg:mb-6">
          Manage your remote connections and server operations from this centralized dashboard.
        </p>

        {/* Stats Grid - Mobile: Stack vertically, Desktop: Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          <div className="p-3 lg:p-4 rounded-lg text-center bg-primary/10 neo:rounded-none neo:border-4 neo:border-border neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">
            <div className="text-2xl lg:text-3xl font-bold text-primary mb-1 lg:mb-2">
              {connectionCount}
            </div>
            <div className="text-xs lg:text-sm text-primary">Active Connections</div>
          </div>
          <div className="p-3 lg:p-4 rounded-lg text-center bg-green-500/10 neo:rounded-none neo:border-4 neo:border-border neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">
            <div className="text-2xl lg:text-3xl font-bold text-green-500 mb-1 lg:mb-2">
              {isConnected ? 'Online' : 'Offline'}
            </div>
            <div className="text-xs lg:text-sm text-green-500">Server Status</div>
          </div>
          <div className="p-3 lg:p-4 rounded-lg text-center sm:col-span-2 lg:col-span-1 bg-purple-500/10 neo:rounded-none neo:border-4 neo:border-border neo:shadow-[5px_5px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[5px_5px_0_0_rgba(255,255,255,0.9)]">
            <div className="text-2xl lg:text-3xl font-bold text-purple-500 mb-1 lg:mb-2">0</div>
            <div className="text-xs lg:text-sm text-purple-500">Active Sessions</div>
          </div>
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized */}
      <div className="bg-card p-4 lg:p-6 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 neo:gap-4">
          <Link to="/files" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2 text-blue-600 neo:rounded-none neo:border-2 neo:border-border">
              <Folder className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Files</span>
          </Link>

          <Link to="/terminal" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-full flex items-center justify-center mb-2 text-green-600 neo:rounded-none neo:border-2 neo:border-border">
              <TerminalIcon className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Terminal</span>
          </Link>

          <Link to="/git" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-100 rounded-full flex items-center justify-center mb-2 text-yellow-600 neo:rounded-none neo:border-2 neo:border-border">
              <GitBranch className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Git</span>
          </Link>

          <Link to="/settings" className="flex flex-col items-center p-3 lg:p-4 bg-muted hover:bg-muted/70 rounded-lg transition-colors min-h-[80px] lg:min-h-[100px] neo:rounded-none neo:border-4 neo:border-border neo:shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-full flex items-center justify-center mb-2 text-purple-600 neo:rounded-none neo:border-2 neo:border-border">
              <SettingsIcon className="w-5 h-5 lg:w-6 lg:h-6" strokeWidth={2.5} />
            </div>
            <span className="text-xs lg:text-sm font-medium text-center">Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
