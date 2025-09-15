import { Command } from 'commander';
import { CliServer } from '../server';
import { ProcessManager, ServerProcessInfo } from '../services/ProcessManager';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const startCommand = new Command('start')
  .description('Build React frontend and start the cotg-cli server')
  .option('-p, --port <number>', 'Port number for the web server', '3900')
  .option('--host <host>', 'Host to bind the server to', 'localhost')
  .option('--tunnel', 'Expose server via Cloudflare Tunnel', false)
  .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
  .option('--skip-build', 'Skip React frontend build', false)
  .action(async (options) => {
    const server = new CliServer(options.config);

    const port = parseInt(options.port);
    const host: string = options.tunnel ? '0.0.0.0' : (options.host || 'localhost');

    const getLanIp = (): string | undefined => {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        const addrs = nets[name] || [];
        for (const addr of addrs) {
          if (!addr.internal && addr.family === 'IPv4') return addr.address;
        }
      }
      return undefined;
    };

    let tunnelInfo: { id: string; url: string } | null = null;

    // Simple loading spinner util
    const spinner = (() => {
      const frames = ['-', '\\', '|', '/'];
      let i = 0;
      let timer: NodeJS.Timer | null = null;
      let prefix = 'Loading';
      return {
        start(text?: string) {
          prefix = text || prefix;
          if (timer) return;
          process.stdout.write(`${prefix} ... `);
          timer = setInterval(() => {
            const frame = frames[i++ % frames.length];
            try { process.stdout.write(`\r${prefix} ${frame}  `); } catch {}
          }, 80);
        },
        stop(finalText?: string) {
          if (timer) { clearInterval(timer); timer = null; }
          try { process.stdout.write(`\r${finalText || prefix}      \n`); } catch {}
        }
      };
    })();

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down server...');
      // Failsafe: force exit if graceful shutdown takes too long
      const forceTimer = setTimeout(() => {
        console.log('Force exiting now.');
        try { process.exit(0); } catch {}
      }, 1500);
      try {
        // Stop tunnel first to unblock port/processes
        if (tunnelInfo) {
          try {
            const { stopTunnelById } = await import('../../server/CloudflaredManager');
            await stopTunnelById(tunnelInfo.id);
          } catch {}
        }
        await server.stop();
        await ProcessManager.cleanupProcessFiles();
        clearTimeout(forceTimer);
        process.exit(0);
      } catch (error) {
        clearTimeout(forceTimer);
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Set up signal handlers
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGQUIT', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown();
    });

    try {
      // Build React frontend unless skipped; if sources not present, use bundled assets
      if (!options.skipBuild) {
        const frontendDir = path.join(process.cwd(), 'src', 'webview', 'react-frontend');
        let hasSources = false;
        try { await fs.access(frontendDir); hasSources = true; } catch {}
        if (hasSources) {
          console.log('Building React frontend...');
          try {
            execSync('cd src/webview/react-frontend && npm run build', { 
              stdio: 'inherit',
              cwd: process.cwd()
            });
            console.log('React frontend built successfully');
          } catch (error) {
            console.error('Failed to build React frontend:', error);
            process.exit(1);
          }
        } else {
          const usingBundled = (process as any).pkg ? true : false;
          if (usingBundled) {
            console.log('No local frontend sources detected. Using bundled assets from the CLI binary.');
          } else {
            console.log(`No local frontend sources at ${frontendDir}. Skipping build (assets expected to be available).`);
          }
        }
      } else {
        console.log('Skipping React frontend build');
      }

      // Start the WebSocket + HTTP server
      spinner.start('Starting local server');
      await server.start({
        port,
        host,
        config: options.config,
        tunnel: Boolean(options.tunnel)
      });
      spinner.stop('Local server ready');
      
      // Save server process information for management by other CLI commands
      const processInfo: ServerProcessInfo = {
        pid: process.pid,
        port,
        configPath: options.config,
        startTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
      };
      
      await ProcessManager.saveServerProcess(processInfo);
      
      // If requested, establish a tunnel before printing any URLs
      if (options.tunnel) {
        spinner.start('Establishing tunnel');
        try {
          const { createTunnel } = await import('../../server/CloudflaredManager');
          const t = await createTunnel({ localPort: port, type: 'quick' });
          tunnelInfo = { id: t.id, url: t.url };
          spinner.stop('Tunnel ready');
        } catch (e: any) {
          spinner.stop('Tunnel failed to start');
          console.warn('Failed to start Cloudflare Tunnel:', e?.message || String(e));
        }
      }

      // Only print URLs once everything is ready
      const localUrl = `http://localhost:${port}`;
      const lanIp = getLanIp();
      const lines: string[] = [];
      lines.push(`  Local:   ${localUrl}`);
      if (lanIp) lines.push(`  Network: http://${lanIp}:${port}`);
      if (tunnelInfo?.url) lines.push(`  Tunnel:  ${tunnelInfo.url}`);

      console.log('\nAll services started successfully!');
      for (const l of lines) console.log(l);
      console.log('');
      console.log('WebSocket: Connected');
      console.log(`Server PID: ${process.pid}`);
      console.log('');
      console.log('Press Ctrl+C to stop all services');
      
    } catch (error) {
      console.error('Failed to start services:', error);
      process.exit(1);
    }
  });
