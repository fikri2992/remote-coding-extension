import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface AppHeaderProps {
  isConnected: boolean;
  connectionCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isConnected,
  connectionCount
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* App Title */}
        <div className="flex items-center space-x-3 lg:space-x-4">
          <h1 className="text-lg lg:text-xl font-semibold text-gray-900">
            Kiro Remote
          </h1>

          {/* Connection Status - Desktop */}
          <div className="hidden lg:flex items-center space-x-2">
            <div className={cn(
              "flex items-center space-x-1 px-2 lg:px-3 py-1 rounded-full text-xs font-medium",
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            )}>
              {isConnected ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span>
                {isConnected ? `Connected (${connectionCount})` : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Mobile Connection Status - Simplified */}
        <div className="lg:hidden flex items-center">
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
        </div>
      </div>
    </header>
  );
};
