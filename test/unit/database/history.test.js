/**
 * History Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('History Database Operations', () => {
  let db;
  let testDbPath;
  let noteId;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `history-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    
    // Create a note
    const now = new Date().toISOString();
    noteId = 'note-history-' + Date.now();
    db.prepare('INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(noteId, 'History Note', 'Initial content', now, now);
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  describe('createHistoryEntry', () => {
    it('should create a history entry', () => {
      const now = new Date().toISOString();
      
      const result = db.prepare(`
        INSERT INTO note_history (note_id, title, content, saved_at)
        VALUES (?, ?, ?, ?)
      `).run(noteId, 'History Note', 'Initial content', now);
      
      expect(result.lastInsertRowid).toBeGreaterThan(0);
      
      const entry = db.prepare('SELECT * FROM note_history WHERE id = ?').get(result.lastInsertRowid);
      expect(entry.title).toBe('History Note');
      expect(entry.content).toBe('Initial content');
    });

    it('should track content changes', () => {
      const timestamp1 = new Date(Date.now() - 3600000).toISOString();
      const timestamp2 = new Date().toISOString();
      
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Content v1', timestamp1);
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Content v2', timestamp2);
      
      const history = db.prepare('SELECT * FROM note_history WHERE note_id = ? ORDER BY saved_at DESC').all(noteId);
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Content v2');
      expect(history[1].content).toBe('Content v1');
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      const base = Date.now();
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Version 1', new Date(base - 3600000).toISOString());
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Version 2', new Date(base - 1800000).toISOString());
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Version 3', new Date(base).toISOString());
    });

    it('should get all history for note', () => {
      const history = db.prepare('SELECT * FROM note_history WHERE note_id = ?').all(noteId);
      expect(history).toHaveLength(3);
    });

    it('should get history ordered by date descending', () => {
      const history = db.prepare('SELECT * FROM note_history WHERE note_id = ? ORDER BY saved_at DESC').all(noteId);
      expect(history[0].content).toBe('Version 3');
      expect(history[2].content).toBe('Version 1');
    });

    it('should limit history entries', () => {
      const history = db.prepare('SELECT * FROM note_history WHERE note_id = ? ORDER BY saved_at DESC LIMIT 2').all(noteId);
      expect(history).toHaveLength(2);
    });

    it('should get specific history entry', () => {
      const allHistory = db.prepare('SELECT * FROM note_history WHERE note_id = ?').all(noteId);
      const entryId = allHistory[0].id;
      
      const entry = db.prepare('SELECT * FROM note_history WHERE id = ?').get(entryId);
      expect(entry).toBeDefined();
    });
  });

  describe('deleteHistory', () => {
    it('should delete specific history entry', () => {
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Delete Me', now);
      
      db.prepare('DELETE FROM note_history WHERE id = ?').run(result.lastInsertRowid);
      
      const entry = db.prepare('SELECT * FROM note_history WHERE id = ?').get(result.lastInsertRowid);
      expect(entry).toBeUndefined();
    });

    it('should cascade delete when note is deleted', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Title', 'Will be deleted', now);
      
      const before = db.prepare('SELECT COUNT(*) as count FROM note_history WHERE note_id = ?').get(noteId);
      expect(before.count).toBeGreaterThan(0);
      
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
      
      const after = db.prepare('SELECT COUNT(*) as count FROM note_history WHERE note_id = ?').get(noteId);
      expect(after.count).toBe(0);
    });

    it('should delete old history entries', () => {
      const base = Date.now();
      
      // Insert 5 entries
      for (let i = 0; i < 5; i++) {
        db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
          .run(noteId, 'Title', `Version ${i}`, new Date(base - i * 1000).toISOString());
      }
      
      // Keep only the 3 most recent
      db.prepare(`
        DELETE FROM note_history 
        WHERE note_id = ? AND id NOT IN (
          SELECT id FROM note_history WHERE note_id = ? ORDER BY saved_at DESC LIMIT 3
        )
      `).run(noteId, noteId);
      
      const remaining = db.prepare('SELECT * FROM note_history WHERE note_id = ?').all(noteId);
      expect(remaining).toHaveLength(3);
    });
  });

  describe('Restore from history', () => {
    it('should restore note content from history', () => {
      const now = new Date().toISOString();
      
      // Create history entry
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Old Title', 'Old Content', now);
      
      // Update note
      db.prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?')
        .run('New Title', 'New Content', noteId);
      
      // Get history entry
      const historyEntry = db.prepare('SELECT * FROM note_history WHERE note_id = ? ORDER BY saved_at DESC LIMIT 1')
        .get(noteId);
      
      // Restore from history
      db.prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?')
        .run(historyEntry.title, historyEntry.content, noteId);
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.title).toBe('Old Title');
      expect(note.content).toBe('Old Content');
    });
  });
});
