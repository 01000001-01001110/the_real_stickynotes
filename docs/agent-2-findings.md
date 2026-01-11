# Agent 2 Settings Evaluation

## Discovery Path

Started exploration by:

1. Reading package.json to understand project structure
2. Found settings-related files via Glob search:
   - `E:\Projects\the_real_stickynotes\electron\ipc\settings.js` - IPC handlers for settings
   - `E:\Projects\the_real_stickynotes\shared\constants\settings.js` - Settings schema/definitions
   - `E:\Projects\the_real_stickynotes\shared\database\settings.js` - Database CRUD operations
   - `E:\Projects\the_real_stickynotes\src\settings\settings.js` - Frontend settings UI
3. Read database migration to understand storage schema
4. Currently tracing usage patterns throughout codebase

## Settings Schema Definition

**Location**: `E:\Projects\the_real_stickynotes\shared\constants\settings.js`

This is the authoritative source for all application settings. Contains:

- Complete schema with 70+ settings
- Type definitions (string, boolean, number)
- Default values for each setting
- Descriptions for documentation
- Options arrays for enum-like settings

### Settings Categories:

1. **general** (8 settings): startOnBoot, startMinimized, minimizeToTray, closeToTray, confirmDelete, confirmPermanentDelete, autoSaveDelay, trashRetentionDays
2. **appearance** (10 settings): theme, defaultNoteColor, defaultNoteWidth, defaultNoteHeight, defaultFontFamily, defaultFontSize, noteOpacity, enableShadows, enableAnimations, showNoteCount
3. **newNote** (4 settings): position, cascadeOffset, openImmediately, focusTitle
4. **tray** (3 settings): singleClickAction, doubleClickAction, showReminderBadge
5. **shortcuts** (3 settings): globalNewNote, globalToggle, globalPanel
6. **editor** (5 settings): spellcheck, autoLinks, autoLists, tabSize, showWordCount
7. **reminders** (4 settings): enabled, sound, snoozeMinutes, persistUntilDismissed
8. **history** (2 settings): maxVersions, saveInterval
9. **advanced** (5 settings): databasePath, attachmentsPath, serverPort, hardwareAcceleration, devTools
10. **whisper** (10 settings): enabled, modelSize, language, insertMode, defaultSource, autoStopSilence, silenceTimeout, showConfidence, autoDownload, chunkDuration

**Total**: 54 settings defined in schema

## Database Storage

**Location**: `E:\Projects\the_real_stickynotes\shared\database\migrations\001_initial.js`

**Table Schema**:

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

**Storage Model**:

- Key-value store with simple structure
- All values stored as TEXT (strings)
- Type conversion happens at runtime via `parseSettingValue()`
- No default values in database (fetched from schema if not present)
- Updated timestamp tracked for each setting

## Database Operations

**Location**: `E:\Projects\the_real_stickynotes\shared\database\settings.js`

**Functions**:

1. `getSetting(key)` - Retrieves setting, falls back to default from schema
2. `setSetting(key, value)` - Upserts setting, validates against schema, converts to string
3. `getAllSettings()` - Returns all settings merged with defaults
4. `resetSetting(key)` - Deletes setting from DB (reverts to default)
5. `resetAllSettings()` - Deletes all settings
6. `getSettingsByCategory(category)` - Filters settings by prefix
7. `setSettings(settings)` - Bulk update in transaction

**Type Conversion**: Settings are stored as strings but parsed to correct types:

- Boolean: `'true'` or `'1'` → `true`, else `false`
- Number: String → `Number(value)`
- String: Direct conversion

**Validation**: Warns for unknown keys but allows them (soft validation)

## IPC Layer (Electron)

**Location**: `E:\Projects\the_real_stickynotes\electron\ipc\settings.js`

**IPC Handlers**:

- `settings:get` → `getSetting(key)`
- `settings:set` → `setSetting(key, value)` + special handling + broadcast
- `settings:getAll` → `getAllSettings()`
- `settings:reset` → `resetSetting(key)` or `resetAllSettings()`
- `settings:getDefaultPaths` → Returns appData, database, attachments paths

