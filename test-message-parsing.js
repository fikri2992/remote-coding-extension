#!/usr/bin/env node

/**
 * Test script to verify WebSocket message parsing fixes
 */

const WebSocket = require('ws');

async function testMessageParsing() {
  console.log('🧪 Testing WebSocket message parsing fixes...');
  
  // Test data that matches frontend format
  const gitMessage = {
    type: 'git',
    id: 'test_git_123',
    data: {
      gitData: {
        operation: 'log',
        options: {
          count: 10
        }
      }
    }
  };

  const fileSystemMessage = {
    type: 'fileSystem',
    id: 'test_fs_123',
    data: {
      fileSystemData: {
        operation: 'open',
        path: '/src/test.js'
      }
    }
  };

  console.log('📤 Git message format:');
  console.log(JSON.stringify(gitMessage, null, 2));
  
  console.log('\n📤 FileSystem message format:');
  console.log(JSON.stringify(fileSystemMessage, null, 2));

  // Try to connect to WebSocket server
  try {
    const ws = new WebSocket('ws://localhost:3001/ws');
    
    ws.on('open', () => {
      console.log('\n✅ Connected to WebSocket server');
      
      // Send test messages
      console.log('📤 Sending git log request...');
      ws.send(JSON.stringify(gitMessage));
      
      setTimeout(() => {
        console.log('📤 Sending file open request...');
        ws.send(JSON.stringify(fileSystemMessage));
      }, 1000);
      
      setTimeout(() => {
        console.log('🔚 Closing connection...');
        ws.close();
      }, 3000);
    });

    ws.on('message', (data) => {
      console.log('📥 Received response:');
      try {
        const parsed = JSON.parse(data.toString());
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Raw:', data.toString());
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
    console.log('💡 Make sure the CLI server is running on port 3001');
    console.log('💡 Run: npm run cli:start or node out/cli/commands/server.js start');
    process.exit(1);
  }
}

// Run the test
testMessageParsing().catch(console.error);