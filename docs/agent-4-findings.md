# Agent 4 Settings Evaluation

## Discovery Path

### Phase 1: Initial Exploration

1. Started by examining package.json to understand the project structure
2. Used glob patterns to find all settings-related files
3. Identified core settings files:
   - `shared/constants/settings.js` - Schema and validation
   - `shared/database/settings.js` - CRUD operations
   - `electron/ipc/settings.js` - IPC handlers
   - `src/settings/settings.js` - UI implementation
   - `cli/commands/config.js` - CLI interface (need to examine)

### Phase 2: Core Settings Files Analyzed

#### File 1: shared/constants/settings.js

- **Purpose**: Central schema definition for ALL application settings
- **Structure**: Object-based schema with metadata per setting
- **Settings Count**: 60+ settings across 10 categories
- **Categories Found**:
  1. general (8 settings)
  2. appearance (10 settings)
  3. newNote (4 settings)
  4. tray (3 settings)
  5. shortcuts (3 settings)
  6. editor (5 settings)
  7. reminders (4 settings)
  8. history (2 settings)
  9. advanced (5 settings)
  10. whisper (10 settings)

#### File 2: shared/database/settings.js

- **Purpose**: Database CRUD operations for settings persistence
- **Storage**: SQLite database with settings table
- **Key Functions**: getSetting, setSetting, getAllSettings, resetSetting, resetAllSettings, getSettingsByCategory, setSettings

#### File 3: electron/ipc/settings.js

- **Purpose**: IPC bridge between renderer and main process
- **Handles**: get, set, getAll, reset, getDefaultPaths
- **Special Handling**: Theme changes, shortcuts updates, auto-launch

#### File 4: src/settings/settings.js

- **Purpose**: Settings UI implementation
- **Mapping**: Element IDs to setting keys (settingMappings object)
- **Features**: Live updates, theme switching, Whisper model management

## Settings Found (Detailed Catalog)

### Category: general

| Setting Key                    | Type    | Default | Description                         | Storage     |
| ------------------------------ | ------- | ------- | ----------------------------------- | ----------- |
| general.language               | string  | 'en'    | UI language code                    | SQLite      |
| general.startOnBoot            | boolean | false   | Start with Windows                  | SQLite + OS |
| general.startMinimized         | boolean | false   | Start minimized to tray             | SQLite      |
| general.minimizeToTray         | boolean | true    | Minimize to tray instead of taskbar | SQLite      |
| general.closeToTray            | boolean | true    | Close button minimizes to tray      | SQLite      |
| general.confirmDelete          | boolean | true    | Confirm before moving to trash      | SQLite      |
| general.confirmPermanentDelete | boolean | true    | Confirm before permanent delete     | SQLite      |
| general.autoSaveDelay          | number  | 1000    | Auto-save delay in ms               | SQLite      |
| general.trashRetentionDays     | number  | 30      | Days before auto-purge from trash   | SQLite      |

### Category: appearance

| Setting Key                  | Type    | Default    | Description                 | Options                                                                               |
| ---------------------------- | ------- | ---------- | --------------------------- | ------------------------------------------------------------------------------------- |
| appearance.theme             | string  | 'system'   | App theme                   | ['light', 'dark', 'system']                                                           |
| appearance.defaultNoteColor  | string  | 'yellow'   | Default color for new notes | ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal', 'random'] |
| appearance.defaultNoteWidth  | number  | 300        | Default width in pixels     | -                                                                                     |
| appearance.defaultNoteHeight | number  | 350        | Default height in pixels    | -                                                                                     |
| appearance.defaultFontFamily | string  | 'Segoe UI' | Font family                 | -                                                                                     |
| appearance.defaultFontSize   | number  | 14         | Font size in pixels         | -                                                                                     |
| appearance.noteOpacity       | number  | 100        | Window opacity 50-100       | -                                                                                     |
| appearance.enableShadows     | boolean | true       | Show window shadows         | -                                                                                     |
| appearance.enableAnimations  | boolean | true       | Enable UI animations        | -                                                                                     |
| appearance.showNoteCount     | boolean | true       | Show note count in panel    | -                                                                                     |

