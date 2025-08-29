const { HttpServer } = require('./out/server/HttpServer');
const path = require('path');

async function testHttpServer() {
    try {
        console.log('Starting HTTP server test...');
        
        // Create server with default config
        const config = {
            httpPort: 8080,
            websocketPort: 8081,
            allowedOrigins: ['*'],
            maxConnections: 10,
            enableCors: true
        };

        const httpServer = new HttpServer(config);
        
        console.log('Starting HTTP server...');
        await httpServer.start();
        
        console.log('✅ HTTP Server started successfully!');
        console.log('🌐 HTTP Server: http://localhost:8080');
        console.log('\nTry opening http://localhost:8080 in your browser');
        console.log('Press Ctrl+C to stop the server');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\nStopping HTTP server...');
            await httpServer.stop();
            console.log('✅ HTTP server stopped');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error starting HTTP server:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testHttpServer();