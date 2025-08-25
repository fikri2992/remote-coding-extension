/**
 * Animation Service
 * Handles smooth animations and transitions between sections
 */

export class AnimationService {
    constructor() {
        // Animation configurations
        this.animations = new Map();
        this.runningAnimations = new Map();
        
        // Default animation settings
        this.defaults = {
            duration: 300,
            easing: 'ease-out',
            fill: 'forwards'
        };
        
        // Presets
        this.presets = {
            fadeIn: {
                keyframes: [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                options: { duration: 200, easing: 'ease-out' }
            },
            fadeOut: {
                keyframes: [
                    { opacity: 1 },
                    { opacity: 0 }
                ],
                options: { duration: 200, easing: 'ease-in' }
            },
            slideInLeft: {
                keyframes: [
                    { transform: 'translateX(-100%)', opacity: 0 },
                    { transform: 'translateX(0)', opacity: 1 }
                ],
                options: { duration: 300, easing: 'ease-out' }
            },
            slideInRight: {
                keyframes: [
                    { transform: 'translateX(100%)', opacity: 0 },
                    { transform: 'translateX(0)', opacity: 1 }
                ],
                options: { duration: 300, easing: 'ease-out' }
            },
            slideOutLeft: {
                keyframes: [
                    { transform: 'translateX(0)', opacity: 1 },
                    { transform: 'translateX(-100%)', opacity: 0 }
                ],
                options: { duration: 300, easing: 'ease-in' }
            },
            slideOutRight: {
                keyframes: [
                    { transform: 'translateX(0)', opacity: 1 },
                    { transform: 'translateX(100%)', opacity: 0 }
                ],
                options: { duration: 300, easing: 'ease-in' }
            },
            slideUp: {
                keyframes: [
                    { transform: 'translateY(20px)', opacity: 0 },
                    { transform: 'translateY(0)', opacity: 1 }
                ],
                options: { duration: 250, easing: 'ease-out' }
            },
            slideDown: {
                keyframes: [
                    { transform: 'translateY(-20px)', opacity: 0 },
                    { transform: 'translateY(0)', opacity: 1 }
                ],
                options: { duration: 250, easing: 'ease-out' }
            },
            scaleIn: {
                keyframes: [
                    { transform: 'scale(0.9)', opacity: 0 },
                    { transform: 'scale(1)', opacity: 1 }
                ],
                options: { duration: 200, easing: 'ease-out' }
            },
            scaleOut: {
                keyframes: [
                    { transform: 'scale(1)', opacity: 1 },
                    { transform: 'scale(0.9)', opacity: 0 }
                ],
                options: { duration: 200, easing: 'ease-in' }
            },
            bounce: {
                keyframes: [
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.05)' },
                    { transform: 'scale(1)' }
                ],
                options: { duration: 300, easing: 'ease-in-out' }
            },
            shake: {
                keyframes: [
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' },
                    { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' },
                    { transform: 'translateX(0)' }
                ],
                options: { duration: 500, easing: 'ease-in-out' }
            },
            pulse: {
                keyframes: [
                    { opacity: 1 },
                    { opacity: 0.7 },
                    { opacity: 1 }
                ],
                options: { duration: 1000, easing: 'ease-in-out', iterations: Infinity }
            },
            spin: {
                keyframes: [
                    { transform: 'rotate(0deg)' },
                    { transform: 'rotate(360deg)' }
                ],
                options: { duration: 1000, easing: 'linear', iterations: Infinity }
            }
        };
    }

    /**
     * Initialize the service
     */
    async initialize() {
        this.setupCSS();
        console.log('✅ AnimationService initialized');
    }

    /**
     * Setup CSS animations and transitions
     */
    setupCSS() {
        const styles = `
            /* Base animation classes */
            .animate {
                animation-fill-mode: both;
            }
            
            .animate-fast {
                animation-duration: 150ms;
            }
            
            .animate-slow {
                animation-duration: 500ms;
            }
            
            /* Transition utilities */
            .transition-all {
                transition: all 0.2s ease-out;
            }
            
            .transition-opacity {
                transition: opacity 0.2s ease-out;
            }
            
            .transition-transform {
                transition: transform 0.2s ease-out;
            }
            
            .transition-colors {
                transition: background-color 0.2s ease-out, color 0.2s ease-out, border-color 0.2s ease-out;
            }
            
            /* Section transitions */
            .section-enter {
                opacity: 0;
                transform: translateX(20px);
            }
            
            .section-enter-active {
                opacity: 1;
                transform: translateX(0);
                transition: opacity 0.3s ease-out, transform 0.3s ease-out;
            }
            
            .section-exit {
                opacity: 1;
                transform: translateX(0);
            }
            
            .section-exit-active {
                opacity: 0;
                transform: translateX(-20px);
                transition: opacity 0.3s ease-in, transform 0.3s ease-in;
            }
            
            /* Sidebar animations */
            .sidebar-collapse {
                transition: width 0.2s ease-out, min-width 0.2s ease-out;
            }
            
            .sidebar-item-fade {
                transition: opacity 0.2s ease-out;
            }
            
            /* Message animations */
            .message-enter {
                opacity: 0;
                transform: translateY(10px) scale(0.98);
            }
            
            .message-enter-active {
                opacity: 1;
                transform: translateY(0) scale(1);
                transition: opacity 0.2s ease-out, transform 0.2s ease-out;
            }
            
            /* Card hover animations */
            .card-hover {
                transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
            }
            
            .card-hover:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            /* Button animations */
            .btn-animate {
                transition: all 0.1s ease-out;
                position: relative;
                overflow: hidden;
            }
            
            .btn-animate::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: width 0.3s ease-out, height 0.3s ease-out;
            }
            
            .btn-animate:active::before {
                width: 300px;
                height: 300px;
            }
            
            /* Loading animations */
            .loading-dots {
                display: inline-flex;
                gap: 4px;
            }
            
            .loading-dots span {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
                animation: loadingDots 1.4s infinite ease-in-out;
            }
            
            .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
            .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
            .loading-dots span:nth-child(3) { animation-delay: 0s; }
            
            @keyframes loadingDots {
                0%, 80%, 100% {
                    opacity: 0.3;
                    transform: scale(0.8);
                }
                40% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            /* Skeleton loading */
            .skeleton {
                background: linear-gradient(90deg, 
                    var(--vscode-editor-background) 25%, 
                    var(--vscode-list-hoverBackground) 50%, 
                    var(--vscode-editor-background) 75%);
                background-size: 200% 100%;
                animation: skeleton 1.5s infinite;
            }
            
            @keyframes skeleton {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            /* Stagger animations */
            .stagger-children > * {
                animation-delay: calc(var(--stagger-delay, 0.1s) * var(--stagger-index, 0));
            }
            
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .animate,
                .transition-all,
                .transition-opacity,
                .transition-transform,
                .transition-colors,
                .section-enter-active,
                .section-exit-active,
                .sidebar-collapse,
                .sidebar-item-fade,
                .message-enter-active,
                .card-hover,
                .btn-animate {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
                
                .loading-dots span {
                    animation: none;
                    opacity: 0.7;
                }
                
                .skeleton {
                    animation: none;
                    background: var(--vscode-list-hoverBackground);
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Animate element with preset or custom animation
     */
    animate(element, animationName, options = {}) {
        return new Promise((resolve, reject) => {
            if (!element) {
                reject(new Error('Element is required'));
                return;
            }
            
            // Cancel any existing animation on this element
            this.cancelAnimation(element);
            
            let animation;
            
            if (this.presets[animationName]) {
                // Use preset animation
                const preset = this.presets[animationName];
                const animationOptions = {
                    ...this.defaults,
                    ...preset.options,
                    ...options
                };
                
                animation = element.animate(preset.keyframes, animationOptions);
            } else if (options.keyframes) {
                // Use custom keyframes
                const animationOptions = {
                    ...this.defaults,
                    ...options
                };
                
                animation = element.animate(options.keyframes, animationOptions);
            } else {
                reject(new Error(`Animation '${animationName}' not found and no keyframes provided`));
                return;
            }
            
            // Store animation reference
            this.runningAnimations.set(element, animation);
            
            // Handle animation completion
            animation.addEventListener('finish', () => {
                this.runningAnimations.delete(element);
                resolve(animation);
            });
            
            animation.addEventListener('cancel', () => {
                this.runningAnimations.delete(element);
                reject(new Error('Animation was cancelled'));
            });
        });
    }

    /**
     * Cancel animation on element
     */
    cancelAnimation(element) {
        const animation = this.runningAnimations.get(element);
        if (animation) {
            animation.cancel();
            this.runningAnimations.delete(element);
        }
    }

    /**
     * Animate section transition
     */
    async animateSectionTransition(fromElement, toElement, direction = 'forward') {
        const animations = [];
        
        if (fromElement) {
            // Animate out current section
            const outAnimation = direction === 'forward' ? 'slideOutLeft' : 'slideOutRight';
            animations.push(this.animate(fromElement, outAnimation));
        }
        
        if (toElement) {
            // Animate in new section
            const inAnimation = direction === 'forward' ? 'slideInRight' : 'slideInLeft';
            
            // Ensure element is visible before animating
            toElement.style.display = 'block';
            
            animations.push(this.animate(toElement, inAnimation));
        }
        
        try {
            await Promise.all(animations);
            
            // Hide the old section
            if (fromElement) {
                fromElement.style.display = 'none';
            }
        } catch (error) {
            console.warn('Section transition animation failed:', error);
        }
    }

    /**
     * Animate message appearance
     */
    async animateMessageAppear(messageElement) {
        try {
            await this.animate(messageElement, 'slideUp');
        } catch (error) {
            console.warn('Message animation failed:', error);
        }
    }

    /**
     * Animate list items with stagger
     */
    async animateListItems(containerElement, itemSelector = '.list-item', staggerDelay = 50) {
        const items = containerElement.querySelectorAll(itemSelector);
        const animations = [];
        
        items.forEach((item, index) => {
            // Set stagger delay
            item.style.setProperty('--stagger-index', index);
            item.style.setProperty('--stagger-delay', `${staggerDelay}ms`);
            
            // Add stagger class
            item.classList.add('stagger-children');
            
            // Animate with delay
            const delay = index * staggerDelay;
            setTimeout(() => {
                animations.push(this.animate(item, 'slideUp'));
            }, delay);
        });
        
        try {
            await Promise.all(animations);
        } catch (error) {
            console.warn('List animation failed:', error);
        }
    }

    /**
     * Animate sidebar collapse/expand
     */
    async animateSidebarToggle(sidebarElement, collapsed) {
        const items = sidebarElement.querySelectorAll('.nav-item-text, .nav-item-shortcut');
        
        if (collapsed) {
            // Fade out text elements
            const fadePromises = Array.from(items).map(item => 
                this.animate(item, 'fadeOut', { duration: 150 })
            );
            
            try {
                await Promise.all(fadePromises);
            } catch (error) {
                console.warn('Sidebar collapse animation failed:', error);
            }
        } else {
            // Fade in text elements with delay
            setTimeout(async () => {
                const fadePromises = Array.from(items).map(item => 
                    this.animate(item, 'fadeIn', { duration: 150 })
                );
                
                try {
                    await Promise.all(fadePromises);
                } catch (error) {
                    console.warn('Sidebar expand animation failed:', error);
                }
            }, 200);
        }
    }

    /**
     * Animate notification
     */
    async animateNotification(notificationElement, type = 'show') {
        const animationName = type === 'show' ? 'slideInRight' : 'slideOutRight';
        
        try {
            await this.animate(notificationElement, animationName);
        } catch (error) {
            console.warn('Notification animation failed:', error);
        }
    }

    /**
     * Animate button press
     */
    animateButtonPress(buttonElement) {
        // Add ripple effect
        buttonElement.classList.add('btn-animate');
        
        // Bounce animation
        this.animate(buttonElement, 'bounce', { duration: 200 }).catch(() => {
            // Ignore animation errors for button press
        });
    }

    /**
     * Animate loading state
     */
    startLoadingAnimation(element, type = 'dots') {
        this.stopLoadingAnimation(element);
        
        if (type === 'dots') {
            element.innerHTML = `
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;
        } else if (type === 'skeleton') {
            element.classList.add('skeleton');
        } else if (type === 'spin') {
            this.animate(element, 'spin').catch(() => {
                // Ignore animation errors
            });
        }
        
        element.dataset.loadingType = type;
    }