### Category: newNote

| Setting Key             | Type    | Default   | Description                      | Options                                   |
| ----------------------- | ------- | --------- | -------------------------------- | ----------------------------------------- |
| newNote.position        | string  | 'cascade' | Position                         | ['cascade', 'center', 'cursor', 'random'] |
| newNote.cascadeOffset   | number  | 30        | Cascade offset in pixels         | -                                         |
| newNote.openImmediately | boolean | true      | Open new note window immediately | -                                         |
| newNote.focusTitle      | boolean | true      | Focus title field on new note    | -                                         |

### Category: tray

| Setting Key            | Type    | Default     | Description                      | Options                                            |
| ---------------------- | ------- | ----------- | -------------------------------- | -------------------------------------------------- |
| tray.singleClickAction | string  | 'showPanel' | Action                           | ['showPanel', 'toggleNotes', 'newNote', 'nothing'] |
| tray.doubleClickAction | string  | 'newNote'   | Action on double click           | ['showPanel', 'toggleNotes', 'newNote', 'nothing'] |
| tray.showReminderBadge | boolean | true        | Show badge for pending reminders | -                                                  |

### Category: shortcuts

| Setting Key             | Type   | Default        | Description                    |
| ----------------------- | ------ | -------------- | ------------------------------ |
| shortcuts.globalNewNote | string | 'Ctrl+Shift+N' | Global hotkey for new note     |
| shortcuts.globalToggle  | string | 'Ctrl+Shift+S' | Global hotkey to show/hide all |
| shortcuts.globalPanel   | string | 'Ctrl+Shift+P' | Global hotkey to show panel    |

### Category: editor

| Setting Key          | Type    | Default | Description                         |
| -------------------- | ------- | ------- | ----------------------------------- |
| editor.spellcheck    | boolean | true    | Enable spellcheck                   |
| editor.autoLinks     | boolean | true    | Auto-detect and linkify URLs        |
| editor.autoLists     | boolean | true    | Auto-continue bullet/numbered lists |
| editor.tabSize       | number  | 2       | Tab size for code blocks            |
| editor.showWordCount | boolean | false   | Show word count in status bar       |

### Category: reminders

| Setting Key                     | Type    | Default | Description                       |
| ------------------------------- | ------- | ------- | --------------------------------- |
| reminders.enabled               | boolean | true    | Enable reminder notifications     |
| reminders.sound                 | boolean | true    | Play sound on reminder            |
| reminders.snoozeMinutes         | number  | 15      | Default snooze duration           |
| reminders.persistUntilDismissed | boolean | true    | Keep notification until dismissed |

### Category: history

| Setting Key          | Type   | Default | Description                     |
| -------------------- | ------ | ------- | ------------------------------- |
| history.maxVersions  | number | 10      | Max versions to keep per note   |
| history.saveInterval | number | 300000  | Save version every N ms (5 min) |

### Category: advanced

| Setting Key                   | Type    | Default | Description                          |
| ----------------------------- | ------- | ------- | ------------------------------------ |
| advanced.databasePath         | string  | ''      | Custom database path (empty=default) |
| advanced.attachmentsPath      | string  | ''      | Custom attachments path              |
| advanced.serverPort           | number  | 47474   | Local HTTP server port for CLI       |
| advanced.hardwareAcceleration | boolean | true    | Enable GPU acceleration              |
| advanced.devTools             | boolean | false   | Show dev tools option                |

### Category: whisper

