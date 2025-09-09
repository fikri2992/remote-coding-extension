import { Command } from 'commander';
import { CliServer } from '../server';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export const serverCommand = new Command('server')
    .description('Build React frontend and start the Kiro Remote WebSocket server')
    .option('-p, --port <number>', 'Port number for the web server', '3900')
    .option('-c, --config <path>', 'Path to config file', '.on-the-go/config.json')
    .option('--skip-build', 'Skip React frontend build', false)
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
            // Build React frontend unless skipped
            if (!options.skipBuild) {
                console.log('🔨 Building React frontend...');

                // Check if React frontend directory exists
                const frontendDir = path.join(process.cwd(), 'src', 'webview', 'react-frontend');
                try {
                    await fs.access(frontendDir);
                } catch {
                    console.error('❌ React frontend directory not found:', frontendDir);
                    process.exit(1);
                }

                // Build the React frontend
                try {
                    execSync('cd src/webview/react-frontend && npm run build', {
                        stdio: 'inherit',
                        cwd: process.cwd()
                    });
                    console.log('✅ React frontend built successfully');
                } catch (error) {
                    console.error('❌ Failed to build React frontend:', error);
                    process.exit(1);
                }
            } else {
                console.log('⏭️  Skipping React frontend build');
            }

            // Start the WebSocket server
            console.log('🚀 Starting WebSocket server...');
            await server.start({
                port: parseInt(options.port),
                config: options.config
            });

            console.log('');
            console.log('🎉 All services started successfully!');
            console.log(`📱 Web interface: http://localhost:${options.port}`);
            console.log('🔧 WebSocket: Connected');
            console.log('');
            console.log('Press Ctrl+C to stop all services');

            // Keep the process alive
            // The server will run until interrupted

        } catch (error) {
            console.error('❌ Failed to start services:', error);
            process.exit(1);
        }
    });
