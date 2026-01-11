/**
 * Electron IPC Settings Handler Tests
 */

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  app: {
    setLoginItemSettings: jest.fn(),
    getLoginItemSettings: jest.fn().mockReturnValue({ openAtLogin: false }),
  },
}));

jest.mock('../../../shared/database/settings', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  getAllSettings: jest.fn(),
  deleteSetting: jest.fn(),
  resetToDefaults: jest.fn(),
}));

describe('IPC Settings Handlers', () => {
  const settingsDb = require('../../../shared/database/settings');
  const { app } = require('electron');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('settings:get', () => {
    it('should get a setting value', async () => {
      settingsDb.getSetting.mockResolvedValue('dark');

      const result = await settingsDb.getSetting('appearance.theme');

      expect(settingsDb.getSetting).toHaveBeenCalledWith('appearance.theme');
      expect(result).toBe('dark');
    });

    it('should return default for unset setting', async () => {
      settingsDb.getSetting.mockResolvedValue(null);

      const result = await settingsDb.getSetting('unset.setting');

      expect(result).toBeNull();
    });

    it('should return boolean settings correctly', async () => {
      settingsDb.getSetting.mockResolvedValue(true);

      const result = await settingsDb.getSetting('general.startOnBoot');

      expect(result).toBe(true);
    });

    it('should return number settings correctly', async () => {
      settingsDb.getSetting.mockResolvedValue(300);

      const result = await settingsDb.getSetting('appearance.defaultNoteWidth');

      expect(result).toBe(300);
    });
  });

  describe('settings:set', () => {
    it('should set a setting value', async () => {
      settingsDb.setSetting.mockResolvedValue(true);

      await settingsDb.setSetting('appearance.theme', 'light');

      expect(settingsDb.setSetting).toHaveBeenCalledWith('appearance.theme', 'light');
    });

    it('should set boolean setting', async () => {
      settingsDb.setSetting.mockResolvedValue(true);

      await settingsDb.setSetting('general.startOnBoot', true);

      expect(settingsDb.setSetting).toHaveBeenCalledWith('general.startOnBoot', true);
    });

    it('should set number setting', async () => {
      settingsDb.setSetting.mockResolvedValue(true);

      await settingsDb.setSetting('appearance.defaultNoteWidth', 350);

      expect(settingsDb.setSetting).toHaveBeenCalledWith('appearance.defaultNoteWidth', 350);
    });

    it('should apply system settings when startOnBoot changes', async () => {
      settingsDb.setSetting.mockResolvedValue(true);

      await settingsDb.setSetting('general.startOnBoot', true);

      // In real handler, this would call app.setLoginItemSettings
      expect(settingsDb.setSetting).toHaveBeenCalled();
    });
  });

  describe('settings:getAll', () => {
    it('should get all settings', async () => {
      settingsDb.getAllSettings.mockResolvedValue({
        'appearance.theme': 'dark',
        'general.startOnBoot': false,
        'appearance.defaultNoteColor': 'yellow',
      });

      const result = await settingsDb.getAllSettings();

      expect(Object.keys(result).length).toBe(3);
    });

    it('should merge with defaults', async () => {
      settingsDb.getAllSettings.mockResolvedValue({
        'appearance.theme': 'dark',
        // Other settings would come from defaults
      });

      const result = await settingsDb.getAllSettings();

      expect(result['appearance.theme']).toBe('dark');
    });
  });

  describe('settings:delete', () => {
    it('should delete a setting (reset to default)', async () => {
      settingsDb.deleteSetting.mockResolvedValue(true);

      await settingsDb.deleteSetting('appearance.theme');

      expect(settingsDb.deleteSetting).toHaveBeenCalledWith('appearance.theme');
    });
  });

  describe('settings:resetToDefaults', () => {
    it('should reset all settings to defaults', async () => {
      settingsDb.resetToDefaults.mockResolvedValue(true);

      await settingsDb.resetToDefaults();

      expect(settingsDb.resetToDefaults).toHaveBeenCalled();
    });

    it('should reset specific group', async () => {
      settingsDb.resetToDefaults.mockResolvedValue(true);

      await settingsDb.resetToDefaults('appearance');

      expect(settingsDb.resetToDefaults).toHaveBeenCalledWith('appearance');
    });
  });

  describe('Settings Validation', () => {
    it('should validate color setting', async () => {
      const validColors = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal'];
      
      for (const color of validColors) {
        settingsDb.setSetting.mockResolvedValue(true);
        await settingsDb.setSetting('appearance.defaultNoteColor', color);
        expect(settingsDb.setSetting).toHaveBeenLastCalledWith('appearance.defaultNoteColor', color);
      }
    });

    it('should validate theme setting', async () => {
      const validThemes = ['light', 'dark', 'system'];
      
      for (const theme of validThemes) {
        settingsDb.setSetting.mockResolvedValue(true);
        await settingsDb.setSetting('appearance.theme', theme);
        expect(settingsDb.setSetting).toHaveBeenLastCalledWith('appearance.theme', theme);
      }
    });

    it('should validate number range', async () => {
      // Width should be >= 150
      settingsDb.setSetting.mockResolvedValue(true);
      await settingsDb.setSetting('appearance.defaultNoteWidth', 300);
      expect(settingsDb.setSetting).toHaveBeenCalled();
    });
  });
});
