#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command, options = {}) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Failed to run: ${command}`);
    console.error('Continuing with setup...');
  }
}

function main() {
  console.log('🚀 Setting up cotg-cli for development...');
  
  // Install root dependencies
  console.log('📦 Installing root dependencies...');
  run('npm install');
  
  // Install frontend dependencies
  console.log('⚛️  Installing React frontend dependencies...');
  const frontendPath = 'src/webview/react-frontend';
  if (fs.existsSync(frontendPath)) {
    run('npm install', { cwd: frontendPath });
  } else {
    console.log('❌ React frontend directory not found');
  }
  
  // Install agent dependencies
  console.log('🤖 Installing ACP agent dependencies...');
  const agentPath = 'claude-code-acp';
  if (fs.existsSync(agentPath)) {
    run('npm install', { cwd: agentPath });
    run('npm run build', { cwd: agentPath });
  } else {
    console.log('❌ ACP agent directory not found');
  }
  
  // Initial build
  console.log('🏗️  Running initial build...');
  run('npm run build');
  
  console.log('✅ Development setup complete!');
  console.log('');
  console.log('🎯 Next steps:');
  console.log('  • Run "npm run dev:full" for full development mode');
  console.log('  • Run "npm run dev:server" for server-only development');
  console.log('  • Run "npm run dev:frontend" for frontend-only development');
  console.log('  • Run "npm run start:cli" to start the CLI server');
}

if (require.main === module) {
  main();
}
