/**
 * Simple test to verify the Vue.js frontend builds and loads correctly
 */

const fs = require('fs');
const path = require('path');

function testVueFrontend() {
    console.log('🧪 Testing Vue.js Frontend...');
    
    const outputDir = path.join(__dirname, 'out', 'webview', 'vue-frontend');
    
    // Check if output directory exists
    if (!fs.existsSync(outputDir)) {
        console.error('❌ Vue.js output directory does not exist:', outputDir);
        return false;
    }
    
    // Check required files for Vue.js build
    const requiredFiles = [
        'index.html',
        'assets'  // Vite generates assets directory with hashed filenames
    ];
    
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
        const filePath = path.join(outputDir, file);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ Missing file/directory: ${file}`);
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
    
    if (!htmlContent.includes('<div id="app">')) {
        console.error('❌ HTML content does not include Vue.js app mount point');
        return false;
    }
    
    if (!htmlContent.includes('type="module"')) {
        console.error('❌ HTML does not reference ES modules');
        return false;
    }
    
    console.log('✅ Vue.js HTML content looks good');
    
    // Check assets directory
    const assetsPath = path.join(outputDir, 'assets');
    const assetsFiles = fs.readdirSync(assetsPath);
    
    const hasJsFile = assetsFiles.some(file => file.endsWith('.js'));
    const hasCssFile = assetsFiles.some(file => file.endsWith('.css'));
    
    if (!hasJsFile) {
        console.error('❌ No JavaScript files found in assets directory');
        return false;
    }
    
    if (!hasCssFile) {
        console.error('❌ No CSS files found in assets directory');
        return false;
    }
    
    console.log('✅ Vue.js assets look good');
    
    // Check for Vue.js specific content in JS files
    const jsFiles = assetsFiles.filter(file => file.endsWith('.js'));
    let foundVueContent = false;
    
    for (const jsFile of jsFiles) {
        const jsPath = path.join(assetsPath, jsFile);
        const jsContent = fs.readFileSync(jsPath, 'utf8');
        
        if (jsContent.includes('Vue') || jsContent.includes('createApp') || jsContent.includes('mount')) {
            foundVueContent = true;
            break;
        }
    }
    
    if (!foundVueContent) {
        console.error('❌ No Vue.js content found in JavaScript files');
        return false;
    }
    
    console.log('✅ Vue.js JavaScript content looks good');
    
    console.log('🎉 All tests passed! Vue.js frontend is ready.');
    return true;
}

// Run the test
if (require.main === module) {
    const success = testVueFrontend();
    process.exit(success ? 0 : 1);
}

module.exports = testVueFrontend;