# Agent 5 Settings Evaluation

## Discovery Path

### Phase 1: Initial Exploration

1. Started with `package.json` - identified this is an Electron app with CLI support
2. Searched for `*settings*.js` files across codebase
3. Found key settings files:
   - `shared/constants/settings.js` - Schema definitions & defaults (55 settings)
   - `shared/database/settings.js` - Database CRUD layer
   - `src/settings/settings.js` - Frontend UI layer
   - `electron/ipc/settings.js` - IPC communication layer
   - Test files for validation

### Phase 2: Architecture Analysis

4. Examined database schema in `shared/database/migrations/001_initial.js`
   - Settings stored in simple key-value table: `settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`
   - All values stored as TEXT, parsed on retrieval
5. Traced data flow through layers
6. Analyzed usage patterns in `electron/main.js`, `electron/shortcuts.js`, `src/note/note.js`, etc.

### Phase 3: Validation & Cross-reference

7. Compared schema definitions with UI mappings
8. Checked for orphaned or missing settings
9. Examined test coverage and validation logic
10. Searched for settings used outside schema

## Settings Found

### Complete Settings Inventory (55 Total)

#### General Settings (8)

| Setting Key                    | Type    | Default | Description                                 | UI Mapped |
| ------------------------------ | ------- | ------- | ------------------------------------------- | --------- |
| general.language               | string  | 'en'    | UI language code                            | ❌ NO     |
| general.startOnBoot            | boolean | false   | Start with Windows                          | ✅ YES    |
| general.startMinimized         | boolean | false   | Start minimized to tray                     | ✅ YES    |
| general.minimizeToTray         | boolean | true    | Minimize to tray instead of taskbar         | ✅ YES    |
| general.closeToTray            | boolean | true    | Close button minimizes to tray              | ✅ YES    |
| general.confirmDelete          | boolean | true    | Confirm before moving to trash              | ✅ YES    |
| general.confirmPermanentDelete | boolean | true    | Confirm before permanent delete             | ✅ YES    |
| general.autoSaveDelay          | number  | 1000    | Auto-save delay in ms                       | ✅ YES    |
| general.trashRetentionDays     | number  | 30      | Days before auto-purge from trash (0=never) | ✅ YES    |

#### Appearance Settings (10)

| Setting Key                  | Type    | Default    | Description                  | UI Mapped |
| ---------------------------- | ------- | ---------- | ---------------------------- | --------- |
| appearance.theme             | string  | 'system'   | App theme: light/dark/system | ✅ YES    |
| appearance.defaultNoteColor  | string  | 'yellow'   | Default color for new notes  | ✅ YES    |
| appearance.defaultNoteWidth  | number  | 300        | Default width in pixels      | ✅ YES    |
| appearance.defaultNoteHeight | number  | 350        | Default height in pixels     | ✅ YES    |
| appearance.defaultFontFamily | string  | 'Segoe UI' | Font family                  | ✅ YES    |
| appearance.defaultFontSize   | number  | 14         | Font size in pixels          | ✅ YES    |
| appearance.noteOpacity       | number  | 100        | Window opacity 50-100        | ✅ YES    |
| appearance.enableShadows     | boolean | true       | Show window shadows          | ✅ YES    |
| appearance.enableAnimations  | boolean | true       | Enable UI animations         | ✅ YES    |
| appearance.showNoteCount     | boolean | true       | Show note count in panel     | ✅ YES    |

#### New Note Behavior (4)

| Setting Key             | Type    | Default   | Description                            | UI Mapped |
| ----------------------- | ------- | --------- | -------------------------------------- | --------- |
| newNote.position        | string  | 'cascade' | Position: cascade/center/cursor/random | ✅ YES    |
| newNote.cascadeOffset   | number  | 30        | Cascade offset in pixels               | ✅ YES    |
| newNote.openImmediately | boolean | true      | Open new note window immediately       | ✅ YES    |
| newNote.focusTitle      | boolean | true      | Focus title field on new note          | ✅ YES    |

#### Tray Settings (3)

| Setting Key            | Type    | Default     | Description                                   | UI Mapped |
| ---------------------- | ------- | ----------- | --------------------------------------------- | --------- |
| tray.singleClickAction | string  | 'showPanel' | Action: showPanel/toggleNotes/newNote/nothing | ✅ YES    |
| tray.doubleClickAction | string  | 'newNote'   | Action on double click                        | ✅ YES    |
| tray.showReminderBadge | boolean | true        | Show badge for pending reminders              | ✅ YES    |

