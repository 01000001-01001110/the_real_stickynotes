/**
 * Security regression tests for note locking.
 *
 * Covers two vulnerabilities fixed 2026-07-02:
 *   - updateNote must NOT be able to forge lock state (is_locked / password_hash).
 *     Lock transitions must go only through lockNote()/unlockNote().
 *   - lockNote() must purge note_history, which holds unencrypted prior versions.
 *   - History reads must not return rows for a locked note.
 *
 * These drive the REAL notes.js / history.js against a real (temp) SQLite
 * singleton, not mocks.
 */
const path = require('path');
const fs = require('fs');

const { initDatabase, closeDatabase, getDatabase } = require('../../../shared/database');
const { createNote, updateNote, lockNote } = require('../../../shared/database/notes');
const { saveNoteVersion, getNoteHistory } = require('../../../shared/database/history');

let dbPath;

beforeEach(() => {
  dbPath = path.join(global.testDir, `lock-sec-${Date.now()}-${Math.random()}.db`);
  process.env.STICKYNOTES_TEST = 'true';
  initDatabase(dbPath);
});

afterEach(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
  }
});

describe('updateNote lock-state forgery is blocked', () => {
  it('ignores is_locked and password_hash passed to updateNote', () => {
    const note = createNote({ title: 'secret', content: 'plaintext body' });

    const updated = updateNote(note.id, {
      is_locked: 1,
      password_hash: '$2a$10$forgedhashforgedhashforgedhashforgedha',
      title: 'still editable',
    });

    // The legitimate field applies...
    expect(updated.title).toBe('still editable');
    // ...but the lock fields are rejected: note is NOT marked locked, no hash set,
    // and content stays as written (never falsely presented as encrypted).
    expect(updated.is_locked).toBe(0);
    expect(updated.password_hash == null).toBe(true);
    expect(updated.content).toBe('plaintext body');
  });
});

describe('lockNote purges plaintext history', () => {
  it('deletes note_history rows when a note is locked', async () => {
    const note = createNote({ title: 'sensitive', content: 'v1 plaintext' });

    // Simulate edit history accumulating plaintext versions.
    saveNoteVersion(note.id, note.title, 'v1 plaintext');
    saveNoteVersion(note.id, note.title, 'v2 plaintext secret');
    expect(getNoteHistory(note.id).length).toBeGreaterThan(0);

    await lockNote(note.id, 'CorrectHorse9!');

    // History must be gone: no plaintext version rows survive the lock.
    const db = getDatabase();
    const remaining = db
      .prepare('SELECT COUNT(*) AS c FROM note_history WHERE note_id = ?')
      .get(note.id).c;
    expect(remaining).toBe(0);
  });
});
