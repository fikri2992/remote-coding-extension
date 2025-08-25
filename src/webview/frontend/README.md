# Unified Web Frontend

This is the unified frontend for the VS Code Web Automation extension, combining the enhanced UI capabilities with web automation functionality.

## Architecture

The unified frontend is built with a modular architecture:

### Core Components
- **AppShell**: Main application layout and navigation
- **Sidebar**: Navigation sidebar with section switching
- **MainContent**: Content area that displays different sections
- **WebAutomation**: VS Code integration and command execution
- **ChatInterface**: Enhanced chat interface for prompts
- **FileManager**: File system navigation and management
- **GitDashboard**: Git integration with branch info and commit history
- **InfoPanel**: System information and connection status

### Services
- **StateManager**: Centralized state management
- **WebSocketClient**: Enhanced WebSocket communication
- **WebAutomationService**: VS Code API integration
- **NotificationService**: User notifications
- **ThemeManager**: Theme and appearance management
- **KeyboardShortcutService**: Keyboard shortcuts
- **ContextMenuService**: Right-click context menus
- **DragDropService**: Drag and drop functionality
- **AnimationService**: UI animations
- **TouchGestureService**: Touch gesture support
- **ResponsiveLayoutService**: Responsive design
- **ErrorHandlingService**: Error handling and recovery
- **ConnectionRecoveryService**: Connection recovery
- **OfflineModeService**: Offline functionality

## Features

### Web Automation
- VS Code command execution
- Server status monitoring
- Quick command buttons
- Custom command interface
- Real-time connection status
- Performance metrics

### Enhanced UI
- Responsive design (mobile, tablet, desktop)
- Touch gesture support
- Keyboard shortcuts
- Context menus
- Drag and drop
- Smooth animations
- Dark/light theme support
- Offline mode support
- Error recovery

### Chat Interface
- Real-time messaging
- Message history
- Typing indicators
- File attachments
- Rich text formatting
- Auto-scroll
- Performance optimizations

### File Management
- File tree navigation
- File operations (create, delete, rename)
- Search functionality
- File watching
- Context menus
- Drag and drop

### Git Integration
- Branch information
- Commit history
- Diff viewer
- Git operations
- Status monitoring

## Build Process

The frontend is built using a custom build configuration that:

1. Copies HTML, CSS, and JavaScript files to the output directory
2. Processes assets and resources
3. Integrates with the VS Code extension build process

To build the frontend:

```bash
npm run build
```

## Development

### File Structure
```
src/webview/frontend/
├── index.html              # Main HTML file
├── js/
│   ├── main.js            # Application entry point
│   ├── components/        # UI components
│   ├── services/          # Core services
│   └── utils/            # Utility functions
├── styles/
│   ├── main.css          # Main styles
│   ├── components.css    # Component styles
│   ├── themes.css        # Theme definitions
│   ├── animations.css    # Animation styles
│   └── touch.css         # Touch-specific styles
├── assets/               # Static assets
└── build.config.js       # Build configuration
```

### Key Classes

#### UnifiedWebApp
Main application class that orchestrates all components and services.

#### WebAutomationService
Handles VS Code integration, command execution, and server communication.

#### AppShell
Main layout component that manages sidebar, content area, and responsive behavior.

### State Management
The application uses a centralized state manager with the following sections:
- `webAutomation`: VS Code integration state
- `connection`: WebSocket and server connection state
- `chat`: Chat interface state
- `fileSystem`: File system state
- `git`: Git repository state
- `navigation`: UI navigation state
- `preferences`: User preferences
- `system`: System information

### Event System
Components communicate through:
- State manager subscriptions
- Custom DOM events
- Direct method calls
- Service interfaces

## Integration with VS Code

The frontend integrates with VS Code through:

1. **VS Code Webview API**: Direct communication with the extension
2. **WebSocket Server**: Real-time communication for enhanced features
3. **Command Execution**: Direct VS Code command execution
4. **File System Operations**: File operations through VS Code API
5. **Configuration Management**: Extension settings integration

## Performance Optimizations

- Virtual scrolling for large lists
- Message batching for state updates
- Memory management and cleanup
- Lazy loading of components
- Debounced event handlers
- Optimized rendering cycles
- Performance monitoring

## Browser Compatibility

The frontend supports:
- Modern browsers (Chrome, Firefox, Safari, Edge)
- VS Code webview environment
- Mobile browsers (responsive design)
- Touch devices

## Security

- Content Security Policy (CSP) compliance
- XSS prevention
- Safe HTML rendering
- Secure WebSocket connections
- Input validation and sanitization