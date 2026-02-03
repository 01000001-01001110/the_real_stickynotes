/**
 * Backup/Restore CLI Command Tests
 * Tests for CLI backup and restore functionality
 */
const path = require('path');
const os = require('os');

// Mock fs before requiring commands
const mockFs = {
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  mkdirSync: jest.fn(),
};

jest.mock('fs', () => mockFs);

// Mock paths module
const mockPaths = {
  getBackupsPath: jest.fn(() => path.join(os.tmpdir(), 'test-backups')),
  getAppDataPath: jest.fn(() => path.join(os.tmpdir(), 'test-appdata')),
  getDatabasePath: jest.fn(() => path.join(os.tmpdir(), 'test.db')),
  getAttachmentsPath: jest.fn(() => path.join(os.tmpdir(), 'test-attachments')),
  ensureDir: jest.fn(),
};

jest.mock('../../../shared/utils/paths', () => mockPaths);

// Mock database modules
const mockNotes = {
  getNotes: jest.fn(),
  createNote: jest.fn(),
  getNoteById: jest.fn(),
};

const mockTags = {
  getTags: jest.fn(),
  getTagsForNote: jest.fn(),
};

const mockFolders = {
  getFolders: jest.fn(),
};

const mockSettings = {
  getAllSettings: jest.fn(),
  setSetting: jest.fn(),
};

jest.mock('../../../shared/database/notes', () => mockNotes);
jest.mock('../../../shared/database/tags', () => mockTags);
jest.mock('../../../shared/database/folders', () => mockFolders);
jest.mock('../../../shared/database/settings', () => mockSettings);
jest.mock('../../../shared/database/search', () => ({ searchNotes: jest.fn() }));
jest.mock('../../../shared/database/history', () => ({
  getNoteHistory: jest.fn(),
  revertToVersion: jest.fn(),
}));
jest.mock('../../../shared/database', () => ({
  getStats: jest.fn(),
  checkIntegrity: jest.fn(),
  vacuum: jest.fn(),
  getDatabase: jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: jest.fn(() => ({ changes: 1 })),
      get: jest.fn(),
    })),
    transaction: jest.fn((fn) => fn),
  })),
}));
jest.mock('../../../shared/constants/settings', () => ({
  settingsSchema: {},
  parseSettingValue: jest.fn((key, value) => value),
}));

// Mock package.json
jest.mock('../../../package.json', () => ({
  version: '1.0.0-test',
}));

const { executeCommand } = require('../../../electron/cli/commands');

