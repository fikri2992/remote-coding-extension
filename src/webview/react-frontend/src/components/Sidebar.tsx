import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Menu } from './Menu';
import { cn } from '../lib/utils';

interface SidebarProps {
  className?: string;
  activeItem: string;
  onItemClick: (itemId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, activeItem, onItemClick }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={cn(
      'flex flex-col h-full bg-background border-r border-border transition-all duration-300',
      isCollapsed ? 'w-16' : 'w-64',
      className
    )}>
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!isCollapsed && (
          <h1 className="text-lg font-semibold">Web Automation</h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="ml-auto"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex-1 p-4">
        <Menu
          onItemClick={onItemClick}
          activeItem={activeItem}
          isCollapsed={isCollapsed}
          className={isCollapsed ? 'items-center' : ''}
        />
      </div>
    </div>
  );
};