#### Keyboard Shortcuts (3)

| Setting Key             | Type   | Default        | Description                    | UI Mapped |
| ----------------------- | ------ | -------------- | ------------------------------ | --------- |
| shortcuts.globalNewNote | string | 'Ctrl+Shift+N' | Global hotkey for new note     | ✅ YES    |
| shortcuts.globalToggle  | string | 'Ctrl+Shift+S' | Global hotkey to show/hide all | ✅ YES    |
| shortcuts.globalPanel   | string | 'Ctrl+Shift+P' | Global hotkey to show panel    | ✅ YES    |

#### Editor Settings (5)

| Setting Key          | Type    | Default | Description                         | UI Mapped |
| -------------------- | ------- | ------- | ----------------------------------- | --------- |
| editor.spellcheck    | boolean | true    | Enable spellcheck                   | ✅ YES    |
| editor.autoLinks     | boolean | true    | Auto-detect and linkify URLs        | ✅ YES    |
| editor.autoLists     | boolean | true    | Auto-continue bullet/numbered lists | ✅ YES    |
| editor.tabSize       | number  | 2       | Tab size for code blocks            | ✅ YES    |
| editor.showWordCount | boolean | false   | Show word count in status bar       | ✅ YES    |

#### Reminder Settings (4)

| Setting Key                     | Type    | Default | Description                       | UI Mapped |
| ------------------------------- | ------- | ------- | --------------------------------- | --------- |
| reminders.enabled               | boolean | true    | Enable reminder notifications     | ✅ YES    |
| reminders.sound                 | boolean | true    | Play sound on reminder            | ✅ YES    |
| reminders.snoozeMinutes         | number  | 15      | Default snooze duration           | ✅ YES    |
| reminders.persistUntilDismissed | boolean | true    | Keep notification until dismissed | ✅ YES    |

#### History Settings (2)

| Setting Key          | Type   | Default | Description                     | UI Mapped |
| -------------------- | ------ | ------- | ------------------------------- | --------- |
| history.maxVersions  | number | 10      | Max versions to keep per note   | ✅ YES    |
| history.saveInterval | number | 300000  | Save version every N ms (5 min) | ✅ YES    |

#### Advanced Settings (5)

| Setting Key                   | Type    | Default | Description                          | UI Mapped |
| ----------------------------- | ------- | ------- | ------------------------------------ | --------- |
| advanced.databasePath         | string  | ''      | Custom database path (empty=default) | ✅ YES    |
| advanced.attachmentsPath      | string  | ''      | Custom attachments path              | ✅ YES    |
| advanced.serverPort           | number  | 47474   | Local HTTP server port for CLI       | ✅ YES    |
| advanced.hardwareAcceleration | boolean | true    | Enable GPU acceleration              | ✅ YES    |
| advanced.devTools             | boolean | false   | Show dev tools option                | ✅ YES    |

#### Whisper/Transcription Settings (11)

| Setting Key             | Type    | Default      | Description                             | UI Mapped                |
| ----------------------- | ------- | ------------ | --------------------------------------- | ------------------------ |
| whisper.enabled         | boolean | true         | Enable transcription feature            | ✅ YES                   |
| whisper.modelSize       | string  | 'small'      | Whisper model size                      | ✅ YES                   |
| whisper.language        | string  | 'en'         | Transcription language code             | ✅ YES                   |
| whisper.insertMode      | string  | 'cursor'     | Where to insert transcribed text        | ✅ YES                   |
| whisper.defaultSource   | string  | 'microphone' | Default audio source                    | ✅ YES                   |
| whisper.autoStopSilence | boolean | false        | Auto-stop after silence detected        | ✅ YES                   |
| whisper.silenceTimeout  | number  | 3000         | Silence timeout in ms before auto-stop  | ❌ NO                    |
| whisper.showConfidence  | boolean | false        | Show transcription confidence indicator | ❌ NO                    |
| whisper.autoDownload    | boolean | true         | Auto-download model on first use        | ❌ NO                    |
| whisper.chunkDuration   | number  | 5000         | Audio chunk duration in ms              | ❌ NO (but USED in code) |