describe('Backup/Restore CLI Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock returns
    mockNotes.getNotes.mockReturnValue([]);
    mockTags.getTags.mockReturnValue([]);
    mockTags.getTagsForNote.mockReturnValue([]);
    mockFolders.getFolders.mockReturnValue([]);
    mockSettings.getAllSettings.mockReturnValue({});
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
  });

  describe('backup command', () => {
    describe('backup create', () => {
      it('should create backup with default filename', async () => {
        mockNotes.getNotes.mockReturnValue([
          { id: 'note1', title: 'Test Note', content: 'Content' },
        ]);
        mockFolders.getFolders.mockReturnValue([{ id: 'folder1', name: 'Folder' }]);
        mockTags.getTags.mockReturnValue([{ id: 'tag1', name: 'tag' }]);
        mockTags.getTagsForNote.mockReturnValue([{ name: 'tag' }]);
        mockSettings.getAllSettings.mockReturnValue({ theme: 'dark' });

        const result = await executeCommand({
          command: 'backup',
          action: 'create',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Backup created');
        expect(result.output).toContain('Notes: 1');
        expect(result.output).toContain('Folders: 1');
        expect(result.output).toContain('Tags: 1');
        expect(mockFs.writeFileSync).toHaveBeenCalled();
        expect(mockPaths.ensureDir).toHaveBeenCalled();
      });

      it('should create backup at custom output path', async () => {
        mockNotes.getNotes.mockReturnValue([]);

        const customPath = '/custom/backup.json';
        const result = await executeCommand({
          command: 'backup',
          action: 'create',
          args: [],
          options: { output: customPath },
        });

        expect(result.exitCode).toBe(0);
        expect(mockFs.writeFileSync).toHaveBeenCalledWith(customPath, expect.any(String));
      });

      it('should include version and timestamp in backup', async () => {
        mockNotes.getNotes.mockReturnValue([]);

        await executeCommand({
          command: 'backup',
          action: 'create',
          args: [],
          options: {},
        });

        const writeCall = mockFs.writeFileSync.mock.calls[0];
        const backupContent = JSON.parse(writeCall[1]);

        expect(backupContent.version).toBe('1.0.0-test');
        expect(backupContent.created_at).toBeDefined();
        expect(new Date(backupContent.created_at)).toBeInstanceOf(Date);
      });

      it('should include tags with notes in backup', async () => {
        mockNotes.getNotes.mockReturnValue([{ id: 'note1', title: 'Test' }]);
        mockTags.getTagsForNote.mockReturnValue([{ name: 'important' }, { name: 'work' }]);

        await executeCommand({
          command: 'backup',
          action: 'create',
          args: [],
          options: {},
        });

        const writeCall = mockFs.writeFileSync.mock.calls[0];
        const backupContent = JSON.parse(writeCall[1]);

        expect(backupContent.notes[0].tags).toEqual(['important', 'work']);
      });

      it('should default to create action when no action specified', async () => {
        mockNotes.getNotes.mockReturnValue([]);

        const result = await executeCommand({
          command: 'backup',
          action: null,
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Backup created');
      });
    });

    describe('backup list', () => {
      it('should list available backups', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([
          'stickynotes-backup-2025-01-01.json',
          'stickynotes-backup-2025-01-02.json',
          'other-file.txt',
        ]);
        mockFs.statSync.mockReturnValue({ size: 1024 });
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            created_at: '2025-01-01T00:00:00Z',
            notes: [{ id: '1' }],
            folders: [],
            tags: [],
          })
        );

        const result = await executeCommand({
          command: 'backup',
          action: 'list',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('stickynotes-backup-2025-01-01.json');
        expect(result.output).toContain('stickynotes-backup-2025-01-02.json');
        expect(result.output).not.toContain('other-file.txt');
      });

      it('should show message when no backups found', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue([]);

        const result = await executeCommand({
          command: 'backup',
          action: 'list',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('No backups found');
      });

      it('should show backup metadata', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['stickynotes-backup-2025-01-01.json']);
        mockFs.statSync.mockReturnValue({ size: 2048 });
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            created_at: '2025-01-01T12:00:00Z',
            notes: [{ id: '1' }, { id: '2' }],
            folders: [{ id: 'f1' }],
            tags: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
          })
        );

        const result = await executeCommand({
          command: 'backup',
          action: 'list',
          args: [],
          options: {},
        });

        expect(result.output).toContain('Notes: 2');
        expect(result.output).toContain('Folders: 1');
        expect(result.output).toContain('Tags: 3');
        expect(result.output).toContain('2.0 KB');
      });

      it('should handle unreadable backup files gracefully', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['stickynotes-backup-2025-01-01.json']);
        mockFs.statSync.mockReturnValue({ size: 1024 });
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('Cannot read file');
        });

        const result = await executeCommand({
          command: 'backup',
          action: 'list',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Could not read metadata');
      });
    });

    describe('backup invalid action', () => {
      it('should return error for unknown action', async () => {
        const result = await executeCommand({
          command: 'backup',
          action: 'invalid',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Unknown backup action');
      });
    });
  });

  describe('restore command', () => {
    const validBackup = {
      version: '1.0.0',
      created_at: '2025-01-01T00:00:00Z',
      notes: [
        {
          id: 'note1',
          title: 'Test Note',
          content: 'Content',
          tags: ['tag1'],
        },
      ],
      folders: [
        {
          id: 'folder1',
          name: 'Test Folder',
          parent_id: null,
          position: 0,
        },
      ],
      tags: [
        {
          id: 'tag1',
          name: 'Tag One',
          color: '#ff0000',
        },
      ],
      settings: {
        theme: 'dark',
        'appearance.fontSize': 14,
      },
    };

    describe('restore without file', () => {
      it('should show error when no file provided', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: null,
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Backup file path required');
      });

      it('should list available backups when no file provided', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readdirSync.mockReturnValue(['stickynotes-backup-2025-01-01.json']);

        const result = await executeCommand({
          command: 'restore',
          action: null,
          args: [],
          options: {},
        });

        expect(result.output).toContain('Available backups');
      });
    });

    describe('restore with file', () => {
      beforeEach(() => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(validBackup));
      });

      it('should restore from valid backup file', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Restore complete');
      });

      it('should show backup info before restoring', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: {},
        });

        expect(result.output).toContain('Notes: 1');
        expect(result.output).toContain('Folders: 1');
        expect(result.output).toContain('Tags: 1');
      });

      it('should support dry-run option', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: { dryRun: true },
        });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('Dry run');
        expect(result.output).toContain('no changes');
      });

      it('should support skip-settings option', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: { skipSettings: true },
        });

        expect(result.exitCode).toBe(0);
        // Settings should not be restored
        expect(mockSettings.setSetting).not.toHaveBeenCalled();
      });

      it('should look in backups directory for filename', async () => {
        mockFs.existsSync.mockImplementation((p) => {
          // First call with just filename returns false
          // Second call with full path returns true
          return p.includes('test-backups');
        });

        const result = await executeCommand({
          command: 'restore',
          action: 'backup.json',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(0);
      });

      it('should return error for non-existent file', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await executeCommand({
          command: 'restore',
          action: '/nonexistent/backup.json',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('File not found');
      });

      it('should return error for invalid JSON', async () => {
        mockFs.readFileSync.mockReturnValue('not valid json');

        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Invalid backup file format');
      });

      it('should return error for backup without notes array', async () => {
        mockFs.readFileSync.mockReturnValue(JSON.stringify({ folders: [] }));

        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: {},
        });

        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('Invalid backup: missing notes array');
      });
    });

    describe('restore summary', () => {
      beforeEach(() => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(validBackup));
      });

      it('should show restore summary with counts', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: {},
        });

        expect(result.output).toContain('Restore summary');
        expect(result.output).toContain('Folders:');
        expect(result.output).toContain('Tags:');
        expect(result.output).toContain('Notes:');
      });

      it('should show skipped items for existing records', async () => {
        const result = await executeCommand({
          command: 'restore',
          action: '/path/to/backup.json',
          args: [],
          options: {},
        });

        expect(result.output).toContain('skipped');
      });
    });
  });
});
