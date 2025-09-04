import React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Home,
  Server,
  Folder,
  GitBranch,
  Terminal,
  MessageCircle,
  Settings,
  Network
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AppSidebarProps {
  activeItem?: string;
}

const menuItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'server', label: 'Server', icon: Server, path: '/server' },
  { id: 'tunnels', label: 'Tunnels', icon: Network, path: '/tunnels' },
  { id: 'files', label: 'Files', icon: Folder, path: '/files' },
  { id: 'git', label: 'Git', icon: GitBranch, path: '/git' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, path: '/terminal' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, path: '/chat' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeItem
}) => {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile: Close button at top */}
      <div className="lg:hidden p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Menu</h2>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 lg:px-4 lg:py-6">
        <ul className="space-y-1 lg:space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={cn(
                    "w-full flex items-center px-3 py-3 lg:px-3 lg:py-2 text-sm font-medium rounded-lg transition-all duration-150 ease-out",
                    "min-h-[44px] lg:min-h-[40px] active:scale-[0.98]",
                    activeItem === item.id
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-card">
        <div className="text-xs text-muted-foreground text-center">
          Kiro Remote v1.0
        </div>
      </div>
    </div>
  );
};
