// Button command implementations
import * as vscode from 'vscode';

export function registerButtonCommands(context: vscode.ExtensionContext) {
    // Register the main execute action command
    const executeActionCommand = vscode.commands.registerCommand(
        'basicExtension.executeAction',
        async (data?: any) => {
            try {
                console.log('Execute action command triggered with data:', data);
                
                // Execute workbench.action.focusAuxiliaryBar command
                await executeAuxiliaryBarFocus();
                
                // Execute expandLineSelection if text input has focus
                await executeExpandLineSelectionIfTextFocus();
                
                // Show success notification to user
                vscode.window.showInformationMessage('Action executed successfully!');
                
            } catch (error) {
                // Handle command execution errors and provide user feedback
                console.error('Error executing action command:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Failed to execute action: ${errorMessage}`);
            }
        }
    );

    // Add command to context subscriptions for proper cleanup
    context.subscriptions.push(executeActionCommand);
}

/**
 * Execute the workbench.action.focusAuxiliaryBar command
 */
async function executeAuxiliaryBarFocus(): Promise<void> {
    try {
        console.log('Executing workbench.action.focusAuxiliaryBar command');
        await vscode.commands.executeCommand('workbench.action.focusAuxiliaryBar');
        console.log('Successfully executed focusAuxiliaryBar command');
    } catch (error) {
        console.error('Error executing focusAuxiliaryBar command:', error);
        throw new Error(`Failed to focus auxiliary bar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Execute expandLineSelection command when text input has focus
 */
async function executeExpandLineSelectionIfTextFocus(): Promise<void> {
    try {
        // Check if there's an active text editor (indicates text input has focus)
        const activeEditor = vscode.window.activeTextEditor;
        
        if (activeEditor) {
            console.log('Text editor has focus, executing expandLineSelection command');
            await vscode.commands.executeCommand('expandLineSelection');
            console.log('Successfully executed expandLineSelection command');
        } else {
            console.log('No active text editor found, skipping expandLineSelection command');
        }
    } catch (error) {
        console.error('Error executing expandLineSelection command:', error);
        throw new Error(`Failed to expand line selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}