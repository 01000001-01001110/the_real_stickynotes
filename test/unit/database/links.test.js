/**
 * Links Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('Links Database Operations', () => {
  let db;
  let testDbPath;
  let noteId1;
  let noteId2;
  let noteId3;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `links-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    
    // Create test notes
    const now = new Date().toISOString();
    noteId1 = 'note-1-' + Date.now();
    noteId2 = 'note-2-' + Date.now();
    noteId3 = 'note-3-' + Date.now();
    
    db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(noteId1, 'Note 1', now, now);
    db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(noteId2, 'Note 2', now, now);
    db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(noteId3, 'Note 3', now, now);
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

  describe('createLink', () => {
    it('should create a link between notes', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      
      const link = db.prepare('SELECT * FROM note_links WHERE source_note_id = ? AND target_note_id = ?')
        .get(noteId1, noteId2);
      expect(link).toBeDefined();
    });

    it('should prevent duplicate links with same text', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      
      expect(() => {
        db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
          .run(noteId1, noteId2, 'link1');
      }).toThrow();
    });

    it('should allow bidirectional links', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId2, noteId1, 'link2');
      
      const links = db.prepare('SELECT * FROM note_links WHERE (source_note_id = ? AND target_note_id = ?) OR (source_note_id = ? AND target_note_id = ?)')
        .all(noteId1, noteId2, noteId2, noteId1);
      expect(links).toHaveLength(2);
    });
  });

  describe('getLinks', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId3, 'link2');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId2, noteId3, 'link3');
    });

    it('should get outgoing links', () => {
      const links = db.prepare('SELECT * FROM note_links WHERE source_note_id = ?').all(noteId1);
      expect(links).toHaveLength(2);
    });

    it('should get incoming links', () => {
      const links = db.prepare('SELECT * FROM note_links WHERE target_note_id = ?').all(noteId3);
      expect(links).toHaveLength(2);
    });

    it('should get linked notes with details', () => {
      const linkedNotes = db.prepare(`
        SELECT n.*, nl.link_text
        FROM notes n
        INNER JOIN note_links nl ON n.id = nl.target_note_id
        WHERE nl.source_note_id = ?
      `).all(noteId1);
      
      expect(linkedNotes).toHaveLength(2);
      expect(linkedNotes.map(n => n.title).sort()).toEqual(['Note 2', 'Note 3']);
    });

    it('should get all links for a note (both directions)', () => {
      const outgoing = db.prepare('SELECT target_note_id as linked_id FROM note_links WHERE source_note_id = ?').all(noteId1);
      const incoming = db.prepare('SELECT source_note_id as linked_id FROM note_links WHERE target_note_id = ?').all(noteId1);
      
      const allLinked = [...outgoing, ...incoming];
      expect(allLinked).toHaveLength(2);
    });
  });

  describe('deleteLink', () => {
    it('should delete a specific link', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      
      const result = db.prepare('DELETE FROM note_links WHERE source_note_id = ? AND target_note_id = ?')
        .run(noteId1, noteId2);
      expect(result.changes).toBe(1);
      
      const link = db.prepare('SELECT * FROM note_links WHERE source_note_id = ? AND target_note_id = ?')
        .get(noteId1, noteId2);
      expect(link).toBeUndefined();
    });

    it('should cascade delete when source note is deleted', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId3, 'link2');
      
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId1);
      
      const links = db.prepare('SELECT * FROM note_links WHERE source_note_id = ?').all(noteId1);
      expect(links).toHaveLength(0);
    });

    it('should cascade delete when target note is deleted', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId3, noteId2, 'link2');
      
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId2);
      
      const links = db.prepare('SELECT * FROM note_links WHERE target_note_id = ?').all(noteId2);
      expect(links).toHaveLength(0);
    });
  });

  describe('Link count', () => {
    it('should count outgoing links', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId3, 'link2');
      
      const result = db.prepare('SELECT COUNT(*) as count FROM note_links WHERE source_note_id = ?').get(noteId1);
      expect(result.count).toBe(2);
    });

    it('should count incoming links (backlinks)', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId3, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId2, noteId3, 'link2');
      
      const result = db.prepare('SELECT COUNT(*) as count FROM note_links WHERE target_note_id = ?').get(noteId3);
      expect(result.count).toBe(2);
    });
  });

  describe('Graph queries', () => {
    it('should detect link cycles', () => {
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId2, noteId3, 'link2');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId3, noteId1, 'link3');
      
      // Check if path exists from noteId1 back to noteId1 (cycle)
      // This is a simplified cycle check - just verify the links exist
      const cycle = db.prepare(`
        SELECT EXISTS(
          SELECT 1 FROM note_links nl1
          JOIN note_links nl2 ON nl1.target_note_id = nl2.source_note_id
          JOIN note_links nl3 ON nl2.target_note_id = nl3.source_note_id
          WHERE nl1.source_note_id = ? AND nl3.target_note_id = ?
        ) as has_cycle
      `).get(noteId1, noteId1);
      
      expect(cycle.has_cycle).toBe(1);
    });
  });
});
