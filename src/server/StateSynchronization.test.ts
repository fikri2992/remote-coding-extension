/**
 * Simple validation tests for real-time state synchronization functionality
 * Note: These are basic validation tests, not full unit tests with a testing framework
 */

import { CommandHandler, StateChangeEvent } from './CommandHandler';
import { WebSocketServer } from './WebSocketServer';
import { ServerConfig } from './interfaces';

/**
 * Simple test runner for State Synchronization
 */
export class StateSynchronizationTest {
    private commandHandler: CommandHandler;

    constructor() {
        this.commandHandler = new CommandHandler();
    }

    /**
     * Test state change callback functionality
     */
    testStateChangeCallback(): boolean {
        let callbackCalled = false;
        let receivedEvent: StateChangeEvent | null = null;

        // Set up callback
        this.commandHandler.setStateChangeCallback((event: StateChangeEvent) => {
            callbackCalled = true;
            receivedEvent = event;
        });

        // Trigger full state broadcast
        this.commandHandler.broadcastFullState();

        // Verify callback was called
        if (!callbackCalled) {
            console.error('State change callback was not called');
            return false;
        }

        if (!receivedEvent) {
            console.error('No event received in callback');
            return false;
        }

        // Verify event structure
        if (!receivedEvent || !receivedEvent.type || !receivedEvent.timestamp || !receivedEvent.data) {
            console.error('Invalid event structure received');
            return false;
        }

        console.log('✓ State change callback test passed');
        return true;
    }

    /**
     * Test workspace state retrieval
     */
    testWorkspaceState(): boolean {
        const workspaceState = this.commandHandler.getWorkspaceState();

        // Verify required properties exist
        if (!workspaceState.hasOwnProperty('workspaceFolders') ||
            !workspaceState.hasOwnProperty('openEditors') ||
            !workspaceState.hasOwnProperty('recentFiles')) {
            console.error('Workspace state missing required properties');
            return false;
        }

        // Verify types
        if (!Array.isArray(workspaceState.workspaceFolders) ||
            !Array.isArray(workspaceState.openEditors) ||
            !Array.isArray(workspaceState.recentFiles)) {
            console.error('Workspace state properties have incorrect types');
            return false;
        }

        console.log('✓ Workspace state test passed');
        return true;
    }

    /**
     * Test command validation
     */
    testCommandValidation(): boolean {
        // Test valid command
        const validResult = this.commandHandler.validateCommand('workbench.action.files.newUntitledFile');
        if (!validResult.isValid) {
            console.error('Valid command was rejected');
            return false;
        }

        // Test invalid command
        const invalidResult = this.commandHandler.validateCommand('dangerous.command');
        if (invalidResult.isValid) {
            console.error('Invalid command was accepted');
            return false;
        }

        // Test empty command
        const emptyResult = this.commandHandler.validateCommand('');
        if (emptyResult.isValid) {
            console.error('Empty command was accepted');
            return false;
        }

        console.log('✓ Command validation test passed');
        return true;
    }

    /**
     * Test incremental state updates
     */
    testIncrementalUpdates(): boolean {
        const incrementalUpdate = this.commandHandler.getIncrementalStateUpdate();
        
        // Current implementation returns null, which is expected
        if (incrementalUpdate !== null) {
            console.error('Incremental update should return null in current implementation');
            return false;
        }

        console.log('✓ Incremental updates test passed');
        return true;
    }

    /**
     * Run all tests
     */
    runAllTests(): boolean {
        console.log('Running State Synchronization Tests...');
        
        const tests = [
            () => this.testStateChangeCallback(),
            () => this.testWorkspaceState(),
            () => this.testCommandValidation(),
            () => this.testIncrementalUpdates()
        ];

        let allPassed = true;
        for (const test of tests) {
            try {
                if (!test()) {
                    allPassed = false;
                }
            } catch (error) {
                console.error('Test failed with exception:', error);
                allPassed = false;
            }
        }

        if (allPassed) {
            console.log('✓ All State Synchronization tests passed');
        } else {
            console.log('✗ Some State Synchronization tests failed');
        }

        return allPassed;
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        this.commandHandler.dispose();
    }
}

/**
 * WebSocket Server State Broadcasting Tests
 */
export class WebSocketServerTest {
    private server: WebSocketServer;
    private config: ServerConfig;

    constructor() {
        this.config = {
            httpPort: 8080,
            allowedOrigins: ['*'],
            maxConnections: 10,
            enableCors: true
        };
        this.server = new WebSocketServer(this.config);
    }

    /**
     * Test server initialization
     */
    testServerInitialization(): boolean {
        // Test initial state
        if (this.server.stateVersion !== 0) {
            console.error('Server should initialize with state version 0');
            return false;
        }

        if (this.server.clientCount !== 0) {
            console.error('Server should initialize with 0 clients');
            return false;
        }

        if (this.server.isRunning) {
            console.error('Server should not be running initially');
            return false;
        }

        console.log('✓ Server initialization test passed');
        return true;
    }

    /**
     * Test enhanced client info
     */
    testEnhancedClientInfo(): boolean {
        const clientInfo = this.server.getEnhancedClientInfo();
        
        if (!Array.isArray(clientInfo)) {
            console.error('Enhanced client info should return an array');
            return false;
        }

        if (clientInfo.length !== 0) {
            console.error('Should have no clients initially');
            return false;
        }

        console.log('✓ Enhanced client info test passed');
        return true;
    }

    /**
     * Test force state synchronization
     */
    testForceStateSynchronization(): boolean {
        try {
            // Should not throw when no clients are connected
            this.server.forceStateSynchronization();
            
            // Test client-specific synchronization
            const result = this.server.forceClientStateSynchronization('non-existent-client');
            if (result !== false) {
                console.error('Should return false for non-existent client');
                return false;
            }

            console.log('✓ Force state synchronization test passed');
            return true;
        } catch (error) {
            console.error('Force state synchronization should not throw:', error);
            return false;
        }
    }

    /**
     * Run all WebSocket server tests
     */
    runAllTests(): boolean {
        console.log('Running WebSocket Server Tests...');
        
        const tests = [
            () => this.testServerInitialization(),
            () => this.testEnhancedClientInfo(),
            () => this.testForceStateSynchronization()
        ];

        let allPassed = true;
        for (const test of tests) {
            try {
                if (!test()) {
                    allPassed = false;
                }
            } catch (error) {
                console.error('Test failed with exception:', error);
                allPassed = false;
            }
        }

        if (allPassed) {
            console.log('✓ All WebSocket Server tests passed');
        } else {
            console.log('✗ Some WebSocket Server tests failed');
        }

        return allPassed;
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.server.isRunning) {
            await this.server.stop();
        }
    }
}

// Export test runner function for easy execution
export function runStateSynchronizationTests(): boolean {
    const commandHandlerTest = new StateSynchronizationTest();
    const webSocketServerTest = new WebSocketServerTest();

    let allPassed = true;

    try {
        if (!commandHandlerTest.runAllTests()) {
            allPassed = false;
        }

        if (!webSocketServerTest.runAllTests()) {
            allPassed = false;
        }
    } finally {
        // Clean up
        commandHandlerTest.cleanup();
        webSocketServerTest.cleanup().catch(console.error);
    }

    return allPassed;
}