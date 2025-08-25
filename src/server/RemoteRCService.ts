/**
 * RemoteRCService - Manages .remoterc folder and prompt persistence
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PromptRecord, RemoteRCStructure } from './interfaces';

export class RemoteRCService {
    private _remoteRCPath: string | null = null;
    private _config: RemoteRCStructure['config'] = {
        defaultCategory: 'general',
        autoSave: true,
        maxHistoryDays: 30
    };

    constructor() {
        this.initializeRemoteRCPath();
    }

    /**
     * Initialize .remoterc path based on current workspace
     */
    private async initializeRemoteRCPath(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspaceRoot = workspaceFolders[0].uri.fsPath;
                this._remoteRCPath = path.join(workspaceRoot, '.remoterc');
                
                // Ensure .remoterc directory exists
                await this.ensureRemoteRCDirectory();
                
                // Load or create configuration
                await this.loadConfiguration();
            }
        } catch (error) {
            console.error('Failed to initialize .remoterc path:', error);
        }
    }

    /**
     * Ensure .remoterc directory structure exists
     */
    private async ensureRemoteRCDirectory(): Promise<void> {
        if (!this._remoteRCPath) {
            throw new Error('RemoteRC path not initialized');
        }

        try {
            // Create main .remoterc directory
            await fs.mkdir(this._remoteRCPath, { recursive: true });
            
            // Create subdirectories
            const subdirs = ['prompts', 'categories', 'templates'];
            for (const subdir of subdirs) {
                await fs.mkdir(path.join(this._remoteRCPath, subdir), { recursive: true });
            }

            console.log(`Initialized .remoterc directory at: ${this._remoteRCPath}`);
        } catch (error) {
            console.error('Failed to create .remoterc directory:', error);
            throw error;
        }
    }

    /**
     * Load configuration from .remoterc/config.json
     */
    private async loadConfiguration(): Promise<void> {
        if (!this._remoteRCPath) return;

        try {
            const configPath = path.join(this._remoteRCPath, 'config.json');
            const configData = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configData);
            
            this._config = {
                ...this._config,
                ...config
            };
        } catch (error) {
            // Config doesn't exist, create default
            await this.saveConfiguration();
        }
    }

    /**
     * Save configuration to .remoterc/config.json
     */
    private async saveConfiguration(): Promise<void> {
        if (!this._remoteRCPath) return;

        try {
            const configPath = path.join(this._remoteRCPath, 'config.json');
            await fs.writeFile(configPath, JSON.stringify(this._config, null, 2));
        } catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }

    /**
     * Save prompt to .remoterc folder
     */
    async savePrompt(content: string, category?: string, tags: string[] = []): Promise<PromptRecord> {
        if (!this._remoteRCPath) {
            throw new Error('RemoteRC not initialized');
        }

        try {
            const timestamp = new Date();
            const promptId = this.generatePromptId();
            const dateFolder = this.formatDateForFolder(timestamp);
            const fileName = this.generatePromptFileName(timestamp, promptId);
            
            // Ensure date folder exists
            const dateFolderPath = path.join(this._remoteRCPath, 'prompts', dateFolder);
            await fs.mkdir(dateFolderPath, { recursive: true });
            
            // Create prompt file path
            const filePath = path.join(dateFolderPath, fileName);
            const relativeFilePath = path.join('prompts', dateFolder, fileName);
            
            // Create prompt record
            const promptRecord: PromptRecord = {
                id: promptId,
                content,
                timestamp,
                category: category || this._config.defaultCategory,
                tags,
                filePath: relativeFilePath,
                favorite: false,
                executionCount: 1,
                lastUsed: timestamp
            };

            // Create prompt file content with metadata
            const promptFileContent = this.createPromptFileContent(promptRecord);
            
            // Save prompt file
            await fs.writeFile(filePath, promptFileContent);
            
            // Update category index
            await this.updateCategoryIndex(promptRecord.category, relativeFilePath);
            
            console.log(`Saved prompt to: ${relativeFilePath}`);
            return promptRecord;
        } catch (error) {
            console.error('Failed to save prompt:', error);
            throw error;
        }
    }

    /**
     * Get prompt history
     */
    async getPromptHistory(days?: number): Promise<PromptRecord[]> {
        if (!this._remoteRCPath) {
            return [];
        }

        try {
            const promptsPath = path.join(this._remoteRCPath, 'prompts');
            const prompts: PromptRecord[] = [];
            
            // Get all date folders
            const dateFolders = await fs.readdir(promptsPath, { withFileTypes: true });
            const sortedFolders = dateFolders
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .sort()
                .reverse(); // Most recent first

            // Limit by days if specified
            const cutoffDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

            for (const dateFolder of sortedFolders) {
                if (cutoffDate && new Date(dateFolder) < cutoffDate) {
                    break;
                }

                const dateFolderPath = path.join(promptsPath, dateFolder);
                const promptFiles = await fs.readdir(dateFolderPath);
                
                for (const promptFile of promptFiles) {
                    if (promptFile.endsWith('.md')) {
                        try {
                            const promptPath = path.join(dateFolderPath, promptFile);
                            const promptRecord = await this.loadPromptRecord(promptPath);
                            if (promptRecord) {
                                prompts.push(promptRecord);
                            }
                        } catch (error) {
                            console.warn(`Failed to load prompt ${promptFile}:`, error);
                        }
                    }
                }
            }

            return prompts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            console.error('Failed to get prompt history:', error);
            return [];
        }
    }

    /**
     * Search prompts by content, category, or tags
     */
    async searchPrompts(query: string, category?: string, tags?: string[]): Promise<PromptRecord[]> {
        const allPrompts = await this.getPromptHistory();
        const searchRegex = new RegExp(query, 'i');

        return allPrompts.filter(prompt => {
            // Filter by category if specified
            if (category && prompt.category !== category) {
                return false;
            }

            // Filter by tags if specified
            if (tags && tags.length > 0) {
                const hasMatchingTag = tags.some(tag => 
                    prompt.tags.some(promptTag => promptTag.toLowerCase().includes(tag.toLowerCase()))
                );
                if (!hasMatchingTag) {
                    return false;
                }
            }

            // Search in content
            return searchRegex.test(prompt.content) || 
                   searchRegex.test(prompt.category || '') ||
                   prompt.tags.some(tag => searchRegex.test(tag));
        });
    }

    /**
     * Get prompts by category
     */
    async getPromptsByCategory(category: string): Promise<PromptRecord[]> {
        const allPrompts = await this.getPromptHistory();
        return allPrompts.filter(prompt => prompt.category === category);
    }

    /**
     * Get all categories
     */
    async getCategories(): Promise<string[]> {
        if (!this._remoteRCPath) {
            return [];
        }

        try {
            const categoriesPath = path.join(this._remoteRCPath, 'categories', 'index.json');
            const categoriesData = await fs.readFile(categoriesPath, 'utf-8');
            const categories = JSON.parse(categoriesData);
            return Object.keys(categories);
        } catch (error) {
            return [this._config.defaultCategory];
        }
    }

    /**
     * Update prompt usage statistics
     */
    async updatePromptUsage(promptId: string): Promise<void> {
        try {
            const prompts = await this.getPromptHistory();
            const prompt = prompts.find(p => p.id === promptId);
            
            if (prompt && this._remoteRCPath) {
                prompt.executionCount++;
                prompt.lastUsed = new Date();
                
                const fullPath = path.join(this._remoteRCPath, prompt.filePath);
                const content = this.createPromptFileContent(prompt);
                await fs.writeFile(fullPath, content);
            }
        } catch (error) {
            console.error('Failed to update prompt usage:', error);
        }
    }

    /**
     * Toggle prompt favorite status
     */
    async togglePromptFavorite(promptId: string): Promise<boolean> {
        try {
            const prompts = await this.getPromptHistory();
            const prompt = prompts.find(p => p.id === promptId);
            
            if (prompt && this._remoteRCPath) {
                prompt.favorite = !prompt.favorite;
                
                const fullPath = path.join(this._remoteRCPath, prompt.filePath);
                const content = this.createPromptFileContent(prompt);
                await fs.writeFile(fullPath, content);
                
                return prompt.favorite;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to toggle prompt favorite:', error);
            return false;
        }
    }

    /**
     * Get .remoterc structure
     */
    async getRemoteRCStructure(): Promise<RemoteRCStructure> {
        const prompts = await this.getPromptHistory();
        const categories = await this.getCategories();
        
        // Group prompts by date
        const promptsByDate: { [date: string]: PromptRecord[] } = {};
        prompts.forEach(prompt => {
            const dateKey = this.formatDateForFolder(prompt.timestamp);
            if (!promptsByDate[dateKey]) {
                promptsByDate[dateKey] = [];
            }
            promptsByDate[dateKey].push(prompt);
        });

        // Create categories mapping
        const categoriesMapping: { [category: string]: string[] } = {};
        categories.forEach(category => {
            categoriesMapping[category] = prompts
                .filter(p => p.category === category)
                .map(p => p.filePath);
        });

        return {
            prompts: promptsByDate,
            categories: categoriesMapping,
            config: this._config
        };
    }

    /**
     * Update configuration
     */
    async updateConfiguration(key: keyof RemoteRCStructure['config'], value: any): Promise<void> {
        this._config[key] = value;
        await this.saveConfiguration();
    }

    /**
     * Generate unique prompt ID
     */
    private generatePromptId(): string {
        return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format date for folder name (YYYY-MM-DD)
     */
    private formatDateForFolder(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Generate prompt file name
     */
    private generatePromptFileName(timestamp: Date, promptId: string): string {
        const timeStr = timestamp.toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
        return `${timeStr}_${promptId}.md`;
    }

    /**
     * Create prompt file content with metadata
     */
    private createPromptFileContent(prompt: PromptRecord): string {
        const metadata = {
            id: prompt.id,
            timestamp: prompt.timestamp.toISOString(),
            category: prompt.category,
            tags: prompt.tags,
            favorite: prompt.favorite,
            executionCount: prompt.executionCount,
            lastUsed: prompt.lastUsed?.toISOString()
        };

        return `---
${Object.entries(metadata)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}
---

${prompt.content}
`;
    }

    /**
     * Load prompt record from file
     */
    private async loadPromptRecord(filePath: string): Promise<PromptRecord | null> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const [frontMatter, ...contentParts] = content.split('---\n');
            
            if (contentParts.length < 2) {
                return null;
            }

            const metadata: any = {};
            frontMatter.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(': ');
                if (key && valueParts.length > 0) {
                    try {
                        metadata[key] = JSON.parse(valueParts.join(': '));
                    } catch {
                        metadata[key] = valueParts.join(': ');
                    }
                }
            });

            const promptContent = contentParts.slice(1).join('---\n').trim();
            const relativePath = path.relative(this._remoteRCPath!, filePath).replace(/\\/g, '/');

            return {
                id: metadata.id || this.generatePromptId(),
                content: promptContent,
                timestamp: new Date(metadata.timestamp || Date.now()),
                category: metadata.category || this._config.defaultCategory,
                tags: metadata.tags || [],
                filePath: relativePath,
                favorite: metadata.favorite || false,
                executionCount: metadata.executionCount || 1,
                lastUsed: metadata.lastUsed ? new Date(metadata.lastUsed) : undefined
            };
        } catch (error) {
            console.error(`Failed to load prompt record from ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Update category index
     */
    private async updateCategoryIndex(category: string, filePath: string): Promise<void> {
        if (!this._remoteRCPath) return;

        try {
            const categoriesPath = path.join(this._remoteRCPath, 'categories', 'index.json');
            let categories: { [category: string]: string[] } = {};

            try {
                const categoriesData = await fs.readFile(categoriesPath, 'utf-8');
                categories = JSON.parse(categoriesData);
            } catch {
                // File doesn't exist, start with empty categories
            }

            if (!categories[category]) {
                categories[category] = [];
            }

            if (!categories[category].includes(filePath)) {
                categories[category].push(filePath);
            }

            await fs.writeFile(categoriesPath, JSON.stringify(categories, null, 2));
        } catch (error) {
            console.error('Failed to update category index:', error);
        }
    }

    /**
     * Get .remoterc path
     */
    get remoteRCPath(): string | null {
        return this._remoteRCPath;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // No resources to dispose currently
    }
}