**Special Setting Handlers**:

1. **Shortcuts** (`shortcuts.globalNewNote`, `shortcuts.globalToggle`, `shortcuts.globalPanel`):
   - Triggers `updateShortcuts()` to re-register global hotkeys
2. **Theme** (`appearance.theme`):
   - Updates `nativeTheme.themeSource` immediately ('dark', 'light', 'system')
3. **Auto-launch** (`general.startOnBoot`):
   - Calls `updateAutoLaunch()` to modify Electron login items

**Broadcasting**: All setting changes broadcast to all windows via `windowManager.broadcast('setting:changed', key, value)`

## Frontend UI

**Location**: `E:\Projects\the_real_stickynotes\src\settings\settings.js`

**Element Mapping**: Maps HTML element IDs to setting keys (76 mappings defined)

**Notable Mappings**:

- Element IDs use camelCase without category prefix
- Setting keys use dot notation with category
- Example: `startOnBoot` (element) → `general.startOnBoot` (key)

**UI Features**:

1. Auto-save on change (no manual save button)
2. Range inputs with live value display
3. Shortcut recorder (captures key combinations)
4. Directory pickers for paths
5. Theme preview/application
6. Whisper model download/status UI

**Data Transformations**:

- `history.saveInterval`: Stored in milliseconds, displayed in minutes
  - Display = ms / 60000
  - Store = minutes \* 60000

## Settings Found (Complete List)

### General Settings

| Key                            | Type    | Default | Used For                      |
| ------------------------------ | ------- | ------- | ----------------------------- |
| general.language               | string  | 'en'    | UI language code              |
| general.startOnBoot            | boolean | false   | Auto-launch with OS           |
| general.startMinimized         | boolean | false   | Start in tray                 |
| general.minimizeToTray         | boolean | true    | Minimize behavior             |
| general.closeToTray            | boolean | true    | Close button behavior         |
| general.confirmDelete          | boolean | true    | Trash confirmation            |
| general.confirmPermanentDelete | boolean | true    | Permanent delete confirmation |
| general.autoSaveDelay          | number  | 1000    | Debounce delay (ms)           |
| general.trashRetentionDays     | number  | 30      | Auto-purge trash (0=never)    |

### Appearance Settings

| Key                          | Type    | Default    | Options                                                           |
| ---------------------------- | ------- | ---------- | ----------------------------------------------------------------- |
| appearance.theme             | string  | 'system'   | light, dark, system                                               |
| appearance.defaultNoteColor  | string  | 'yellow'   | yellow, pink, blue, green, purple, orange, gray, charcoal, random |
| appearance.defaultNoteWidth  | number  | 300        | Pixels                                                            |
| appearance.defaultNoteHeight | number  | 350        | Pixels                                                            |
| appearance.defaultFontFamily | string  | 'Segoe UI' | Font name                                                         |
| appearance.defaultFontSize   | number  | 14         | Pixels                                                            |
| appearance.noteOpacity       | number  | 100        | 50-100                                                            |
| appearance.enableShadows     | boolean | true       | Window shadows                                                    |
| appearance.enableAnimations  | boolean | true       | UI animations                                                     |
| appearance.showNoteCount     | boolean | true       | Panel note count                                                  |

### New Note Settings

| Key                     | Type    | Default   | Options                         |
| ----------------------- | ------- | --------- | ------------------------------- |
| newNote.position        | string  | 'cascade' | cascade, center, cursor, random |
| newNote.cascadeOffset   | number  | 30        | Pixels                          |
| newNote.openImmediately | boolean | true      | Open on creation                |
| newNote.focusTitle      | boolean | true      | Focus title field               |

### Tray Settings

| Key                    | Type    | Default     | Options                                  |
| ---------------------- | ------- | ----------- | ---------------------------------------- |
| tray.singleClickAction | string  | 'showPanel' | showPanel, toggleNotes, newNote, nothing |
| tray.doubleClickAction | string  | 'newNote'   | showPanel, toggleNotes, newNote, nothing |
| tray.showReminderBadge | boolean | true        | Badge display                            |

