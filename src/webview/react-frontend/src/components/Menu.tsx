import React from 'react';
import { LucideIcon, Home, Server, File, GitBranch, Terminal, MessageCircle, Network, Gem } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useWebSocket } from './WebSocketProvider';

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const menuItems: MenuItem[] = [
  { id: 'home', label: 'Claude', icon: Home },
  { id: 'gemini', label: 'Gemini', icon: Gem },
  { id: 'server', label: 'Server', icon: Server },
  { id: 'tunnels', label: 'Tunnels', icon: Network },
  { id: 'files', label: 'Files', icon: File },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

interface MenuProps {
  className?: string;
  onItemClick?: (itemId: string) => void;
  activeItem?: string;
  isCollapsed?: boolean;
}

export const Menu: React.FC<MenuProps> = ({ className, onItemClick, activeItem, isCollapsed = false }) => {
  const { registeredServices } = useWebSocket();
  const hasGit = Array.isArray(registeredServices) && registeredServices.includes('git');
  return (
    <nav className={cn('flex flex-col space-y-2', className)}>
      {menuItems.filter((i) => i.id !== 'git' || hasGit).map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={activeItem === item.id ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => onItemClick?.(item.id)}
          >
            {isCollapsed ? <Icon className="h-4 w-4" /> : <><Icon className="mr-2 h-4 w-4" />{item.label}</>}
          </Button>
        );
      })}
    </nav>
  );
};
