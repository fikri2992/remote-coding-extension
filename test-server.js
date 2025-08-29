const { ServerManager } = require('./out/server/ServerManager');
const { ConfigurationManager } = require('./out/server/ConfigurationManager');

async function testServer() {
    try {
        console.log('Starting server test...');
        
        // Create configuration manager with default values
        const configManager = new ConfigurationManager({
            get: (key) => {
                // Return default values for testing
                switch(key) {
                    case 'webAutomationTunnel.httpPort': return 8080;
                    case 'webAutomationTunnel.websocketPort': return 8081;
                    case 'webAutomationTunnel.allowedOrigins': return ['*'];
                    case 'webAutomationTunnel.maxConnections': return 10;
                    case 'webAutomationTunnel.enableCors': return true;
                    default: return undefined;
                }
            },
            update: () => Promise.resolve(),
            inspect: () => ({ defaultValue: undefined })
        });

        const serverManager = new ServerManager(configManager);
        
        console.log('Starting servers...');
        await serverManager.start();
        
        console.log('✅ Servers started successfully!');
        console.log('🌐 HTTP Server: http://localhost:8080');
        console.log('🔌 WebSocket Server: ws://localhost:8081');
        console.log('\nPress Ctrl+C to stop the server');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\nStopping servers...');
            await serverManager.stop();
            console.log('✅ Servers stopped');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error starting server:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testServer();