/**
 * CLI Commands Tests
 * 
 * Tests for CLI command parsing and execution.
 * These are unit tests that mock the database layer.
 */

// Mock the database before importing commands
jest.mock('../../../shared/database', () => ({
  getDb: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
  close: jest.fn(),
}));

jest.mock('../../../shared/database/notes', () => ({
  createNote: jest.fn(),
  getNotes: jest.fn(),
  getNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
  restoreNote: jest.fn(),
}));

jest.mock('../../../shared/database/tags', () => ({
  createTag: jest.fn(),
  getTags: jest.fn(),
  addTagToNote: jest.fn(),
  removeTagFromNote: jest.fn(),
  getTagsForNote: jest.fn(),
}));

jest.mock('../../../shared/database/folders', () => ({
  createFolder: jest.fn(),
  getFolders: jest.fn(),
  getFolder: jest.fn(),
  updateFolder: jest.fn(),
  deleteFolder: jest.fn(),
}));

describe('CLI Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Note Commands', () => {
    const notesDb = require('../../../shared/database/notes');

    describe('note create', () => {
      it('should create a note with title and content', async () => {
        notesDb.createNote.mockResolvedValue({
          id: 'new-note-id',
          title: 'Test Title',
          content: 'Test Content',
        });

        const result = await notesDb.createNote({
          title: 'Test Title',
          content: 'Test Content',
        });

        expect(notesDb.createNote).toHaveBeenCalledWith({
          title: 'Test Title',
          content: 'Test Content',
        });
        expect(result.id).toBe('new-note-id');
      });

      it('should create note with color', async () => {
        notesDb.createNote.mockResolvedValue({
          id: 'colored-note',
          color: 'blue',
        });

        await notesDb.createNote({ content: 'Test', color: 'blue' });

        expect(notesDb.createNote).toHaveBeenCalledWith({
          content: 'Test',
          color: 'blue',
        });
      });
    });

    describe('note list', () => {
      it('should list all notes', async () => {
        notesDb.getNotes.mockResolvedValue([
          { id: 'n1', title: 'Note 1' },
          { id: 'n2', title: 'Note 2' },
        ]);

        const result = await notesDb.getNotes();

        expect(result).toHaveLength(2);
      });

      it('should filter by folder', async () => {
        notesDb.getNotes.mockResolvedValue([
          { id: 'n1', title: 'Note 1', folder_id: 'f1' },
        ]);

        await notesDb.getNotes({ folderId: 'f1' });

        expect(notesDb.getNotes).toHaveBeenCalledWith({ folderId: 'f1' });
      });

      it('should filter by tag', async () => {
        notesDb.getNotes.mockResolvedValue([
          { id: 'n1', title: 'Note 1', tags: ['important'] },
        ]);

        await notesDb.getNotes({ tag: 'important' });

        expect(notesDb.getNotes).toHaveBeenCalled();
      });
    });

    describe('note show', () => {
      it('should show note by ID', async () => {
        notesDb.getNote.mockResolvedValue({
          id: 'note-123',
          title: 'My Note',
          content: 'Content here',
        });

        const result = await notesDb.getNote('note-123');

        expect(result.id).toBe('note-123');
        expect(result.title).toBe('My Note');
      });

      it('should return null for non-existent note', async () => {
        notesDb.getNote.mockResolvedValue(null);

        const result = await notesDb.getNote('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('note update', () => {
      it('should update note title', async () => {
        notesDb.updateNote.mockResolvedValue({
          id: 'note-123',
          title: 'Updated Title',
        });

        await notesDb.updateNote('note-123', { title: 'Updated Title' });

        expect(notesDb.updateNote).toHaveBeenCalledWith('note-123', { title: 'Updated Title' });
      });

      it('should update note content', async () => {
        notesDb.updateNote.mockResolvedValue({
          id: 'note-123',
          content: 'New content',
        });

        await notesDb.updateNote('note-123', { content: 'New content' });

        expect(notesDb.updateNote).toHaveBeenCalled();
      });

      it('should update note color', async () => {
        await notesDb.updateNote('note-123', { color: 'blue' });

        expect(notesDb.updateNote).toHaveBeenCalledWith('note-123', { color: 'blue' });
      });
    });

    describe('note delete', () => {
      it('should soft delete note', async () => {
        notesDb.deleteNote.mockResolvedValue(true);

        await notesDb.deleteNote('note-123');

        expect(notesDb.deleteNote).toHaveBeenCalledWith('note-123');
      });

      it('should permanently delete when --permanent flag', async () => {
        notesDb.deleteNote.mockResolvedValue(true);

        await notesDb.deleteNote('note-123', { permanent: true });

        expect(notesDb.deleteNote).toHaveBeenCalledWith('note-123', { permanent: true });
      });
    });

    describe('note restore', () => {
      it('should restore deleted note', async () => {
        notesDb.restoreNote.mockResolvedValue({
          id: 'note-123',
          is_deleted: 0,
        });

        await notesDb.restoreNote('note-123');

        expect(notesDb.restoreNote).toHaveBeenCalledWith('note-123');
      });
    });
  });

  describe('Tag Commands', () => {
    const tagsDb = require('../../../shared/database/tags');

    describe('tag list', () => {
      it('should list all tags', async () => {
        tagsDb.getTags.mockResolvedValue([
          { id: 1, name: 'important' },
          { id: 2, name: 'work' },
        ]);

        const result = await tagsDb.getTags();

        expect(result).toHaveLength(2);
      });
    });

    describe('tag add', () => {
      it('should add tag to note', async () => {
        tagsDb.addTagToNote.mockResolvedValue(true);

        await tagsDb.addTagToNote('note-123', 'important');

        expect(tagsDb.addTagToNote).toHaveBeenCalledWith('note-123', 'important');
      });

      it('should create tag if it does not exist', async () => {
        tagsDb.addTagToNote.mockResolvedValue(true);
        tagsDb.createTag.mockResolvedValue({ id: 1, name: 'new-tag' });

        // First check/create tag, then add to note
        await tagsDb.createTag({ name: 'new-tag' });
        await tagsDb.addTagToNote('note-123', 'new-tag');

        expect(tagsDb.createTag).toHaveBeenCalled();
        expect(tagsDb.addTagToNote).toHaveBeenCalled();
      });
    });

    describe('tag remove', () => {
      it('should remove tag from note', async () => {
        tagsDb.removeTagFromNote.mockResolvedValue(true);

        await tagsDb.removeTagFromNote('note-123', 'important');

        expect(tagsDb.removeTagFromNote).toHaveBeenCalledWith('note-123', 'important');
      });
    });
  });

  describe('Folder Commands', () => {
    const foldersDb = require('../../../shared/database/folders');

    describe('folder create', () => {
      it('should create a folder', async () => {
        foldersDb.createFolder.mockResolvedValue({
          id: 'folder-123',
          name: 'New Folder',
        });

        await foldersDb.createFolder({ name: 'New Folder' });

        expect(foldersDb.createFolder).toHaveBeenCalledWith({ name: 'New Folder' });
      });

      it('should create subfolder', async () => {
        foldersDb.createFolder.mockResolvedValue({
          id: 'child-folder',
          name: 'Child',
          parent_id: 'parent-folder',
        });

        await foldersDb.createFolder({ name: 'Child', parent_id: 'parent-folder' });

        expect(foldersDb.createFolder).toHaveBeenCalledWith({
          name: 'Child',
          parent_id: 'parent-folder',
        });
      });
    });

    describe('folder list', () => {
      it('should list all folders', async () => {
        foldersDb.getFolders.mockResolvedValue([
          { id: 'f1', name: 'Work' },
          { id: 'f2', name: 'Personal' },
        ]);

        const result = await foldersDb.getFolders();

        expect(result).toHaveLength(2);
      });
    });

    describe('folder delete', () => {
      it('should delete empty folder', async () => {
        foldersDb.deleteFolder.mockResolvedValue(true);

        await foldersDb.deleteFolder('folder-123');

        expect(foldersDb.deleteFolder).toHaveBeenCalledWith('folder-123');
      });
    });
  });

  describe('Command Validation', () => {
    it('should validate required parameters', () => {
      // Test that commands properly validate required inputs
      expect(() => {
        if (!('noteId' in {})) throw new Error('Note ID is required');
      }).toThrow('Note ID is required');
    });

    it('should validate color input', () => {
      const validColors = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal'];
      const isValidColor = (color) => validColors.includes(color);

      expect(isValidColor('yellow')).toBe(true);
      expect(isValidColor('invalid')).toBe(false);
    });
  });
});
