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
    <div className="flex flex-col h-full">
      {/* Mobile: Close button at top */}
      <div className="lg:hidden p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 lg:px-4 lg:py-6">
        <ul className="space-y-1 lg:space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onItemClick(item.id)}
                  className={cn(
                    "w-full flex items-center px-3 py-3 lg:px-3 lg:py-2 text-sm font-medium rounded-lg transition-all duration-150 ease-out",
                    "min-h-[44px] lg:min-h-[40px] active:scale-[0.98]", // Faster transition and touch feedback
                    activeItem === item.id
                      ? "bg-blue-100 text-blue-700 shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200"
                  )}
                >
                  <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 text-center">
          Kiro Remote v1.0
        </div>
      </div>
    </div>
  );
};
