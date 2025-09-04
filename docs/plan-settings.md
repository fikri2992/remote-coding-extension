# Settings — Safe Remote Configuration

Outcome: Read and update extension settings remotely in a controlled way. Initially only `httpPort` is supported (matching current backend), shown with clear validation and feedback.

Current state

- `src/server/ConfigurationManager.ts` loads, validates, and updates `httpPort` (supports `.remote-coding/config.json` and VS Code workspace settings). Emits changes.

Protocol (WS v1)

- Envelope: `{ type: 'config', id?, data: { configData: { operation, key?, value?, schema? } } }`
- Ops:
  - `get`: return current effective config and source (file vs workspace) + server diagnostics.
  - `schema`: return validation schema for UI forms.
  - `update`: validate and update allowed keys (currently `httpPort` only).
  - `reset`: restore defaults (delegates to `ConfigurationManager.resetToDefaults()`).

Server tasks

- WS routing: Add `type === 'config'` handling, call `ConfigurationManager` methods, return normalized responses.
- Validation: Return clear messages for invalid ports or in‑use ports; suggest alternatives.
- Diagnostics: Enrich response with `HttpServer.getDiagnostics()` snapshot (helpful UI context).

Frontend tasks

- `SettingsPage.tsx` UI:
  - Read schema and current config on mount; render form with client‑side constraints.
  - Submit `update` and reflect success/errors; show port change hint (restart may be required).
  - Buttons: Reset to defaults; Open web interface; Copy URLs.
- UX: Disable unsupported keys; show origin (file vs workspace) and quick link to open `.remote-coding/config.json`.

Checklists

- Server
  - [ ] WS `config` ops wired to `ConfigurationManager`.
  - [ ] Responses include `diagnostics` and `serverStatus`.
  - [ ] Errors normalized with codes and messages.
- Frontend
  - [ ] Form with inline validation; submit disabled until dirty + valid.
  - [ ] Toasts for success/failure; optimistic update on trivial changes.
  - [ ] Respect read‑only states (no workspace open, etc.).
- QA
  - [ ] Invalid port → specific error and suggestion.
  - [ ] Port in use → fallback suggestion surfaced.
  - [ ] File and workspace config sources both supported.

Acceptance criteria

- User can view and update `httpPort` from mobile; errors read well and guide next steps.
- Reset to defaults works and is reflected in UI within 1s.

