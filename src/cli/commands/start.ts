import { Command } from 'commander';
import { CliServer } from '../server';

export const startCommand = new Command('start')
  .description('Start the Kiro Remote server')
  .option('-p, --port <number>', 'Port number for the web server', '3900')
  .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
  .action(async (options) => {
    const server = new CliServer(options.config);
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down server...');
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Set up signal handlers
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGQUIT', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown();
    });

    try {
      await server.start({ 
        port: parseInt(options.port),
        config: options.config 
      });
      
      // Keep the process alive
      // The server will run until interrupted
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  });