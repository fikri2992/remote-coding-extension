import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ChevronDown, Plus } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  path: string;
  type: 'frontend' | 'api' | 'mobile' | 'database' | 'other';
  runningProcesses: string[];
  lastActive: Date;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  activeWorkspace?: string;
  onSwitch: (workspaceId: string) => void;
  onCreateNew: () => void;
  className?: string;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspace,
  onSwitch,
  onCreateNew,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getWorkspaceIcon = (type: string) => {
    switch (type) {
      case 'frontend': return '🏠';
      case 'api': return '🔧';
      case 'mobile': return '📱';
      case 'database': return '🗄️';
      default: return '📁';
    }
  };

  const getWorkspaceColor = (type: string) => {
    switch (type) {
      case 'frontend': return 'bg-blue-500/10 border-blue-500/20';
      case 'api': return 'bg-green-500/10 border-green-500/20';
      case 'mobile': return 'bg-purple-500/10 border-purple-500/20';
      case 'database': return 'bg-orange-500/10 border-orange-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const activeWs = workspaces.find(ws => ws.id === activeWorkspace);

  return (
    <div className={cn('relative', className)}>
      {/* Current Workspace Display */}
      <Button
        variant="secondary"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full justify-between h-auto p-3',
          'neo:rounded-none neo:border-[3px]',
          activeWs && getWorkspaceColor(activeWs.type)
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{activeWs ? getWorkspaceIcon(activeWs.type) : '📁'}</span>
          <div className="text-left">
            <p className={cn(
              'font-medium text-sm',
              'neo:font-bold'
            )}>
              {activeWs ? activeWs.name : 'No Workspace'}
            </p>
            <p className={cn(
              'text-xs text-muted-foreground',
              'neo:font-medium neo:text-current neo:opacity-70'
            )}>
              {activeWs ? `${activeWs.runningProcesses.length} processes` : 'Select workspace'}
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform',
          isExpanded && 'rotate-180'
        )} />
      </Button>

      {/* Workspace List */}
      {isExpanded && (
        <Card className={cn(
          'absolute top-full left-0 right-0 mt-2 shadow-xl z-50',
          'neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]'
        )}>
          <CardContent className="p-3">
            <div className={cn(
              'text-xs font-medium text-muted-foreground px-3 py-2',
              'neo:font-bold neo:text-foreground neo:opacity-70'
            )}>
              Available Workspaces
            </div>
            
            {workspaces.length === 0 ? (
              <div className={cn(
                'px-3 py-4 text-center text-muted-foreground text-sm',
                'neo:font-medium'
              )}>
                No workspaces available
              </div>
            ) : (
              <div className="space-y-1">
                {workspaces.map((workspace) => (
                  <Button
                    key={workspace.id}
                    variant={workspace.id === activeWorkspace ? "secondary" : "ghost"}
                    onClick={() => {
                      onSwitch(workspace.id);
                      setIsExpanded(false);
                    }}
                    className={cn(
                      'w-full justify-start h-auto p-3 text-left',
                      'neo:rounded-none neo:border-[2px] neo:border-transparent',
                      workspace.id === activeWorkspace && 'neo:border-primary neo:bg-primary/10'
                    )}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <span className="text-lg">{getWorkspaceIcon(workspace.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'font-medium text-sm truncate',
                            'neo:font-bold'
                          )}>{workspace.name}</p>
                          {workspace.runningProcesses.length > 0 && (
                            <div className="flex items-center gap-1">
                              <div className={cn(
                                'w-2 h-2 bg-green-500 rounded-full animate-pulse',
                                'neo:rounded-none neo:w-2.5 neo:h-2.5 neo:bg-green-400'
                              )} />
                              <span className={cn(
                                'text-xs text-green-600',
                                'neo:text-green-500 neo:font-bold'
                              )}>
                                {workspace.runningProcesses.length}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className={cn(
                          'text-xs text-muted-foreground truncate',
                          'neo:font-medium'
                        )}>
                          {workspace.path}
                        </p>
                        <p className={cn(
                          'text-xs text-muted-foreground',
                          'neo:font-medium'
                        )}>
                          Last active: {workspace.lastActive.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
            
            {/* Create New Workspace */}
            <div className={cn(
              'border-t border-border mt-2 pt-2',
              'neo:border-t-[2px]'
            )}>
              <Button
                variant="ghost"
                onClick={() => {
                  onCreateNew();
                  setIsExpanded(false);
                }}
                className={cn(
                  'w-full justify-start h-auto p-3 text-left',
                  'neo:rounded-none neo:border-[2px] neo:border-transparent hover:neo:border-border'
                )}
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5" />
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
                      'neo:font-bold'
                    )}>Create New Workspace</p>
                    <p className={cn(
                      'text-xs text-muted-foreground',
                      'neo:font-medium'
                    )}>Start fresh terminal session</p>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};