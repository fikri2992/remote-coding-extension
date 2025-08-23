---
inclusion: always
---

# Testing Guidelines

## Default Testing Approach
- **Do not create tests automatically** - Manual testing is preferred for this project
- Skip unit tests, integration tests, and end-to-end tests unless explicitly requested
- Focus on implementing functionality rather than test coverage

## When Tests Are Requested
- Only create unit tests when specifically asked by the user
- Limit test creation to maximum 5 tests per request
- Focus on testing the most critical functionality only
- Prioritize core business logic over edge cases

## Test Structure (When Required)
- Use existing test framework patterns in the project
- Keep tests simple and focused on single functionality
- Name tests clearly to describe what they verify
- Place tests in appropriate test directories following project conventions

## Manual Testing Preference
- User handles manual testing and validation
- Implementation should be functional and ready for manual verification
- Focus development time on feature implementation rather than test automation