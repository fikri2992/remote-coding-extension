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
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Kiro Remote
          </h1>
          <div className="flex items-center space-x-2">
            <div className={cn(
              "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
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

        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </header>
  );
};
