export interface FileWatchEvent {
  type: 'change' | 'add' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: number;
}

export class RobustFileWatcher {
  private watchers = new Map<string, any>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private broadcastChannel: BroadcastChannel | null = null;
  private invalidateCallback: (path: string) => Promise<void>;
  private isEnabled = true;

  constructor(invalidateCallback: (path: string) => Promise<void>) {
    this.invalidateCallback = invalidateCallback;
    this.initBroadcastChannel();
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('kiro-file-cache-invalidation');
        this.broadcastChannel.onmessage = this.handleBroadcast.bind(this);
      } catch (error) {
        console.warn('BroadcastChannel not available for cache sync:', error);
      }
    }
  }

  private handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === 'invalidate' && event.data?.path) {
      // Handle invalidation from other tabs
      this.invalidateCallback(event.data.path).catch(console.warn);
    }
  };

  private broadcastInvalidation(path: string): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'invalidate',
          path,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('Failed to broadcast invalidation:', error);
      }
    }
  }



  private handleFileChange = async (event: FileWatchEvent): Promise<void> => {
    if (!this.isEnabled) return;

    try {
      // Invalidate the changed file/directory
      await this.invalidateCallback(event.path);
      
      // Broadcast to other tabs
      this.broadcastInvalidation(event.path);
      
      console.log(`Cache invalidated for: ${event.path} (${event.type})`);
    } catch (error) {
      console.warn('Error handling file change:', error);
    }
  };

  // Simulate file system watching using periodic checks and WebSocket events
  setupWatcher(basePath: string = '/'): void {
    if (this.watchers.has(basePath)) return;

    // For web environment, we'll rely on WebSocket events and manual invalidation
    // This is a placeholder for future file system event integration
    const watcherId = setInterval(() => {
      // Periodic cache validation could go here
      // For now, we rely on explicit invalidation calls
    }, 30000); // Check every 30 seconds

    this.watchers.set(basePath, watcherId);
  }

  removeWatcher(path: string): void {
    const watcherId = this.watchers.get(path);
    if (watcherId) {
      clearInterval(watcherId);
      this.watchers.delete(path);
    }
  }

  // Manual invalidation methods for external triggers
  async invalidateFile(path: string): Promise<void> {
    await this.handleFileChange({
      type: 'change',
      path,
      timestamp: Date.now()
    });
  }

  async invalidateDirectory(path: string): Promise<void> {
    await this.handleFileChange({
      type: 'change',
      path,
      timestamp: Date.now()
    });
  }

  // Handle bulk operations
  async handleGitOperation(operation: string, paths?: string[]): Promise<void> {
    switch (operation) {
      case 'checkout':
      case 'pull':
      case 'merge':
      case 'rebase':
        // Clear all cache for major operations
        await this.invalidateCallback('*');
        this.broadcastInvalidation('*');
        break;
      case 'commit':
      case 'add':
      case 'rm':
        if (paths) {
          for (const path of paths) {
            await this.invalidateCallback(path);
            this.broadcastInvalidation(path);
          }
        }
        break;
    }
  }

  async handlePackageOperation(_operation: string): Promise<void> {
    const pathsToInvalidate = [
      '/package.json',
      '/package-lock.json',
      '/yarn.lock',
      '/node_modules'
    ];

    for (const path of pathsToInvalidate) {
      await this.invalidateCallback(path);
      this.broadcastInvalidation(path);
    }
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  destroy(): void {
    // Clear all watchers
    for (const [path] of this.watchers) {
      this.removeWatcher(path);
    }

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.isEnabled = false;
  }
}
