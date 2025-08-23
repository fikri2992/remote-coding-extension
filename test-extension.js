// Simple test script to verify extension package.json configuration
const fs = require('fs');
const path = require('path');

console.log('🧪 Basic VSCode Extension - Configuration Test');
console.log('='.repeat(50));

// Test 1: Verify package.json exists and is valid
try {
    const packagePath = path.join(__dirname, 'package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    console.log('✅ package.json is valid JSON');
    console.log(`   Name: ${packageJson.name}`);
    console.log(`   Version: ${packageJson.version}`);
    console.log(`   Main: ${packageJson.main}`);
} catch (error) {
    console.log('❌ package.json error:', error.message);
}

// Test 2: Verify compiled extension exists
try {
    const compiledPath = path.join(__dirname, 'out', 'extension.js');
    if (fs.existsSync(compiledPath)) {
        console.log('✅ Compiled extension.js exists');
        const stats = fs.statSync(compiledPath);
        console.log(`   Size: ${stats.size} bytes`);
        console.log(`   Modified: ${stats.mtime.toISOString()}`);
    } else {
        console.log('❌ Compiled extension.js not found');
    }
} catch (error) {
    console.log('❌ Error checking compiled extension:', error.message);
}

// Test 3: Verify SVG icon exists
try {
    const iconPath = path.join(__dirname, 'src', 'assets', 'icon.svg');
    if (fs.existsSync(iconPath)) {
        console.log('✅ SVG icon exists');
        const iconContent = fs.readFileSync(iconPath, 'utf8');
        if (iconContent.includes('<svg')) {
            console.log('   ✅ Valid SVG format');
        } else {
            console.log('   ❌ Invalid SVG format');
        }
    } else {
        console.log('❌ SVG icon not found');
    }
} catch (error) {
    console.log('❌ Error checking SVG icon:', error.message);
}

// Test 4: Verify HTML panel exists
try {
    const htmlPath = path.join(__dirname, 'src', 'webview', 'panel.html');
    if (fs.existsSync(htmlPath)) {
        console.log('✅ HTML panel exists');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        if (htmlContent.includes('executeActionBtn')) {
            console.log('   ✅ Contains execute action button');
        } else {
            console.log('   ❌ Missing execute action button');
        }
    } else {
        console.log('❌ HTML panel not found');
    }
} catch (error) {
    console.log('❌ Error checking HTML panel:', error.message);
}

// Test 5: Verify TypeScript source files
const sourceFiles = [
    'src/extension.ts',
    'src/webview/provider.ts',
    'src/commands/buttonCommands.ts'
];

sourceFiles.forEach(file => {
    try {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file} exists`);
        } else {
            console.log(`❌ ${file} not found`);
        }
    } catch (error) {
        console.log(`❌ Error checking ${file}:`, error.message);
    }
});

console.log('='.repeat(50));
console.log('🎯 Configuration test complete!');
console.log('');
console.log('Next steps:');
console.log('1. Open VSCode development host: code --extensionDevelopmentPath=. --new-window');
console.log('2. Follow the manual testing checklist in MANUAL_TESTING_CHECKLIST.md');
console.log('3. Verify all functionality works as expected');