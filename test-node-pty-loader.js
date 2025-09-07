/**
 * Test script for the smart node-pty loader
 * Run with: node test-node-pty-loader.js
 */

const path = require('path');

// Set debug mode
process.env.KIRO_DEBUG_TERMINAL = '1';

console.log('🧪 Testing node-pty smart loader...');
console.log(`Platform: ${process.platform}-${process.arch}`);
console.log('');

try {
  // Test the smart loader
  const nodePty = require('./vendor/node-pty/index.js');
  
  if (nodePty) {
    console.log('✅ node-pty loaded successfully!');
    console.log('Available functions:', Object.keys(nodePty));
    
    if (typeof nodePty.spawn === 'function') {
      console.log('✅ spawn function is available');
    } else {
      console.log('❌ spawn function is not available');
    }
    
    if (nodePty.platform && nodePty.arch) {
      console.log(`📋 Loaded from: ${nodePty.platform}-${nodePty.arch}`);
    }
  } else {
    console.log('⚠️  node-pty not available, will use fallback mode');
    console.log('This is expected if no prebuilt binaries are present');
  }
} catch (error) {
  console.error('❌ Error testing node-pty loader:', error.message);
}

console.log('');
console.log('🔍 Directory structure:');
const fs = require('fs');
const vendorPath = path.join(__dirname, 'vendor', 'node-pty');

try {
  const platforms = fs.readdirSync(vendorPath).filter(item => {
    const itemPath = path.join(vendorPath, item);
    return fs.statSync(itemPath).isDirectory();
  });
  
  platforms.forEach(platform => {
    const binaryPath = path.join(vendorPath, platform, 'build', 'Release', 'pty.node');
    const hasLoader = fs.existsSync(path.join(vendorPath, platform, 'index.cjs'));
    const hasBinary = fs.existsSync(binaryPath);
    
    console.log(`  ${platform}:`);
    console.log(`    Loader: ${hasLoader ? '✅' : '❌'}`);
    console.log(`    Binary: ${hasBinary ? '✅' : '❌ (PLACE pty.node HERE)'}`);
  });
} catch (error) {
  console.error('Error reading vendor directory:', error.message);
}

console.log('');
console.log('📝 Next steps:');
console.log('1. Place prebuilt pty.node binaries in the appropriate directories');
console.log('2. Restart VS Code to load the new smart loader');
console.log('3. Test terminal functionality in the web interface');