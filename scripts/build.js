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
    process.exit(1);
  }
}

function main() {
  const target = process.argv[2] || 'all';

  console.log('Building cotg-cli...');

  // Clean
  console.log('Cleaning...');
  run('npm run clean');

  // Build agent first
  console.log('Building ACP agent (workspace)...');
  run('npm run build:agent || echo "Agent build failed, continuing..."');

  // Compile TypeScript
  console.log('Compiling TypeScript...');
  run('npm run compile');

  // Build React frontend
  console.log('Building React frontend...');
  run('npm run build:react');

  if (target === 'cli' || target === 'all') {
    console.log('Packaging CLI binaries...');
    run('npm run package:cli');
  }

  console.log('Build complete!');
}

if (require.main === module) {
  main();
}

module.exports = { run };
