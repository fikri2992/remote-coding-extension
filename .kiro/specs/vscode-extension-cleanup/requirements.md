# Requirements Document

## Introduction

This feature involves cleaning up the cotg-cli project to remove all VSCode extension dependencies and configurations, transforming it into a streamlined CLI-focused tool. The project currently contains legacy VSCode extension code, dependencies, and build configurations that are no longer needed since the tool has evolved to be a standalone CLI application with web server and ACP capabilities.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to remove all VSCode extension dependencies and code, so that the project is cleaner and focused solely on CLI functionality.

#### Acceptance Criteria

1. WHEN reviewing the codebase THEN the system SHALL have no VSCode-specific imports or dependencies
2. WHEN examining the package.json THEN the system SHALL contain no VSCode extension related dependencies or scripts
3. WHEN building the project THEN the system SHALL not attempt to compile VSCode extension code
4. WHEN running the CLI THEN the system SHALL function without any VSCode extension components

### Requirement 2

**User Story:** As a developer, I want to clean up the project structure, so that only CLI-relevant files and directories remain.

#### Acceptance Criteria

1. WHEN examining the src directory THEN the system SHALL not contain VSCode extension entry points (extension.ts)
2. WHEN reviewing the webview directory THEN the system SHALL only contain React frontend components needed for the web interface
3. WHEN checking the commands directory THEN the system SHALL only contain CLI-relevant command handlers
4. WHEN inspecting the project root THEN the system SHALL not contain VSCode extension configuration files

### Requirement 3

**User Story:** As a developer, I want to streamline the build process, so that it only builds CLI and web components efficiently.

#### Acceptance Criteria

1. WHEN running npm run build THEN the system SHALL only compile CLI server components and React frontend
2. WHEN executing build scripts THEN the system SHALL not reference VSCode extension compilation steps
3. WHEN using the build process THEN the system SHALL complete faster without unnecessary VSCode extension builds
4. WHEN checking build outputs THEN the system SHALL only contain CLI executable and web assets

### Requirement 4

**User Story:** As a developer, I want to update package.json scripts and dependencies, so that they reflect the CLI-focused nature of the project.

#### Acceptance Criteria

1. WHEN reviewing package.json scripts THEN the system SHALL only contain CLI and web development related commands
2. WHEN examining dependencies THEN the system SHALL not include VSCode extension APIs or related packages
3. WHEN running npm scripts THEN the system SHALL execute without VSCode extension related errors
4. WHEN installing dependencies THEN the system SHALL only install packages needed for CLI and web functionality

### Requirement 5

**User Story:** As a developer, I want to preserve all CLI and ACP functionality, so that the core features remain intact after cleanup.

#### Acceptance Criteria

1. WHEN running the CLI server THEN the system SHALL start the web server and WebSocket backend successfully
2. WHEN using ACP integration THEN the system SHALL maintain all existing ACP capabilities
3. WHEN accessing the web interface THEN the system SHALL serve the React frontend correctly
4. WHEN executing CLI commands THEN the system SHALL perform all existing operations (start, stop, status, init)

### Requirement 6

**User Story:** As a developer, I want to remove obsolete configuration and documentation references, so that the project documentation is accurate and up-to-date.

#### Acceptance Criteria

1. WHEN reading project documentation THEN the system SHALL not reference VSCode extension functionality
2. WHEN reviewing configuration files THEN the system SHALL not contain VSCode extension settings
3. WHEN examining steering rules THEN the system SHALL reflect CLI-focused development practices
4. WHEN checking README files THEN the system SHALL accurately describe the CLI tool capabilities