/**
 * HttpServer - HTTP server for serving web frontend assets
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { ServerConfig } from './interfaces';

export class HttpServer {
    private server: http.Server | null = null;
    private config: ServerConfig;
    private webAssetsPath: string;

    constructor(config: ServerConfig) {
        this.config = config;
        // Web assets will be served from the extension's web assets directory
        this.webAssetsPath = path.join(__dirname, '..', 'webview', 'web-frontend');
    }

    /**
     * Start the HTTP server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.server = http.createServer((req, res) => {
                    this.handleRequest(req, res);
                });

                // Handle server errors
                this.server.on('error', (error: NodeJS.ErrnoException) => {
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`Port ${this.config.httpPort} is already in use`));
                    } else if (error.code === 'EACCES') {
                        reject(new Error(`Permission denied to bind to port ${this.config.httpPort}`));
                    } else {
                        reject(new Error(`HTTP server error: ${error.message}`));
                    }
                });

                // Start listening with port fallback logic
                this.startWithPortFallback(resolve, reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop the HTTP server
     */
    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }

            this.server.close((error) => {
                if (error) {
                    reject(new Error(`Error stopping HTTP server: ${error.message}`));
                } else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Handle incoming HTTP requests
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        try {
            // Add CORS headers if enabled
            if (this.config.enableCors) {
                this.addCorsHeaders(res, req);
            }

            // Add security headers
            this.addSecurityHeaders(res);

            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Parse the URL
            const parsedUrl = url.parse(req.url || '/', true);
            let pathname = parsedUrl.pathname || '/';

            // Default to index.html for root requests
            if (pathname === '/') {
                pathname = '/index.html';
            }

            // Serve static files
            this.serveStaticFile(pathname, res);

        } catch (error) {
            console.error('Error handling HTTP request:', error);
            this.sendErrorResponse(res, 500, 'Internal Server Error');
        }
    }

    /**
     * Serve static files from the web assets directory
     */
    private serveStaticFile(pathname: string, res: http.ServerResponse): void {
        // Security: prevent directory traversal
        const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(this.webAssetsPath, safePath);

        // Ensure the file is within the web assets directory
        if (!filePath.startsWith(this.webAssetsPath)) {
            this.sendErrorResponse(res, 403, 'Forbidden');
            return;
        }

        // Check if file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                this.sendErrorResponse(res, 404, 'File Not Found');
                return;
            }

            // Get file stats
            fs.stat(filePath, (statErr, stats) => {
                if (statErr || !stats.isFile()) {
                    this.sendErrorResponse(res, 404, 'File Not Found');
                    return;
                }

                // Determine content type
                const contentType = this.getContentType(filePath);
                
                // Set headers
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', stats.size);
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

                // Stream the file
                const fileStream = fs.createReadStream(filePath);
                
                fileStream.on('error', (streamErr) => {
                    console.error('Error streaming file:', streamErr);
                    if (!res.headersSent) {
                        this.sendErrorResponse(res, 500, 'Error reading file');
                    }
                });

                fileStream.pipe(res);
            });
        });
    }

    /**
     * Add CORS headers to the response
     */
    private addCorsHeaders(res: http.ServerResponse, req: http.IncomingMessage): void {
        const origin = req.headers.origin;
        
        // Check if origin is allowed
        if (this.isOriginAllowed(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
        } else if (this.config.allowedOrigins.includes('*')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }

    /**
     * Add security headers to the response
     */
    private addSecurityHeaders(res: http.ServerResponse): void {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;");
    }

    /**
     * Check if origin is allowed
     */
    private isOriginAllowed(origin: string | undefined): boolean {
        if (!origin) return false;
        return this.config.allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed === origin) return true;
            // Support wildcard subdomains (e.g., *.example.com)
            if (allowed.startsWith('*.')) {
                const domain = allowed.substring(2);
                return origin.endsWith(domain);
            }
            return false;
        });
    }

    /**
     * Get content type based on file extension
     */
    private getContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Send error response
     */
    private sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
        if (res.headersSent) {
            return;
        }

        res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Error ${statusCode}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    h1 { color: #d32f2f; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <h1>Error ${statusCode}</h1>
                <p>${message}</p>
                <hr>
                <p><small>VS Code Web Automation Tunnel</small></p>
            </body>
            </html>
        `);
    }

    /**
     * Start server with port fallback logic
     */
    private startWithPortFallback(resolve: () => void, reject: (error: Error) => void, attempt: number = 0): void {
        const maxAttempts = 5;
        const currentPort = this.config.httpPort + attempt;

        if (attempt >= maxAttempts) {
            reject(new Error(`Failed to start HTTP server after ${maxAttempts} attempts. Ports ${this.config.httpPort}-${currentPort - 1} are all in use.`));
            return;
        }

        this.server!.listen(currentPort, 'localhost', () => {
            // Update config with the actual port used
            this.config.httpPort = currentPort;
            console.log(`HTTP server started on http://localhost:${currentPort}`);
            resolve();
        });

        this.server!.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE' && attempt < maxAttempts - 1) {
                console.log(`Port ${currentPort} is in use, trying ${currentPort + 1}...`);
                this.startWithPortFallback(resolve, reject, attempt + 1);
            } else {
                reject(error);
            }
        });
    }

    /**
     * Get the current server port
     */
    get port(): number {
        return this.config.httpPort;
    }

    /**
     * Check if server is running
     */
    get isRunning(): boolean {
        return this.server !== null && this.server.listening;
    }
}