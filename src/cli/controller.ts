import { HttpServer } from '../server/HttpServer';
import { WebSocketServer } from '../server/WebSocketServer';
import { ServerConfig } from '../server/interfaces';
import { ConfigManager, TUIConfig } from '../config/ConfigManager';
import log, { setLogLevel } from '../utils/logger';

export class Controller {
  private http: HttpServer | null = null;
  private ws: WebSocketServer | null = null;
  private cfg!: TUIConfig;

  async start(opts: { configPath: string | undefined; port: number | undefined; logLevel: ('debug'|'info'|'warn'|'error') | undefined }) {
    if (opts.logLevel) setLogLevel(opts.logLevel);
    const cm = new ConfigManager(opts.configPath);
    this.cfg = cm.load();
    if (opts.port) this.cfg.server.httpPort = opts.port;

    const serverCfg: ServerConfig = {
      httpPort: this.cfg.server.httpPort,
      autoStartTunnel: this.cfg.tunnel.autoStartTunnel,
    } as ServerConfig;

    this.http = new HttpServer(serverCfg);
    await this.http.start();
    const httpServer = this.http.nodeServer!;
    this.ws = new WebSocketServer(serverCfg, httpServer, '/ws');
    await this.ws.start();
    const url = `http://localhost:${this.cfg.server.httpPort}`;
    log.info('Server started at', url);
  }

  async stop() {
    try { await this.ws?.stop?.(); } catch {}
    try { await this.http?.stop?.(); } catch {}
    log.info('Server stopped');
  }
}
