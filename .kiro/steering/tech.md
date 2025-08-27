# Technology Stack

## Core Technologies
- **TypeScript 4.9.4+**: Primary language for extension development
- **Node.js 16.x+**: Runtime environment
- **VS Code Extension API 1.75.0+**: Extension host integration
- **WebSocket (ws 8.18.3)**: Real-time communication protocol
- **UUID**: Unique identifier generation for connections and messages

## Frontend Technologies
- **Vue.js 3.4.0+**: Progressive JavaScript framework for webview UI
- **Vue Router 4.2.5+**: Client-side routing
- **Pinia 2.1.7+**: State management
- **Vite 5.0.8+**: Build tool and dev server
- **TailwindCSS 3.3.6+**: Utility-first CSS framework
- **PostCSS**: CSS processing and autoprefixer

## Development Tools
- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **Rimraf**: Cross-platform file deletion
- **VSCE**: VS Code extension packaging tool

## Build System

### Main Extension Build Commands
```bash
# Development
npm run compile          # Compile TypeScript
npm run compile:watch    # Watch mode compilation
npm run dev             # Build CSS and compile for development

# Production
npm run build           # Full production build (clean + compile + assets + Vue)
npm run package         # Create VSIX package for distribution

# Utilities
npm run clean           # Remove output directory
npm run lint            # Run ESLint on TypeScript files
npm run copy-assets     # Copy webview assets to output
```

### Vue Frontend Build Commands
```bash
# Vue-specific builds (run from src/webview/vue-frontend/)
npm run dev             # Development server with hot reload
npm run build:dev       # Development build
npm run build:prod      # Production build with optimizations
npm run type-check      # TypeScript type checking
npm run lint            # ESLint for Vue components
npm run format          # Prettier formatting
```

### CSS Build Commands
```bash
npm run build:css       # Watch mode for TailwindCSS
npm run build:css:prod  # Production CSS build with minification
```

## Project Configuration
- **tsconfig.json**: Strict TypeScript configuration with ES2020 target
- **eslint**: TypeScript and Vue.js linting rules
- **tailwind.config.js**: TailwindCSS configuration
- **postcss.config.js**: PostCSS processing configuration
- **vite.config.ts**: Vite build configuration for Vue frontend

## Testing Approach
- Manual testing preferred over automated tests
- Integration tests available for server functionality
- Extension host testing via F5 debug launch
- Server endpoint testing via HTTP/WebSocket clients