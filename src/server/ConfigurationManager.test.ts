/**
 * Tests for ConfigurationManager
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager } from './ConfigurationManager';

suite('ConfigurationManager Tests', () => {
    let configManager: ConfigurationManager;

    setup(() => {
        configManager = new ConfigurationManager();
    });

    teardown(() => {
        configManager.dispose();
    });

    test('should load default configuration', async () => {
        const config = await configManager.loadConfiguration();
        
        assert.strictEqual(typeof config.httpPort, 'number');
        assert.ok(config.httpPort >= 1024 && config.httpPort <= 65535);
        assert.ok(Array.isArray(config.allowedOrigins));
        assert.strictEqual(typeof config.enableCors, 'boolean');
        assert.strictEqual(typeof config.maxConnections, 'number');
    });

    test('should validate port ranges', async () => {
        try {
            await configManager.updateConfiguration('httpPort', 80);
            assert.fail('Should have thrown error for invalid port');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('must be at least 1024'));
        }
    });

    test('should validate max connections range', async () => {
        try {
            await configManager.updateConfiguration('maxConnections', 0);
            assert.fail('Should have thrown error for invalid max connections');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('must be at least 1'));
        }
    });

    test('should validate allowed origins array', async () => {
        try {
            await configManager.updateConfiguration('allowedOrigins', []);
            assert.fail('Should have thrown error for empty origins array');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('At least one allowed origin'));
        }
    });

    test('should get configuration schema', () => {
        const schema = configManager.getConfigurationSchema();
        
        assert.ok(schema.httpPort);
        assert.strictEqual(schema.httpPort.type, 'number');
        assert.strictEqual(schema.httpPort.minimum, 1024);
        assert.strictEqual(schema.httpPort.maximum, 65535);
        
        assert.ok(schema.allowedOrigins);
        assert.strictEqual(schema.allowedOrigins.type, 'array');
        
        assert.ok(schema.enableCors);
        assert.strictEqual(schema.enableCors.type, 'boolean');
    });

    test('should handle unknown configuration keys', async () => {
        try {
            await configManager.updateConfiguration('unknownKey', 'value');
            assert.fail('Should have thrown error for unknown key');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Unknown configuration key'));
        }
    });
});