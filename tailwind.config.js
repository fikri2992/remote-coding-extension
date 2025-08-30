/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/webview/**/*.html",
    "./src/webview/**/*.vue",
    "./src/webview/**/*.ts",
    "./src/webview/**/*.js"
  ],
  theme: {
    // Mobile-first breakpoints
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      // Custom mobile breakpoints
      'mobile': {'max': '767px'},
      'tablet': {'min': '768px', 'max': '1023px'},
      'desktop': {'min': '1024px'},
      // Orientation-based breakpoints
      'portrait': {'raw': '(orientation: portrait)'},
      'landscape': {'raw': '(orientation: landscape)'},
      // Touch device detection
      'touch': {'raw': '(hover: none) and (pointer: coarse)'},
      'no-touch': {'raw': '(hover: hover) and (pointer: fine)'}
    },
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#1976d2',
          600: '#1565c0',
          700: '#0d47a1'
        },
        gray: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#6c757d',
          600: '#495057',
          700: '#343a40',
          800: '#2c3e50',
          900: '#1a202c'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Consolas', 'monospace']
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem'
      },
      // Mobile-specific spacing
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        // Touch-friendly sizes
        'touch': '44px', // Minimum touch target size
        'touch-sm': '36px',
        'touch-lg': '56px'
      },
      // Mobile-optimized grid templates
      gridTemplateColumns: {
        'mobile': '1fr',
        'tablet': 'repeat(2, 1fr)',
        'desktop': 'repeat(3, 1fr)',
        'file-mobile': '1fr',
        'file-tablet': '240px 1fr',
        'file-desktop': '240px 1fr 320px'
      },
      // Mobile-friendly transitions
      transitionDuration: {
        '250': '250ms',
        '350': '350ms'
      },
      // Z-index scale for mobile layering
      zIndex: {
        'modal': '1000',
        'toast': '1100',
        'tooltip': '1200'
      },
      // Mobile-optimized shadows
      boxShadow: {
        'mobile': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'mobile-lg': '0 4px 16px rgba(0, 0, 0, 0.15)'
      }
    },
  },
  plugins: [
    // Custom plugin for mobile utilities
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Safe area utilities
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top)'
        },
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)'
        },
        '.pl-safe': {
          paddingLeft: 'env(safe-area-inset-left)'
        },
        '.pr-safe': {
          paddingRight: 'env(safe-area-inset-right)'
        },
        '.p-safe': {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)'
        },
        // Touch target utilities
        '.touch-target': {
          minHeight: theme('spacing.touch'),
          minWidth: theme('spacing.touch')
        },
        '.touch-target-sm': {
          minHeight: theme('spacing.touch-sm'),
          minWidth: theme('spacing.touch-sm')
        },
        '.touch-target-lg': {
          minHeight: theme('spacing.touch-lg'),
          minWidth: theme('spacing.touch-lg')
        },
        // Mobile-optimized scrolling
        '.scroll-smooth-mobile': {
          scrollBehavior: 'smooth',
          '-webkit-overflow-scrolling': 'touch'
        },
        // Prevent text selection on touch
        '.no-select': {
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          '-ms-user-select': 'none',
          'user-select': 'none'
        }
      }
      
      addUtilities(newUtilities)
    }
  ],
}