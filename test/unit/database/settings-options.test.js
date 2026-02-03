/**
 * Settings Options Validation Tests
 * Tests that validateSettingOptions properly validates enum-like option values
 *
 * Note: whisper.* settings were removed in v3 (voice transcription abolished)
 */
jest.mock('../../../shared/database/index');

const {
  validateSettingOptions,
  setSetting,
  setSettings,
} = require('../../../shared/database/settings');
const mockDbModule = require('../../../shared/database/index');

describe('Settings Options Validation', () => {
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

  describe('validateSettingOptions function', () => {
    it('should allow valid appearance.theme option', () => {
      const result = validateSettingOptions('appearance.theme', 'dark');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow all valid theme options', () => {
      const options = ['light', 'dark', 'system'];
      options.forEach((option) => {
        const result = validateSettingOptions('appearance.theme', option);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid theme option', () => {
      const result = validateSettingOptions('appearance.theme', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
      expect(result.error).toContain('invalid');
    });

    it('should allow valid appearance.defaultNoteColor option', () => {
      const result = validateSettingOptions('appearance.defaultNoteColor', 'blue');
      expect(result.valid).toBe(true);
    });

    it('should allow all valid note color options', () => {
      const options = [
        'yellow',
        'pink',
        'blue',
        'green',
        'purple',
        'orange',
        'gray',
        'charcoal',
        'random',
      ];
      options.forEach((option) => {
        const result = validateSettingOptions('appearance.defaultNoteColor', option);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid note color option', () => {
      const result = validateSettingOptions('appearance.defaultNoteColor', 'red');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should allow valid newNote.position option', () => {
      const result = validateSettingOptions('newNote.position', 'cascade');
      expect(result.valid).toBe(true);
    });

    it('should allow all valid position options', () => {
      const options = ['cascade', 'center', 'cursor', 'random'];
      options.forEach((option) => {
        const result = validateSettingOptions('newNote.position', option);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid position option', () => {
      const result = validateSettingOptions('newNote.position', 'topleft');
      expect(result.valid).toBe(false);
    });

    it('should allow valid tray.singleClickAction option', () => {
      const result = validateSettingOptions('tray.singleClickAction', 'showPanel');
      expect(result.valid).toBe(true);
    });

    it('should allow all valid tray action options', () => {
      const options = ['showPanel', 'toggleNotes', 'newNote', 'nothing'];
      options.forEach((option) => {
        const result = validateSettingOptions('tray.singleClickAction', option);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid tray action option', () => {
      const result = validateSettingOptions('tray.singleClickAction', 'openSettings');
      expect(result.valid).toBe(false);
    });

    it('should skip validation for settings without options', () => {
      const result = validateSettingOptions('general.autoSaveDelay', 'anything');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should skip validation for non-existent settings', () => {
      const result = validateSettingOptions('nonexistent.setting', 'value');
      expect(result.valid).toBe(true);
    });

    it('should be case-sensitive for option matching', () => {
      const result = validateSettingOptions('appearance.theme', 'Dark');
      expect(result.valid).toBe(false);
    });

    it('should include setting key in error message', () => {
      const result = validateSettingOptions('appearance.theme', 'invalid');
      expect(result.error).toContain('appearance.theme');
    });

    it('should include the invalid value in error message', () => {
      const result = validateSettingOptions('appearance.theme', 'badvalue');
      expect(result.error).toContain('badvalue');
    });

    it('should list all valid options in error message', () => {
      const result = validateSettingOptions('appearance.theme', 'invalid');
      expect(result.error).toContain('light');
      expect(result.error).toContain('dark');
      expect(result.error).toContain('system');
    });

    // Negative test cases for edge cases
    it('should reject empty string option', () => {
      const result = validateSettingOptions('appearance.theme', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject null option', () => {
      const result = validateSettingOptions('appearance.theme', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject undefined option', () => {
      const result = validateSettingOptions('appearance.theme', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject numeric option where string expected', () => {
      const result = validateSettingOptions('appearance.theme', 123);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject numeric string for theme setting', () => {
      const result = validateSettingOptions('appearance.theme', '123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject whitespace-only option', () => {
      const result = validateSettingOptions('appearance.theme', '   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should accept array with single string (converts via String())', () => {
      // Arrays with single valid string convert to that string via String()
      const result = validateSettingOptions('appearance.theme', ['dark']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject object as option', () => {
      const result = validateSettingOptions('appearance.theme', { value: 'dark' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject empty array as option', () => {
      const result = validateSettingOptions('appearance.defaultNoteColor', []);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject empty object as option', () => {
      const result = validateSettingOptions('appearance.defaultNoteColor', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject option with mixed case', () => {
      const result = validateSettingOptions('appearance.theme', 'Dark');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject option with extra whitespace', () => {
      const result = validateSettingOptions('appearance.theme', ' dark ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject boolean option where string expected', () => {
      const result = validateSettingOptions('appearance.theme', true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject partial match option', () => {
      const result = validateSettingOptions('appearance.theme', 'dar');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject color option that does not exist', () => {
      const result = validateSettingOptions('appearance.defaultNoteColor', 'red');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject position option that does not exist', () => {
      const result = validateSettingOptions('newNote.position', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject tray action option that does not exist', () => {
      const result = validateSettingOptions('tray.singleClickAction', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject Infinity as option', () => {
      const result = validateSettingOptions('appearance.theme', Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });

    it('should reject NaN as option', () => {
      const result = validateSettingOptions('appearance.theme', NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be one of');
    });
  });

  describe('setSetting with options validation', () => {
    it('should accept valid option value', () => {
      expect(() => {
        setSetting('appearance.theme', 'dark');
      }).not.toThrow();
    });

    it('should reject invalid option value', () => {
      expect(() => {
        setSetting('appearance.theme', 'invalid');
      }).toThrow('must be one of');
    });

    it('should validate after type validation', () => {
      // Type validation should pass, but options validation should fail
      expect(() => {
        setSetting('appearance.theme', 'invalid');
      }).toThrow('must be one of');
    });

    it('should accept valid color option', () => {
      expect(() => {
        setSetting('appearance.defaultNoteColor', 'blue');
      }).not.toThrow();
    });

    it('should reject invalid color option', () => {
      expect(() => {
        setSetting('appearance.defaultNoteColor', 'red');
      }).toThrow('must be one of');
    });

    it('should accept valid position option', () => {
      expect(() => {
        setSetting('newNote.position', 'center');
      }).not.toThrow();
    });

    it('should accept valid tray action option', () => {
      expect(() => {
        setSetting('tray.singleClickAction', 'newNote');
      }).not.toThrow();
    });

    it('should call database prepare and run on valid option', () => {
      const { getDatabase } = mockDbModule;
      setSetting('appearance.theme', 'dark');

      const db = getDatabase();
      expect(db.prepare).toHaveBeenCalled();
    });

    it('should not call database on invalid option', () => {
      expect(() => {
        setSetting('appearance.theme', 'invalid');
      }).toThrow();
    });
  });

  describe('setSettings with options validation', () => {
    it('should accept all valid settings with options', () => {
      expect(() => {
        setSettings({
          'appearance.theme': 'dark',
          'appearance.defaultNoteColor': 'blue',
          'newNote.position': 'center',
        });
      }).not.toThrow();
    });

    it('should reject if any setting has invalid option', () => {
      expect(() => {
        setSettings({
          'appearance.theme': 'dark',
          'appearance.defaultNoteColor': 'invalid-color',
          'newNote.position': 'center',
        });
      }).toThrow('must be one of');
    });

    it('should validate all settings before writing any', () => {
      expect(() => {
        setSettings({
          'appearance.theme': 'invalid',
          'appearance.defaultNoteColor': 'blue',
        });
      }).toThrow();
    });

    it('should accept mixed valid option and non-option settings', () => {
      expect(() => {
        setSettings({
          'appearance.theme': 'light',
          'general.autoSaveDelay': 2000,
          'appearance.defaultNoteColor': 'green',
        });
      }).not.toThrow();
    });

    it('should report first invalid setting with options', () => {
      expect(() => {
        setSettings({
          'appearance.theme': 'dark',
          'appearance.defaultNoteColor': 'invalid1',
          'newNote.position': 'invalid2',
        });
      }).toThrow('appearance.defaultNoteColor');
    });
  });

  describe('Options validation coverage for all settings', () => {
    it('should validate all 5 settings with options (v3 - no whisper)', () => {
      const settingsWithOptions = [
        { key: 'appearance.theme', valid: 'dark', invalid: 'badtheme' },
        { key: 'appearance.defaultNoteColor', valid: 'pink', invalid: 'badcolor' },
        { key: 'newNote.position', valid: 'random', invalid: 'badposition' },
        { key: 'tray.singleClickAction', valid: 'toggleNotes', invalid: 'badaction' },
        { key: 'tray.doubleClickAction', valid: 'nothing', invalid: 'badaction' },
      ];

      settingsWithOptions.forEach(({ key, valid, invalid }) => {
        const validResult = validateSettingOptions(key, valid);
        expect(validResult.valid).toBe(true);

        const invalidResult = validateSettingOptions(key, invalid);
        expect(invalidResult.valid).toBe(false);
      });
    });
  });
});
