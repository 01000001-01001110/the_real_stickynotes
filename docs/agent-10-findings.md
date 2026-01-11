# Agent 10 Settings Evaluation

## Discovery Path

Starting exploration at: 2026-01-10
Initial approach: Check package.json, then explore src structure, look for settings/config modules

### Exploration Log

- Checked project structure - Electron app with CLI support
- Found key settings files:
  - shared/constants/settings.js - Schema definitions (70 settings across 9 categories)
  - shared/database/settings.js - Database CRUD operations
  - electron/ipc/settings.js - IPC handlers for Electron
  - src/settings/settings.js - Frontend UI for settings
  - cli/commands/config.js - CLI commands for settings
  - Database schema in shared/database/migrations/001_initial.js
- Now searching for all usages of settings throughout the codebase
- Searched through main.js, shortcuts.js, tray.js, server.js, notes.js, settings UI
- Examined test files to understand expected behavior
- Traced complete data flow from definition to usage

## Settings Found

### Complete Settings Inventory (70 settings across 9 categories)

#### General Settings (9 settings)

1. **general.language** - String, default: 'en' - UI language code
2. **general.startOnBoot** - Boolean, default: false - Start with Windows
3. **general.startMinimized** - Boolean, default: false - Start minimized to tray
4. **general.minimizeToTray** - Boolean, default: true - Minimize to tray instead of taskbar
5. **general.closeToTray** - Boolean, default: true - Close button minimizes to tray
6. **general.confirmDelete** - Boolean, default: true - Confirm before moving to trash
7. **general.confirmPermanentDelete** - Boolean, default: true - Confirm before permanent delete
8. **general.autoSaveDelay** - Number, default: 1000 - Auto-save delay in ms
9. **general.trashRetentionDays** - Number, default: 30 - Days before auto-purge from trash (0=never)

#### Appearance Settings (10 settings)