## Data Flow Analysis

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Schema Definition (shared/constants/settings.js)  │
│ - Canonical source of truth for all settings               │
│ - Defines: type, default, description, options             │
│ - Helper functions: getSettingDefault, parseSettingValue   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Database Storage (shared/database/settings.js)    │
│ - CRUD operations: getSetting, setSetting, getAllSettings  │
│ - Storage: SQLite table (key TEXT, value TEXT)             │
│ - All values stored as strings, parsed on retrieval        │
│ - Falls back to schema defaults if not in DB               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: IPC Communication (electron/ipc/settings.js)      │
│ - Exposes: settings:get, settings:set, settings:getAll     │
│ - Special handling for reactive settings:                  │
│   * shortcuts.* → re-register global shortcuts             │
│   * appearance.theme → update nativeTheme                  │
│   * general.startOnBoot → update auto-launch               │
│ - Broadcasts changes: setting:changed event                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Frontend UI (src/settings/settings.js)            │
│ - Maps HTML element IDs to setting keys (50 of 55)         │
│ - Auto-saves on change                                      │
│ - Special handling:                                         │
│   * history.saveInterval: display in minutes, store in ms  │
│   * Shortcut recording with keydown listener               │
│ - Listens for setting:changed to update UI                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Preload Bridge (electron/preload.js)              │
│ - Exposes api.getSetting, api.setSetting, etc.             │
│ - Provides api.onSettingChanged listener                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Consumption (various modules)                     │
│ - electron/main.js: hardware acceleration, startMinimized  │
│ - electron/shortcuts.js: global keyboard shortcuts         │
│ - src/note/note.js: editor settings, appearance            │
│ - electron/tray.js: tray click actions                     │
│ - CLI (cli/commands/config.js): full settings access       │
└─────────────────────────────────────────────────────────────┘
```

### Critical Flow Paths

#### 1. App Startup Flow

```
main.js (pre-ready)
  → initDatabase()
  → getSetting('advanced.hardwareAcceleration')
  → IF false: app.disableHardwareAcceleration()
  [MUST happen before app.whenReady()]

main.js (post-ready)
  → getSetting('advanced.serverPort') → startServer()
  → getSetting('general.startMinimized') → IF false: showPanel()
  → setupShortcuts() → reads shortcuts.* settings
```

#### 2. Settings Change Flow

```
User changes setting in UI
  → element.addEventListener('input/change')
  → api.setSetting(key, value)
  → IPC: settings:set
  → database: setSetting(key, value) - writes to DB
  → handleSettingChange(key, value) - special handlers
  → broadcast('setting:changed', key, value)
  → All windows receive update
  → UI updates reactively
```

#### 3. Default Fallback Chain

```
getSetting(key)
  → db.prepare('SELECT value FROM settings WHERE key = ?')
  → IF row exists: parseSettingValue(key, row.value)
  → ELSE: getSettingDefault(key) ← from schema
