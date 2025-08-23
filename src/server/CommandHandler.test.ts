/**
 * Basic tests for CommandHandler functionality
 * Note: These are simple validation tests, not full unit tests with a testing framework
 */

import { CommandHandler } from './CommandHandler';

/**
 * Simple test runner for CommandHandler
 */
export class CommandHandlerTest {
    private commandHandler: CommandHandler;

    constructor() {
        this.commandHandler = new CommandHandler();
    }

    /**
     * Test command validation
     */
    testCommandValidation(): boolean {
        console.log('Testing command validation...');

        // Test valid command
        const validResult = this.commandHandler.validateCommand('workbench.action.files.newUntitledFile');
        if (!validResult.isValid) {
            console.error('Valid command validation failed:', validResult.reason);
            return false;
        }

        // Test invalid command
        const invalidResult = this.commandHandler.validateCommand('dangerous.command.deleteEverything');
        if (invalidResult.isValid) {
            console.error('Invalid command validation should have failed');
            return false;
        }

        // Test empty command
        const emptyResult = this.commandHandler.validateCommand('');
        if (emptyResult.isValid) {
            console.error('Empty command validation should have failed');
            return false;
        }

        console.log('✓ Command validation tests passed');
        return true;
    }

    /**
     * Test allowed commands management
     */
    testAllowedCommandsManagement(): boolean {
        console.log('Testing allowed commands management...');

        const initialCount = this.commandHandler.getAllowedCommands().length;
        
        // Add a new command
        this.commandHandler.addAllowedCommand('test.command');
        const afterAddCount = this.commandHandler.getAllowedCommands().length;
        
        if (afterAddCount !== initialCount + 1) {
            console.error('Adding command failed');
            return false;
        }

        // Validate the new command is allowed
        const validationResult = this.commandHandler.validateCommand('test.command');
        if (!validationResult.isValid) {
            console.error('Added command should be valid');
            return false;
        }

        // Remove the command
        this.commandHandler.removeAllowedCommand('test.command');
        const afterRemoveCount = this.commandHandler.getAllowedCommands().length;
        
        if (afterRemoveCount !== initialCount) {
            console.error('Removing command failed');
            return false;
        }

        // Validate the command is no longer allowed
        const removedValidationResult = this.commandHandler.validateCommand('test.command');
        if (removedValidationResult.isValid) {
            console.error('Removed command should not be valid');
            return false;
        }

        console.log('✓ Allowed commands management tests passed');
        return true;
    }

    /**
     * Test workspace state collection
     */
    testWorkspaceStateCollection(): boolean {
        console.log('Testing workspace state collection...');

        try {
            const workspaceState = this.commandHandler.getWorkspaceState();
            
            // Validate structure
            if (!Array.isArray(workspaceState.workspaceFolders)) {
                console.error('workspaceFolders should be an array');
                return false;
            }

            if (!Array.isArray(workspaceState.openEditors)) {
                console.error('openEditors should be an array');
                return false;
            }

            if (!Array.isArray(workspaceState.recentFiles)) {
                console.error('recentFiles should be an array');
                return false;
            }

            // activeEditor is optional, but if present should have correct structure
            if (workspaceState.activeEditor) {
                if (typeof workspaceState.activeEditor.fileName !== 'string') {
                    console.error('activeEditor.fileName should be a string');
                    return false;
                }
                if (typeof workspaceState.activeEditor.language !== 'string') {
                    console.error('activeEditor.language should be a string');
                    return false;
                }
                if (typeof workspaceState.activeEditor.lineCount !== 'number') {
                    console.error('activeEditor.lineCount should be a number');
                    return false;
                }
            }

            console.log('✓ Workspace state collection tests passed');
            return true;
        } catch (error) {
            console.error('Workspace state collection failed:', error);
            return false;
        }
    }

    /**
     * Run all tests
     */
    runAllTests(): boolean {
        console.log('Running CommandHandler tests...\n');

        const tests = [
            this.testCommandValidation.bind(this),
            this.testAllowedCommandsManagement.bind(this),
            this.testWorkspaceStateCollection.bind(this)
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
            console.log(''); // Add spacing between tests
        }

        if (allPassed) {
            console.log('🎉 All CommandHandler tests passed!');
        } else {
            console.log('❌ Some CommandHandler tests failed');
        }

        return allPassed;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.commandHandler.dispose();
    }
}

// Export for potential use in other test files
export function runCommandHandlerTests(): boolean {
    const tester = new CommandHandlerTest();
    const result = tester.runAllTests();
    tester.dispose();
    return result;
}