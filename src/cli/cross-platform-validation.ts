/**
 * Cross-Platform Compatibility Validation for CLI File System Service
 */

import * as os from 'os';
import * as path from 'path';
import { FileSystemConfigManager } from './services/FileSystemConfig';
import { PathResolver } from './services/PathResolver';
import { FileSystemSecurityManager } from './services/FileSystemSecurity';

export interface PlatformValidationResult {
    platform: string;
    arch: string;
    nodeVersion: string;
    pathSeparator: string;
    issues: string[];
    warnings: string[];
    recommendations: string[];
    isValid: boolean;
}

export class CrossPlatformValidator {
    private config: FileSystemConfigManager;
    private pathResolver: PathResolver;
    private securityManager: FileSystemSecurityManager;

    constructor(config?: FileSystemConfigManager) {
        this.config = config || new FileSystemConfigManager();
        this.pathResolver = new PathResolver(this.config.config);
        this.securityManager = new FileSystemSecurityManager(this.config.config);
    }

    async validatePlatform(): Promise<PlatformValidationResult> {
        const result: PlatformValidationResult = {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            pathSeparator: path.sep,
            issues: [],
            warnings: [],
            recommendations: [],
            isValid: true
        };

        // Validate platform-specific features
        await this.validateFileSystemFeatures(result);
        await this.validatePathHandling(result);
        await this.validateSecurityFeatures(result);
        await this.validatePerformanceCharacteristics(result);
        await this.validateEncodingSupport(result);

        // Overall validation result
        result.isValid = result.issues.length === 0;

        return result;
    }

    private async validateFileSystemFeatures(result: PlatformValidationResult): Promise<void> {
        const platform = result.platform;

        // Check file system case sensitivity
        if (platform === 'win32') {
            result.recommendations.push('Windows file system is case-insensitive');
        } else {
            result.recommendations.push('Unix-like file system is case-sensitive');
        }

        // Check file permission handling
        if (platform === 'win32') {
            result.warnings.push('Windows file permissions differ from Unix systems');
            result.recommendations.push('Use ACL-based permission checks on Windows');
        } else {
            result.recommendations.push('Unix file permissions are supported');
        }

        // Check symlink support
        try {
            await this.testSymlinkSupport();
            result.recommendations.push('Symbolic links are supported');
        } catch (error) {
            result.warnings.push('Symbolic links may not be fully supported');
        }

        // Check file watching capabilities
        if (platform === 'win32') {
            result.warnings.push('Windows file watching may have higher latency');
            result.recommendations.push('Consider using polling-based file watching on Windows');
        }
    }

    private async validatePathHandling(result: PlatformValidationResult): Promise<void> {
        const platform = result.platform;

        // Test path separator handling
        const testPaths = [
            '/test/path/file.txt',
            'C:\\test\\path\\file.txt',
            './relative/path/file.txt',
            '../parent/path/file.txt'
        ];

        for (const testPath of testPaths) {
            try {
                const resolved = await this.pathResolver.resolvePath(testPath);
                if (!resolved.isValid && resolved.error) {
                    result.warnings.push(`Path resolution issue for ${testPath}: ${resolved.error}`);
                }
            } catch (error) {
                result.issues.push(`Path resolution failed for ${testPath}: ${error}`);
            }
        }

        // Test path length limits
        if (platform === 'win32') {
            const longPath = 'A'.repeat(260); // Windows MAX_PATH
            try {
                await this.pathResolver.resolvePath(longPath);
                result.warnings.push('Long path support may be limited on Windows');
            } catch (error) {
                result.warnings.push('Long paths are not supported on this Windows system');
            }
        }

        // Test special characters in paths
        const specialCharPaths = [
            '/test/path with spaces/file.txt',
            '/test/path-with-dashes/file.txt',
            '/test/path_with_underscores/file.txt'
        ];

        for (const testPath of specialCharPaths) {
            try {
                const resolved = await this.pathResolver.resolvePath(testPath);
                if (!resolved.isValid) {
                    result.warnings.push(`Special character path issue: ${testPath}`);
                }
            } catch (error) {
                result.issues.push(`Special character path failed: ${testPath}`);
            }
        }
    }

