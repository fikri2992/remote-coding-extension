#!/usr/bin/env node

/**
 * Test script to verify filesystem service functionality
 */

const WebSocket = require('ws');

async function testFilesystem() {
  console.log('🧪 Testing Filesystem Service...');
  
  const fsTreeMessage = {
    type: 'fileSystem',
    id: 'test_fs_tree_' + Date.now(),
    data: {
      fileSystemData: {
        operation: 'tree',
        path: '/'
      }
    }
  };

  console.log('📤 Sending filesystem tree request:');
  console.log(JSON.stringify(fsTreeMessage, null, 2));

  try {
    const ws = new WebSocket('ws://localhost:3001/ws');
    
    ws.on('open', () => {
      console.log('\n✅ Connected to WebSocket server');
      console.log('📤 Requesting file tree...');
      ws.send(JSON.stringify(fsTreeMessage));
      
      // Close after 10 seconds
      setTimeout(() => {
        console.log('🔚 Closing connection...');
        ws.close();
      }, 10000);
    });

    ws.on('message', (data) => {
      console.log('\n📥 Received response:');
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.type === 'fileSystem' && parsed.id === fsTreeMessage.id) {
          console.log('🎯 Filesystem response received!');
          console.log('Success:', parsed.data?.ok !== false);
          console.log('Operation:', parsed.data?.operation);
          
          if (parsed.data?.result) {
            console.log('✅ File tree data received!');
            if (parsed.data.result.children) {
              console.log('Files/folders found:', parsed.data.result.children.length);
              console.log('First few items:');
              parsed.data.result.children.slice(0, 5).forEach(item => {
                console.log(`  ${item.isDirectory ? '📁' : '📄'} ${item.name}`);
              });
            } else {
              console.log('Tree result:', parsed.data.result);
            }
          } else if (parsed.data?.error) {
            console.log('❌ Filesystem error:', parsed.data.error);
          }
        } else if (parsed.type === 'connection_established') {
          console.log('🔗 Connection established:', parsed.connectionId);
        } else {
          console.log('Other message:', {
            type: parsed.type,
            id: parsed.id
          });
        }
      } catch (e) {
        console.log('Raw response:', data.toString());
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
      console.log('🔚 WebSocket connection closed');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to connect to WebSocket server:', error.message);
    console.log('💡 Make sure the CLI server is running:');
    console.log('   npm run cli:start');
    process.exit(1);
  }
}

testFilesystem().catch(console.error);