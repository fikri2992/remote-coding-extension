/**
 * Integration Test for Enhanced UI with Web Automation Tunnel
 * This test verifies that the enhanced UI can properly integrate with the existing infrastructure
 */

import * as vscode from 'vscode';
import { WebviewProvider } from './webview/provider';

export async function runIntegrationTest(): Promise<boolean> {
    console.log('🧪 Starting Enhanced UI Integration Test...');
    
    try {
        // Test 1: Verify configuration can be read
        const config = vscode.workspace.getConfiguration('webAutomationTunnel');
        const useEnhancedUI = config.get('useEnhancedUI', true);
        console.log(`✅ Configuration test passed - Enhanced UI: ${useEnhancedUI}`);
        
        // Test 2: Verify webview provider can be created
        const extensionUri = vscode.Uri.file(__dirname);
        const webviewProvider = new WebviewProvider(extensionUri);
        console.log('✅ WebviewProvider creation test passed');
        
        // Test 3: Verify server manager is accessible
        const serverManager = webviewProvider.serverManager;
        const serverStatus = serverManager.getServerStatus();
        console.log(`✅ ServerManager test passed - Running: ${serverStatus.isRunning}`);
        
        // Test 4: Test configuration toggle
        const originalValue = config.get('useEnhancedUI', true);
        await config.update('useEnhancedUI', !originalValue, vscode.ConfigurationTarget.Workspace);
        const newValue = config.get('useEnhancedUI', true);
        await config.update('useEnhancedUI', originalValue, vscode.ConfigurationTarget.Workspace);
        
        if (newValue !== originalValue) {
            console.log('✅ Configuration toggle test passed');
        } else {
            throw new Error('Configuration toggle failed');
        }
        
        // Test 5: Verify enhanced message protocol interfaces exist
        const interfaces = await import('./server/interfaces');
        if (interfaces && typeof interfaces === 'object') {
            console.log('✅ Enhanced message protocol interfaces test passed');
        }
        
        console.log('🎉 All integration tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Integration test failed:', error);
        return false;
    }
}

// Export test function for use in extension
export function registerIntegrationTestCommand(context: vscode.ExtensionContext) {
    const testCommand = vscode.commands.registerCommand('webAutomationTunnel.runIntegrationTest', async () => {
        const success = await runIntegrationTest();
        
        if (success) {
            vscode.window.showInformationMessage('✅ Enhanced UI Integration Test passed!');
        } else {
            vscode.window.showErrorMessage('❌ Enhanced UI Integration Test failed. Check console for details.');
        }
    });
    
    context.subscriptions.push(testCommand);
}