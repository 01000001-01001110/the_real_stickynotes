/**
 * Settings Type Validation Tests
 */
const { validateSettingType } = require('../../../shared/database/settings');

describe('validateSettingType', () => {
  describe('Boolean validation', () => {
    it('should accept boolean true', () => {
      const result = validateSettingType('general.startOnBoot', true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept boolean false', () => {
      const result = validateSettingType('general.startOnBoot', false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept string "true"', () => {
      const result = validateSettingType('general.startOnBoot', 'true');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept string "false"', () => {
      const result = validateSettingType('general.startOnBoot', 'false');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept string "0"', () => {
      const result = validateSettingType('general.startOnBoot', '0');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept string "1"', () => {
      const result = validateSettingType('general.startOnBoot', '1');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept number 0', () => {
      const result = validateSettingType('general.startOnBoot', 0);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept number 1', () => {
      const result = validateSettingType('general.startOnBoot', 1);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject string "abc"', () => {
      const result = validateSettingType('general.startOnBoot', 'abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject number 2', () => {
      const result = validateSettingType('general.startOnBoot', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject array', () => {
      const result = validateSettingType('general.startOnBoot', [true]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject object', () => {
      const result = validateSettingType('general.startOnBoot', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    // Negative test cases for edge cases
    it('should reject null value', () => {
      const result = validateSettingType('general.startOnBoot', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject undefined value', () => {
      const result = validateSettingType('general.startOnBoot', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject empty string', () => {
      const result = validateSettingType('general.startOnBoot', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject whitespace-only string', () => {
      const result = validateSettingType('general.startOnBoot', '   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject empty array', () => {
      const result = validateSettingType('general.startOnBoot', []);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject empty object', () => {
      const result = validateSettingType('general.startOnBoot', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject negative number', () => {
      const result = validateSettingType('general.startOnBoot', -1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject floating point number', () => {
      const result = validateSettingType('general.startOnBoot', 0.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject NaN', () => {
      const result = validateSettingType('general.startOnBoot', NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject Infinity', () => {
      const result = validateSettingType('general.startOnBoot', Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });

    it('should reject -Infinity', () => {
      const result = validateSettingType('general.startOnBoot', -Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects boolean');
    });
  });

  describe('Number validation', () => {
    it('should accept integer', () => {
      const result = validateSettingType('general.autoSaveDelay', 1000);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept float', () => {
      const result = validateSettingType('general.autoSaveDelay', 1000.5);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept zero', () => {
      const result = validateSettingType('general.autoSaveDelay', 0);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept negative number', () => {
      const result = validateSettingType('general.autoSaveDelay', -100);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept numeric string', () => {
      const result = validateSettingType('general.autoSaveDelay', '1000');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept negative numeric string', () => {
      const result = validateSettingType('general.autoSaveDelay', '-100');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept numeric string with decimals', () => {
      const result = validateSettingType('general.autoSaveDelay', '1000.5');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-numeric string', () => {
      const result = validateSettingType('general.autoSaveDelay', 'abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject empty string', () => {
      const result = validateSettingType('general.autoSaveDelay', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject NaN', () => {
      const result = validateSettingType('general.autoSaveDelay', NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject "null" string', () => {
      const result = validateSettingType('general.autoSaveDelay', 'null');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject array', () => {
      const result = validateSettingType('general.autoSaveDelay', [1000]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    // Negative test cases for edge cases
    it('should reject null value', () => {
      const result = validateSettingType('general.autoSaveDelay', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject undefined value', () => {
      const result = validateSettingType('general.autoSaveDelay', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject empty string for number', () => {
      const result = validateSettingType('general.autoSaveDelay', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject object as number', () => {
      const result = validateSettingType('general.autoSaveDelay', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should reject empty array as number', () => {
      const result = validateSettingType('general.autoSaveDelay', []);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });

    it('should accept Infinity as number type (technically valid)', () => {
      const result = validateSettingType('general.autoSaveDelay', Infinity);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept -Infinity as number type (technically valid)', () => {
      const result = validateSettingType('general.autoSaveDelay', -Infinity);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject string with only whitespace', () => {
      const result = validateSettingType('general.autoSaveDelay', '   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects number');
    });
  });

  describe('String validation', () => {
    it('should accept string', () => {
      const result = validateSettingType('appearance.theme', 'dark');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept empty string', () => {
      const result = validateSettingType('appearance.theme', '');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept number as string (converts internally)', () => {
      const result = validateSettingType('appearance.defaultFontFamily', 123);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept boolean as string (converts internally)', () => {
      const result = validateSettingType('appearance.defaultFontFamily', true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject array', () => {
      const result = validateSettingType('appearance.theme', ['dark']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects string');
    });

    it('should reject object', () => {
      const result = validateSettingType('appearance.theme', { theme: 'dark' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects string');
    });

    // Negative test cases for edge cases
    it('should reject null value for string', () => {
      const result = validateSettingType('appearance.theme', null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects string');
    });

    it('should reject undefined value for string', () => {
      const result = validateSettingType('appearance.theme', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects string');
    });

    it('should reject array for string', () => {
      const result = validateSettingType('appearance.theme', []);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects string');
    });

    it('should reject object for string', () => {
      const result = validateSettingType('appearance.theme', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expects string');
    });

    it('should accept Infinity as convertible to string', () => {
      const result = validateSettingType('appearance.theme', Infinity);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept -Infinity as convertible to string', () => {
      const result = validateSettingType('appearance.theme', -Infinity);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept NaN as convertible to string', () => {
      const result = validateSettingType('appearance.theme', NaN);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Unknown settings', () => {
    it('should accept any type for unknown setting key', () => {
      const result = validateSettingType('unknown.setting', 'anything');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept any type for unknown setting key - number', () => {
      const result = validateSettingType('unknown.setting', 123);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Error messages', () => {
    it('should include setting key in error message', () => {
      const result = validateSettingType('general.startOnBoot', 'invalid');
      expect(result.error).toContain('general.startOnBoot');
    });

    it('should include expected type in error message', () => {
      const result = validateSettingType('general.startOnBoot', 'invalid');
      expect(result.error).toContain('boolean');
    });

    it('should include actual type in error message', () => {
      const result = validateSettingType('general.startOnBoot', 123);
      expect(result.error).toContain('number');
    });

    it('should include actual value in error message', () => {
      const result = validateSettingType('general.autoSaveDelay', 'abc');
      expect(result.error).toContain('abc');
    });
  });

  describe('Real settings from schema', () => {
    it('should validate appearance.noteOpacity (number)', () => {
      expect(validateSettingType('appearance.noteOpacity', 75).valid).toBe(true);
      expect(validateSettingType('appearance.noteOpacity', '75').valid).toBe(true);
      expect(validateSettingType('appearance.noteOpacity', 'abc').valid).toBe(false);
    });

    it('should validate appearance.enableShadows (boolean)', () => {
      expect(validateSettingType('appearance.enableShadows', true).valid).toBe(true);
      expect(validateSettingType('appearance.enableShadows', 'true').valid).toBe(true);
      expect(validateSettingType('appearance.enableShadows', 123).valid).toBe(false);
    });

    it('should validate appearance.defaultNoteColor (string)', () => {
      expect(validateSettingType('appearance.defaultNoteColor', 'blue').valid).toBe(true);
      expect(validateSettingType('appearance.defaultNoteColor', 123).valid).toBe(true);
      expect(validateSettingType('appearance.defaultNoteColor', []).valid).toBe(false);
    });
  });
});
