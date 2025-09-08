#!/usr/bin/env node
import { Command } from 'commander';
import { Controller } from './controller';
import { setLogLevel } from '../utils/logger';
import { createPty } from '../terminal/PTYManager';
import { SessionEngine } from '../server/pseudo/SessionEngine';
import * as readline from 'readline';
import { createTunnel as cfCreateTunnel, stopAllTunnels as cfStopAll, getTunnelsSummary as cfSummary } from '../server/CloudflaredManager';

const program = new Command();
program
  .name('kiro-remote')
  .description('Kiro Remote: Web Automation Tunnel (CLI/TUI)')
  .version('0.1.0');

program
  .command('start')
  .description('Start server and WebSocket gateway')
  .option('-p, --port <number>', 'HTTP port', (v) => parseInt(v, 10))
  .option('-c, --config <path>', 'Path to config.json')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)')
  .action(async (opts: { port?: number; config?: string; logLevel?: string }) => {
    if (opts.logLevel) setLogLevel(opts.logLevel as any);
    const ctl = new Controller();
    await ctl.start({ configPath: opts.config, port: opts.port, logLevel: opts.logLevel as any });
    const shutdown = async () => { await ctl.stop(); process.exit(0); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

program
  .command('status')
  .description('Show basic status (placeholder)')
  .action(() => {
    console.log('Status: (attach to running instance via future IPC)');
  });

program
  .command('term')
  .description('Open an interactive terminal (node-pty if available, else pseudo pipe)')
  .option('-c, --cwd <path>', 'Working directory')
  .action(async (opts: { cwd?: string }) => {
    const cwd = opts.cwd ? require('path').resolve(opts.cwd) : process.cwd();
    const env = { ...process.env } as NodeJS.ProcessEnv;
    const { pty, engine } = createPty({ cwd, env, cols: process.stdout.columns || 80, rows: process.stdout.rows || 24 });
    if (pty) {
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', d => pty.write(d.toString('utf8')));
      pty.onData((d: string) => process.stdout.write(d));
      pty.onExit(() => process.exit(0));
      process.on('SIGWINCH', () => {
        try { pty.resize(process.stdout.columns || 80, process.stdout.rows || 24); } catch {}
      });
      return;
    }
    // Fallback pseudo pipe
    const engineFallback = new SessionEngine();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.pause();
    const sink = (chunk: string) => process.stdout.write(chunk);
    engineFallback.create('cli', { cwd, env, mode: 'pipe', interceptClear: true, promptEnabled: true, hiddenEchoEnabled: false }, sink);
    try { (engineFallback as any).startPipeShell?.('cli'); } catch {}
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('data', (d) => engineFallback.input('cli', d.toString('utf8')));
  });

program
  .command('tunnel')
  .description('Manage Cloudflare tunnels')
  .option('--quick', 'Start a quick tunnel to the running server (requires server)')
  .option('--stop-all', 'Stop all tunnels')
  .action(async (opts: { quick?: boolean; stopAll?: boolean }) => {
    if (opts.stopAll) {
      const n = await cfStopAll();
      console.log(`Stopped ${n} tunnel(s).`);
      return;
    }
    if (opts.quick) {
      // Default to 3900; future: query running instance
      const info = await cfCreateTunnel({ localPort: 3900, type: 'quick' });
      console.log('Tunnel:', info.url);
      return;
    }
    const s = await cfSummary();
    console.log(JSON.stringify(s, null, 2));
  });

program.parseAsync(process.argv);
