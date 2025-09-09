import * as fs from 'fs';
import * as path from 'path';

export type TUIConfig = {
  server: { httpPort: number; websocketPort?: number; autoStart: boolean };
  tunnel: { autoStartTunnel: boolean; defaultTunnelName?: string; cloudflareToken?: string };
  terminal: { engineMode: 'auto'|'line'|'pipe'; injectAICredentials: boolean; debug: boolean };
  ui: { theme: 'dark'|'light'; refreshInterval: number; logLevel: 'debug'|'info'|'warn'|'error' };
};

const DEFAULT_CFG: TUIConfig = {
  server: { httpPort: 3900, autoStart: true },
  tunnel: { autoStartTunnel: false },
  terminal: { engineMode: 'auto', injectAICredentials: false, debug: false },
  ui: { theme: 'dark', refreshInterval: 1000, logLevel: 'info' },
};

export class ConfigManager {
  constructor(private explicitPath?: string) {}

  private findConfigPath(): string | null {
    if (this.explicitPath) return path.resolve(this.explicitPath);
    const cwd = process.cwd();
    const local = path.join(cwd, '.kiro-remote', 'config.json');
    const home = path.join(require('os').homedir(), '.kiro-remote', 'config.json');
    if (fs.existsSync(local)) return local;
    if (fs.existsSync(home)) return home;
    return null;
  }

  load(): TUIConfig {
    try {
      const p = this.findConfigPath();
      if (p && fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<TUIConfig>;
        return { ...DEFAULT_CFG, ...raw, server: { ...DEFAULT_CFG.server, ...(raw.server||{}) } } as TUIConfig;
      }
    } catch (e) {
      // fallthrough to defaults
    }
    return { ...DEFAULT_CFG };
  }
}

