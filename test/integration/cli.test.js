/**
 * CLI Integration Tests
 * 
 * End-to-end tests that verify actual state changes, not just "doesn't crash"
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

// Path to CLI binary
const CLI_PATH = path.join(__dirname, '../../cli/bin/stickynotes.js');

describe('CLI Integration', () => {
  let testDbPath;
  let testDir;
  let db;

  beforeAll(() => {
    testDir = path.join(os.tmpdir(), 'stickynotes-cli-test-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    testDbPath = path.join(testDir, 'test.db');
    
    // Set environment for tests
    process.env.STICKYNOTES_DB_PATH = testDbPath;
    process.env.STICKYNOTES_TEST = 'true';
  });

  afterAll(() => {
    if (db) {
      try { db.close(); } catch (e) { /* ignore */ }
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.STICKYNOTES_DB_PATH;
    delete process.env.STICKYNOTES_TEST;
  });

  // Helper to run CLI command and get parsed output
  const runCli = (args, options = {}) => {
    const cmd = `node "${CLI_PATH}" ${args}`;
    try {
      const result = execSync(cmd, {
        cwd: testDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          STICKYNOTES_DB_PATH: testDbPath,
        },
        ...options,
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      return { 
        success: false, 
        output: (error.stderr || error.stdout || error.message).trim(), 
        error,
        exitCode: error.status
      };
    }
  };

  // Helper to run CLI and get JSON output
  const runCliJson = (args) => {
    const result = runCli(`${args} --json`);
    if (result.success && result.output) {
      try {
        // Try direct parse first
        result.data = JSON.parse(result.output);
      } catch (e) {
        // Try to extract JSON from output (in case there's other text mixed in)
        try {
          // Find JSON object or array in output
          const jsonMatch = result.output.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
          if (jsonMatch) {
            result.data = JSON.parse(jsonMatch[1]);
          } else {
            result.parseError = e.message;
          }
        } catch (e2) {
          result.parseError = e.message;
        }
      }
    }
    return result;
  };

  // Get direct database connection for verification
  const getDb = () => {
    if (!db || !db.open) {
      db = new Database(testDbPath, { readonly: true });
    }
    return db;
  };

  describe('Help and Version', () => {
    it('should show help with expected commands', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Commands:');
      expect(result.output).toContain('note');
      expect(result.output).toContain('tag');
      expect(result.output).toContain('folder');
      expect(result.output).toContain('search');
    });

    it('should show semantic version', () => {
      const result = runCli('--version');
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Note CRUD Operations', () => {
    let createdNoteId;

    it('should create a note with title and content', () => {
      const result = runCliJson('note create --title "Test Note" --content "This is test content"');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.title).toBe('Test Note');
      expect(result.data.content).toBe('This is test content');
      
      createdNoteId = result.data.id;
      
      // Verify in database
      const dbNote = getDb().prepare('SELECT * FROM notes WHERE id = ?').get(createdNoteId);
      expect(dbNote).toBeDefined();
      expect(dbNote.title).toBe('Test Note');
      expect(dbNote.content).toBe('This is test content');
    });

    it('should show the created note', () => {
      const result = runCliJson(`note show ${createdNoteId}`);
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(createdNoteId);
      expect(result.data.title).toBe('Test Note');
    });

    it('should edit a note title', () => {
      const result = runCliJson(`note edit ${createdNoteId} --title "Updated Title"`);
      
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Updated Title');
      
      // Verify in database
      const dbNote = getDb().prepare('SELECT title FROM notes WHERE id = ?').get(createdNoteId);
      expect(dbNote.title).toBe('Updated Title');
    });

    it('should append content to a note', () => {
      const result = runCliJson(`note edit ${createdNoteId} --append "Appended text"`);
      
      expect(result.success).toBe(true);
      expect(result.data.content).toContain('This is test content');
      expect(result.data.content).toContain('Appended text');
    });

    it('should list notes and include the created note', () => {
      const result = runCliJson('note list');
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      
      const found = result.data.find(n => n.id === createdNoteId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Updated Title');
    });

    it('should soft delete a note (move to trash)', () => {
      const result = runCli(`note delete ${createdNoteId}`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('trash');
      
      // Verify in database - should be marked deleted but still exist
      const dbNote = getDb().prepare('SELECT is_deleted FROM notes WHERE id = ?').get(createdNoteId);
      expect(dbNote.is_deleted).toBe(1);
    });

    it('should not show deleted note in regular list', () => {
      const result = runCliJson('note list');
      
      expect(result.success).toBe(true);
      const found = result.data.find(n => n.id === createdNoteId);
      expect(found).toBeUndefined();
    });

    it('should show deleted note in trash list', () => {
      const result = runCliJson('note list --trash');
      
      expect(result.success).toBe(true);
      const found = result.data.find(n => n.id === createdNoteId);
      expect(found).toBeDefined();
    });

    it('should restore a note from trash', () => {
      const result = runCli(`note restore ${createdNoteId}`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Restored');
      
      // Verify in database
      const dbNote = getDb().prepare('SELECT is_deleted FROM notes WHERE id = ?').get(createdNoteId);
      expect(dbNote.is_deleted).toBe(0);
    });

    it('should permanently delete a note with --force', () => {
      // First soft delete
      runCli(`note delete ${createdNoteId}`);
      
      // Then permanently delete
      const result = runCli(`note delete ${createdNoteId} --force`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Permanently');
      
      // Verify removed from database
      const dbNote = getDb().prepare('SELECT * FROM notes WHERE id = ?').get(createdNoteId);
      expect(dbNote).toBeUndefined();
    });
  });

  describe('Note with Color', () => {
    it('should create a note with specific color', () => {
      const result = runCliJson('note create --title "Blue Note" --color blue');
      
      expect(result.success).toBe(true);
      expect(result.data.color).toBe('blue');
      
      // Cleanup
      runCli(`note delete ${result.data.id} --force`);
    });

    it('should filter notes by color', () => {
      // Create notes with different colors
      const yellow = runCliJson('note create --title "Yellow Note" --color yellow');
      const blue = runCliJson('note create --title "Blue Note" --color blue');
      
      // Filter by blue
      const result = runCliJson('note list --color blue');
      
      expect(result.success).toBe(true);
      expect(result.data.every(n => n.color === 'blue')).toBe(true);
      
      // Cleanup
      runCli(`note delete ${yellow.data.id} --force`);
      runCli(`note delete ${blue.data.id} --force`);
    });
  });

  describe('Note Archive', () => {
    let noteId;

    beforeAll(() => {
      const result = runCliJson('note create --title "Archive Test"');
      noteId = result.data.id;
    });

    afterAll(() => {
      runCli(`note delete ${noteId} --force`);
    });

    it('should archive a note', () => {
      const result = runCli(`note archive ${noteId}`);
      
      expect(result.success).toBe(true);
      
      const dbNote = getDb().prepare('SELECT is_archived FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_archived).toBe(1);
    });

    it('should not show archived note in regular list', () => {
      const result = runCliJson('note list');
      const found = result.data.find(n => n.id === noteId);
      expect(found).toBeUndefined();
    });

    it('should show archived note with --archived flag', () => {
      const result = runCliJson('note list --archived');
      const found = result.data.find(n => n.id === noteId);
      expect(found).toBeDefined();
    });

    it('should unarchive a note', () => {
      const result = runCli(`note unarchive ${noteId}`);
      
      expect(result.success).toBe(true);
      
      const dbNote = getDb().prepare('SELECT is_archived FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_archived).toBe(0);
    });
  });

  describe('Note Pin', () => {
    let noteId;

    beforeAll(() => {
      const result = runCliJson('note create --title "Pin Test"');
      noteId = result.data.id;
    });

    afterAll(() => {
      runCli(`note delete ${noteId} --force`);
    });

    it('should pin a note', () => {
      const result = runCli(`note pin ${noteId}`);
      
      expect(result.success).toBe(true);
      
      const dbNote = getDb().prepare('SELECT is_pinned FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_pinned).toBe(1);
    });

    it('should unpin a note', () => {
      const result = runCli(`note unpin ${noteId}`);
      
      expect(result.success).toBe(true);
      
      const dbNote = getDb().prepare('SELECT is_pinned FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_pinned).toBe(0);
    });
  });

  describe('Note Duplicate', () => {
    it('should duplicate a note', () => {
      const original = runCliJson('note create --title "Original" --content "Original content"');
      const duplicate = runCliJson(`note duplicate ${original.data.id}`);
      
      expect(duplicate.success).toBe(true);
      expect(duplicate.data.id).not.toBe(original.data.id);
      expect(duplicate.data.title).toContain('copy');
      expect(duplicate.data.content).toBe(original.data.content);
      
      // Cleanup
      runCli(`note delete ${original.data.id} --force`);
      runCli(`note delete ${duplicate.data.id} --force`);
    });
  });

  describe('Note Lock/Unlock (Encryption)', () => {
    let noteId;
    const testPassword = 'SecurePass123!';
    const originalContent = 'This is my secret note content';

    beforeAll(() => {
      const result = runCliJson(`note create --title "Lock Test" --content "${originalContent}"`);
      noteId = result.data.id;
    });

    afterAll(() => {
      // Ensure note is unlocked before deletion
      runCli(`note unlock ${noteId} --password "${testPassword}"`);
      runCli(`note delete ${noteId} --force`);
    });

    it('should lock a note with password', () => {
      const result = runCli(`note lock ${noteId} --password "${testPassword}"`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Encrypted');
      expect(result.output).toContain('locked');
      
      // Verify in database that content is encrypted
      const dbNote = getDb().prepare('SELECT content, content_plain, is_locked, password_hash FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_locked).toBe(1);
      expect(dbNote.password_hash).toBeDefined();
      expect(dbNote.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt format
      expect(dbNote.content_plain).toBe('[ENCRYPTED]');
      expect(dbNote.content).not.toBe(originalContent);
      expect(dbNote.content).not.toContain('secret');
    });

    it('should not show decrypted content for locked note', () => {
      const result = runCliJson(`note show ${noteId}`);
      
      expect(result.success).toBe(true);
      expect(result.data.is_locked).toBe(1);
      // Content should be encrypted, not readable
      expect(result.data.content).not.toBe(originalContent);
      expect(result.data.content_plain).toBe('[ENCRYPTED]');
    });

    it('should fail to lock already locked note', () => {
      const result = runCli(`note lock ${noteId} --password "anotherpass"`);
      
      expect(result.success).toBe(false);
      expect(result.output).toContain('already locked');
    });

    it('should fail to unlock with wrong password', () => {
      const result = runCli(`note unlock ${noteId} --password "wrongpassword"`);
      
      expect(result.success).toBe(false);
      expect(result.output).toContain('Incorrect password');
    });

    it('should unlock note with correct password', () => {
      const result = runCli(`note unlock ${noteId} --password "${testPassword}"`);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Decrypted');
      expect(result.output).toContain('unlocked');
      
      // Verify in database that content is decrypted
      const dbNote = getDb().prepare('SELECT content, content_plain, is_locked, password_hash FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_locked).toBe(0);
      expect(dbNote.password_hash).toBeNull();
      expect(dbNote.content).toBe(originalContent);
      expect(dbNote.content_plain).not.toBe('[ENCRYPTED]');
    });

    it('should show decrypted content after unlock', () => {
      const result = runCliJson(`note show ${noteId}`);
      
      expect(result.success).toBe(true);
      expect(result.data.is_locked).toBe(0);
      expect(result.data.content).toBe(originalContent);
    });
  });

  describe('Note Lock with PIN', () => {
    let noteId;
    const pin = '1234';

    beforeAll(() => {
      const result = runCliJson('note create --title "PIN Test" --content "PIN protected content"');
      noteId = result.data.id;
    });

    afterAll(() => {
      runCli(`note unlock ${noteId} --password "${pin}"`);
      runCli(`note delete ${noteId} --force`);
    });

    it('should lock note with 4-digit PIN', () => {
      const result = runCli(`note lock ${noteId} --password "${pin}"`);
      expect(result.success).toBe(true);
      
      const dbNote = getDb().prepare('SELECT is_locked FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_locked).toBe(1);
    });

    it('should unlock note with correct PIN', () => {
      const result = runCli(`note unlock ${noteId} --password "${pin}"`);
      expect(result.success).toBe(true);
      
      const dbNote = getDb().prepare('SELECT is_locked, content FROM notes WHERE id = ?').get(noteId);
      expect(dbNote.is_locked).toBe(0);
      expect(dbNote.content).toBe('PIN protected content');
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent note', () => {
      const result = runCli('note show nonexistent123456789');
      
      expect(result.success).toBe(false);
      expect(result.output).toContain('not found');
    });

    it('should return error for invalid command', () => {
      const result = runCli('invalid-command');
      
      expect(result.success).toBe(false);
    });

    it('should show helpful error for missing required options', () => {
      const result = runCli('note lock somenoteid');
      
      expect(result.success).toBe(false);
      expect(result.output.toLowerCase()).toContain('password');
    });
  });

  describe('JSON Output Schema', () => {
    it('should return valid JSON for note list', () => {
      const result = runCliJson('note list');
      
      expect(result.success).toBe(true);
      expect(result.parseError).toBeUndefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should include expected fields in note object', () => {
      const create = runCliJson('note create --title "Schema Test"');
      const show = runCliJson(`note show ${create.data.id}`);
      
      expect(show.data).toHaveProperty('id');
      expect(show.data).toHaveProperty('title');
      expect(show.data).toHaveProperty('content');
      expect(show.data).toHaveProperty('color');
      expect(show.data).toHaveProperty('created_at');
      expect(show.data).toHaveProperty('updated_at');
      expect(show.data).toHaveProperty('is_pinned');
      expect(show.data).toHaveProperty('is_locked');
      expect(show.data).toHaveProperty('is_archived');
      expect(show.data).toHaveProperty('is_deleted');
      
      // Cleanup
      runCli(`note delete ${create.data.id} --force`);
    });

    it('should return ISO date strings', () => {
      const create = runCliJson('note create --title "Date Test"');
      
      // Check that dates are valid ISO strings
      expect(() => new Date(create.data.created_at)).not.toThrow();
      expect(new Date(create.data.created_at).toISOString()).toBe(create.data.created_at);
      
      // Cleanup
      runCli(`note delete ${create.data.id} --force`);
    });
  });

  describe('Stats Command', () => {
    it('should return database statistics', () => {
      const result = runCliJson('stats');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('notes');
      expect(result.data.notes).toHaveProperty('total');
      expect(result.data.notes).toHaveProperty('active');
      expect(result.data.notes).toHaveProperty('archived');
      expect(result.data.notes).toHaveProperty('trashed');
    });
  });
});

describe('CLI Output Formatting', () => {
  const formatter = require('../../cli/output/formatter');

  describe('formatJson', () => {
    it('should produce valid pretty-printed JSON', () => {
      const data = { id: '123', title: 'Test', nested: { key: 'value' } };
      const output = formatter.formatJson(data);
      
      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).toContain('\n'); // Pretty printed
      expect(JSON.parse(output)).toEqual(data);
    });
  });

  describe('formatOutput', () => {
    it('should return empty string for null/undefined', () => {
      expect(formatter.formatOutput(null, 'text')).toBe('');
      expect(formatter.formatOutput(undefined, 'text')).toBe('');
    });

    it('should format objects as key-value pairs', () => {
      const output = formatter.formatOutput({ name: 'test', value: 42 }, 'text');
      expect(output).toContain('name: test');
      expect(output).toContain('value: 42');
    });

    it('should format arrays by joining elements', () => {
      const output = formatter.formatOutput(['a', 'b', 'c'], 'text');
      expect(output).toContain('a');
      expect(output).toContain('b');
      expect(output).toContain('c');
    });
  });

  describe('formatNoteList', () => {
    it('should return message for empty list', () => {
      const output = formatter.formatNoteList([]);
      expect(output).toContain('No notes found');
    });

    it('should include note IDs and titles', () => {
      const notes = [
        { id: 'abc123', title: 'Test Note', updated_at: new Date().toISOString() },
      ];
      const output = formatter.formatNoteList(notes);
      expect(output).toContain('abc123');
      expect(output).toContain('Test Note');
    });

    it('should show indicators for pinned/locked notes', () => {
      const notes = [
        { id: 'pinned1', title: 'Pinned', is_pinned: 1, updated_at: new Date().toISOString() },
        { id: 'locked1', title: 'Locked', is_locked: 1, updated_at: new Date().toISOString() },
      ];
      const output = formatter.formatNoteList(notes);
      expect(output).toContain('[P]');
      expect(output).toContain('[L]');
    });
  });

  describe('formatDate', () => {
    it('should return "-" for null/undefined', () => {
      expect(formatter.formatDate(null)).toBe('-');
      expect(formatter.formatDate(undefined)).toBe('-');
    });

    it('should return "Just now" for recent dates', () => {
      const now = new Date().toISOString();
      expect(formatter.formatDate(now)).toBe('Just now');
    });

    it('should return "Invalid Date" for invalid input', () => {
      expect(formatter.formatDate('not-a-date')).toBe('Invalid Date');
    });

    it('should format relative times correctly', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      
      expect(formatter.formatDate(fiveMinAgo)).toBe('5m ago');
      expect(formatter.formatDate(twoHoursAgo)).toBe('2h ago');
      expect(formatter.formatDate(threeDaysAgo)).toBe('3d ago');
    });
  });

  describe('formatError', () => {
    it('should format string errors', () => {
      const output = formatter.formatError('Something went wrong');
      expect(output).toContain('Error');
      expect(output).toContain('Something went wrong');
    });

    it('should format Error objects', () => {
      const output = formatter.formatError(new Error('Test error'));
      expect(output).toContain('Test error');
    });
  });

  describe('formatSuccess', () => {
    it('should format success messages with checkmark', () => {
      const output = formatter.formatSuccess('Operation completed');
      expect(output).toContain('[OK]');
      expect(output).toContain('Operation completed');
    });
  });
});