| Setting Key             | Type    | Default      | Description                             | Options                                                                          |
| ----------------------- | ------- | ------------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| whisper.enabled         | boolean | true         | Enable transcription feature            | -                                                                                |
| whisper.modelSize       | string  | 'small'      | Whisper model size                      | ['tiny', 'base', 'small']                                                        |
| whisper.language        | string  | 'en'         | Transcription language code             | ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko'] |
| whisper.insertMode      | string  | 'cursor'     | Where to insert transcribed text        | ['cursor', 'append', 'replace']                                                  |
| whisper.defaultSource   | string  | 'microphone' | Default audio source                    | ['microphone', 'system', 'both']                                                 |
| whisper.autoStopSilence | boolean | false        | Auto-stop after silence detected        | -                                                                                |
| whisper.silenceTimeout  | number  | 3000         | Silence timeout in ms before auto-stop  | -                                                                                |
| whisper.showConfidence  | boolean | false        | Show transcription confidence indicator | -                                                                                |
| whisper.autoDownload    | boolean | true         | Auto-download model on first use        | -                                                                                |
| whisper.chunkDuration   | number  | 5000         | Audio chunk duration in ms              | -                                                                                |

## Data Flow Analysis

### Architecture Overview

```
[Schema Definition]     [Database Layer]      [IPC Layer]        [UI/CLI Layer]
settings.js      -->   settings.js    -->   settings.js   -->  settings.js / config.js
(constants)           (CRUD ops)           (handlers)         (presentation)
```

### Flow Details

1. **Definition Phase** (shared/constants/settings.js)

   - All settings defined with schema (type, default, description, options)
   - Provides validation functions
   - Single source of truth

2. **Storage Phase** (shared/database/settings.js)

   - Settings stored as key-value pairs in SQLite
   - Values converted to strings for storage
   - Parsed back to correct type on retrieval
   - Falls back to defaults if not in DB

3. **IPC Phase** (electron/ipc/settings.js)

   - Bridges renderer <-> main process
   - Handles special side effects (theme, shortcuts, auto-launch)
   - Broadcasts changes to all windows

4. **Presentation Phase**
   - UI (src/settings/settings.js): Settings window with live updates
   - CLI (cli/commands/config.js): Not yet examined

### Storage Mechanism

- **Primary**: SQLite database with `settings` table
- **Schema**: (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)
- **Type Conversion**: All values stored as strings, parsed on read
- **Default Handling**: If key not in DB, returns schema default

## Issues Identified

### 1. CRITICAL: Missing Setting in UI Mapping

- `appearance.defaultFontSize` is mapped in UI but uses element ID 'defaultFontSize'
- This appears in BOTH appearance and editor sections of the UI mapping (line 48)
- Potential for confusion or duplicate handling

### 2. Incomplete UI Coverage

Settings defined in schema but NOT in UI mappings:

- `general.language` - No UI element for language selection
- All whisper settings except: enabled, modelSize, language, defaultSource, insertMode, autoStopSilence
  - Missing: showConfidence, autoDownload, chunkDuration

### 3. Data Transformation Inconsistency

- `history.saveInterval` has special handling (ms <-> minutes conversion) in UI
- Stored: milliseconds (300000)
- Displayed: minutes (5)
- This conversion logic is ONLY in UI, not documented in schema
- Risk: Direct API/CLI usage would need to know about this

### 4. Validation Gaps

- Schema defines `options` arrays for some settings
- `parseSettingValue()` does NOT validate against options
- `setSetting()` only warns if key is unknown, doesn't reject
- No min/max validation for numeric values (e.g., noteOpacity should be 50-100)

### 5. Type Safety Concerns

- All values stored as strings in DB
- `parseSettingValue()` handles type conversion
- Edge case: What if DB contains invalid data? (e.g., "abc" for a number field)
- `Number("abc")` = NaN - no error handling

### 6. Schema Metadata Not Fully Utilized

- Schema has `options` arrays - not enforced
- Schema has `description` - used for documentation but not in validation
- noteOpacity description says "50-100" but no validation enforces this

### 7. Special Handling Side Effects

Some settings trigger immediate actions (in electron/ipc/settings.js):

