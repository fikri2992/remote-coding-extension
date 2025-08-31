import React from 'react';
import {
  Home,
  Server,
  Folder,
  GitBranch,
  Terminal,
  MessageCircle,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AppSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const menuItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'server', label: 'Server', icon: Server },
  { id: 'files', label: 'Files', icon: Folder },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeItem,
  onItemClick
}) => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onItemClick(item.id)}
                  className={cn(
                    "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    activeItem === item.id
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Kiro Remote v1.0
        </div>
      </div>
    </aside>
  );
};
