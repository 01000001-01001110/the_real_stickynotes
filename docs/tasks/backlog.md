# StickyNotes — Backlog / TODO

Captured 2026-07-02. Curated backlog (not the auto-appended `memory/context/active-tasks.md` log).

---

## 1. Whisper speech-to-text (Windows + macOS)

**Goal:** Dictate into a note. Download + set up a Whisper model on first use, transcribe locally, cross-platform, packaged with the rest of the app.

**History / context:**

- A `whisper.*` (+ `setup.*`) settings namespace previously existed and was **removed** in settings schema migration v2→v3 (`shared/database/settings-migration.js:59`). Restoring the feature means re-adding those keys to `shared/constants/settings.js` and reconciling the migration.

**Known blockers / gotchas (must handle):**

- **Microphone is currently blocked.** `electron/main.js:314` sets `session.defaultSession.setPermissionRequestHandler((_wc,_perm,cb) => cb(false))` — denies ALL permissions including `media`/`microphone`. Must selectively allow audio capture for the note (or a dedicated dictation) window, ideally scoped to that window's `webContents` only. Keep denying everything else.
- **Model size vs installer.** Don't bundle a multi-hundred-MB model in the installer. Download on demand into the data dir (`getAppDataPath()` / a `models/` subdir via `shared/utils/paths.js`), with progress UI, resumability, and a **checksum verify** after download. Offline-capable once present.
- **Native/runtime choice must be cross-platform (win-x64, mac-x64, mac-arm64):**
  - Options: `whisper.cpp` per-platform binaries (ship via electron-builder `extraResources`, `asarUnpack` the binary), OR `onnxruntime-node` + whisper ONNX, OR a maintained node wrapper (`nodejs-whisper`/`smart-whisper`). Whichever, verify prebuilds exist for all three targets and that it survives `electron-rebuild`/asar packaging like `better-sqlite3` already does.
  - Mic capture is renderer-side (`getUserMedia`) → PCM/WAV → hand to main process (or a worker) for transcription over IPC. Avoid blocking the main thread (transcription is CPU-heavy — use a worker/child process).
- **Settings + packaging:** re-add `whisper.model` (tiny/base/small…), `whisper.language`, `whisper.enabled` to the schema; wire download/setup into a settings pane; electron-builder.yml `extraResources` + `asarUnpack` for any native bits; per-arch mac builds (already the pattern).
- **Privacy:** transcription is local-only — document that no audio leaves the machine. Never log audio or transcripts.

**Acceptance:** first-run downloads model with progress + verify; dictation button in note UI; works on Win + both mac arches in a packaged build; mic permission granted only to the dictation surface.

---

## 2. Obfuscation → Telegram-style spoiler (redo the current effect)

**Current state (uncommitted work in `src/note/note.js` `toggleObfuscation` / `generateThreadSVG`):**

- Static SVG "thread texture" overlay positioned over the selection; click fades it out to reveal.
- **Two problems:** (a) it's a static texture, not the intended look; (b) it is **purely cosmetic and not persisted** — the overlay is a runtime DOM `<div>` over the text; the underlying text stays in the DOM and in the DB as plaintext, and the obfuscation is **lost on reload**.

**Goal:** Make it resemble Telegram's **spoiler** effect — an animated shimmering particle/dot noise field (moving specks) covering the text, revealed on click with an expanding dissolve.

**Work:**

- Replace the static thread SVG with an **animated particle field** (canvas or animated SVG/`requestAnimationFrame`) — fine-grained moving dots, Telegram-ish shimmer. Respect `appearance.enableAnimations` (disable motion when off).
- Reveal animation: expanding-circle / dissolve on click (Telegram-like), honoring reduced-motion.
- **Persist obfuscated ranges** so they survive reload: store the spoiler as markup in note content (e.g. a `<span class="spoiler">…</span>` mark) and re-render spoilers on note load, rather than an ephemeral overlay. Decide the storage representation and round-trip it through save/load + `content_plain` extraction (spoiler text should still be searchable? or not — decide).
- Keep the "not encryption" caveat clear: spoiler hides from shoulder-surfers only; for real secrecy use note lock/encryption.

**Acceptance:** animated Telegram-style spoiler; survives close/reopen; click-to-reveal with dissolve; respects animation/reduced-motion settings.

---

## 3. Buttoning up the in-progress note features

Small correctness/polish items in the current uncommitted note-window work:

- **Opacity slider range bug.** `src/note/index.html` slider is `min="0" max="100"`, but `shared/utils/validators.js:57-62` and the settings schema (`shared/constants/settings.js` "Window opacity 50-100") only allow **50–100**. Dragging below 50 sets the window transparent live via `setWindowOpacity`, but the debounced `api.updateNote(noteId,{opacity})` **fails validation and the return value is unchecked**, so it silently doesn't persist — and at 0% the note becomes invisible/unrecoverable. Fix: set slider `min="50"` (and clamp), OR relax validator+schema if sub-50 is intended. Also check the `updateNote` result and surface failures.
- **Verify new toolbar buttons** (ordered-list, font-size ±, clear-formatting) have correct `updateToolbarState` wiring and don't throw on empty selection.
- **`obfuscate` returns before `scheduleAutoSave()`** in `applyFormat` — intentional now (nothing persisted), but revisit once spoilers are persisted (item 2).

---

## Notes for future sessions

- Related runtime bugs surfaced during the 2026-07-02 architecture review (separate from the above): pipe-methods `createRegistry(stores)` vs `windowManager` arg mismatch, `getDatabasePath` not exported from `shared/database`, `migrateFromSQLite` referenced but never defined. Track/verify these independently.
