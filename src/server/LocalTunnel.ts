import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { parsePublicUrl, killProcessTree } from './CloudflaredManager';

export interface TunnelConfig {
  localPort: number;
  tunnelName?: string;
  cloudflareToken?: string;
  subdomain?: string;
  host?: string;
  // Optional resolved path to cloudflared binary; if not provided, will use PATH
  binaryPath?: string;
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
  private binaryPath: string | null = null;

  constructor(config: TunnelConfig) {
    this.config = config;
    this.binaryPath = config.binaryPath ?? null;
  }

  public async start(): Promise<void> {
    try {
      // Resolve cloudflared CLI path
      const cli = this.binaryPath || 'cloudflared';

      // Validate Cloudflare token if provided
      if (this.config.cloudflareToken) {
        await this.authenticateCloudflare(cli);
      }

      // Build command arguments for cloudflared
      // Quick Tunnel (ephemeral): `cloudflared tunnel --url http://localhost:<port>`
      // Named Tunnel: `cloudflared tunnel run <NAME|ID>` (requires prior setup/credentials)
      const name = (this.config.tunnelName ?? '').trim();
      const useNamed = name.length > 0;
      const args: string[] = useNamed
        ? ['--no-autoupdate', 'tunnel', 'run', name]
        : ['--no-autoupdate', 'tunnel', '--url', `http://localhost:${this.config.localPort}`];

      console.log('Launching cloudflared with args:', args.join(' '));

      // Start cloudflared process
      const tunnelProcess = cp.spawn(cli, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      });

      this.status.process = tunnelProcess;
      this.status.startTime = new Date();
      this.status.localUrl = `http://localhost:${this.config.localPort}`;

      const timeoutMs = vscode.workspace.getConfiguration('webAutomationTunnel').get<number>('tunnelStartTimeoutMs', 60000);

      return new Promise((resolve, reject) => {
        let tunnelUrl = '';
        let errorMessage = '';

        // Handle stdout to capture the tunnel URL
        tunnelProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log('Cloudflared stdout:', output);

          if (!tunnelUrl) {
            const maybe = parsePublicUrl(output);
            if (maybe) {
              tunnelUrl = maybe;
              this.status.publicUrl = tunnelUrl;
              this.status.isRunning = true;
              console.log(`Cloudflare tunnel started: ${tunnelUrl}`);
              resolve();
            }
          }
        });

        // Also check for alternative tunnel output formats
        tunnelProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          console.log('Cloudflared stderr:', output);

          // Sometimes tunnel URL appears in stderr
          if (!tunnelUrl) {
            const maybe = parsePublicUrl(output);
            if (maybe) {
              tunnelUrl = maybe;
              this.status.publicUrl = tunnelUrl;
              this.status.isRunning = true;
              console.log(`Cloudflare tunnel started: ${tunnelUrl}`);
              resolve();
            }
          }

          errorMessage += output;
        });

        // Handle process exit
        tunnelProcess.on('exit', (code) => {
          console.log(`Cloudflared process exited with code ${code}`);
          this.status.isRunning = false;

          if (code !== 0 && !tunnelUrl) {
            this.status.lastError = errorMessage || `Process exited with code ${code}`;
            reject(new Error(this.status.lastError));
          }
        });

        // Handle process errors
        tunnelProcess.on('error', (error) => {
          console.error('Cloudflared process error:', error);
          this.status.lastError = error.message;
          this.status.isRunning = false;
          reject(error);
        });

        // Timeout if no URL is found
        setTimeout(() => {
          if (!tunnelUrl) {
            tunnelProcess.kill();
            this.status.lastError = 'Timeout: Could not establish tunnel connection';
            reject(new Error(this.status.lastError));
          }
        }, typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 60000);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = errorMessage;
      throw new Error(`Failed to start Cloudflare tunnel: ${errorMessage}`);
    }
  }

  public async stop(): Promise<void> {
    return new Promise(async (resolve) => {
      const proc = this.status.process;
      if (proc) {
        const pid = proc.pid ?? 0;
        if (pid > 0) {
          await killProcessTree(pid);
        } else {
          try { proc.kill('SIGTERM'); } catch {}
          setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
        }
        this.status.isRunning = false;
        this.status.process = undefined as any;
        console.log('LocalTunnel stopped');
        resolve();
      } else {
        resolve();
      }
    });
  }

  // Binary management is handled by ensureCloudflared() upstream; no local install/check here.

  private async authenticateCloudflare(cli: string): Promise<void> {
    if (!this.config.cloudflareToken) {
      return;
    }

    return new Promise((resolve, reject) => {
      const authProcess = cp.spawn(cli, ['tunnel', 'token', this.config.cloudflareToken!], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      });

      authProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('Cloudflare authentication successful');
          resolve();
        } else {
          reject(new Error(`Cloudflare authentication failed with code ${code}`));
        }
      });

      authProcess.on('error', (error) => {
        reject(new Error(`Cloudflare authentication error: ${error.message}`));
      });
    });
  }

  public getStatus(): TunnelStatus {
    console.log('Tunnel status requested:', {
      isRunning: this.status.isRunning,
      publicUrl: this.status.publicUrl,
      localUrl: this.status.localUrl,
      lastError: this.status.lastError,
      startTime: this.status.startTime
    });
    return { ...this.status };
  }

  // Installation of cloudflared is delegated to CloudflaredManager.ensureCloudflared().
}
