/**
 * Tests for WebviewProvider server management functionality
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewProvider } from './provider';

suite('WebviewProvider Server Management Tests', () => {
    let provider: WebviewProvider;
    let mockExtensionUri: vscode.Uri;

    setup(() => {
        mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        provider = new WebviewProvider(mockExtensionUri);
    });

    teardown(() => {
        provider.dispose();
    });

    test('should initialize with server manager', () => {
        assert.ok(provider.serverManager, 'ServerManager should be initialized');
        assert.strictEqual(provider.serverManager.isRunning, false, 'Server should not be running initially');
    });

    test('should have server management methods', () => {
        assert.ok(typeof provider.startServer === 'function', 'startServer method should exist');
        assert.ok(typeof provider.stopServer === 'function', 'stopServer method should exist');
    });

    test('should get server status', () => {
        const status = provider.serverManager.getServerStatus();
        assert.ok(status, 'Should return server status');
        assert.strictEqual(status.isRunning, false, 'Server should not be running initially');
        assert.strictEqual(status.connectedClients, 0, 'Should have no connected clients initially');
    });
});