import React, { createContext, useContext, useRef, useCallback } from 'react';
import { FileCache } from '../lib/cache/FileCache';
import { CacheStats, CacheConfig, FileContent, DirectoryContent } from '../lib/cache/types';

interface FileCacheContextType {
  // File operations
  getFile: (path: string) => Promise<FileContent | null>;
  setFile: (path: string, content: FileContent) => Promise<void>;
  peekFile: (path: string, opts?: { allowStale?: boolean }) => FileContent | null;
  
  // Directory operations
  getDirectory: (path: string) => Promise<DirectoryContent | null>;
  setDirectory: (path: string, content: DirectoryContent) => Promise<void>;
  peekDirectory: (path: string, opts?: { allowStale?: boolean }) => DirectoryContent | null;
  
  // Cache management
  clearCache: () => Promise<void>;
  getCacheStats: () => CacheStats;
  invalidatePath: (path: string) => Promise<void>;
  invalidateHierarchy: (path: string) => Promise<void>;
  updateConfig: (config: Partial<CacheConfig>) => void;
}

const FileCacheContext = createContext<FileCacheContextType | undefined>(undefined);

export const useFileCache = () => {
  const context = useContext(FileCacheContext);
  if (context === undefined) {
    throw new Error('useFileCache must be used within a FileCacheProvider');
  }
  return context;
};

interface FileCacheProviderProps {
  children: React.ReactNode;
  config?: Partial<CacheConfig>;
}

export const FileCacheProvider: React.FC<FileCacheProviderProps> = ({
  children,
  config = {}
}) => {
  const cacheRef = useRef<FileCache | null>(null);

  // Initialize cache lazily
  const getCache = useCallback(() => {
    if (!cacheRef.current) {
      cacheRef.current = new FileCache(config);
    }
    return cacheRef.current;
  }, [config]);

  const getFile = useCallback(async (path: string): Promise<FileContent | null> => {
    const cache = getCache();
    const entry = await cache.get(path, 'file');
    return entry ? entry.data as FileContent : null;
  }, [getCache]);

  const peekFile = useCallback((path: string, opts?: { allowStale?: boolean }): FileContent | null => {
    const cache = getCache();
    const entry = cache.peek(path, 'file', opts?.allowStale ?? false);
    return entry ? (entry.data as FileContent) : null;
  }, [getCache]);

  const setFile = useCallback(async (path: string, content: FileContent): Promise<void> => {
    const cache = getCache();
    await cache.set(path, 'file', content);
  }, [getCache]);

  const getDirectory = useCallback(async (path: string): Promise<DirectoryContent | null> => {
    const cache = getCache();
    const entry = await cache.get(path, 'directory');
    return entry ? entry.data as DirectoryContent : null;
  }, [getCache]);

  const setDirectory = useCallback(async (path: string, content: DirectoryContent): Promise<void> => {
    const cache = getCache();
    await cache.set(path, 'directory', content);
  }, [getCache]);

  const peekDirectory = useCallback((path: string, opts?: { allowStale?: boolean }): DirectoryContent | null => {
    const cache = getCache();
    const entry = cache.peek(path, 'directory', opts?.allowStale ?? false);
    return entry ? (entry.data as DirectoryContent) : null;
  }, [getCache]);

  const clearCache = useCallback(async (): Promise<void> => {
    const cache = getCache();
    await cache.clear();
  }, [getCache]);

  const getCacheStats = useCallback((): CacheStats => {
    const cache = getCache();
    return cache.getCacheStats();
  }, [getCache]);

  const invalidatePath = useCallback(async (path: string): Promise<void> => {
    const cache = getCache();
    await cache.invalidate(path);
  }, [getCache]);

  const invalidateHierarchy = useCallback(async (path: string): Promise<void> => {
    const cache = getCache();
    await cache.invalidateHierarchy(path);
  }, [getCache]);

  const updateConfig = useCallback((newConfig: Partial<CacheConfig>): void => {
    const cache = getCache();
    cache.updateConfig(newConfig);
  }, [getCache]);

  const value: FileCacheContextType = {
    getFile,
    setFile,
    peekFile,
    getDirectory,
    setDirectory,
    peekDirectory,
    clearCache,
    getCacheStats,
    invalidatePath,
    invalidateHierarchy,
    updateConfig,
  };

  return (
    <FileCacheContext.Provider value={value}>
      {children}
    </FileCacheContext.Provider>
  );
};
