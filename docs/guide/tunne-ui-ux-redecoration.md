# Tunnel Manager (Mobile‑first) — UX Redecoration Plan

This document proposes a simpler, mobile‑first redesign for the Tunnel Manager experience. It focuses on one‑tap actions, progressive disclosure for advanced options, and clear first‑run guidance when Cloudflared is not installed.

Referenced code:
- Frontend page: `src/webview/react-frontend/src/pages/TunnelManagerPage.tsx`
- Components: `src/webview/react-frontend/src/components/TunnelForm.tsx`, `TunnelList.tsx`, `TunnelActions.tsx`
- WS service: `src/cli/server.ts` (registerService `tunnels` with ops `list`, `status`, `create`, `stop`, `stopAll`, `install`)
- Cloudflared integration: `src/server/CloudflaredManager.ts`

---

## Goals
- Make the UI fast and obvious on small screens (one primary action per screen).
- Default to Quick Tunnel; keep Named Tunnel behind an “Advanced” disclosure.
- Minimize cognitive load: fewer fields, clearer labels, large tap targets.
- Offer a clear first‑run path to install Cloudflared when missing.
- Streamline share actions (Copy/QR) with reachable controls.

## Non‑Goals
- Full Cloudflare account setup beyond token input.
- Persisting heavy logs or analytics client‑side.

---

## Primary Jobs‑To‑Be‑Done
- Start a public tunnel to a local port (e.g., 3000, 5173, 8000) quickly.
- See the public URL and share it instantly (copy, QR, open).
- Stop one tunnel or stop all tunnels (with confirmation) safely.
- Optionally run a named tunnel using a token when needed.

---

## Information Architecture (Mobile‑first)
1. Header: “Tunnels”
2. First‑run CTA (if Cloudflared missing): install card with one big button
3. Quick Connect section (defaults): port input + “Start Tunnel” primary button
   - Quick port chips: 3000 · 5173 · 8000
4. Advanced (collapsible): “Named Tunnel” (Name + Token) → “Start Named Tunnel”
5. Active Tunnels list (cards): URL, status, basic metadata, actions
6. Bulk actions: Refresh · Stop All
7. Sticky bottom bar (on small viewports): “Start Tunnel” when form scrolls off‑screen

---

## First‑Run / Empty States
- If Cloudflared is NOT installed:
  - Show a prominent install card with a single primary button: “Install Cloudflared”.
  - Subtext: “Securely expose your local app to the internet.”
  - After install success, reveal Quick Connect automatically.
- If installed but no tunnels:
  - Show Quick Connect front‑and‑center with port field prefilled (remember last port).

---

## Simplified Interactions
- Quick Connect
  - Fields: Local Port (numeric only)
  - Primary: “Start Tunnel”
  - Quick chips: [3000] [5173] [8000]
- Named Tunnel (Advanced)
  - Accordion reveals: Name + Token fields
  - Primary: “Start Named Tunnel”
- Active Tunnels (card per tunnel)
  - Title: Name or short ID tail
  - Status pill: running / starting / stopped / error
  - URL line with open‑in‑browser and copy action
  - Compact meta: Local Port, Type, PID, Created time
  - Actions: [QR] [Copy] [Stop]
- Bulk actions row above list:
  - [Refresh] [Stop All] (with confirmation)

---

## Accessibility & Mobile Details
- Tap targets ≥ 44px with generous spacing.
- Stick primary actions near thumb reach (bottom bar on mobile).
- Clear focus styles and ARIA labels for inputs and actions.
- Avoid inputs jumping on soft‑keyboard show: use safe layout and no fixed elements under the keyboard area.

---

## Visual System
- Primary action: filled button, full‑width on mobile.
- Secondary actions: outline/ghost with clear iconography.
- Minimal color palette for states:
  - Running: green
  - Starting: blue
  - Stopping: yellow
  - Error: red
  - Inactive: gray
- Skeletons for loading states and empty list placeholder copy.

---

## Error & Edge‑Case States
- Install failure: show error toast and provide retry/install manual link.
- Tunnel start failure: show inline error on card with retry.
- Stop failure: toast + keep the card, mark as error.
- URL extraction timeout: show a helpful message to re‑try or check local port.

---

## Performance
- Debounce Refresh button and avoid spamming backend.
- Keep list rendering lightweight; virtualize if many cards (rare).
- Background drain of tunnel stdout/stderr is handled server‑side (see `CloudflaredManager.ts`).

---

## WS/Backend Integration
- Existing WS ops (in `src/cli/server.ts`):
  - `tunnels.list`, `tunnels.status`, `tunnels.create`, `tunnels.stop`, `tunnels.stopAll`, `tunnels.install`
- Proposed UI wiring:
  - First‑run “Install Cloudflared” → `tunnels.install`
  - Quick Connect → `tunnels.create` with `{ type: 'quick', localPort }`
  - Named → `tunnels.create` with `{ type: 'named', localPort, name?, token? }`
  - Stop → `tunnels.stop` with `{ id }`
  - Stop All → `tunnels.stopAll`
  - Refresh → `tunnels.list` (and/or `tunnels.status`)

---

## Implementation Checklist
- Page shell (`TunnelManagerPage.tsx`)
  - Show first‑run install card when Cloudflared missing (call `tunnels.status` or `tunnels.install`).
  - Elevate Quick Connect; move Named Tunnel behind an accordion.
  - Add quick chips for common ports.
  - Add sticky bottom bar (mobile only) for primary action.
- Form (`TunnelForm.tsx`)
  - Reduce fields shown by default to only Local Port.
  - Move Name + Token under “Advanced”.
  - Make submit buttons large and full‑width on mobile.
- List (`TunnelList.tsx`)
  - Simplify card layout: URL row, status pill, compact meta.
  - Prominent Copy and QR actions; Stop button with clear label.
- Actions (`TunnelActions.tsx`)
  - Keep Refresh and Stop All; add confirm dialog for Stop All (already supported).
- Toasts
  - Success: created/installed/stopped
  - Error: create/stop/install failure

---

## Metrics (Optional)
- Time‑to‑first‑tunnel from page load.
- Tap counts for Quick vs Named.
- Stop All confirmations and cancellations.

---

## Open Questions
- Do we want a small, persistent banner when Cloudflared is missing across the app?
- Should we remember last used port globally or per workspace?
- Do we need a one‑tap “Share link” integration beyond Copy/QR?
