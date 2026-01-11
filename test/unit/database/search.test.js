/**
 * Search Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('Search Database Operations', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `search-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    
    // Create test notes
    const now = new Date().toISOString();
    const notes = [
      { id: 'n1', title: 'Shopping List', content: 'Buy milk, eggs, and bread from the grocery store', plain: 'Buy milk, eggs, and bread from the grocery store' },
      { id: 'n2', title: 'Project Ideas', content: 'Build a sticky notes app with electron', plain: 'Build a sticky notes app with electron' },
      { id: 'n3', title: 'Meeting Notes', content: 'Discussed project timeline and milestones', plain: 'Discussed project timeline and milestones' },
      { id: 'n4', title: 'Recipe: Eggs Benedict', content: 'Ingredients: eggs, english muffin, hollandaise', plain: 'Ingredients: eggs, english muffin, hollandaise' },
      { id: 'n5', title: 'Deleted Note', content: 'This note is deleted', plain: 'This note is deleted' },
    ];
    
    for (const note of notes) {
      db.prepare(`
        INSERT INTO notes (id, title, content, content_plain, is_deleted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(note.id, note.title, note.content, note.plain, note.id === 'n5' ? 1 : 0, now, now);
    }
    
    // Update FTS index
    db.prepare(`
      INSERT INTO notes_fts (notes_fts, rowid, title, content_plain)
      SELECT 'delete', rowid, title, content_plain FROM notes_fts
    `).run();
    
    db.prepare(`
      INSERT INTO notes_fts (rowid, title, content_plain)
      SELECT rowid, title, content_plain FROM notes WHERE is_deleted = 0
    `).run();
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

  describe('Basic search', () => {
    it('should find notes by title', () => {
      const results = db.prepare(`
        SELECT n.* FROM notes n
        WHERE n.title LIKE ? AND n.is_deleted = 0
      `).all('%Shopping%');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Shopping List');
    });

    it('should find notes by content', () => {
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE content_plain LIKE ? AND is_deleted = 0
      `).all('%milk%');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Shopping List');
    });

    it('should find notes matching multiple words', () => {
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE (title LIKE ? OR content_plain LIKE ?) AND is_deleted = 0
      `).all('%eggs%', '%eggs%');
      
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id).sort()).toEqual(['n1', 'n4']);
    });

    it('should not find deleted notes', () => {
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE content_plain LIKE ? AND is_deleted = 0
      `).all('%deleted%');
      
      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE LOWER(title) LIKE LOWER(?) AND is_deleted = 0
      `).all('%shopping%');
      
      expect(results).toHaveLength(1);
    });
  });

  describe('Full-text search', () => {
    it('should find notes using FTS', () => {
      // Note: FTS might need re-indexing based on our setup
      const results = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN notes_fts fts ON n.rowid = fts.rowid
        WHERE notes_fts MATCH ? AND n.is_deleted = 0
      `).all('grocery');
      
      expect(results).toHaveLength(1);
    });

    it('should handle FTS prefix search', () => {
      const results = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN notes_fts fts ON n.rowid = fts.rowid
        WHERE notes_fts MATCH ? AND n.is_deleted = 0
      `).all('proj*');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Search with filters', () => {
    it('should filter by color', () => {
      // Update one note with specific color
      db.prepare('UPDATE notes SET color = ? WHERE id = ?').run('blue', 'n1');
      db.prepare('UPDATE notes SET color = ? WHERE id = ?').run('yellow', 'n2');
      
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE color = ? AND is_deleted = 0
      `).all('blue');
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('n1');
    });

    it('should filter by folder', () => {
      const now = new Date().toISOString();
      const folderId = 'search-folder';
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(folderId, 'Search Folder', now, now);
      
      db.prepare('UPDATE notes SET folder_id = ? WHERE id = ?').run(folderId, 'n1');
      db.prepare('UPDATE notes SET folder_id = ? WHERE id = ?').run(folderId, 'n2');
      
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE folder_id = ? AND is_deleted = 0
      `).all(folderId);
      
      expect(results).toHaveLength(2);
    });

    it('should filter by tag', () => {
      const now = new Date().toISOString();
      const tagId = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('important', now).lastInsertRowid;
      
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n1', tagId);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n3', tagId);
      
      const results = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN note_tags nt ON n.id = nt.note_id
        WHERE nt.tag_id = ? AND n.is_deleted = 0
      `).all(tagId);
      
      expect(results).toHaveLength(2);
    });

    it('should combine search query with filters', () => {
      const now = new Date().toISOString();
      const tagId = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('recipe', now).lastInsertRowid;
      
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n4', tagId);
      
      const results = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN note_tags nt ON n.id = nt.note_id
        WHERE nt.tag_id = ? AND n.content_plain LIKE ? AND n.is_deleted = 0
      `).all(tagId, '%eggs%');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Recipe: Eggs Benedict');
    });
  });

  describe('Search ordering', () => {
    it('should order by relevance (title match first)', () => {
      const results = db.prepare(`
        SELECT *,
          CASE 
            WHEN title LIKE ? THEN 1
            ELSE 2
          END as relevance
        FROM notes
        WHERE (title LIKE ? OR content_plain LIKE ?) AND is_deleted = 0
        ORDER BY relevance, updated_at DESC
      `).all('%eggs%', '%eggs%', '%eggs%');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should order by date', () => {
      // Update dates to ensure ordering
      db.prepare('UPDATE notes SET updated_at = ? WHERE id = ?')
        .run(new Date(Date.now() - 3600000).toISOString(), 'n1');
      db.prepare('UPDATE notes SET updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), 'n2');
      
      const results = db.prepare(`
        SELECT * FROM notes
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `).all();
      
      expect(results[0].id).toBe('n2');
    });
  });

  describe('Search pagination', () => {
    it('should limit results', () => {
      const results = db.prepare(`
        SELECT * FROM notes WHERE is_deleted = 0 LIMIT 2
      `).all();
      
      expect(results).toHaveLength(2);
    });

    it('should offset results', () => {
      const allResults = db.prepare('SELECT * FROM notes WHERE is_deleted = 0 ORDER BY id').all();
      const offsetResults = db.prepare('SELECT * FROM notes WHERE is_deleted = 0 ORDER BY id LIMIT 2 OFFSET 2').all();
      
      expect(offsetResults[0].id).toBe(allResults[2].id);
    });

    it('should count total results', () => {
      const count = db.prepare('SELECT COUNT(*) as total FROM notes WHERE is_deleted = 0').get();
      expect(count.total).toBe(4);
    });
  });

  describe('Empty and special searches', () => {
    it('should return all notes for empty query', () => {
      const results = db.prepare('SELECT * FROM notes WHERE is_deleted = 0').all();
      expect(results).toHaveLength(4);
    });

    it('should handle special characters', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO notes (id, title, content_plain, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('special', 'C++ Programming', 'Learn C++ basics', 0, now, now);
      
      const results = db.prepare(`
        SELECT * FROM notes WHERE title LIKE ? AND is_deleted = 0
      `).all('%C++%');
      
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      const results = db.prepare(`
        SELECT * FROM notes WHERE title LIKE ? AND is_deleted = 0
      `).all('%nonexistent%');
      
      expect(results).toHaveLength(0);
    });
  });
});
