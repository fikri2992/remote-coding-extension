# Manual Testing Checklist for Basic VSCode Extension

## Pre-Testing Setup
- [x] Extension compiled successfully (`npm run compile`)
- [x] No linting errors (`npm run lint`)
- [x] VSCode development host launched (`code --extensionDevelopmentPath=. --new-window`)

## Test 1: Extension Installation and Activation
### Expected Behavior:
- Extension should activate automatically when VSCode starts
- No error messages should appear in the console

### Test Steps:
1. Open VSCode development host
2. Check the Output panel > "Basic VSCode Extension" channel for activation messages
3. Verify console shows: "Basic VSCode Extension is now active!"
4. Verify console shows: "Basic VSCode Extension registration complete"

### Results:
- [ ] Extension activates without errors
- [ ] Activation messages appear in console
- [ ] No error notifications shown to user

## Test 2: Activity Bar Icon Display
### Expected Behavior:
- Custom SVG icon should appear in the VSCode activity bar
- Icon should be clickable and recognizable

### Test Steps:
1. Look at the left side activity bar in VSCode
2. Locate the custom extension icon (gear with play button)
3. Verify icon is visible and properly rendered
4. Hover over icon to see tooltip

### Results:
- [ ] Custom SVG icon appears in activity bar
- [ ] Icon is clearly visible and properly rendered
- [ ] Tooltip shows "Basic Extension" when hovering
- [ ] Icon follows VSCode theme (light/dark mode)

## Test 3: Extension View Panel Opening
### Expected Behavior:
- Clicking the activity bar icon should open the extension's view panel
- Panel should display the webview content with button

### Test Steps:
1. Click on the extension icon in the activity bar
2. Verify the extension panel opens in the sidebar
3. Check that the panel shows "Basic Extension" title
4. Verify the description text is displayed
5. Confirm the "Execute Action" button is visible

### Results:
- [ ] Panel opens when clicking activity bar icon
- [ ] Panel displays correct title and description
- [ ] "Execute Action" button is visible and styled correctly
- [ ] Panel content follows VSCode theme styling

## Test 4: Button Functionality - Basic Click
### Expected Behavior:
- Button should be clickable and show temporary "Executing..." state
- Success notification should appear after execution

### Test Steps:
1. Click the "Execute Action" button
2. Observe button state changes (disabled, text change)
3. Wait for button to return to normal state
4. Check for success notification message

### Results:
- [ ] Button becomes disabled when clicked
- [ ] Button text changes to "Executing..."
- [ ] Button returns to normal state after ~1 second
- [ ] Success notification appears: "Action executed successfully!"

## Test 5: Command Execution - Focus Auxiliary Bar
### Expected Behavior:
- The `workbench.action.focusAuxiliaryBar` command should execute
- This should focus the auxiliary bar (secondary sidebar)

### Test Steps:
1. Ensure auxiliary bar is visible (View > Appearance > Secondary Side Bar)
2. Focus on a different area (main editor)
3. Click the "Execute Action" button
4. Observe if focus moves to auxiliary bar

### Results:
- [ ] Auxiliary bar receives focus after button click
- [ ] Command executes without errors
- [ ] Console shows: "Executing workbench.action.focusAuxiliaryBar command"
- [ ] Console shows: "Successfully executed focusAuxiliaryBar command"

## Test 6: Command Execution - Expand Line Selection (With Text Focus)
### Expected Behavior:
- When a text editor has focus, `expandLineSelection` should execute
- Line selection should expand in the active editor

### Test Steps:
1. Open a text file in the editor
2. Place cursor on a line with text
3. Click the "Execute Action" button
4. Observe if line selection expands

### Results:
- [ ] Line selection expands when text editor has focus
- [ ] Console shows: "Text editor has focus, executing expandLineSelection command"
- [ ] Console shows: "Successfully executed expandLineSelection command"

## Test 7: Command Execution - No Text Focus
### Expected Behavior:
- When no text editor has focus, `expandLineSelection` should be skipped
- No errors should occur

### Test Steps:
1. Close all text editors or focus on a non-text area
2. Click the "Execute Action" button
3. Check console for appropriate message

### Results:
- [ ] No errors occur when no text editor is active
- [ ] Console shows: "No active text editor found, skipping expandLineSelection command"
- [ ] Success notification still appears

## Test 8: Error Handling - Command Failure
### Expected Behavior:
- If commands fail, error should be handled gracefully
- User should see error notification with helpful message

### Test Steps:
1. This is difficult to test directly, but check console for any errors
2. Verify that any errors are caught and displayed to user
3. Ensure extension doesn't crash on command failures

### Results:
- [ ] No unhandled errors in console
- [ ] Error handling code is in place
- [ ] Extension remains functional after any errors

## Test 9: Accessibility Testing
### Expected Behavior:
- Button should be accessible via keyboard navigation
- Screen readers should be able to interact with the interface

### Test Steps:
1. Use Tab key to navigate to the button
2. Press Enter or Space to activate the button
3. Verify button receives focus outline
4. Test with screen reader if available

### Results:
- [ ] Button is keyboard accessible
- [ ] Enter and Space keys trigger button click
- [ ] Focus outline is visible when button is focused
- [ ] Button has appropriate ARIA attributes

## Test 10: Extension Deactivation
### Expected Behavior:
- Extension should deactivate cleanly when VSCode closes
- No memory leaks or hanging processes

### Test Steps:
1. Close the VSCode development host
2. Check console for deactivation message
3. Verify no error messages during shutdown

### Results:
- [ ] Extension deactivates cleanly
- [ ] Console shows: "Basic VSCode Extension deactivated"
- [ ] No errors during shutdown process

## Test 11: Multiple Activations
### Expected Behavior:
- Extension should handle multiple button clicks gracefully
- No duplicate registrations or memory issues

### Test Steps:
1. Click the "Execute Action" button multiple times rapidly
2. Wait for all executions to complete
3. Check console for any duplicate messages or errors
4. Verify extension remains responsive

### Results:
- [ ] Multiple clicks handled gracefully
- [ ] No duplicate command registrations
- [ ] Extension remains responsive
- [ ] All executions complete successfully

## Test 12: Theme Compatibility
### Expected Behavior:
- Extension should work correctly in both light and dark themes
- Icon and UI elements should be visible in all themes

### Test Steps:
1. Switch to dark theme (File > Preferences > Color Theme)
2. Verify icon and UI are visible
3. Switch to light theme
4. Verify icon and UI are still visible
5. Test with high contrast themes if available

### Results:
- [ ] Extension works in dark theme
- [ ] Extension works in light theme
- [ ] Icon uses currentColor and adapts to theme
- [ ] UI elements are visible in all tested themes

## Summary
- Total Tests: 12
- Passed: ___
- Failed: ___
- Notes: _______________

## Issues Found
(Document any issues discovered during testing)

## Recommendations
(Document any improvements or fixes needed)