/**
 * Database Core Tests
 */
const fs = require('fs');
const Database = require('better-sqlite3');

// We need to test the database module in isolation
describe('Database Core', () => {
  let testDbPath;
  let db;

  beforeEach(() => {
    // Ensure test directory exists (prevents race conditions in parallel tests)
    global.ensureTestDir();
    // Create a unique test database for each test
    testDbPath = global.getTestDbPath();
  });

  afterEach(() => {
    // Close and clean up
    if (db) {
      db.close();
      db = null;
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Database creation', () => {
    it('should create a new database file', () => {
      db = new Database(testDbPath);
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should enable WAL mode', () => {
      db = new Database(testDbPath);
      db.pragma('journal_mode = WAL');
      const result = db.pragma('journal_mode');
      expect(result[0].journal_mode).toBe('wal');
    });

    it('should enable foreign keys', () => {
      db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      const result = db.pragma('foreign_keys');
      expect(result[0].foreign_keys).toBe(1);
    });
  });

  describe('Schema creation', () => {
    beforeEach(() => {
      db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
    });

    it('should create notes table', () => {
      db.exec(`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          title TEXT,
          content TEXT NOT NULL DEFAULT '',
          color TEXT DEFAULT 'yellow',
          created_at TEXT NOT NULL
        )
      `);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it('should create folders table', () => {
      db.exec(`
        CREATE TABLE folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT,
          FOREIGN KEY (parent_id) REFERENCES folders(id)
        )
      `);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='folders'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it('should create tags table', () => {
      db.exec(`
        CREATE TABLE tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT
        )
      `);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tags'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it('should create note_tags junction table', () => {
      db.exec(`
        CREATE TABLE notes (id TEXT PRIMARY KEY);
        CREATE TABLE tags (id INTEGER PRIMARY KEY);
        CREATE TABLE note_tags (
          note_id TEXT NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='note_tags'")
        .all();
      expect(tables).toHaveLength(1);
    });

    it('should create settings table', () => {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
        .all();
      expect(tables).toHaveLength(1);
    });
  });

  describe('Basic operations', () => {
    beforeEach(() => {
      db = new Database(testDbPath);
      db.exec(`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          title TEXT,
          content TEXT,
          created_at TEXT
        )
      `);
    });

    it('should insert a record', () => {
      const stmt = db.prepare(
        'INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)'
      );
      const result = stmt.run('note-1', 'Test Title', 'Test Content', new Date().toISOString());
      expect(result.changes).toBe(1);
    });

    it('should select a record', () => {
      db.prepare('INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)').run(
        'note-1',
        'Test Title',
        'Test Content',
        new Date().toISOString()
      );

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('note-1');
      expect(note).toBeDefined();
      expect(note.title).toBe('Test Title');
      expect(note.content).toBe('Test Content');
    });

    it('should update a record', () => {
      db.prepare('INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)').run(
        'note-1',
        'Test Title',
        'Test Content',
        new Date().toISOString()
      );

      const result = db
        .prepare('UPDATE notes SET title = ? WHERE id = ?')
        .run('Updated Title', 'note-1');
      expect(result.changes).toBe(1);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('note-1');
      expect(note.title).toBe('Updated Title');
    });

    it('should delete a record', () => {
      db.prepare('INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)').run(
        'note-1',
        'Test Title',
        'Test Content',
        new Date().toISOString()
      );

      const result = db.prepare('DELETE FROM notes WHERE id = ?').run('note-1');
      expect(result.changes).toBe(1);

      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('note-1');
      expect(note).toBeUndefined();
    });

    it('should count records', () => {
      db.prepare('INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)').run(
        'note-1',
        'Title 1',
        'Content 1',
        new Date().toISOString()
      );
      db.prepare('INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)').run(
        'note-2',
        'Title 2',
        'Content 2',
        new Date().toISOString()
      );

      const result = db.prepare('SELECT COUNT(*) as count FROM notes').get();
      expect(result.count).toBe(2);
    });
  });

  describe('Integrity check', () => {
    it('should pass integrity check on new database', () => {
      db = new Database(testDbPath);
      const result = db.pragma('integrity_check');
      expect(result[0].integrity_check).toBe('ok');
    });
  });
});
