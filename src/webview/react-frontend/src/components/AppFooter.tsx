import React from 'react';
import { Activity, Users } from 'lucide-react';

interface AppFooterProps {
  isConnected: boolean;
  connectionCount: number;
  lastActivity?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  isConnected,
  connectionCount,
  lastActivity
}) => {
  return (
    <footer className="bg-card border-t border-border px-6 py-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Activity className="w-4 h-4" />
            <span>
              {isConnected ? 'Server Online' : 'Server Offline'}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{connectionCount} connection{connectionCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {lastActivity && (
            <span>Last activity: {lastActivity}</span>
          )}
          <span>Ready</span>
        </div>
      </div>
    </footer>
  );
};
