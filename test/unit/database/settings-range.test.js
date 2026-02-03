/**
 * Settings Range Validation Tests
 * Tests that validateSettingRange properly validates numeric ranges
 */
jest.mock('../../../shared/database/index');

const { validateSettingRange, setSetting } = require('../../../shared/database/settings');
const mockDbModule = require('../../../shared/database/index');

describe('Settings Range Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  describe('validateSettingRange function', () => {
    it('should allow values within range', () => {
      const result = validateSettingRange('appearance.noteOpacity', 75);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow minimum boundary value', () => {
      const result = validateSettingRange('appearance.noteOpacity', 50);
      expect(result.valid).toBe(true);
    });

    it('should allow maximum boundary value', () => {
      const result = validateSettingRange('appearance.noteOpacity', 100);
      expect(result.valid).toBe(true);
    });

    it('should reject value below minimum', () => {
      const result = validateSettingRange('appearance.noteOpacity', 49);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least 50');
    });

    it('should reject value above maximum', () => {
      const result = validateSettingRange('appearance.noteOpacity', 101);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 100');
    });

    it('should include setting key in error message', () => {
      const result = validateSettingRange('appearance.noteOpacity', 150);
      expect(result.error).toContain('appearance.noteOpacity');
    });

    it('should handle string number values', () => {
      const result = validateSettingRange('appearance.noteOpacity', '75');
      expect(result.valid).toBe(true);
    });

    it('should skip validation for non-number settings', () => {
      const result = validateSettingRange('appearance.theme', 'invalid');
      expect(result.valid).toBe(true);
    });

    it('should validate history maxVersions range correctly', () => {
      const valid = validateSettingRange('history.maxVersions', 10);
      expect(valid.valid).toBe(true);

      const tooLow = validateSettingRange('history.maxVersions', 0);
      expect(tooLow.valid).toBe(false);

      const tooHigh = validateSettingRange('history.maxVersions', 101);
      expect(tooHigh.valid).toBe(false);
    });

    it('should validate font size range', () => {
      const valid = validateSettingRange('appearance.defaultFontSize', 16);
      expect(valid.valid).toBe(true);

      const tooSmall = validateSettingRange('appearance.defaultFontSize', 7);
      expect(tooSmall.valid).toBe(false);

      const tooLarge = validateSettingRange('appearance.defaultFontSize', 100);
      expect(tooLarge.valid).toBe(false);
    });

    it('should validate auto-save delay range', () => {
      const valid = validateSettingRange('general.autoSaveDelay', 1000);
      expect(valid.valid).toBe(true);

      const tooSmall = validateSettingRange('general.autoSaveDelay', 50);
      expect(tooSmall.valid).toBe(false);

      const tooLarge = validateSettingRange('general.autoSaveDelay', 50000);
      expect(tooLarge.valid).toBe(false);
    });

    it('should validate window dimension ranges', () => {
      const validWidth = validateSettingRange('appearance.defaultNoteWidth', 500);
      expect(validWidth.valid).toBe(true);

      const validHeight = validateSettingRange('appearance.defaultNoteHeight', 400);
      expect(validHeight.valid).toBe(true);

      const tooSmall = validateSettingRange('appearance.defaultNoteWidth', 50);
      expect(tooSmall.valid).toBe(false);

      const tooLarge = validateSettingRange('appearance.defaultNoteHeight', 3000);
      expect(tooLarge.valid).toBe(false);
    });

    // Negative test cases for edge cases
    it('should reject negative numbers where positive expected', () => {
      const result = validateSettingRange('appearance.noteOpacity', -10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject negative history maxVersions', () => {
      const result = validateSettingRange('history.maxVersions', -5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject zero where minimum > 0', () => {
      const result = validateSettingRange('history.maxVersions', 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject zero for font size (min is 8)', () => {
      const result = validateSettingRange('appearance.defaultFontSize', 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject negative font size', () => {
      const result = validateSettingRange('appearance.defaultFontSize', -12);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject Infinity value', () => {
      const result = validateSettingRange('appearance.noteOpacity', Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most');
    });

    it('should reject -Infinity value', () => {
      const result = validateSettingRange('appearance.noteOpacity', -Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject NaN for range validation', () => {
      // NaN comparisons always return false, so it should pass validation
      const result = validateSettingRange('appearance.noteOpacity', NaN);
      expect(result.valid).toBe(true);
    });

    it('should reject extremely large positive number', () => {
      const result = validateSettingRange('appearance.defaultNoteWidth', 999999);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most');
    });

    it('should reject value just below minimum', () => {
      const result = validateSettingRange('appearance.noteOpacity', 49);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least 50');
    });

    it('should reject value just above maximum', () => {
      const result = validateSettingRange('appearance.noteOpacity', 101);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most 100');
    });

    it('should reject auto-save delay below minimum (100ms)', () => {
      const result = validateSettingRange('general.autoSaveDelay', 99);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at least');
    });

    it('should reject trash retention days above maximum (365)', () => {
      const result = validateSettingRange('general.trashRetentionDays', 366);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be at most');
    });

    it('should include actual value in error message', () => {
      const result = validateSettingRange('appearance.noteOpacity', 150);
      expect(result.error).toContain('150');
    });

    it('should include setting key in error message', () => {
      const result = validateSettingRange('appearance.noteOpacity', 150);
      expect(result.error).toContain('appearance.noteOpacity');
    });
  });

  describe('setSetting with range validation', () => {
    it('should accept valid value within range', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', 80);
      }).not.toThrow();
    });

    it('should reject value outside range', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', 120);
      }).toThrow('must be at most 100');
    });

    it('should reject value below minimum', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', 30);
      }).toThrow('must be at least 50');
    });

    it('should provide clear error message on range violation', () => {
      expect(() => {
        setSetting('history.maxVersions', 999);
      }).toThrow('history.maxVersions');
    });

    it('should validate type before range', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', 'not-a-number');
      }).toThrow('expects number');
    });

    it('should accept numeric string values within range', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', '75');
      }).not.toThrow();
    });

    it('should reject numeric string outside range', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', '25');
      }).toThrow('must be at least 50');
    });

    it('should handle boundary values', () => {
      expect(() => {
        setSetting('appearance.noteOpacity', 50);
      }).not.toThrow();

      expect(() => {
        setSetting('appearance.noteOpacity', 100);
      }).not.toThrow();
    });
  });

  describe('Range validation integration', () => {
    it('should validate all numeric settings with ranges (v3 - no whisper)', () => {
      const testCases = [
        { key: 'general.autoSaveDelay', valid: 1000, invalid: 50 },
        { key: 'general.trashRetentionDays', valid: 30, invalid: 366 },
        { key: 'appearance.defaultNoteWidth', valid: 300, invalid: 50 },
        { key: 'appearance.defaultNoteHeight', valid: 350, invalid: 2500 },
        { key: 'appearance.defaultFontSize', valid: 14, invalid: 100 },
        { key: 'appearance.noteOpacity', valid: 100, invalid: 120 },
        { key: 'newNote.cascadeOffset', valid: 30, invalid: 300 },
        { key: 'editor.tabSize', valid: 2, invalid: 10 },
        { key: 'reminders.snoozeMinutes', valid: 15, invalid: 2000 },
        { key: 'history.maxVersions', valid: 10, invalid: 200 },
        { key: 'history.saveInterval', valid: 300000, invalid: 100 },
        // Note: whisper.* settings were removed in v3 (voice transcription abolished)
      ];

      for (const testCase of testCases) {
        const validResult = validateSettingRange(testCase.key, testCase.valid);
        expect(validResult.valid).toBe(true);

        const invalidResult = validateSettingRange(testCase.key, testCase.invalid);
        expect(invalidResult.valid).toBe(false);
      }
    });
  });
});
