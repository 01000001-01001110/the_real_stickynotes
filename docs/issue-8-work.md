# ISSUE 8: Dead setting newNote.openImmediately

## Phase 1: VALIDATION

### Setting Definition

- **Location**: shared/constants/settings.js (lines 127-131)
- **Status**: Defined in schema
- **Default**: true
- **Type**: boolean
- **Description**: "Open new note window immediately"

### UI Element

- **Location**: src/settings/index.html (New Note section)
- **Element ID**: openImmediately
- **Mapping**: src/settings/settings.js (line 31)
- **Status**: UI present and mapped to setting

### Usage Search Results

```
Found 19 references to "openImmediately" in codebase:
- shared/constants/settings.js (definition)
- src/settings/index.html (UI control)
- src/settings/settings.js (UI mapping)
- docs/* (various reports)
- test/unit/constants/settings.test.js (tests)
```

### Code Analysis

Searched ALL code paths for actual usage:

- electron/tray.js: Creates notes → ALWAYS calls `windowManager.openNote(note.id)` (unconditional)
- electron/shortcuts.js: Creates notes → ALWAYS calls `windowManager.openNote(note.id)` (unconditional)
- electron/windows/manager.js: openNote() function always shows window (line 252-253)
- electron/ipc/notes.js: notes:create handler has NO logic checking setting
- electron/ipc/windows.js: windows:openNote handler has NO logic checking setting

**Result**: Setting is NEVER CHECKED OR USED

## Phase 2: INVESTIGATION

### Is it actually used?

**NO** - All code paths bypass this setting and open notes unconditionally.

### Is it in settings UI?

**YES** - But completely non-functional. Changing the setting has no effect.

### Safe to remove?

**YES** - The setting:

- Is not referenced in any active code logic
- Has no external dependencies
- Can be safely removed without affecting functionality
- Notes will still open immediately (current default behavior)

## Phase 3: DECISION

**Determine**: This IS a dead setting.
**Action**: REMOVE from:

1. shared/constants/settings.js (schema definition)
2. src/settings/index.html (UI control)
3. src/settings/settings.js (settings mapping)
4. test/unit/constants/settings.test.js (related tests)

**Rationale**:

- Setting has zero functional impact (notes always open immediately regardless)
- Removing it simplifies codebase without changing behavior
- Default behavior (immediate opening) will remain unchanged

## Phase 4: TEST

### Test Results

```
PASS test/unit/constants/settings.test.js
Test Suites: 1 passed, 1 total
Tests:       36 passed, 36 total
```

All settings tests pass after removal.

### Changes Made

1. Removed from shared/constants/settings.js (4 lines)
2. Removed from src/settings/settings.js (1 line)
3. Removed from src/settings/index.html (10 lines)
4. Removed from test/unit/constants/settings.test.js (2 assertions)

---

**Status: COMPLETE**

Setting `newNote.openImmediately` was confirmed dead code and safely removed. All tests pass. Notes will continue to open immediately on creation (this is the hardcoded behavior in tray.js and shortcuts.js that cannot be changed by settings).

**Impact**:

- Users no longer see non-functional "Open immediately" toggle in settings
- Codebase is cleaner with one less dead setting
- Default behavior unchanged (notes still open immediately)
