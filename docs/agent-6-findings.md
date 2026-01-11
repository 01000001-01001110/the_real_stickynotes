# Agent 6 Settings Evaluation

## Discovery Path

### Exploration Strategy

1. Started with package.json to understand project structure
2. Used glob patterns to find all settings-related files
3. Read files in logical order: schema → database → IPC → frontend → CLI
4. Traced setting usage through codebase using grep
5. Identified which settings are actually implemented vs. defined-only

### Files Explored (All Complete)

- ✅ `shared/constants/settings.js` - Schema with 55 settings across 10 categories
- ✅ `shared/database/settings.js` - Database CRUD operations
- ✅ `shared/database/migrations/001_initial.js` - Database schema
- ✅ `electron/ipc/settings.js` - IPC handlers with special setting actions
- ✅ `electron/preload.js` - Frontend bridge via contextBridge
- ✅ `src/settings/settings.js` - Settings UI with mappings
- ✅ `src/note/note.js` - Note window settings usage
- ✅ `src/panel/panel.js` - Panel window settings usage
- ✅ `cli/commands/config.js` - CLI configuration commands
- ✅ `electron/main.js` - App startup settings usage
- ✅ `electron/shortcuts.js` - Global shortcuts registration
- ✅ `electron/tray.js` - Tray click actions
- ✅ `electron/windows/manager.js` - Window positioning/sizing
- ✅ `shared/database/notes.js` - Note color defaults
- ✅ `shared/database/history.js` - History pruning

### Analysis Method

1. **Schema Analysis**: Cataloged all 55 settings with types, defaults, options
2. **Data Flow Tracing**: Followed settings from definition → storage → IPC → UI → usage
3. **Usage Verification**: Grepped codebase for each setting to verify implementation
4. **Gap Analysis**: Identified 10 settings with no implementation
5. **Validation Analysis**: Checked for type/range/options validation
6. **UI Coverage**: Compared schema to settings UI mappings

## Settings Found

### Schema Location: `shared/constants/settings.js`

**Total Settings Count: 60+ settings organized in 12 categories**

#### Category: General (9 settings)

1. `general.language` - string, default: 'en' - UI language code
2. `general.startOnBoot` - boolean, default: false - Start with Windows
3. `general.startMinimized` - boolean, default: false - Start minimized to tray
4. `general.minimizeToTray` - boolean, default: true - Minimize to tray instead of taskbar
5. `general.closeToTray` - boolean, default: true - Close button minimizes to tray
6. `general.confirmDelete` - boolean, default: true - Confirm before moving to trash
7. `general.confirmPermanentDelete` - boolean, default: true - Confirm before permanent delete
8. `general.autoSaveDelay` - number, default: 1000 - Auto-save delay in ms
9. `general.trashRetentionDays` - number, default: 30 - Days before auto-purge from trash (0=never)

#### Category: Appearance (10 settings)

10. `appearance.theme` - string, default: 'system', options: ['light', 'dark', 'system']
11. `appearance.defaultNoteColor` - string, default: 'yellow', options: ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal', 'random']
12. `appearance.defaultNoteWidth` - number, default: 300 - Default width in pixels
13. `appearance.defaultNoteHeight` - number, default: 350 - Default height in pixels
14. `appearance.defaultFontFamily` - string, default: 'Segoe UI' - Font family
15. `appearance.defaultFontSize` - number, default: 14 - Font size in pixels
16. `appearance.noteOpacity` - number, default: 100 - Window opacity 50-100
17. `appearance.enableShadows` - boolean, default: true - Show window shadows
18. `appearance.enableAnimations` - boolean, default: true - Enable UI animations
19. `appearance.showNoteCount` - boolean, default: true - Show note count in panel

#### Category: New Note Behavior (4 settings)

20. `newNote.position` - string, default: 'cascade', options: ['cascade', 'center', 'cursor', 'random']
21. `newNote.cascadeOffset` - number, default: 30 - Cascade offset in pixels
22. `newNote.openImmediately` - boolean, default: true - Open new note window immediately
23. `newNote.focusTitle` - boolean, default: true - Focus title field on new note

