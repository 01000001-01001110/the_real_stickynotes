/**
 * Auto-update functionality
 */
const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (isDev) console.log(...args);
};

let updateAvailable = false;
let updateDownloaded = false;
let initialized = false;

// Track pending manual check resolve callback
let manualCheckCallback = null;

/**
 * Initialize the auto-updater (call once at startup)
 * Registers event listeners and configures settings.
 */
function initUpdater() {
  if (initialized) return;
  initialized = true;

  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Event handlers (registered once)
  autoUpdater.on('checking-for-update', () => {
    debugLog('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    updateAvailable = true;
    debugLog('Update available:', info.version);

    // Resolve manual check if pending
    if (manualCheckCallback) {
      manualCheckCallback({ status: 'update-available', version: info.version });
      manualCheckCallback = null;
    }

    showUpdateNotification(info.version);
  });

  autoUpdater.on('update-not-available', () => {
    debugLog('No updates available');

    // Resolve manual check if pending
    if (manualCheckCallback) {
      manualCheckCallback({ status: 'up-to-date' });
      manualCheckCallback = null;
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);

    // Resolve manual check if pending
    if (manualCheckCallback) {
      manualCheckCallback({ status: 'error', message: err.message });
      manualCheckCallback = null;
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    debugLog(`Download progress: ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    debugLog('Update downloaded:', info.version);
    showRestartDialog(info.version);
  });
}

/**
 * Check for updates (safe to call multiple times — no duplicate listeners)
 * @param {boolean} manual - Whether this is a user-initiated check
 * @returns {Promise<{status: string, version?: string, message?: string}>}
 */
function checkForUpdates(manual = false) {
  // Ensure listeners are set up
  initUpdater();

  if (manual) {
    return new Promise((resolve) => {
      manualCheckCallback = resolve;

      try {
        autoUpdater.checkForUpdates();
      } catch (err) {
        console.error('Failed to check for updates:', err);
        manualCheckCallback = null;
        resolve({ status: 'error', message: err.message });
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (manualCheckCallback) {
          manualCheckCallback = null;
          resolve({ status: 'error', message: 'Update check timed out' });
        }
      }, 30000);
    });
  }

  // Silent/automatic check at startup
  try {
    autoUpdater.checkForUpdates();
  } catch (err) {
    console.error('Failed to check for updates:', err);
  }
}

/**
 * Show update notification
 */
function showUpdateNotification(version) {
  const focusedWindow =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;

  dialog
    .showMessageBox(focusedWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${version}) of The Real StickyNotes is available.`,
      detail: 'Would you like to download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
    })
    .then(({ response }) => {
      if (response === 0) {
        downloadUpdate();
      }
    });
}

/**
 * Download the update
 */
function downloadUpdate() {
  autoUpdater.downloadUpdate();
}

/**
 * Show restart dialog after download
 */
function showRestartDialog(version) {
  const focusedWindow =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;

  dialog
    .showMessageBox(focusedWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${version} has been downloaded.`,
      detail: 'Restart now to install the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    })
    .then(({ response }) => {
      if (response === 0) {
        quitAndInstall();
      }
    });
}

/**
 * Quit and install update
 */
function quitAndInstall() {
  autoUpdater.quitAndInstall();
}

/**
 * Check if update is available
 */
function isUpdateAvailable() {
  return updateAvailable;
}

/**
 * Check if update is downloaded
 */
function isUpdateDownloaded() {
  return updateDownloaded;
}

module.exports = {
  initUpdater,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  isUpdateAvailable,
  isUpdateDownloaded,
};
