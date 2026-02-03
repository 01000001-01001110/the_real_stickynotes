/**
 * Electron IPC Settings Handler Tests
 *
 * Tests the actual IPC handler functions registered in settings.js
 */

// Store registered handlers
const handlers = {};

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => {
      handlers[channel] = handler;
    }),
    on: jest.fn(),
  },
  nativeTheme: {
    themeSource: 'system',
  },
  app: {
    setLoginItemSettings: jest.fn(),
    getPath: jest.fn().mockReturnValue('/mock/path'),
  },
}));

jest.mock('../../../shared/database/settings', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  getAllSettings: jest.fn(),
  resetSetting: jest.fn(),
  resetAllSettings: jest.fn(),
}));

jest.mock('../../../shared/constants/settings', () => ({
  requiresRestart: jest.fn(),
}));

jest.mock('../../../electron/shortcuts', () => ({
  updateShortcuts: jest.fn(),
}));

jest.mock('../../../shared/utils/paths', () => ({
  getAppDataPath: jest.fn().mockReturnValue('/mock/appdata'),
  getDatabasePath: jest.fn().mockReturnValue('/mock/db'),
  getAttachmentsPath: jest.fn().mockReturnValue('/mock/attachments'),
}));

describe('IPC Settings Handlers', () => {
  const settingsDb = require('../../../shared/database/settings');
  const { requiresRestart } = require('../../../shared/constants/settings');
  const { nativeTheme, app } = require('electron');
  const { updateShortcuts } = require('../../../electron/shortcuts');

  let mockWindowManager;

  beforeAll(() => {
    // Register handlers once
    mockWindowManager = {
      broadcast: jest.fn(),
    };
    const { register } = require('../../../electron/ipc/settings');
    register(mockWindowManager);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('settings:get', () => {
    it('should call getSetting with the key', () => {
      settingsDb.getSetting.mockReturnValue('dark');

      const result = handlers['settings:get']({}, 'appearance.theme');

      expect(settingsDb.getSetting).toHaveBeenCalledWith('appearance.theme');
      expect(result).toBe('dark');
    });

    it('should return undefined for non-existent setting', () => {
      settingsDb.getSetting.mockReturnValue(undefined);

      const result = handlers['settings:get']({}, 'nonexistent.key');

      expect(result).toBeUndefined();
    });

    it('should handle boolean settings', () => {
      settingsDb.getSetting.mockReturnValue(true);

      const result = handlers['settings:get']({}, 'editor.spellcheck');

      expect(result).toBe(true);
    });

    it('should handle number settings', () => {
      settingsDb.getSetting.mockReturnValue(14);

      const result = handlers['settings:get']({}, 'appearance.defaultFontSize');

      expect(result).toBe(14);
    });
  });

  describe('settings:getMultiple', () => {
    it('should fetch multiple settings in one call', () => {
      settingsDb.getSetting
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(14)
        .mockReturnValueOnce('Segoe UI');

      const keys = ['editor.spellcheck', 'appearance.defaultFontSize', 'appearance.defaultFontFamily'];
      const result = handlers['settings:getMultiple']({}, keys);

      expect(settingsDb.getSetting).toHaveBeenCalledTimes(3);
      expect(settingsDb.getSetting).toHaveBeenNthCalledWith(1, 'editor.spellcheck');
      expect(settingsDb.getSetting).toHaveBeenNthCalledWith(2, 'appearance.defaultFontSize');
      expect(settingsDb.getSetting).toHaveBeenNthCalledWith(3, 'appearance.defaultFontFamily');
      expect(result).toEqual({
        'editor.spellcheck': true,
        'appearance.defaultFontSize': 14,
        'appearance.defaultFontFamily': 'Segoe UI',
      });
    });

    it('should return empty object for non-array input', () => {
      const result = handlers['settings:getMultiple']({}, 'not-an-array');

      expect(settingsDb.getSetting).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should return empty object for null input', () => {
      const result = handlers['settings:getMultiple']({}, null);

      expect(settingsDb.getSetting).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle empty array', () => {
      const result = handlers['settings:getMultiple']({}, []);

      expect(settingsDb.getSetting).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle all 9 editor settings used by applyEditorSettings', () => {
      settingsDb.getSetting
        .mockReturnValueOnce(true)      // editor.spellcheck
        .mockReturnValueOnce(14)        // appearance.defaultFontSize
        .mockReturnValueOnce('Arial')   // appearance.defaultFontFamily
        .mockReturnValueOnce(4)         // editor.tabSize
        .mockReturnValueOnce(true)      // editor.autoLists
        .mockReturnValueOnce(false)     // editor.autoLinks
        .mockReturnValueOnce(true)      // editor.showWordCount
        .mockReturnValueOnce(true)      // appearance.enableAnimations
        .mockReturnValueOnce(1000);     // general.autoSaveDelay

      const keys = [
        'editor.spellcheck',
        'appearance.defaultFontSize',
        'appearance.defaultFontFamily',
        'editor.tabSize',
        'editor.autoLists',
        'editor.autoLinks',
        'editor.showWordCount',
        'appearance.enableAnimations',
        'general.autoSaveDelay',
      ];

      const result = handlers['settings:getMultiple']({}, keys);

      expect(settingsDb.getSetting).toHaveBeenCalledTimes(9);
      expect(Object.keys(result)).toHaveLength(9);
      expect(result['editor.spellcheck']).toBe(true);
      expect(result['appearance.defaultFontSize']).toBe(14);
      expect(result['general.autoSaveDelay']).toBe(1000);
    });
  });

  describe('settings:set', () => {
    it('should call setSetting and broadcast change', () => {
      handlers['settings:set']({}, 'appearance.defaultFontSize', 16);

      expect(settingsDb.setSetting).toHaveBeenCalledWith('appearance.defaultFontSize', 16);
      expect(mockWindowManager.broadcast).toHaveBeenCalledWith('setting:changed', 'appearance.defaultFontSize', 16);
    });

    it('should return true on success', () => {
      const result = handlers['settings:set']({}, 'editor.spellcheck', true);

      expect(result).toBe(true);
    });

    it('should update nativeTheme when theme is set to dark', () => {
      handlers['settings:set']({}, 'appearance.theme', 'dark');

      expect(nativeTheme.themeSource).toBe('dark');
    });

    it('should update nativeTheme when theme is set to light', () => {
      handlers['settings:set']({}, 'appearance.theme', 'light');

      expect(nativeTheme.themeSource).toBe('light');
    });

    it('should update nativeTheme when theme is set to system', () => {
      handlers['settings:set']({}, 'appearance.theme', 'system');

      expect(nativeTheme.themeSource).toBe('system');
    });

    it('should call updateShortcuts when shortcut setting changes', () => {
      handlers['settings:set']({}, 'shortcuts.globalNewNote', 'CmdOrCtrl+N');

      expect(updateShortcuts).toHaveBeenCalled();
    });

    it('should call app.setLoginItemSettings when startOnBoot changes', () => {
      handlers['settings:set']({}, 'general.startOnBoot', true);

      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        path: '/mock/path',
      });
    });
  });

  describe('settings:getAll', () => {
    it('should call getAllSettings', () => {
      const mockSettings = {
        'appearance.theme': 'dark',
        'editor.spellcheck': true,
      };
      settingsDb.getAllSettings.mockReturnValue(mockSettings);

      const result = handlers['settings:getAll']();

      expect(settingsDb.getAllSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('settings:getDefaultPaths', () => {
    it('should return all default paths', () => {
      const result = handlers['settings:getDefaultPaths']();

      expect(result).toEqual({
        appData: '/mock/appdata',
        database: '/mock/db',
        attachments: '/mock/attachments',
      });
    });
  });

  describe('settings:requiresRestart', () => {
    it('should call requiresRestart with key', () => {
      requiresRestart.mockReturnValue(true);

      const result = handlers['settings:requiresRestart']({}, 'general.startOnBoot');

      expect(requiresRestart).toHaveBeenCalledWith('general.startOnBoot');
      expect(result).toBe(true);
    });
  });

  describe('settings:reset', () => {
    it('should reset specific setting when key provided', () => {
      handlers['settings:reset']({}, 'appearance.theme');

      expect(settingsDb.resetSetting).toHaveBeenCalledWith('appearance.theme');
      expect(settingsDb.resetAllSettings).not.toHaveBeenCalled();
    });

    it('should reset all settings when no key provided', () => {
      handlers['settings:reset']({}, null);

      expect(settingsDb.resetAllSettings).toHaveBeenCalled();
      expect(settingsDb.resetSetting).not.toHaveBeenCalled();
    });

    it('should reset all settings when key is undefined', () => {
      handlers['settings:reset']({}, undefined);

      expect(settingsDb.resetAllSettings).toHaveBeenCalled();
    });
  });
});
