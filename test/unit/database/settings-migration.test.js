/**
 * Settings Migration Tests
 *
 * Tests for database settings migration (v2 → v3: Remove voice transcription)
 */

// Mock the database module
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockDb = {
  prepare: mockPrepare,
  exec: mockExec,
};

jest.mock('../../../shared/database/index', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

// Mock settings schema (v3 - no whisper settings)
jest.mock('../../../shared/constants/settings', () => ({
  SETTINGS_SCHEMA_VERSION: 3,
  settingsSchema: {
    'general.startMinimized': { type: 'boolean', default: false },
    'general.closeToTray': { type: 'boolean', default: true },
    'appearance.theme': { type: 'string', default: 'system' },
    'appearance.defaultNoteColor': { type: 'string', default: 'yellow' },
  },
}));

const settingsMigration = require('../../../shared/database/settings-migration');

describe('Settings Migration', () => {
  let mockGet;
  let mockAll;
  let mockRun;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock prepared statement methods
    mockGet = jest.fn();
    mockAll = jest.fn();
    mockRun = jest.fn();

    mockPrepare.mockReturnValue({
      get: mockGet,
      all: mockAll,
      run: mockRun,
    });
  });

  describe('getCurrentSchemaVersion', () => {
    it('should return 0 when no version is stored', () => {
      // First call runSettingsMigrations to set _db
      mockGet.mockReturnValue({ value: '3' });
      settingsMigration.runSettingsMigrations(mockDb);

      mockGet.mockReturnValue(null);
      const version = settingsMigration.getCurrentSchemaVersion();

      expect(version).toBe(0);
    });

    it('should return stored version', () => {
      // First call runSettingsMigrations to set _db
      mockGet.mockReturnValue({ value: '3' });
      settingsMigration.runSettingsMigrations(mockDb);

      mockGet.mockReturnValue({ value: '2' });
      const version = settingsMigration.getCurrentSchemaVersion();

      expect(version).toBe(2);
    });

    it('should return 0 on error', () => {
      // First call runSettingsMigrations to set _db
      mockGet.mockReturnValue({ value: '3' });
      settingsMigration.runSettingsMigrations(mockDb);

      mockPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const version = settingsMigration.getCurrentSchemaVersion();

      expect(version).toBe(0);
    });
  });

  describe('setSchemaVersion', () => {
    it('should update schema version', () => {
      // First call runSettingsMigrations to set _db
      mockGet.mockReturnValue({ value: '3' });
      settingsMigration.runSettingsMigrations(mockDb);

      settingsMigration.setSchemaVersion(3);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          key: '_schemaVersion',
          value: '3',
        })
      );
    });
  });

  describe('runSettingsMigrations', () => {
    it('should not run migrations if already at target version', () => {
      mockGet.mockReturnValue({ value: '3' }); // Already at v3

      const result = settingsMigration.runSettingsMigrations(mockDb);

      expect(result.migrated).toBe(false);
      expect(result.fromVersion).toBe(3);
      expect(result.toVersion).toBe(3);
    });

    it('should run migration from v2 to v3 (remove whisper settings)', () => {
      mockGet.mockReturnValueOnce({ value: '2' }); // getCurrentSchemaVersion returns 2
      mockRun.mockReturnValue({ changes: 5 }); // Simulated deleted rows

      const result = settingsMigration.runSettingsMigrations(mockDb);

      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(2);
      expect(result.toVersion).toBe(3);
    });

    it('should run migrations from v0 to v3', () => {
      mockGet.mockReturnValueOnce(null); // getCurrentSchemaVersion returns 0
      mockRun.mockReturnValue({ changes: 0 }); // No whisper settings to delete

      const result = settingsMigration.runSettingsMigrations(mockDb);

      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(3);
    });

    it('should delete whisper and setup settings during v3 migration', () => {
      mockGet.mockReturnValueOnce({ value: '2' }); // Start at v2
      mockRun.mockReturnValue({ changes: 8 }); // 8 whisper/setup settings deleted

      settingsMigration.runSettingsMigrations(mockDb);

      // Verify DELETE query was called for whisper and setup settings
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining(
          "DELETE FROM settings WHERE key LIKE 'whisper.%' OR key LIKE 'setup.%'"
        )
      );
    });
  });

  describe('cleanupObsoleteSettings', () => {
    it('should return empty array when no obsolete settings', () => {
      // First call runSettingsMigrations to set _db
      mockGet.mockReturnValue({ value: '3' });
      settingsMigration.runSettingsMigrations(mockDb);

      mockAll.mockReturnValue([{ key: 'general.startMinimized' }, { key: 'appearance.theme' }]);

      const result = settingsMigration.cleanupObsoleteSettings(mockDb);

      expect(result.length).toBe(0);
    });

    it('should identify obsolete settings', () => {
      // First call runSettingsMigrations to set _db
      mockGet.mockReturnValue({ value: '3' });
      settingsMigration.runSettingsMigrations(mockDb);

      mockAll.mockReturnValue([
        { key: 'general.startMinimized' },
        { key: 'some.unknown.setting' }, // obsolete
        { key: 'legacy.oldFeature' }, // obsolete
      ]);

      const result = settingsMigration.cleanupObsoleteSettings(mockDb);

      expect(result).toContain('some.unknown.setting');
      expect(result).toContain('legacy.oldFeature');
    });
  });

  describe('SCHEMA_VERSION_KEY', () => {
    it('should export schema version key', () => {
      expect(settingsMigration.SCHEMA_VERSION_KEY).toBe('_schemaVersion');
    });
  });
});