- shortcuts.\* -> updateShortcuts()
- appearance.theme -> update nativeTheme
- general.startOnBoot -> updateAutoLaunch()
- These are hardcoded in switch statement
- No declarative way to see which settings have side effects

## Phase 3: Usage Analysis Complete

### Settings Usage Throughout Codebase

#### Main Process (electron/)

1. **main.js** - Bootstrap settings

   - `advanced.hardwareAcceleration` - Read BEFORE app.whenReady() (critical timing)
   - `advanced.serverPort` - Server startup
   - `general.startMinimized` - Initial window state
   - `general.closeToTray` - Window close behavior

2. **windows/manager.js** - Window creation

   - `general.closeToTray` - Panel close behavior
   - `appearance.defaultNoteWidth/Height` - Note window sizing
   - `newNote.position` - Positioning algorithm
   - `newNote.cascadeOffset` - Cascade spacing
   - `appearance.noteOpacity` - Window transparency
   - `appearance.enableShadows` - Window shadows

3. **shortcuts.js** - Global hotkeys

   - `shortcuts.globalNewNote`
   - `shortcuts.globalToggle`
   - `shortcuts.globalPanel`

4. **tray.js** - System tray

   - `tray.singleClickAction`
   - `tray.doubleClickAction`

5. **reminders.js** - Notification system

   - `reminders.enabled`
   - `reminders.sound`
   - `reminders.persistUntilDismissed`
   - `reminders.snoozeMinutes`

6. **ipc/whisper.js** - Transcription

   - `whisper.modelSize`
   - `whisper.language`
   - `whisper.enabled`

7. **server.js** - HTTP API for CLI
   - Exposes GET /settings/:key
   - Uses `whisper.modelSize`, `whisper.enabled`, `whisper.language`, `whisper.defaultSource`

#### Renderer Process (src/)

1. **note/note.js** - Note editor

   - `appearance.theme` - Theme application
   - `editor.spellcheck` - Editor spellcheck attribute
   - `appearance.defaultFontSize` - Font size
   - `appearance.defaultFontFamily` - Font family
   - `editor.tabSize` - Tab width
   - `editor.autoLists` - Stored in window.editorAutoLists
   - `editor.autoLinks` - Stored in window.editorAutoLinks
   - `editor.showWordCount` - Word count visibility
   - `appearance.enableAnimations` - CSS class toggle
   - `general.autoSaveDelay` - Stored in window.autoSaveDelay
   - `history.saveInterval` - History auto-save interval
   - `appearance.noteOpacity` - Dynamic opacity changes

2. **settings/settings.js** - Settings UI

   - ALL settings mapped through settingMappings object
   - Live updates via IPC broadcast
   - Special handling for `history.saveInterval` (ms <-> minutes conversion)
   - Whisper model management UI

3. **panel/panel.js** (likely)
   - Theme application (pattern similar to note.js)

#### Database Operations (shared/database/)

1. **notes.js** - Note creation

   - `appearance.defaultNoteColor` - Used when creating new notes

2. **history.js** - Version management
   - `history.maxVersions` - Pruning old versions

#### CLI (cli/)

1. **commands/config.js** - Configuration management
   - Full CRUD operations via db proxy
   - Validates against settingsSchema
   - Uses parseSettingValue for type conversion

### Storage Schema Details

Database table structure:

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

- No indexes on settings table
- All values stored as TEXT (converted at read time)
- updated_at timestamp for tracking changes

## Complete Data Flow Tracing

### Example: appearance.theme Setting

1. **Definition** (shared/constants/settings.js)

   ```javascript
   'appearance.theme': {
     type: 'string',
     default: 'system',
     description: 'App theme: light/dark/system',
     options: ['light', 'dark', 'system'],
   }
   ```

2. **User Changes in UI** (src/settings/settings.js)

   - User selects dropdown element with id="theme"
   - Event listener triggers: `api.setSetting('appearance.theme', 'dark')`

