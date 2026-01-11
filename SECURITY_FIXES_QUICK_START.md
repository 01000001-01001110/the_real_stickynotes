# Security Fixes - Quick Start Guide

## Priority Actions for StickyNotes Electron Refactor

---

## Critical Issue (P0): Whisper Path Validation

**File:** `electron/whisper/service.js` line 247-298

**Current Code Problem:**

```javascript
async function transcribeNative(audioPath, options = {}) {
  const args = [
    '-m',
    modelPath, // NO VALIDATION
    '-f',
    audioPath, // NO VALIDATION
    // ...
  ];
  const proc = spawn(whisperBinaryPath, args, {
    cwd: path.dirname(whisperBinaryPath),
  });
}
```

**Fix Needed:**

```javascript
const path = require('path');

function validatePath(filePath, allowedDirectory) {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDirectory);

  // Ensure path is within allowed directory
  if (!resolved.startsWith(allowed + path.sep) && resolved !== allowed) {
    throw new Error(`Path must be within ${allowed}`);
  }

  // Check file exists
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  return resolved;
}

async function transcribeNative(audioPath, options = {}) {
  const { getModelsPath } = require('../../shared/utils/paths');

  // Validate paths
  const validatedModelPath = validatePath(modelPath, getModelsPath());
  const validatedAudioPath = validatePath(
    audioPath,
    os.tmpdir() // Or appropriate audio directory
  );

  const args = [
    '-m',
    validatedModelPath,
    '-f',
    validatedAudioPath,
    // ...
  ];
  // ... rest of function
}
```

---

## High Issues (P1): Quick Fixes

### Issue 1: CLI Options Whitelist

**File:** `electron/cli/parser.js`

**Current Problem:** Any option name is accepted

**Quick Fix:**

```javascript
const ALLOWED_OPTIONS = {
  json: true,
  help: true,
  force: true,
  archived: true,
  trash: true,
  // ... list all valid options
};

// In parseArgs function, before: result.options[camelCase(key)] = args[i + 1];
if (!ALLOWED_OPTIONS[key]) {
  console.warn(`Warning: Unknown option --${key}, ignoring`);
  i++;
  continue;
}
```

---

### Issue 2: Export Path Validation

**File:** `electron/cli/commands.js` line 750

**Current Problem:**

```javascript
const outputDir = options.output || './export';
ensureDir(outputDir); // No path validation!
```

**Fix:**

```javascript
const { getAppDataPath } = require('../../shared/utils/paths');

function validateExportPath(userPath) {
  if (!userPath) {
    return path.join(getAppDataPath(), 'export');
  }

  const resolved = path.resolve(userPath);
  const appData = path.resolve(getAppDataPath());

  // Check if path is within app data directory
  if (!resolved.startsWith(appData + path.sep)) {
    throw new Error(`Export must be within app data directory. Use path within: ${appData}`);
  }

  return resolved;
}

async function handleExportCommand(options) {
  const outputDir = validateExportPath(options.output);
  ensureDir(outputDir);
  // ... rest of function
}
```

---

### Issue 3: Config Command Authorization

**File:** `electron/cli/commands.js` line 669

**Current Problem:**

```javascript
case 'set': {
  const key = args[0];
  const value = args[1];
  settings.setSetting(key, parsedValue);  // No permission check!
}
```

**Quick Fix for CLI:**

```javascript
const SENSITIVE_SETTINGS = [
  'appearance.theme',
  'general.startMinimized',
  'advanced.hardwareAcceleration',
];

case 'set': {
  const key = args[0];
  const value = args[1];

  // Block sensitive settings in CLI mode
  if (SENSITIVE_SETTINGS.includes(key)) {
    return {
      output: `Error: Cannot modify ${key} via CLI. Use GUI instead.`,
      exitCode: 1
    };
  }

  settings.setSetting(key, parsedValue);
  return { output: `Set ${key} = ${parsedValue}`, exitCode: 0 };
}
```

---

### Issue 4: IPC Handler Validation

**File:** `electron/ipc/notes.js` line 30

**Current Problem:**

```javascript
ipcMain.handle('notes:getAll', (event, options) => {
  return getNotes(options || {}); // No validation!
});
```

**Quick Fix (Install zod first):**

```bash
npm install zod
```

