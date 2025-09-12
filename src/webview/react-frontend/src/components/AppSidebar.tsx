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
  { id: 'chat-terminal', label: 'Chat Terminal 🚀', icon: MessageCircle, path: '/chat-terminal' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, path: '/chat' },
  { id: 'acp', label: 'ACP', icon: Network, path: '/acp' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeItem
}) => {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Mobile: Close button at top */}
      <div className="lg:hidden p-4 border-b border-border neo:border-b-[2px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground neo:font-extrabold">Menu</h2>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-3">
          {menuItems.filter((i) => ['home','acp','files','terminal','git','server','settings'].includes(i.id)).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={cn(
                    "w-full flex items-center px-4 py-4 text-sm font-medium rounded-lg transition-all duration-150 ease-out",
                    "min-h-[52px] active:scale-[0.98] neo:rounded-none neo:border-[3px] neo:border-border neo:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[4px_4px_0_0_rgba(255,255,255,0.9)] neo:duration-100 neo:ease-linear",
                    activeItem === item.id
                      ? "bg-primary/15 text-primary shadow-sm neo:bg-primary neo:text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground neo:hover:bg-accent neo:hover:text-accent-foreground"
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
      <div className="p-4 mt-4 border-t border-border bg-card neo:border-t-[3px]">
        <div className="text-xs text-muted-foreground text-center">
          Kiro Remote v1.0
        </div>
      </div>
    </div>
  );
};
