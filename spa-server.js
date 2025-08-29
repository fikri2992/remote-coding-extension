const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const STATIC_DIR = path.join(__dirname, 'out', 'webview', 'vue-frontend');

console.log('🚀 Starting SPA-aware HTTP server...');
console.log('📁 Serving from:', STATIC_DIR);

// MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
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

// SPA routes that should serve index.html
const spaRoutes = [
  '/automation',
  '/files',
  '/git',
  '/terminal',
  '/chat'
];

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL and remove query parameters
  const urlPath = req.url.split('?')[0];
  
  // Handle root path
  if (urlPath === '/') {
    serveFile('/index.html', res);
    return;
  }

  // Check if it's a known SPA route
  const isSpaRoute = spaRoutes.some(route => urlPath.startsWith(route));
  
  // Check if it's a static asset (has file extension)
  const hasExtension = path.extname(urlPath) !== '';
  
  if (isSpaRoute && !hasExtension) {
    console.log(`🧭 SPA Route detected: ${urlPath} -> serving index.html`);
    serveFile('/index.html', res);
    return;
  }

  // Try to serve the requested file
  serveFile(urlPath, res, () => {
    // If file not found and it's not a static asset, serve index.html for SPA routing
    if (!hasExtension) {
      console.log(`🔄 Fallback SPA routing: ${urlPath} -> serving index.html`);
      serveFile('/index.html', res);
    } else {
      // For static assets, return 404
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 - Not Found</title></head>
        <body>
          <h1>404 - File Not Found</h1>
          <p>The requested file <code>${urlPath}</code> was not found.</p>
          <p><a href="/">← Back to Home</a></p>
        </body>
        </html>
      `);
    }
  });
});

function serveFile(urlPath, res, onNotFound = null) {
  const filePath = path.join(STATIC_DIR, urlPath);

  // Security check
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`📄 File not found: ${filePath}`);
        if (onNotFound) {
          onNotFound();
        } else {
          res.writeHead(404);
          res.end('File not found');
        }
      } else {
        console.error('❌ Error reading file:', err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    // Set appropriate headers
    res.setHeader('Content-Type', mimeType);
    
    // Cache headers for static assets
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for assets
    }
    
    res.writeHead(200);
    res.end(data);
    
    console.log(`✅ Served: ${urlPath} (${mimeType})`);
  });
}

server.listen(PORT, () => {
  console.log(`✅ SPA-aware HTTP server running at http://localhost:${PORT}`);
  console.log('📁 Static files served from:', STATIC_DIR);
  console.log('🧭 SPA routes supported:', spaRoutes.join(', '));
  console.log('');
  console.log('📋 Test URLs:');
  console.log(`   http://localhost:${PORT}/`);
  console.log(`   http://localhost:${PORT}/files`);
  console.log(`   http://localhost:${PORT}/automation`);
  console.log(`   http://localhost:${PORT}/git`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.log('💡 Try stopping other servers or use a different port');
  } else {
    console.error('❌ Server error:', err.message);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});