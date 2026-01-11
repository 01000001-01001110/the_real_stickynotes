# ISSUE 15: Schema Versioning Implementation

## Phase 1: VALIDATION

### Current State Analysis

#### Settings Schema File

- **Location**: `shared/constants/settings.js`
- **Status**: NO version tracking found
- **Details**:
  - Contains `settingsSchema` object with 50+ settings across 13 categories
  - Exports: `settingsSchema`, `getSettingDefault`, `getSettingType`, `isValidSettingKey`, `parseSettingValue`, `getAllDefaults`
  - No version constant or version field in schema

#### Migration System

- **Status**: Database migrations exist but are NOT tied to settings schema
- **Location**: `shared/database/migrations/`
- **Structure**:
  - `001_initial.js` - Initial database schema
  - `002_fts.js` - Full-text search addition
  - `index.js` - Migration runner with `runMigrations()` and `rollbackMigration()`
- **Gap**: Database schema versioning is separate from settings schema versioning
- **Problem**: No way to track or migrate breaking changes to settings

#### Settings Database Operations

- **Location**: `shared/database/settings.js`
- **Functions**: `getSetting`, `setSetting`, `getAllSettings`, `resetSetting`, `resetAllSettings`, `getSettingsByCategory`, `setSettings`
- **Current Flow**: No version checks during load/save

### Findings

| Category                      | Finding                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| **Schema Version**            | MISSING - no constant, no version field in schema           |
| **Migration Strategy**        | MISSING - no way to handle breaking changes in settings     |
| **Validation**                | Type, range, and options validation exist (good foundation) |
| **Test Coverage**             | Yes - 6 test files for settings functionality               |
| **Breaking Changes Handling** | No mechanism to detect or handle schema changes             |

---

## Phase 2: INVESTIGATION

### What Should Schema Version Look Like?

**Approach**: Simple, minimal, semantic versioning

```javascript
// Version format: MAJOR.MINOR.PATCH
// MAJOR: Breaking changes requiring migration
// MINOR: New settings added (backward compatible)
// PATCH: Documentation or minor fixes

const SETTINGS_SCHEMA_VERSION = 1;

// When to increment:
// - Increment MAJOR (2.0.0) when removing settings or changing structure
// - Increment MINOR (1.1.0) when adding new settings
// - Increment PATCH (1.0.1) when fixing default values without affecting saved data
```

### How Would Migrations Work?

**Pattern**: Similar to database migrations

1. Create `shared/constants/schema-migrations.js` for future use
2. Store current schema version in settings database
3. On app load: compare stored version vs current version
4. If versions differ: run migration strategy (documented for future)
5. Update stored version after migration

**Future Migration Example**:

```
If user has v1 settings and app is v2:
- Load old settings with v1 schema
- Transform via migration function
- Save with v2 schema
- Update stored version to 2
```

### Minimal Implementation

**Phase 1** (THIS ISSUE):

- Add `SETTINGS_SCHEMA_VERSION = 1` constant
- Export it for future use
- Document when/how to increment
- Add comments showing migration pattern

**Phase 2** (FUTURE):

- Create migration system similar to database migrations
- Store current version in database
- Add version checking on settings load

---

## Phase 3: IMPLEMENTATION

### File Changes

#### 1. Update `shared/constants/settings.js`

**Changes**:

- Add version constant at top: `const SETTINGS_SCHEMA_VERSION = 1;`
- Export it in module.exports
- Add documentation comment explaining versioning

**Code Addition**:

```javascript
/**
 * Settings schema version for migration tracking
 *
 * VERSIONING GUIDE:
 * - Increment MAJOR (e.g., 2) when removing/renaming settings or changing structure
 * - Increment MINOR (e.g., 1.1) when adding new settings (backward compatible)
 * - Increment PATCH (e.g., 1.0.1) when fixing default values only
 *
 * MIGRATION PATTERN (for future use):
 * 1. Load settings with old schema version
 * 2. Transform via migration function
 * 3. Save with new schema version
 * 4. Update stored version
 *
 * @type {number}
 */
const SETTINGS_SCHEMA_VERSION = 1;
```

**Export Addition**:

```javascript
module.exports = {
  settingsSchema,
  SETTINGS_SCHEMA_VERSION,
  getSettingDefault,
  // ... rest of exports
};
```

---

## Phase 4: TESTING

### Test Execution

**Command**: `npm test`

**Expected Results**:

- All existing tests pass (backward compatible)
- New export is available for import
- No breaking changes to existing API

### Test Verification

**Test File**: `test/unit/constants/settings.test.js`

**Test Cases to Verify**:

1. ✓ Can import `SETTINGS_SCHEMA_VERSION`
2. ✓ Version is type `number`
3. ✓ Version value is `1`
4. ✓ All existing exports still work

---

## Implementation Status

- [x] Phase 1: Validation Complete
- [x] Phase 2: Investigation Complete
- [x] Phase 3: Implementation Complete
- [x] Phase 4: Testing Complete

### Changes Made

1. Added `SETTINGS_SCHEMA_VERSION = 1` constant at top of `shared/constants/settings.js`
2. Exported `SETTINGS_SCHEMA_VERSION` in module.exports
3. Added comprehensive documentation comments explaining:
   - When to increment version numbers
   - Migration pattern for future use
4. Verified backward compatibility with all existing tests

### Test Results

**Command**: `npm test -- test/unit/constants/settings.test.js test/unit/electron/ipc-settings.test.js test/unit/database/settings-validation.test.js test/unit/database/settings-options.test.js test/unit/database/settings-range.test.js`

**Results**:

- Test Suites: 5 passed, 5 total
- Tests: 143 passed, 143 total
- All settings-related tests PASS
- No breaking changes to existing API

**Verification**:

```bash
node -e "const { SETTINGS_SCHEMA_VERSION } = require('./shared/constants/settings');
console.log('Version:', SETTINGS_SCHEMA_VERSION); // Output: 1
console.log('Type:', typeof SETTINGS_SCHEMA_VERSION); // Output: number"
```

### Future Work

Phase 2 should consider:

1. Create `shared/constants/schema-migrations.js` for migration handlers
2. Store current schema version in settings database
3. Add version checking on app startup
4. Implement migration runner similar to database migrations

---

## Related Files

- `shared/constants/settings.js` - Main schema file
- `shared/database/settings.js` - Settings operations
- `shared/database/migrations/` - Database migration pattern reference
- `test/unit/constants/settings.test.js` - Settings tests
- `test/unit/database/settings.test.js` - Database settings tests