### Keyboard Shortcuts

| Key                     | Type   | Default        | Purpose       |
| ----------------------- | ------ | -------------- | ------------- |
| shortcuts.globalNewNote | string | 'Ctrl+Shift+N' | Create note   |
| shortcuts.globalToggle  | string | 'Ctrl+Shift+S' | Show/hide all |
| shortcuts.globalPanel   | string | 'Ctrl+Shift+P' | Show panel    |

### Editor Settings

| Key                  | Type    | Default | Purpose           |
| -------------------- | ------- | ------- | ----------------- |
| editor.spellcheck    | boolean | true    | Spellcheck        |
| editor.autoLinks     | boolean | true    | URL linkification |
| editor.autoLists     | boolean | true    | List continuation |
| editor.tabSize       | number  | 2       | Code block tabs   |
| editor.showWordCount | boolean | false   | Status bar        |

### Reminder Settings

| Key                             | Type    | Default | Purpose                  |
| ------------------------------- | ------- | ------- | ------------------------ |
| reminders.enabled               | boolean | true    | Notifications            |
| reminders.sound                 | boolean | true    | Sound playback           |
| reminders.snoozeMinutes         | number  | 15      | Default snooze           |
| reminders.persistUntilDismissed | boolean | true    | Notification persistence |

### History Settings

| Key                  | Type   | Default | Purpose           |
| -------------------- | ------ | ------- | ----------------- |
| history.maxVersions  | number | 10      | Per-note versions |
| history.saveInterval | number | 300000  | 5 minutes in ms   |

### Advanced Settings

| Key                           | Type    | Default | Purpose                   |
| ----------------------------- | ------- | ------- | ------------------------- |
| advanced.databasePath         | string  | ''      | Custom DB location        |
| advanced.attachmentsPath      | string  | ''      | Custom attachments folder |
| advanced.serverPort           | number  | 47474   | CLI server port           |
| advanced.hardwareAcceleration | boolean | true    | GPU acceleration          |
| advanced.devTools             | boolean | false   | Dev tools menu            |

### Whisper/Transcription Settings

| Key                     | Type    | Default      | Options                                              |
| ----------------------- | ------- | ------------ | ---------------------------------------------------- |
| whisper.enabled         | boolean | true         | Feature toggle                                       |
| whisper.modelSize       | string  | 'small'      | tiny, base, small                                    |
| whisper.language        | string  | 'en'         | auto, en, es, fr, de, it, pt, nl, pl, ru, zh, ja, ko |
| whisper.insertMode      | string  | 'cursor'     | cursor, append, replace                              |
| whisper.defaultSource   | string  | 'microphone' | microphone, system, both                             |
| whisper.autoStopSilence | boolean | false        | Auto-stop on silence                                 |
| whisper.silenceTimeout  | number  | 3000         | Milliseconds                                         |
| whisper.showConfidence  | boolean | false        | Confidence indicator                                 |
| whisper.autoDownload    | boolean | true         | Auto-download model                                  |
| whisper.chunkDuration   | number  | 5000         | Milliseconds                                         |

## Data Flow Analysis

### Setting Read Flow:

1. Frontend calls `api.getSetting(key)` via preload API
2. IPC handler `settings:get` receives request
3. Calls `getSetting(key)` from database module
4. Database queries: `SELECT value FROM settings WHERE key = ?`
5. If found: Parse value to correct type via `parseSettingValue()`
6. If not found: Return default from `settingsSchema`
7. Return to frontend

### Setting Write Flow:

1. Frontend calls `api.setSetting(key, value)`
2. IPC handler `settings:set` receives request
3. Validates key exists in schema (soft validation - warns if unknown)
4. Converts value to string for storage
5. Upserts to database with timestamp
6. Calls `handleSettingChange()` for special cases (shortcuts, theme, auto-launch)
7. Broadcasts `setting:changed` event to all windows
8. Returns success to frontend

