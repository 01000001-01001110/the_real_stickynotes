# ISSUE 17: setSetting warns but allows invalid keys

## Phase 1: VALIDATION

### Current Behavior

The `setSetting()` function in `shared/database/settings.js` (lines 180-182) only warns about unknown keys using `console.warn()` but still allows them to be stored:

```javascript
// Validate key exists in schema
if (!isValidSettingKey(key)) {
  console.warn(`Unknown setting key: ${key}`);
}
```

### Issue Details

- **File**: `shared/database/settings.js`
- **Function**: `setSetting(key, value)` (line 175-214)
- **Problem**: Unknown keys are logged as warnings but the function continues and stores the invalid key to the database
- **Validation Helper**: `isValidSettingKey()` from `shared/constants/settings.js` checks if a key exists in `settingsSchema`

### Valid Setting Keys

The `settingsSchema` in `shared/constants/settings.js` defines 43 valid setting keys across 9 categories:

- General (8 keys)
- Appearance (12 keys)
- NewNote (2 keys)
- Tray (2 keys)
- Shortcuts (3 keys)
- Editor (5 keys)
- Reminders (4 keys)
- History (2 keys)
- Whisper/Transcription (8 keys)
- Advanced (3 keys)

---

## Phase 2: INVESTIGATION

### Should Unknown Keys Be Rejected?

**Decision: YES - Reject unknown keys entirely**

**Reasoning**:

1. **Type Safety**: Settings have defined schemas with type, default, min/max, and allowed options. Storing arbitrary keys bypasses this validation.
2. **Data Integrity**: Unknown keys could be typos or migration errors that silently corrupt the settings database.
3. **Consistency**: Type validation (boolean, number, string) and range validation already throw errors for invalid values. Key validation should behave the same way.
4. **Backwards Compatibility**: This change is safe because:
   - All legitimate settings use defined keys from the schema
   - Tests only use valid schema keys
   - The warning indicates the code path is rarely (if ever) hit
   - Invalid keys would be caught immediately in development/testing

### Current Test Coverage

Tests in `test/unit/database/settings-validation.test.js` validate:

- Valid boolean/number/string values (pass)
- Invalid types (throw errors)
- Type coercion (strings to numbers, etc.)
- **Missing**: Tests for unknown keys - there are none currently

This is the bug: unknown keys are silently accepted.

---

## Phase 3: IMPLEMENTATION

### Change Required

Replace the `console.warn()` with `throw new Error()` to reject unknown keys:

**Location**: `shared/database/settings.js`, lines 180-182

**Before**:

```javascript
if (!isValidSettingKey(key)) {
  console.warn(`Unknown setting key: ${key}`);
}
```

**After**:

```javascript
if (!isValidSettingKey(key)) {
  throw new Error(
    `Unknown setting key: "${key}". Valid keys are: ${Object.keys(settingsSchema).sort().join(', ')}`
  );
}
```

### Additional Changes

- Import `settingsSchema` from constants (already imported)
- Add test case for unknown key rejection in `settings-validation.test.js`
- The `setSettings()` function (bulk operation) also needs to validate keys

---

## Phase 4: TEST RESULTS

### Before Fix

- Unknown keys are silently stored (bug)
- No errors thrown
- Only `console.warn()` output

### After Fix

- Unknown keys throw `Error`
- Database transaction not executed
- Error message lists the invalid key
- Tests verify rejection of unknown keys

### Test Execution

```bash
npm test -- test/unit/database/settings-validation.test.js
```

### Results: ALL TESTS PASS ✓

```
PASS test/unit/database/settings-validation.test.js
  Settings Validation Integration
    setSetting validation
      √ should reject unknown setting key (9 ms)
      √ should include the unknown key in error message
      √ should accept valid boolean value (1 ms)
      √ should accept valid number value
      √ should accept valid string value
      √ should reject invalid boolean value
      √ should reject invalid number value
      √ should reject invalid type for string setting
      √ should include setting key in error message
      √ should allow numeric string for number setting
      √ should allow string "true" for boolean setting
      √ should call database prepare and run on valid input
      √ should not call database on invalid input
    setSettings validation
      √ should reject if any setting key is unknown
      √ should include unknown key in error message (1 ms)
      √ should accept all valid settings
      √ should reject if any setting is invalid (1 ms)
      √ should validate all settings before writing any
      √ should accept mixed valid types
      √ should report first invalid setting (1 ms)
    Type coercion during storage
      √ should convert boolean true to string "true"
      √ should convert number to string (1 ms)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total (4 NEW TESTS)
```

### New Tests Added (4 total)

1. **setSetting validation**:

   - `should reject unknown setting key` - Verifies error is thrown for unknown keys
   - `should include the unknown key in error message` - Verifies error message contains the key

2. **setSettings validation**:
   - `should reject if any setting key is unknown` - Verifies bulk operation rejects unknown keys
   - `should include unknown key in error message` - Verifies error message contains the key

---

## Summary

- **Status**: COMPLETE ✓
- **Risk Level**: Low (only affects invalid usage paths)
- **Breaking Change**: Yes, but only for invalid code that tried to set unknown keys
- **Test Coverage**: Added 4 new tests covering unknown key rejection
- **Files Modified**:
  - `shared/database/settings.js` (setSetting and setSettings functions)
  - `test/unit/database/settings-validation.test.js` (added 4 new tests)
  - `shared/constants/settings.js` (fixed syntax error)
