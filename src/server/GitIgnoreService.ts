/**
 * GitIgnoreService - Service for handling .gitignore pattern matching
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class GitIgnoreService {
    private gitignorePatterns: Map<string, string[]> = new Map();
    private globalGitignorePatterns: string[] = [];

    constructor() {
        this.loadGlobalGitignore();
    }

    /**
     * Load global gitignore patterns from global config
     */
    private async loadGlobalGitignore(): Promise<void> {
        try {
            // Load user's global .gitignore if it exists
            const homeDir = require('os').homedir();
            const globalGitignorePath = path.join(homeDir, '.gitignore_global');
            
            if (fs.existsSync(globalGitignorePath)) {
                const content = fs.readFileSync(globalGitignorePath, 'utf8');
                this.globalGitignorePatterns = this.parseGitignoreContent(content);
            }
        } catch (error) {
            console.warn('Failed to load global gitignore:', error);
        }
    }

    /**
     * Load .gitignore file for a specific directory
     */
    public async loadGitignoreForDirectory(dirPath: string): Promise<string[]> {
        const gitignorePath = path.join(dirPath, '.gitignore');
        
        try {
            if (fs.existsSync(gitignorePath)) {
                const content = fs.readFileSync(gitignorePath, 'utf8');
                const patterns = this.parseGitignoreContent(content);
                this.gitignorePatterns.set(dirPath, patterns);
                return patterns;
            }
        } catch (error) {
            console.warn(`Failed to load gitignore for ${dirPath}:`, error);
        }
        
        return [];
    }

    /**
     * Parse .gitignore file content into patterns
     */
    private parseGitignoreContent(content: string): string[] {
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
                // Remove empty lines and comments
                return line && !line.startsWith('#');
            })
            .map(line => {
                // Handle negation patterns
                if (line.startsWith('!')) {
                    return line;
                }
                
                // Normalize paths for cross-platform compatibility
                return line.replace(/\\/g, '/');
            });
    }

    /**
     * Check if a file path should be ignored based on .gitignore rules
     */
    public isIgnored(filePath: string, workspaceRoot: string): boolean {
        // Normalize the file path relative to workspace root
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        
        // Check global gitignore patterns first
        if (this.matchesPatterns(relativePath, this.globalGitignorePatterns)) {
            return true;
        }

        // Check patterns from all parent directories
        let currentDir = path.dirname(filePath);
        
        while (currentDir && currentDir !== workspaceRoot && currentDir !== path.dirname(currentDir)) {
            const patterns = this.gitignorePatterns.get(currentDir);
            if (patterns) {
                const relativeToGitignore = path.relative(currentDir, filePath).replace(/\\/g, '/');
                if (this.matchesPatterns(relativeToGitignore, patterns)) {
                    return true;
                }
            }
            currentDir = path.dirname(currentDir);
        }

        // Check root .gitignore
        const rootPatterns = this.gitignorePatterns.get(workspaceRoot);
        if (rootPatterns && this.matchesPatterns(relativePath, rootPatterns)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a path matches any of the given patterns
     */
    private matchesPatterns(filePath: string, patterns: string[]): boolean {
        const fileName = path.basename(filePath);
        const dirPath = path.dirname(filePath);
        
        for (const pattern of patterns) {
            // Handle negation patterns (patterns starting with !)
            if (pattern.startsWith('!')) {
                const positivePattern = pattern.substring(1);
                if (this.matchPattern(filePath, positivePattern) || 
                    this.matchPattern(fileName, positivePattern)) {
                    return false; // Explicitly not ignored
                }
                continue;
            }

            // Check if pattern matches
            if (this.matchPattern(filePath, pattern) || 
                this.matchPattern(fileName, pattern)) {
                return true;
            }

            // Check directory patterns
            if (pattern.endsWith('/') && dirPath.includes(pattern.slice(0, -1))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Match a single pattern against a file path using glob-like matching
     */
    private matchPattern(filePath: string, pattern: string): boolean {
        // Handle exact matches
        if (filePath === pattern) {
            return true;
        }

        // Handle directory patterns
        if (pattern.endsWith('/')) {
            const dirPattern = pattern.slice(0, -1);
            return filePath === dirPattern || filePath.startsWith(dirPattern + '/');
        }

        // Convert glob pattern to regex
        const regexPattern = this.globToRegex(pattern);
        const regex = new RegExp(regexPattern);
        
        return regex.test(filePath) || regex.test(path.basename(filePath));
    }

    /**
     * Convert glob pattern to regex
     */
    private globToRegex(pattern: string): string {
        // Escape special regex characters except glob wildcards
        let regex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '###DOUBLESTAR###')
            .replace(/\*/g, '[^/]*')
            .replace(/###DOUBLESTAR###/g, '.*')
            .replace(/\?/g, '[^/]');

        // Handle leading/trailing slashes
        if (pattern.startsWith('/')) {
            regex = '^' + regex.substring(1);
        } else {
            regex = '(^|/)' + regex;
        }

        if (pattern.endsWith('/')) {
            regex += '($|/)';
        } else {
            regex += '$';
        }

        return regex;
    }

    /**
     * Get all .gitignore patterns for a workspace
     */
    public async loadAllGitignorePatterns(workspaceRoot: string): Promise<void> {
        // Clear existing patterns for this workspace
        for (const [dir] of this.gitignorePatterns) {
            if (dir.startsWith(workspaceRoot)) {
                this.gitignorePatterns.delete(dir);
            }
        }

        // Load .gitignore files recursively
        await this.loadGitignoreRecursively(workspaceRoot);
    }

    /**
     * Recursively load .gitignore files from all directories
     */
    private async loadGitignoreRecursively(dirPath: string): Promise<void> {
        try {
            // Load .gitignore for current directory
            await this.loadGitignoreForDirectory(dirPath);

            // Get subdirectories (but don't traverse ignored directories)
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const subDirPath = path.join(dirPath, entry.name);
                    
                    // Skip common ignore patterns
                    if (entry.name === '.git' || 
                        entry.name === 'node_modules' || 
                        entry.name === '.vscode' ||
                        entry.name.startsWith('.') && entry.name !== '.github') {
                        continue;
                    }

                    // Recursively load gitignore files
                    await this.loadGitignoreRecursively(subDirPath);
                }
            }
        } catch (error) {
            // Ignore permission errors and continue
            console.warn(`Failed to load gitignore patterns from ${dirPath}:`, error);
        }
    }

    /**
     * Clear all loaded patterns
     */
    public clearPatterns(): void {
        this.gitignorePatterns.clear();
    }

    /**
     * Get patterns for debugging
     */
    public getLoadedPatterns(): Map<string, string[]> {
        return new Map(this.gitignorePatterns);
    }
}