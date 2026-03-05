/**
 * Auto-updater Module Tests
 *
 * Tests the auto-update functionality including initialization, checking for updates,
 * downloading, and installation.
 */

// Store registered event listeners
const eventListeners = {};

jest.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: jest.fn((event, handler) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(handler);
    }),
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn(),
  },
}));

jest.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: jest.fn().mockReturnValue({
      webContents: { send: jest.fn() },
    }),
    getAllWindows: jest.fn().mockReturnValue([]),
  },
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 1 }), // Default: "Later" button
  },
}));

describe('Updater Module', () => {
  beforeEach(() => {
    // Use fake timers to prevent 30s timeout from leaking
    jest.useFakeTimers();
    // Reset modules to get fresh state for each test
    jest.resetModules();
    // Clear event listeners
    Object.keys(eventListeners).forEach(key => delete eventListeners[key]);
  });

  afterEach(() => {
    // Clean up any pending timers and restore real timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initUpdater()', () => {
    it('should register event listeners on first call', () => {
      const { autoUpdater } = require('electron-updater');
      const { initUpdater } = require('../../../electron/updater');

      initUpdater();

      // Should register multiple event listeners
      expect(autoUpdater.on).toHaveBeenCalled();
      const calls = autoUpdater.on.mock.calls;

      // Verify key events are registered
      const registeredEvents = calls.map(call => call[0]);
      expect(registeredEvents).toContain('checking-for-update');
      expect(registeredEvents).toContain('update-available');
      expect(registeredEvents).toContain('update-not-available');
      expect(registeredEvents).toContain('error');
      expect(registeredEvents).toContain('download-progress');
      expect(registeredEvents).toContain('update-downloaded');
    });

    it('should not register duplicate listeners when called multiple times', () => {
      const { autoUpdater } = require('electron-updater');
      const { initUpdater } = require('../../../electron/updater');

      const callCountBefore = autoUpdater.on.mock.calls.length;

      initUpdater();
      const callsAfterFirst = autoUpdater.on.mock.calls.length;

      initUpdater();
      const callsAfterSecond = autoUpdater.on.mock.calls.length;

      // Second call should not add more listeners
      expect(callsAfterFirst).toBeGreaterThan(callCountBefore);
      expect(callsAfterSecond).toBe(callsAfterFirst);
    });

    it('should set autoDownload to false', () => {
      const { autoUpdater } = require('electron-updater');
      const { initUpdater } = require('../../../electron/updater');

      initUpdater();

      expect(autoUpdater.autoDownload).toBe(false);
    });

    it('should set autoInstallOnAppQuit to true', () => {
      const { autoUpdater } = require('electron-updater');
      const { initUpdater } = require('../../../electron/updater');

      initUpdater();

      expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    });
  });

  describe('checkForUpdates()', () => {
    it('should call autoUpdater.checkForUpdates when manual is false', () => {
      const { autoUpdater } = require('electron-updater');
      const { checkForUpdates } = require('../../../electron/updater');

      checkForUpdates(false);

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it('should call autoUpdater.checkForUpdates by default', () => {
      const { autoUpdater } = require('electron-updater');
      const { checkForUpdates } = require('../../../electron/updater');

      checkForUpdates();

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it('should return a promise when manual is true', () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const result = checkForUpdates(true);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve with { status: "up-to-date" } when update-not-available fires', async () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      // Fire the event synchronously
      eventListeners['update-not-available'].forEach(handler => handler());

      const result = await promise;

      expect(result).toEqual({ status: 'up-to-date' });
    });

    it('should resolve with { status: "update-available", version } when update-available fires', async () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      // Fire the event synchronously
      eventListeners['update-available'].forEach(handler =>
        handler({ version: '1.2.3' })
      );

      const result = await promise;

      expect(result).toEqual({ status: 'update-available', version: '1.2.3' });
    });

    it('should resolve with { status: "error", message } when error event fires', async () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      // Fire the event synchronously
      const errorObj = new Error('Network timeout');
      eventListeners['error'].forEach(handler => handler(errorObj));

      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.message).toBe('Network timeout');
    });

    it('should resolve with error when autoUpdater.checkForUpdates throws', async () => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdates.mockImplementation(() => {
        throw new Error('Check failed');
      });

      const { checkForUpdates } = require('../../../electron/updater');

      const result = await checkForUpdates(true);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Check failed');
    });

    it('should timeout after 30 seconds if no event fires', async () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      jest.advanceTimersByTime(30000);

      const result = await promise;

      expect(result).toEqual({ status: 'error', message: 'Update check timed out' });
    });

  });

  describe('downloadUpdate()', () => {
    it('should call autoUpdater.downloadUpdate', () => {
      const { autoUpdater } = require('electron-updater');
      const { downloadUpdate } = require('../../../electron/updater');

      downloadUpdate();

      expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
    });
  });

  describe('quitAndInstall()', () => {
    it('should call autoUpdater.quitAndInstall', () => {
      const { autoUpdater } = require('electron-updater');
      const { quitAndInstall } = require('../../../electron/updater');

      quitAndInstall();

      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });
  });

  describe('isUpdateAvailable()', () => {
    it('should return false initially', () => {
      const { isUpdateAvailable } = require('../../../electron/updater');

      expect(isUpdateAvailable()).toBe(false);
    });

    it('should return true after update-available event', async () => {
      const { checkForUpdates, isUpdateAvailable } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      eventListeners['update-available'].forEach(handler =>
        handler({ version: '1.2.3' })
      );

      await promise;

      expect(isUpdateAvailable()).toBe(true);
    });

    it('should remain false after update-not-available event', async () => {
      const { checkForUpdates, isUpdateAvailable } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      eventListeners['update-not-available'].forEach(handler => handler());

      await promise;

      expect(isUpdateAvailable()).toBe(false);
    });
  });

  describe('isUpdateDownloaded()', () => {
    it('should return false initially', () => {
      const { isUpdateDownloaded } = require('../../../electron/updater');

      expect(isUpdateDownloaded()).toBe(false);
    });

    it('should return true after update-downloaded event', (done) => {
      const { initUpdater, isUpdateDownloaded } = require('../../../electron/updater');

      initUpdater();

      // Fire the update-downloaded event
      if (eventListeners['update-downloaded'] && eventListeners['update-downloaded'].length > 0) {
        eventListeners['update-downloaded'].forEach(handler =>
          handler({ version: '1.2.3' })
        );

        expect(isUpdateDownloaded()).toBe(true);
        done();
      } else {
        done();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle autoUpdater.checkForUpdates throwing in non-manual mode', () => {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.checkForUpdates.mockImplementation(() => {
        throw new Error('Check failed');
      });

      const { checkForUpdates } = require('../../../electron/updater');

      // Should not throw
      expect(() => checkForUpdates(false)).not.toThrow();
    });

    it('should clear manual check callback after event resolution', async () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const promise1 = checkForUpdates(true);

      eventListeners['update-not-available'].forEach(handler => handler());

      const result1 = await promise1;
      expect(result1.status).toBe('up-to-date');

      // Callback should be cleared, so manual check should work again
      const promise2 = checkForUpdates(true);

      eventListeners['update-not-available'].forEach(handler => handler());

      const result2 = await promise2;
      expect(result2.status).toBe('up-to-date');
    });

    it('should handle error event with message extraction', async () => {
      const { checkForUpdates } = require('../../../electron/updater');

      const promise = checkForUpdates(true);

      const error = new Error('Connection refused');
      eventListeners['error'].forEach(handler => handler(error));

      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.message).toBe('Connection refused');
    });
  });

  describe('State Management', () => {
    it('should initialize listeners only once across multiple checkForUpdates calls', () => {
      const { autoUpdater } = require('electron-updater');
      const { checkForUpdates } = require('../../../electron/updater');

      const callCountBefore = autoUpdater.on.mock.calls.length;

      checkForUpdates(false);
      const callsAfterFirst = autoUpdater.on.mock.calls.length;

      checkForUpdates(false);
      const callsAfterSecond = autoUpdater.on.mock.calls.length;

      // All listeners should be registered on first call
      expect(callsAfterFirst).toBeGreaterThan(callCountBefore);
      expect(callsAfterSecond).toBe(callsAfterFirst);
    });
  });
});
