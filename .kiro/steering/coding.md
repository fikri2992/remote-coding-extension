---
inclusion: always
---

# Code Organization & Architecture Guidelines

## File Size & Modularity
- Keep files under 500 lines of code for maintainability
- When approaching 500+ lines, extract functionality into:
  - Separate modules with clear responsibilities
  - Utility functions in dedicated files
  - Type definitions in `.types.ts` files
  - Constants in dedicated constant files

## Separation of Concerns
- Each file should have a single, well-defined responsibility
- Separate business logic from presentation logic
- Extract reusable utilities into shared modules
- Keep configuration separate from implementation

## TypeScript Best Practices
- Use explicit type annotations for public APIs
- Prefer interfaces over type aliases for object shapes
- Export types alongside implementation when needed
- Use strict TypeScript settings and address all compiler warnings

## VS Code Extension Architecture
- Follow VS Code extension patterns for commands, providers, and webviews
- Separate extension host logic from webview logic
- Use proper activation events and lazy loading
- Handle extension lifecycle events appropriately

## Code Style
- Use consistent naming conventions 
- Always use functional programming over Object Oriented Programming (OOP)
- Prefer descriptive names over comments when possible
- Keep functions focused and small (ideally under 100 lines)
- Use early returns to reduce nesting

## Error Handling
- Use proper error boundaries and graceful degradation
- Log errors appropriately for debugging
- Provide meaningful error messages to users
- Handle async operations with proper error catching
