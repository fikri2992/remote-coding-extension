const WebSocket = require('ws');

// Test filesystem WebSocket communication
async function testFilesystemWebSocket() {
  console.log('🔍 Testing filesystem WebSocket communication...');
  
  const ws = new WebSocket('ws://localhost:3900/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Test filesystem tree operation (what the files page uses)
    const message = {
      type: 'fileSystem',
      id: 'test_fs_' + Date.now(),
      data: {
        fileSystemData: {
          operation: 'tree',
          path: '/'
        }
      }
    };
    
    console.log('📤 Sending filesystem tree request:', JSON.stringify(message, null, 2));
    ws.send(JSON.stringify(message));
    
    // Set timeout to close connection after 10 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout - closing connection');
      ws.close();
    }, 10000);
  });
  
  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log('📥 Received response:', JSON.stringify(response, null, 2));
      
      if (response.type === 'fileSystem' && response.id.startsWith('test_fs_')) {
        console.log('✅ Filesystem response received!');
        if (response.data && response.data.ok) {
          console.log('✅ Operation successful');
          if (response.data.result && response.data.result.length) {
            console.log(`📁 Found ${response.data.result.length} items in root directory`);
          }
        } else {
          console.log('❌ Operation failed:', response.data?.error || 'Unknown error');
        }
        ws.close();
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      console.log('Raw data:', data.toString());
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

testFilesystemWebSocket().catch(console.error);