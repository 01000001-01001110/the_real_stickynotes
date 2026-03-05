/**
 * Electron Main Process Entry Point
 *
 * Unified entry point for both GUI and CLI modes.
 * CLI commands are handled directly without HTTP server.
 */
const { app, BrowserWindow, Menu, dialog, session } = require('electron');
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
const { initUpdater, checkForUpdates } = require('./updater');

// CLI support
const { isCliMode, parseArgs } = require('./cli/parser');
const { executeCommand } = require('./cli/commands');

// Pipe server integration
const { initPipeServer, shutdownPipeServer } = require('./ipc/pipe-integration');

// Development mode check
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Debug logging helper - only logs in dev mode
const debugLog = (...args) => {
  if (isDev) console.log(...args);
};

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

// Prevent multiple instances
// Note: CLI now uses named pipe IPC instead of second-instance event
const gotTheLock = app.requestSingleInstanceLock();

// Track if this instance should run
let shouldRun = gotTheLock;

if (!gotTheLock) {
  // Another instance is running - just quit
  // CLI will communicate via named pipe to existing instance
  app.quit();
}

if (gotTheLock) {
  // Handle second instance - focus window
  // Note: CLI commands now go through named pipe, not second-instance
  app.on('second-instance', (_event, _argv, _workingDir, _additionalData) => {
    // Someone tried to launch the app again - focus our window
    if (windowManager) {
      windowManager.showPanel();
    }
  });
}

// Only initialize database if this instance should run
if (shouldRun) {
  // IMPORTANT: Custom path must be initialized BEFORE ensureAppDirs/initDatabase
  // Check for portable mode first (highest priority)
  const { isPortableMode } = require('../shared/utils/paths');

  if (isPortableMode()) {
    debugLog('[Main] Portable mode enabled');
    // In portable mode, we don't use custom paths from storage-config.json
    // The portable path is automatically used by getAppDataPath()
    initializeCustomDataPath(null);
  } else {
    // Not portable mode - check for custom storage path
    // Storage config is stored in DEFAULT location so it's always findable
    try {
      const storageConfig = getStorageConfig();
      if (storageConfig.dataPath) {
        debugLog('[Main] Custom storage path configured:', storageConfig.dataPath);
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
  }

  // IMPORTANT: Hardware acceleration must be disabled BEFORE app.whenReady()
  try {
    ensureAppDirs();
    initDatabase();
    const { getSetting } = require('../shared/database/settings');
    const hwAccel = getSetting('advanced.hardwareAcceleration');
    if (hwAccel === false) {
      app.disableHardwareAcceleration();
      debugLog('Hardware acceleration disabled');
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
    debugLog('Starting StickyNotes...');

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
        debugLog('[Main] Storage path reset to default');
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

    // ============================================================
    // PHASE 2: SERVICES (depends on Phase 1: database)
    // ============================================================
    debugLog('[Phase 2] Initializing services...');

    // Initialize ConfigManager (must be after database init)
    try {
      const { initConfig } = require('../shared/config');
      initConfig();
      debugLog('[Phase 2] Config manager initialized');
    } catch (error) {
      // Non-fatal: app can run with SQLite-only settings
      console.warn('[Phase 2] Failed to initialize config manager:', error.message);
    }

    // Initialize pipe server (for CLI communication)
    try {
      await initPipeServer({
        // Pass required stores for pipe methods
        // windowManager will be null initially, pipe methods must handle this
        windowManager: null, // Will be set after Phase 3
        getSetting,
      });
      debugLog('[Phase 2] Pipe server initialized');
    } catch (error) {
      // Non-fatal: app can run without pipe server (CLI just won't work)
      console.warn('[Phase 2] Failed to initialize pipe server:', error.message);
    }

    // ============================================================
    // PHASE 3: UI (depends on Phase 2: services)
    // ============================================================
    debugLog('[Phase 3] Initializing UI...');

    // Create window manager
    windowManager = new WindowManager();
    debugLog('Window manager created');

    // Setup IPC handlers
    setupIpcHandlers(windowManager);
    debugLog('IPC handlers set up');

    // Setup system tray
    setupTray(windowManager);
    debugLog('System tray set up');

    // Setup global shortcuts
    setupShortcuts(windowManager);
    debugLog('Shortcuts registered');

    // Setup reminder scheduler
    setupReminders(windowManager);

    // ============================================================
    // SIGNAL READINESS
    // ============================================================
    global.appReady = true;
    debugLog('[Phase 3] App ready');

    // Check if app should start minimized
    // Priority: --minimized flag > startMinimized setting
    const minimizedFlag = process.argv.includes('--minimized');
    const startMinimized = minimizedFlag || getSetting('general.startMinimized');
    debugLog('Start minimized (flag):', minimizedFlag);
    debugLog('Start minimized (setting):', getSetting('general.startMinimized'));
    debugLog('Start minimized (final):', startMinimized);

    // Show panel or restore open notes
    if (!startMinimized) {
      debugLog('Showing panel...');
      windowManager.showPanel();
    } else {
      debugLog('Starting minimized to tray (no panel shown)');
    }

    // Restore previously open notes
    windowManager.restoreOpenNotes();

    // Initialize and check for updates
    initUpdater();
    checkForUpdates();

    debugLog('StickyNotes started successfully');
  } catch (error) {
    console.error('Failed to start StickyNotes:', error);
  }
}

// App lifecycle - only run if this instance should run
app.whenReady().then(async () => {
  if (!shouldRun) {
    return; // Second instance - just exit cleanly
  }

  // Deny all special permissions - sticky notes app doesn't need media access
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  if (cliMode) {
    await runCliMode();
  } else {
    await createApp();
  }
});

app.on('window-all-closed', () => {
  debugLog('window-all-closed event fired');
  debugLog('Platform:', process.platform);
  debugLog('isQuitting:', appState.isQuitting);

  // Don't quit if closeToTray is enabled and we're not explicitly quitting
  const { getSetting } = require('../shared/database/settings');
  const closeToTray = getSetting('general.closeToTray');
  debugLog('closeToTray setting:', closeToTray);

  if (closeToTray && !appState.isQuitting) {
    debugLog('Staying running in tray (closeToTray enabled, not quitting)');
    return;
  }

  // On macOS, apps typically stay running without windows
  if (process.platform === 'darwin') {
    debugLog('macOS: Staying running (no windows)');
    return;
  }

  // Otherwise, quit the app
  debugLog('Quitting app due to window-all-closed');
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (windowManager) {
      windowManager.showPanel();
    }
  }
});

app.on('before-quit', async (event) => {
  appState.isQuitting = true;
  global.isQuitting = true;

  // Prevent immediate quit to allow graceful shutdown
  if (!global.pipeServerShutdownComplete) {
    event.preventDefault();

    try {
      // Gracefully shutdown pipe server (wait max 5s for in-flight requests)
      await shutdownPipeServer(5000);
      global.pipeServerShutdownComplete = true;
    } catch (error) {
      console.error('[Main] Error during pipe server shutdown:', error);
      global.pipeServerShutdownComplete = true;
    }

    // Continue with rest of cleanup
    if (windowManager) {
      windowManager.saveAllWindowStates();
    }

    unregisterShortcuts();
    destroyTray();
    stopReminders();
    closeDatabase();

    // Now actually quit
    app.quit();
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
