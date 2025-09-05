/**
 * HttpServer - HTTP server for serving web frontend assets
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { ServerConfig } from './interfaces';
import {
    createTunnel as cfCreateTunnel,
    getActiveTunnels as cfGetActiveTunnels,
    getTunnelsSummary as cfGetTunnelsSummary,
    stopTunnelById as cfStopTunnelById,
    stopAllTunnels as cfStopAllTunnels,
    ensureCloudflared as cfEnsure
} from './CloudflaredManager';
import { ErrorHandler, ErrorCategory, ErrorSeverity } from './ErrorHandler';

export class HttpServer {
    private server: http.Server | null = null;
    private config: ServerConfig;
    private webAssetsPath: string;
    private errorHandler: ErrorHandler;
    private requestCount: number = 0;
    private errorCount: number = 0;

    constructor(config: ServerConfig) {
        this.config = config;
        this.errorHandler = ErrorHandler.getInstance();
        
        // Serve the React frontend build directory (dist)
        this.webAssetsPath = path.join(__dirname, '..', 'webview', 'react-frontend', 'dist');
        
        console.log(`HTTP Server configured to serve React web application from: ${this.webAssetsPath}`);
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
     * Handle incoming HTTP requests with comprehensive error handling
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        this.requestCount++;
        const startTime = Date.now();
        
        try {
            // Log request for debugging
            console.log(`HTTP ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

            // Add CORS headers (always enabled with secure defaults)
            this.addCorsHeaders(res, req);

            // Add security headers
            this.addSecurityHeaders(res);

            // Handle preflight requests
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Parse the URL with error handling
            let parsedUrl;
            try {
                parsedUrl = url.parse(req.url || '/', true);
            } catch (urlError) {
                this.sendErrorResponse(res, 400, 'Bad Request - Invalid URL');
                return;
            }

            let pathname = parsedUrl.pathname || '/';

            // API routes (allow POST and GET)
            if (pathname.startsWith('/api/')) {
                this.handleApiRequest(req, res, pathname, parsedUrl.query || {});
                return;
            }

            // Validate request method (static assets only support GET/HEAD)
            if (!['GET', 'HEAD'].includes(req.method || '')) {
                this.sendErrorResponse(res, 405, 'Method Not Allowed');
                return;
            }

            // Health endpoint (no SPA rewrite)
            if (pathname === '/health') {
                const body = JSON.stringify({
                    ok: true,
                    port: this.config.httpPort,
                    requests: this.requestCount,
                    errors: this.errorCount,
                    timestamp: new Date().toISOString()
                });
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(body);
                return;
            }

            // Handle React Router - serve index.html for client-side routes
            if (pathname !== '/' && !pathname.includes('.')) {
                pathname = '/index.html';
            }

            // Default to index.html for root requests
            if (pathname === '/') {
                pathname = '/index.html';
            }

            // Serve static files with enhanced error handling
            this.serveStaticFileWithErrorHandling(pathname, res, req);

        } catch (error) {
            this.errorCount++;
            console.error('Error handling HTTP request:', error);
            
            const errorInfo = this.errorHandler.createError(
                'HTTP_REQUEST_ERROR',
                `HTTP request handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.NETWORK,
                ErrorSeverity.MEDIUM,
                { 
                    method: req.method, 
                    url: req.url, 
                    userAgent: req.headers['user-agent'],
                    remoteAddress: req.socket.remoteAddress
                }
            );

            this.errorHandler.handleError(errorInfo, null, false);
            this.sendErrorResponse(res, 500, 'Internal Server Error');
        } finally {
            // Log request completion time
            const duration = Date.now() - startTime;
            if (duration > 1000) { // Log slow requests
                console.warn(`Slow HTTP request: ${req.method} ${req.url} took ${duration}ms`);
            }
        }
    }

    /**
     * Handle /api/* JSON endpoints for tunnel management
     */
    private async handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, query: any): Promise<void> {
        try {
            // Normalize method
            const method = (req.method || 'GET').toUpperCase();

            // Helper to send JSON
            const sendJson = (code: number, obj: any) => {
                if (!res.headersSent) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.writeHead(code);
                }
                res.end(JSON.stringify(obj));
            };

            // Helper to read JSON body (max 1MB)
            const readBody = async (): Promise<any> => {
                return new Promise((resolve, reject) => {
                    let data = '';
                    let size = 0;
                    req.on('data', (chunk) => {
                        size += chunk.length;
                        if (size > 1024 * 1024) {
                            reject(new Error('Payload too large'));
                            try { req.destroy(); } catch {}
                            return;
                        }
                        data += chunk.toString();
                    });
                    req.on('end', () => {
                        if (!data) return resolve({});
                        try { resolve(JSON.parse(data)); }
                        catch (e) { reject(new Error('Invalid JSON')); }
                    });
                    req.on('error', (e) => reject(e));
                });
            };

            // Routing
            if (method === 'GET' && pathname === '/api/tunnels') {
                const tunnels = cfGetActiveTunnels();
                return sendJson(200, { success: true, tunnels });
            }

            if (method === 'GET' && pathname === '/api/tunnels/status') {
                const status = await cfGetTunnelsSummary();
                return sendJson(200, { success: true, status });
            }

            if (method === 'POST' && pathname === '/api/tunnels/create') {
                const body = await readBody();
                const localPort = Number(body.localPort || 0);
                const name = typeof body.name === 'string' ? body.name : undefined;
                const token = typeof body.token === 'string' ? body.token : undefined;
                const type: 'quick' | 'named' = name || token ? 'named' : 'quick';

                if (!localPort || isNaN(localPort)) {
                    return sendJson(400, { success: false, error: 'localPort is required' });
                }

                const tunnel = await cfCreateTunnel({ localPort, name, token, type });
                return sendJson(200, { success: true, tunnel });
            }

            if (method === 'POST' && pathname === '/api/tunnels/stop') {
                const body = await readBody();
                const id = typeof body.id === 'string' ? body.id : undefined;
                const pid = typeof body.pid === 'number' ? body.pid : undefined;

                let ok = false;
                if (id) {
                    ok = await cfStopTunnelById(id);
                } else if (typeof pid === 'number' && pid > 0) {
                    // Use exported killProcessTree to terminate
                    const { killProcessTree } = await import('./CloudflaredManager');
                    ok = await killProcessTree(pid);
                } else {
                    return sendJson(400, { success: false, error: 'id or pid is required' });
                }
                return sendJson(200, { success: ok });
            }

            if (method === 'POST' && pathname === '/api/tunnels/stopAll') {
                const count = await cfStopAllTunnels();
                return sendJson(200, { success: true, stopped: count });
            }

            if (method === 'POST' && pathname === '/api/cloudflared/install') {
                const bin = await cfEnsure(undefined);
                return sendJson(200, { success: true, binary: bin });
            }

            // Unknown API route
            return sendJson(404, { success: false, error: 'Not Found' });

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown API error';
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: msg }));
        }
    }

    /**
     * Serve static files with enhanced error handling
     */
    private serveStaticFileWithErrorHandling(pathname: string, res: http.ServerResponse, req: http.IncomingMessage): void {
        try {
            this.serveStaticFile(pathname, res, req);
        } catch (error) {
            console.error(`Error serving static file ${pathname}:`, error);
            
            const errorInfo = this.errorHandler.createError(
                'STATIC_FILE_ERROR',
                `Failed to serve static file ${pathname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCategory.INTERNAL,
                ErrorSeverity.LOW,
                { pathname, error: error instanceof Error ? error.message : 'Unknown error' }
            );

            this.errorHandler.handleError(errorInfo, null, false);
            this.sendErrorResponse(res, 500, 'Error serving file');
        }
    }

    /**
     * Serve static files from the web assets directory
     */
    private serveStaticFile(pathname: string, res: http.ServerResponse, req: http.IncomingMessage): void {
        // Security: prevent directory traversal
        const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(this.webAssetsPath, safePath);

        // Ensure the file is within the web assets directory
        if (!filePath.startsWith(this.webAssetsPath)) {
            this.sendErrorResponse(res, 403, 'Forbidden');
            return;
        }

        // Check if file exists with timeout
        const accessTimeout = setTimeout(() => {
            if (!res.headersSent) {
                this.sendErrorResponse(res, 504, 'File access timeout');
            }
        }, 5000);

        fs.access(filePath, fs.constants.F_OK, (err) => {
            clearTimeout(accessTimeout);
            
            if (err) {
                if (err.code === 'ENOENT') {
                    this.sendErrorResponse(res, 404, 'File Not Found');
                } else if (err.code === 'EACCES') {
                    this.sendErrorResponse(res, 403, 'Access Denied');
                } else {
                    console.error(`File access error for ${filePath}:`, err);
                    this.sendErrorResponse(res, 500, 'File Access Error');
                }
                return;
            }

            // Get file stats with timeout
            const statTimeout = setTimeout(() => {
                if (!res.headersSent) {
                    this.sendErrorResponse(res, 504, 'File stat timeout');
                }
            }, 3000);

            fs.stat(filePath, (statErr, stats) => {
                clearTimeout(statTimeout);
                
                if (statErr) {
                    console.error(`File stat error for ${filePath}:`, statErr);
                    this.sendErrorResponse(res, 500, 'File Stat Error');
                    return;
                }

                if (!stats.isFile()) {
                    this.sendErrorResponse(res, 404, 'Not a File');
                    return;
                }

                // Check file size limits (prevent serving huge files)
                const maxFileSize = 50 * 1024 * 1024; // 50MB limit
                if (stats.size > maxFileSize) {
                    this.sendErrorResponse(res, 413, 'File Too Large');
                    return;
                }

                // Handle HEAD requests
                if (req.method === 'HEAD') {
                    res.setHeader('Content-Type', this.getContentType(filePath));
                    res.setHeader('Content-Length', stats.size);
                    res.writeHead(200);
                    res.end();
                    return;
                }

                // Determine content type
                const contentType = this.getContentType(filePath);
                
                // Set headers with enhanced caching strategy
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', stats.size);
                res.setHeader('Last-Modified', stats.mtime.toUTCString());
                res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`);
                
                // Set cache headers based on file type
                if (contentType.startsWith('text/html')) {
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                } else {
                    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for assets
                }

                // Handle conditional requests
                const ifModifiedSince = req.headers['if-modified-since'];
                const ifNoneMatch = req.headers['if-none-match'];
                
                if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
                    res.writeHead(304);
                    res.end();
                    return;
                }
                
                if (ifNoneMatch && ifNoneMatch === `"${stats.mtime.getTime()}-${stats.size}"`) {
                    res.writeHead(304);
                    res.end();
                    return;
                }

                // Stream the file with error handling
                const fileStream = fs.createReadStream(filePath);
                
                fileStream.on('error', (streamErr) => {
                    console.error('Error streaming file:', streamErr);
                    
                    const errorInfo = this.errorHandler.createError(
                        'FILE_STREAM_ERROR',
                        `Error streaming file ${pathname}: ${streamErr.message}`,
                        ErrorCategory.INTERNAL,
                        ErrorSeverity.MEDIUM,
                        { pathname, error: streamErr.message }
                    );

                    this.errorHandler.handleError(errorInfo, null, false);
                    
                    if (!res.headersSent) {
                        this.sendErrorResponse(res, 500, 'Error reading file');
                    } else {
                        res.destroy();
                    }
                });

                // Handle client disconnect
                req.on('close', () => {
                    if (!fileStream.destroyed) {
                        fileStream.destroy();
                    }
                });

                res.writeHead(200);
                fileStream.pipe(res);
            });
        });
    }

    /**
     * Add CORS headers to the response (fixed secure headers for local development)
     */
    private addCorsHeaders(res: http.ServerResponse, req: http.IncomingMessage): void {
        const origin = req.headers.origin;

        // For local development, allow common development origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3900',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3900',
            'http://localhost:3901',
            'http://127.0.0.1:3901'
        ];

        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
            // Default to allowing localhost for development
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3900');
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
        res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;");
    }

    /**
     * Check if origin is allowed (simplified for local development)
     */
    private isOriginAllowed(origin: string | undefined): boolean {
        if (!origin) return false;

        // For local development, allow common development origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3900',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3900',
            'http://localhost:3901',
            'http://127.0.0.1:3901'
        ];

        return allowedOrigins.includes(origin);
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
     * Check if enhanced UI should be used
     */
    private shouldUseEnhancedUI(): boolean {
        try {
            // Try to import VS Code API to check configuration
            const vscode = require('vscode');
            const config = vscode.workspace.getConfiguration('webAutomationTunnel');
            return config.get('useEnhancedUI', true) as boolean;
        } catch (error) {
            // If VS Code API is not available, default to enhanced UI
            console.log('VS Code API not available, defaulting to enhanced UI');
            return true;
        }
    }

    /**
     * Get server diagnostics
     */
    getDiagnostics(): any {
        return {
            isRunning: this.isRunning,
            port: this.config.httpPort,
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
            webAssetsPath: this.webAssetsPath,
            frontendType: 'react', // Now serves React frontend
            useEnhancedUI: this.shouldUseEnhancedUI(),
            config: {
                corsEnabled: true, // Always enabled with secure defaults
                tunnelName: this.config.tunnelName,
                cloudflareToken: this.config.cloudflareToken ? 'configured' : 'not configured',
                autoStartTunnel: this.config.autoStartTunnel
            }
        };
    }

    /**
     * Reset diagnostics counters
     */
    resetDiagnostics(): void {
        this.requestCount = 0;
        this.errorCount = 0;
    }

    /**
     * Check if server is running
     */
    get isRunning(): boolean {
        return this.server !== null && this.server.listening;
    }

    /**
     * Expose the underlying Node http.Server for upgrade handling (e.g., WebSocket)
     */
    public get nodeServer(): http.Server | null {
        return this.server;
    }
}
