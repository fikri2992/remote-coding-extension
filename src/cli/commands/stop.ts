import { Command } from 'commander';
import { ProcessManager } from '../services/ProcessManager';

export const stopCommand = new Command('stop')
  .description('Stop the cotg-cli server')
  .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
  .action(async (options) => {
    try {
      const success = await ProcessManager.stopServerProcess();
      if (!success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to stop server:', error);
      process.exit(1);
    }
  });
