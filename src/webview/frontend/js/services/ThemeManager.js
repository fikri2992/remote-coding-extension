/**
 * Theme Manager Service
 * Handles VS Code theme integration and dynamic theme switching
 */

export class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.availableThemes = ['dark', 'light', 'high-contrast'];
        this.themeChangeListeners = new Set();
        
        // VS Code theme detection
        this.vsCodeThemeObserver = null;
        
        // Bind methods
        this.handleThemeChange = this.handleThemeChange.bind(this);
    }

    /**
     * Initialize the theme manager
     */
    async initialize() {
        // Detect initial theme
        this.detectInitialTheme();
        
        // Apply initial theme
        this.applyTheme(this.currentTheme);
        
        // Set up theme change detection
        this.setupThemeDetection();
        
        console.log('✅ ThemeManager initialized with theme:', this.currentTheme);
    }

    /**
     * Detect initial theme from various sources
     */
    detectInitialTheme() {
        // Try to detect from VS Code context
        const vsCodeTheme = this.detectVSCodeTheme();
        if (vsCodeTheme) {
            this.currentTheme = vsCodeTheme;
            return;
        }
        
        // Try to detect from system preference
        const systemTheme = this.detectSystemTheme();
        if (systemTheme) {
            this.currentTheme = systemTheme;
            return;
        }
        
        // Try to get from localStorage
        const savedTheme = localStorage.getItem('enhanced-web-frontend-theme');
        if (savedTheme && this.availableThemes.includes(savedTheme)) {
            this.currentTheme = savedTheme;
            return;
        }
        
        // Default to dark theme
        this.currentTheme = 'dark';
    }

    /**
     * Detect VS Code theme from CSS variables or body classes
     */
    detectVSCodeTheme() {
        // Check for VS Code theme classes on body
        const body = document.body;
        
        if (body.classList.contains('vscode-light')) {
            return 'light';
        } else if (body.classList.contains('vscode-high-contrast')) {
            return 'high-contrast';
        } else if (body.classList.contains('vscode-dark')) {
            return 'dark';
        }
        
        // Check CSS variables for theme detection
        const computedStyle = getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.getPropertyValue('--vscode-editor-background').trim();
        
        if (backgroundColor) {
            // Parse RGB values to determine if it's light or dark
            const rgb = this.parseColor(backgroundColor);
            if (rgb) {
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                return brightness > 128 ? 'light' : 'dark';
            }
        }
        
        return null;
    }

    /**
     * Detect system theme preference
     */
    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        
        return null;
    }

    /**
     * Set up theme change detection
     */
    setupThemeDetection() {
        // Watch for VS Code theme changes via MutationObserver
        this.vsCodeThemeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const newTheme = this.detectVSCodeTheme();
                    if (newTheme && newTheme !== this.currentTheme) {
                        this.setTheme(newTheme);
                    }
                }
            });
        });
        
        // Observe body class changes
        this.vsCodeThemeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Watch for system theme changes
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', (e) => {
                // Only auto-switch if no explicit theme is set
                const savedTheme = localStorage.getItem('enhanced-web-frontend-theme');
                if (!savedTheme) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
        
        // Watch for CSS variable changes (for VS Code theme updates)
        this.setupCSSVariableWatcher();
    }

    /**
     * Set up CSS variable watcher for theme changes
     */
    setupCSSVariableWatcher() {
        // Create a hidden element to watch for CSS variable changes
        const watcher = document.createElement('div');
        watcher.style.position = 'absolute';
        watcher.style.visibility = 'hidden';
        watcher.style.pointerEvents = 'none';
        watcher.id = 'theme-watcher';
        document.body.appendChild(watcher);
        
        // Watch for changes to key CSS variables
        let lastBackgroundColor = '';
        
        const checkThemeChange = () => {
            const computedStyle = getComputedStyle(watcher);
            const backgroundColor = computedStyle.getPropertyValue('--vscode-editor-background').trim();
            
            if (backgroundColor && backgroundColor !== lastBackgroundColor) {
                lastBackgroundColor = backgroundColor;
                
                const detectedTheme = this.detectVSCodeTheme();
                if (detectedTheme && detectedTheme !== this.currentTheme) {
                    this.setTheme(detectedTheme);
                }
            }
        };
        
        // Check periodically
        setInterval(checkThemeChange, 1000);
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        if (!this.availableThemes.includes(theme)) {
            console.warn(`Invalid theme: ${theme}`);
            return;
        }
        
        const previousTheme = this.currentTheme;
        this.currentTheme = theme;
        
        // Apply theme
        this.applyTheme(theme);
        
        // Save to localStorage
        localStorage.setItem('enhanced-web-frontend-theme', theme);
        
        // Notify listeners
        this.notifyThemeChange(theme, previousTheme);
        
        console.log(`🎨 Theme changed from ${previousTheme} to ${theme}`);
    }

    /**
     * Apply theme to the document
     */
    applyTheme(theme) {
        const body = document.body;
        
        // Remove existing theme classes
        this.availableThemes.forEach(t => {
            body.classList.remove(`vscode-theme-${t}`);
        });
        
        // Add new theme class
        body.classList.add(`vscode-theme-${theme}`);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
        
        // Apply theme-specific customizations
        this.applyThemeCustomizations(theme);
    }

    /**
     * Update meta theme-color for mobile browsers
     */
    updateMetaThemeColor(theme) {
        let themeColor = '#1e1e1e'; // Default dark
        
        switch (theme) {
            case 'light':
                themeColor = '#ffffff';
                break;
            case 'high-contrast':
                themeColor = '#000000';
                break;
            case 'dark':
            default:
                themeColor = '#1e1e1e';
                break;
        }
        
        // Update or create meta theme-color tag
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = themeColor;
    }

    /**
     * Apply theme-specific customizations
     */
    applyThemeCustomizations(theme) {
        // Add any theme-specific CSS customizations
        const customizations = this.getThemeCustomizations(theme);
        
        // Remove existing customization style
        const existingStyle = document.getElementById('theme-customizations');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Add new customizations
        if (customizations) {
            const style = document.createElement('style');
            style.id = 'theme-customizations';
            style.textContent = customizations;
            document.head.appendChild(style);
        }
    }

    /**
     * Get theme-specific CSS customizations
     */
    getThemeCustomizations(theme) {
        const customizations = {
            dark: `
                /* Dark theme customizations */
                .loading-spinner {
                    border-color: #3c3c3c;
                    border-top-color: #007acc;
                }
            `,
            light: `
                /* Light theme customizations */
                .loading-spinner {
                    border-color: #e1e1e1;
                    border-top-color: #007acc;
                }
            `,
            'high-contrast': `
                /* High contrast theme customizations */
                .loading-spinner {
                    border-color: #ffffff;
                    border-top-color: #f38518;
                }
                
                /* Enhanced borders for better visibility */
                .card, .input, .btn {
                    border-width: 2px !important;
                }
            `
        };
        
        return customizations[theme] || '';
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Get available themes
     */
    getAvailableThemes() {
        return [...this.availableThemes];
    }

    /**
     * Check if theme is dark
     */
    isDarkTheme() {
        return this.currentTheme === 'dark' || this.currentTheme === 'high-contrast';
    }

    /**
     * Check if theme is light
     */
    isLightTheme() {
        return this.currentTheme === 'light';
    }

    /**
     * Add theme change listener
     */
    addThemeChangeListener(listener) {
        if (typeof listener === 'function') {
            this.themeChangeListeners.add(listener);
        }
    }

    /**
     * Remove theme change listener
     */
    removeThemeChangeListener(listener) {
        this.themeChangeListeners.delete(listener);
    }

    /**
     * Notify theme change listeners
     */
    notifyThemeChange(newTheme, previousTheme) {
        this.themeChangeListeners.forEach(listener => {
            try {
                listener(newTheme, previousTheme);
            } catch (error) {
                console.error('Error in theme change listener:', error);
            }
        });
    }

    /**
     * Handle theme change event
     */
    handleThemeChange(event) {
        // This can be called by external theme change events
        if (event.detail && event.detail.theme) {
            this.setTheme(event.detail.theme);
        }
    }

    /**
     * Parse color string to RGB values
     */
    parseColor(colorStr) {
        // Handle hex colors
        if (colorStr.startsWith('#')) {
            const hex = colorStr.slice(1);
            if (hex.length === 3) {
                return {
                    r: parseInt(hex[0] + hex[0], 16),
                    g: parseInt(hex[1] + hex[1], 16),
                    b: parseInt(hex[2] + hex[2], 16)
                };
            } else if (hex.length === 6) {
                return {
                    r: parseInt(hex.slice(0, 2), 16),
                    g: parseInt(hex.slice(2, 4), 16),
                    b: parseInt(hex.slice(4, 6), 16)
                };
            }
        }
        
        // Handle rgb() colors
        const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            return {
                r: parseInt(rgbMatch[1]),
                g: parseInt(rgbMatch[2]),
                b: parseInt(rgbMatch[3])
            };
        }
        
        return null;
    }

    /**
     * Get theme colors for programmatic use
     */
    getThemeColors() {
        const computedStyle = getComputedStyle(document.documentElement);
        
        return {
            background: computedStyle.getPropertyValue('--vscode-editor-background').trim(),
            foreground: computedStyle.getPropertyValue('--vscode-foreground').trim(),
            primary: computedStyle.getPropertyValue('--vscode-button-background').trim(),
            secondary: computedStyle.getPropertyValue('--vscode-button-secondaryBackground').trim(),
            border: computedStyle.getPropertyValue('--vscode-panel-border').trim(),
            focus: computedStyle.getPropertyValue('--vscode-focusBorder').trim()
        };
    }

    /**
     * Destroy the theme manager
     */
    destroy() {
        // Disconnect mutation observer
        if (this.vsCodeThemeObserver) {
            this.vsCodeThemeObserver.disconnect();
            this.vsCodeThemeObserver = null;
        }
        
        // Remove theme watcher element
        const watcher = document.getElementById('theme-watcher');
        if (watcher) {
            watcher.remove();
        }
        
        // Clear listeners
        this.themeChangeListeners.clear();
        
        // Remove customization styles
        const customizations = document.getElementById('theme-customizations');
        if (customizations) {
            customizations.remove();
        }
    }
}