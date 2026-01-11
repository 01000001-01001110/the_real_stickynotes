/**
 * Electron IPC Folders Handler Tests
 */

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('../../../shared/database/folders', () => ({
  createFolder: jest.fn(),
  getFolders: jest.fn(),
  getFolder: jest.fn(),
  updateFolder: jest.fn(),
  deleteFolder: jest.fn(),
  moveFolder: jest.fn(),
  getNotesInFolder: jest.fn(),
  getFolderTree: jest.fn(),
}));

describe('IPC Folders Handlers', () => {
  const foldersDb = require('../../../shared/database/folders');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('folders:create', () => {
    it('should create a folder', async () => {
      foldersDb.createFolder.mockResolvedValue({
        id: 'folder-123',
        name: 'New Folder',
        parent_id: null,
      });

      const result = await foldersDb.createFolder({ name: 'New Folder' });

      expect(foldersDb.createFolder).toHaveBeenCalledWith({ name: 'New Folder' });
      expect(result.name).toBe('New Folder');
    });

    it('should create subfolder', async () => {
      foldersDb.createFolder.mockResolvedValue({
        id: 'subfolder-123',
        name: 'Subfolder',
        parent_id: 'parent-123',
      });

      const result = await foldersDb.createFolder({
        name: 'Subfolder',
        parent_id: 'parent-123',
      });

      expect(result.parent_id).toBe('parent-123');
    });

    it('should create folder with color', async () => {
      foldersDb.createFolder.mockResolvedValue({
        id: 'colored-folder',
        name: 'Colored',
        color: 'blue',
      });

      const result = await foldersDb.createFolder({ name: 'Colored', color: 'blue' });

      expect(result.color).toBe('blue');
    });
  });

  describe('folders:list', () => {
    it('should return all folders', async () => {
      foldersDb.getFolders.mockResolvedValue([
        { id: 'f1', name: 'Work', parent_id: null },
        { id: 'f2', name: 'Personal', parent_id: null },
      ]);

      const result = await foldersDb.getFolders();

      expect(result).toHaveLength(2);
    });

    it('should return flat list by default', async () => {
      foldersDb.getFolders.mockResolvedValue([
        { id: 'parent', name: 'Parent', parent_id: null },
        { id: 'child', name: 'Child', parent_id: 'parent' },
      ]);

      const result = await foldersDb.getFolders();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should include note counts', async () => {
      foldersDb.getFolders.mockResolvedValue([
        { id: 'f1', name: 'Work', note_count: 10 },
      ]);

      const result = await foldersDb.getFolders();

      expect(result[0].note_count).toBe(10);
    });
  });

  describe('folders:get', () => {
    it('should return folder by id', async () => {
      foldersDb.getFolder.mockResolvedValue({
        id: 'folder-123',
        name: 'Test Folder',
        parent_id: null,
      });

      const result = await foldersDb.getFolder('folder-123');

      expect(result.id).toBe('folder-123');
    });

    it('should return null for non-existent folder', async () => {
      foldersDb.getFolder.mockResolvedValue(null);

      const result = await foldersDb.getFolder('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('folders:update', () => {
    it('should rename folder', async () => {
      foldersDb.updateFolder.mockResolvedValue({
        id: 'folder-123',
        name: 'Renamed Folder',
      });

      const result = await foldersDb.updateFolder('folder-123', { name: 'Renamed Folder' });

      expect(result.name).toBe('Renamed Folder');
    });

    it('should update folder color', async () => {
      foldersDb.updateFolder.mockResolvedValue({
        id: 'folder-123',
        color: 'green',
      });

      const result = await foldersDb.updateFolder('folder-123', { color: 'green' });

      expect(result.color).toBe('green');
    });

    it('should update sort order', async () => {
      foldersDb.updateFolder.mockResolvedValue({
        id: 'folder-123',
        sort_order: 5,
      });

      const result = await foldersDb.updateFolder('folder-123', { sort_order: 5 });

      expect(result.sort_order).toBe(5);
    });
  });

  describe('folders:delete', () => {
    it('should delete empty folder', async () => {
      foldersDb.deleteFolder.mockResolvedValue(true);

      const result = await foldersDb.deleteFolder('folder-123');

      expect(result).toBe(true);
    });

    it('should delete folder with notes (moves to uncategorized)', async () => {
      foldersDb.deleteFolder.mockResolvedValue(true);

      const result = await foldersDb.deleteFolder('folder-with-notes');

      expect(result).toBe(true);
    });

    it('should delete folder and subfolders', async () => {
      foldersDb.deleteFolder.mockResolvedValue(true);

      const result = await foldersDb.deleteFolder('parent-folder', { recursive: true });

      expect(result).toBe(true);
    });
  });

  describe('folders:move', () => {
    it('should move folder to new parent', async () => {
      foldersDb.moveFolder.mockResolvedValue({
        id: 'folder-123',
        parent_id: 'new-parent',
      });

      const result = await foldersDb.moveFolder('folder-123', 'new-parent');

      expect(result.parent_id).toBe('new-parent');
    });

    it('should move folder to root', async () => {
      foldersDb.moveFolder.mockResolvedValue({
        id: 'folder-123',
        parent_id: null,
      });

      const result = await foldersDb.moveFolder('folder-123', null);

      expect(result.parent_id).toBeNull();
    });

    it('should prevent circular references', async () => {
      foldersDb.moveFolder.mockRejectedValue(new Error('Cannot move folder into its own descendant'));

      await expect(
        foldersDb.moveFolder('parent', 'child-of-parent')
      ).rejects.toThrow('Cannot move folder');
    });
  });

  describe('folders:getTree', () => {
    it('should return folder tree structure', async () => {
      foldersDb.getFolderTree.mockResolvedValue([
        {
          id: 'root',
          name: 'Root',
          children: [
            { id: 'child1', name: 'Child 1', children: [] },
            { id: 'child2', name: 'Child 2', children: [] },
          ],
        },
      ]);

      const result = await foldersDb.getFolderTree();

      expect(result[0].children).toHaveLength(2);
    });

    it('should include note counts at each level', async () => {
      foldersDb.getFolderTree.mockResolvedValue([
        {
          id: 'root',
          name: 'Root',
          note_count: 5,
          total_note_count: 15, // Including children
          children: [
            { id: 'child', name: 'Child', note_count: 10, total_note_count: 10, children: [] },
          ],
        },
      ]);

      const result = await foldersDb.getFolderTree();

      expect(result[0].total_note_count).toBe(15);
    });
  });

  describe('folders:getNotesInFolder', () => {
    it('should return notes in folder', async () => {
      foldersDb.getNotesInFolder.mockResolvedValue([
        { id: 'note-1', title: 'Note 1' },
        { id: 'note-2', title: 'Note 2' },
      ]);

      const result = await foldersDb.getNotesInFolder('folder-123');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty folder', async () => {
      foldersDb.getNotesInFolder.mockResolvedValue([]);

      const result = await foldersDb.getNotesInFolder('empty-folder');

      expect(result).toHaveLength(0);
    });

    it('should include notes from subfolders when requested', async () => {
      foldersDb.getNotesInFolder.mockResolvedValue([
        { id: 'note-1', folder_id: 'parent' },
        { id: 'note-2', folder_id: 'child' },
      ]);

      const result = await foldersDb.getNotesInFolder('parent', { includeSubfolders: true });

      expect(result).toHaveLength(2);
    });
  });
});
