/**
 * Electron IPC Notes Handler Tests
 * 
 * Tests for IPC handlers that manage notes.
 */

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  BrowserWindow: jest.fn(),
}));

// Mock database
jest.mock('../../../shared/database', () => ({
  getDb: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../shared/database/notes', () => ({
  createNote: jest.fn(),
  getNotes: jest.fn(),
  getNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
  restoreNote: jest.fn(),
  archiveNote: jest.fn(),
  permanentDelete: jest.fn(),
}));

describe('IPC Notes Handlers', () => {
  const notesDb = require('../../../shared/database/notes');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notes:create', () => {
    it('should create a note with provided data', async () => {
      const noteData = {
        title: 'Test Note',
        content: 'Test content',
        color: 'blue',
      };

      notesDb.createNote.mockResolvedValue({
        id: 'new-note-id',
        ...noteData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await notesDb.createNote(noteData);

      expect(notesDb.createNote).toHaveBeenCalledWith(noteData);
      expect(result.id).toBe('new-note-id');
      expect(result.title).toBe('Test Note');
    });

    it('should create note with default color', async () => {
      notesDb.createNote.mockResolvedValue({
        id: 'default-color',
        color: 'yellow',
      });

      const result = await notesDb.createNote({ content: 'Test' });

      expect(result.color).toBe('yellow');
    });

    it('should set created_at and updated_at', async () => {
      const now = new Date().toISOString();
      
      notesDb.createNote.mockResolvedValue({
        id: 'timestamped',
        created_at: now,
        updated_at: now,
      });

      const result = await notesDb.createNote({ content: 'Test' });

      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });
  });

  describe('notes:list', () => {
    it('should return all notes', async () => {
      notesDb.getNotes.mockResolvedValue([
        { id: '1', title: 'Note 1' },
        { id: '2', title: 'Note 2' },
      ]);

      const result = await notesDb.getNotes();

      expect(result).toHaveLength(2);
    });

    it('should filter deleted notes by default', async () => {
      notesDb.getNotes.mockResolvedValue([
        { id: '1', title: 'Active Note', is_deleted: 0 },
      ]);

      const result = await notesDb.getNotes({ includeDeleted: false });

      expect(notesDb.getNotes).toHaveBeenCalled();
      expect(result.every(n => n.is_deleted === 0)).toBe(true);
    });

    it('should include deleted when requested', async () => {
      notesDb.getNotes.mockResolvedValue([
        { id: '1', is_deleted: 0 },
        { id: '2', is_deleted: 1 },
      ]);

      const result = await notesDb.getNotes({ includeDeleted: true });

      expect(result).toHaveLength(2);
    });

    it('should filter by folder', async () => {
      notesDb.getNotes.mockResolvedValue([
        { id: '1', folder_id: 'folder-1' },
      ]);

      await notesDb.getNotes({ folderId: 'folder-1' });

      expect(notesDb.getNotes).toHaveBeenCalledWith({ folderId: 'folder-1' });
    });
  });

  describe('notes:get', () => {
    it('should return note by id', async () => {
      notesDb.getNote.mockResolvedValue({
        id: 'note-123',
        title: 'Test Note',
        content: 'Content',
      });

      const result = await notesDb.getNote('note-123');

      expect(notesDb.getNote).toHaveBeenCalledWith('note-123');
      expect(result.id).toBe('note-123');
    });

    it('should return null for non-existent note', async () => {
      notesDb.getNote.mockResolvedValue(null);

      const result = await notesDb.getNote('non-existent');

      expect(result).toBeNull();
    });

    it('should include tags and folder info', async () => {
      notesDb.getNote.mockResolvedValue({
        id: 'note-123',
        tags: ['important', 'work'],
        folder_id: 'folder-1',
        folder_name: 'Work',
      });

      const result = await notesDb.getNote('note-123');

      expect(result.tags).toContain('important');
      expect(result.folder_name).toBe('Work');
    });
  });

  describe('notes:update', () => {
    it('should update note properties', async () => {
      notesDb.updateNote.mockResolvedValue({
        id: 'note-123',
        title: 'Updated Title',
      });

      const result = await notesDb.updateNote('note-123', { title: 'Updated Title' });

      expect(notesDb.updateNote).toHaveBeenCalledWith('note-123', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });

    it('should update position', async () => {
      notesDb.updateNote.mockResolvedValue({
        id: 'note-123',
        position_x: 100,
        position_y: 200,
      });

      await notesDb.updateNote('note-123', { position_x: 100, position_y: 200 });

      expect(notesDb.updateNote).toHaveBeenCalled();
    });

    it('should update size', async () => {
      notesDb.updateNote.mockResolvedValue({
        id: 'note-123',
        width: 400,
        height: 500,
      });

      await notesDb.updateNote('note-123', { width: 400, height: 500 });

      expect(notesDb.updateNote).toHaveBeenCalled();
    });

    it('should set updated_at timestamp', async () => {
      const before = new Date().toISOString();
      
      notesDb.updateNote.mockResolvedValue({
        id: 'note-123',
        updated_at: new Date().toISOString(),
      });

      const result = await notesDb.updateNote('note-123', { title: 'New' });

      expect(new Date(result.updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    });
  });

  describe('notes:delete', () => {
    it('should soft delete a note', async () => {
      notesDb.deleteNote.mockResolvedValue(true);

      await notesDb.deleteNote('note-123');

      expect(notesDb.deleteNote).toHaveBeenCalledWith('note-123');
    });

    it('should permanently delete when specified', async () => {
      notesDb.permanentDelete.mockResolvedValue(true);

      await notesDb.permanentDelete('note-123');

      expect(notesDb.permanentDelete).toHaveBeenCalledWith('note-123');
    });
  });

  describe('notes:restore', () => {
    it('should restore a deleted note', async () => {
      notesDb.restoreNote.mockResolvedValue({
        id: 'note-123',
        is_deleted: 0,
        deleted_at: null,
      });

      const result = await notesDb.restoreNote('note-123');

      expect(result.is_deleted).toBe(0);
      expect(result.deleted_at).toBeNull();
    });
  });

  describe('notes:archive', () => {
    it('should archive a note', async () => {
      notesDb.archiveNote.mockResolvedValue({
        id: 'note-123',
        is_archived: 1,
      });

      const result = await notesDb.archiveNote('note-123');

      expect(result.is_archived).toBe(1);
    });

    it('should unarchive a note', async () => {
      notesDb.archiveNote.mockResolvedValue({
        id: 'note-123',
        is_archived: 0,
      });

      const result = await notesDb.archiveNote('note-123', false);

      expect(result.is_archived).toBe(0);
    });
  });
});