### Initialization Flow:

1. Settings UI calls `api.getAllSettings()`
2. Database returns all stored settings merged with defaults
3. UI populates form elements from merged settings object
4. Special handling for transformed values (e.g., saveInterval ms→minutes)

## Issues Identified

### 1. **Missing Settings in UI Mapping**

**File**: `E:\Projects\the_real_stickynotes\src\settings\settings.js`

The `settingMappings` object defines 76 element→key mappings, but the schema has 54 settings. Need to verify which settings are missing UI elements.

**Missing from UI mappings**:

- `general.language` - No UI element
- `appearance.defaultFontSize` - Mapped to wrong element ID (`defaultFontSize` maps to nothing, appears in editor section incorrectly)

**Potential Issue**: Some settings may be defined but not configurable through UI.

### 2. **Type Conversion Inconsistency**

**File**: `E:\Projects\the_real_stickynotes\shared\database\settings.js`

The `parseSettingValue()` function converts strings to types, but there's no validation:

- No range checking for numbers (e.g., opacity should be 50-100)
- No enum validation for string options (e.g., theme must be 'light'|'dark'|'system')
- Boolean parsing accepts `'true'` or `'1'` but what about other truthy values?

**Risk**: Invalid values can be stored and parsed incorrectly.

### 3. **Soft Validation Only**

**File**: `E:\Projects\the_real_stickynotes\shared\database\settings.js`, Line 39

```javascript
if (!isValidSettingKey(key)) {
  console.warn(`Unknown setting key: ${key}`);
}
```

Only logs a warning - doesn't throw error or reject. Unknown settings can be stored in database.

**Risk**: Typos in setting keys will silently fail or create orphaned data.

### 4. **No Schema Version Tracking**

Settings schema changes over time, but there's no version tracking mechanism. If a setting is:

- Renamed: Old value remains in DB, new key gets default
- Removed: Old value remains in DB forever
- Type changed: Old value may parse incorrectly

**Risk**: Schema drift and database bloat over time.

### 5. **Special Handler Dependency**

**File**: `E:\Projects\the_real_stickynotes\electron\ipc\settings.js`, Lines 68-92

Only 3 settings have special handlers:

- Shortcuts (3 settings)
- Theme (1 setting)
- Auto-launch (1 setting)

**Question**: What about other settings that might need immediate action?

- `advanced.hardwareAcceleration` - Requires app restart
- `advanced.serverPort` - Requires server restart
- `whisper.modelSize` - Should it trigger validation?

**Risk**: Settings that require restart or immediate action have no warnings.

### 6. **Data Transform in UI Only**

**File**: `E:\Projects\the_real_stickynotes\src\settings\settings.js`, Lines 148-150, 226-228

`history.saveInterval` is stored in milliseconds but displayed in minutes. The transformation is ONLY in the UI layer, not in the database layer.

**Risk**:

- CLI or API users see milliseconds
- Inconsistent between interfaces
- If UI bug occurs, wrong value could be saved

### 7. **No Setting Change History**

Settings table has `updated_at` but no audit trail of WHO changed WHAT and WHEN.

**Risk**: No way to debug "why did this setting change?" or rollback.

### 8. **Broadcasting to All Windows**

**File**: `E:\Projects\the_real_stickynotes\electron\ipc\settings.js`, Line 43

All setting changes broadcast to all windows via `setting:changed` event.

**Question**: What if a window is processing a setting change and receives its own broadcast?
**Risk**: Potential for feedback loops or double-processing.

## Improvement Recommendations

### High Priority

1. **Add Strong Validation**

   - Validate setting values against schema options
   - Add range checking for number types
   - Reject invalid values instead of warning
   - Example: Check `appearance.noteOpacity` is between 50-100

2. **Implement Schema Migrations**

   - Track schema version in database
   - Migrate old setting keys to new ones
   - Clean up removed settings
   - Handle type changes gracefully

