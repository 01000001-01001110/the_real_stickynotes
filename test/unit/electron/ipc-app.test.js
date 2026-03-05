/**
 * Electron IPC App Handler Tests
 *
 * Tests the app-related IPC handlers registered in electron/ipc/index.js:
 * - app:getVersion
 * - app:checkUpdates
 * - app:quit
 * - app:restart
 * - app:openExternal
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
  shell: {
    openExternal: jest.fn(),
  },
  app: {
    getVersion: jest.fn().mockReturnValue('0.2.2'),
    quit: jest.fn(),
    relaunch: jest.fn(),
    setLoginItemSettings: jest.fn(),
    getPath: jest.fn().mockReturnValue('/mock/path'),
  },
  BrowserWindow: {
    fromWebContents: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
}));

jest.mock('../../../electron/updater', () => ({
  checkForUpdates: jest.fn(),
}));

jest.mock('../../../electron/ipc/notes', () => ({
  register: jest.fn(),
}));

jest.mock('../../../electron/ipc/tags', () => ({
  register: jest.fn(),
}));

jest.mock('../../../electron/ipc/folders', () => ({
  register: jest.fn(),
}));

jest.mock('../../../electron/ipc/settings', () => ({
  register: jest.fn(),
}));

jest.mock('../../../electron/ipc/attachments', () => ({
  register: jest.fn(),
}));

jest.mock('../../../electron/ipc/windows', () => ({
  register: jest.fn(),
}));

jest.mock('../../../electron/ipc/storage', () => ({
  register: jest.fn(),
}));

describe('IPC App Handlers', () => {
  const { app, shell } = require('electron');
  const { checkForUpdates } = require('../../../electron/updater');

  beforeAll(() => {
    // Register handlers once
    const { setupIpcHandlers } = require('../../../electron/ipc/index');
    const mockWindowManager = {
      broadcast: jest.fn(),
    };
    setupIpcHandlers(mockWindowManager);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('app:getVersion', () => {
    it('should return version from app.getVersion()', () => {
      app.getVersion.mockReturnValue('0.2.2');

      const result = handlers['app:getVersion']();

      expect(app.getVersion).toHaveBeenCalled();
      expect(result).toBe('0.2.2');
    });

    it('should handle different version strings', () => {
      app.getVersion.mockReturnValue('1.0.0-beta');

      const result = handlers['app:getVersion']();

      expect(result).toBe('1.0.0-beta');
    });

    it('should return version on every call', () => {
      app.getVersion.mockReturnValue('0.3.0');

      const result1 = handlers['app:getVersion']();
      const result2 = handlers['app:getVersion']();

      expect(result1).toBe('0.3.0');
      expect(result2).toBe('0.3.0');
      expect(app.getVersion).toHaveBeenCalledTimes(2);
    });
  });

  describe('app:checkUpdates', () => {
    it('should call checkForUpdates with true', async () => {
      checkForUpdates.mockResolvedValue({ available: false });

      await handlers['app:checkUpdates']();

      expect(checkForUpdates).toHaveBeenCalledWith(true);
    });

    it('should return update-available status', async () => {
      checkForUpdates.mockResolvedValue({ available: true, version: '0.3.0' });

      const result = await handlers['app:checkUpdates']();

      expect(result.available).toBe(true);
      expect(result.version).toBe('0.3.0');
    });

    it('should return update-not-available status', async () => {
      checkForUpdates.mockResolvedValue({ available: false });

      const result = await handlers['app:checkUpdates']();

      expect(result.available).toBe(false);
    });

    it('should handle update check errors gracefully', async () => {
      checkForUpdates.mockRejectedValue(new Error('Network error'));

      await expect(handlers['app:checkUpdates']()).rejects.toThrow('Network error');
    });

    it('should return complete update info when available', async () => {
      const updateInfo = {
        available: true,
        version: '1.0.0',
        releaseDate: '2026-03-05',
        releaseName: 'Version 1.0',
      };
      checkForUpdates.mockResolvedValue(updateInfo);

      const result = await handlers['app:checkUpdates']();

      expect(result).toEqual(updateInfo);
    });
  });

  describe('app:quit', () => {
    it('should set global.isQuitting flag', () => {
      global.isQuitting = undefined;

      handlers['app:quit']();

      expect(global.isQuitting).toBe(true);
    });

    it('should call app.quit()', () => {
      handlers['app:quit']();

      expect(app.quit).toHaveBeenCalled();
    });

    it('should set isQuitting before calling quit', () => {
      const callOrder = [];
      global.isQuitting = undefined;

      app.quit.mockImplementation(() => {
        callOrder.push('quit');
        expect(global.isQuitting).toBe(true);
      });

      handlers['app:quit']();

      callOrder.push('isQuitting');
      expect(callOrder).toEqual(['quit', 'isQuitting']);
    });

    it('should not return any value', () => {
      const result = handlers['app:quit']();

      expect(result).toBeUndefined();
    });
  });

  describe('app:restart', () => {
    it('should call app.relaunch()', () => {
      handlers['app:restart']();

      expect(app.relaunch).toHaveBeenCalled();
    });

    it('should set global.isQuitting flag', () => {
      global.isQuitting = undefined;

      handlers['app:restart']();

      expect(global.isQuitting).toBe(true);
    });

    it('should call app.quit()', () => {
      handlers['app:restart']();

      expect(app.quit).toHaveBeenCalled();
    });

    it('should call relaunch before quit', () => {
      const callOrder = [];

      app.relaunch.mockImplementation(() => {
        callOrder.push('relaunch');
      });

      app.quit.mockImplementation(() => {
        callOrder.push('quit');
      });

      handlers['app:restart']();

      expect(callOrder).toEqual(['relaunch', 'quit']);
    });

    it('should set isQuitting flag before calling quit', () => {
      global.isQuitting = false;

      app.quit.mockImplementation(() => {
        expect(global.isQuitting).toBe(true);
      });

      handlers['app:restart']();

      expect(global.isQuitting).toBe(true);
    });
  });

  describe('app:openExternal', () => {
    it('should allow https URLs', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'https://example.com');

      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    });

    it('should allow http URLs', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'http://example.com');

      expect(shell.openExternal).toHaveBeenCalledWith('http://example.com');
    });

    it('should block file:// protocol', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'file:///etc/passwd');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block javascript: protocol', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'javascript:alert("xss")');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block ftp: protocol', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'ftp://files.example.com');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block data: protocol', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'data:text/html,<h1>XSS</h1>');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block non-string input', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 123);

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block null input', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, null);

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block undefined input', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, undefined);

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block invalid URLs', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'not a valid url!!!');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should block URLs with invalid characters', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'ht!tp://exa mple.com');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should allow HTTPS URLs with paths', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'https://example.com/path/to/page?query=value');

      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/path/to/page?query=value');
    });

    it('should allow HTTP URLs with ports', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'http://example.com:8080');

      expect(shell.openExternal).toHaveBeenCalledWith('http://example.com:8080');
    });

    it('should allow HTTPS URLs with fragments', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'https://example.com#section');

      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com#section');
    });

    it('should return the promise from shell.openExternal', async () => {
      const mockPromise = Promise.resolve(undefined);
      shell.openExternal.mockReturnValue(mockPromise);

      const result = handlers['app:openExternal']({}, 'https://example.com');

      expect(result).toBe(mockPromise);
    });

    it('should not return anything when URL is blocked', () => {
      const result = handlers['app:openExternal']({}, 'file:///etc/passwd');

      expect(result).toBeUndefined();
    });

    it('should allow HTTPS URLs with special characters in query', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'https://example.com?email=test@example.com&name=John+Doe');

      expect(shell.openExternal).toHaveBeenCalled();
    });

    it('should block empty string', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, '');

      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('should allow HTTPS URLs with international domain names', () => {
      shell.openExternal.mockResolvedValue(undefined);

      handlers['app:openExternal']({}, 'https://例え.jp');

      expect(shell.openExternal).toHaveBeenCalled();
    });

    it('should log security warning for blocked non-http URLs', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      handlers['app:openExternal']({}, 'file:///etc/passwd');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Security] Blocked openExternal for non-http URL:',
        'file:///etc/passwd'
      );

      consoleSpy.mockRestore();
    });

    it('should log security warning for blocked invalid URLs', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      handlers['app:openExternal']({}, 'not a valid url');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Security] Blocked openExternal for invalid URL:',
        'not a valid url'
      );

      consoleSpy.mockRestore();
    });
  });
});
