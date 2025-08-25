/**
 * Template Loader Utility
 * Handles dynamic loading and injection of HTML templates
 */

class TemplateLoader {
    constructor() {
        this.templateCache = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Load and inject a template into a target element
     * @param {string} templatePath - Path to the template file
     * @param {string|HTMLElement} target - Target element ID or element
     * @param {boolean} cache - Whether to cache the template
     * @returns {Promise<void>}
     */
    async loadTemplate(templatePath, target, cache = true) {
        try {
            // Get target element
            const targetElement = typeof target === 'string' 
                ? document.getElementById(target) 
                : target;
            
            if (!targetElement) {
                throw new Error(`Target element not found: ${target}`);
            }

            // Check cache first
            if (cache && this.templateCache.has(templatePath)) {
                targetElement.innerHTML = this.templateCache.get(templatePath);
                return;
            }

            // Check if already loading
            if (this.loadingPromises.has(templatePath)) {
                const html = await this.loadingPromises.get(templatePath);
                targetElement.innerHTML = html;
                return;
            }

            // Load template
            const loadPromise = this.fetchTemplate(templatePath);
            this.loadingPromises.set(templatePath, loadPromise);

            const html = await loadPromise;
            
            // Cache if requested
            if (cache) {
                this.templateCache.set(templatePath, html);
            }

            // Inject into target
            targetElement.innerHTML = html;
            
            // Clean up loading promise
            this.loadingPromises.delete(templatePath);

        } catch (error) {
            console.error(`Failed to load template ${templatePath}:`, error);
            this.loadingPromises.delete(templatePath);
            throw error;
        }
    }

    /**
     * Fetch template content from server
     * @param {string} templatePath - Path to template file
     * @returns {Promise<string>}
     */
    async fetchTemplate(templatePath) {
        const response = await fetch(templatePath);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
        }
        
        return await response.text();
    }

    /**
     * Load the Basic UI template
     * @returns {Promise<void>}
     */
    async loadBasicUI() {
        await this.loadTemplate('./templates/basic-ui.html', 'basicApp');
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
    }

    /**
     * Get cache size
     * @returns {number}
     */
    getCacheSize() {
        return this.templateCache.size;
    }
}

// Create global instance
window.templateLoader = new TemplateLoader();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemplateLoader;
}