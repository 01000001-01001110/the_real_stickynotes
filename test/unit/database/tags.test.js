/**
 * Tags Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('Tags Database Operations', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `tags-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
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

  describe('createTag', () => {
    it('should create a tag', () => {
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)')
        .run('test-tag', null, now);
      
      expect(result.lastInsertRowid).toBeGreaterThan(0);
      
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
      expect(tag.name).toBe('test-tag');
    });

    it('should create a tag with color', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)')
        .run('colored-tag', 'blue', now);
      
      const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get('colored-tag');
      expect(tag.color).toBe('blue');
    });

    it('should enforce unique tag names', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('unique-tag', now);
      
      expect(() => {
        db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('unique-tag', now);
      }).toThrow();
    });
  });

  describe('getTags', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('alpha', now);
      db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('beta', now);
      db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('gamma', now);
    });

    it('should get all tags', () => {
      const tags = db.prepare('SELECT * FROM tags').all();
      expect(tags).toHaveLength(3);
    });

    it('should get tags ordered by name', () => {
      const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
      expect(tags[0].name).toBe('alpha');
      expect(tags[1].name).toBe('beta');
      expect(tags[2].name).toBe('gamma');
    });

    it('should get tag by name', () => {
      const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get('beta');
      expect(tag).toBeDefined();
      expect(tag.name).toBe('beta');
    });

    it('should return undefined for non-existent tag', () => {
      const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get('nonexistent');
      expect(tag).toBeUndefined();
    });
  });

  describe('updateTag', () => {
    let tagId;

    beforeEach(() => {
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('update-me', now);
      tagId = result.lastInsertRowid;
    });

    it('should rename a tag', () => {
      db.prepare('UPDATE tags SET name = ? WHERE id = ?').run('renamed', tagId);
      
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
      expect(tag.name).toBe('renamed');
    });

    it('should update tag color', () => {
      db.prepare('UPDATE tags SET color = ? WHERE id = ?').run('green', tagId);
      
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
      expect(tag.color).toBe('green');
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag', () => {
      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('delete-me', now);
      
      db.prepare('DELETE FROM tags WHERE id = ?').run(result.lastInsertRowid);
      
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
      expect(tag).toBeUndefined();
    });

    it('should delete by name', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('delete-by-name', now);
      
      const result = db.prepare('DELETE FROM tags WHERE name = ?').run('delete-by-name');
      expect(result.changes).toBe(1);
    });
  });

  describe('Note-Tag relationships', () => {
    let noteId;
    let tagId1;
    let tagId2;

    beforeEach(() => {
      const now = new Date().toISOString();
      
      // Create a note
      noteId = 'note-for-tags-' + Date.now();
      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Tagged Note', now, now);
      
      // Create tags
      tagId1 = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('tag1', now).lastInsertRowid;
      tagId2 = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('tag2', now).lastInsertRowid;
    });

    it('should add tag to note', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      
      const relation = db.prepare('SELECT * FROM note_tags WHERE note_id = ? AND tag_id = ?')
        .get(noteId, tagId1);
      expect(relation).toBeDefined();
    });

    it('should add multiple tags to note', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId2);
      
      const tags = db.prepare(`
        SELECT t.* FROM tags t
        INNER JOIN note_tags nt ON t.id = nt.tag_id
        WHERE nt.note_id = ?
      `).all(noteId);
      
      expect(tags).toHaveLength(2);
    });

    it('should remove tag from note', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      db.prepare('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?').run(noteId, tagId1);
      
      const relation = db.prepare('SELECT * FROM note_tags WHERE note_id = ? AND tag_id = ?')
        .get(noteId, tagId1);
      expect(relation).toBeUndefined();
    });

    it('should cascade delete tags when note is deleted', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
      
      const relations = db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all(noteId);
      expect(relations).toHaveLength(0);
    });

    it('should get notes with specific tag', () => {
      const now = new Date().toISOString();
      const noteId2 = 'note-2-' + Date.now();
      db.prepare('INSERT INTO notes (id, title, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(noteId2, 'Another Note', 0, now, now);
      
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId2, tagId1);
      
      const notes = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN note_tags nt ON n.id = nt.note_id
        WHERE nt.tag_id = ? AND n.is_deleted = 0
      `).all(tagId1);
      
      expect(notes).toHaveLength(2);
    });

    it('should prevent duplicate tag on same note', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      
      expect(() => {
        db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId1);
      }).toThrow();
    });
  });

  describe('Tag counts', () => {
    it('should count notes per tag', () => {
      const now = new Date().toISOString();
      
      // Create notes
      db.prepare('INSERT INTO notes (id, title, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('n1', 'Note 1', 0, now, now);
      db.prepare('INSERT INTO notes (id, title, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('n2', 'Note 2', 0, now, now);
      db.prepare('INSERT INTO notes (id, title, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('n3', 'Note 3 (deleted)', 1, now, now);
      
      // Create tag
      const tagId = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('counted', now).lastInsertRowid;
      
      // Add tags
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n1', tagId);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n2', tagId);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('n3', tagId);
      
      // Count only non-deleted
      const result = db.prepare(`
        SELECT t.*, COUNT(CASE WHEN n.is_deleted = 0 THEN 1 END) as note_count
        FROM tags t
        LEFT JOIN note_tags nt ON t.id = nt.tag_id
        LEFT JOIN notes n ON nt.note_id = n.id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(tagId);
      
      expect(result.note_count).toBe(2);
    });
  });
});