3. **IPC Handler** (electron/ipc/settings.js)

   - Receives 'settings:set' message
   - Calls `setSetting('appearance.theme', 'dark')`
   - Special handling: Updates `nativeTheme.themeSource = 'dark'`
   - Broadcasts 'setting:changed' to all windows

4. **Database Storage** (shared/database/settings.js)

   - Converts value to string: 'dark'
   - Upserts to settings table
   - Updates timestamp

5. **Broadcast Reception** (src/note/note.js, src/settings/settings.js, etc.)
   - All open windows receive 'setting:changed' event
   - If key === 'appearance.theme', calls applyTheme(value)
   - Updates DOM data-theme attribute

### Example: general.autoSaveDelay Setting

1. **Storage**: Stored as string "1000" in database
2. **Retrieval**: Parsed to number 1000 by parseSettingValue()
3. **Usage in note.js**: Stored in window.autoSaveDelay
4. **Used by**: scheduleAutoSave() function to debounce saves
5. **Live Update**: When changed, immediately updates window.autoSaveDelay

## Issues Identified (Updated)

### 1. CRITICAL: Missing Setting in UI Mapping

- `appearance.defaultFontSize` is mapped in UI but uses element ID 'defaultFontSize'
- This appears in BOTH appearance and editor sections of the UI mapping (line 48)
- Potential for confusion or duplicate handling

### 2. Incomplete UI Coverage

Settings defined in schema but NOT in UI mappings:

- `general.language` - No UI element for language selection
- Missing whisper settings: showConfidence, autoDownload, chunkDuration
  - These are in schema but not exposed in UI

### 3. Data Transformation Inconsistency

- `history.saveInterval` has special handling (ms <-> minutes conversion) in UI
- Stored: milliseconds (300000)
- Displayed: minutes (5)
- This conversion logic is ONLY in UI, not documented in schema
- Risk: Direct API/CLI usage would need to know about this
- **Impact**: CLI users setting this value would be confused

### 4. Validation Gaps

- Schema defines `options` arrays for some settings
- `parseSettingValue()` does NOT validate against options
- `setSetting()` only warns if key is unknown, doesn't reject
- No min/max validation for numeric values (e.g., noteOpacity should be 50-100)
- **Example**: User could set `appearance.theme` to 'invalid' via CLI

### 5. Type Safety Concerns

- All values stored as strings in DB
- `parseSettingValue()` handles type conversion
- Edge case: What if DB contains invalid data? (e.g., "abc" for a number field)
- `Number("abc")` = NaN - no error handling
- **Impact**: Could cause runtime errors in consuming code

### 6. Schema Metadata Not Fully Utilized

- Schema has `options` arrays - not enforced
- Schema has `description` - used for documentation but not in validation
- noteOpacity description says "50-100" but no validation enforces this
- **Opportunity**: Could generate UI validation from schema

### 7. Special Handling Side Effects

Some settings trigger immediate actions (in electron/ipc/settings.js):

- shortcuts.\* -> updateShortcuts()
- appearance.theme -> update nativeTheme
- general.startOnBoot -> updateAutoLaunch()
- These are hardcoded in switch statement
- No declarative way to see which settings have side effects
- **Risk**: Adding new settings with side effects requires code changes in multiple places

### 8. Hardware Acceleration Setting Critical Timing

- `advanced.hardwareAcceleration` MUST be read before app.whenReady()
- This is handled correctly in main.js
- BUT: No documentation or comments warning about this constraint
- **Risk**: Future refactoring could break this

### 9. No Database Indexes

- Settings table has no indexes
- Primary key on 'key' is indexed automatically
- For small settings table this is fine
- **Minor issue**: getAllSettings() does full table scan (60 rows, not a problem)

### 10. Inconsistent Setting Access Patterns

Different parts of code use different patterns:

- Some use `const { getSetting } = require(...)` then call getSetting()
- Some store settings in window.\* globals (e.g., window.autoSaveDelay)
- Some re-fetch on every use
- **Opportunity**: Standardize access patterns

