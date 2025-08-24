/**
 * Accessibility Helper
 * Provides utilities for enhancing accessibility features
 */

export class AccessibilityHelper {
    /**
     * Add ARIA attributes to element
     */
    static addAriaAttributes(element, attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
            element.setAttribute(ariaKey, value);
        });
    }

    /**
     * Create accessible button
     */
    static createAccessibleButton(text, options = {}) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = options.className || 'btn';
        
        if (options.ariaLabel) {
            button.setAttribute('aria-label', options.ariaLabel);
        }
        
        if (options.ariaDescribedBy) {
            button.setAttribute('aria-describedby', options.ariaDescribedBy);
        }
        
        if (options.disabled) {
            button.disabled = true;
            button.setAttribute('aria-disabled', 'true');
        }
        
        return button;
    }

    /**
     * Add keyboard navigation to list
     */
    static addKeyboardNavigation(listElement, options = {}) {
        const items = listElement.querySelectorAll(options.itemSelector || '[role="listitem"], .list-item');
        let currentIndex = -1;
        
        const focusItem = (index) => {
            if (index >= 0 && index < items.length) {
                items.forEach((item, i) => {
                    if (i === index) {
                        item.setAttribute('tabindex', '0');
                        item.focus();
                        item.setAttribute('aria-selected', 'true');
                    } else {
                        item.setAttribute('tabindex', '-1');
                        item.setAttribute('aria-selected', 'false');
                    }
                });
                currentIndex = index;
            }
        };
        
        listElement.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    focusItem(Math.min(currentIndex + 1, items.length - 1));
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    focusItem(Math.max(currentIndex - 1, 0));
                    break;
                case 'Home':
                    event.preventDefault();
                    focusItem(0);
                    break;
                case 'End':
                    event.preventDefault();
                    focusItem(items.length - 1);
                    break;
                case 'Enter':
                case ' ':
                    if (currentIndex >= 0 && options.onActivate) {
                        event.preventDefault();
                        options.onActivate(items[currentIndex], currentIndex);
                    }
                    break;
            }
        });
        
        // Initialize first item
        if (items.length > 0) {
            focusItem(0);
        }
        
        return {
            focusItem,
            getCurrentIndex: () => currentIndex,
            getItems: () => items
        };
    }

    /**
     * Add live region for announcements
     */
    static createLiveRegion(type = 'polite') {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', type);
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.id = `live-region-${Date.now()}`;
        
        document.body.appendChild(liveRegion);
        
        return {
            element: liveRegion,
            announce: (message) => {
                liveRegion.textContent = message;
                // Clear after announcement
                setTimeout(() => {
                    liveRegion.textContent = '';
                }, 1000);
            }
        };
    }

    /**
     * Add skip links
     */
    static addSkipLinks(targets) {
        const skipLinksContainer = document.createElement('div');
        skipLinksContainer.className = 'skip-links';
        skipLinksContainer.innerHTML = targets.map(target => 
            `<a href="#${target.id}" class="skip-link">${target.label}</a>`
        ).join('');
        
        // Add styles
        const styles = `
            .skip-links {
                position: absolute;
                top: -40px;
                left: 6px;
                z-index: 1000;
            }
            
            .skip-link {
                position: absolute;
                left: -10000px;
                top: auto;
                width: 1px;
                height: 1px;
                overflow: hidden;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                padding: 8px 16px;
                text-decoration: none;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .skip-link:focus {
                position: static;
                width: auto;
                height: auto;
                overflow: visible;
                left: auto;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        
        document.body.insertBefore(skipLinksContainer, document.body.firstChild);
        
        return skipLinksContainer;
    }

    /**
     * Enhance form accessibility
     */
    static enhanceForm(formElement) {
        const inputs = formElement.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            const label = formElement.querySelector(`label[for="${input.id}"]`);
            
            if (!label && !input.getAttribute('aria-label')) {
                console.warn('Input without label or aria-label:', input);
            }
            
            // Add required indicator
            if (input.required && !input.getAttribute('aria-required')) {
                input.setAttribute('aria-required', 'true');
            }
            
            // Add invalid state handling
            input.addEventListener('invalid', () => {
                input.setAttribute('aria-invalid', 'true');
            });
            
            input.addEventListener('input', () => {
                if (input.validity.valid) {
                    input.removeAttribute('aria-invalid');
                }
            });
        });
    }

    /**
     * Add focus trap for modals
     */
    static addFocusTrap(container) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (event) => {
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        container.addEventListener('keydown', handleTabKey);
        
        // Focus first element
        if (firstElement) {
            firstElement.focus();
        }
        
        return {
            destroy: () => {
                container.removeEventListener('keydown', handleTabKey);
            }
        };
    }

    /**
     * Add high contrast mode detection
     */
    static detectHighContrast() {
        const testElement = document.createElement('div');
        testElement.style.cssText = `
            position: absolute;
            left: -9999px;
            width: 1px;
            height: 1px;
            background-color: rgb(31, 31, 31);
            color: rgb(255, 255, 255);
        `;
        
        document.body.appendChild(testElement);
        
        const computedStyle = window.getComputedStyle(testElement);
        const isHighContrast = computedStyle.backgroundColor === computedStyle.color;
        
        document.body.removeChild(testElement);
        
        if (isHighContrast) {
            document.body.classList.add('high-contrast');
        }
        
        return isHighContrast;
    }

    /**
     * Add reduced motion detection
     */
    static detectReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            document.body.classList.add('reduced-motion');
        }
        
        return prefersReducedMotion;
    }

    /**
     * Create accessible tooltip
     */
    static createTooltip(triggerElement, content, options = {}) {
        const tooltipId = `tooltip-${Date.now()}`;
        const tooltip = document.createElement('div');
        tooltip.id = tooltipId;
        tooltip.className = 'tooltip-content';
        tooltip.textContent = content;
        tooltip.setAttribute('role', 'tooltip');
        
        triggerElement.setAttribute('aria-describedby', tooltipId);
        
        let showTimeout;
        let hideTimeout;
        
        const showTooltip = () => {
            clearTimeout(hideTimeout);
            showTimeout = setTimeout(() => {
                document.body.appendChild(tooltip);
                
                // Position tooltip
                const triggerRect = triggerElement.getBoundingClientRect();
                tooltip.style.left = `${triggerRect.left + triggerRect.width / 2}px`;
                tooltip.style.top = `${triggerRect.top - tooltip.offsetHeight - 8}px`;
                tooltip.style.transform = 'translateX(-50%)';
                
                tooltip.classList.add('show');
            }, options.delay || 500);
        };
        
        const hideTooltip = () => {
            clearTimeout(showTimeout);
            hideTimeout = setTimeout(() => {
                tooltip.classList.remove('show');
                setTimeout(() => {
                    if (tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                }, 200);
            }, 100);
        };
        
        triggerElement.addEventListener('mouseenter', showTooltip);
        triggerElement.addEventListener('mouseleave', hideTooltip);
        triggerElement.addEventListener('focus', showTooltip);
        triggerElement.addEventListener('blur', hideTooltip);
        
        return {
            destroy: () => {
                clearTimeout(showTimeout);
                clearTimeout(hideTimeout);
                triggerElement.removeEventListener('mouseenter', showTooltip);
                triggerElement.removeEventListener('mouseleave', hideTooltip);
                triggerElement.removeEventListener('focus', showTooltip);
                triggerElement.removeEventListener('blur', hideTooltip);
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }
        };
    }

    /**
     * Announce to screen readers
     */
    static announce(message, priority = 'polite') {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}