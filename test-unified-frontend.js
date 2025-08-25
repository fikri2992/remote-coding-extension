/**
 * Simple test to verify the unified frontend builds and loads correctly
 */

const fs = require('fs');
const path = require('path');

function testUnifiedFrontend() {
    console.log('🧪 Testing Unified Frontend...');
    
    const outputDir = path.join(__dirname, 'out', 'webview', 'frontend');
    
    // Check if output directory exists
    if (!fs.existsSync(outputDir)) {
        console.error('❌ Output directory does not exist:', outputDir);
        return false;
    }
    
    // Check required files
    const requiredFiles = [
        'index.html',
        'js/main.js',
        'js/services/WebAutomationService.js',
        'js/components/AppShell.js',
        'js/components/WebAutomation.js',
        'styles/main.css',
        'styles/components.css'
    ];
    
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
        const filePath = path.join(outputDir, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Missing file: ${file}`);
            allFilesExist = false;
        } else {
            console.log(`✅ Found: ${file}`);
        }
    }
    
    if (!allFilesExist) {
        console.error('❌ Some required files are missing');
        return false;
    }
    
    // Check HTML content
    const htmlPath = path.join(outputDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    if (!htmlContent.includes('VS Code Web Automation')) {
        console.error('❌ HTML content does not include expected title');
        return false;
    }
    
    if (!htmlContent.includes('js/main.js')) {
        console.error('❌ HTML does not reference main.js');
        return false;
    }
    
    console.log('✅ HTML content looks good');
    
    // Check main.js content
    const mainJsPath = path.join(outputDir, 'js', 'main.js');
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
    
    if (!mainJsContent.includes('UnifiedWebApp')) {
        console.error('❌ main.js does not include UnifiedWebApp class');
        return false;
    }
    
    if (!mainJsContent.includes('WebAutomationService')) {
        console.error('❌ main.js does not import WebAutomationService');
        return false;
    }
    
    console.log('✅ main.js content looks good');
    
    // Check WebAutomationService
    const webAutomationPath = path.join(outputDir, 'js', 'services', 'WebAutomationService.js');
    const webAutomationContent = fs.readFileSync(webAutomationPath, 'utf8');
    
    if (!webAutomationContent.includes('class WebAutomationService')) {
        console.error('❌ WebAutomationService.js does not include class definition');
        return false;
    }
    
    if (!webAutomationContent.includes('handleExtensionMessage')) {
        console.error('❌ WebAutomationService does not include handleExtensionMessage method');
        return false;
    }
    
    console.log('✅ WebAutomationService looks good');
    
    // Check CSS
    const cssPath = path.join(outputDir, 'styles', 'components.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    
    if (!cssContent.includes('.web-automation')) {
        console.error('❌ components.css does not include web-automation styles');
        return false;
    }
    
    console.log('✅ CSS content looks good');
    
    console.log('🎉 All tests passed! Unified frontend is ready.');
    return true;
}

// Run the test
if (require.main === module) {
    const success = testUnifiedFrontend();
    process.exit(success ? 0 : 1);
}

module.exports = testUnifiedFrontend;