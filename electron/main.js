/**
 * Electron Main Process Entry Point
 *
 * Unified entry point for both GUI and CLI modes.
 * CLI commands are handled directly without HTTP server.
 */
const { app, BrowserWindow, Menu, dialog } = require('electron');
const { initDatabase, closeDatabase } = require('../shared/database');
const {
  ensureAppDirs,
  initializeCustomDataPath,
  validateDataPath,
  getDefaultDataPath,
} = require('../shared/utils/paths');
const { getStorageConfig, clearStorageConfig } = require('./storage-config');
const { setupTray, destroyTray } = require('./tray');
const { setupShortcuts, unregisterShortcuts } = require('./shortcuts');
const { WindowManager } = require('./windows/manager');
const { setupIpcHandlers } = require('./ipc');
const { setupReminders, stopReminders } = require('./reminders');
const { checkForUpdates } = require('./updater');

// CLI support
const { isCliMode, parseArgs } = require('./cli/parser');
const { executeCommand } = require('./cli/commands');

// Keep a global reference of the window manager
let windowManager = null;

// Track if we're in CLI mode
let cliMode = false;
let cliParsed = null;

// Use a getter/setter pattern for isQuitting to avoid primitive copy issues
const appState = {
  _isQuitting: false,
  get isQuitting() {
    return this._isQuitting;
  },
  set isQuitting(val) {
    this._isQuitting = val;
  },
};

// Make appState globally accessible
global.appState = appState;
global.isQuitting = false;

// Check CLI mode BEFORE requesting lock
cliMode = isCliMode(process.argv);
if (cliMode) {
  cliParsed = parseArgs(process.argv);
}

// Prevent multiple instances - but handle CLI differently
const gotTheLock = app.requestSingleInstanceLock({ cliMode, cliParsed });

// Track if this instance should run
let shouldRun = gotTheLock;

if (!gotTheLock) {
  // Another instance is running
  if (cliMode) {
    // CLI mode: The main instance will process our command via second-instance event
    console.error('[CLI] Sending command to running instance...');
  }
  app.quit();
}

if (gotTheLock) {
  // We got the lock - handle second instance commands
  app.on('second-instance', async (event, argv, workingDir, additionalData) => {
    // Another instance tried to run
    if (additionalData?.cliMode && additionalData?.cliParsed) {
      // Second instance is CLI - execute its command
      console.log('[Main] Received CLI command from second instance');
      const result = await executeCommand(additionalData.cliParsed, { windowManager });

      // Output result to console (the second instance will see this via IPC in the future)
      // For now, main instance handles it
      console.log(result.output);

      // If command needs GUI to stay open, focus the window
      if (result.stayOpen && windowManager) {
        windowManager.showPanel();
      }
    } else {
      // Regular second instance - focus our window
      if (windowManager) {
        windowManager.showPanel();
      }
    }
  });
}

// Only initialize database if this instance should run
if (shouldRun) {
  // IMPORTANT: Custom path must be initialized BEFORE ensureAppDirs/initDatabase
  // Storage config is stored in DEFAULT location so it's always findable
  try {
    const storageConfig = getStorageConfig();
    if (storageConfig.dataPath) {
      console.log('[Main] Custom storage path configured:', storageConfig.dataPath);
      const validation = validateDataPath(storageConfig.dataPath);
      if (validation.valid) {
        initializeCustomDataPath(storageConfig.dataPath);
      } else {
        // Custom path is invalid - will show error dialog after app ready
        console.error('[Main] Custom storage path invalid:', validation.error);
        // Mark for showing error dialog later
        global.storagePathError = {
          path: storageConfig.dataPath,
          error: validation.error,
        };
        // Fall back to default path for now
        initializeCustomDataPath(null);
      }
    } else {
      // No custom path - use default
      initializeCustomDataPath(null);
    }
  } catch (err) {
    console.error('[Main] Error reading storage config:', err.message);
    initializeCustomDataPath(null);
  }

  // IMPORTANT: Hardware acceleration must be disabled BEFORE app.whenReady()
  try {
    ensureAppDirs();
    initDatabase();
    const { getSetting } = require('../shared/database/settings');
    const hwAccel = getSetting('advanced.hardwareAcceleration');
    if (hwAccel === false) {
      app.disableHardwareAcceleration();
      console.log('Hardware acceleration disabled');
    }
  } catch (err) {
    console.warn('Could not read hardware acceleration setting:', err.message);
  }
}

