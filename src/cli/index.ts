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

// Create the main CLI program
const program = new Command('kiro-cli')
  .description('Kiro CLI - Terminal, File System, Git, and Server Operations')
  .version('1.0.0');

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