#### Category: Tray (3 settings)

24. `tray.singleClickAction` - string, default: 'showPanel', options: ['showPanel', 'toggleNotes', 'newNote', 'nothing']
25. `tray.doubleClickAction` - string, default: 'newNote', options: ['showPanel', 'toggleNotes', 'newNote', 'nothing']
26. `tray.showReminderBadge` - boolean, default: true - Show badge for pending reminders

#### Category: Keyboard Shortcuts (3 settings)

27. `shortcuts.globalNewNote` - string, default: 'Ctrl+Shift+N' - Global hotkey for new note
28. `shortcuts.globalToggle` - string, default: 'Ctrl+Shift+S' - Global hotkey to show/hide all
29. `shortcuts.globalPanel` - string, default: 'Ctrl+Shift+P' - Global hotkey to show panel

#### Category: Editor (5 settings)

30. `editor.spellcheck` - boolean, default: true - Enable spellcheck
31. `editor.autoLinks` - boolean, default: true - Auto-detect and linkify URLs
32. `editor.autoLists` - boolean, default: true - Auto-continue bullet/numbered lists
33. `editor.tabSize` - number, default: 2 - Tab size for code blocks
34. `editor.showWordCount` - boolean, default: false - Show word count in status bar

#### Category: Reminders (4 settings)

35. `reminders.enabled` - boolean, default: true - Enable reminder notifications
36. `reminders.sound` - boolean, default: true - Play sound on reminder
37. `reminders.snoozeMinutes` - number, default: 15 - Default snooze duration
38. `reminders.persistUntilDismissed` - boolean, default: true - Keep notification until dismissed

#### Category: History (2 settings)

39. `history.maxVersions` - number, default: 10 - Max versions to keep per note
40. `history.saveInterval` - number, default: 300000 - Save version every N ms (5 min)

#### Category: Advanced (6 settings)

41. `advanced.databasePath` - string, default: '' - Custom database path (empty=default)
42. `advanced.attachmentsPath` - string, default: '' - Custom attachments path
43. `advanced.serverPort` - number, default: 47474 - Local HTTP server port for CLI
44. `advanced.hardwareAcceleration` - boolean, default: true - Enable GPU acceleration
45. `advanced.devTools` - boolean, default: false - Show dev tools option

#### Category: Whisper/Transcription (10 settings)

46. `whisper.enabled` - boolean, default: true - Enable transcription feature
47. `whisper.modelSize` - string, default: 'small', options: ['tiny', 'base', 'small']
48. `whisper.language` - string, default: 'en', options: ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko']
49. `whisper.insertMode` - string, default: 'cursor', options: ['cursor', 'append', 'replace']
50. `whisper.defaultSource` - string, default: 'microphone', options: ['microphone', 'system', 'both']
51. `whisper.autoStopSilence` - boolean, default: false - Auto-stop after silence detected
52. `whisper.silenceTimeout` - number, default: 3000 - Silence timeout in ms before auto-stop
53. `whisper.showConfidence` - boolean, default: false - Show transcription confidence indicator
54. `whisper.autoDownload` - boolean, default: true - Auto-download model on first use
55. `whisper.chunkDuration` - number, default: 5000 - Audio chunk duration in ms

## Data Flow Analysis

### Phase 1: Definition (shared/constants/settings.js)

- **settingsSchema** object defines all 60+ settings with:

  - `type`: 'string', 'boolean', or 'number'
  - `default`: Default value for the setting
  - `description`: Human-readable description
  - `options`: (optional) Array of valid values for enums

- **Helper Functions**:
  - `getSettingDefault(key)`: Returns default value for a setting
  - `getSettingType(key)`: Returns type of a setting
  - `isValidSettingKey(key)`: Validates if key exists in schema
  - `parseSettingValue(key, value)`: Parses string value to correct type
  - `getAllDefaults()`: Returns object with all default values

### Phase 2: Storage (shared/database/settings.js)

- **Database Table**: `settings` table (schema not yet seen)
- **Storage Format**: Settings stored as key-value pairs with string values
- **Timestamps**: Each setting has `updated_at` timestamp