/**
 * Handle CLI mode execution
 */
async function runCliMode() {
  try {
    // Execute the command
    const result = await executeCommand(cliParsed, { windowManager: null });

    // Output result
    if (result.output) {
      if (result.exitCode === 0) {
        console.log(result.output);
      } else {
        console.error(result.output);
      }
    }

    // Exit unless command requires GUI
    if (!result.stayOpen) {
      app.exit(result.exitCode);
    } else {
      // Command needs GUI - switch to GUI mode
      cliMode = false;
      await createApp();
    }
  } catch (error) {
    console.error('CLI Error:', error.message);
    app.exit(1);
  }
}

/**
 * Create GUI application
 */
async function createApp() {
  try {
    console.log('Starting StickyNotes...');

    // Check for storage path error and show dialog
    if (global.storagePathError) {
      const { path: badPath, error } = global.storagePathError;
      const defaultPath = getDefaultDataPath();

      const result = await dialog.showMessageBox({
        type: 'error',
        title: 'Storage Location Unavailable',
        message: 'Cannot access your custom storage location',
        detail: `Path: ${badPath}\nError: ${error}\n\nYour notes are temporarily using the default location:\n${defaultPath}\n\nWould you like to reset to the default location permanently, or try again later?`,
        buttons: ['Reset to Default', 'Keep Custom (Try Later)', 'Quit'],
        defaultId: 0,
        cancelId: 2,
      });

      if (result.response === 0) {
        // Reset to default
        clearStorageConfig();
        console.log('[Main] Storage path reset to default');
      } else if (result.response === 2) {
        // Quit
        app.quit();
        return;
      }
      // If "Keep Custom", do nothing - will try again on next launch

      delete global.storagePathError;
    }

    // Remove default menu bar
    Menu.setApplicationMenu(null);

    const { getSetting } = require('../shared/database/settings');

    // Create window manager
    windowManager = new WindowManager();
    console.log('Window manager created');

    // Setup IPC handlers
    setupIpcHandlers(windowManager);
    console.log('IPC handlers set up');

    // Setup system tray
    setupTray(windowManager);
    console.log('System tray set up');

    // Setup global shortcuts
    setupShortcuts(windowManager);
    console.log('Shortcuts registered');

    // Setup reminder scheduler
    setupReminders(windowManager);

    // Check start minimized setting
    const startMinimized = getSetting('general.startMinimized');
    console.log('Start minimized:', startMinimized);

    // Show panel or restore open notes
    if (!startMinimized) {
      console.log('Showing panel...');
      windowManager.showPanel();
    }

    // Restore previously open notes
    windowManager.restoreOpenNotes();

    // Check for updates
    checkForUpdates();

    console.log('StickyNotes started successfully');
  } catch (error) {
    console.error('Failed to start StickyNotes:', error);
  }
}

// App lifecycle - only run if this instance should run
app.whenReady().then(async () => {
  if (!shouldRun) {
    return; // Second instance - just exit cleanly
  }

  if (cliMode) {
    await runCliMode();
  } else {
    await createApp();
  }
});

app.on('window-all-closed', () => {
  console.log('window-all-closed event fired');
  console.log('Platform:', process.platform);
  console.log('isQuitting:', appState.isQuitting);

  if (process.platform !== 'darwin') {
    const { getSetting } = require('../shared/database/settings');
    const closeToTray = getSetting('general.closeToTray');
    console.log('closeToTray setting:', closeToTray);

    if (!closeToTray || appState.isQuitting) {
      console.log('Quitting app due to window-all-closed');
      app.quit();
    } else {
      console.log('NOT quitting - closeToTray is enabled');
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (windowManager) {
      windowManager.showPanel();
    }
  }
});

app.on('before-quit', () => {
  appState.isQuitting = true;
  global.isQuitting = true;

  if (windowManager) {
    windowManager.saveAllWindowStates();
  }

  unregisterShortcuts();
  destroyTray();
  stopReminders();
  closeDatabase();
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (process.env.NODE_ENV === 'development') {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Export for use in other modules
module.exports = {
  getWindowManager: () => windowManager,
  isAppQuitting: () => appState.isQuitting,
  setQuitting: (val) => {
    appState.isQuitting = val;
    global.isQuitting = val;
  },
};
