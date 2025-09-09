#!/usr/bin/env node

/**
 * Test script to verify path resolution fix
 */

const WebSocket = require('ws');

async function testPathResolution() {
  console.log('🧪 Testing Path Resolution Fix...');
  
  const testPaths = [
    '/',
    '/package.json',
    '/src',
    '/src/cli/server.ts',
    '/docs/fix-implementation-summary.md'
  ];

  try {
    const ws = new WebSocket('ws://localhost:3001/ws');
    let testIndex = 0;
    
    ws.on('open', () => {
      console.log('\n✅ Connected to WebSocket server');
      runNextTest();
    });

    function runNextTest() {
      if (testIndex >= testPaths.length) {
        console.log('\n🎉 All tests completed!');
        ws.close();
        return;
      }

      const testPath = testPaths[testIndex];
      const isFile = !testPath.endsWith('/') && testPath !== '/' && testPath.includes('.');
      const operation = isFile ? 'open' : 'tree';
      
      console.log(`\n📤 Testing path: ${testPath} (${operation})`);
      
      const message = {
        type: 'fileSystem',
        id: `test_${Date.now()}_${testIndex}`,
        data: {
          fileSystemData: {
            operation: operation,
            path: testPath
          }
        }
      };
      
      ws.send(JSON.stringify(message));
      testIndex++;
    }

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.type === 'fileSystem' && parsed.id.startsWith('test_')) {
          const success = parsed.data?.ok !== false;
          const operation = parsed.data?.operation;
          const error = parsed.data?.error;
          
          if (success) {
            console.log(`✅ ${operation} operation succeeded`);
            if (parsed.data?.result?.children) {
              console.log(`   Found ${parsed.data.result.children.length} items`);
            } else if (parsed.data?.result?.content !== undefined) {
              console.log(`   File content loaded (${parsed.data.result.content.length} chars)`);
            }
          } else {
            console.log(`❌ ${operation} operation failed: ${error}`);
          }
          
          // Run next test after a short delay
          setTimeout(runNextTest, 500);
        }
      } catch (e) {
        console.log('Raw response:', data.toString());
        setTimeout(runNextTest, 500);
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

testPathResolution().catch(console.error);