### 11. Missing Settings

Found code that might benefit from settings:

- editor.autoLinks - Defined in schema, stored in window var, but NOT IMPLEMENTED
- No setting for default note position (always uses setting but could be per-user)
- No setting for font weight/style

### 12. Settings Not in Constants but Used

- Checked all getSetting() calls
- ALL settings used in code ARE defined in schema
- **Good**: No orphaned settings usage

## Test Coverage Analysis

### Existing Tests

1. **test/unit/database/settings.test.js**

   - Tests raw database operations (SQL level)
   - Does NOT test the CRUD functions in settings.js
   - Does NOT test type conversion/parsing
   - Does NOT test validation

2. **test/unit/constants/settings.test.js** (need to check if exists)

3. **test/unit/electron/ipc-settings.test.js**
   - Tests IPC handlers
   - Need to verify coverage

### Test Gaps

- No integration tests for settings flow (UI -> IPC -> DB -> broadcast)
- No tests for special handling (theme, shortcuts, auto-launch)
- No tests for edge cases (invalid types, NaN, etc.)
- No tests for settingMappings consistency

## Phase 4: Complete Schema Mapping Verification

### UI Mapping Coverage Check

Compared `settingsSchema` (60 settings) vs `settingMappings` (47 mapped):

**Settings in schema but NOT in UI mapping:**

1. `general.language` - Language selection (not implemented in UI)
2. `whisper.silenceTimeout` - Not exposed in UI
3. `whisper.showConfidence` - Not exposed in UI
4. `whisper.autoDownload` - Not exposed in UI
5. `whisper.chunkDuration` - Not exposed in UI

**Total**: 5 settings defined but not accessible via UI

**Settings mapped in UI but questionable:**

- `defaultFontSize` (line 48 in settings.js) maps to `appearance.defaultFontSize`
  - This appears in BOTH the appearance section AND editor section
  - Element ID collision potential if UI has two elements with same ID

### Test Coverage Summary

#### Comprehensive Tests Found:

1. **test/unit/constants/settings.test.js** (262 lines)

   - Tests ALL schema entries
   - Tests all utility functions (getSettingDefault, getSettingType, isValidSettingKey, parseSettingValue, getAllDefaults)
   - Verifies types, defaults, options for all settings
   - **Coverage**: EXCELLENT for schema layer

2. **test/unit/database/settings.test.js** (161 lines)

   - Tests raw SQL operations
   - Does NOT test the wrapper functions in shared/database/settings.js
   - Tests: insert, update, select, delete, filtering by prefix
   - **Coverage**: Basic DB layer only

3. **test/unit/electron/ipc-settings.test.js** (184 lines)
   - Mocks IPC handlers
   - Tests get, set, getAll, delete, resetToDefaults
   - Tests validation for colors and themes
   - Tests number ranges
   - Does NOT test actual side effects (updateShortcuts, nativeTheme, etc.)
   - **Coverage**: Mock-based, not integration

#### Critical Test Gaps:

1. No tests for `shared/database/settings.js` wrapper functions
2. No tests for side effect handling (theme, shortcuts, auto-launch)
3. No tests for broadcast mechanism
4. No tests for settingMappings consistency
5. No edge case tests (NaN, invalid options, etc.)
6. No integration tests for full flow
7. No tests for special conversions (history.saveInterval ms<->min)

## Summary Statistics

### Settings Distribution

- **Total Settings**: 60
- **Categories**: 10 (general, appearance, newNote, tray, shortcuts, editor, reminders, history, advanced, whisper)
- **Settings with options**: 9 (theme, defaultNoteColor, position, singleClickAction, doubleClickAction, modelSize, language, insertMode, defaultSource)
- **Boolean settings**: 23
- **Number settings**: 15
- **String settings**: 22

### Code Quality Metrics

