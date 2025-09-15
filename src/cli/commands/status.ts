import { Command } from 'commander';
import { CliServer } from '../server';
import { ProcessManager } from '../services/ProcessManager';

export const statusCommand = new Command('status')
  .description('Show cotg-cli server status')
  .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
  .option('-j, --json', 'Output status in JSON format')
  .action(async (options) => {
    try {
      // Get process status first
      const processStatus = await ProcessManager.getServerStatus();
      
      if (processStatus.isRunning && processStatus.info) {
        if (options.json) {
          console.log(JSON.stringify({
            process: processStatus,
            server: new CliServer(processStatus.info.configPath).getStatus()
          }, null, 2));
        } else {
          console.log('🟢 cotg-cli Server Status');
          console.log('================================');
          console.log(`📁 Config: ${processStatus.info.configPath}`);
          console.log(`🌐 Port: ${processStatus.info.port}`);
          console.log(`📋 PID: ${processStatus.info.pid}`);
          console.log(`⏱️  Uptime: ${processStatus.uptime}`);
          console.log(`🕒 Started: ${new Date(processStatus.info.startTime).toLocaleString()}`);
          console.log(`🖥️  Platform: ${processStatus.info.platform}`);
          console.log(`🔧 Node.js: ${processStatus.info.nodeVersion}`);
          console.log('================================');
        }
      } else {
        if (options.json) {
          console.log(JSON.stringify({
            process: processStatus,
            server: new CliServer(options.config).getStatus()
          }, null, 2));
        } else {
          console.log('❌ Server is not running');
        }
      }
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });
