# Security Audit - Technical Summary

## StickyNotes Electron CLI/GUI Refactor

**Date:** 2026-01-10
**Status:** 8 Security Issues Identified (1 Critical, 5 High, 2 Medium)

---

## Quick Reference: Findings by File

### E:\Projects\the_real_stickynotes\electron\main.js

| Line  | Issue                                       | Severity | CVSS |
| ----- | ------------------------------------------- | -------- | ---- |
| 50    | Single-instance lock accepts arbitrary data | HIGH     | 7.4  |
| 66-71 | Second-instance IPC unvalidated             | HIGH     | 6.5  |
| 59-70 | Debug logging leaks sensitive data          | MEDIUM   | 4.7  |

### E:\Projects\the_real_stickynotes\electron\cli\parser.js

| Line   | Issue                           | Severity | CVSS |
| ------ | ------------------------------- | -------- | ---- |
| 68-122 | No whitelist on CLI options     | MEDIUM   | 6.8  |
| All    | Arbitrary option names accepted | MEDIUM   | 6.8  |

### E:\Projects\the_real_stickynotes\electron\cli\commands.js

| Line    | Issue                                   | Severity | CVSS |
| ------- | --------------------------------------- | -------- | ---- |
| 625-709 | No authorization on config/app commands | HIGH     | 8.2  |
| 750-761 | Directory traversal in export path      | HIGH     | 7.2  |
| 808-815 | JSON parsing without validation         | MEDIUM   | 5.3  |

### E:\Projects\the_real_stickynotes\electron\whisper\service.js

| Line    | Issue                                  | Severity | CVSS |
| ------- | -------------------------------------- | -------- | ---- |
| 252-264 | Unsanitized path parameters to spawn() | CRITICAL | 7.8  |

### E:\Projects\the_real_stickynotes\electron\ipc\notes.js

| Line  | Issue                              | Severity | CVSS |
| ----- | ---------------------------------- | -------- | ---- |
| 30-46 | IPC handlers lack input validation | HIGH     | 6.2  |

---

## Attack Scenarios

### Scenario 1: Privilege Escalation via Config Command

```bash
# Attacker with local access
stickynotes config set appearance.theme dark
stickynotes config set general.startMinimized true
stickynotes export --output /tmp/user-notes.json
stickynotes app quit
```

**Impact:** Data exfiltration, app manipulation, DoS

### Scenario 2: Directory Traversal in Export

```bash
# Write to arbitrary location
stickynotes export --output /etc
stickynotes export --output C:\Windows\System32
stickynotes export --output ../../sensitive-location

# On Linux, could potentially overwrite system files
stickynotes export --format md --output /tmp/
```

**Impact:** File system contamination, potential code execution

### Scenario 3: Unsanitized Whisper Paths

```javascript
// If an attacker can control modelPath or audioPath via database
const args = ['-m', '/tmp/../../malicious/model', '-f', audioPath];
spawn(whisperBinaryPath, args);

// Or via language parameter if not properly filtered
const language = 'en\n-x "malicious command"';
```

**Impact:** Code execution if paths not validated

### Scenario 4: IPC Deserialization Attack

```javascript
// Malicious renderer sends prototype pollution
ipcRenderer.invoke('notes:create', {
  title: 'test',
  __proto__: { admin: true },
  constructor: { prototype: { isAdmin: true } },
});
```

**Impact:** Object property manipulation, potential security bypass

---

## Required Fixes (Priority Order)

### P0 - CRITICAL (Deploy block)

1. **Whisper service paths** - Validate all file paths with `path.resolve()` and directory bounds checking
   ```javascript
   // Add this validation
   const validatedPath = path.resolve(userProvidedPath);
   if (!validatedPath.startsWith(allowedDirectory)) {
     throw new Error('Path outside allowed directory');
   }
   ```

### P1 - HIGH (Next release)

2. **CLI options validation** - Implement whitelist of allowed options per command
3. **Config command authorization** - Add permission checks before sensitive operations
4. **IPC input validation** - Add schema validation to all `ipcMain.handle()` calls
5. **Export path restriction** - Validate output directory is within app data folder
6. **Single-instance lock** - Don't pass `cliParsed` through lock mechanism

### P2 - MEDIUM (Future)

7. **Backup JSON validation** - Implement backup schema validation
8. **Debug logging** - Remove console output in production builds

---

## Implementation Guidance

### Add Schema Validation Library

```bash
npm install zod  # or joi, yup
```

### Path Validation Utility

```javascript
// Create shared/utils/path-validator.js
function validateOutputPath(userPath, allowedBase) {
  const resolved = path.resolve(userPath);
  const baseResolved = path.resolve(allowedBase);

  if (!resolved.startsWith(baseResolved + path.sep)) {
    throw new Error('Path outside allowed directory');
  }
  return resolved;
}
```

### Option Whitelisting

```javascript
// Per command, define allowed options
const ALLOWED_OPTIONS = {
  'note:list': ['folder', 'color', 'archived', 'trash', 'json', 'sort'],
  'note:create': ['title', 'content', 'folder', 'color', 'tags', 'open', 'json'],
};

// Validate in parser
if (!ALLOWED_OPTIONS[commandAction].includes(optionKey)) {
  throw new Error(`Unknown option: ${optionKey}`);
}
```

### IPC Input Validation

```javascript
const noteCreateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  folder_id: z.string().optional(),
  color: z.string().optional(),
});

ipcMain.handle('notes:create', (event, data) => {
  const validated = noteCreateSchema.parse(data);
  return createNote(validated);
});
```

---

## Testing Checklist

### Command Injection Tests

- [ ] `stickynotes note create --title "'; delete from notes; //"`
- [ ] `stickynotes export --output "$(whoami)"`
- [ ] `stickynotes search "foo\nbar"` (newline injection)

### Path Traversal Tests

- [ ] `--output ../../../etc`
- [ ] `--output /../../etc/passwd`
- [ ] `--output C:\..\..\Windows`
- [ ] `--output ./../../sensitive`

### Authorization Tests

- [ ] Run `config set` without confirmation
- [ ] Run `export` without user approval
- [ ] Run `app quit` via CLI
- [ ] Modify critical settings via second instance

### IPC Fuzzing Tests

- [ ] Send objects with extra properties
- [ ] Send arrays instead of objects
- [ ] Send null/undefined values
- [ ] Send circular references

---

## Compliance Mapping

| Finding                   | CWE             | OWASP    |
| ------------------------- | --------------- | -------- |
| Path injection in whisper | CWE-426, CWE-78 | A03:2021 |
| Config authorization      | CWE-276         | A04:2021 |
| Directory traversal       | CWE-22          | A03:2021 |
| IPC validation            | CWE-20          | A04:2021 |
| JSON parsing              | CWE-502         | A08:2021 |

---

## Files Modified/Created by Audit

- `/SECURITY_AUDIT_REPORT.md` - Full detailed report
- `/SECURITY_AUDIT_TECHNICAL_SUMMARY.md` - This file
- Recommend: Create `/security/` directory for security utilities
  - `/security/schemas.js` - Zod/Joi schemas
  - `/security/validators.js` - Path/input validators
  - `/security/logger.js` - Secure logging

---

## Next Steps

1. **Immediate (24h):** Create path validation utility and apply to Whisper service
2. **Short-term (1w):** Add schema validation to all IPC handlers and CLI options
3. **Medium-term (2w):** Implement authorization framework and rate limiting
4. **Long-term (1m):** Full security testing and penetration test

---

**Generated:** 2026-01-10
**By:** security-auditor Agent
**Status:** Ready for Remediation
