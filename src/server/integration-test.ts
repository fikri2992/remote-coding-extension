/**
 * Simple integration test for configuration management
 * This can be run manually to verify functionality
 */

import { ConfigurationManager } from './ConfigurationManager';
import { ServerManager } from './ServerManager';

async function testConfigurationManagement() {
    console.log('🧪 Testing Configuration Management...');
    
    const configManager = new ConfigurationManager();
    
    try {
        // Test 1: Load configuration
        console.log('📋 Test 1: Loading configuration...');
        const config = await configManager.loadConfiguration();
        console.log('✅ Configuration loaded:', config);
        
        // Test 2: Validate configuration schema
        console.log('📋 Test 2: Getting configuration schema...');
        const schema = configManager.getConfigurationSchema();
        console.log('✅ Schema retrieved:', Object.keys(schema));
        
        // Test 3: Test ServerManager with configuration
        console.log('📋 Test 3: Testing ServerManager integration...');
        const serverManager = new ServerManager();
        const serverConfig = serverManager.config;
        console.log('✅ ServerManager config:', serverConfig);
        
        // Test 4: Test configuration validation
        console.log('📋 Test 4: Testing configuration validation...');
        try {
            await configManager.updateConfiguration('httpPort', 80);
            console.log('❌ Should have failed for invalid port');
        } catch (error) {
            console.log('✅ Port validation works:', (error as Error).message);
        }
        
        // Test 5: Test valid configuration update
        console.log('📋 Test 5: Testing valid configuration update...');
        try {
            await configManager.updateConfiguration('maxConnections', 5);
            console.log('✅ Valid configuration update successful');
        } catch (error) {
            console.log('❌ Valid configuration update failed:', (error as Error).message);
        }
        
        console.log('🎉 All configuration management tests completed!');
        
        // Cleanup
        configManager.dispose();
        serverManager.dispose();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        configManager.dispose();
    }
}

// Export for manual testing
export { testConfigurationManagement };

// Run if called directly
if (require.main === module) {
    testConfigurationManagement().catch(console.error);
}