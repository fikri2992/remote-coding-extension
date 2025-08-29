/**
 * Demonstration script for real-time state synchronization
 * This script shows how the enhanced state synchronization works
 */

import { CommandHandler, StateChangeEvent } from './CommandHandler';
import { WebSocketServer } from './WebSocketServer';
import { ServerConfig } from './interfaces';

/**
 * Demo class to showcase state synchronization features
 */
export class StateSynchronizationDemo {
    private commandHandler: CommandHandler;
    private webSocketServer: WebSocketServer;
    private config: ServerConfig;

    constructor() {
        this.config = {
            httpPort: 8080,
            allowedOrigins: ['*'],
            maxConnections: 10,
            enableCors: true
        };

        this.commandHandler = new CommandHandler();
        this.webSocketServer = new WebSocketServer(this.config);
    }

    /**
     * Demonstrate state change event handling
     */
    demonstrateStateChangeEvents(): void {
        console.log('\n=== State Synchronization Demo ===\n');

        // Set up state change callback to show how events are handled
        this.commandHandler.setStateChangeCallback((event: StateChangeEvent) => {
            console.log(`📡 State Change Event Received:`);
            console.log(`   Type: ${event.type}`);
            console.log(`   Timestamp: ${event.timestamp.toISOString()}`);
            console.log(`   Incremental: ${event.incremental}`);
            console.log(`   Data:`, JSON.stringify(event.data, null, 2));
            console.log('');
        });

        console.log('✅ State change callback configured');
        console.log('📊 Current workspace state:');
        
        const workspaceState = this.commandHandler.getWorkspaceState();
        console.log(JSON.stringify(workspaceState, null, 2));
        console.log('');

        // Demonstrate full state broadcast
        console.log('🔄 Broadcasting full state...');
        this.commandHandler.broadcastFullState();
    }

    /**
     * Demonstrate WebSocket server capabilities
     */
    demonstrateWebSocketCapabilities(): void {
        console.log('\n=== WebSocket Server Capabilities ===\n');

        console.log(`🌐 Server Configuration:`);
        console.log(`   HTTP Port: ${this.config.httpPort}`);
        console.log(`   WebSocket Port: ${this.config.websocketPort || this.config.httpPort + 1}`);
        console.log(`   Max Connections: ${this.config.maxConnections}`);
        console.log(`   CORS Enabled: ${this.config.enableCors}`);
        console.log('');

        console.log(`📊 Server Status:`);
        console.log(`   Running: ${this.webSocketServer.isRunning}`);
        console.log(`   State Version: ${this.webSocketServer.stateVersion}`);
        console.log(`   Connected Clients: ${this.webSocketServer.clientCount}`);
        console.log('');

        const clientInfo = this.webSocketServer.getEnhancedClientInfo();
        console.log(`👥 Enhanced Client Info: ${clientInfo.length} clients`);
        
        if (clientInfo.length > 0) {
            clientInfo.forEach((client: any, index: number) => {
                console.log(`   Client ${index + 1}:`);
                console.log(`     ID: ${client.id}`);
                console.log(`     Connected: ${client.connectedAt.toISOString()}`);
                console.log(`     Incremental Updates: ${client.incrementalUpdates}`);
                console.log(`     Preferences:`, client.statePreferences);
            });
        }
        console.log('');
    }

    /**
     * Demonstrate command validation and execution
     */
    async demonstrateCommandHandling(): Promise<void> {
        console.log('\n=== Command Handling Demo ===\n');

        const testCommands = [
            'workbench.action.files.newUntitledFile',
            'workbench.action.toggleSidebarVisibility',
            'dangerous.command.not.allowed',
            '',
            'editor.action.formatDocument'
        ];

        console.log('🔍 Testing command validation:');
        
        for (const command of testCommands) {
            const validation = this.commandHandler.validateCommand(command);
            const status = validation.isValid ? '✅' : '❌';
            console.log(`   ${status} "${command}": ${validation.isValid ? 'Valid' : validation.reason}`);
        }
        console.log('');

        console.log('⚡ Testing command execution:');
        
        // Test a safe command
        const safeCommand = 'workbench.action.files.newUntitledFile';
        try {
            const result = await this.commandHandler.executeCommand(safeCommand);
            console.log(`   ✅ "${safeCommand}": ${result.success ? 'Success' : 'Failed - ' + result.error}`);
        } catch (error) {
            console.log(`   ❌ "${safeCommand}": Exception - ${error}`);
        }

        // Test an invalid command
        const invalidCommand = 'dangerous.command';
        try {
            const result = await this.commandHandler.executeCommand(invalidCommand);
            console.log(`   ❌ "${invalidCommand}": ${result.success ? 'Success' : 'Failed - ' + result.error}`);
        } catch (error) {
            console.log(`   ❌ "${invalidCommand}": Exception - ${error}`);
        }
        console.log('');
    }

    /**
     * Show allowed commands
     */
    showAllowedCommands(): void {
        console.log('\n=== Allowed Commands ===\n');
        
        const allowedCommands = this.commandHandler.getAllowedCommands();
        console.log(`📋 Total allowed commands: ${allowedCommands.length}`);
        console.log('');
        
        // Group commands by category
        const categories: { [key: string]: string[] } = {};
        
        allowedCommands.forEach(command => {
            const parts = command.split('.');
            const category = parts[0] || 'other';
            
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category]!.push(command);
        });

        Object.keys(categories).sort().forEach(category => {
            console.log(`📁 ${category.toUpperCase()}:`);
            categories[category]!.forEach(command => {
                console.log(`   • ${command}`);
            });
            console.log('');
        });
    }

    /**
     * Run the complete demonstration
     */
    async runDemo(): Promise<void> {
        console.log('🚀 Starting State Synchronization Demonstration...');
        
        try {
            this.demonstrateStateChangeEvents();
            this.demonstrateWebSocketCapabilities();
            await this.demonstrateCommandHandling();
            this.showAllowedCommands();
            
            console.log('✅ State Synchronization Demo completed successfully!');
            console.log('\n📝 Key Features Demonstrated:');
            console.log('   • Real-time state change event handling');
            console.log('   • Incremental state updates with throttling');
            console.log('   • Enhanced client connection tracking');
            console.log('   • Command validation and secure execution');
            console.log('   • WebSocket server state management');
            console.log('   • Client preference configuration');
            console.log('');
            
        } catch (error) {
            console.error('❌ Demo failed:', error);
        } finally {
            this.cleanup();
        }
    }

    /**
     * Clean up resources
     */
    private cleanup(): void {
        console.log('🧹 Cleaning up resources...');
        this.commandHandler.dispose();
        
        if (this.webSocketServer.isRunning) {
            this.webSocketServer.stop().catch(console.error);
        }
    }
}

// Export function to run the demo
export function runStateSynchronizationDemo(): void {
    const demo = new StateSynchronizationDemo();
    demo.runDemo().catch(console.error);
}

// If this file is run directly, execute the demo
if (require.main === module) {
    runStateSynchronizationDemo();
}