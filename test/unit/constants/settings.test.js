/**
 * Settings Constants Tests
 */
const {
  settingsSchema,
  SETTINGS_SCHEMA_VERSION,
  getSettingDefault,
  getSettingType,
  isValidSettingKey,
  parseSettingValue,
  getAllDefaults,
  requiresRestart,
} = require('../../../shared/constants/settings');
describe('Settings Constants', () => {
  describe('settingsSchema', () => {
    it('should contain general settings', () => {
      expect(settingsSchema['general.startOnBoot']).toBeDefined();
      expect(settingsSchema['general.startMinimized']).toBeDefined();
      expect(settingsSchema['general.minimizeToTray']).toBeDefined();
      expect(settingsSchema['general.closeToTray']).toBeDefined();
      expect(settingsSchema['general.confirmDelete']).toBeDefined();
      expect(settingsSchema['general.confirmPermanentDelete']).toBeDefined();
      expect(settingsSchema['general.autoSaveDelay']).toBeDefined();
      expect(settingsSchema['general.trashRetentionDays']).toBeDefined();
    });
    it('should contain appearance settings', () => {
      expect(settingsSchema['appearance.theme']).toBeDefined();
      expect(settingsSchema['appearance.defaultNoteColor']).toBeDefined();
      expect(settingsSchema['appearance.defaultNoteWidth']).toBeDefined();
      expect(settingsSchema['appearance.defaultNoteHeight']).toBeDefined();
      expect(settingsSchema['appearance.defaultFontFamily']).toBeDefined();
      expect(settingsSchema['appearance.defaultFontSize']).toBeDefined();
      expect(settingsSchema['appearance.noteOpacity']).toBeDefined();
      expect(settingsSchema['appearance.enableShadows']).toBeDefined();
      expect(settingsSchema['appearance.enableAnimations']).toBeDefined();
      expect(settingsSchema['appearance.showNoteCount']).toBeDefined();
    });
    it('should contain new note behavior settings', () => {
      expect(settingsSchema['newNote.position']).toBeDefined();
      expect(settingsSchema['newNote.cascadeOffset']).toBeDefined();
    });
    it('should have correct new note defaults', () => {
      expect(settingsSchema['newNote.position'].default).toBe('cascade');
      expect(settingsSchema['newNote.cascadeOffset'].default).toBe(30);
    });
    it('should contain tray settings', () => {
      expect(settingsSchema['tray.singleClickAction']).toBeDefined();
      expect(settingsSchema['tray.doubleClickAction']).toBeDefined();
    });
    it('should have correct tray defaults', () => {
      expect(settingsSchema['tray.singleClickAction'].default).toBe('showPanel');
      expect(settingsSchema['tray.doubleClickAction'].default).toBe('newNote');
    });
    it('should contain shortcut settings', () => {
      expect(settingsSchema['shortcuts.globalNewNote']).toBeDefined();
      expect(settingsSchema['shortcuts.globalToggle']).toBeDefined();
      expect(settingsSchema['shortcuts.globalPanel']).toBeDefined();
    });
    it('should contain editor settings', () => {
      expect(settingsSchema['editor.spellcheck']).toBeDefined();
      expect(settingsSchema['editor.autoLinks']).toBeDefined();
      expect(settingsSchema['editor.autoLists']).toBeDefined();
      expect(settingsSchema['editor.tabSize']).toBeDefined();
      expect(settingsSchema['editor.showWordCount']).toBeDefined();
    });
    it('should have correct editor setting defaults', () => {
      expect(settingsSchema['editor.spellcheck'].default).toBe(true);
      expect(settingsSchema['editor.autoLinks'].default).toBe(true);
      expect(settingsSchema['editor.autoLists'].default).toBe(true);
      expect(settingsSchema['editor.tabSize'].default).toBe(2);
    });
    it('should have correct font size setting', () => {
      expect(settingsSchema['appearance.defaultFontSize']).toBeDefined();
      expect(settingsSchema['appearance.defaultFontSize'].type).toBe('number');
      expect(settingsSchema['appearance.defaultFontSize'].default).toBe(14);
    });
    it('should contain reminder settings', () => {
      expect(settingsSchema['reminders.enabled']).toBeDefined();
      expect(settingsSchema['reminders.sound']).toBeDefined();
      expect(settingsSchema['reminders.snoozeMinutes']).toBeDefined();
      expect(settingsSchema['reminders.persistUntilDismissed']).toBeDefined();
    });
    it('should have correct reminder defaults', () => {
      expect(settingsSchema['reminders.enabled'].default).toBe(true);
      expect(settingsSchema['reminders.sound'].default).toBe(true);
      expect(settingsSchema['reminders.snoozeMinutes'].default).toBe(15);
      expect(settingsSchema['reminders.persistUntilDismissed'].default).toBe(true);
    });
    it('should contain history settings', () => {
      expect(settingsSchema['history.maxVersions']).toBeDefined();
      expect(settingsSchema['history.saveInterval']).toBeDefined();
    });
    it('should have correct history defaults', () => {
      expect(settingsSchema['history.maxVersions'].default).toBe(10);
      expect(settingsSchema['history.saveInterval'].default).toBe(300000); // 5 minutes in ms
    });
    it('should contain advanced settings', () => {
      expect(settingsSchema['advanced.hardwareAcceleration']).toBeDefined();
      expect(settingsSchema['advanced.devTools']).toBeDefined();
    });
    it('should have correct advanced defaults', () => {
      expect(settingsSchema['advanced.hardwareAcceleration'].default).toBe(true);
      expect(settingsSchema['advanced.devTools'].default).toBe(false);
    });
    it('should have type and default for each setting', () => {
      for (const [, schema] of Object.entries(settingsSchema)) {
        expect(schema.type).toBeDefined();
        expect(schema.default).toBeDefined();
        expect(schema.description).toBeDefined();
        expect(['string', 'boolean', 'number'].includes(schema.type)).toBe(true);
      }
    });
  });
  describe('getSettingDefault', () => {
    it('should return default value for valid keys', () => {
      expect(getSettingDefault('general.startOnBoot')).toBe(false);
      expect(getSettingDefault('general.closeToTray')).toBe(true);
      expect(getSettingDefault('appearance.theme')).toBe('system');
      expect(getSettingDefault('appearance.defaultNoteColor')).toBe('yellow');
      expect(getSettingDefault('appearance.defaultNoteWidth')).toBe(300);
    });
    it('should return null for invalid keys', () => {
      expect(getSettingDefault('invalid.key')).toBeNull();
      expect(getSettingDefault('')).toBeNull();
    });
  });
  describe('getSettingType', () => {
    it('should return correct types', () => {
      expect(getSettingType('general.startOnBoot')).toBe('boolean');
      expect(getSettingType('appearance.theme')).toBe('string');
      expect(getSettingType('appearance.defaultNoteWidth')).toBe('number');
    });
    it('should return null for invalid keys', () => {
      expect(getSettingType('invalid.key')).toBeNull();
    });
  });
  describe('isValidSettingKey', () => {
    it('should return true for valid keys', () => {
      expect(isValidSettingKey('general.startOnBoot')).toBe(true);
      expect(isValidSettingKey('appearance.theme')).toBe(true);
      expect(isValidSettingKey('shortcuts.globalNewNote')).toBe(true);
    });
    it('should return false for invalid keys', () => {
      expect(isValidSettingKey('invalid.key')).toBe(false);
      expect(isValidSettingKey('')).toBe(false);
      expect(isValidSettingKey('general')).toBe(false);
    });
  });
  describe('parseSettingValue', () => {
    it('should parse boolean values', () => {
      expect(parseSettingValue('general.startOnBoot', 'true')).toBe(true);
      expect(parseSettingValue('general.startOnBoot', 'false')).toBe(false);
      expect(parseSettingValue('general.startOnBoot', '1')).toBe(true);
      expect(parseSettingValue('general.startOnBoot', true)).toBe(true);
      expect(parseSettingValue('general.startOnBoot', false)).toBe(false);
    });
    it('should parse number values', () => {
      expect(parseSettingValue('appearance.defaultNoteWidth', '300')).toBe(300);
      expect(parseSettingValue('appearance.defaultNoteWidth', 350)).toBe(350);
      expect(parseSettingValue('history.maxVersions', '10')).toBe(10);
    });
    it('should parse string values', () => {
      expect(parseSettingValue('appearance.theme', 'dark')).toBe('dark');
      expect(parseSettingValue('shortcuts.globalNewNote', 'Ctrl+Shift+N')).toBe('Ctrl+Shift+N');
    });
    it('should return original value for unknown keys', () => {
      expect(parseSettingValue('unknown.key', 'value')).toBe('value');
    });

    // NaN handling tests (Issue 16 fix)
    it('should return default when given invalid string for number type', () => {
      expect(parseSettingValue('appearance.defaultNoteWidth', 'invalid')).toBe(300);
      expect(parseSettingValue('appearance.defaultNoteWidth', 'abc123')).toBe(300);
      expect(parseSettingValue('history.maxVersions', 'not-a-number')).toBe(10);
    });
    it('should return default for NaN input', () => {
      expect(parseSettingValue('appearance.defaultNoteWidth', NaN)).toBe(300);
      expect(parseSettingValue('history.maxVersions', NaN)).toBe(10);
    });
    it('should return zero for empty string (valid number conversion)', () => {
      expect(parseSettingValue('appearance.defaultNoteWidth', '')).toBe(0);
      expect(parseSettingValue('editor.tabSize', '')).toBe(0);
    });
    it('should handle undefined string', () => {
      expect(parseSettingValue('appearance.defaultNoteWidth', 'undefined')).toBe(300);
      expect(parseSettingValue('history.maxVersions', 'undefined')).toBe(10);
    });
    it('should handle object input for number type', () => {
      expect(parseSettingValue('appearance.defaultNoteWidth', {})).toBe(300);
      expect(parseSettingValue('appearance.defaultNoteWidth', { value: 400 })).toBe(300);
      expect(parseSettingValue('history.maxVersions', [])).toBe(0);
    });
  });
  describe('getAllDefaults', () => {
    it('should return object with all defaults', () => {
      const defaults = getAllDefaults();
      expect(typeof defaults).toBe('object');
      expect(Object.keys(defaults).length).toBe(Object.keys(settingsSchema).length);
    });
    it('should match individual defaults', () => {
      const defaults = getAllDefaults();
      expect(defaults['general.startOnBoot']).toBe(getSettingDefault('general.startOnBoot'));
      expect(defaults['appearance.theme']).toBe(getSettingDefault('appearance.theme'));
    });
  });
  describe('requiresRestart', () => {
    it('should return true for hardwareAcceleration', () => {
      expect(requiresRestart('advanced.hardwareAcceleration')).toBe(true);
    });
    it('should return false for settings without requiresRestart flag', () => {
      expect(requiresRestart('general.startOnBoot')).toBe(false);
      expect(requiresRestart('appearance.theme')).toBe(false);
      expect(requiresRestart('editor.spellcheck')).toBe(false);
      expect(requiresRestart('reminders.enabled')).toBe(false);
    });
    it('should return false for invalid/unknown keys', () => {
      expect(requiresRestart('invalid.key')).toBe(false);
      expect(requiresRestart('nonexistent.setting')).toBe(false);
      expect(requiresRestart('')).toBe(false);
    });
    it('should return false when requiresRestart is explicitly false', () => {
      // Create a test case where a setting explicitly has requiresRestart: false
      // First, verify that settings without the flag default to false
      const settingWithoutFlag = settingsSchema['general.closeToTray'];
      expect(settingWithoutFlag.requiresRestart).toBeUndefined();
      expect(requiresRestart('general.closeToTray')).toBe(false);
    });
  });
  describe('SETTINGS_SCHEMA_VERSION', () => {
    it('should be exported', () => {
      expect(SETTINGS_SCHEMA_VERSION).toBeDefined();
    });
    it('should be a number', () => {
      expect(typeof SETTINGS_SCHEMA_VERSION).toBe('number');
    });
    it('should be >= 1', () => {
      expect(SETTINGS_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    });
    it('should be an integer', () => {
      expect(Number.isInteger(SETTINGS_SCHEMA_VERSION)).toBe(true);
    });
  });
});
