/**
 * Folders Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('Folders Database Operations', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `folders-test-${Date.now()}-${Math.random()}.db`);
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

  describe('createFolder', () => {
    it('should create a folder', () => {
      const now = new Date().toISOString();
      const id = 'folder-' + Date.now();
      
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(id, 'My Folder', now, now);
      
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
      expect(folder.name).toBe('My Folder');
      expect(folder.parent_id).toBeNull();
    });

    it('should create a subfolder', () => {
      const now = new Date().toISOString();
      const parentId = 'parent-' + Date.now();
      const childId = 'child-' + Date.now();
      
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(parentId, 'Parent', now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(childId, 'Child', parentId, now, now);
      
      const child = db.prepare('SELECT * FROM folders WHERE id = ?').get(childId);
      expect(child.parent_id).toBe(parentId);
    });

    it('should create folder with color', () => {
      const now = new Date().toISOString();
      const id = 'colored-' + Date.now();
      
      db.prepare('INSERT INTO folders (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, 'Colored', 'blue', now, now);
      
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
      expect(folder.color).toBe('blue');
    });
  });

  describe('getFolders', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('f1', 'Folder B', 2, now, now);
      db.prepare('INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('f2', 'Folder A', 1, now, now);
      db.prepare('INSERT INTO folders (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('f3', 'Folder C', 3, now, now);
    });

    it('should get all folders', () => {
      const folders = db.prepare('SELECT * FROM folders').all();
      expect(folders).toHaveLength(3);
    });

    it('should get folders ordered by sort_order then name', () => {
      const folders = db.prepare('SELECT * FROM folders ORDER BY sort_order, name').all();
      expect(folders[0].name).toBe('Folder A');
      expect(folders[1].name).toBe('Folder B');
      expect(folders[2].name).toBe('Folder C');
    });

    it('should get root folders only', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('child1', 'Child', 'f1', now, now);
      
      const rootFolders = db.prepare('SELECT * FROM folders WHERE parent_id IS NULL').all();
      expect(rootFolders).toHaveLength(3);
    });
  });

  describe('updateFolder', () => {
    let folderId;

    beforeEach(() => {
      const now = new Date().toISOString();
      folderId = 'update-folder-' + Date.now();
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(folderId, 'Original', now, now);
    });

    it('should rename folder', () => {
      const now = new Date().toISOString();
      db.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
        .run('Renamed', now, folderId);
      
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
      expect(folder.name).toBe('Renamed');
    });

    it('should change parent', () => {
      const now = new Date().toISOString();
      const newParentId = 'new-parent-' + Date.now();
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(newParentId, 'New Parent', now, now);
      
      db.prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?')
        .run(newParentId, now, folderId);
      
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
      expect(folder.parent_id).toBe(newParentId);
    });

    it('should update sort order', () => {
      db.prepare('UPDATE folders SET sort_order = ? WHERE id = ?').run(5, folderId);
      
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
      expect(folder.sort_order).toBe(5);
    });
  });

  describe('deleteFolder', () => {
    it('should delete a folder', () => {
      const now = new Date().toISOString();
      const id = 'delete-folder-' + Date.now();
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(id, 'Delete Me', now, now);
      
      db.prepare('DELETE FROM folders WHERE id = ?').run(id);
      
      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
      expect(folder).toBeUndefined();
    });

    it('should set null parent on child folders when parent deleted', () => {
      const now = new Date().toISOString();
      const parentId = 'parent-del-' + Date.now();
      const childId = 'child-del-' + Date.now();
      
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(parentId, 'Parent', now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(childId, 'Child', parentId, now, now);
      
      db.prepare('DELETE FROM folders WHERE id = ?').run(parentId);
      
      const child = db.prepare('SELECT * FROM folders WHERE id = ?').get(childId);
      expect(child.parent_id).toBeNull();
    });
  });

  describe('Folder-Note relationships', () => {
    let folderId;

    beforeEach(() => {
      const now = new Date().toISOString();
      folderId = 'folder-notes-' + Date.now();
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(folderId, 'Notes Folder', now, now);
    });

    it('should add note to folder', () => {
      const now = new Date().toISOString();
      const noteId = 'note-in-folder-' + Date.now();
      
      db.prepare('INSERT INTO notes (id, title, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(noteId, 'Note in Folder', folderId, now, now);
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.folder_id).toBe(folderId);
    });

    it('should get notes in folder', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO notes (id, title, folder_id, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('n1-' + Date.now(), 'Note 1', folderId, 0, now, now);
      db.prepare('INSERT INTO notes (id, title, folder_id, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('n2-' + Date.now(), 'Note 2', folderId, 0, now, now);
      db.prepare('INSERT INTO notes (id, title, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('n3-' + Date.now(), 'Note 3 (no folder)', 0, now, now);
      
      const notesInFolder = db.prepare('SELECT * FROM notes WHERE folder_id = ? AND is_deleted = 0').all(folderId);
      expect(notesInFolder).toHaveLength(2);
    });

    it('should set null folder on notes when folder deleted', () => {
      const now = new Date().toISOString();
      const noteId = 'orphan-note-' + Date.now();
      
      db.prepare('INSERT INTO notes (id, title, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(noteId, 'Orphan', folderId, now, now);
      
      db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.folder_id).toBeNull();
    });

    it('should move note to different folder', () => {
      const now = new Date().toISOString();
      const newFolderId = 'new-folder-' + Date.now();
      const noteId = 'move-note-' + Date.now();
      
      db.prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(newFolderId, 'New Folder', now, now);
      db.prepare('INSERT INTO notes (id, title, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(noteId, 'Moving Note', folderId, now, now);
      
      db.prepare('UPDATE notes SET folder_id = ? WHERE id = ?').run(newFolderId, noteId);
      
      const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
      expect(note.folder_id).toBe(newFolderId);
    });
  });

  describe('Folder tree', () => {
    it('should build nested folder structure', () => {
      const now = new Date().toISOString();
      
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('root1', 'Root 1', null, now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('root2', 'Root 2', null, now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('child1', 'Child 1', 'root1', now, now);
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('grandchild1', 'Grandchild 1', 'child1', now, now);
      
      // Get all folders and build tree
      const folders = db.prepare('SELECT * FROM folders').all();
      expect(folders).toHaveLength(4);
      
      const rootFolders = folders.filter(f => f.parent_id === null);
      expect(rootFolders).toHaveLength(2);
      
      const childFolders = folders.filter(f => f.parent_id === 'root1');
      expect(childFolders).toHaveLength(1);
      expect(childFolders[0].name).toBe('Child 1');
    });
  });
});
