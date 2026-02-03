/**
 * Notes Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Mock the database module
let db;
let testDbPath;

// Import after mocking
const { runMigrations } = require('../../../shared/database/migrations');

describe('Notes Database Operations', () => {
  beforeEach(() => {
    // Create test database
    testDbPath = path.join(global.testDir, `notes-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    
    // Run migrations
    runMigrations(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Clean up WAL files
    if (fs.existsSync(testDbPath + '-wal')) {
      fs.unlinkSync(testDbPath + '-wal');
    }
    if (fs.existsSync(testDbPath + '-shm')) {
      fs.unlinkSync(testDbPath + '-shm');
    }
  });

  describe('createNote', () => {
    it('should create a note with minimal data', () => {
      const id = 'test-note-' + Date.now();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO notes (id, title, content, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, '', '', 'yellow', now, now);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
      expect(note).toBeDefined();
      expect(note.id).toBe(id);
      expect(note.color).toBe('yellow');
    });

    it('should create a note with all fields', () => {
      const id = 'test-note-full-' + Date.now();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO notes (
          id, title, content, content_plain, color,
          position_x, position_y, width, height,
          is_open, is_pinned, is_locked, is_archived, is_deleted,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, 'Test Title', '<b>Content</b>', 'Content', 'blue',
        100, 200, 350, 400,
        1, 1, 0, 0, 0,
        now, now
      );

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
      expect(note.title).toBe('Test Title');
      expect(note.content).toBe('<b>Content</b>');
      expect(note.content_plain).toBe('Content');
      expect(note.color).toBe('blue');
      expect(note.position_x).toBe(100);
      expect(note.position_y).toBe(200);
      expect(note.width).toBe(350);
      expect(note.height).toBe(400);
      expect(note.is_open).toBe(1);
      expect(note.is_pinned).toBe(1);
    });

    it('should use default values', () => {
      const id = 'test-default-' + Date.now();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO notes (id, created_at, updated_at)
        VALUES (?, ?, ?)
      `).run(id, now, now);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
      expect(note.color).toBe('yellow');
      expect(note.width).toBe(300);
      expect(note.height).toBe(350);
      expect(note.is_open).toBe(0);
      expect(note.is_pinned).toBe(0);
      expect(note.is_locked).toBe(0);
      expect(note.is_archived).toBe(0);
      expect(note.is_deleted).toBe(0);
    });
  });

  describe('getNotes', () => {
    beforeEach(() => {
      // Create test notes
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, content, color, is_deleted, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('note-1', 'Note 1', 'Content 1', 'yellow', 0, 0, now, now);
      
      db.prepare(`
        INSERT INTO notes (id, title, content, color, is_deleted, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('note-2', 'Note 2', 'Content 2', 'blue', 0, 0, now, now);
      
      db.prepare(`
        INSERT INTO notes (id, title, content, color, is_deleted, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('note-3', 'Deleted Note', 'Deleted', 'red', 1, 0, now, now);
      
      db.prepare(`
        INSERT INTO notes (id, title, content, color, is_deleted, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('note-4', 'Archived Note', 'Archived', 'green', 0, 1, now, now);
    });

    it('should get all active notes', () => {
      const notes = db.prepare('SELECT * FROM notes WHERE is_deleted = 0 AND is_archived = 0').all();
      expect(notes).toHaveLength(2);
    });

    it('should get deleted notes', () => {
      const notes = db.prepare('SELECT * FROM notes WHERE is_deleted = 1').all();
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Deleted Note');
    });

    it('should get archived notes', () => {
      const notes = db.prepare('SELECT * FROM notes WHERE is_archived = 1 AND is_deleted = 0').all();
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Archived Note');
    });

    it('should filter by color', () => {
      const notes = db.prepare('SELECT * FROM notes WHERE color = ? AND is_deleted = 0').all('blue');
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('Note 2');
    });
  });

  describe('updateNote', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, content, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('update-test', 'Original Title', 'Original Content', 'yellow', now, now);
    });

    it('should update title', () => {
      db.prepare('UPDATE notes SET title = ? WHERE id = ?').run('New Title', 'update-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('update-test');
      expect(note.title).toBe('New Title');
    });

    it('should update content', () => {
      db.prepare('UPDATE notes SET content = ?, content_plain = ? WHERE id = ?')
        .run('<b>New Content</b>', 'New Content', 'update-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('update-test');
      expect(note.content).toBe('<b>New Content</b>');
      expect(note.content_plain).toBe('New Content');
    });

    it('should update color', () => {
      db.prepare('UPDATE notes SET color = ? WHERE id = ?').run('blue', 'update-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('update-test');
      expect(note.color).toBe('blue');
    });

    it('should update position and size', () => {
      db.prepare('UPDATE notes SET position_x = ?, position_y = ?, width = ?, height = ? WHERE id = ?')
        .run(150, 250, 400, 500, 'update-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('update-test');
      expect(note.position_x).toBe(150);
      expect(note.position_y).toBe(250);
      expect(note.width).toBe(400);
      expect(note.height).toBe(500);
    });

    it('should update flags', () => {
      db.prepare('UPDATE notes SET is_pinned = ?, is_locked = ? WHERE id = ?')
        .run(1, 1, 'update-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('update-test');
      expect(note.is_pinned).toBe(1);
      expect(note.is_locked).toBe(1);
    });
  });

  describe('deleteNote', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('delete-test', 'To Delete', 0, now, now);
    });

    it('should soft delete a note', () => {
      const now = new Date().toISOString();
      db.prepare('UPDATE notes SET is_deleted = 1, deleted_at = ? WHERE id = ?')
        .run(now, 'delete-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('delete-test');
      expect(note.is_deleted).toBe(1);
      expect(note.deleted_at).toBeDefined();
    });

    it('should permanently delete a note', () => {
      db.prepare('DELETE FROM notes WHERE id = ?').run('delete-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('delete-test');
      expect(note).toBeUndefined();
    });
  });

  describe('restoreNote', () => {
    it('should restore a deleted note', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, is_deleted, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('restore-test', 'Deleted', 1, now, now, now);

      db.prepare('UPDATE notes SET is_deleted = 0, deleted_at = NULL WHERE id = ?')
        .run('restore-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('restore-test');
      expect(note.is_deleted).toBe(0);
      expect(note.deleted_at).toBeNull();
    });
  });

  describe('archiveNote', () => {
    it('should archive a note', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('archive-test', 'To Archive', 0, now, now);

      db.prepare('UPDATE notes SET is_archived = 1, archived_at = ? WHERE id = ?')
        .run(now, 'archive-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('archive-test');
      expect(note.is_archived).toBe(1);
      expect(note.archived_at).toBeDefined();
    });

    it('should unarchive a note', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO notes (id, title, is_archived, archived_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('unarchive-test', 'Archived', 1, now, now, now);

      db.prepare('UPDATE notes SET is_archived = 0, archived_at = NULL WHERE id = ?')
        .run('unarchive-test');
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('unarchive-test');
      expect(note.is_archived).toBe(0);
      expect(note.archived_at).toBeNull();
    });
  });

  describe('Reminders', () => {
    it('should set a reminder', () => {
      const now = new Date().toISOString();
      const reminderTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      
      db.prepare(`
        INSERT INTO notes (id, title, reminder_at, reminder_notified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('reminder-test', 'Reminder Note', reminderTime, 0, now, now);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('reminder-test');
      expect(note.reminder_at).toBe(reminderTime);
      expect(note.reminder_notified).toBe(0);
    });

    it('should get notes with pending reminders', () => {
      const now = new Date().toISOString();
      const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      
      db.prepare(`
        INSERT INTO notes (id, title, reminder_at, reminder_notified, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('overdue-1', 'Overdue', pastTime, 0, 0, now, now);
      
      db.prepare(`
        INSERT INTO notes (id, title, reminder_at, reminder_notified, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('future-1', 'Future', futureTime, 0, 0, now, now);

      const overdueNotes = db.prepare(`
        SELECT * FROM notes 
        WHERE reminder_at IS NOT NULL 
          AND reminder_at <= ? 
          AND reminder_notified = 0
          AND is_deleted = 0
      `).all(now);
      
      expect(overdueNotes).toHaveLength(1);
      expect(overdueNotes[0].title).toBe('Overdue');
    });
  });
});
