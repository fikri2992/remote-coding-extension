# Terminal UI Problems (Mobile) and Revamp Plan

This note captures the issues observed in the current terminal UI on mobile (based on the provided screenshots), and proposes a concrete revamp that optimizes focus/typing, layout, and session controls for small screens.

## Problems Observed

- Cluttered top controls
  - "Clear", "Create Session", status pill, and "Refresh" compete in a single row and overflow/clip on small widths.
  - Controls sit above the viewport’s primary interaction area and are hard to reach one‑handed.
- Overbearing borders/shadows
  - Thick neo borders/shadows consume space and visually crowd the screen on mobile.
- Session chip ergonomics
  - Long, opaque session IDs take width and wrap/clip.
  - No obvious “switch” affordance besides tapping a tiny chip.
- Typing friction
  - Terminal does not always auto‑focus; keyboard requires tapping the terminal.
  - Focus hint is small and easy to miss.
- Action keys row
  - Useful, but mixed with other actions; small targets and easy to mis‑tap when keyboard is open.
- Status discoverability
  - Connection status pill is small and distant from the interactive area.

## Revamp Goals (Mobile‑First)

- Single‑column, low‑friction layout with maximal terminal area.
- Primary actions reachable at the bottom (thumb zone).
- Clear session management with an obvious sessions menu.
- Always‑ready typing: clear focus affordances and fast re‑focus after create/switch.
- Lighter chrome on mobile (reduced borders/shadows).

## Proposed Layout

1) Top area (compact)
- Title: “Terminal” and a small status badge (connected/disconnected).
- No action buttons up here on mobile.

2) Main terminal area (flex‑1)
- xterm fills remaining viewport height.
- Lighter border on mobile (remove heavy neo shadows for this container).

3) Bottom sticky toolbar (two rows)
- Row A: primary actions with large touch targets
  - Focus, Sessions, Create, Refresh, Clear
- Row B: action keys row (Ctrl, Alt, Tab, Esc, arrows)
- Toolbar is sticky and accounts for safe‑area insets.

4) Sessions menu (overlay panel)
- Button “Sessions” opens a full‑width bottom sheet listing active sessions (big tappable rows).
- Each row shows: short ID (last 6 chars), status dot, optional AI providers.
- Create button also present in the sheet.

## Implementation Highlights

- Move all action buttons to a sticky bottom toolbar; leave only status at top.
- Make the terminal tap‑to‑focus and auto‑focus on create/switch.
- Replace long session chips with a Sessions menu (overlay) and a small current-session label.
- Reduce or remove neo heavy borders for the terminal container on mobile.
- Add simple debug toggles already implemented: client (localStorage) + server (setting/env).

## Acceptance

- Typing on mobile requires 0–1 taps (focus retained after create/switch; Focus button available).
- Primary actions are reachable with one hand.
- Sessions are easy to list and switch without horizontal overflow.
- Terminal area uses most of the screen with minimal chrome.

