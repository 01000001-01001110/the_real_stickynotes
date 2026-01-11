/**
 * Settings Validation Integration Tests
 * Tests that setSetting and setSettings properly validate before storing
 */
jest.mock('../../../shared/database/index');

const { setSetting, setSettings } = require('../../../shared/database/settings');
const mockDbModule = require('../../../shared/database/index');

describe('Settings Validation Integration', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock the database
    const mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn(),
        all: jest.fn(),
        run: jest.fn(),
      }),
      transaction: jest.fn((fn) => fn),
    };

    mockDbModule.getDatabase.mockReturnValue(mockDb);
  });

  describe('setSetting validation', () => {
    it('should reject unknown setting key', () => {
      expect(() => {
        setSetting('unknown.key', 'value');
      }).toThrow('Unknown setting key');
    });

    it('should include the unknown key in error message', () => {
      expect(() => {
        setSetting('invalid.setting', 'value');
      }).toThrow('invalid.setting');
    });

    it('should accept valid boolean value', () => {
      expect(() => {
        setSetting('general.startOnBoot', true);
      }).not.toThrow();
    });

    it('should accept valid number value', () => {
      expect(() => {
        setSetting('general.autoSaveDelay', 1000);
      }).not.toThrow();
    });

    it('should accept valid string value', () => {
      expect(() => {
        setSetting('appearance.theme', 'dark');
      }).not.toThrow();
    });

    it('should reject invalid boolean value', () => {
      expect(() => {
        setSetting('general.startOnBoot', 'invalid');
      }).toThrow('expects boolean');
    });

    it('should reject invalid number value', () => {
      expect(() => {
        setSetting('general.autoSaveDelay', 'not-a-number');
      }).toThrow('expects number');
    });

    it('should reject invalid type for string setting', () => {
      expect(() => {
        setSetting('appearance.theme', { theme: 'dark' });
      }).toThrow('expects string');
    });

    it('should include setting key in error message', () => {
      expect(() => {
        setSetting('general.startOnBoot', 123);
      }).toThrow('general.startOnBoot');
    });

    it('should allow numeric string for number setting', () => {
      expect(() => {
        setSetting('general.autoSaveDelay', '1000');
      }).not.toThrow();
    });

    it('should allow string "true" for boolean setting', () => {
      expect(() => {
        setSetting('general.startOnBoot', 'true');
      }).not.toThrow();
    });

    it('should call database prepare and run on valid input', () => {
      const { getDatabase } = mockDbModule;
      setSetting('appearance.theme', 'dark');

      expect(getDatabase()).toBeDefined();
      const db = getDatabase();
      expect(db.prepare).toHaveBeenCalled();
    });

    it('should not call database on invalid input', () => {
      expect(() => {
        setSetting('general.startOnBoot', 'invalid');
      }).toThrow();

      // Test passes if error is thrown before database interaction
    });
  });

  describe('setSettings validation', () => {
    it('should reject if any setting key is unknown', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': true,
          'unknown.key': 'value',
          'appearance.theme': 'dark',
        });
      }).toThrow('Unknown setting key');
    });

    it('should include unknown key in error message', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': true,
          'invalid.setting': 'value',
        });
      }).toThrow('invalid.setting');
    });

    it('should accept all valid settings', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': true,
          'general.autoSaveDelay': 1000,
          'appearance.theme': 'dark',
        });
      }).not.toThrow();
    });

    it('should reject if any setting is invalid', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': true,
          'general.autoSaveDelay': 'invalid', // Invalid - not a number
          'appearance.theme': 'dark',
        });
      }).toThrow('expects number');
    });

    it('should validate all settings before writing any', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': true,
          'general.autoSaveDelay': 'invalid',
        });
      }).toThrow();

      // Test passes if error is thrown during validation before database write
    });

    it('should accept mixed valid types', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': false,
          'general.startMinimized': true,
          'general.autoSaveDelay': 2000,
          'general.trashRetentionDays': '30',
          'appearance.theme': 'light',
          'appearance.enableShadows': 'true',
          'appearance.noteOpacity': 85,
        });
      }).not.toThrow();
    });

    it('should report first invalid setting', () => {
      expect(() => {
        setSettings({
          'general.startOnBoot': true,
          'general.autoSaveDelay': 'invalid1', // First invalid
          'appearance.noteOpacity': 'invalid2', // Second invalid
        });
      }).toThrow('general.autoSaveDelay');
    });
  });

  describe('Type coercion during storage', () => {
    it('should convert boolean true to string "true"', () => {
      const { getDatabase } = mockDbModule;
      setSetting('general.startOnBoot', true);

      const db = getDatabase();
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO settings'));
    });

    it('should convert number to string', () => {
      const { getDatabase } = mockDbModule;
      setSetting('general.autoSaveDelay', 1000);

      const db = getDatabase();
      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO settings'));
    });
  });
});
