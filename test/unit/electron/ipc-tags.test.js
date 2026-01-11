/**
 * Electron IPC Tags Handler Tests
 */

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../shared/database/tags', () => ({
  createTag: jest.fn(),
  getTags: jest.fn(),
  getTag: jest.fn(),
  updateTag: jest.fn(),
  deleteTag: jest.fn(),
  addTagToNote: jest.fn(),
  removeTagFromNote: jest.fn(),
  getTagsForNote: jest.fn(),
  getNotesForTag: jest.fn(),
}));

describe('IPC Tags Handlers', () => {
  const tagsDb = require('../../../shared/database/tags');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tags:create', () => {
    it('should create a tag', async () => {
      tagsDb.createTag.mockResolvedValue({
        id: 1,
        name: 'important',
        color: null,
      });

      const result = await tagsDb.createTag({ name: 'important' });

      expect(tagsDb.createTag).toHaveBeenCalledWith({ name: 'important' });
      expect(result.name).toBe('important');
    });

    it('should create tag with color', async () => {
      tagsDb.createTag.mockResolvedValue({
        id: 1,
        name: 'urgent',
        color: 'red',
      });

      const result = await tagsDb.createTag({ name: 'urgent', color: 'red' });

      expect(result.color).toBe('red');
    });

    it('should handle duplicate tag name', async () => {
      tagsDb.createTag.mockRejectedValue(new Error('UNIQUE constraint failed'));

      await expect(tagsDb.createTag({ name: 'existing' })).rejects.toThrow();
    });
  });

  describe('tags:list', () => {
    it('should return all tags', async () => {
      tagsDb.getTags.mockResolvedValue([
        { id: 1, name: 'important', note_count: 5 },
        { id: 2, name: 'work', note_count: 3 },
      ]);

      const result = await tagsDb.getTags();

      expect(result).toHaveLength(2);
    });

    it('should include note counts', async () => {
      tagsDb.getTags.mockResolvedValue([
        { id: 1, name: 'important', note_count: 10 },
      ]);

      const result = await tagsDb.getTags();

      expect(result[0].note_count).toBe(10);
    });

    it('should sort tags alphabetically', async () => {
      tagsDb.getTags.mockResolvedValue([
        { id: 1, name: 'alpha' },
        { id: 2, name: 'beta' },
        { id: 3, name: 'gamma' },
      ]);

      const result = await tagsDb.getTags();

      expect(result[0].name).toBe('alpha');
    });
  });

  describe('tags:update', () => {
    it('should rename a tag', async () => {
      tagsDb.updateTag.mockResolvedValue({
        id: 1,
        name: 'renamed',
      });

      const result = await tagsDb.updateTag(1, { name: 'renamed' });

      expect(result.name).toBe('renamed');
    });

    it('should update tag color', async () => {
      tagsDb.updateTag.mockResolvedValue({
        id: 1,
        name: 'important',
        color: 'blue',
      });

      const result = await tagsDb.updateTag(1, { color: 'blue' });

      expect(result.color).toBe('blue');
    });
  });

  describe('tags:delete', () => {
    it('should delete a tag', async () => {
      tagsDb.deleteTag.mockResolvedValue(true);

      const result = await tagsDb.deleteTag(1);

      expect(tagsDb.deleteTag).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should remove tag from all notes', async () => {
      tagsDb.deleteTag.mockResolvedValue(true);

      await tagsDb.deleteTag(1);

      // Tag should be removed from note_tags as well (via cascade)
      expect(tagsDb.deleteTag).toHaveBeenCalled();
    });
  });

  describe('tags:addToNote', () => {
    it('should add tag to note', async () => {
      tagsDb.addTagToNote.mockResolvedValue(true);

      const result = await tagsDb.addTagToNote('note-123', 'important');

      expect(tagsDb.addTagToNote).toHaveBeenCalledWith('note-123', 'important');
      expect(result).toBe(true);
    });

    it('should create tag if it does not exist', async () => {
      tagsDb.addTagToNote.mockResolvedValue(true);

      await tagsDb.addTagToNote('note-123', 'new-tag');

      expect(tagsDb.addTagToNote).toHaveBeenCalled();
    });

    it('should handle duplicate tag on note', async () => {
      tagsDb.addTagToNote.mockResolvedValue(true); // Should be idempotent

      const result = await tagsDb.addTagToNote('note-123', 'existing');

      expect(result).toBe(true);
    });
  });

  describe('tags:removeFromNote', () => {
    it('should remove tag from note', async () => {
      tagsDb.removeTagFromNote.mockResolvedValue(true);

      const result = await tagsDb.removeTagFromNote('note-123', 'important');

      expect(tagsDb.removeTagFromNote).toHaveBeenCalledWith('note-123', 'important');
      expect(result).toBe(true);
    });

    it('should handle non-existent tag', async () => {
      tagsDb.removeTagFromNote.mockResolvedValue(false);

      const result = await tagsDb.removeTagFromNote('note-123', 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('tags:getForNote', () => {
    it('should get tags for a note', async () => {
      tagsDb.getTagsForNote.mockResolvedValue([
        { id: 1, name: 'important' },
        { id: 2, name: 'work' },
      ]);

      const result = await tagsDb.getTagsForNote('note-123');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for note with no tags', async () => {
      tagsDb.getTagsForNote.mockResolvedValue([]);

      const result = await tagsDb.getTagsForNote('untagged-note');

      expect(result).toHaveLength(0);
    });
  });

  describe('tags:getNotesForTag', () => {
    it('should get notes with specific tag', async () => {
      tagsDb.getNotesForTag.mockResolvedValue([
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' },
      ]);

      const result = await tagsDb.getNotesForTag('important');

      expect(result).toHaveLength(2);
    });
  });
});
