import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export interface TunnelConfig {
  localPort: number;
  subdomain?: string;
  host?: string;
}

export interface TunnelStatus {
  isRunning: boolean;
  localUrl?: string;
  publicUrl?: string;
  process?: cp.ChildProcess;
  startTime?: Date;
  lastError?: string;
}

export class LocalTunnel {
  private status: TunnelStatus = { isRunning: false };
  private config: TunnelConfig;

  constructor(config: TunnelConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    try {
      // Check if localtunnel is installed globally
      const isInstalled = await this.checkLocalTunnelInstalled();

      if (!isInstalled) {
        throw new Error('localtunnel is not installed. Please install it globally: npm install -g localtunnel');
      }

      // Build command arguments
      const args = [this.config.localPort.toString()];

      if (this.config.subdomain) {
        args.push('--subdomain', this.config.subdomain);
      }

      if (this.config.host) {
        args.push('--host', this.config.host);
      }

      // Start localtunnel process
      const tunnelProcess = cp.spawn('lt', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      this.status.process = tunnelProcess;
      this.status.startTime = new Date();

      return new Promise((resolve, reject) => {
        let tunnelUrl = '';
        let errorMessage = '';

        // Handle stdout to capture the tunnel URL
        tunnelProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log('LocalTunnel stdout:', output);

          // Look for the tunnel URL in the output
          const urlMatch = output.match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            tunnelUrl = urlMatch[0];
            this.status.publicUrl = tunnelUrl;
            this.status.localUrl = `http://localhost:${this.config.localPort}`;
            this.status.isRunning = true;

            console.log(`LocalTunnel started: ${tunnelUrl}`);
            resolve();
          }
        });

        // Handle stderr for error messages
        tunnelProcess.stderr?.on('data', (data) => {
          const error = data.toString();
          console.error('LocalTunnel stderr:', error);
          errorMessage += error;
        });

        // Handle process exit
        tunnelProcess.on('exit', (code) => {
          console.log(`LocalTunnel process exited with code ${code}`);
          this.status.isRunning = false;

          if (code !== 0 && !tunnelUrl) {
            this.status.lastError = errorMessage || `Process exited with code ${code}`;
            reject(new Error(this.status.lastError));
          }
        });

        // Handle process errors
        tunnelProcess.on('error', (error) => {
          console.error('LocalTunnel process error:', error);
          this.status.lastError = error.message;
          this.status.isRunning = false;
          reject(error);
        });

        // Timeout after 30 seconds if no URL is found
        setTimeout(() => {
          if (!tunnelUrl) {
            tunnelProcess.kill();
            this.status.lastError = 'Timeout: Could not establish tunnel connection';
            reject(new Error(this.status.lastError));
          }
        }, 30000);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = errorMessage;
      throw new Error(`Failed to start localtunnel: ${errorMessage}`);
    }
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.status.process) {
        this.status.process.kill('SIGTERM');

        // Wait for process to exit
        const timeout = setTimeout(() => {
          if (this.status.process) {
            this.status.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.status.process.on('exit', () => {
          clearTimeout(timeout);
          this.status.isRunning = false;
          this.status.process = undefined as any;
          console.log('LocalTunnel stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async checkLocalTunnelInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      cp.exec('lt --version', (error) => {
        resolve(!error);
      });
    });
  }

  public getStatus(): TunnelStatus {
    return { ...this.status };
  }

  public async installLocalTunnel(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Installing localtunnel globally...');

      const installProcess = cp.spawn('npm', ['install', '-g', 'localtunnel'], {
        stdio: 'inherit',
        shell: true
      });

      installProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('localtunnel installed successfully');
          resolve();
        } else {
          reject(new Error(`Failed to install localtunnel (exit code: ${code})`));
        }
      });

      installProcess.on('error', (error) => {
        reject(new Error(`Installation error: ${error.message}`));
      });
    });
  }
}