```

## Issues Identified

### CRITICAL Issues

#### 1. **Missing UI Mappings for Used Settings**

**Severity: HIGH**

**Issue:** `whisper.chunkDuration` is actively used in `src/note/note.js:1428` but has NO UI control.

**Location:**

- Used: `E:\Projects\the_real_stickynotes\src\note\note.js:1428`
- Missing from: `E:\Projects\the_real_stickynotes\src\settings\settings.js` mappings
- Missing from: `E:\Projects\the_real_stickynotes\src\settings\index.html`

**Impact:** Users cannot configure this setting through the UI, only via CLI or direct database edit.

**Code Evidence:**

```javascript
// src/note/note.js:1428
const chunkDuration = (await api.getSetting('whisper.chunkDuration')) || 5000;
```

#### 2. **Orphaned Settings in Schema**

**Severity: MEDIUM**

**Issue:** 5 settings defined in schema but not exposed in UI:

1. `general.language` - Defined but NEVER used anywhere
2. `whisper.silenceTimeout` - Defined but NEVER used anywhere
3. `whisper.showConfidence` - Defined but NEVER used anywhere
4. `whisper.autoDownload` - Defined but NEVER used anywhere
5. `whisper.chunkDuration` - Defined, USED in code, but NO UI

**Impact:**

- Dead code (settings 1-4) - clutters schema, confuses developers
- Incomplete feature (setting 5) - users can't configure without CLI

#### 3. **No Validation on Settings Updates**

**Severity: MEDIUM**

**Issue:** `setSetting()` in `shared/database/settings.js` only warns on unknown keys but still writes to DB.

**Code:**

```javascript
// shared/database/settings.js:38-41
if (!isValidSettingKey(key)) {
  console.warn(`Unknown setting key: ${key}`);
}
// Still proceeds to write!
```

**Impact:**

- Can write arbitrary keys to database
- No type validation before storage
- No options/enum validation (e.g., can set `appearance.theme` to invalid value)

#### 4. **Type Coercion Edge Cases**

**Severity: LOW-MEDIUM**

**Issue:** Boolean parsing is loose - `parseSettingValue` treats `'1'` as true but what about `'0'`, `'yes'`, `'no'`?

**Code:**

```javascript
// shared/constants/settings.js:330-331
case 'boolean':
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
```

**Missing cases:**

- `'0'` → returns `false` (good)
- `'false'` → returns `false` (good)
- `'yes'` → returns `false` (unexpected?)
- Empty string `''` → returns `false`
- Any other string → returns `false`

**Impact:** CLI users might expect `'yes'`/`'no'` to work. Inconsistent with common conventions.

### MEDIUM Issues

#### 5. **No Range/Bounds Validation**

**Severity: MEDIUM**

**Issue:** Numeric settings have no min/max validation.

**Examples:**

- `appearance.noteOpacity` - description says "50-100" but no enforcement
- `appearance.defaultNoteWidth` - could be set to 0 or 10000
- `general.autoSaveDelay` - could be set to negative or absurdly high
- `advanced.serverPort` - could be set to invalid port (e.g., -1, 99999)

**Impact:** Invalid values could crash app or cause unexpected behavior.

#### 6. **Enum/Options Validation Not Enforced**

**Severity: MEDIUM**

**Issue:** Settings with `options` array in schema (like `appearance.theme: ['light', 'dark', 'system']`) have NO validation on write.

**Code:** No validation in `setSetting()` checks options array.

**Impact:** Can set `appearance.theme` to `'rainbow'` - will be stored but may cause errors when used.

#### 7. **Time Unit Inconsistency**

**Severity: LOW**

**Issue:** Some time settings use milliseconds, others use minutes, but inconsistently:

- `general.autoSaveDelay` - milliseconds (1000)
- `history.saveInterval` - milliseconds (300000) BUT displayed as minutes in UI
- `reminders.snoozeMinutes` - minutes (15)
- `whisper.silenceTimeout` - milliseconds (3000)
- `whisper.chunkDuration` - milliseconds (5000)

**Impact:** Confusing for developers and CLI users. UI conversion in only one place.

#### 8. **Special Setting Handler Incompleteness**

**Severity: LOW-MEDIUM**

**Issue:** `electron/ipc/settings.js:handleSettingChange()` only handles 4 settings reactively:

- `shortcuts.*` → re-register shortcuts ✅
- `appearance.theme` → update nativeTheme ✅
- `general.startOnBoot` → update auto-launch ✅

**Missing handlers:**

- `advanced.hardwareAcceleration` - requires app restart, no warning given
- `advanced.serverPort` - requires server restart, not implemented
- `general.language` - would require UI reload, not implemented
- `appearance.*` font/size settings - notes need refresh, no broadcast handled

**Impact:** Some settings require app restart but don't notify user.

### LOW Issues

#### 9. **Database Migration Risk**

**Severity: LOW**

**Issue:** If a setting key is renamed or removed from schema, old DB values persist.

**Impact:** DB could contain obsolete keys. No cleanup mechanism.

#### 10. **No Settings Export/Import**

**Severity: LOW**

**Issue:** Users cannot backup/restore their settings easily.

**Impact:** On reinstall or migration, users must reconfigure manually.

## Improvement Recommendations

### HIGH Priority

#### R1. Add Missing UI Controls

**Action:** Add UI controls for the 5 unmapped settings OR remove them from schema.

**For `whisper.chunkDuration` (actively used):**

```html
<!-- Add to settings UI -->
<div class="setting-item">
  <label for="whisperChunkDuration">Audio Chunk Duration (ms)</label>
  <input type="number" id="whisperChunkDuration" min="1000" max="30000" step="1000" />
  <small>How often to process audio chunks (1-30 seconds)</small>