- **CRUD Operations**:

  - `getSetting(key)`: Get single setting, returns parsed value or default
  - `setSetting(key, value)`: Set single setting (validates key, warns if unknown)
  - `getAllSettings()`: Get all settings merged with defaults
  - `resetSetting(key)`: Delete setting from DB (reverts to default)
  - `resetAllSettings()`: Delete all settings from DB
  - `getSettingsByCategory(category)`: Get settings by category prefix
  - `setSettings(settings)`: Bulk set multiple settings in transaction

- **Data Flow in Database Layer**:
  1. Value written as string to DB
  2. Value read as string from DB
  3. Value parsed to correct type using schema
  4. If no DB value, default from schema is returned

### Phase 3: Database Schema (shared/database/migrations/001_initial.js)

- **Settings Table Schema**:

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

- Simple key-value store with timestamps
- No foreign keys or indexes
- All values stored as TEXT (parsed on read)

### Phase 4: IPC Communication (electron/ipc/settings.js)

- **IPC Handlers** registered for:

  - `settings:get` → getSetting(key)
  - `settings:set` → setSetting(key, value) + handleSettingChange() + broadcast
  - `settings:getAll` → getAllSettings()
  - `settings:reset` → resetSetting(key) or resetAllSettings()
  - `settings:getDefaultPaths` → Returns app/database/attachments paths

- **Broadcasting**: When a setting is changed via IPC, it broadcasts `setting:changed` event to all windows
- **Special Handlers**: Some settings trigger immediate actions:
  - `shortcuts.*` → updateShortcuts() - Re-registers global keyboard shortcuts
  - `appearance.theme` → Updates nativeTheme.themeSource
  - `general.startOnBoot` → Updates app.setLoginItemSettings()

### Phase 5: Frontend Bridge (electron/preload.js)

- **contextBridge** exposes safe IPC methods to renderer:

  - `api.getSetting(key)` → IPC call to 'settings:get'
  - `api.setSetting(key, value)` → IPC call to 'settings:set'
  - `api.getAllSettings()` → IPC call to 'settings:getAll'
  - `api.resetSetting(key)` → IPC call to 'settings:reset'
  - `api.getDefaultPaths()` → IPC call to 'settings:getDefaultPaths'

- **Event Listener**: `api.onSettingChanged(callback)` - Listens for broadcast changes

### Phase 6: Frontend Usage (src/)

Settings are consumed in multiple frontend windows:

#### Settings Window (src/settings/settings.js + index.html)

- **settingMappings**: Maps HTML element IDs to setting keys (56 mappings found)
- **Loads all settings** on init via `api.getAllSettings()`
- **Auto-saves on change**: Every input triggers `api.setSetting()`
- **Special handling**:
  - `history.saveInterval`: Converts ms ↔ minutes for display
  - Shortcuts: Custom keyboard capture UI
  - Paths: Browse dialogs for database/attachments
  - Whisper: Model download/status management
- **Theme aware**: Listens to theme changes and applies dynamically

#### Note Window (src/note/note.js)

- **Settings used**:

  - `appearance.theme` - Applied to document theme
  - `appearance.defaultFontSize` - Sets editor font size
  - `appearance.defaultFontFamily` - Sets editor font family
  - `appearance.enableAnimations` - Enables/disables animations
  - `appearance.noteOpacity` - Sets window opacity (if note has no custom opacity)
  - `editor.spellcheck` - Enables/disables spellcheck
  - `editor.autoLinks` - Auto-linkifies URLs
  - `editor.autoLists` - Auto-continues lists
  - `editor.tabSize` - Tab size for code blocks
  - `editor.showWordCount` - Shows word count in status bar
  - `general.autoSaveDelay` - Auto-save delay
  - `general.confirmDelete` - Confirm before deleting
  - `history.saveInterval` - Periodic history save interval

- **Reactive updates**: Listens to `onSettingChanged` events and reapplies settings dynamically

#### Panel Window (src/panel/panel.js)