3. **Add UI Warnings for Restart-Required Settings**

   - Mark settings like `hardwareAcceleration`, `serverPort` with restart indicator
   - Show notification after change
   - Offer "Restart Now" button

4. **Normalize Data Transformations**
   - Move transformations to database layer or schema
   - Create `displayValue` and `storageValue` conversion functions
   - Apply consistently across UI, CLI, and API

### Medium Priority

5. **Complete UI Coverage**

   - Add UI elements for all schema settings
   - Verify `general.language` has UI control
   - Audit mapping consistency

6. **Add Setting Change Audit**

   - Create `settings_history` table
   - Log: key, old_value, new_value, changed_at, changed_by (window ID?)
   - Useful for debugging and rollback

7. **Prevent Broadcast Loops**

   - Track origin window in broadcast
   - Don't broadcast back to sender
   - Or: debounce/deduplicate broadcasts

8. **Document Setting Dependencies**
   - Which settings affect which features?
   - Which settings require restart?
   - Which settings are mutually exclusive?
   - Add to schema metadata

### Low Priority

9. **Setting Presets/Profiles**

   - Allow saving/loading setting configurations
   - Useful for "Light Mode Profile" vs "Dark Mode Profile"
   - Import/export functionality

10. **Type-Safe Constants**
    - Generate TypeScript types from schema
    - Prevent typos in setting keys
    - Better IDE autocomplete

## Questions/Uncertainties

1. **Where are settings used in actual application code?**

   - Need to trace all `getSetting()` calls
   - Are all 54 settings actually used?
   - Any dead settings that should be removed?

2. **How does CLI interact with settings?**

   - Does CLI have its own settings interface?
   - Does it respect all settings or subset?

3. **What happens on first launch?**

   - Are defaults applied to database?
   - Or only fetched when requested?

4. **Thread safety in database operations?**

   - Multiple windows could set settings simultaneously
   - Is better-sqlite3 handling this correctly?

5. **Testing coverage?**
   - Are settings CRUD operations tested?
   - Are type conversions tested?
   - Are special handlers tested?

## Usage Analysis

Searched for all `getSetting()` calls across the codebase. Found 18 files using settings:

### Backend (Electron Main Process)

1. **E:\Projects\the_real_stickynotes\electron\main.js**

   - `advanced.hardwareAcceleration` - Disables GPU if false (BEFORE app ready)
   - `advanced.serverPort` - Starts HTTP server for CLI
   - `general.startMinimized` - Controls initial window visibility
   - `general.closeToTray` - Controls close button behavior

2. **E:\Projects\the_real_stickynotes\electron\shortcuts.js**

   - `shortcuts.globalNewNote` - Register global hotkey
   - `shortcuts.globalToggle` - Register global hotkey
   - `shortcuts.globalPanel` - Register global hotkey

3. **E:\Projects\the_real_stickynotes\electron\windows\manager.js**

   - `general.closeToTray` - Panel close behavior
   - `appearance.defaultNoteWidth` - New note sizing
   - `appearance.defaultNoteHeight` - New note sizing
   - `newNote.position` - Where to position new notes
   - `newNote.cascadeOffset` - Cascade positioning offset
   - `appearance.noteOpacity` - Window transparency
   - `appearance.enableShadows` - Window shadow effects

4. **E:\Projects\the_real_stickynotes\electron\tray.js**

   - `tray.singleClickAction` - Tray click behavior
   - `tray.doubleClickAction` - Tray double-click behavior

5. **E:\Projects\the_real_stickynotes\electron\reminders.js**

   - (Likely uses reminder settings - need to verify)

6. **E:\Projects\the_real_stickynotes\shared\database\notes.js**

   - `appearance.defaultNoteColor` - Default color for new notes

7. **E:\Projects\the_real_stickynotes\shared\database\history.js**
   - `history.maxVersions` - Prune old versions

### Frontend (Renderer Process)

