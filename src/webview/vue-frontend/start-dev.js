#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vue Frontend Development Server...');
console.log('📍 URL: http://localhost:8080');
console.log('🔧 Port: 8080 (configured for your setup)');
console.log('');

// Start the Vite dev server
const viteProcess = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

viteProcess.on('error', (error) => {
  console.error('❌ Failed to start dev server:', error);
  process.exit(1);
});

viteProcess.on('close', (code) => {
  console.log(`\n🛑 Dev server stopped with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping dev server...');
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping dev server...');
  viteProcess.kill('SIGTERM');
});