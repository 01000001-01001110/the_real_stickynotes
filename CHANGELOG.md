# Changelog

All notable changes to The Real StickyNotes will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-03

### Security

- Named-pipe IPC now requires a per-user token handshake; unauthenticated connections are rejected (`PERMISSION_DENIED`) and dropped. Closes an unauthenticated-local-access hole where any process could drive the full method registry. **Breaking for existing CLI automation** — the shipped CLI presents the token automatically; third-party clients must send an `auth` frame first.
- Locking a note now purges its plaintext version history (`note_history`), and history reads are refused while a note is locked.
- `is_locked`/`password_hash` can no longer be set through the generic note-update path — lock state only transitions via lock/unlock.
- Note-lock key derivation strengthened from PBKDF2 100k to 600k (SHA-256) with a versioned blob format; existing notes still decrypt and re-encrypt at the stronger setting on next lock.
- All note-content HTML render paths (load, live update, history restore) are now sanitized, not just paste.
- Added a per-note unlock throttle (lockout after repeated failures) to blunt password brute-forcing.

### Fixed

- **Named-pipe dispatch was completely broken** (registry shape mismatch) — every CLI command returned `METHOD_NOT_FOUND`. The standalone CLI now works end-to-end.
- Standalone CLI client used a Windows-only pipe path; now connects on macOS/Linux via the Unix domain socket.
- Pipe broadcasts and `app:*` control methods (window manager was never injected after startup).
- `app status` crashed on an undefined `getDatabasePath`.
- SQLite→YAML settings migration never ran (called a non-existent function).
- Note opacity slider could be dragged below the persistable range, silently failing to save and making a note invisible.
- Fixed macOS DMG builds failing to launch — `better-sqlite3` native module was broken by cross-compilation on ARM runner targeting x64
- Fixed macOS Gatekeeper blocking app entirely due to `hardenedRuntime: true` without code signing

### Added

- CLI parity: 26 previously-unreachable operations are now available over the pipe/CLI — permanent delete, trash stats/purge, password verify, version revert, tag delete/rename/cleanup, folder tree, wiki-link queries, config reset/get-multiple/default-paths, headless window control (open/close/show-all/hide-all), and attachment management. See `docs/cli-parity-map.md`.

### Changed

- Split macOS CI into native architecture runners (`macos-13` for x64, `macos-latest` for arm64)
- macOS builds are now signed with Developer ID Application certificate
- macOS builds are now notarized with Apple, eliminating the "Apple could not verify" warning
- Added `afterSign` hook with ad-hoc signing fallback for local/unsigned builds
- Added `@electron/notarize` dependency for Apple notarization

## [0.2.1] - 2026-02-26

### Security

- Removed 5 unconditional `console.log` calls in `autoLinkifyLastWord()` that leaked user keystrokes to the console in production
- Moved remaining informational `console.log` calls in settings IPC and updater to `console.error`/`debugLog` to follow project logging conventions

### Fixed

- Fixed updater crash when `BrowserWindow.getFocusedWindow()` returns null (tray-only mode) - now falls back to first available window
- Updated About section version placeholder to match actual version
- CI builds no longer attempt to auto-publish to GitHub Releases on every push (added `--publish never` to electron-builder)
- Artifact upload step is now non-blocking so builds succeed even when GitHub Actions storage quota is temporarily exceeded
- Fixed stale `the_true_stickynotes` repo references in issue templates and settings page

### Changed

- Rebranded app to **The Real StickyNotes** throughout (window titles, tray tooltip, installer, dialogs, README)
- Updated copyright holder from "StickyNotes Team" to "Alan Newingham" in LICENSE, electron-builder, and About section
- Updated README version badge from 0.1.0 to 0.2.1

### Added

- `.env.example` for developer onboarding

## [0.2.0] - 2026-02-24

### Security

- **CRITICAL**: Fixed confirm dialog using `nodeIntegration: true` - now uses contextBridge/preload pattern
- **HIGH**: Added URL protocol validation to `shell.openExternal` in navigation handler - only allows http/https
- **MEDIUM**: Removed certificate error bypass in development mode
- **MEDIUM**: Removed stale macOS audio-input entitlement from removed transcription feature
- Gated production console.log statements behind isDev to prevent information leakage

### Fixed

- Auto-update now checks the correct GitHub repository (`the_real_stickynotes`)
- Build scripts no longer run incorrect `npm run rebuild` after `electron-builder`
- CLI version fallback no longer shows stale `0.0.4` version
- CLI help documentation URL now points to the correct GitHub repository
- Copyright year updated to 2025-2026
- Replaced CPU spin-lock busy-wait in database retry logic with `Atomics.wait`

### Changed

- Pinned all production dependency versions (removed `^` ranges) for reproducible builds
- Replaced personal email with GitHub noreply address in package.json and SECURITY.md
- Updated project name references to be consistent across all config files

### Removed

- Removed `electron-icon-builder` devDependency (pulled in abandoned `phantomjs-prebuilt`)
- Removed dead code: `first-launch.js` empty stub
- Removed commented-out Sherpa-ONNX/transcription ghost code from `paths.js`
- Removed unused `getModelsPath` export

### Added

- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md` entry for v0.2.0
- Preload script for confirm dialog (`electron/preload-dialog.js`)
- Confirm dialog renderer script (`src/dialog/confirm-renderer.js`)

## [0.1.0] - 2025-02-02

### Added

- Floating sticky note windows with 8 color themes
- Rich text editing (bold, italic, underline, lists, checkboxes)
- Wiki-style note linking with `[[Note Title]]` syntax
- Full-text search across all notes
- Folder organization with hierarchy support
- Tag system for flexible categorization
- Note archiving and 30-day trash retention
- AES-256 encryption for sensitive notes
- Global keyboard shortcuts
- System tray integration
- Command-line interface (CLI) for automation
- Standalone CLI executable (no Node.js required)
- Named pipe IPC for fast CLI communication
- Cloud sync support (Dropbox, Google Drive, OneDrive, iCloud)
- Cross-platform support (Windows, macOS, Linux)
- GitHub Actions CI/CD with multi-platform builds
- Semantic release with conventional commits

### Security

- Local-first data storage
- Password-protected note encryption
- No telemetry or data collection

[0.2.1]: https://github.com/01000001-01001110/the_real_stickynotes/releases/tag/v0.2.1
[0.2.0]: https://github.com/01000001-01001110/the_real_stickynotes/releases/tag/v0.2.0
[0.1.0]: https://github.com/01000001-01001110/the_real_stickynotes/releases/tag/v0.1.0
