# ISSUE 6: Dead Setting whisper.showConfidence

## PHASE 1: VALIDATION

### Finding 1: Setting Defined in Schema
- **File**: `/e/Projects/the_real_stickynotes/shared/constants/settings.js`
- **Status**: FOUND (REMOVED) - Setting was in settingsSchema
- **Original Definition**:
  ```javascript
  'whisper.showConfidence': {
    type: 'boolean',
    default: false,
    description: 'Show transcription confidence indicator',
  }
  ```

### Finding 2: No Code Usage
- **Search Results**: No active code references found
- **Locations Checked**:
  - `/e/Projects/the_real_stickynotes/src/` - Zero matches
  - `/e/Projects/the_real_stickynotes/test/` - Zero matches
  - Transcription manager: `src/note/transcription.js` - Does NOT read or display confidence

### Finding 3: Not in Settings UI
- **File**: `/e/Projects/the_real_stickynotes/src/settings/settings.js`
- **Status**: NOT MAPPED to UI
- **Evidence**: settingMappings object (lines 4-74) includes only:
  - whisperEnabled
  - whisperModelSize
  - whisperLanguage
  - whisperDefaultSource
  - whisperInsertMode
  - **showConfidence is MISSING**
- **UI File**: `src/settings/index.html` - No confidence input element

### Finding 4: Transcription Code Analysis
- **File**: `src/note/transcription.js`
- **Method `processAudioChunks()`**: Receives `result.confidence` from API but never uses it
- **onTranscription callback**: Takes `result.confidence` as parameter but feature is incomplete

## PHASE 2: INVESTIGATION

### Is there code that should use this?
**NO** - The transcription.js file receives confidence data but has no UI implementation:
- Line 203: `this.onTranscription(result.text, result.confidence);`
- No component displays or controls this value

### Is it in settings UI?
**NO** - Not mapped, no HTML element, no event handler

### Safe to remove?
**YES** - This is dead code:
1. No code path accesses it
2. No UI references it
3. No tests validate it
4. Safe to remove without breaking functionality

### Risk Assessment
- **BREAKING**: None - setting is never read
- **DEPENDENCY**: None - no other code depends on this
- **TESTS**: None exist to break

## PHASE 3: FIX EXECUTION

### Removed from:
1. **`shared/constants/settings.js`** - Deleted 5-line schema entry (lines 302-306)
2. No settingMappings to remove (wasn't mapped)
3. No test files to update (weren't testing it)
4. No UI files to update (weren't displaying it)

### Verification:
- Node.js syntax check: PASSED
- All references removed: CONFIRMED

## PHASE 4: TEST RESULTS

### Settings Constants Test
```
PASS test/unit/constants/settings.test.js
  Settings Constants
    settingsSchema
      √ should contain whisper settings (1 ms)
      √ should have correct whisper defaults
      √ should have correct whisper insertMode default
      √ should have correct whisper defaultSource default
      √ should have valid whisper modelSize options (1 ms)
      √ should have valid whisper insertMode options
      √ should have valid whisper defaultSource options (1 ms)
```

### Summary:
- **36 tests passed** (settings constants)
- **0 tests failed** related to this change
- DB tests fail due to unrelated native binding issue (pre-existing)
- Change is safe and complete

## CONCLUSION

Dead setting successfully removed. The `whisper.showConfidence` was:
- Never integrated into the UI
- Never read by any active code
- Never tested
- Safe to delete without side effects

All settings validation tests continue to pass.

