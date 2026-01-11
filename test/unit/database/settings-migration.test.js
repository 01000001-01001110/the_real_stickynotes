/**
 * Settings Migration Tests
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

// Mock settings schema
jest.mock('../../../shared/constants/settings', () => ({
  SETTINGS_SCHEMA_VERSION: 2,
  settingsSchema: {
    'whisper.enabled': { type: 'boolean', default: false },
    'whisper.modelSize': { type: 'string', default: 'base.en' },
    'whisper.language': { type: 'string', default: 'en' },
    'whisper.vadThreshold': { type: 'number', default: 0.5 },
    'whisper.vadMinSilence': { type: 'number', default: 0.25 },
    'whisper.vadMaxSpeech': { type: 'number', default: 5.0 },
    'whisper.numThreads': { type: 'number', default: 4 },
  },
}));

// Mock whisper constants
jest.mock('../../../shared/constants/whisper', () => ({
  MODEL_MIGRATION_MAP: {
    tiny: 'tiny.en',
    base: 'base.en',
    small: 'small.en',
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
      mockGet.mockReturnValue(null);

      const version = settingsMigration.getCurrentSchemaVersion();

      expect(version).toBe(0);
    });

    it('should return stored version', () => {
      mockGet.mockReturnValue({ value: '1' });

      const version = settingsMigration.getCurrentSchemaVersion();

      expect(version).toBe(1);
    });

    it('should return 0 on error', () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const version = settingsMigration.getCurrentSchemaVersion();

      expect(version).toBe(0);
    });
  });

  describe('setSchemaVersion', () => {
    it('should update schema version', () => {
      settingsMigration.setSchemaVersion(2);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          key: '_schemaVersion',
          value: '2',
        })
      );
    });
  });

  describe('runSettingsMigrations', () => {
    it('should not run migrations if already at target version', () => {
      mockGet.mockReturnValue({ value: '2' }); // Already at v2

      const result = settingsMigration.runSettingsMigrations();

      expect(result.migrated).toBe(false);
      expect(result.fromVersion).toBe(2);
      expect(result.toVersion).toBe(2);
    });

    it('should run migrations from v0 to v2', () => {
      mockGet
        .mockReturnValueOnce(null) // getCurrentSchemaVersion returns 0
        .mockReturnValueOnce({ value: 'base' }) // modelSize check
        .mockReturnValueOnce({ value: 'auto' }); // language check

      const result = settingsMigration.runSettingsMigrations();

      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(2);
    });

    it('should run migrations from v1 to v2', () => {
      mockGet
        .mockReturnValueOnce({ value: '1' }) // getCurrentSchemaVersion returns 1
        .mockReturnValueOnce({ value: 'small' }) // modelSize check
        .mockReturnValueOnce({ value: 'en' }); // language check

      const result = settingsMigration.runSettingsMigrations();

      expect(result.migrated).toBe(true);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
    });
  });

  describe('cleanupObsoleteSettings', () => {
    it('should return empty array when no obsolete settings', () => {
      mockAll.mockReturnValue([{ key: 'whisper.enabled' }, { key: 'whisper.modelSize' }]);

      const result = settingsMigration.cleanupObsoleteSettings();

      expect(result.length).toBe(0);
    });

    it('should identify obsolete settings', () => {
      mockAll.mockReturnValue([
        { key: 'whisper.enabled' },
        { key: 'whisper.chunkDuration' }, // obsolete
        { key: 'some.unknown.setting' }, // obsolete
      ]);

      const result = settingsMigration.cleanupObsoleteSettings();

      expect(result).toContain('whisper.chunkDuration');
      expect(result).toContain('some.unknown.setting');
    });
  });

  describe('SCHEMA_VERSION_KEY', () => {
    it('should export schema version key', () => {
      expect(settingsMigration.SCHEMA_VERSION_KEY).toBe('_schemaVersion');
    });
  });
});
