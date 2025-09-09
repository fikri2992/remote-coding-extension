import React, { useState } from 'react';
import { useFileCache } from '../../contexts/FileCacheContext';
import { CacheStatusIndicator } from './CacheStatusIndicator';
import { cn } from '../../lib/utils';

interface CacheManagementPanelProps {
  className?: string;
}

export const CacheManagementPanel: React.FC<CacheManagementPanelProps> = ({
  className
}) => {
  const { clearCache, getCacheStats, updateConfig } = useFileCache();
  const [isClearing, setIsClearing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleClearCache = async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    try {
      await clearCache();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const stats = getCacheStats();

  return (
    <div className={cn('cache-management-panel p-4 border border-border rounded-lg', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Cache Management</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      <CacheStatusIndicator showDetails className="mb-4" />

      <div className="space-y-3">
        <button
          onClick={handleClearCache}
          disabled={isClearing || stats.cachedFiles === 0}
          className={cn(
            'w-full px-4 py-2 text-sm font-medium rounded-md border transition-colors',
            'neo:rounded-none neo:border-[2px]',
            isClearing || stats.cachedFiles === 0
              ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground'
              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          )}
        >
          {isClearing ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              Clearing Cache...
            </div>
          ) : (
            `Clear Cache (${stats.cachedFiles} files)`
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground">Advanced Options</h4>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => updateConfig({ enablePrefetch: true })}
                className="px-2 py-1 text-left rounded border border-border hover:bg-muted neo:rounded-none neo:border-[2px]"
              >
                Enable Prefetch
              </button>
              <button
                onClick={() => updateConfig({ enablePrefetch: false })}
                className="px-2 py-1 text-left rounded border border-border hover:bg-muted neo:rounded-none neo:border-[2px]"
              >
                Disable Prefetch
              </button>
              <button
                onClick={() => updateConfig({ enableCrossTabSync: true })}
                className="px-2 py-1 text-left rounded border border-border hover:bg-muted neo:rounded-none neo:border-[2px]"
              >
                Enable Cross-Tab Sync
              </button>
              <button
                onClick={() => updateConfig({ enableCrossTabSync: false })}
                className="px-2 py-1 text-left rounded border border-border hover:bg-muted neo:rounded-none neo:border-[2px]"
              >
                Disable Cross-Tab Sync
              </button>
            </div>

            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <p>Cache improves navigation speed by storing recently accessed files.</p>
              <p className="mt-1">Files are automatically invalidated when changed.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};