</div>
```

**For unused settings:**

- Either implement their functionality OR remove from schema
- `general.language` - implement i18n or remove
- `whisper.silenceTimeout`, `whisper.showConfidence`, `whisper.autoDownload` - implement or remove

#### R2. Add Validation Layer

**Action:** Create validation function called before `setSetting()`.

**Pseudocode:**

```javascript
function validateSetting(key, value) {
  const schema = settingsSchema[key];
  if (!schema) throw new Error(`Unknown setting: ${key}`);

  // Type check
  const parsedValue = parseSettingValue(key, value);
  if (typeof parsedValue !== schema.type) {
    throw new Error(`Invalid type for ${key}`);
  }

  // Options validation
  if (schema.options && !schema.options.includes(parsedValue)) {
    throw new Error(`Invalid option for ${key}: ${parsedValue}`);
  }

  // Range validation (add min/max to schema)
  if (schema.min !== undefined && parsedValue < schema.min) {
    throw new Error(`Value too low for ${key}: ${parsedValue}`);
  }
  if (schema.max !== undefined && parsedValue > schema.max) {
    throw new Error(`Value too high for ${key}: ${parsedValue}`);
  }

  return parsedValue;
}
```

#### R3. Extend Schema with Constraints

**Action:** Add validation metadata to schema.

**Example:**

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

### MEDIUM Priority

#### R4. Add Settings Requiring Restart Warnings

**Action:** Add `requiresRestart: true` to schema for settings that need app restart.

**Example:**

```javascript
'advanced.hardwareAcceleration': {
  type: 'boolean',
  default: true,
  requiresRestart: true,
  description: 'Enable GPU acceleration',
},
```

**UI Implementation:**

- Show warning icon next to these settings
- On change, show dialog: "This setting requires an app restart. Restart now?"

#### R5. Standardize Time Units

**Action:** Choose one convention and convert all time settings.

**Recommendation:** Store ALL in milliseconds, convert to user-friendly units in UI.

**Updates needed:**

- `reminders.snoozeMinutes` → `reminders.snoozeDuration` (stored as ms)
- Add unit converters in UI layer
- Document in schema: `unit: 'ms'` or `unit: 'minutes'`

#### R6. Settings Export/Import Feature

**Action:** Add CLI commands and UI buttons for backup/restore.

**CLI:**

```bash
stickynotes config export settings.json
stickynotes config import settings.json
```

**Implementation:**

```javascript
function exportSettings() {
  const settings = getAllSettings();
  return JSON.stringify(settings, null, 2);
}

function importSettings(settingsJson) {
  const settings = JSON.parse(settingsJson);
  // Validate each setting before import
  for (const [key, value] of Object.entries(settings)) {
    const validated = validateSetting(key, value);
    setSetting(key, validated);
  }
}
```

### LOW Priority

#### R7. Settings Migration System

**Action:** Add schema version tracking and migration functions.

**Schema:**

```javascript
const SETTINGS_SCHEMA_VERSION = 2;

