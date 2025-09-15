#!/usr/bin/env node
/**
 * CLI Entry Point - Terminal, File System, and Git Commands Integration
 */

import { Command } from 'commander';
import { filesystemCommand } from './commands/filesystem';
import { terminalCommand } from './commands/terminal';
import { gitCommand } from './commands/git';
import { serverCommand } from './commands/server';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
import { statusCommand } from './commands/status';
import { initCommand } from './commands/init';

// Note: Keep version in sync with package.json
const VERSION = '0.0.1';

// Create the main CLI program
const program = new Command('cotg-cli')
  .description('Coding on the Go CLI - Terminal, File System, Git, and Server Operations')
  .version(VERSION);

// Add filesystem command group
program.addCommand(filesystemCommand);

// Add terminal command group
program.addCommand(terminalCommand);

// Add git command group
program.addCommand(gitCommand);

// Add server command group
program.addCommand(serverCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(initCommand);

// Export for use in main application
export { program as cliProgram };

// If this file is run directly, execute the CLI
if (require.main === module) {
  program.parse();
}
