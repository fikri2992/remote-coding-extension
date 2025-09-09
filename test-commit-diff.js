#!/usr/bin/env node

/**
 * Test script to verify commit diff functionality
 */

const WebSocket = require('ws');

async function testCommitDiff() {
  console.log('🧪 Testing Commit Diff Functionality...');
  
  // First get the recent commits to find a commit hash
  const gitLogMessage = {
    type: 'git',
    id: 'test_git_log_' + Date.now(),
    data: {
      gitData: {
        operation: 'log',
        options: {
          count: 1
        }
      }
    }
  };

  try {
    const ws = new WebSocket('ws://localhost:3001/ws');
    let commitHash = null;
    
    ws.on('open', () => {
      console.log('\n✅ Connected to WebSocket server');
      console.log('📤 Getting recent commit...');
      ws.send(JSON.stringify(gitLogMessage));
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.type === 'git' && parsed.id === gitLogMessage.id) {
          console.log('📥 Received git log response');
          
          if (parsed.data?.gitData?.result && Array.isArray(parsed.data.gitData.result) && parsed.data.gitData.result.length > 0) {
            commitHash = parsed.data.gitData.result[0].hash;
            console.log('🎯 Found commit hash:', commitHash);
            
            // Now test the show operation
            const showMessage = {
              type: 'git',
              id: 'test_git_show_' + Date.now(),
              data: {
                gitData: {
                  operation: 'show',
                  options: {
                    commitHash: commitHash
                  }
                }
              }
            };
            
            console.log('📤 Requesting commit diff...');
            ws.send(JSON.stringify(showMessage));
          } else {
            console.log('❌ No commits found in response');
            ws.close();
          }
        } else if (parsed.type === 'git' && parsed.id.startsWith('test_git_show_')) {
          console.log('📥 Received commit diff response');
          
          if (parsed.data?.ok !== false && parsed.data?.gitData?.result) {
            const diffData = parsed.data.gitData.result;
            console.log('✅ Commit diff received!');
            console.log('Diff entries:', Array.isArray(diffData) ? diffData.length : 'single entry');
            
            if (Array.isArray(diffData) && diffData.length > 0) {
              console.log('First diff file:', diffData[0].file || 'unknown');
              console.log('Changes:', `+${diffData[0].additions || 0} -${diffData[0].deletions || 0}`);
            } else if (diffData && typeof diffData === 'object') {
              console.log('Single diff:', diffData.file || 'unknown');
            } else {
              console.log('⚠️  No changes in this commit (empty diff)');
            }
          } else {
            console.log('❌ Commit diff error:', parsed.data?.error || 'Unknown error');
          }
          
          ws.close();
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

testCommitDiff().catch(console.error);