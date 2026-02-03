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

/**
 * Check for updates
 */
function checkForUpdates() {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    debugLog('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    updateAvailable = true;
    debugLog('Update available:', info.version);
    showUpdateNotification(info.version);
  });

  autoUpdater.on('update-not-available', () => {
    debugLog('No updates available');
  });

  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
  });

  autoUpdater.on('download-progress', (progress) => {
    debugLog(`Download progress: ${progress.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    debugLog('Update downloaded:', info.version);
    showRestartDialog(info.version);
  });

  // Check for updates
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
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  isUpdateAvailable,
  isUpdateDownloaded,
};
