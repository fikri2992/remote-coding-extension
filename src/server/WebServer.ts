import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

export interface WebServerConfig {
  port: number;
  host: string;
  distPath?: string;
}

export interface WebServerStatus {
  isRunning: boolean;
  port?: number;
  host?: string;
  localUrl?: string;
  publicUrl?: string;
  startTime?: Date;
  uptime?: number;
  lastError?: string;
}

export class WebServer {
  private server: http.Server | null = null;
  private status: WebServerStatus = { isRunning: false };

  constructor(private config: WebServerConfig) {}

  public async start(): Promise<void> {
    try {
      // Create HTTP server
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      return new Promise((resolve, reject) => {
        this.server!.listen(this.config.port, this.config.host, () => {
          const localUrl = `http://${this.config.host}:${this.config.port}`;

          this.status = {
            isRunning: true,
            port: this.config.port,
            host: this.config.host,
            localUrl,
            startTime: new Date(),
            uptime: 0
          };

          console.log(`Webserver started on ${localUrl}`);
          resolve();
        });

        this.server!.on('error', (error) => {
          this.status.lastError = error.message;
          reject(error);
        });
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.status.lastError = errorMessage;
      throw new Error(`Failed to start webserver: ${errorMessage}`);
    }
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.status = { isRunning: false };
          this.server = null;
          console.log('Webserver stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname || '/';

    // Handle React Router - serve index.html for all non-static routes
    if (!pathname.includes('.') || pathname === '/') {
      pathname = '/index.html';
    }

    // Construct file path
    const filePath = path.join(this.config.distPath || __dirname, pathname);

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        // File not found, serve index.html for React Router
        const indexPath = path.join(this.config.distPath || __dirname, 'index.html');
        fs.readFile(indexPath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          }
        });
        return;
      }

      // Determine content type
      const ext = path.extname(filePath);
      let contentType = 'text/plain';

      switch (ext) {
        case '.html':
          contentType = 'text/html';
          break;
        case '.css':
          contentType = 'text/css';
          break;
        case '.js':
          contentType = 'application/javascript';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
      }

      // Read and serve file
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Internal Server Error');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      });
    });
  }

  public getStatus(): WebServerStatus {
    if (this.status.isRunning && this.status.startTime) {
      this.status.uptime = Date.now() - this.status.startTime.getTime();
    }
    return { ...this.status };
  }
}