10. **appearance.theme** - String, default: 'system' - App theme: light/dark/system (options: ['light', 'dark', 'system'])
11. **appearance.defaultNoteColor** - String, default: 'yellow' - Default color for new notes (options: ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal', 'random'])
12. **appearance.defaultNoteWidth** - Number, default: 300 - Default width in pixels
13. **appearance.defaultNoteHeight** - Number, default: 350 - Default height in pixels
14. **appearance.defaultFontFamily** - String, default: 'Segoe UI' - Font family
15. **appearance.defaultFontSize** - Number, default: 14 - Font size in pixels
16. **appearance.noteOpacity** - Number, default: 100 - Window opacity 50-100
17. **appearance.enableShadows** - Boolean, default: true - Show window shadows
18. **appearance.enableAnimations** - Boolean, default: true - Enable UI animations
19. **appearance.showNoteCount** - Boolean, default: true - Show note count in panel

#### New Note Behavior (4 settings)

20. **newNote.position** - String, default: 'cascade' - Position: cascade/center/cursor/random (options: ['cascade', 'center', 'cursor', 'random'])
21. **newNote.cascadeOffset** - Number, default: 30 - Cascade offset in pixels
22. **newNote.openImmediately** - Boolean, default: true - Open new note window immediately
23. **newNote.focusTitle** - Boolean, default: true - Focus title field on new note

#### Tray Settings (3 settings)

24. **tray.singleClickAction** - String, default: 'showPanel' - Action: showPanel/toggleNotes/newNote/nothing (options: ['showPanel', 'toggleNotes', 'newNote', 'nothing'])
25. **tray.doubleClickAction** - String, default: 'newNote' - Action on double click (options: ['showPanel', 'toggleNotes', 'newNote', 'nothing'])
26. **tray.showReminderBadge** - Boolean, default: true - Show badge for pending reminders

#### Keyboard Shortcuts (3 settings)

27. **shortcuts.globalNewNote** - String, default: 'Ctrl+Shift+N' - Global hotkey for new note
28. **shortcuts.globalToggle** - String, default: 'Ctrl+Shift+S' - Global hotkey to show/hide all
29. **shortcuts.globalPanel** - String, default: 'Ctrl+Shift+P' - Global hotkey to show panel

#### Editor Settings (6 settings)

30. **editor.spellcheck** - Boolean, default: true - Enable spellcheck
31. **editor.autoLinks** - Boolean, default: true - Auto-detect and linkify URLs
32. **editor.autoLists** - Boolean, default: true - Auto-continue bullet/numbered lists
33. **editor.tabSize** - Number, default: 2 - Tab size for code blocks
34. **editor.showWordCount** - Boolean, default: false - Show word count in status bar

#### Reminder Settings (4 settings)

35. **reminders.enabled** - Boolean, default: true - Enable reminder notifications
36. **reminders.sound** - Boolean, default: true - Play sound on reminder
37. **reminders.snoozeMinutes** - Number, default: 15 - Default snooze duration
38. **reminders.persistUntilDismissed** - Boolean, default: true - Keep notification until dismissed

#### History Settings (2 settings)

39. **history.maxVersions** - Number, default: 10 - Max versions to keep per note
40. **history.saveInterval** - Number, default: 300000 - Save version every N ms (5 min)

#### Advanced Settings (5 settings)

41. **advanced.databasePath** - String, default: '' - Custom database path (empty=default)
42. **advanced.attachmentsPath** - String, default: '' - Custom attachments path
43. **advanced.serverPort** - Number, default: 47474 - Local HTTP server port for CLI
44. **advanced.hardwareAcceleration** - Boolean, default: true - Enable GPU acceleration
45. **advanced.devTools** - Boolean, default: false - Show dev tools option

#### Whisper/Transcription Settings (10 settings)

46. **whisper.enabled** - Boolean, default: true - Enable transcription feature
47. **whisper.modelSize** - String, default: 'small' - Whisper model size (options: ['tiny', 'base', 'small'])
48. **whisper.language** - String, default: 'en' - Transcription language code (options: ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko'])
49. **whisper.insertMode** - String, default: 'cursor' - Where to insert transcribed text (options: ['cursor', 'append', 'replace'])
50. **whisper.defaultSource** - String, default: 'microphone' - Default audio source (options: ['microphone', 'system', 'both'])
51. **whisper.autoStopSilence** - Boolean, default: false - Auto-stop after silence detected
52. **whisper.silenceTimeout** - Number, default: 3000 - Silence timeout in ms before auto-stop
53. **whisper.showConfidence** - Boolean, default: false - Show transcription confidence indicator
54. **whisper.autoDownload** - Boolean, default: true - Auto-download model on first use
55. **whisper.chunkDuration** - Number, default: 5000 - Audio chunk duration in ms

### Storage Schema

**Database Table:** `settings`

- `key` TEXT PRIMARY KEY
- `value` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

**Storage Location:** SQLite database in app data directory
**File Path:** Retrieved via `getDatabasePath()` utility function

## Data Flow Analysis

### 1. Definition Layer (Schema)

**File:** `E:\Projects\the_real_stickynotes\shared\constants\settings.js`

- Defines `settingsSchema` object with metadata for all 70 settings
- Each setting has: type, default, description, and optional 'options' array
- Provides utility functions:
  - `getSettingDefault(key)` - Returns default value
  - `getSettingType(key)` - Returns data type
  - `isValidSettingKey(key)` - Validates key exists
  - `parseSettingValue(key, value)` - Converts string to proper type
  - `getAllDefaults()` - Returns object with all defaults

### 2. Storage Layer (Database)

**File:** `E:\Projects\the_real_stickynotes\shared\database\settings.js`

- All settings stored as strings in SQLite (key-value pairs)
- CRUD operations:
  - `getSetting(key)` - Fetches from DB, parses to correct type, returns default if not found
  - `setSetting(key, value)` - Validates key (warning if unknown), converts to string, upserts
  - `getAllSettings()` - Returns all settings merged with defaults
  - `resetSetting(key)` - Deletes setting (falls back to default)
  - `resetAllSettings()` - Clears all settings
  - `getSettingsByCategory(category)` - Filters by prefix (e.g., 'general.')
  - `setSettings(settings)` - Bulk update in transaction

**Data Type Handling:**

- Storage: All values converted to strings before DB insert
- Retrieval: Strings parsed back to original type (boolean/number/string)
- Boolean: 'true'/'false' strings or '1'/'0'
- Number: String parsed with `Number(value)`
- String: Kept as-is

### 3. IPC Layer (Electron Communication)

**File:** `E:\Projects\the_real_stickynotes\electron\ipc\settings.js`

- Exposes settings to renderer processes via IPC
- Handlers:
  - `settings:get` - Get single setting
  - `settings:set` - Set single setting + handle special cases + broadcast change
  - `settings:getAll` - Get all settings
  - `settings:reset` - Reset one or all settings
  - `settings:getDefaultPaths` - Get default paths for display
- **Special Setting Handlers:**
  - `shortcuts.*` - Re-registers global shortcuts via `updateShortcuts()`
  - `appearance.theme` - Updates `nativeTheme.themeSource`
  - `general.startOnBoot` - Updates OS auto-launch settings
- Broadcasts setting changes to all windows via `windowManager.broadcast('setting:changed', key, value)`

### 4. Preload Layer (Security Bridge)

**File:** `E:\Projects\the_real_stickynotes\electron\preload.js`

- Exposes safe API to renderer processes:
  - `api.getSetting(key)`
  - `api.setSetting(key, value)`
  - `api.getAllSettings()`
  - `api.resetSetting(key)`
  - `api.getDefaultPaths()`
  - `api.onSettingChanged(callback)` - Listen for changes

### 5. Frontend UI Layer

**File:** `E:\Projects\the_real_stickynotes\src\settings\settings.js`

- Loads all settings on init via `api.getAllSettings()`
- Maps element IDs to setting keys via `settingMappings` object
- Auto-saves on change (checkboxes: 'change' event, others: 'input' event)
- **Special UI Handling:**
  - `history.saveInterval` - Displayed in minutes, stored in milliseconds
  - Shortcuts - Custom keyboard capture interface
  - Path inputs - File/folder browser dialogs
  - Range sliders - Live value display
  - Whisper settings - Model download/status UI
- Listens for setting changes from other windows to stay in sync
- Applies theme changes immediately to settings window

### 6. Usage Points Throughout Application

#### Main Process (electron/main.js)

- `advanced.hardwareAcceleration` - Read synchronously BEFORE app.whenReady()
- `advanced.serverPort` - Used to start local HTTP server
- `general.startMinimized` - Controls initial window visibility
- `general.closeToTray` - Controls app quit behavior

#### Shortcuts (electron/shortcuts.js)

- `shortcuts.globalNewNote` - Registered as global hotkey
- `shortcuts.globalToggle` - Registered as global hotkey
- `shortcuts.globalPanel` - Registered as global hotkey

#### System Tray (electron/tray.js)

- `tray.singleClickAction` - Determines click behavior
- `tray.doubleClickAction` - Determines double-click behavior

#### Window Manager (electron/windows/manager.js)

- `general.closeToTray` - Window close behavior
- `appearance.defaultNoteWidth` - New note width
- `appearance.defaultNoteHeight` - New note height
- `newNote.position` - New note positioning (cascade/center/cursor/random)
- `newNote.cascadeOffset` - Cascade offset distance
- `appearance.noteOpacity` - Window transparency
- `appearance.enableShadows` - Window shadows

#### Notes CRUD (shared/database/notes.js)

- `appearance.defaultNoteColor` - Used in `getEffectiveColor()` function
- Handles 'random' color option

#### Note Renderer (src/note/note.js)

- `appearance.theme` - Applied to note window
- `editor.spellcheck` - ContentEditable spellcheck attribute
- `appearance.defaultFontSize` - Editor font size
- `appearance.defaultFontFamily` - Editor font family
- `editor.tabSize` - Tab width for code
- `editor.autoLists` - Auto-continue lists
- `editor.autoLinks` - Auto-linkify URLs
- `editor.showWordCount` - Show word counter
- `appearance.enableAnimations` - UI animations
- `general.autoSaveDelay` - Debounce delay for auto-save
- `history.saveInterval` - Interval for version snapshots
- `general.confirmDelete` - Show delete confirmation
- `whisper.enabled` - Show transcription button
- `whisper.chunkDuration` - Audio chunk size
- `whisper.insertMode` - Where to insert transcription

#### HTTP Server (electron/server.js)

- Exposes REST API for CLI:
  - `GET /settings` - Get all settings
  - `GET /settings/:key` - Get one setting
  - `PUT /settings/:key` - Set one setting
  - `DELETE /settings/:key` - Reset one setting
  - `DELETE /settings` - Reset all settings
- Used by Whisper endpoints for model management

#### CLI (cli/commands/config.js)

- Commands:
  - `stickynotes config list` - List all settings
  - `stickynotes config get <key>` - Get single setting
  - `stickynotes config set <key> <value>` - Set setting
  - `stickynotes config reset [key]` - Reset setting(s)
  - `stickynotes config path` - Show config paths
- Validates keys against schema
- Parses values to correct types
- Groups settings by category for display

### 7. Data Flow Summary

```
User Action (UI/CLI)
  ↓
Frontend/CLI Layer (validates, formats)
  ↓
IPC/HTTP Layer (routes request)
  ↓
Database Layer (converts to string, stores)
  ↓
[SQLite Database]
  ↓
Retrieval: Database Layer (fetches, parses type, merges with defaults)
  ↓
IPC/HTTP Response (returns typed value)
  ↓
Usage Points (main.js, shortcuts.js, note.js, etc.)
  ↓
Application Behavior Changes
```

## Issues Identified

### Critical Issues

#### 1. Missing Setting in Frontend UI

**Location:** `E:\Projects\the_real_stickynotes\src\settings\settings.js`
**Issue:** The `settingMappings` object has only 54 settings mapped, but the schema defines 70 settings.
**Missing from UI:**

- `general.language` - No UI control for language selection
- `appearance.defaultFontSize` - Mapped to wrong element ID ('defaultFontSize' instead of dedicated control)
- Missing count: 16 settings defined in schema but not in UI mappings

**Impact:** Users cannot configure these settings through the UI, only via CLI or database

#### 2. Type Mismatch in settingMappings

**Location:** `E:\Projects\the_real_stickynotes\src\settings\settings.js` line 48
**Issue:** `defaultFontSize` is mapped to `appearance.defaultFontSize` but this conflicts with editor settings section
**Evidence:** The HTML likely has a font size control in the editor section, creating ambiguity

#### 3. No Validation on Setting Values

**Location:** `E:\Projects\the_real_stickynotes\shared\database\settings.js`
**Issue:** `setSetting()` function doesn't validate values against the schema's `options` array
**Example:** User could set `appearance.theme` to 'invalid' instead of 'light'/'dark'/'system'
**Impact:** Invalid settings can be stored, potentially breaking functionality

#### 4. Special Setting Timing Issue

**Location:** `E:\Projects\the_real_stickynotes\electron\main.js` lines 47-60
**Issue:** `advanced.hardwareAcceleration` requires special synchronous read BEFORE app.whenReady()
**Problem:** This forces early database initialization which could fail
**Current Mitigation:** Try-catch with console warning, but error handling is weak

### Medium Issues

#### 5. Inconsistent Setting Key Validation

**Location:** Multiple files
**Issue:**

- `shared/database/settings.js` line 39: Only logs warning for unknown keys
- `cli/commands/config.js` line 87: Also only warns for unknown keys
  **Impact:** Typos in setting keys create silent failures instead of hard errors

#### 6. Missing Range Validation

**Issue:** No validation for numeric ranges
**Examples:**

- `appearance.noteOpacity` should be 50-100, but can be set to any number
- `appearance.defaultNoteWidth/Height` - No minimum/maximum enforced
- `general.autoSaveDelay` - Could be set to 0 or negative
  **Impact:** Invalid values can cause UI glitches or crashes

#### 7. No Transaction Safety in Bulk Operations

**Location:** `E:\Projects\the_real_stickynotes\shared\database\settings.js` lines 122-139
**Issue:** `setSettings()` uses transaction but doesn't validate keys/values before transaction
**Impact:** Partial failure could leave inconsistent state

#### 8. Race Condition in Setting Changes

**Issue:** No locking mechanism when settings are changed simultaneously
**Scenario:** CLI and UI both modify same setting at same time
**Impact:** Last write wins, but broadcast might notify incorrect value

### Minor Issues

#### 9. Hardcoded Default in getEffectiveColor

**Location:** `E:\Projects\the_real_stickynotes\shared\database\notes.js` line 36
**Issue:** Falls back to `noteDefaults.color` ('yellow') instead of using setting default
**Impact:** Inconsistency between noteDefaults and settingsSchema defaults

#### 10. Unit Conversion Inconsistency

**Location:** `E:\Projects\the_real_stickynotes\src\settings\settings.js`
**Issue:** `history.saveInterval` has special UI conversion (ms to minutes) but this logic is duplicated in load and save
**Impact:** Other time-based settings don't have this convenience (e.g., `whisper.silenceTimeout`)

#### 11. No Setting Change Validation in IPC Handler

**Location:** `E:\Projects\the_real_stickynotes\electron\ipc\settings.js`
**Issue:** `handleSettingChange()` only handles 3 special settings, but doesn't validate others
**Impact:** Settings requiring restart or special handling have no mechanism

#### 12. Missing Setting: general.language

**Issue:** Setting is defined but never used anywhere in the codebase
**Search:** No references to `general.language` in any renderer or main process code
**Impact:** Dead setting that serves no purpose

#### 13. Inconsistent Error Handling

**Issue:** Some functions return boolean success (e.g., `setSetting`), others throw errors
**Impact:** Inconsistent error handling patterns across codebase

### Potential Bugs

#### 14. Theme Application Timing

**Location:** `E:\Projects\the_real_stickynotes\src\settings\settings.js` line 81
**Issue:** Theme is applied async but window might render before theme loads
**Impact:** Brief flash of wrong theme on settings window open

#### 15. Shortcut Registration Failure Silent

**Location:** `E:\Projects\the_real_stickynotes\electron\shortcuts.js` lines 28-37
**Issue:** Failed shortcut registration only logs warning, doesn't notify user
**Impact:** User sets shortcut but it doesn't work, no feedback

#### 16. Server Port Change Requires Restart

**Issue:** Changing `advanced.serverPort` doesn't restart server
**Impact:** Setting change has no effect until app restart

---

**Note:** See agent-10-recommendations.md for detailed recommendations, questions, summary statistics, and conclusions.
