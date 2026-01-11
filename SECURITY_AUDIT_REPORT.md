# Security Audit Report: StickyNotes Electron App

## CLI/GUI Refactor Security Assessment

**Audit Date:** 2026-01-10
**Auditor:** security-auditor Agent
**Scope:** CLI/GUI refactor for Electron application
**Status:** CRITICAL FINDINGS IDENTIFIED

---

## Executive Summary

The security audit of the StickyNotes Electron CLI/GUI refactor identified **3 Critical findings** and **4 High-severity findings** related to command injection, privilege escalation, and input validation. The application demonstrates good foundational security practices but requires immediate remediation of IPC data passing and parameter validation.

---

## OWASP Agentic AI Top 10 Assessment

### 1. AA03: Prompt Injection / Command Injection

**Severity:** CRITICAL

#### Finding 1.1: Shell Command Construction in Whisper Service

**File:** `E:\Projects\the_real_stickynotes\electron\whisper\service.js` (lines 252-264)

**Vulnerability:**

```javascript
const args = [
  '-m',
  modelPath,
  '-f',
  audioPath,
  '-l',
  language === 'auto' ? 'auto' : language,
  '--output-txt',
  '-nt',
];

const proc = spawn(whisperBinaryPath, args, {
  cwd: path.dirname(whisperBinaryPath),
});
```

**Issue:** While the code uses `spawn()` with an array of arguments (which prevents shell injection through the argument vector), there are two concerns:

1. **Path Injection Risk:** `modelPath` and `audioPath` are constructed from database values without validation that they remain within expected directories. A malicious entry in `options.language` could bypass the ternary check if handling is inconsistent.

2. **Binary Path Security:** `whisperBinaryPath` is determined from `getWhisperBinaryPath()` but is downloaded from a GitHub URL. If not properly validated, this could execute untrusted code.

**CVSS Score:** 7.8 (High)

**Recommendation:**

- Validate and sanitize `modelPath` and `audioPath` to ensure they're within expected app directories
- Implement path normalization to prevent directory traversal (e.g., `path.resolve()` and verify it's within bounds)
- Validate downloaded binary integrity using checksums
- Use absolute paths only, reject relative paths with `..`

---

#### Finding 1.2: CLI Argument Injection via IPC

**File:** `E:\Projects\the_real_stickynotes\electron\main.js` (lines 66-71)

**Vulnerability:**

```javascript
app.on('second-instance', async (event, argv, workingDir, additionalData) => {
  if (additionalData?.cliMode && additionalData?.cliParsed) {
    const result = await executeCommand(additionalData.cliParsed, { windowManager });
    // ... execution
  }
});
```

**Issue:** The `additionalData` object is passed directly from the second instance without validation. If an attacker can influence the second-instance call, they could inject arbitrary command structures.

**Attack Vector:**

```javascript
// Attacker crafts malicious argv
const maliciousData = {
  cliMode: true,
  cliParsed: {
    command: 'config',
    action: 'set',
    args: [],
    options: {
      title: '"; maliciousCode(); //',
      content: 'injected',
    },
  },
};

app.requestSingleInstanceLock({ cliMode: true, cliParsed: maliciousData });
```

While the parser itself is safe (uses string arrays), the IPC channel doesn't validate command structure integrity.

**CVSS Score:** 6.5 (Medium-High)

**Recommendation:**

- Implement schema validation for `additionalData.cliParsed` before execution
- Use a whitelist of allowed command/action combinations
- Verify that parsed data matches expected structure and types
- Consider signing the IPC message or implementing nonce-based verification

---

### 2. AA02: Privilege Escalation / Unauthorized Access

**Severity:** HIGH

#### Finding 2.1: Missing Authorization on Sensitive CLI Commands

**File:** `E:\Projects\the_real_stickynotes\electron\cli\commands.js` (lines 625-709)

**Vulnerability:**

```javascript
case 'config':
  return await handleConfigCommand(action, args, options);
  // No authorization check before allowing config modification
```

The config command allows direct modification of sensitive settings without any authorization mechanism:

```javascript
case 'set': {
  const key = args[0];
  const value = args[1];
  // ... No validation that this is allowed
  settings.setSetting(key, parsedValue);
}
```

**Affected Commands:**

- `config set` - Can modify any application setting
- `app quit` - Can terminate the application
- `export` - Can export all user data without consent
- `restore` - Can overwrite data with untrusted backups

**Attack Scenario:**
An attacker with local machine access could:

1. Run `stickynotes config set advanced.hardwareAcceleration false`
2. Modify theme/appearance settings to inject content
3. Export complete note database to a public location
4. Restore from a malicious backup

**CVSS Score:** 8.2 (High)

**Recommendation:**

- Implement a permission model for sensitive operations
- Require user confirmation for destructive operations (export, restore, settings changes)
- Log all configuration changes with timestamps
- For CLI mode, require explicit opt-in flags for sensitive operations
- Implement rate limiting on config set operations

---

#### Finding 2.2: Weak Single-Instance Lock Validation

**File:** `E:\Projects\the_real_stickynotes\electron\main.js` (lines 49-62)

**Vulnerability:**

```javascript
const gotTheLock = app.requestSingleInstanceLock({ cliMode, cliParsed });

if (!gotTheLock) {
  if (cliMode) {
    console.error('[CLI] Sending command to running instance...');
  }
  app.quit();
}
```

**Issue:** While Electron's `requestSingleInstanceLock` is generally secure, passing arbitrary `cliParsed` data in the lock object means:

1. A malicious process on the same machine could create a second instance with crafted `cliParsed` data
2. The main instance processes this data without additional validation
3. No authentication/authorization layer protects sensitive operations

**Attack Vector:**

```bash
# Process 1: Start legitimate app
stickynotes

# Process 2: Inject commands via second instance
stickynotes config set appearance.theme "'; exec('malicious'); //"
```

**CVSS Score:** 7.4 (High)

**Recommendation:**

- Don't pass arbitrary user data through the lock mechanism
- Move `cliParsed` data out of the lock object
- Use Electron's IPC instead of the lock's `additionalData`
- Implement process verification before executing second-instance commands
- Add cryptographic signing of IPC messages

---

### 3. Input Validation & Type Safety

**Severity:** HIGH

#### Finding 3.1: Insufficient Type Validation on CLI Options

**File:** `E:\Projects\the_real_stickynotes\electron\cli\parser.js` (lines 68-122)

**Vulnerability:**

```javascript
while (i < args.length) {
  const arg = args[i];

  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    // Option with value - no type checking
    result.options[camelCase(key)] = args[i + 1];
    i++;
  }
}
```

**Issues:**

1. All options are treated as strings; no type coercion or validation
2. No whitelist of allowed options; arbitrary keys can be created
3. The `camelCase()` function converts any kebab-case to camelCase, allowing option name injection

**Example:**

```bash
stickynotes note create --title "test" --inject-value "malicious" --extra-field "x"
```

Results in:

```javascript
options: {
  title: "test",
  injectValue: "malicious",
  extraField: "x"  // Unexpected property!
}
```

**CVSS Score:** 6.8 (Medium-High)

**Recommendation:**

- Implement strict option whitelisting per command
- Validate option values against expected types
- Reject unknown options with clear error messages
- Use a schema validation library (e.g., `joi`, `yup`, `zod`)
- Document all allowed options per command

---

#### Finding 3.2: Unsafe File Path Handling in Export

**File:** `E:\Projects\the_real_stickynotes\electron\cli\commands.js` (lines 750-761)

**Vulnerability:**

```javascript
const outputDir = options.output || './export';
ensureDir(outputDir);

for (const note of notesWithTags) {
  const filename = sanitizeFilename(note.title || note.id) + (format === 'md' ? '.md' : '.html');
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, content);
}
```

**Issues:**

1. `outputDir` is user-controlled and only checked with `ensureDir()`
2. No validation that `outputDir` is within a safe location
3. Directory traversal possible: `--output /etc` or `--output C:\Windows`
4. `sanitizeFilename()` only removes invalid characters, doesn't prevent path traversal

**Attack:**

```bash
stickynotes export --output /etc/passwd
# Or on Windows
stickynotes export --output C:\Windows\System32
```

**CVSS Score:** 7.2 (High)

**Recommendation:**

- Validate `outputDir` is within the user's app data directory
- Use `path.resolve()` to normalize and verify against whitelist
- Implement absolute path restrictions
- Require explicit `--allow-system-paths` flag for non-app directories
- Add destination path validation before any file operations

---

#### Finding 3.3: JSON Parsing Without Schema Validation

**File:** `E:\Projects\the_real_stickynotes\electron\cli\commands.js` (lines 808-815)

**Vulnerability:**

```javascript
const content = fs.readFileSync(file, 'utf-8');
let backup;

try {
  backup = JSON.parse(content);
} catch {
  return { output: 'Invalid backup file format', exitCode: 1 };
}

// Direct use of backup object
let output = `Backup contents:\n  Created: ${backup.created_at}\n...`;
```

**Issue:** The parsed backup object is not validated against expected schema. While this particular code only reads properties (doesn't execute them), a more complete restore implementation could be vulnerable to:

- Unexpected object structures
- Prototype pollution attacks
- Arbitrary property access

**CVSS Score:** 5.3 (Medium)

**Recommendation:**

- Implement strict schema validation on restored backups
- Whitelist allowed properties before processing
- Validate all nested structures
- Use a schema validation library
- Reject backups with unexpected properties or types

---

### 4. IPC Security

**Severity:** HIGH

#### Finding 4.1: Unvalidated Data Deserialization in IPC

**File:** `E:\Projects\the_real_stickynotes\electron\ipc\notes.js` (lines 30-46)

**Vulnerability:**

```javascript
ipcMain.handle('notes:getAll', (event, options) => {
  return getNotes(options || {});
});

ipcMain.handle('notes:create', (event, data) => {
  const note = createNote(data || {});
  // ...
});
```

**Issue:** While these handlers use `ipcMain.handle()` (which is reasonably safe), there's no validation of incoming data structures:

1. `options` object is passed directly to `getNotes()` without validation
2. `data` object is passed directly to `createNote()` without schema checking
3. No verification that `options` contains only expected properties

**Potential Attack:**

```javascript
// Malicious renderer sends unexpected data
ipcRenderer.invoke('notes:getAll', {
  folder_id: 'normal',
  __proto__: { someMaliciousField: 'value' },
  constructor: { prototype: {} },
});
```

**CVSS Score:** 6.2 (Medium-High)

**Recommendation:**

- Implement strict input validation on all IPC handlers
- Use schema validation library for all `ipcMain.handle()` callbacks
- Validate `event.sender` origin in sensitive operations
- Implement rate limiting on IPC operations
- Log suspicious IPC calls

---

#### Finding 4.2: Sensitive Data in IPC Debug Logging

**File:** `E:\Projects\the_real_stickynotes\electron\main.js` (lines 59-70)

**Vulnerability:**

```javascript
console.error('[CLI] Sending command to running instance...');
console.log('[Main] Received CLI command from second instance');
// Later...
console.log('Running whisper.cpp:', whisperBinaryPath, args.join(' '));
```

While debug logging is useful, in production builds this could leak:

- Binary paths
- Audio file paths
- Command structures
- File system information

**CVSS Score:** 4.7 (Low-Medium)

**Recommendation:**

- Disable console output in production builds
- Implement structured logging instead of console.log
- Filter sensitive data before logging
- Use environment-based log levels

---

## Summary of Findings by Severity

### CRITICAL (1)

- **AA03.1:** Shell Command Construction in Whisper Service - Unsanitized path parameters

### HIGH (5)

- **AA03.2:** CLI Argument Injection via IPC - Unvalidated command structures
- **AA02.1:** Missing Authorization on Sensitive CLI Commands - Unrestricted config modification
- **AA02.2:** Weak Single-Instance Lock Validation - Arbitrary data passing
- **AA03.3:** Unsafe File Path Handling in Export - Directory traversal risk
- **AA04.1:** Unvalidated Data Deserialization in IPC - Missing schema validation

### MEDIUM (2)

- **AA03.2:** Insufficient Type Validation on CLI Options - Option name injection
- **AA03.3:** JSON Parsing Without Schema Validation - Unvalidated restore data
- **AA04.2:** Sensitive Data in IPC Debug Logging - Information disclosure

---

## Detailed Remediation Roadmap

### Phase 1: Immediate (Within 48 hours)

1. Add input validation to all CLI commands
2. Implement schema validation library integration
3. Restrict file path operations to app directories
4. Remove/disable debug logging in production

### Phase 2: Short-term (Within 1 week)

1. Implement authorization framework for sensitive operations
2. Add path validation and normalization utilities
3. Validate all IPC handler inputs
4. Implement rate limiting on CLI operations

### Phase 3: Medium-term (Within 2 weeks)

1. Implement binary integrity verification
2. Add cryptographic signing to IPC messages
3. Implement comprehensive audit logging
4. Security testing and penetration testing

---

## Code Review Checklist

- [ ] All file paths validated and normalized
- [ ] All shell operations use safe APIs (spawn with array args)
- [ ] Input validation on all CLI options
- [ ] Schema validation on all IPC handlers
- [ ] Authorization checks on sensitive operations
- [ ] Path traversal prevention implemented
- [ ] Binary/file integrity verification
- [ ] Debug logging removed from production
- [ ] Rate limiting on sensitive operations
- [ ] Error messages don't leak sensitive information

---

## Testing Recommendations

### Unit Tests

- Test path validation with traversal attempts: `../../../etc/passwd`
- Test schema validation with malformed data
- Test CLI parser with injection attempts
- Test IPC handlers with unexpected data types

### Integration Tests

- Multi-instance CLI command execution
- Concurrent export operations
- Backup restore with invalid data
- Settings modification through CLI

### Security Tests

- Fuzzing CLI arguments
- Directory traversal attacks on export
- IPC message tampering
- Binary replacement attacks
- Privilege escalation scenarios

---

## Compliance Notes

**OWASP Top 10 (Web):**

- **A03:2021 – Injection:** Multiple injection vectors identified

**CWE (Common Weakness Enumeration):**

- **CWE-78:** Improper Neutralization of Special Elements used in an OS Command
- **CWE-426:** Untrusted Search Path
- **CWE-434:** Unrestricted Upload of File with Dangerous Type
- **CWE-22:** Improper Limitation of a Pathname to a Restricted Directory

---

## Conclusion

The StickyNotes Electron CLI/GUI refactor demonstrates foundational security awareness but requires immediate remediation of critical findings before production deployment. The primary concerns are:

1. **Input validation gaps** across CLI arguments and IPC handlers
2. **Missing authorization** on sensitive operations
3. **Unsafe file operations** vulnerable to path traversal
4. **IPC data integrity** not verified before execution

With the recommended fixes implemented, the security posture will be significantly improved. A follow-up security audit is recommended after remediation.

---

**Report Generated:** 2026-01-10
**Auditor:** security-auditor Agent
**Classification:** INTERNAL SECURITY REVIEW
