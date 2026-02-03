/**
 * Attachments Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('Attachments Database Operations', () => {
  let db;
  let testDbPath;
  let noteId;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `attachments-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    
    // Create a note for attachments
    const now = new Date().toISOString();
    noteId = 'note-for-attachments-' + Date.now();
    db.prepare('INSERT INTO notes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(noteId, 'Attachment Test Note', now, now);
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

  describe('createAttachment', () => {
    it('should create an attachment', () => {
      const now = new Date().toISOString();
      const attachmentId = 'att-' + Date.now();
      
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, mime_type, size_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(attachmentId, noteId, 'test.pdf', '/path/to/test.pdf', 'application/pdf', 12345, now);
      
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
      expect(attachment.filename).toBe('test.pdf');
      expect(attachment.mime_type).toBe('application/pdf');
      expect(attachment.size_bytes).toBe(12345);
    });

    it('should create image attachment', () => {
      const now = new Date().toISOString();
      const attachmentId = 'img-' + Date.now();
      
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, mime_type, size_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(attachmentId, noteId, 'photo.jpg', '/path/to/photo.jpg', 'image/jpeg', 54321, now);
      
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
      expect(attachment.filename).toBe('photo.jpg');
      expect(attachment.mime_type).toBe('image/jpeg');
    });
  });

  describe('getAttachments', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, mime_type, size_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('att1', noteId, 'file1.pdf', '/path/file1.pdf', 'application/pdf', 1000, now);
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, mime_type, size_bytes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('att2', noteId, 'file2.png', '/path/file2.png', 'image/png', 2000, now);
    });

    it('should get all attachments for note', () => {
      const attachments = db.prepare('SELECT * FROM attachments WHERE note_id = ?').all(noteId);
      expect(attachments).toHaveLength(2);
    });

    it('should get attachment by id', () => {
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get('att1');
      expect(attachment.filename).toBe('file1.pdf');
    });

    it('should filter by mime type', () => {
      const images = db.prepare("SELECT * FROM attachments WHERE note_id = ? AND mime_type LIKE 'image/%'").all(noteId);
      expect(images).toHaveLength(1);
      expect(images[0].filename).toBe('file2.png');
    });
  });

  describe('deleteAttachment', () => {
    it('should delete an attachment', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('delete-att', noteId, 'delete.txt', '/path/delete.txt', now);
      
      db.prepare('DELETE FROM attachments WHERE id = ?').run('delete-att');
      
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get('delete-att');
      expect(attachment).toBeUndefined();
    });

    it('should cascade delete when note is deleted', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('cascade-att', noteId, 'cascade.txt', '/path/cascade.txt', now);
      
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
      
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get('cascade-att');
      expect(attachment).toBeUndefined();
    });
  });

  describe('updateAttachment', () => {
    it('should update attachment filename', () => {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO attachments (id, note_id, filename, filepath, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('update-att', noteId, 'original.txt', '/path/original.txt', now);
      
      db.prepare('UPDATE attachments SET filename = ? WHERE id = ?').run('renamed.txt', 'update-att');
      
      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get('update-att');
      expect(attachment.filename).toBe('renamed.txt');
    });
  });

  describe('Attachment count', () => {
    it('should count attachments for note', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, created_at) VALUES (?, ?, ?, ?, ?)')
        .run('c1', noteId, 'f1.txt', '/p/f1.txt', now);
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, created_at) VALUES (?, ?, ?, ?, ?)')
        .run('c2', noteId, 'f2.txt', '/p/f2.txt', now);
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, created_at) VALUES (?, ?, ?, ?, ?)')
        .run('c3', noteId, 'f3.txt', '/p/f3.txt', now);
      
      const result = db.prepare('SELECT COUNT(*) as count FROM attachments WHERE note_id = ?').get(noteId);
      expect(result.count).toBe(3);
    });

    it('should calculate total size for note', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('s1', noteId, 'f1.txt', '/p/f1.txt', 100, now);
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('s2', noteId, 'f2.txt', '/p/f2.txt', 200, now);
      db.prepare('INSERT INTO attachments (id, note_id, filename, filepath, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('s3', noteId, 'f3.txt', '/p/f3.txt', 300, now);
      
      const result = db.prepare('SELECT SUM(size_bytes) as total FROM attachments WHERE note_id = ?').get(noteId);
      expect(result.total).toBe(600);
    });
  });
});