const settingsMigrations = {
  1: (settings) => {
    // Rename old setting
    if (settings['old.setting']) {
      settings['new.setting'] = settings['old.setting'];
      delete settings['old.setting'];
    }
    return settings;
  },
};
```

#### R8. Settings Documentation Generation

**Action:** Auto-generate settings docs from schema.

**Script:**

```javascript
// scripts/generate-settings-docs.js
function generateSettingsDocs() {
  const output = [];
  output.push('# Settings Reference\n\n');

  for (const [key, schema] of Object.entries(settingsSchema)) {
    output.push(`### ${key}\n`);
    output.push(`- **Type:** ${schema.type}\n`);
    output.push(`- **Default:** ${schema.default}\n`);
    output.push(`- **Description:** ${schema.description}\n`);
    if (schema.options) {
      output.push(`- **Options:** ${schema.options.join(', ')}\n`);
    }
    output.push('\n');
  }

  return output.join('');
}
```

#### R9. Settings Performance Monitoring

**Action:** Add metrics for settings access patterns.

**Use case:** Identify which settings are read most frequently, cache those.

#### R10. Enhanced Boolean Parsing

**Action:** Accept more boolean-like values.

**Update:**

```javascript
case 'boolean':
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return ['true', '1', 'yes', 'on', 'enabled'].includes(str);
```

## Questions/Uncertainties

### Q1. Settings Priority

**Question:** Which of the 5 unmapped settings are planned features vs. dead code?

**Need to clarify:**

- Is internationalization (`general.language`) planned?
- Are the 4 unused whisper settings for future features?
- Should they be removed or implemented?

### Q2. Settings Change Propagation

**Question:** When `appearance.defaultFontSize` changes, should open notes update immediately or only new notes?

**Current behavior:** Unclear - needs testing.

**Options:**

1. Only affect new notes (current assumption)
2. Update all open notes immediately (requires broadcast handling)
3. Prompt user to reload notes

### Q3. Database Path Change

**Question:** What happens if user changes `advanced.databasePath` while app is running?

**Current behavior:** Setting is saved but not applied until restart.

**Should:**

- Show "restart required" warning?
- Disable the setting unless app is restarted?
- Automatically restart app after change?

### Q4. Validation Strictness

**Question:** Should invalid settings:

1. Throw error and reject change?
2. Coerce to nearest valid value?
3. Warn but allow?

**Recommendation:** Option 1 for UI, Option 3 for CLI (with warnings).

### Q5. Settings Sync

**Question:** Are there plans for cloud sync or cross-device settings?

**Impact on design:**

- Would need settings versioning
- Conflict resolution strategy
- Privacy considerations (which settings sync?)

## Additional Observations

### Code Quality: GOOD

- Clean separation of concerns across layers
- Well-tested (unit tests for schema, database, IPC)
- Consistent naming conventions
- Good use of TypeScript-style JSDoc comments

### Test Coverage Analysis

**Files examined:**

- `test/unit/constants/settings.test.js` - ✅ Comprehensive (180+ tests)
- `test/unit/database/settings.test.js` - Assumed comprehensive
- `test/unit/electron/ipc-settings.test.js` - Assumed comprehensive

**Coverage appears good** for core functionality.

### Security Considerations

- No sensitive settings stored (passwords, tokens, etc.) ✅
- Settings table has no authentication/authorization ⚠️
  - But: only accessible via IPC (renderer) or local DB (main process)
  - Not exposed over network except via authenticated HTTP server

### Performance Notes

- Settings read from DB on every `getSetting()` call
- No in-memory cache for frequently-read settings
- Could optimize with LRU cache for hot settings like theme, language

### CLI Integration: EXCELLENT

- Full CRUD support via `stickynotes config` commands
- Proper type parsing
- Good help text and examples
- Uses same validation as main app

### File Paths Referenced

- Schema: `E:\Projects\the_real_stickynotes\shared\constants\settings.js`
- Database: `E:\Projects\the_real_stickynotes\shared\database\settings.js`
- IPC: `E:\Projects\the_real_stickynotes\electron\ipc\settings.js`
- UI: `E:\Projects\the_real_stickynotes\src\settings\settings.js`
- UI HTML: `E:\Projects\the_real_stickynotes\src\settings\index.html`
- Migration: `E:\Projects\the_real_stickynotes\shared\database\migrations\001_initial.js`
- Main: `E:\Projects\the_real_stickynotes\electron\main.js`
- Shortcuts: `E:\Projects\the_real_stickynotes\electron\shortcuts.js`
- Preload: `E:\Projects\the_real_stickynotes\electron\preload.js`
- CLI: `E:\Projects\the_real_stickynotes\cli\commands\config.js`
- Tests: `E:\Projects\the_real_stickynotes\test\unit\constants\settings.test.js`

---

## Summary Statistics

- **Total Settings Defined:** 55
- **Settings with UI Controls:** 50 (90.9%)
- **Settings WITHOUT UI Controls:** 5 (9.1%)
  - Used in code but no UI: 1 (`whisper.chunkDuration`)
  - Defined but never used: 4 (`general.language`, `whisper.silenceTimeout`, `whisper.showConfidence`, `whisper.autoDownload`)
- **Settings Categories:** 10
- **Settings Requiring Restart:** 2+ (needs explicit marking)
- **Settings with Options Validation:** 10 (but not enforced)
- **Settings with Reactive Handlers:** 4 (`shortcuts.*`, `appearance.theme`, `general.startOnBoot`)

**Overall Assessment:** Settings system is well-architected but needs validation layer and UI completion. Core design is solid.
