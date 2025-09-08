/**
 * CLI Entry Point - Terminal and File System Commands Integration
 */

import { Command } from 'commander';
import { filesystemCommand } from './commands/filesystem';
import { terminalCommand } from './commands/terminal';

// Create the main CLI program
const program = new Command('kiro-cli')
  .description('Kiro CLI - Terminal and File System Operations')
  .version('1.0.0');

// Add filesystem command group
program.addCommand(filesystemCommand);

// Add terminal command group
program.addCommand(terminalCommand);

// Export for use in main application
export { program as cliProgram };

// If this file is run directly, execute the CLI
if (require.main === module) {
  program.parse();
}