1. **E:\Projects\the_real_stickynotes\src\note\note.js**

   - `appearance.theme` - Dark/light mode
   - `editor.spellcheck` - Editor spellcheck
   - `appearance.defaultFontSize` - Note font size
   - `appearance.defaultFontFamily` - Note font family
   - `editor.tabSize` - Tab size in code blocks
   - `editor.autoLists` - Auto-continue lists
   - `editor.autoLinks` - Auto-detect URLs
   - `editor.showWordCount` - Show word counter
   - `appearance.enableAnimations` - UI animations
   - `general.autoSaveDelay` - Auto-save debounce
   - `history.saveInterval` - History auto-save interval
   - `general.confirmDelete` - Delete confirmation
   - `whisper.enabled` - Transcription feature
   - `whisper.chunkDuration` - Audio chunk size
   - `whisper.insertMode` - Where to insert transcribed text

2. **E:\Projects\the_real_stickynotes\src\panel\panel.js**

   - (Uses settings - need to check specifics)

3. **E:\Projects\the_real_stickynotes\src\settings\settings.js**

   - ALL settings (settings UI)

4. **E:\Projects\the_real_stickynotes\src\imageviewer\imageviewer.js**
   - (Minimal - likely just theme)

### CLI

1. **E:\Projects\the_real_stickynotes\cli\commands\config.js**
   - Full settings CRUD interface
   - Can get/set/list/reset any setting

### Potentially Unused Settings

Settings defined in schema but NOT found in code searches:

1. **general.language** - ⚠️ DEAD CODE

   - Defined but never used
   - No i18n/localization implementation found
   - Should be removed or implemented

2. **newNote.focusTitle** - ⚠️ DEAD CODE

   - Only found in settings UI and schema
   - Not used in window manager or note creation

3. **newNote.openImmediately** - ⚠️ DEAD CODE

   - Only found in settings UI and schema
   - Not used in window manager

4. **reminders.sound** - ✓ VERIFIED USED

   - File: `electron/reminders.js`, Line 104
   - Usage: `const playSound = getSetting('reminders.sound');`
   - Controls notification sound (silent: !playSound)

5. **reminders.snoozeMinutes** - ✓ VERIFIED USED

   - File: `electron/reminders.js`, Line 159
   - Usage: `const snoozeMinutes = minutes || getSetting('reminders.snoozeMinutes');`
   - Default snooze duration when not specified

6. **reminders.persistUntilDismissed** - ✓ VERIFIED USED

   - File: `electron/reminders.js`, Line 113
   - Usage: `timeoutType: getSetting('reminders.persistUntilDismissed') ? 'never' : 'default'`
   - Controls Electron notification persistence

7. **tray.showReminderBadge** - ⚠️ LIKELY DEAD CODE

   - Not found in tray.js implementation
   - May be future feature or platform-specific

8. **advanced.devTools** - ❓ UNCERTAIN

   - Not found in main.js or menu code

9. **whisper.language** - ❓ UNCERTAIN

   - Not found in whisper IPC or service

10. **whisper.defaultSource** - ❓ UNCERTAIN

    - Not found in whisper code

11. **whisper.autoStopSilence** - ❓ UNCERTAIN

12. **whisper.silenceTimeout** - ❓ UNCERTAIN

13. **whisper.showConfidence** - ❓ UNCERTAIN

14. **whisper.autoDownload** - ❓ UNCERTAIN

## Setting Dependencies Map

### Settings Requiring App Restart

- `advanced.hardwareAcceleration` - ⚠️ Read before app.ready(), changing requires restart
- `advanced.serverPort` - ⚠️ Changing requires server restart (no handler)
- `advanced.databasePath` - ⚠️ Changing requires full app restart
- `advanced.attachmentsPath` - ⚠️ Changing requires restart

### Settings with Special Handlers (Immediate Effect)

- `shortcuts.globalNewNote` - ✓ Triggers `updateShortcuts()`
- `shortcuts.globalToggle` - ✓ Triggers `updateShortcuts()`
- `shortcuts.globalPanel` - ✓ Triggers `updateShortcuts()`
- `appearance.theme` - ✓ Updates `nativeTheme.themeSource` + broadcasts
- `general.startOnBoot` - ✓ Calls `updateAutoLaunch()`