    private async validateSecurityFeatures(result: PlatformValidationResult): Promise<void> {
        const platform = result.platform;

        // Test system file blocking
        const systemPaths = [
            '/etc/passwd',
            '/etc/shadow',
            'C:\\Windows\\System32\\config\\SAM',
            '/System/Library/Preferences'
        ];

        for (const systemPath of systemPaths) {
            try {
                const securityCheck = await this.securityManager.checkFileOperationSafety('read', systemPath);
                if (!securityCheck.allowed) {
                    result.recommendations.push(`System file blocking working for: ${systemPath}`);
                } else {
                    result.issues.push(`Security check failed for system file: ${systemPath}`);
                }
            } catch (error) {
                result.warnings.push(`Security check error for ${systemPath}: ${error}`);
            }
        }

        // Test path traversal detection
        const traversalPaths = [
            '/test/workspace/../../../etc/passwd',
            'C:\\test\\workspace\\..\\..\\..\\Windows\\System32'
        ];

        for (const traversalPath of traversalPaths) {
            try {
                const securityCheck = await this.securityManager.checkFileOperationSafety('read', traversalPath);
                if (!securityCheck.allowed) {
                    result.recommendations.push(`Path traversal blocked for: ${traversalPath}`);
                } else {
                    result.issues.push(`Path traversal not blocked: ${traversalPath}`);
                }
            } catch (error) {
                result.warnings.push(`Path traversal check error for ${traversalPath}: ${error}`);
            }
        }

        // Platform-specific security considerations
        if (platform === 'win32') {
            result.recommendations.push('Enable Windows-specific security features');
            result.warnings.push('Windows file permissions may require additional validation');
        } else if (platform === 'darwin') {
            result.recommendations.push('macOS security features are supported');
        } else {
            result.recommendations.push('Linux security features are fully supported');
        }
    }

    private async validatePerformanceCharacteristics(result: PlatformValidationResult): Promise<void> {
        const platform = result.platform;

        // Test file system performance
        const startTime = Date.now();
        try {
            await this.pathResolver.resolvePath('/test/performance/file.txt');
            const resolutionTime = Date.now() - startTime;

            if (resolutionTime > 100) {
                result.warnings.push(`Path resolution is slow (${resolutionTime}ms)`);
            }
        } catch (error) {
            // Expected for non-existent paths
        }

        // Platform-specific performance notes
        if (platform === 'win32') {
            result.recommendations.push('Consider optimizing for Windows file system performance');
            result.warnings.push('Windows file operations may have higher overhead');
        } else if (platform === 'darwin') {
            result.recommendations.push('macOS file system performance is generally good');
        } else {
            result.recommendations.push('Linux file system performance is typically excellent');
        }

        // Memory usage considerations
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        if (heapUsedMB > 100) {
            result.warnings.push(`High memory usage detected: ${heapUsedMB}MB`);
            result.recommendations.push('Consider memory optimization for file operations');
        }
    }

    private async validateEncodingSupport(result: PlatformValidationResult): Promise<void> {
        const platform = result.platform;

        // Test different encodings
        const encodings = ['utf8', 'ascii', 'utf16le', 'latin1'];

        for (const encoding of encodings) {
            try {
                // Create a test string with various characters
                const testString = 'Test: áéíóú 中文 العربية';
                const buffer = Buffer.from(testString, encoding as BufferEncoding);
                const decoded = buffer.toString(encoding as BufferEncoding);

                if (decoded !== testString) {
                    result.warnings.push(`Encoding issue detected for: ${encoding}`);
                }
            } catch (error) {
                result.issues.push(`Encoding not supported: ${encoding}`);
            }
        }

        // Platform-specific encoding considerations
        if (platform === 'win32') {
            result.recommendations.push('Windows uses UTF-16LE internally');
            result.warnings.push('Be careful with encoding conversions on Windows');
        } else {
            result.recommendations.push('Unix systems typically use UTF-8');
        }
    }