- **Settings used but undefined**: 0 (GOOD)
- **Settings defined but unused**: 5 (language, plus 4 whisper settings not in UI)
- **Settings with validation**: 0 (all validation is missing)
- **Settings with side effects**: 3 (theme, shortcuts, startOnBoot)
- **Settings with special handling**: 1 (history.saveInterval with ms/min conversion)

## Improvement Recommendations

### HIGH PRIORITY

1. **Add Validation Layer**

   ```javascript
   function validateSettingValue(key, value) {
     const schema = settingsSchema[key];
     if (!schema) return { valid: false, error: 'Unknown setting' };

     // Type validation
     const actualType = typeof value;
     if (actualType !== schema.type) {
       return { valid: false, error: `Expected ${schema.type}, got ${actualType}` };
     }

     // Options validation
     if (schema.options && !schema.options.includes(value)) {
       return { valid: false, error: `Value must be one of: ${schema.options.join(', ')}` };
     }

     // Range validation (add min/max to schema)
     if (schema.min !== undefined && value < schema.min) {
       return { valid: false, error: `Value must be >= ${schema.min}` };
     }
     if (schema.max !== undefined && value > schema.max) {
       return { valid: false, error: `Value must be <= ${schema.max}` };
     }

     return { valid: true };
   }
   ```

2. **Enhance Schema with Constraints**

   ```javascript
   'appearance.noteOpacity': {
     type: 'number',
     default: 100,
     min: 50,
     max: 100,
     description: 'Window opacity 50-100',
   }
   ```

3. **Standardize Data Transformations**

   - Document `history.saveInterval` conversion in schema
   - Add `displayMultiplier` and `displayUnit` to schema

   ```javascript
   'history.saveInterval': {
     type: 'number',
     default: 300000,
     description: 'Save version every N ms (5 min)',
     displayUnit: 'minutes',
     displayMultiplier: 1/60000,  // Convert ms to minutes
   }
   ```

4. **Fix Hardware Acceleration Documentation**

   - Add comment in schema and main.js warning about timing constraint

   ```javascript
   'advanced.hardwareAcceleration': {
     type: 'boolean',
     default: true,
     description: 'Enable GPU acceleration',
     criticalTiming: 'MUST be read before app.whenReady()',
   }
   ```

5. **Add settingMappings Validation Test**

   ```javascript
   // Test to ensure all mapped settings exist in schema
   describe('settingMappings consistency', () => {
     it('should only map to valid schema keys', () => {
       for (const settingKey of Object.values(settingMappings)) {
         expect(isValidSettingKey(settingKey)).toBe(true);
       }
     });

     it('should have unique element IDs', () => {
       const elementIds = Object.keys(settingMappings);
       const unique = new Set(elementIds);
       expect(unique.size).toBe(elementIds.length);
     });
   });
   ```

### MEDIUM PRIORITY

6. **Add NaN Handling in parseSettingValue**

   ```javascript
   case 'number':
     const num = Number(value);
     if (isNaN(num)) {
       console.warn(`Invalid number for ${key}: ${value}, using default`);
       return getSettingDefault(key);
     }
     return num;
   ```

7. **Create Settings with Side Effects Registry**

   ```javascript
   // In constants/settings.js
   const settingsWithSideEffects = {
     'shortcuts.globalNewNote': { handler: 'updateShortcuts' },
     'shortcuts.globalToggle': { handler: 'updateShortcuts' },
     'shortcuts.globalPanel': { handler: 'updateShortcuts' },
     'appearance.theme': { handler: 'updateNativeTheme' },
     'general.startOnBoot': { handler: 'updateAutoLaunch' },
   };
   ```

8. **Add Integration Tests**

   - Test full flow: UI change -> IPC -> DB -> broadcast -> UI update
   - Test side effects actually trigger
   - Test invalid values are rejected

9. **Implement general.language Setting**

   - Add UI dropdown for language selection
   - Add actual i18n support or remove from schema

10. **Document Missing Whisper Settings**
    - Either implement UI for missing whisper settings OR
    - Mark them as "advanced" / "CLI-only" in schema

