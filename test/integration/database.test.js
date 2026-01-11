/**
 * Database Integration Tests
 * 
 * Tests the full database workflow including migrations,
 * CRUD operations, and relationships between entities.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../shared/database/migrations');

describe('Database Integration', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `integration-${Date.now()}-${Math.random()}.db`);
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

  describe('Complete Note Workflow', () => {
    it('should create, update, and delete a note', () => {
      const now = new Date().toISOString();
      const noteId = 'workflow-note-' + Date.now();

      // Create
      db.prepare(`
        INSERT INTO notes (id, title, content, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(noteId, 'Initial Title', 'Initial Content', 'yellow', now, now);

      let note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.title).toBe('Initial Title');

      // Update
      db.prepare('UPDATE notes SET title = ?, updated_at = ? WHERE id = ?')
        .run('Updated Title', new Date().toISOString(), noteId);

      note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.title).toBe('Updated Title');

      // Soft delete
      db.prepare('UPDATE notes SET is_deleted = 1, deleted_at = ? WHERE id = ?')
        .run(new Date().toISOString(), noteId);

      note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.is_deleted).toBe(1);

      // Restore
      db.prepare('UPDATE notes SET is_deleted = 0, deleted_at = NULL WHERE id = ?')
        .run(noteId);

      note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.is_deleted).toBe(0);

      // Permanent delete
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);

      note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note).toBeUndefined();
    });

    it('should handle note with tags and folder', () => {
      const now = new Date().toISOString();
      const noteId = 'tagged-note-' + Date.now();
      const folderId = 'folder-' + Date.now();

      // Create folder
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(folderId, 'Test Folder', now, now);

      // Create note in folder
      db.prepare(`
        INSERT INTO notes (id, title, folder_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(noteId, 'Note in Folder', folderId, now, now);

      // Create tags
      const tag1Id = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('tag1', now).lastInsertRowid;
      const tag2Id = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('tag2', now).lastInsertRowid;

      // Add tags to note
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tag1Id);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tag2Id);

      // Query note with folder and tags
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
      const tags = db.prepare(`
        SELECT t.* FROM tags t
        INNER JOIN note_tags nt ON t.id = nt.tag_id
        WHERE nt.note_id = ?
      `).all(noteId);

      expect(note.folder_id).toBe(folderId);
      expect(folder.name).toBe('Test Folder');
      expect(tags).toHaveLength(2);
    });

    it('should handle note with attachments and history', () => {
      const now = new Date().toISOString();
      const noteId = 'full-note-' + Date.now();

      // Create note
      db.prepare(`
        INSERT INTO notes (id, title, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(noteId, 'Note with Extras', 'Original content', now, now);

      // Add attachment
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, mime_type, size_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('att-1', noteId, 'file.pdf', '/path/file.pdf', 'application/pdf', 1024, now);

      // Add history entry (using saved_at column per schema)
      db.prepare(`
        INSERT INTO note_history (note_id, title, content, saved_at)
        VALUES (?, ?, ?, ?)
      `).run(noteId, 'Note with Extras', 'Original content', now);

      // Update note
      db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
        .run('Updated content', new Date().toISOString(), noteId);

      // Add another history entry
      db.prepare(`
        INSERT INTO note_history (note_id, title, content, saved_at)
        VALUES (?, ?, ?, ?)
      `).run(noteId, 'Note with Extras', 'Updated content', new Date().toISOString());

      // Verify
      const attachments = db.prepare('SELECT * FROM attachments WHERE note_id = ?').all(noteId);
      const history = db.prepare('SELECT * FROM note_history WHERE note_id = ? ORDER BY saved_at DESC').all(noteId);

      expect(attachments).toHaveLength(1);
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Updated content');
    });

    it('should handle note links', () => {
      const now = new Date().toISOString();
      const noteId1 = 'link-note-1-' + Date.now();
      const noteId2 = 'link-note-2-' + Date.now();
      const noteId3 = 'link-note-3-' + Date.now();

      // Create notes
      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(noteId1, 'Note 1', now, now);
      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(noteId2, 'Note 2', now, now);
      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(noteId3, 'Note 3', now, now);

      // Create links: Note1 -> Note2, Note1 -> Note3 (using link_text column per schema)
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId2, 'link1');
      db.prepare('INSERT INTO note_links (source_note_id, target_note_id, link_text) VALUES (?, ?, ?)')
        .run(noteId1, noteId3, 'link2');

      // Query outgoing links from Note1
      const outgoing = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN note_links nl ON n.id = nl.target_note_id
        WHERE nl.source_note_id = ?
      `).all(noteId1);

      // Query backlinks to Note2
      const backlinks = db.prepare(`
        SELECT n.* FROM notes n
        INNER JOIN note_links nl ON n.id = nl.source_note_id
        WHERE nl.target_note_id = ?
      `).all(noteId2);

      expect(outgoing).toHaveLength(2);
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe(noteId1);
    });
  });

  describe('Folder Hierarchy', () => {
    it('should create and navigate folder tree', () => {
      const now = new Date().toISOString();

      // Create folder tree: Root > Child1, Child2 > Grandchild
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('root', 'Root', null, now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('child1', 'Child 1', 'root', now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('child2', 'Child 2', 'root', now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('grandchild', 'Grandchild', 'child1', now, now);

      // Get root folders
      const roots = db.prepare('SELECT * FROM folders WHERE parent_id IS NULL').all();
      expect(roots).toHaveLength(1);

      // Get children of root
      const children = db.prepare('SELECT * FROM folders WHERE parent_id = ?').all('root');
      expect(children).toHaveLength(2);

      // Get descendants (using recursive CTE)
      const descendants = db.prepare(`
        WITH RECURSIVE folder_tree AS (
          SELECT id, name, parent_id, 0 as depth
          FROM folders WHERE id = ?
          UNION ALL
          SELECT f.id, f.name, f.parent_id, ft.depth + 1
          FROM folders f
          INNER JOIN folder_tree ft ON f.parent_id = ft.id
        )
        SELECT * FROM folder_tree WHERE depth > 0
      `).all('root');

      expect(descendants).toHaveLength(3); // child1, child2, grandchild
    });

    it('should move folder with notes', () => {
      const now = new Date().toISOString();

      // Setup
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('folder-a', 'Folder A', now, now);
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('folder-b', 'Folder B', now, now);
      db.prepare('INSERT INTO notes (id, title, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('note-in-a', 'Note', 'folder-a', now, now);

      // Move folder A under folder B
      db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run('folder-b', 'folder-a');

      const movedFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get('folder-a');
      expect(movedFolder.parent_id).toBe('folder-b');

      // Note should still be in folder-a
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get('note-in-a');
      expect(note.folder_id).toBe('folder-a');
    });
  });

  describe('Search Integration', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      
      // Create diverse notes for search testing
      const notes = [
        { id: 's1', title: 'JavaScript Tutorial', content: 'Learn JavaScript basics', folder: 'programming' },
        { id: 's2', title: 'Python Guide', content: 'Python programming fundamentals', folder: 'programming' },
        { id: 's3', title: 'Shopping List', content: 'Milk, eggs, bread, cheese', folder: null },
        { id: 's4', title: 'Meeting Notes', content: 'Discussed JavaScript project timeline', folder: 'work' },
      ];

      // Create folders
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('programming', 'Programming', now, now);
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('work', 'Work', now, now);

      // Create notes
      for (const note of notes) {
        db.prepare(`
          INSERT INTO notes (id, title, content, content_plain, folder_id, is_deleted, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(note.id, note.title, note.content, note.content, note.folder, 0, now, now);
      }

      // Create and assign tags
      const jsTagId = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('javascript', now).lastInsertRowid;
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('s1', jsTagId);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('s4', jsTagId);
    });

    it('should search across notes', () => {
      const results = db.prepare(`
        SELECT * FROM notes 
        WHERE (title LIKE ? OR content_plain LIKE ?) AND is_deleted = 0
      `).all('%JavaScript%', '%JavaScript%');

      expect(results).toHaveLength(2);
    });

    it('should search within folder', () => {
      const results = db.prepare(`
        SELECT * FROM notes 
        WHERE folder_id = ? AND (title LIKE ? OR content_plain LIKE ?) AND is_deleted = 0
      `).all('programming', '%Python%', '%Python%');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Python Guide');
    });

    it('should search by tag', () => {
      const results = db.prepare(`
        SELECT DISTINCT n.* FROM notes n
        INNER JOIN note_tags nt ON n.id = nt.note_id
        INNER JOIN tags t ON nt.tag_id = t.id
        WHERE t.name = ? AND n.is_deleted = 0
      `).all('javascript');

      expect(results).toHaveLength(2);
    });

    it('should combine search with tag and folder filter', () => {
      const results = db.prepare(`
        SELECT DISTINCT n.* FROM notes n
        INNER JOIN note_tags nt ON n.id = nt.note_id
        INNER JOIN tags t ON nt.tag_id = t.id
        WHERE t.name = ? AND n.folder_id = ? AND n.is_deleted = 0
      `).all('javascript', 'programming');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('s1');
    });
  });

  describe('Cascade Deletes', () => {
    it('should cascade delete note-related data', () => {
      const now = new Date().toISOString();
      const noteId = 'cascade-note-' + Date.now();

      // Create note with all related data
      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Cascade Test', now, now);

      const tagId = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('test-tag', now).lastInsertRowid;

      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId);
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, created_at) VALUES (?, ?, ?, ?, ?)')
        .run('att-1', noteId, 'file.txt', '/path', now);
      db.prepare('INSERT INTO note_history (note_id, title, content, saved_at) VALUES (?, ?, ?, ?)')
        .run(noteId, 'Test', 'Content', now);

      // Verify related data exists
      expect(db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all(noteId)).toHaveLength(1);
      expect(db.prepare('SELECT * FROM attachments WHERE note_id = ?').all(noteId)).toHaveLength(1);
      expect(db.prepare('SELECT * FROM note_history WHERE note_id = ?').all(noteId)).toHaveLength(1);

      // Delete note
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);

      // Verify cascade
      expect(db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all(noteId)).toHaveLength(0);
      expect(db.prepare('SELECT * FROM attachments WHERE note_id = ?').all(noteId)).toHaveLength(0);
      expect(db.prepare('SELECT * FROM note_history WHERE note_id = ?').all(noteId)).toHaveLength(0);
    });

    it('should cascade delete tag associations when tag deleted', () => {
      const now = new Date().toISOString();

      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('note-1', 'Note 1', now, now);
      
      const tagId = db.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)')
        .run('delete-tag', now).lastInsertRowid;

      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('note-1', tagId);

      // Delete tag
      db.prepare('DELETE FROM tags WHERE id = ?').run(tagId);

      // Verify cascade
      const relations = db.prepare('SELECT * FROM note_tags WHERE tag_id = ?').all(tagId);
      expect(relations).toHaveLength(0);
    });
  });

  describe('Settings Management', () => {
    it('should manage application settings', () => {
      const now = new Date().toISOString();

      // Set initial settings
      const settings = [
        ['general.startOnBoot', 'false'],
        ['appearance.theme', 'dark'],
        ['appearance.defaultNoteColor', 'blue'],
        ['shortcuts.globalNewNote', 'Ctrl+Shift+N'],
      ];

      for (const [key, value] of settings) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
          .run(key, value, now);
      }

      // Retrieve all settings
      const allSettings = db.prepare('SELECT * FROM settings').all();
      expect(allSettings).toHaveLength(4);

      // Update a setting
      db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?')
        .run('light', new Date().toISOString(), 'appearance.theme');

      const theme = db.prepare('SELECT value FROM settings WHERE key = ?').get('appearance.theme');
      expect(theme.value).toBe('light');

      // Delete a setting
      db.prepare('DELETE FROM settings WHERE key = ?').run('shortcuts.globalNewNote');

      const remaining = db.prepare('SELECT * FROM settings').all();
      expect(remaining).toHaveLength(3);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple inserts', () => {
      const now = new Date().toISOString();
      const insertNote = db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)');
      
      // Insert many notes quickly
      const insertMany = db.transaction((count) => {
        for (let i = 0; i < count; i++) {
          insertNote.run(`note-${i}`, `Note ${i}`, now, now);
        }
      });

      insertMany(100);

      const count = db.prepare('SELECT COUNT(*) as count FROM notes').get();
      expect(count.count).toBe(100);
    });

    it('should rollback on error', () => {
      const now = new Date().toISOString();
      
      // Create a note first
      db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('existing', 'Existing', now, now);

      const insertWithError = db.transaction(() => {
        db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .run('new-1', 'New 1', now, now);
        // This should fail (duplicate ID)
        db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
          .run('existing', 'Duplicate', now, now);
      });

      expect(() => insertWithError()).toThrow();

      // Should have only the original note
      const count = db.prepare('SELECT COUNT(*) as count FROM notes').get();
      expect(count.count).toBe(1);
    });
  });
});
