const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const STATIC_DIR = path.join(__dirname, 'out', 'webview', 'vue-frontend');

console.log('Serving from:', STATIC_DIR);

// MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  // Remove query parameters for file path resolution
  const urlWithoutQuery = filePath.split('?')[0];
  filePath = path.join(STATIC_DIR, urlWithoutQuery);

  // Security check
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if it's a static asset (has file extension)
  const hasExtension = path.extname(urlWithoutQuery) !== '';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('Error reading file:', err.code, filePath);
      
      // If it's not a static asset and file not found, serve index.html for SPA routing
      if (err.code === 'ENOENT' && !hasExtension) {
        console.log(`SPA Route detected: ${req.url} -> serving index.html`);
        const indexPath = path.join(STATIC_DIR, 'index.html');
        
        fs.readFile(indexPath, (indexErr, indexData) => {
          if (indexErr) {
            console.error('Error reading index.html:', indexErr);
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }
          
          res.setHeader('Content-Type', 'text/html');
          res.writeHead(200);
          res.end(indexData);
        });
        return;
      }
      
      // For static assets or other errors, return 404
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log('📁 Static files served from:', STATIC_DIR);
  console.log('\nPress Ctrl+C to stop');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
});