/**
 * Enhanced File Watcher Manager for CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { FileSystemServiceConfig, FileWatcherEvent } from './FileSystemTypes';

export class FileWatcherManager extends EventEmitter {
  private watchersByClient: Map<string, Map<string, fs.FSWatcher>> = new Map();
  private config: FileSystemServiceConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: FileSystemServiceConfig) {
    super();
    this.config = config;
  }

  async addWatcher(clientId: string, watchPath: string): Promise<boolean> {
    if (!this.config.enableFileWatching) {
      return false;
    }

    // Check if client has too many watchers
    const clientWatchers = this.watchersByClient.get(clientId);
    if (clientWatchers && clientWatchers.size >= this.config.maxWatchersPerClient) {
      return false;
    }

    try {
      const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(watchPath, filename.toString());
        this.handleFileEvent(clientId, {
          type: eventType === 'rename' ? 'change' : eventType,
          path: fullPath,
          timestamp: Date.now()
        });
      });

      watcher.on('error', (error) => {
        console.error(`File watcher error for ${watchPath}:`, error);
        this.removeWatcher(clientId, watchPath);
      });

      // Store watcher
      if (!this.watchersByClient.has(clientId)) {
        this.watchersByClient.set(clientId, new Map());
      }
      this.watchersByClient.get(clientId)!.set(watchPath, watcher);

      return true;
    } catch (error) {
      console.error(`Failed to create file watcher for ${watchPath}:`, error);
      return false;
    }
  }

  removeWatcher(clientId: string, watchPath: string): boolean {
    const clientWatchers = this.watchersByClient.get(clientId);
    if (!clientWatchers) return false;

    const watcher = clientWatchers.get(watchPath);
    if (!watcher) return false;

    try {
      watcher.close();
      clientWatchers.delete(watchPath);
      return true;
    } catch (error) {
      console.error(`Failed to close file watcher for ${watchPath}:`, error);
      return false;
    }
  }

  removeAllClientWatchers(clientId: string): void {
    const clientWatchers = this.watchersByClient.get(clientId);
    if (!clientWatchers) return;

    for (const [watchPath, watcher] of clientWatchers) {
      try {
        watcher.close();
      } catch (error) {
        console.error(`Failed to close file watcher for ${watchPath}:`, error);
      }
    }

    this.watchersByClient.delete(clientId);
  }

  private handleFileEvent(clientId: string, event: FileWatcherEvent): void {
    // Debounce events
    const debounceKey = `${clientId}:${event.path}`;
    const existingTimer = this.debounceTimers.get(debounceKey);
    
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(debounceKey);
      
      // Get file info for enhanced event data
      this.enhanceEventWithFileInfo(event).then(enhancedEvent => {
        this.emit('fileEvent', { clientId, event: enhancedEvent });
      });
    }, this.config.watcherDebounceMs);

    this.debounceTimers.set(debounceKey, timer);
  }

  private async enhanceEventWithFileInfo(event: FileWatcherEvent): Promise<FileWatcherEvent> {
    try {
      const stats = await fs.promises.stat(event.path);
      return {
        ...event,
        size: stats.size,
        isDirectory: stats.isDirectory()
      };
    } catch {
      // File might not exist (delete event)
      return event;
    }
  }

  getWatcherStats(): { totalClients: number; totalWatchers: number; clientStats: Array<{ clientId: string; watcherCount: number }> } {
    const totalClients = this.watchersByClient.size;
    let totalWatchers = 0;
    const clientStats: Array<{ clientId: string; watcherCount: number }> = [];

    for (const [clientId, watchers] of this.watchersByClient) {
      const watcherCount = watchers.size;
      totalWatchers += watcherCount;
      clientStats.push({ clientId, watcherCount });
    }

    return {
      totalClients,
      totalWatchers,
      clientStats
    };
  }

  hasWatcher(clientId: string, watchPath: string): boolean {
    const clientWatchers = this.watchersByClient.get(clientId);
    return clientWatchers ? clientWatchers.has(watchPath) : false;
  }

  getClientWatchers(clientId: string): string[] {
    const clientWatchers = this.watchersByClient.get(clientId);
    return clientWatchers ? Array.from(clientWatchers.keys()) : [];
  }

  getAllWatchedPaths(): string[] {
    const allPaths = new Set<string>();
    for (const watchers of this.watchersByClient.values()) {
      for (const watchPath of watchers.keys()) {
        allPaths.add(watchPath);
      }
    }
    return Array.from(allPaths);
  }

  async validateWatchPath(watchPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if path exists
      await fs.promises.access(watchPath);
      
      // Check if it's a file or directory
      const stats = await fs.promises.stat(watchPath);
      
      if (!stats.isFile() && !stats.isDirectory()) {
        return {
          valid: false,
          error: 'Path must be a file or directory'
        };
      }

      // Check if we have permission to read the path
      try {
        await fs.promises.access(watchPath, fs.constants.R_OK);
      } catch {
        return {
          valid: false,
          error: 'No read permission for path'
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  cleanup(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const [clientId, watchers] of this.watchersByClient) {
      for (const [watchPath, watcher] of watchers) {
        try {
          watcher.close();
        } catch (error) {
          console.error(`Failed to close file watcher for ${watchPath}:`, error);
        }
      }
    }
    this.watchersByClient.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }

  // Helper method to check if a path is being watched by any client
  isPathWatched(watchPath: string): boolean {
    for (const watchers of this.watchersByClient.values()) {
      if (watchers.has(watchPath)) {
        return true;
      }
    }
    return false;
  }

  // Helper method to get all clients watching a specific path
  getClientsWatchingPath(watchPath: string): string[] {
    const clients: string[] = [];
    for (const [clientId, watchers] of this.watchersByClient) {
      if (watchers.has(watchPath)) {
        clients.push(clientId);
      }
    }
    return clients;
  }

  // Method to restart a watcher (useful for configuration changes)
  async restartWatcher(clientId: string, watchPath: string): Promise<boolean> {
    // Remove existing watcher
    this.removeWatcher(clientId, watchPath);
    
    // Add new watcher
    return await this.addWatcher(clientId, watchPath);
  }

  // Method to pause/resume watching for a client
  pauseClientWatchers(clientId: string): boolean {
    const clientWatchers = this.watchersByClient.get(clientId);
    if (!clientWatchers) return false;

    for (const [watchPath, watcher] of clientWatchers) {
      try {
        watcher.close();
      } catch (error) {
        console.error(`Failed to pause file watcher for ${watchPath}:`, error);
      }
    }

    return true;
  }

  async resumeClientWatchers(clientId: string): Promise<boolean> {
    const clientWatchers = this.watchersByClient.get(clientId);
    if (!clientWatchers) return false;

    const pathsToWatch = Array.from(clientWatchers.keys());
    let success = true;

    for (const watchPath of pathsToWatch) {
      const result = await this.addWatcher(clientId, watchPath);
      if (!result) {
        success = false;
      }
    }

    return success;
  }
}
