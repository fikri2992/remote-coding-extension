const { ServerManager } = require('./out/server/ServerManager');
const { ConfigurationManager } = require('./out/server/ConfigurationManager');

async function testWebSocketConnection() {
    try {
        console.log('🚀 Starting WebSocket connection test...');
        
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
        
        console.log('🔧 Starting servers...');
        await serverManager.start();
        
        console.log('✅ Servers started successfully!');
        console.log('🌐 HTTP Server: http://localhost:8080');
        console.log('🔌 WebSocket Server: ws://localhost:8081');
        console.log('');
        console.log('📋 Test Instructions:');
        console.log('1. Open http://localhost:8080 in your browser');
        console.log('2. Check the browser console for connection status');
        console.log('3. Look for file tree loading attempts');
        console.log('');
        console.log('🔍 Debug Information:');
        console.log('- WebSocket should connect to ws://localhost:8081');
        console.log('- File tree commands should be handled by the server');
        console.log('- Check browser network tab for WebSocket connection');
        console.log('');
        console.log('Press Ctrl+C to stop the servers');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping servers...');
            await serverManager.stop();
            console.log('✅ Servers stopped');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error starting servers:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testWebSocketConnection();