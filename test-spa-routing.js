const { ServerManager } = require('./out/server/ServerManager');
const { ConfigurationManager } = require('./out/server/ConfigurationManager');

async function testSpaRouting() {
    try {
        console.log('🚀 Starting SPA routing test...');
        
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
        
        console.log('🔧 Starting servers with SPA routing support...');
        await serverManager.start();
        
        console.log('✅ Servers started successfully!');
        console.log('🌐 HTTP Server: http://localhost:8080');
        console.log('🔌 WebSocket Server: ws://localhost:8081');
        console.log('');
        console.log('🧭 SPA Routing Test URLs:');
        console.log('   ✓ http://localhost:8080/ (root)');
        console.log('   ✓ http://localhost:8080/files (should work on direct access)');
        console.log('   ✓ http://localhost:8080/automation (should work on direct access)');
        console.log('   ✓ http://localhost:8080/git (should work on direct access)');
        console.log('   ✓ http://localhost:8080/terminal (should work on direct access)');
        console.log('   ✓ http://localhost:8080/chat (should work on direct access)');
        console.log('');
        console.log('📋 Test Instructions:');
        console.log('1. Open any of the URLs above in your browser');
        console.log('2. Navigate to different sections using the UI');
        console.log('3. Refresh the page (F5) - it should still work');
        console.log('4. Try accessing /files directly in a new tab');
        console.log('5. Check browser console for WebSocket connection');
        console.log('');
        console.log('🔍 What to expect:');
        console.log('- All routes should serve the Vue.js application');
        console.log('- No 404 errors when refreshing or direct access');
        console.log('- WebSocket connection should establish automatically');
        console.log('- File tree should load without timeout errors');
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

testSpaRouting();