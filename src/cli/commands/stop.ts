import { Command } from 'commander';
import { CliServer } from '../server';

export const stopCommand = new Command('stop')
  .description('Stop the Kiro Remote server')
  .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
  .action(async (options) => {
    const server = new CliServer(options.config);
    
    try {
      await server.stop();
    } catch (error) {
      console.error('❌ Failed to stop server:', error);
      process.exit(1);
    }
  });