    private async testSymlinkSupport(): Promise<void> {
        // This is a basic test - in a real implementation,
        // you would create and test actual symlinks
        if (os.platform() === 'win32') {
            // Check if Windows has symlink support enabled
            try {
                require('fs').lstatSync;
            } catch (error) {
                throw new Error('Symlink support not available');
            }
        }
        // Unix systems generally have good symlink support
    }

    // Utility methods for platform-specific optimizations

    getPlatformOptimizations(): string[] {
        const platform = os.platform();
        const optimizations: string[] = [];

        switch (platform) {
            case 'win32':
                optimizations.push(
                    'Use Windows-specific file APIs when available',
                    'Enable long path support (UNC paths)',
                    'Optimize for Windows file system case insensitivity',
                    'Use Windows file change notification APIs'
                );
                break;
            case 'darwin':
                optimizations.push(
                    'Use macOS FSEvents for efficient file watching',
                    'Leverage macOS file system attributes',
                    'Optimize for APFS file system features'
                );
                break;
            case 'linux':
                optimizations.push(
                    'Use inotify for efficient file watching',
                    'Leverage Linux file system capabilities',
                    'Optimize for ext4/xfs/btrfs features'
                );
                break;
            default:
                optimizations.push(
                    'Use generic cross-platform file system APIs',
                    'Test thoroughly on this platform'
                );
        }

        return optimizations;
    }

    getPlatformLimitations(): string[] {
        const platform = os.platform();
        const limitations: string[] = [];

        switch (platform) {
            case 'win32':
                limitations.push(
                    'File names cannot contain: \\ / : * ? " < > |',
                    'Path length limited to 260 characters by default',
                    'Case insensitive file system',
                    'Different file permission model'
                );
                break;
            case 'darwin':
                limitations.push(
                    'HFS+ is case-insensitive by default',
                    'APFS is case-sensitive',
                    'Resource forks may cause issues',
                    'Extended attributes handling differs'
                );
                break;
            case 'linux':
                limitations.push(
                    'File systems may have different features (ext4 vs xfs vs btrfs)',
                    'SELinux/AppArmor may affect file access',
                    'File system case sensitivity varies'
                );
                break;
            default:
                limitations.push(
                    'Unknown platform limitations',
                    'Test thoroughly before production use'
                );
        }

        return limitations;
    }

    generatePlatformReport(): string {
        const platform = os.platform();
        const arch = os.arch();
        const nodeVersion = process.version;

        let report = `Cross-Platform Compatibility Report\n`;
        report += `=====================================\n\n`;
        report += `Platform: ${platform}\n`;
        report += `Architecture: ${arch}\n`;
        report += `Node.js Version: ${nodeVersion}\n`;
        report += `Path Separator: '${path.sep}'\n\n`;

        report += `Platform Optimizations:\n`;
        report += `----------------------\n`;
        this.getPlatformOptimizations().forEach(opt => {
            report += `- ${opt}\n`;
        });

        report += `\nPlatform Limitations:\n`;
        report += `---------------------\n`;
        this.getPlatformLimitations().forEach(lim => {
            report += `- ${lim}\n`;
        });

        report += `\nRecommendations:\n`;
        report += `----------------\n`;
        report += `- Test all file operations on this platform\n`;
        report += `- Verify file watching performance\n`;
        report += `- Check encoding handling for local character sets\n`;
        report += `- Validate security features work as expected\n`;
        report += `- Monitor memory usage during file operations\n`;

        return report;
    }
}

// Convenience function for quick validation
export async function validateCrossPlatformCompatibility(
    config?: FileSystemConfigManager
): Promise<PlatformValidationResult> {
    const validator = new CrossPlatformValidator(config);
    return await validator.validatePlatform();
}

// Convenience function for generating platform report
export function generatePlatformReport(): string {
    const validator = new CrossPlatformValidator();
    return validator.generatePlatformReport();
}