```javascript
const { z } = require('zod');

const notesQuerySchema = z
  .object({
    folder_id: z.string().optional(),
    color: z.string().optional(),
    archivedOnly: z.boolean().optional(),
    trashedOnly: z.boolean().optional(),
    sort: z.string().optional(),
    limit: z.number().optional(),
  })
  .strict(); // Reject unknown properties

ipcMain.handle('notes:getAll', (event, options) => {
  try {
    const validated = notesQuerySchema.parse(options || {});
    return getNotes(validated);
  } catch (error) {
    console.error('Invalid notes query:', error.message);
    throw new Error('Invalid query parameters');
  }
});
```

---

### Issue 5: Single-Instance Lock

**File:** `electron/main.js` line 50

**Current Problem:**

```javascript
const gotTheLock = app.requestSingleInstanceLock({ cliMode, cliParsed });
```

**Quick Fix:**

```javascript
// Remove cliParsed from lock - it's passed back to second-instance handler
const gotTheLock = app.requestSingleInstanceLock();

// Store parsed args temporarily
let pendingCliCommand = null;

if (cliMode) {
  cliParsed = parseArgs(process.argv);
  pendingCliCommand = cliParsed;
}

// In second-instance handler:
app.on('second-instance', async (event, argv, workingDir) => {
  // Parse args here, don't trust passed data
  const parsed = parseArgs(argv);

  if (parsed.command && !['--help', '--version'].includes(parsed.command)) {
    const result = await executeCommand(parsed, { windowManager });
    // ...
  }
});
```

---

### Issue 6: Backup JSON Validation

**File:** `electron/cli/commands.js` line 808

**Current Problem:**

```javascript
const backup = JSON.parse(content);
// Direct use without validation
```

**Quick Fix:**

```javascript
const backupSchema = z
  .object({
    version: z.string(),
    created_at: z.string(),
    notes: z
      .array(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .optional(),
    folders: z.array(z.any()).optional(),
    tags: z.array(z.any()).optional(),
    settings: z.record(z.any()).optional(),
  })
  .strict();

try {
  const backup = JSON.parse(content);
  const validated = backupSchema.parse(backup);
  // Now safe to use validated
} catch (error) {
  return { output: `Invalid backup: ${error.message}`, exitCode: 1 };
}
```

---

## Debugging Commands

### Test Whisper Path Validation

```bash
# This should fail with path validation error
AUDIO_PATH="../../../../etc/passwd" stickynotes whisper transcribe test.wav
```

### Test Export Path Validation

```bash
# This should fail with directory restriction error
stickynotes export --output /etc

# This should also fail
stickynotes export --output C:\Windows\System32
```

### Test CLI Option Validation

```bash
# This should warn about unknown option
stickynotes note list --unknown-option "value"
```

### Test IPC Validation

```bash
# In DevTools console on renderer process:
ipcRenderer.invoke('notes:getAll', {
  folder_id: 'normal',
  __proto__: { malicious: true },  // Should be rejected
  constructor: {}  // Should be rejected
});
```

---

## Implementation Checklist

- [ ] Install validation library: `npm install zod`
- [ ] Add path validator utility
- [ ] Fix Whisper path validation (CRITICAL)
- [ ] Add option whitelist to parser
- [ ] Validate export path destination
- [ ] Add authorization to config commands
- [ ] Add schema validation to IPC handlers
- [ ] Remove cliParsed from lock object
- [ ] Test all fixes with provided debugging commands
- [ ] Run full test suite
- [ ] Manual security testing with attack scenarios

---

## Where to Add Code

### New Files to Create

```
shared/
  utils/
    path-validator.js     # New file for path validation
  security/
    schemas.js            # All Zod schemas
    validators.js         # Validation utilities
    logger.js             # Secure logging
```

### Files to Modify

1. `electron/whisper/service.js` - Path validation
2. `electron/cli/parser.js` - Option whitelist
3. `electron/cli/commands.js` - Path validation, authorization
4. `electron/ipc/notes.js` - Schema validation
5. `electron/main.js` - Remove cliParsed from lock

---

## Testing the Fixes

### Run with validation enabled:

```bash
NODE_ENV=development stickynotes --help
NODE_ENV=development stickynotes note list
NODE_ENV=development stickynotes export --output ./safe-location
```

### Run security tests:

```bash
npm run security-test  # Should create this script
npm run test:injection  # Test injection attempts
npm run test:traversal  # Test path traversal attempts
```

---

## Support & Questions

If unclear on any fix:

1. Refer to full `SECURITY_AUDIT_REPORT.md` for context
2. Check `SECURITY_AUDIT_TECHNICAL_SUMMARY.md` for implementation examples
3. Review attack scenarios section for test cases

---

**Last Updated:** 2026-01-10
**Status:** Ready for Implementation
**Estimated Time:** 4-6 hours for all P0 + P1 fixes
