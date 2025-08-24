/**
 * Build Configuration for Enhanced Web Frontend
 * Simple build configuration for modern JavaScript/TypeScript compilation
 */

export const buildConfig = {
    // Input/Output paths
    input: {
        js: 'src/webview/enhanced-frontend/js',
        styles: 'src/webview/enhanced-frontend/styles',
        assets: 'src/webview/enhanced-frontend/assets'
    },
    output: {
        base: 'out/webview/enhanced-frontend',
        js: 'out/webview/enhanced-frontend/js',
        styles: 'out/webview/enhanced-frontend/styles',
        assets: 'out/webview/enhanced-frontend/assets'
    },
    
    // Build options
    options: {
        // Use ES6 modules (native browser support)
        moduleFormat: 'es6',
        
        // Target modern browsers (VS Code webview)
        target: 'es2020',
        
        // Minification (disabled for development)
        minify: false,
        
        // Source maps for debugging
        sourceMaps: true,
        
        // Bundle splitting
        splitChunks: false,
        
        // Asset optimization
        optimizeAssets: true
    },
    
    // File patterns
    patterns: {
        js: '**/*.js',
        css: '**/*.css',
        html: '**/*.html',
        assets: '**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}'
    },
    
    // Development server (for standalone testing)
    devServer: {
        port: 3000,
        host: 'localhost',
        open: false,
        hot: true
    }
};

export default buildConfig;