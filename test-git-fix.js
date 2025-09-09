#!/usr/bin/env node

/**
 * Test script to verify git history loading fix
 */

const WebSocket = require('ws');

async function testGitFix() {
  console.log('🧪 Testing Git History Loading Fix...');
  
  const gitLogMessage = {
    type: 'git',
    id: 'test_git_log_' + Date.now(),
    data: {
      gitData: {
        operation: 'log',
        options: {
          count: 5
        }
      }
    }
  };

  console.log('📤 Sending git log message:');
  console.log(JSON.stringify(gitLogMessage, null, 2));

  try {
    const ws = new WebSocket('ws://localhost:3001/ws');
    
    ws.on('open', () => {
      console.log('\n✅ Connected to WebSocket server');
      console.log('📤 Sending git log request...');
      ws.send(JSON.stringify(gitLogMessage));
      
      // Close after 5 seconds
      setTimeout(() => {
        console.log('🔚 Closing connection...');
        ws.close();
      }, 5000);
    });

    ws.on('message', (data) => {
      console.log('\n📥 Received response:');
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.type === 'git' && parsed.id === gitLogMessage.id) {
          console.log('🎯 Git response received!');
          console.log('Success:', parsed.data?.ok !== false);
          console.log('Operation:', parsed.data?.gitData?.operation);
          
          if (parsed.data?.gitData?.result) {
            console.log('✅ Git log data received:', Array.isArray(parsed.data.gitData.result) ? `${parsed.data.gitData.result.length} commits` : 'data present');
          } else if (parsed.data?.error) {
            console.log('❌ Git error:', parsed.data.error);
          }
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
    console.log('   or: node out/cli/commands/server.js start');
    process.exit(1);
  }
}

testGitFix().catch(console.error);