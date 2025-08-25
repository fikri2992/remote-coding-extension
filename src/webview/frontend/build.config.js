/**
 * Build Configuration for Unified Frontend
 * Handles copying and processing of frontend assets
 */

const fs = require('fs');
const path = require('path');

class UnifiedFrontendBuilder {
    constructor() {
        this.sourceDir = __dirname;
        this.outputDir = path.join(__dirname, '../../../out/webview/frontend');
    }

    async build() {
        console.log('🔨 Building Unified Frontend...');
        
        try {
            // Ensure output directory exists
            await this.ensureDirectory(this.outputDir);
            
            // Copy HTML file
            await this.copyFile('index.html');
            
            // Copy JavaScript files
            await this.copyDirectory('js');
            
            // Copy CSS files
            await this.copyDirectory('styles');
            
            // Copy assets
            await this.copyDirectory('assets');
            
            console.log('✅ Unified Frontend build completed successfully');
            
        } catch (error) {
            console.error('❌ Unified Frontend build failed:', error);
            throw error;
        }
    }

    async ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    async copyFile(fileName) {
        const sourcePath = path.join(this.sourceDir, fileName);
        const targetPath = path.join(this.outputDir, fileName);
        
        if (fs.existsSync(sourcePath)) {
            await this.ensureDirectory(path.dirname(targetPath));
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`📄 Copied ${fileName}`);
        }
    }

    async copyDirectory(dirName) {
        const sourceDir = path.join(this.sourceDir, dirName);
        const targetDir = path.join(this.outputDir, dirName);
        
        if (fs.existsSync(sourceDir)) {
            await this.copyDirectoryRecursive(sourceDir, targetDir);
            console.log(`📁 Copied ${dirName}/`);
        }
    }

    async copyDirectoryRecursive(source, target) {
        await this.ensureDirectory(target);
        
        const items = fs.readdirSync(source);
        
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);
            
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                await this.copyDirectoryRecursive(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }
}

// Export for use in build scripts
module.exports = UnifiedFrontendBuilder;

// Run build if called directly
if (require.main === module) {
    const builder = new UnifiedFrontendBuilder();
    builder.build().catch(error => {
        console.error('Build failed:', error);
        process.exit(1);
    });
}