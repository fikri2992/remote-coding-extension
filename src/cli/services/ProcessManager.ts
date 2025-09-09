import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ServerProcessInfo {
  pid: number;
  port: number;
  configPath: string;
  startTime: string;
  nodeVersion?: string;
  platform?: string;
}

export class ProcessManager {
  private static readonly PID_FILE = '.kiro-server.pid';
  private static readonly INFO_FILE = '.kiro-server.json';

  static async saveServerProcess(info: ServerProcessInfo): Promise<void> {
    try {
      // Save PID file
      await fs.writeFile(this.PID_FILE, info.pid.toString());
      
      // Save detailed info file
      await fs.writeFile(this.INFO_FILE, JSON.stringify(info, null, 2));
      
      console.log(`✅ Server process info saved (PID: ${info.pid})`);
    } catch (error) {
      console.error('❌ Failed to save server process info:', error);
      throw error;
    }
  }

  static async getServerProcessInfo(): Promise<ServerProcessInfo | null> {
    try {
      // Check if info file exists
      await fs.access(this.INFO_FILE);
      
      // Read and parse the info file
      const content = await fs.readFile(this.INFO_FILE, 'utf-8');
      const info: ServerProcessInfo = JSON.parse(content);
      
      // Verify if the process is still running
      if (await this.isProcessRunning(info.pid)) {
        return info;
      } else {
        // Process is not running, clean up stale files
        await this.cleanupProcessFiles();
        return null;
      }
    } catch (error) {
      // Files don't exist or are invalid
      return null;
    }
  }

  static async isProcessRunning(pid: number): Promise<boolean> {
    try {
      // Different commands for different platforms
      const platform = process.platform;
      let command: string;
      
      if (platform === 'win32') {
        // Windows: use tasklist
        command = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
      } else {
        // Unix-like: use ps
        command = `ps -p ${pid} -o pid=`;
      }
      
      const { stdout } = await execAsync(command);
      return stdout.trim().length > 0;
    } catch (error) {
      // Process not found or command failed
      return false;
    }
  }

  static async stopServerProcess(): Promise<boolean> {
    try {
      const info = await this.getServerProcessInfo();
      
      if (!info) {
        console.log('ℹ️  No running server process found');
        return false;
      }

      console.log(`🛑 Stopping server process (PID: ${info.pid})...`);
      
      // Try graceful shutdown first
      if (process.platform === 'win32') {
        // Windows: use taskkill
        try {
          await execAsync(`taskkill /PID ${info.pid} /F`);
        } catch (error) {
          // Force kill if graceful shutdown fails
          await execAsync(`taskkill /PID ${info.pid} /F /T`);
        }
      } else {
        // Unix-like: send SIGTERM first, then SIGKILL if needed
        try {
          process.kill(info.pid, 'SIGTERM');
          
          // Wait for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check if process is still running
          if (await this.isProcessRunning(info.pid)) {
            console.log('⚠️  Force killing server process...');
            process.kill(info.pid, 'SIGKILL');
          }
        } catch (error) {
          // Process might already be dead
          if (await this.isProcessRunning(info.pid)) {
            process.kill(info.pid, 'SIGKILL');
          }
        }
      }
      
      // Verify the process is stopped
      if (!(await this.isProcessRunning(info.pid))) {
        console.log('✅ Server process stopped successfully');
        await this.cleanupProcessFiles();
        return true;
      } else {
        console.error('❌ Failed to stop server process');
        return false;
      }
    } catch (error) {
      console.error('❌ Error stopping server process:', error);
      return false;
    }
  }

  static async cleanupProcessFiles(): Promise<void> {
    try {
      await fs.unlink(this.PID_FILE);
    } catch (error) {
      // File might not exist, ignore
    }
    
    try {
      await fs.unlink(this.INFO_FILE);
    } catch (error) {
      // File might not exist, ignore
    }
  }

  static async getServerStatus(): Promise<{
    isRunning: boolean;
    info?: ServerProcessInfo;
    uptime?: string;
  }> {
    const info = await this.getServerProcessInfo();
    
    if (!info) {
      return { isRunning: false };
    }

    const startTime = new Date(info.startTime);
    const uptime = Date.now() - startTime.getTime();
    
    return {
      isRunning: true,
      info,
      uptime: this.formatUptime(uptime)
    };
  }

  private static formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
