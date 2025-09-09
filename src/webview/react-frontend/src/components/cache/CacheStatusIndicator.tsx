import React from 'react';
import { useFileCache } from '../../contexts/FileCacheContext';
import { cn } from '../../lib/utils';

interface CacheStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const CacheStatusIndicator: React.FC<CacheStatusIndicatorProps> = ({
  className,
  showDetails = false
}) => {
  const { getCacheStats } = useFileCache();
  const stats = getCacheStats();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = () => {
    if (stats.hitRate > 0.8) return 'text-green-500';
    if (stats.hitRate > 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!showDetails) {
    return (
      <div className={cn('flex items-center gap-1 text-xs', className)}>
        <span className="text-muted-foreground">📦</span>
        <span className={cn('font-medium', getStatusColor())}>
          {stats.cachedFiles} cached
        </span>
        {stats.hitRate > 0 && (
          <span className="text-muted-foreground">
            ({Math.round(stats.hitRate * 100)}% hit)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('cache-status-detailed', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📦</span>
        <span className="font-medium">Cache Status</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Files:</span>
          <span className="ml-1 font-medium">{stats.cachedFiles}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Size:</span>
          <span className="ml-1 font-medium">{formatBytes(stats.totalSize)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Hit Rate:</span>
          <span className={cn('ml-1 font-medium', getStatusColor())}>
            {Math.round(stats.hitRate * 100)}%
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Memory:</span>
          <span className="ml-1 font-medium">{stats.memoryEntries}</span>
        </div>
      </div>
    </div>
  );
};