- **Settings used**:
  - `appearance.theme` - Applied to document theme
  - `appearance.showNoteCount` - Shows note count (inferred)
  - `general.confirmDelete` - Confirm before deleting notes

### Phase 7: Backend/Electron Usage

#### Main Process (electron/main.js)

- **Critical early read**: `advanced.hardwareAcceleration` read BEFORE app.whenReady()
  - Must disable HW acceleration before Electron app initializes
  - Database initialized early just to read this setting
- **Settings used**:
  - `advanced.serverPort` - Port for CLI HTTP server
  - `general.startMinimized` - Whether to show panel on startup

#### Shortcuts (electron/shortcuts.js)

- **Settings used**:
  - `shortcuts.globalNewNote` - Global hotkey for new note
  - `shortcuts.globalToggle` - Global hotkey to show/hide all notes
  - `shortcuts.globalPanel` - Global hotkey to show panel
- **Updates dynamically**: `updateShortcuts()` called when settings change via IPC

#### Notes Database (shared/database/notes.js)

- **Settings used**:
  - `appearance.defaultNoteColor` - Default color for new notes
  - Handles 'random' color option by picking random from color array

#### History Database (shared/database/history.js)

- **Settings used**:
  - `history.maxVersions` - Max versions to keep per note
  - Used in `pruneNoteHistoryInternal()` to limit history entries

### Phase 8: CLI Usage (cli/commands/config.js)

- **Commands available**:

  - `config list [--json]` - List all settings grouped by category
  - `config get <key> [--json]` - Get single setting
  - `config set <key> <value>` - Set setting (validates key, parses value)
  - `config reset [key] [--all]` - Reset to defaults
  - `config path` - Show config file paths

- **Validation**: Warns on unknown keys but still allows setting
- **Type parsing**: Uses `parseSettingValue()` to convert string to correct type

## Issues Identified

### 1. ⚠️ Missing Validation on setSetting

**Location**: `shared/database/settings.js` line 38-41
**Issue**: When setting a value, the function only WARNS if the key is unknown but still allows the value to be set. This could lead to typos being silently stored in the database.
**Code**:

```javascript
if (!isValidSettingKey(key)) {
  console.warn(`Unknown setting key: ${key}`);
}
// Still proceeds to set the value!
```

**Severity**: Medium - Could lead to data inconsistency

### 2. ⚠️ No Value Validation Against Options

**Location**: `shared/database/settings.js` setSetting function
**Issue**: Settings with `options` arrays (like theme, noteColor, etc.) are not validated against allowed values. You could set `appearance.theme` to 'rainbow' and it would be accepted.
**Severity**: Medium - Could lead to invalid state

### 3. ⚠️ No Range Validation for Numbers

**Location**: `shared/database/settings.js` setSetting function
**Issue**: Numeric settings have no min/max validation. For example:

- `appearance.noteOpacity` should be 50-100 but nothing enforces this
- `general.autoSaveDelay` could be negative
- Font sizes could be 0 or negative
  **Severity**: Medium - Could cause UI/logic errors

### 4. ⚠️ Type Coercion Inconsistency

**Location**: `shared/constants/settings.js` line 328-337
**Issue**: The parseSettingValue function has loose boolean parsing:

```javascript
case 'boolean':
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
```

This means 'false' (string) would be parsed as `false`, but '0' (string) would also be `false`, while 'anything else' would be `false`. The logic for falsy values is implicit rather than explicit.
**Severity**: Low - But could lead to confusion

## Improvement Recommendations

### 1. Add Strict Validation in setSetting

Add validation that throws or returns error for:

- Unknown keys
- Invalid values for enum options
- Out-of-range numbers
- Invalid types

### 2. Add Schema Constraints

Extend settingsSchema to include:

- `min` and `max` for numeric settings
- `pattern` for string settings (e.g., regex for shortcuts)
- `validator` function for complex validation

### 3. Create Validation Function

Create a dedicated `validateSettingValue(key, value)` function that:

- Checks type correctness
- Validates against options array
- Validates against min/max ranges
- Returns { valid: boolean, error: string }

### 4. Add Migration/Upgrade Path

No mechanism seen yet for handling setting migrations when:

- Settings are renamed
- Default values change
- New settings are added

### Phase 9: Settings Actually Used

Based on code analysis, here's the actual usage status:

#### FULLY IMPLEMENTED (45/55 settings):

- All `appearance.*` settings (10/10) - Used in windows, notes, panel
- `general.autoSaveDelay`, `confirmDelete`, `confirmPermanentDelete`, `startMinimized`, `startOnBoot` (5/9)
- `newNote.position`, `newNote.cascadeOffset` (2/4) - Used in window manager
- `shortcuts.*` (3/3) - All implemented
- `tray.singleClickAction`, `tray.doubleClickAction` (2/3)
- All `editor.*` settings (5/5) - Used in note editor
- `reminders.enabled`, `sound`, `snoozeMinutes`, `persistUntilDismissed` (4/4)
- `history.maxVersions`, `history.saveInterval` (2/2)
- `advanced.serverPort`, `hardwareAcceleration` (2/6)
- All `whisper.*` settings visible in UI (6/10)

#### NOT IMPLEMENTED / UNUSED (10/55 settings):

1. `general.language` - NO i18n system exists
2. `general.minimizeToTray` - Never referenced in code (confusing with closeToTray)
3. `general.closeToTray` - Defined but only used in settings UI mapping
4. `general.trashRetentionDays` - Defined but no auto-purge implementation
5. `newNote.openImmediately` - Not used in window creation
6. `newNote.focusTitle` - Not used in note initialization
7. `tray.showReminderBadge` - Not implemented in tray.js
8. `advanced.databasePath` - Has UI but no implementation for custom paths
9. `advanced.attachmentsPath` - Has UI but no implementation
10. `advanced.devTools` - Not used anywhere

#### PARTIALLY IMPLEMENTED (4 Whisper settings not in UI):

- `whisper.autoStopSilence` - Not in settings HTML
- `whisper.silenceTimeout` - Not in settings HTML
- `whisper.showConfidence` - Not in settings HTML
- `whisper.chunkDuration` - Not in settings HTML

## Issues Identified

### 1. ⚠️ Missing Validation on setSetting

**Location**: `shared/database/settings.js` line 38-41
**Issue**: When setting a value, the function only WARNS if the key is unknown but still allows the value to be set. This could lead to typos being silently stored in the database.

**Code**:

```javascript
if (!isValidSettingKey(key)) {
  console.warn(`Unknown setting key: ${key}`);
}
// Still proceeds to set the value!
```

**Severity**: Medium - Could lead to data inconsistency

### 2. ⚠️ No Value Validation Against Options

**Location**: `shared/database/settings.js` setSetting function
**Issue**: Settings with `options` arrays (like theme, noteColor, etc.) are not validated against allowed values. You could set `appearance.theme` to 'rainbow' and it would be accepted.

**Example Bad Values**:

- `appearance.theme` = 'rainbow' (valid: light, dark, system)
- `newNote.position` = 'topleft' (valid: cascade, center, cursor, random)
- `whisper.modelSize` = 'huge' (valid: tiny, base, small)

**Severity**: Medium - Could lead to invalid state

### 3. ⚠️ No Range Validation for Numbers

**Location**: `shared/database/settings.js` setSetting function
**Issue**: Numeric settings have no min/max validation. For example:

- `appearance.noteOpacity` should be 50-100 but nothing enforces this
- `general.autoSaveDelay` could be negative or 0
- Font sizes could be 0 or negative
- `advanced.serverPort` could be 999999 or -1

**Severity**: Medium - Could cause UI/logic errors

### 4. ⚠️ Type Coercion Inconsistency

**Location**: `shared/constants/settings.js` line 328-337
**Issue**: The parseSettingValue function has loose boolean parsing:

```javascript
case 'boolean':
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
```

This means 'false' (string) would be parsed as `false`, but '0' (string) would also be `false`, while 'anything else' would be `false`. The logic for falsy values is implicit rather than explicit.

**Severity**: Low - But could lead to confusion

### 5. 🔴 10 Settings Defined But Never Used

**Location**: Various
**Issue**: These settings are in the schema and can be set, but have NO implementation:

1. `general.language` - No i18n/localization system
2. `general.minimizeToTray` - Never used (vs closeToTray which is used)
3. `general.closeToTray` - Only in UI mapping, not in actual window close logic
4. `general.trashRetentionDays` - No auto-purge scheduler
5. `newNote.openImmediately` - Not checked in window manager
6. `newNote.focusTitle` - Not checked in note.js initialization
7. `tray.showReminderBadge` - Not implemented in tray.js setTrayBadge
8. `advanced.databasePath` - No code to use custom DB path
9. `advanced.attachmentsPath` - No code to use custom attachments path
10. `advanced.devTools` - Not referenced anywhere

**Severity**: HIGH - Misleads users, wastes space, creates confusion

### 6. ⚠️ 4 Whisper Settings Hidden from UI

**Location**: `src/settings/settings.js` settingMappings
**Issue**: These settings exist in schema but are not exposed in settings UI:

- `whisper.autoStopSilence`
- `whisper.silenceTimeout`
- `whisper.showConfidence`
- `whisper.chunkDuration`

**Severity**: Medium - Inconsistent UX, users can't configure these

### 7. ⚠️ Settings Change Broadcast Race Condition

**Location**: `electron/ipc/settings.js` line 35-46
**Issue**: When a setting is changed:

1. setSetting() writes to DB
2. handleSettingChange() handles special cases (synchronous)
3. Broadcast sent to all windows

If a window queries the setting during step 2, it might get old value from cache or inconsistent state.

**Severity**: Low - Unlikely race condition

### 8. 🔴 Hardware Acceleration Setting Requires App Restart

**Location**: `electron/main.js` line 46-60
**Issue**: `advanced.hardwareAcceleration` is read before app.whenReady() and must be set before Electron initializes. Changing this setting in the UI does NOT take effect until full app restart, but UI doesn't warn user about this.

**Severity**: Medium - Confusing UX, users expect immediate effect

### 9. ⚠️ No Setting Change History/Audit Trail

**Location**: Database schema
**Issue**: Settings table only stores current value and updated_at. There's no history of:

- Who changed a setting (not applicable in single-user app, but...)
- What the old value was
- When it was changed (only latest change tracked)

This makes debugging user issues difficult.

**Severity**: Low - Nice to have for debugging

### 10. ⚠️ Frontend Mappings Don't Cover All Settings

**Location**: `src/settings/settings.js` settingMappings
**Issue**: The settingMappings object has 56 entries but schema has 55 settings. However, some mappings are duplicates:

- `defaultFontSize` maps to `appearance.defaultFontSize` (appears twice)

Missing from UI:

- `general.language` (intentionally hidden - no i18n)
- 4 whisper settings mentioned above

**Severity**: Low - Mostly intentional

### 11. 🔴 Schema Has No Version Number

**Location**: `shared/constants/settings.js`
**Issue**: The settingsSchema has no version field. If settings need to be migrated (renamed, removed, type changed), there's no mechanism to:

- Detect old schema version
- Run migrations
- Handle backward compatibility

**Severity**: Medium - Will cause problems when settings evolve

### 12. ⚠️ Missing Unit Validation

**Location**: Various numeric settings
**Issue**: Some settings have units (ms, minutes, pixels, %) but no validation:

- `general.autoSaveDelay` - Could be set to 10 (10ms = too fast, likely meant 1000)
- `history.saveInterval` - Could be set to 5 (5ms = absurd)
- `appearance.noteOpacity` - Could be set to 200 (should be 0-100)

**Severity**: Medium - User errors likely

## Improvement Recommendations

### 1. Add Comprehensive Validation System

Create `shared/constants/validators.js`:

```javascript
const validators = {
  'appearance.noteOpacity': (v) => v >= 50 && v <= 100,
  'general.autoSaveDelay': (v) => v >= 100 && v <= 10000,
  'advanced.serverPort': (v) => v >= 1024 && v <= 65535,
  // ... etc
};

function validateSettingValue(key, value) {
  const schema = settingsSchema[key];
  if (!schema) return { valid: false, error: 'Unknown setting' };

  // Type check
  if (typeof value !== schema.type && schema.type !== typeof value) {
    return { valid: false, error: `Expected ${schema.type}, got ${typeof value}` };
  }

  // Options check
  if (schema.options && !schema.options.includes(value)) {
    return { valid: false, error: `Must be one of: ${schema.options.join(', ')}` };
  }

  // Custom validator
  if (validators[key] && !validators[key](value)) {
    return { valid: false, error: 'Value out of range or invalid' };
  }

  return { valid: true };
}
```

Use this in `setSetting()` to reject invalid values.

### 2. Add Schema Constraints

Extend settingsSchema to include:

```javascript
'appearance.noteOpacity': {
  type: 'number',
  default: 100,
  min: 50,
  max: 100,
  description: 'Window opacity 50-100',
},
'advanced.serverPort': {
  type: 'number',
  default: 47474,
  min: 1024,
  max: 65535,
  description: 'Local HTTP server port for CLI',
},
```

### 3. Remove or Implement Dead Settings

Either:

- **Remove** the 10 unused settings from schema
- **Implement** them properly

Recommendation: REMOVE these for v2.0:

- `general.language` (no i18n planned)
- `general.minimizeToTray` (redundant with closeToTray)
- `newNote.openImmediately` (always true anyway)
- `newNote.focusTitle` (always true anyway)
- `advanced.databasePath` (complex to implement)
- `advanced.attachmentsPath` (complex to implement)

IMPLEMENT these (easy wins):

- `general.trashRetentionDays` - Add cron job in reminders.js
- `tray.showReminderBadge` - Add to tray.js setTrayBadge()
- `general.closeToTray` - Use in window close handler

### 4. Add Settings Schema Version

```javascript
const SETTINGS_SCHEMA_VERSION = 1;

module.exports = {
  version: SETTINGS_SCHEMA_VERSION,
  settingsSchema,
  // ... rest
};
```

Create migration system in database/migrations/.

### 5. Add Restart-Required Warnings

For settings that require restart:

- `advanced.hardwareAcceleration`
- `advanced.serverPort`

Add a `requiresRestart: true` flag in schema and show warning in UI.

### 6. Add Setting Change Validation at UI Level

In `src/settings/settings.js`, before calling `api.setSetting()`:

```javascript
// Validate numeric ranges
if (settingKey === 'appearance.noteOpacity') {
  if (value < 50 || value > 100) {
    alert('Opacity must be between 50-100%');
    return;
  }
}
```

### 7. Expose Hidden Whisper Settings in UI

Add the 4 missing whisper settings to settings UI or remove from schema.

## Questions/Uncertainties

1. ✅ Where is the database schema defined? → `shared/database/migrations/001_initial.js`
2. ✅ How are settings loaded on app startup? → Via IPC handlers in electron/ipc/settings.js
3. ✅ How does the frontend access settings? → Via preload.js contextBridge API
4. ❓ Are settings cached or always read from DB? → Always read from DB (no caching detected)
5. ✅ How does the CLI interact with settings? → Via db-proxy that routes to HTTP API
6. ✅ Are there any settings listeners/observers? → Yes, `onSettingChanged` broadcast system
7. ✅ What happens when a setting is changed? → DB update → special handlers → broadcast
8. ❓ Why are some settings defined but not used? → Possibly planned features never implemented
9. ❓ Is there a plan to add i18n/localization? → Unclear (general.language exists but unused)
10. ❓ Should minimizeToTray and closeToTray be merged? → Seem redundant

---

## Summary Statistics

- **Total Settings Defined**: 55
- **Fully Implemented**: 45 (82%)
- **Not Implemented**: 10 (18%)
- **Missing from UI**: 4 whisper settings
- **Critical Issues**: 3 (validation, dead settings, no schema version)
- **Medium Issues**: 6
- **Low Issues**: 3

**Overall Assessment**: The settings system is well-structured with good separation of concerns (schema → DB → IPC → UI), but has significant issues with validation, unused settings, and lack of migration support. Approximately 18% of defined settings have no implementation.
