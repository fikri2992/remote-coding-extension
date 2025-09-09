const WebSocket = require('ws');

// Test the WebSocket connection timing fix
async function testConnectionFix() {
  console.log('🔍 Testing WebSocket connection timing fix...');
  
  const ws = new WebSocket('ws://localhost:3900/ws');
  let connectionEstablished = false;
  let messagesSent = [];
  let responsesReceived = [];
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    connectionEstablished = true;
    
    // Simulate the fixed behavior - only send after connection is established
    setTimeout(() => {
      console.log('📤 Sending filesystem tree request (after connection established)...');
      const message = {
        type: 'fileSystem',
        id: 'test_connection_fix_' + Date.now(),
        data: {
          fileSystemData: {
            operation: 'tree',
            path: '/'
          }
        }
      };
      
      messagesSent.push(message);
      ws.send(JSON.stringify(message));
    }, 100); // Small delay to ensure connection is fully ready
    
    // Set timeout to close connection after 10 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout - closing connection');
      console.log(`📊 Messages sent: ${messagesSent.length}`);
      console.log(`📊 Responses received: ${responsesReceived.length}`);
      
      if (responsesReceived.length > 0) {
        console.log('✅ Fix successful - messages are being processed after connection');
      } else {
        console.log('❌ Fix may not be working - no responses received');
      }
      
      ws.close();
    }, 10000);
  });
  
  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      responsesReceived.push(response);
      
      console.log('📥 Received response:', {
        type: response.type,
        id: response.id,
        operation: response.data?.operation,
        success: response.data?.ok,
        error: response.data?.error
      });
      
      if (response.type === 'fileSystem' && response.id.startsWith('test_connection_fix_')) {
        if (response.data && response.data.ok) {
          console.log('✅ Filesystem operation successful!');
          if (response.data.result && response.data.result.children) {
            console.log(`📁 Found ${response.data.result.children.length} items in root directory`);
          }
        } else {
          console.log('❌ Filesystem operation failed:', response.data?.error || 'Unknown error');
        }
        ws.close();
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    process.exit(0);
  });
}

// Check if server is running first
const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3900,
  path: '/',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  console.log('✅ Server is running, starting WebSocket test...');
  testConnectionFix().catch(console.error);
});

req.on('error', (err) => {
  console.log('❌ Server is not running. Please start it first with:');
  console.log('   node out/cli/index.js start --port 3900 --skip-build');
  process.exit(1);
});

req.on('timeout', () => {
  console.log('❌ Server connection timeout. Please start the server first.');
  process.exit(1);
});

req.end();