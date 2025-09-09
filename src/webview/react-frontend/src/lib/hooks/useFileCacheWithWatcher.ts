import { useEffect, useRef } from 'react';
import { useFileCache } from '../../contexts/FileCacheContext';
import { RobustFileWatcher } from '../cache/RobustFileWatcher';

export const useFileCacheWithWatcher = () => {
  const cache = useFileCache();
  const watcherRef = useRef<RobustFileWatcher | null>(null);

  useEffect(() => {
    // Initialize file watcher
    const watcher = new RobustFileWatcher(async (path: string) => {
      if (path === '*') {
        // Clear all cache
        await cache.clearCache();
      } else {
        // Invalidate specific path and hierarchy
        await cache.invalidateHierarchy(path);
      }
    });

    watcherRef.current = watcher;
    watcher.setupWatcher('/');

    return () => {
      watcher.destroy();
      watcherRef.current = null;
    };
  }, [cache]);

  // Expose watcher methods for manual invalidation
  const invalidateFile = async (path: string) => {
    if (watcherRef.current) {
      await watcherRef.current.invalidateFile(path);
    }
  };

  const invalidateDirectory = async (path: string) => {
    if (watcherRef.current) {
      await watcherRef.current.invalidateDirectory(path);
    }
  };

  const handleGitOperation = async (operation: string, paths?: string[]) => {
    if (watcherRef.current) {
      await watcherRef.current.handleGitOperation(operation, paths);
    }
  };

  const handlePackageOperation = async (operation: string) => {
    if (watcherRef.current) {
      await watcherRef.current.handlePackageOperation(operation);
    }
  };

  return {
    ...cache,
    invalidateFile,
    invalidateDirectory,
    handleGitOperation,
    handlePackageOperation,
  };
};