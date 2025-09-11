#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';

function run(command, options = {}) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Failed to run: ${command}`);
    process.exit(1);
  }
}

function copyFiles(src, dest) {
  if (isWindows) {
    run(`xcopy /E /I /Y "${src}" "${dest}"`);
  } else {
    run(`cp -r "${src}" "${dest}"`);
  }
}

function main() {
  const target = process.argv[2] || 'all';
  
  console.log('🏗️  Building Kiro Remote...');
  
  // Clean
  console.log('🧹 Cleaning...');
  run('npm run clean');
  
  // Build agent first
  console.log('🤖 Building ACP agent...');
  run('npm run build:agent || echo "Agent build failed, continuing..."');
  
  // Compile TypeScript
  console.log('📦 Compiling TypeScript...');
  run('npm run compile');
  
  // Copy assets
  console.log('📋 Copying assets...');
  run('npm run copy-assets');
  
  // Build React frontend
  console.log('⚛️  Building React frontend...');
  run('npm run build:react:prod');
  
  // Copy React dist
  console.log('📁 Copying React dist...');
  run('npm run copy-react-dist');
  
  if (target === 'extension' || target === 'all') {
    console.log('📦 Packaging VSCode extension...');
    run('npm run package:extension');
  }
  
  if (target === 'cli' || target === 'all') {
    console.log('🖥️  Packaging CLI binaries...');
    run('npm run package:cli');
  }
  
  console.log('✅ Build complete!');
}

if (require.main === module) {
  main();
}

module.exports = { run, copyFiles };