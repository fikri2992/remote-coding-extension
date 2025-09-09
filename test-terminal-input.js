const WebSocket = require('ws');

// Test terminal input functionality
async function testTerminalInput() {
    const ws = new WebSocket('ws://localhost:3901/ws');
    
    ws.on('open', () => {
        console.log('✅ WebSocket connected');
        
        // Create a terminal session
        const createMessage = {
            type: 'terminal',
            id: 'test_create',
            data: {
                op: 'create',
                sessionId: 'test_session_123',
                cols: 80,
                rows: 24,
                persistent: true,
                engine: 'pipe'
            }
        };
        
        console.log('📤 Creating terminal session...');
        ws.send(JSON.stringify(createMessage));
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📥 Received:', JSON.stringify(message, null, 2));
        
        if (message.type === 'terminal' && message.data?.event === 'ready') {
            console.log('✅ Terminal session ready, testing input...');
            
            // Send some input
            const inputMessage = {
                type: 'terminal',
                id: 'test_input',
                data: {
                    op: 'input',
                    sessionId: message.data.sessionId,
                    data: 'echo "Hello World"\r'
                }
            };
            
            setTimeout(() => {
                console.log('📤 Sending input: echo "Hello World"');
                ws.send(JSON.stringify(inputMessage));
            }, 1000);
            
            // Close after 5 seconds
            setTimeout(() => {
                console.log('🔚 Test complete');
                ws.close();
                process.exit(0);
            }, 5000);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket closed');
    });
}

testTerminalInput().catch(console.error);