# ISSUE 9: Dead setting `newNote.focusTitle` - ANALYSIS AND FIX

## Phase 1: VALIDATION - FINDINGS

### 1.1 Settings Schema Check
Found `newNote.focusTitle` in `/shared/constants/settings.js`:
```javascript
'newNote.focusTitle': {
  type: 'boolean',
  default: true,
  description: 'Focus title field on new note',
}
```

### 1.2 Usage Search Results
The setting appears in ONLY these files:
- `shared/constants/settings.js` - Schema definition
- `src/settings/settings.js` - Settings UI mapping (line 31): `focusTitle: 'newNote.focusTitle'`
- `src/settings/index.html` - HTML checkbox element for the setting
- `test/unit/constants/settings.test.js` - Tests checking existence and default value

### 1.3 Critical Finding: NO ACTUAL USAGE
**The setting is completely unused in functional code:**
- NOT used in `electron/windows/manager.js` (note creation/opening)
- NOT used in `src/note/note.js` (note window initialization)
- NOT used in `electron/shortcuts.js` or `electron/tray.js`
- NOT retrieved anywhere with `getSetting('newNote.focusTitle')`
- NOT passed to any window creation logic

### 1.4 Note Window Behavior Analysis
When note loads in `src/note/note.js`:
1. `loadNote()` sets title: `titleInput.value = note.title || ''`
2. Sets content: `noteEditor.innerHTML = note.content || ''`
3. `noteEditor.focus()` is called (always focuses editor, NOT title)
4. No logic to conditionally focus title based on `focusTitle` setting

## Phase 2: INVESTIGATION RESULTS

### 2.1 Window Manager Code
`openNote()` in `electron/windows/manager.js` (lines 223-283):
- Creates BrowserWindow with note properties
- Does NOT read `newNote.focusTitle` setting
- Does NOT pass any focus information to window
- No IPC communication about focus behavior

### 2.2 Settings UI Check
Settings HTML exists at `src/settings/index.html` with:
```html
<input type="checkbox" id="focusTitle">
<span class="setting-description">Focus title field when opening new note</span>
```

BUT:
- The UI element can be changed
- Changes are saved to database via `api.setSetting()`
- Setting value is never retrieved or used by any window code

### 2.3 Tests Check
`test/unit/constants/settings.test.js` has 2 tests:
1. Line 42: Checks `newNote.focusTitle` is defined
2. Line 48: Checks default value is `true`

These tests only validate schema existence, NOT functionality.

### 2.4 Determination: DEAD SETTING
- Setting exists in schema
- Setting exists in UI
- Setting is NOT used anywhere in functional code
- No window/note code calls it
- No backend code references it
- Safe to remove

## Phase 3: FIX IMPLEMENTATION

### Files to Modify

#### 1. `/shared/constants/settings.js` (REMOVE LINES 127-130)
**BEFORE:**
```javascript
  'newNote.focusTitle': {
    type: 'boolean',
    default: true,
    description: 'Focus title field on new note',
  },
```

**AFTER:**
Lines removed entirely (no replacement needed)

#### 2. `/src/settings/settings.js` (REMOVE LINE 31)
**BEFORE:**
```javascript
  focusTitle: 'newNote.focusTitle',
```

**AFTER:**
Line removed from settingMappings object

#### 3. `/src/settings/index.html` (REMOVE LINES ~270-277)
**BEFORE:**
```html
          <label class="setting-label">
            <span class="setting-name">Focus title</span>
            <span class="setting-description">Focus title field when opening new note</span>
          </label>
          <label class="toggle">
            <input type="checkbox" id="focusTitle">
            <span class="toggle-slider"></span>
          </label>
```

**AFTER:**
Removed entirely

#### 4. `/test/unit/constants/settings.test.js` (REMOVE 2 ASSERTIONS)
**BEFORE:**
```javascript
    it('should contain new note behavior settings', () => {
      expect(settingsSchema['newNote.position']).toBeDefined();
      expect(settingsSchema['newNote.cascadeOffset']).toBeDefined();
      expect(settingsSchema['newNote.focusTitle']).toBeDefined();  // REMOVE
    });

    it('should have correct new note defaults', () => {
      expect(settingsSchema['newNote.position'].default).toBe('cascade');
      expect(settingsSchema['newNote.cascadeOffset'].default).toBe(30);
      expect(settingsSchema['newNote.focusTitle'].default).toBe(true);  // REMOVE
    });
```

**AFTER:**
```javascript
    it('should contain new note behavior settings', () => {
      expect(settingsSchema['newNote.position']).toBeDefined();
      expect(settingsSchema['newNote.cascadeOffset']).toBeDefined();
    });

    it('should have correct new note defaults', () => {
      expect(settingsSchema['newNote.position'].default).toBe('cascade');
      expect(settingsSchema['newNote.cascadeOffset'].default).toBe(30);
    });
```

## Phase 4: TEST RESULTS

Command: `npm test`

### Test Output
```
PASS  test/unit/constants/settings.test.js
PASS  test/unit/database/settings.test.js
PASS  test/unit/database/settings-validation.test.js
PASS  test/unit/database/settings-options.test.js
PASS  test/unit/database/settings-range.test.js

Test Suites: 5 passed, 5 total
Tests: 78 passed, 78 total

All tests passing successfully!
```

## Summary

- **Status**: COMPLETE
- **Type**: Dead Code Removal
- **Files Modified**: 4
- **Settings Removed**: 1 (newNote.focusTitle)
- **Tests Updated**: 2 assertions removed
- **Breaking Changes**: None (setting was not functional)
- **Users Affected**: None (setting had no effect)

The `newNote.focusTitle` setting was completely dead code that existed in schema and UI but was never actually used by any window initialization or note creation logic. All references have been cleanly removed, and all tests pass.

## IMPLEMENTATION COMPLETE

### Changes Applied

✓ **File 1: shared/constants/settings.js**
- Removed lines 127-130 (newNote.focusTitle setting definition)
- Status: COMPLETE

✓ **File 2: src/settings/settings.js**
- Removed line 31 (focusTitle mapping from settingMappings)
- Status: COMPLETE

✓ **File 3: src/settings/index.html**
- Removed HTML checkbox element and label for focusTitle
- Status: COMPLETE

✓ **File 4: test/unit/constants/settings.test.js**
- Removed 2 test assertions checking focusTitle existence and default value
- Status: COMPLETE

### Test Results

Command executed: `npm test -- test/unit/constants/settings.test.js`

```
PASS test/unit/constants/settings.test.js
Test Suites: 1 passed, 1 total
Tests:       36 passed, 36 total
```

All 36 tests in the settings constants test suite PASS.

### Verification

- ✓ No references to 'focusTitle' in settings.js schema
- ✓ No references to 'focusTitle' in settings UI mapping
- ✓ No references to 'focusTitle' in HTML
- ✓ No references to 'focusTitle' in test files

### Impact Analysis

- **Breaking Changes**: None (setting had zero functionality)
- **User-Facing Changes**: None (setting had no effect on behavior)
- **Database Migration**: Not needed (setting was never actually used)
- **UI Changes**: Removed unused toggle from settings UI
- **Code Health**: Improved by removing dead code

## RESOLUTION

ISSUE 9 has been successfully resolved. The dead `newNote.focusTitle` setting has been completely removed from:
1. Schema definition
2. Settings UI mapping
3. Settings HTML interface
4. Test coverage

All tests pass and the codebase is cleaner with no functional impact.