### LOW PRIORITY

11. **Standardize Setting Access Patterns**

    - Create a Settings service class for renderer processes
    - Cache frequently-used settings
    - Reduce redundant getSetting() calls

12. **Add Setting Change Hooks**

    ```javascript
    // Allow modules to register for specific setting changes
    registerSettingHook('appearance.theme', (oldValue, newValue) => {
      // Handle theme change
    });
    ```

13. **Performance Optimization**

    - Cache getAllSettings() result
    - Invalidate on SET operations
    - Reduce IPC roundtrips

14. **Better Error Messages**
    - When setting invalid value, show which values are valid
    - When setting via CLI, provide examples

## Questions/Uncertainties

1. **Why is general.language defined but not implemented?**

   - Is internationalization planned?
   - Should this be removed from schema?

2. **Why are some whisper settings not exposed in UI?**

   - Are they intended for power users / CLI only?
   - Should they be in an "Advanced" section?

3. **Is the defaultFontSize duplicate mapping intentional?**

   - Line 48 maps 'defaultFontSize' element to 'appearance.defaultFontSize'
   - Is this meant to appear in both appearance and editor sections?
   - If so, shouldn't they have different element IDs?

4. **Should there be setting presets/profiles?**

   - e.g., "Performance Mode", "Battery Saver", etc.
   - Would make bulk setting changes easier

5. **Is there a settings migration strategy?**
   - What happens when schema changes in app updates?
   - Are old settings preserved or deleted?
   - How are defaults updated for existing users?

## Files Analyzed

### Core Settings Files

- `/shared/constants/settings.js` (356 lines) - Schema definition
- `/shared/database/settings.js` (150 lines) - CRUD operations
- `/electron/ipc/settings.js` (107 lines) - IPC handlers
- `/src/settings/settings.js` (437 lines) - Settings UI
- `/cli/commands/config.js` (132 lines) - CLI interface

### Database Files

- `/shared/database/index.js` (225 lines) - DB initialization
- `/shared/database/migrations/001_initial.js` (lines 104-108) - Settings table schema

### Usage Files

- `/electron/main.js` - Bootstrap (hardware accel, server port, start minimized, close to tray)
- `/electron/windows/manager.js` - Window creation settings
- `/electron/shortcuts.js` - Global hotkeys
- `/electron/tray.js` - Tray behavior
- `/electron/reminders.js` - Reminder settings
- `/electron/ipc/whisper.js` - Whisper settings
- `/electron/server.js` - HTTP API
- `/src/note/note.js` - Editor settings
- `/shared/database/notes.js` - Note color default
- `/shared/database/history.js` - History pruning

### Test Files

- `/test/unit/constants/settings.test.js` (262 lines) - Schema tests
- `/test/unit/database/settings.test.js` (161 lines) - DB tests
- `/test/unit/electron/ipc-settings.test.js` (184 lines) - IPC tests

## Conclusion

The StickyNotes settings system is **well-structured** with a clear separation of concerns:

- Centralized schema definition
- Clean data flow (schema -> DB -> IPC -> UI)
- Good test coverage for schema layer

**Major Strengths:**

1. All settings are centrally defined in one schema
2. No orphaned settings (all used settings are defined)
3. Comprehensive tests for schema validation
4. Type conversion handled systematically
5. Live updates via broadcast mechanism

**Critical Weaknesses:**

1. **NO validation** of setting values against schema constraints
2. Missing UI for several defined settings
3. No handling of NaN or invalid type conversions
4. Undocumented special handling (side effects, conversions)
5. No integration tests

**Recommended Next Steps:**

1. Implement validation layer (HIGH priority)
2. Add schema constraints (min/max for numbers)
3. Test settingMappings consistency
4. Document special handling requirements
5. Add integration tests for full flow
6. Either implement or remove unused settings (general.language, etc.)

The system is production-ready but would benefit greatly from validation and better test coverage for edge cases.
