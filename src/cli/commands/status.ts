import { Command } from 'commander';
import { CliServer } from '../server';

export const statusCommand = new Command('status')
  .description('Show Kiro Remote server status')
  .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
  .option('-j, --json', 'Output status in JSON format')
  .action(async (options) => {
    const server = new CliServer(options.config);
    
    try {
      if (options.json) {
        const status = server.getStatus();
        console.log(JSON.stringify(status, null, 2));
      } else {
        server.printStatus();
      }
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });