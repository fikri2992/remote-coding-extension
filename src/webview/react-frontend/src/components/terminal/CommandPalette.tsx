import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

import { X, Search } from 'lucide-react';

interface SmartCommand {
  command: string;
  description: string;
  icon: string;
  category: 'git' | 'npm' | 'file' | 'system' | 'docker' | 'custom';
  confidence: number;
  contextRelevant: boolean;
  template?: string;
}

interface CommandPaletteProps {
  onCommand: (command: string) => void;
  onClose: () => void;
  currentInput: string;
  commandHistory: string[];
  className?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onCommand,
  onClose,
  currentInput,
  commandHistory,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState(currentInput);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projectType] = useState<string>('unknown');


  // Smart command suggestions based on context
  const smartCommands: SmartCommand[] = useMemo(() => [
    // Git commands
    { command: 'git status', description: 'Check repository status', icon: '📊', category: 'git', confidence: 0.9, contextRelevant: true },
    { command: 'git add .', description: 'Stage all changes', icon: '📝', category: 'git', confidence: 0.8, contextRelevant: true },
    { command: 'git commit -m "', description: 'Commit with message', icon: '💾', category: 'git', confidence: 0.8, contextRelevant: true, template: 'git commit -m "Your message here"' },
    { command: 'git push', description: 'Push to remote', icon: '🚀', category: 'git', confidence: 0.7, contextRelevant: true },
    { command: 'git pull', description: 'Pull from remote', icon: '⬇️', category: 'git', confidence: 0.7, contextRelevant: true },
    { command: 'git log --oneline', description: 'View commit history', icon: '📜', category: 'git', confidence: 0.6, contextRelevant: true },
    
    // NPM commands
    { command: 'npm install', description: 'Install dependencies', icon: '📦', category: 'npm', confidence: 0.9, contextRelevant: projectType === 'node' },
    { command: 'npm start', description: 'Start development server', icon: '🚀', category: 'npm', confidence: 0.8, contextRelevant: projectType === 'node' },
    { command: 'npm run build', description: 'Build for production', icon: '🔨', category: 'npm', confidence: 0.7, contextRelevant: projectType === 'node' },
    { command: 'npm test', description: 'Run tests', icon: '🧪', category: 'npm', confidence: 0.7, contextRelevant: projectType === 'node' },
    { command: 'npm run dev', description: 'Start dev server', icon: '⚡', category: 'npm', confidence: 0.8, contextRelevant: projectType === 'node' },
    { command: 'npm audit', description: 'Check for vulnerabilities', icon: '🔍', category: 'npm', confidence: 0.6, contextRelevant: projectType === 'node' },
    
    // File operations
    { command: 'ls -la', description: 'List files with details', icon: '📁', category: 'file', confidence: 0.8, contextRelevant: true },
    { command: 'pwd', description: 'Show current directory', icon: '📍', category: 'file', confidence: 0.7, contextRelevant: true },
    { command: 'mkdir', description: 'Create directory', icon: '📂', category: 'file', confidence: 0.6, contextRelevant: true, template: 'mkdir folder-name' },
    { command: 'touch', description: 'Create file', icon: '📄', category: 'file', confidence: 0.6, contextRelevant: true, template: 'touch filename.txt' },
    { command: 'cat', description: 'View file contents', icon: '👁️', category: 'file', confidence: 0.6, contextRelevant: true, template: 'cat filename.txt' },
    { command: 'rm -rf', description: 'Remove files/folders', icon: '🗑️', category: 'file', confidence: 0.5, contextRelevant: true, template: 'rm -rf filename' },
    
    // System commands
    { command: 'clear', description: 'Clear terminal screen', icon: '🧹', category: 'system', confidence: 0.9, contextRelevant: true },
    { command: 'history', description: 'Show command history', icon: '📚', category: 'system', confidence: 0.7, contextRelevant: true },
    { command: 'ps aux', description: 'List running processes', icon: '⚙️', category: 'system', confidence: 0.6, contextRelevant: true },
    { command: 'top', description: 'Monitor system resources', icon: '📊', category: 'system', confidence: 0.5, contextRelevant: true },
    { command: 'df -h', description: 'Check disk usage', icon: '💾', category: 'system', confidence: 0.5, contextRelevant: true },
    
    // Docker commands
    { command: 'docker ps', description: 'List running containers', icon: '🐳', category: 'docker', confidence: 0.7, contextRelevant: false },
    { command: 'docker build .', description: 'Build Docker image', icon: '🔨', category: 'docker', confidence: 0.6, contextRelevant: false },
    { command: 'docker-compose up', description: 'Start services', icon: '🚀', category: 'docker', confidence: 0.6, contextRelevant: false },
  ], [projectType]);

  // Filter and sort commands based on search term and context
  const filteredCommands = useMemo(() => {
    let filtered = smartCommands;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(cmd => 
        cmd.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by relevance
    return filtered.sort((a, b) => {
      // Prioritize exact matches
      if (a.command.toLowerCase().startsWith(searchTerm.toLowerCase())) return -1;
      if (b.command.toLowerCase().startsWith(searchTerm.toLowerCase())) return 1;
      
      // Then by context relevance
      if (a.contextRelevant && !b.contextRelevant) return -1;
      if (!a.contextRelevant && b.contextRelevant) return 1;
      
      // Finally by confidence
      return b.confidence - a.confidence;
    }).slice(0, 8); // Limit to 8 suggestions
  }, [smartCommands, searchTerm]);

  // Add recent commands to suggestions
  const recentCommands = useMemo(() => {
    return commandHistory
      .filter(cmd => cmd.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 3)
      .map(cmd => ({
        command: cmd,
        description: 'Recent command',
        icon: '🕒',
        category: 'custom' as const,
        confidence: 1.0,
        contextRelevant: true,
        template: undefined
      }));
  }, [commandHistory, searchTerm]);

  const allSuggestions = [...recentCommands, ...filteredCommands];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, allSuggestions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allSuggestions[selectedIndex]) {
            const cmd = allSuggestions[selectedIndex];
            onCommand(cmd.template || cmd.command);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, allSuggestions, onCommand, onClose]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allSuggestions.length]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'git': return 'text-orange-500';
      case 'npm': return 'text-red-500';
      case 'file': return 'text-blue-500';
      case 'system': return 'text-green-500';
      case 'docker': return 'text-cyan-500';
      case 'custom': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Card className={cn(
      'backdrop-blur-sm bg-background/95 shadow-2xl overflow-hidden',
      'neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]',
      className
    )}>
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              'h-8 w-8',
              'neo:rounded-none neo:border-[2px] neo:border-border'
            )}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Search Input */}
      <div className="px-6 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commands..."
            className={cn(
              'pl-10',
              'neo:border-[2px] neo:rounded-none'
            )}
            autoFocus
          />
        </div>
      </div>

      {/* Suggestions */}
      <CardContent className="pt-0">
        <div className="max-h-64 overflow-y-auto">
          {allSuggestions.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="text-2xl mb-2">🤔</div>
              <p className="neo:font-bold">No matching commands found</p>
              <p className="text-xs mt-1 neo:font-medium">Try typing a different command</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allSuggestions.map((cmd, index) => (
                <Button
                  key={`${cmd.command}-${index}`}
                  variant={index === selectedIndex ? "secondary" : "ghost"}
                  onClick={() => onCommand(cmd.template || cmd.command)}
                  className={cn(
                    'w-full justify-start h-auto p-3 text-left',
                    'neo:rounded-none neo:border-[2px] neo:border-transparent',
                    index === selectedIndex && 'neo:border-primary neo:bg-primary/10 neo:text-primary'
                  )}
                >
                  <div className="flex items-center gap-3 w-full">
                    <span className="text-lg">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className={cn(
                          'font-mono text-sm font-medium truncate',
                          'neo:font-bold'
                        )}>
                          {cmd.command}
                        </code>
                        <span className={cn(
                          'text-xs uppercase font-bold px-1 rounded',
                          'neo:rounded-none neo:px-1.5 neo:py-0.5 neo:border neo:border-current',
                          getCategoryColor(cmd.category)
                        )}>
                          {cmd.category}
                        </span>
                      </div>
                      <p className={cn(
                        'text-xs text-muted-foreground mt-1 truncate',
                        'neo:font-medium'
                      )}>
                        {cmd.description}
                      </p>
                    </div>
                    {cmd.contextRelevant && (
                      <div className={cn(
                        'w-2 h-2 bg-green-500 rounded-full',
                        'neo:rounded-none neo:w-2.5 neo:h-2.5 neo:bg-green-400'
                      )} title="Contextually relevant" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          'mt-4 pt-3 border-t border-border bg-muted/30 -mx-6 px-6 py-3',
          'neo:border-t-[2px] neo:bg-muted/50'
        )}>
          <div className={cn(
            'flex items-center justify-between text-xs text-muted-foreground',
            'neo:font-medium neo:text-foreground neo:opacity-70'
          )}>
            <span>↑↓ Navigate • Enter to select • Esc to close</span>
            <span className="font-mono neo:font-bold">{allSuggestions.length} suggestions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