### Settings Applied on Window Creation

- `appearance.defaultNoteWidth` - Used when creating note window
- `appearance.defaultNoteHeight` - Used when creating note window
- `appearance.noteOpacity` - Used when creating note window
- `appearance.enableShadows` - Used when creating note window
- `newNote.position` - Used when creating note window
- `newNote.cascadeOffset` - Used for cascade positioning

### Settings Applied via Broadcast (Hot Reload)

- `appearance.theme` - ✓ All windows listen and apply
- `editor.spellcheck` - ✓ Note windows listen
- `editor.autoLists` - ✓ Note windows listen
- `editor.autoLinks` - ✓ Note windows listen
- `appearance.defaultFontSize` - ✓ Note windows listen
- `appearance.defaultFontFamily` - ✓ Note windows listen
- `appearance.enableAnimations` - ✓ Note windows listen

### Settings Applied Only to Future Notes

- `appearance.defaultNoteColor` - Only new notes
- All `newNote.*` settings - Only new notes

### Settings Used at Runtime

- `general.autoSaveDelay` - Debounce timer
- `general.confirmDelete` - Delete dialog
- `general.confirmPermanentDelete` - Permanent delete dialog
- `general.closeToTray` - Close button handler
- `general.minimizeToTray` - Minimize behavior
- `history.maxVersions` - Prune old versions
- `history.saveInterval` - Auto-save timer
- `tray.singleClickAction` - Tray click
- `tray.doubleClickAction` - Tray double-click

## Critical Issues Found

### Issue #9: Dead Settings - Wasted Storage

**Severity**: Medium

Settings defined but never used in code:

- `general.language` - No i18n implementation
- `newNote.focusTitle` - Not implemented
- `newNote.openImmediately` - Not implemented

**Impact**:

- Confuses users (settings that do nothing)
- Wasted database storage
- Technical debt

**Recommendation**:

- Remove from schema if not planned
- Or implement the functionality
- Add comment in schema: `// TODO: Not yet implemented`

### Issue #10: Missing Restart Warnings

**Severity**: High

Settings that require restart have NO indication in UI:

- `advanced.hardwareAcceleration`
- `advanced.serverPort`
- `advanced.databasePath`
- `advanced.attachmentsPath`

**Impact**:

- User changes setting, nothing happens
- Confusion and bug reports
- Poor UX

**Recommendation**:

- Add `requiresRestart: true` to schema
- Show warning icon in settings UI
- Offer "Restart Now" button after change

### Issue #11: Whisper Settings Not Verified

**Severity**: Medium

Many whisper settings not found in code:

- `whisper.language`
- `whisper.defaultSource`
- `whisper.autoStopSilence`
- `whisper.silenceTimeout`
- `whisper.showConfidence`
- `whisper.autoDownload`

**Need to verify**: Are these implemented in whisper service or dead code?

### Issue #12: Reminder Settings Not Found

**Severity**: Medium

Reminder settings defined but not found in reminders.js:

- `reminders.sound`
- `reminders.snoozeMinutes`
- `reminders.persistUntilDismissed`

**Need to verify**: Check reminder implementation

## Next Steps Completed

- [x] Search for all `getSetting()` and `setSetting()` calls in codebase
- [x] Check CLI settings interface - Full CRUD via config commands
- [x] Identify unused settings - Found 3 dead, 10+ uncertain
- [x] Map setting dependencies - Documented above
- [x] Verify reminder settings usage - All 3 reminder settings confirmed used
- [ ] Review test coverage for settings - Need to check test files
- [ ] Verify whisper settings usage - Need deeper investigation

## Executive Summary

### Settings Architecture Overview

The StickyNotes application implements a **4-layer settings architecture**:

1. **Schema Layer** (`shared/constants/settings.js`) - 54 settings with types, defaults, and metadata
2. **Storage Layer** (`shared/database/settings.js`) - SQLite key-value table with CRUD operations
3. **IPC Layer** (`electron/ipc/settings.js`) - Electron IPC handlers with special effects for 5 settings
4. **UI Layer** (`src/settings/settings.js`) - Settings panel with 76 element mappings

