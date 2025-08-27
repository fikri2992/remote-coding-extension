# Vue.js Frontend User Guide

## Overview

Welcome to the modernized Vue.js frontend interface! This guide will help you navigate and use the new interface effectively. The updated interface provides a more intuitive, responsive, and feature-rich experience while maintaining all the functionality you're familiar with.

## Getting Started

### Accessing the Interface

1. Start your VS Code extension
2. Open the webview panel
3. The Vue.js interface will load automatically
4. Wait for the WebSocket connection to establish (indicated by the connection status)

### Interface Layout

The interface consists of several main areas:

- **Header**: Navigation, connection status, and global controls
- **Sidebar**: Main navigation between different sections
- **Main Content**: The primary work area for each section
- **Footer**: Status information and quick actions

## Navigation

### Main Sections

The interface is organized into six main sections:

#### 1. Home Dashboard
- Overview of system status
- Quick access to recent files and commands
- Connection information and health metrics

#### 2. Automation & Server Management
- VS Code command execution
- Server start/stop controls
- Connection monitoring
- Command history and favorites

#### 3. File Explorer
- Browse workspace files and folders
- Create, edit, delete, and rename files
- File content preview
- Search and filter functionality

#### 4. Git Integration
- Repository status overview
- Branch management
- Commit history and diff viewing
- Stage, commit, push, and pull operations

#### 5. Terminal Interface
- Multiple terminal sessions
- Command execution and history
- Real-time output streaming
- Terminal customization options

#### 6. Chat & Messaging
- Real-time messaging
- Message history
- File sharing capabilities
- User presence indicators

### Navigation Methods

#### Sidebar Navigation
- Click on section icons in the left sidebar
- Sections are clearly labeled with icons and names
- Active section is highlighted

#### Keyboard Shortcuts
- `Ctrl/Cmd + 1-6`: Switch between main sections
- `Ctrl/Cmd + B`: Toggle sidebar
- `Ctrl/Cmd + Shift + P`: Open command palette
- `Esc`: Close modals and dialogs

#### Breadcrumb Navigation
- Available in file explorer and other hierarchical views
- Click on breadcrumb items to navigate up the hierarchy
- Shows current location within the workspace

## Features Guide

### Automation & Server Management

#### Command Execution
1. Navigate to the Automation section
2. Use the command panel to execute VS Code commands
3. Type command names or browse available commands
4. View command results in real-time
5. Access command history for repeated operations

#### Server Controls
- **Start Server**: Click the green "Start" button
- **Stop Server**: Click the red "Stop" button
- **Restart Server**: Use the restart button for quick restarts
- **Connection Status**: Monitor connection health in real-time

#### Command Favorites
1. Execute a command you use frequently
2. Click the "Add to Favorites" star icon
3. Access favorites from the quick access panel
4. Remove favorites by clicking the star again

### File Management

#### File Explorer
- **Tree Navigation**: Expand/collapse folders by clicking arrows
- **File Operations**: Right-click for context menu options
- **Quick Search**: Use the search box to find files quickly
- **File Preview**: Click files to preview content

#### File Operations
- **Create File**: Right-click in explorer → "New File"
- **Create Folder**: Right-click in explorer → "New Folder"
- **Rename**: Right-click item → "Rename" or press F2
- **Delete**: Right-click item → "Delete" or press Delete key
- **Move**: Drag and drop files/folders to new locations

#### File Content Editing
1. Click on a file to open it
2. Edit content in the built-in editor
3. Save changes with Ctrl/Cmd + S
4. Changes are automatically synced with VS Code

### Git Operations

#### Repository Status
- View current branch and status at the top of the Git section
- See staged, unstaged, and untracked files
- Monitor ahead/behind commit counts

#### Branch Management
1. Click on the current branch name to see all branches
2. Switch branches by clicking on branch names
3. Create new branches using the "New Branch" button
4. Delete branches with the delete icon (when safe)

#### Staging and Committing
1. **Stage Files**: Click the "+" icon next to files to stage
2. **Unstage Files**: Click the "-" icon next to staged files
3. **Stage All**: Use "Stage All Changes" button
4. **Commit**: Enter commit message and click "Commit"

#### Viewing Changes
- **Diff View**: Click on modified files to see changes
- **Commit History**: Browse previous commits with details
- **File History**: See changes to specific files over time

### Terminal Usage

#### Session Management
- **New Session**: Click "New Terminal" to create a session
- **Switch Sessions**: Click on session tabs to switch
- **Close Session**: Click the "×" on session tabs
- **Rename Session**: Right-click tab → "Rename"

#### Command Execution
1. Type commands in the terminal input
2. Press Enter to execute
3. Use arrow keys to navigate command history
4. Ctrl/Cmd + C to interrupt running commands

#### Terminal Features
- **Auto-completion**: Tab to complete commands and paths
- **History Search**: Ctrl/Cmd + R for reverse search
- **Copy/Paste**: Standard keyboard shortcuts work
- **Clear Screen**: Ctrl/Cmd + L or type `clear`

### Chat & Messaging