    /**
     * Stop loading animation
     */
    stopLoadingAnimation(element) {
        const loadingType = element.dataset.loadingType;
        
        if (loadingType === 'dots') {
            const dotsElement = element.querySelector('.loading-dots');
            if (dotsElement) {
                dotsElement.remove();
            }
        } else if (loadingType === 'skeleton') {
            element.classList.remove('skeleton');
        } else if (loadingType === 'spin') {
            this.cancelAnimation(element);
        }
        
        delete element.dataset.loadingType;
    }

    /**
     * Add hover animations to elements
     */
    addHoverAnimations(containerElement) {
        const cards = containerElement.querySelectorAll('.card, .commit-card, .prompt-item');
        cards.forEach(card => {
            card.classList.add('card-hover');
        });
        
        const buttons = containerElement.querySelectorAll('.btn');
        buttons.forEach(button => {
            button.classList.add('btn-animate');
            
            button.addEventListener('click', () => {
                this.animateButtonPress(button);
            });
        });
    }

    /**
     * Create custom animation
     */
    createAnimation(name, keyframes, options = {}) {
        this.presets[name] = {
            keyframes,
            options: { ...this.defaults, ...options }
        };
    }

    /**
     * Remove custom animation
     */
    removeAnimation(name) {
        delete this.presets[name];
    }

    /**
     * Check if animations are enabled
     */
    areAnimationsEnabled() {
        return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * Get running animations count
     */
    getRunningAnimationsCount() {
        return this.runningAnimations.size;
    }

    /**
     * Cancel all running animations
     */
    cancelAllAnimations() {
        this.runningAnimations.forEach(animation => {
            animation.cancel();
        });
        this.runningAnimations.clear();
    }

    /**
     * Destroy the service
     */
    destroy() {
        // Cancel all running animations
        this.cancelAllAnimations();
        
        // Clear presets
        this.animations.clear();
        
        console.log('✅ AnimationService destroyed');
    }
}