### Key Metrics

- **Total Settings Defined**: 54
- **Confirmed Used**: 41+
- **Dead Code**: 3 settings (general.language, newNote.focusTitle, newNote.openImmediately)
- **Uncertain**: 10+ settings (mostly whisper.\* settings)
- **Special Handlers**: 5 (shortcuts x3, theme, startOnBoot)
- **Restart Required**: 4 (hardware accel, server port, database path, attachments path)

### Critical Findings

1. **Type Safety Issues**: No validation for ranges or enums, soft validation only
2. **No Schema Versioning**: Settings can become orphaned or mismatched
3. **Missing Restart Warnings**: Users can change restart-required settings with no feedback
4. **Data Transform Inconsistency**: UI-only transformation for saveInterval (ms ↔ minutes)
5. **Dead Settings**: 3 settings defined but never used
6. **No Audit Trail**: Can't track who changed what and when
7. **Potential Broadcast Loops**: No protection against settings change feedback loops

### Strengths

- ✅ Clean separation of concerns (schema, storage, IPC, UI)
- ✅ Fallback to defaults when settings not in DB
- ✅ Broadcast mechanism for hot-reload of settings
- ✅ CLI interface for settings management
- ✅ Type conversion from string storage to native types

### Recommendations Priority

**High Priority**:

1. Add strong validation with range/enum checking
2. Add restart warnings for affected settings
3. Remove or implement dead settings (language, focusTitle, openImmediately)

**Medium Priority**: 4. Implement schema versioning and migrations 5. Normalize data transformations 6. Add setting change audit trail 7. Document which settings need restart

**Low Priority**: 8. Setting presets/profiles 9. TypeScript type generation from schema 10. Prevent broadcast feedback loops

### Settings Usage Summary by Category

| Category   | Total  | Used    | Dead/Uncertain | Usage Rate |
| ---------- | ------ | ------- | -------------- | ---------- |
| general    | 9      | 8       | 1 (language)   | 89%        |
| appearance | 10     | 10      | 0              | 100%       |
| newNote    | 4      | 2       | 2              | 50%        |
| tray       | 3      | 2       | 1 (badge)      | 67%        |
| shortcuts  | 3      | 3       | 0              | 100%       |
| editor     | 5      | 5       | 0              | 100%       |
| reminders  | 4      | 4       | 0              | 100%       |
| history    | 2      | 2       | 0              | 100%       |
| advanced   | 5      | 4       | 1 (devTools)   | 80%        |
| whisper    | 10     | 3       | 7              | 30%        |
| **TOTAL**  | **54** | **41+** | **13**         | **76%**    |

### Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend UI (src/settings/settings.js)                      │
│ - User changes setting                                      │
│ - Calls api.setSetting(key, value)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ IPC Layer (electron/ipc/settings.js)                        │
│ - Validates key (soft)                                      │
│ - Calls database setSetting()                               │
│ - Triggers special handlers (shortcuts, theme, auto-launch) │
│ - Broadcasts change to all windows                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Database Layer (shared/database/settings.js)                │
│ - Converts value to string                                  │
│ - Upserts to SQLite: settings(key, value, updated_at)       │
└─────────────────────────────────────────────────────────────┘

Read Flow (reverse):
Database → Parse to type → Return (with default fallback)
```

### Most Critical Issues

1. **Issue #10: Missing Restart Warnings** (SEVERITY: HIGH)

   - Impact: User confusion, perceived bugs
   - Affects: 4 settings (hardwareAcceleration, serverPort, databasePath, attachmentsPath)

2. **Issue #2: No Type Validation** (SEVERITY: HIGH)

   - Impact: Invalid values can be stored
   - Affects: All number/enum settings

3. **Issue #4: No Schema Versioning** (SEVERITY: MEDIUM)
   - Impact: Database bloat, migration issues
   - Affects: Long-term maintainability