#### Sending Messages
1. Type your message in the input field at the bottom
2. Press Enter to send or click the send button
3. Use Shift + Enter for line breaks
4. Messages appear in real-time for all connected users

#### Message Features
- **Rich Text**: Use markdown formatting in messages
- **File Sharing**: Drag files into the chat to share
- **Emoji Support**: Use emoji picker or type emoji codes
- **Message History**: Scroll up to see previous messages

#### User Presence
- See who's currently online with green indicators
- View typing indicators when others are composing messages
- See when messages were read with read receipts

## Customization

### Theme Settings
1. Click on your profile/settings icon in the header
2. Choose between Light, Dark, or System theme
3. Theme changes apply immediately
4. Settings are saved automatically

### Interface Preferences
- **Sidebar Width**: Drag the sidebar edge to resize
- **Panel Layout**: Some sections offer layout options
- **Font Size**: Adjust in settings for better readability
- **Notifications**: Configure notification preferences

### Keyboard Shortcuts
Access the keyboard shortcuts panel from the help menu to:
- View all available shortcuts
- Customize shortcuts for your workflow
- Reset shortcuts to defaults

## Responsive Design

### Desktop Experience
- Full sidebar navigation
- Multi-panel layouts
- Drag and drop functionality
- Context menus and hover states

### Tablet Experience
- Collapsible sidebar
- Touch-friendly controls
- Optimized spacing
- Swipe gestures for navigation

### Mobile Experience
- Bottom navigation bar
- Full-screen sections
- Touch-optimized controls
- Simplified layouts

## Troubleshooting

### Connection Issues
If you experience connection problems:
1. Check the connection status indicator in the header
2. Try refreshing the page
3. Verify VS Code extension is running
4. Check WebSocket server status

### Performance Issues
For slow performance:
1. Close unused terminal sessions
2. Limit large file previews
3. Clear chat message history if very long
4. Refresh the interface periodically

### Interface Problems
If the interface isn't working correctly:
1. Hard refresh the page (Ctrl/Cmd + Shift + R)
2. Clear browser cache
3. Check browser console for errors
4. Try a different browser

### File Operation Issues
If file operations fail:
1. Check file permissions
2. Verify workspace is properly loaded
3. Ensure VS Code has file access
4. Try refreshing the file tree

## Accessibility Features

### Keyboard Navigation
- All interface elements are keyboard accessible
- Tab through interactive elements
- Use arrow keys in lists and trees
- Enter/Space to activate buttons

### Screen Reader Support
- Proper ARIA labels on all elements
- Semantic HTML structure
- Status announcements for important changes
- Alternative text for images and icons

### Visual Accessibility
- High contrast mode available
- Scalable text and interface elements
- Clear focus indicators
- Color-blind friendly color schemes

## Tips and Best Practices

### Workflow Optimization
1. **Use Favorites**: Add frequently used commands to favorites
2. **Keyboard Shortcuts**: Learn shortcuts for common actions
3. **Multiple Terminals**: Use separate terminals for different tasks
4. **Git Workflow**: Stage changes incrementally for better commits

### File Management
1. **Search Effectively**: Use file search for large workspaces
2. **Organize Files**: Keep workspace organized with folders
3. **Preview First**: Preview files before opening in VS Code
4. **Batch Operations**: Select multiple files for batch operations

### Communication
1. **Clear Messages**: Write clear, concise chat messages
2. **File Context**: Share relevant files when discussing code
3. **Status Updates**: Use presence indicators to coordinate work
4. **Message History**: Reference previous messages for context

## Getting Help

### Built-in Help
- **Help Menu**: Access from the header menu
- **Tooltips**: Hover over elements for quick help
- **Keyboard Shortcuts**: View shortcut reference
- **Status Messages**: Pay attention to status notifications

### Documentation
- **Developer Guide**: Technical documentation for developers
- **API Reference**: Component and composable documentation
- **Troubleshooting Guide**: Solutions for common issues
- **Migration Notes**: Information about changes from the old interface

### Support Resources
- Check the project repository for issues and updates
- Review the changelog for recent changes
- Contact your development team for workspace-specific help
- Report bugs through the appropriate channels

## What's New

### Improvements Over Legacy Interface
- **Better Performance**: Faster loading and smoother interactions
- **Modern Design**: Clean, professional interface with better usability
- **Responsive Layout**: Works well on all device sizes
- **Enhanced Features**: Improved file management, Git integration, and terminal
- **Better Accessibility**: Full keyboard navigation and screen reader support
- **Real-time Updates**: More responsive WebSocket communication

### New Features
- **Command Favorites**: Save frequently used commands
- **Enhanced File Preview**: Better file content viewing
- **Improved Git Interface**: More intuitive Git operations
- **Multiple Terminal Sessions**: Work with multiple terminals simultaneously
- **Rich Chat Features**: Enhanced messaging with file sharing
- **Theme Customization**: Light/dark theme support
- **Better Error Handling**: More informative error messages and recovery options

Welcome to the new Vue.js frontend! We hope you find it more intuitive and powerful than the previous interface. If you have any questions or feedback, please don't hesitate to reach out to the development team.