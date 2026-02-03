/**
 * Unit tests for settings migration system
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const YAML = require('yaml');

// Mock dependencies before requiring migration module
const mockGetSetting = jest.fn();
const mockSetSetting = jest.fn();
const mockGetAllSettings = jest.fn();

jest.mock('../../../shared/database/settings', () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
  getAllSettings: mockGetAllSettings,
}));

const {
  migrateToYaml,
  isMigrationComplete,
  getMigrationDate,
  isRollbackPeriodExpired,
  shouldMigrateSetting,
  getMigratableSettings,
  getSqliteOnlySettings,
  validateMigratedConfig,
  flatToNested,
  MIGRATION_MARKER,
  MIGRATION_DATE_KEY,
  SCHEMA_VERSION_KEY,
} = require('../../../shared/config/migration');

describe('Settings Migration System', () => {
  let tempDir;
  let configPath;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stickynotes-test-'));
    configPath = path.join(tempDir, 'config.yaml');

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('shouldMigrateSetting', () => {
    test('should migrate general settings except startOnBoot', () => {
      expect(shouldMigrateSetting('general.startMinimized')).toBe(true);
      expect(shouldMigrateSetting('general.closeToTray')).toBe(true);
      expect(shouldMigrateSetting('general.startOnBoot')).toBe(false); // Handled by installer
    });

    test('should migrate appearance settings', () => {
      expect(shouldMigrateSetting('appearance.theme')).toBe(true);
      expect(shouldMigrateSetting('appearance.defaultNoteColor')).toBe(true);
    });

    test('should not migrate removed/legacy settings (whisper removed in v3)', () => {
      // These settings were removed in v3 and should never be migrated
      expect(shouldMigrateSetting('whisper.enabled')).toBe(false);
      expect(shouldMigrateSetting('whisper.modelSize')).toBe(false);
      expect(shouldMigrateSetting('setup.transcriptionOffered')).toBe(false);
    });

    test('should not migrate hints settings', () => {
      expect(shouldMigrateSetting('hints.noteCloseHintSeen')).toBe(false);
    });

    test('should migrate all user-editable categories', () => {
      const categories = [
        'general.autoSaveDelay',
        'appearance.theme',
        'newNote.position',
        'tray.singleClickAction',
        'shortcuts.globalNewNote',
        'editor.spellcheck',
        'reminders.enabled',
        'history.maxVersions',
        'advanced.hardwareAcceleration',
      ];

      categories.forEach((key) => {
        expect(shouldMigrateSetting(key)).toBe(true);
      });
    });
  });

  describe('isMigrationComplete', () => {
    test('should return true when migration marker exists', () => {
      mockGetSetting.mockReturnValue(true);

      expect(isMigrationComplete()).toBe(true);
      expect(mockGetSetting).toHaveBeenCalledWith(MIGRATION_MARKER);
    });

    test('should return false when migration marker does not exist', () => {
      mockGetSetting.mockReturnValue(undefined);

      expect(isMigrationComplete()).toBe(false);
    });

    test('should return false when database access fails', () => {
      mockGetSetting.mockImplementation(() => {
        throw new Error('Database not initialized');
      });

      expect(isMigrationComplete()).toBe(false);
    });
  });

  describe('getMigrationDate', () => {
    test('should return migration date when it exists', () => {
      const testDate = '2026-01-11T12:00:00.000Z';
      mockGetSetting.mockReturnValue(testDate);

      expect(getMigrationDate()).toBe(testDate);
      expect(mockGetSetting).toHaveBeenCalledWith(MIGRATION_DATE_KEY);
    });

    test('should return null when migration date does not exist', () => {
      mockGetSetting.mockReturnValue(null);

      expect(getMigrationDate()).toBeNull();
    });

    test('should return null on database error', () => {
      mockGetSetting.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(getMigrationDate()).toBeNull();
    });
  });

  describe('isRollbackPeriodExpired', () => {
    test('should return false when no migration date exists', () => {
      mockGetSetting.mockReturnValue(null);

      expect(isRollbackPeriodExpired()).toBe(false);
    });

    test('should return false when less than 30 days since migration', () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      mockGetSetting.mockReturnValue(recentDate);

      expect(isRollbackPeriodExpired()).toBe(false);
    });

    test('should return true when more than 30 days since migration', () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago
      mockGetSetting.mockReturnValue(oldDate);

      expect(isRollbackPeriodExpired()).toBe(true);
    });

    test('should return true when exactly 31 days since migration', () => {
      const exactDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      mockGetSetting.mockReturnValue(exactDate);

      expect(isRollbackPeriodExpired()).toBe(true);
    });
  });

  describe('flatToNested', () => {
    test('should convert flat keys to nested structure', () => {
      const flat = {
        'general.startMinimized': true,
        'general.closeToTray': false,
        'appearance.theme': 'dark',
      };

      const nested = flatToNested(flat);

      expect(nested).toEqual({
        general: {
          startMinimized: true,
          closeToTray: false,
        },
        appearance: {
          theme: 'dark',
        },
      });
    });

    test('should handle single-level keys', () => {
      const flat = {
        schemaVersion: 1,
      };

      const nested = flatToNested(flat);

      expect(nested).toEqual({
        schemaVersion: 1,
      });
    });

    test('should handle deep nesting', () => {
      const flat = {
        'level1.level2.level3.value': 42,
      };

      const nested = flatToNested(flat);

      expect(nested).toEqual({
        level1: {
          level2: {
            level3: {
              value: 42,
            },
          },
        },
      });
    });

    test('should handle empty object', () => {
      const flat = {};
      const nested = flatToNested(flat);

      expect(nested).toEqual({});
    });
  });

  describe('getMigratableSettings', () => {
    test('should return list of migratable setting keys', () => {
      const migratable = getMigratableSettings();

      // Should include user-editable settings
      expect(migratable).toContain('general.startMinimized');
      expect(migratable).toContain('appearance.theme');
      expect(migratable).toContain('editor.spellcheck');

      // Should not include SQLite-only settings
      expect(migratable).not.toContain('whisper.enabled');
      expect(migratable).not.toContain('setup.transcriptionOffered');
      expect(migratable).not.toContain('hints.noteCloseHintSeen');

      // Should not include installer-managed settings
      expect(migratable).not.toContain('general.startOnBoot');
    });
  });

  describe('getSqliteOnlySettings', () => {
    test('should return list of SQLite-only setting keys', () => {
      const sqliteOnly = getSqliteOnlySettings();

      // Should include hints settings
      expect(sqliteOnly).toContain('hints.noteCloseHintSeen');

      // Should include installer-managed settings
      expect(sqliteOnly).toContain('general.startOnBoot');

      // Should not include user-editable settings
      expect(sqliteOnly).not.toContain('general.startMinimized');
      expect(sqliteOnly).not.toContain('appearance.theme');

      // Whisper and setup settings were removed in v3
      expect(sqliteOnly).not.toContain('whisper.enabled');
      expect(sqliteOnly).not.toContain('setup.transcriptionOffered');
    });
  });

  describe('validateMigratedConfig', () => {
    test('should validate complete config', () => {
      const migratable = getMigratableSettings();
      const yamlConfig = {};

      // Build valid nested config
      migratable.forEach((key) => {
        const parts = key.split('.');
        let obj = yamlConfig;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = 'value';
      });

      const validation = validateMigratedConfig(yamlConfig);

      expect(validation.valid).toBe(true);
      expect(validation.missing).toEqual([]);
      expect(validation.unexpected).toEqual([]);
    });

    test('should detect missing settings', () => {
      const yamlConfig = {
        general: {
          startMinimized: true,
        },
        // Missing all other categories
      };

      const validation = validateMigratedConfig(yamlConfig);

      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
    });

    test('should ignore schemaVersion in validation', () => {
      const migratable = getMigratableSettings();
      const yamlConfig = { schemaVersion: 3 };

      // Build valid nested config
      migratable.forEach((key) => {
        const parts = key.split('.');
        let obj = yamlConfig;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = 'value';
      });

      const validation = validateMigratedConfig(yamlConfig);

      expect(validation.valid).toBe(true);
      expect(validation.unexpected).not.toContain('schemaVersion');
    });
  });

  describe('migrateToYaml', () => {
    test('should successfully migrate settings to YAML', () => {
      const mockSettings = {
        'general.startMinimized': true,
        'general.closeToTray': false,
        'appearance.theme': 'dark',
        'whisper.enabled': true, // Legacy setting, removed in v3 - should be skipped
        'setup.transcriptionOffered': true, // Legacy setting, removed in v3 - should be skipped
      };

      mockGetAllSettings.mockReturnValue(mockSettings);

      const result = migrateToYaml(configPath);

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(3); // Only user-editable settings
      expect(result.skipped).toBe(2); // whisper and setup settings

      // Verify file was created
      expect(fs.existsSync(configPath)).toBe(true);

      // Verify content
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = YAML.parse(content);

      expect(parsed.general.startMinimized).toBe(true);
      expect(parsed.general.closeToTray).toBe(false);
      expect(parsed.appearance.theme).toBe('dark');
      expect(parsed.whisper).toBeUndefined();
      expect(parsed.setup).toBeUndefined();

      // Verify migration markers were set
      expect(mockSetSetting).toHaveBeenCalledWith(MIGRATION_MARKER, true);
      expect(mockSetSetting).toHaveBeenCalledWith(MIGRATION_DATE_KEY, expect.any(String));
      expect(mockSetSetting).toHaveBeenCalledWith(SCHEMA_VERSION_KEY, expect.any(Number));
    });

    test('should create backup if config already exists', () => {
      // Create existing config file
      const existingContent = 'schemaVersion: 1\ngeneral:\n  test: old';
      fs.writeFileSync(configPath, existingContent, 'utf8');

      mockGetAllSettings.mockReturnValue({
        'general.startMinimized': true,
      });

      const result = migrateToYaml(configPath);

      expect(result.success).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors[0]).toMatch(/backed up/i);

      // Verify backup was created
      const backupFiles = fs
        .readdirSync(tempDir)
        .filter((f) => f.startsWith('config.yaml.backup-'));
      expect(backupFiles.length).toBe(1);
    });

    test('should fail with invalid config path', () => {
      const result = migrateToYaml('');

      expect(result.success).toBe(false);
      expect(result.migrated).toBe(0);
      expect(result.errors).toContain('Migration failed: Invalid config path provided');
    });

    test('should fail if config directory does not exist', () => {
      const invalidPath = path.join(tempDir, 'nonexistent', 'config.yaml');

      const result = migrateToYaml(invalidPath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/directory does not exist/i);
    });

    test('should fail if database read fails', () => {
      mockGetAllSettings.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = migrateToYaml(configPath);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/Failed to read settings from SQLite/i);
    });

    test('should fail if file write fails', () => {
      mockGetAllSettings.mockReturnValue({
        'general.startMinimized': true,
      });

      // Mock fs.writeFileSync to throw error
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = migrateToYaml(configPath);

      // Restore original function
      fs.writeFileSync = originalWriteFileSync;

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/Migration failed/i);
    });

    test('should handle unknown settings gracefully', () => {
      mockGetAllSettings.mockReturnValue({
        'general.startMinimized': true,
        'general.unknownSetting': 'value', // Unknown setting in known category
      });

      const result = migrateToYaml(configPath);

      expect(result.success).toBe(true);
      expect(result.errors).toBeDefined();
      expect(result.errors.some((e) => e.includes('Unknown setting skipped'))).toBe(true);
    });

    test('should include schema version in YAML', () => {
      mockGetAllSettings.mockReturnValue({
        'general.startMinimized': true,
      });

      const result = migrateToYaml(configPath);

      expect(result.success).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = YAML.parse(content);

      expect(parsed.schemaVersion).toBeDefined();
      expect(typeof parsed.schemaVersion).toBe('number');
    });

    test('should generate YAML with comments', () => {
      mockGetAllSettings.mockReturnValue({
        'general.startMinimized': true,
        'appearance.theme': 'dark',
      });

      const result = migrateToYaml(configPath);

      expect(result.success).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');

      // Check for header comment
      expect(content).toMatch(/StickyNotes Configuration/);
      expect(content).toMatch(/Schema Version/);

      // Check for footer comment (v3+ only has hints, not whisper/setup)
      expect(content).toMatch(/hints\.\*/);
    });
  });

  describe('Constants', () => {
    test('should export migration marker constants', () => {
      expect(MIGRATION_MARKER).toBe('settings_migrated_to_yaml');
      expect(MIGRATION_DATE_KEY).toBe('settings_migration_date');
      expect(SCHEMA_VERSION_KEY).toBe('config_schema_version');
    });
  });
});
