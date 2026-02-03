/**
 * Path utilities for the application
 *
 * Supports custom data paths for cloud storage (Dropbox, OneDrive, Google Drive, iCloud).
 * Custom path is set via initializeCustomDataPath() at startup, reading from storage-config.json.
 *
 * Also supports portable mode when a 'portable.txt' marker file exists next to the executable.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

// Custom path state - set once at startup before database initialization
let cachedCustomPath = null;
let customPathInitialized = false;

// Portable mode state - cached after first check
let portableModeChecked = false;
let isPortable = false;
let portableDataPath = null;

/**
 * Initialize custom data path (called from main.js before database init)
 * @param {string|null} customPath - Custom path or null for default
 */
function initializeCustomDataPath(customPath) {
  if (customPathInitialized) {
    console.warn('[Paths] Custom path already initialized, ignoring');
    return;
  }
  cachedCustomPath = customPath;
  customPathInitialized = true;
  if (customPath) {
    console.log('[Paths] Using custom data path:', customPath);
  } else {
    console.log('[Paths] Using default data path');
  }
}

/**
 * Check if custom path has been initialized
 * @returns {boolean}
 */
function isCustomPathInitialized() {
  return customPathInitialized;
}

/**
 * Check if using a custom path
 * @returns {boolean}
 */
function isUsingCustomPath() {
  return cachedCustomPath !== null;
}

/**
 * Check if the application is running in portable mode
 * Portable mode is enabled by placing a 'portable.txt' file next to the executable
 * In development mode, always returns false
 * @returns {boolean} True if portable mode is active
 */
function isPortableMode() {
  // Return cached result if already checked
  if (portableModeChecked) {
    return isPortable;
  }

  // In development mode, never portable
  if (process.env.NODE_ENV === 'development') {
    portableModeChecked = true;
    isPortable = false;
    return false;
  }

  // Check if running as packaged app (electron check)
  try {
    // Try to access electron app - if it fails, we're not in electron context
    const { app } = require('electron');
    if (!app.isPackaged) {
      portableModeChecked = true;
      isPortable = false;
      return false;
    }
  } catch (error) {
    // Not in electron context, fall through to check anyway
    // This allows CLI usage of portable mode
  }

  try {
    // Get directory containing the executable
    const exeDir = path.dirname(process.execPath);
    const markerPath = path.join(exeDir, 'portable.txt');

    // Check if marker file exists
    isPortable = fs.existsSync(markerPath);
    portableModeChecked = true;

    if (isPortable) {
      // Cache the portable data path
      portableDataPath = path.join(exeDir, 'StickyNotes_Data');
      console.log('[Paths] Portable mode detected, using:', portableDataPath);
    }

    return isPortable;
  } catch (error) {
    console.error('[Paths] Error checking portable mode:', error.message);
    portableModeChecked = true;
    isPortable = false;
    return false;
  }
}

/**
 * Get the portable mode data path
 * Returns null if not in portable mode
 * @returns {string|null} Path to portable data directory or null
 */
function getPortableDataPath() {
  if (!isPortableMode()) {
    return null;
  }
  return portableDataPath;
}

/**
 * Reset portable mode cache (for testing)
 * @private
 */
function _resetPortableModeCache() {
  portableModeChecked = false;
  isPortable = false;
  portableDataPath = null;
}

/**
 * Get the default platform-specific app data path
 * Always returns the default path regardless of custom path setting
 * @returns {string} Default path for current platform
 */
function getDefaultDataPath() {
  const appName = 'StickyNotes';

  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        appName
      );
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName);
    default:
      return path.join(os.homedir(), '.config', appName.toLowerCase());
  }
}

/**
 * Get the application data directory
 * Priority order:
 * 1. Portable mode path (if portable.txt exists)
 * 2. Custom path from storage-config.json (if set)
 * 3. Default platform-specific path
 * @returns {string} Path to app data directory
 */
function getAppDataPath() {
  // Priority 1: Portable mode
  const portablePath = getPortableDataPath();
  if (portablePath) {
    return portablePath;
  }

  // Priority 2: Custom path
  if (cachedCustomPath) {
    return cachedCustomPath;
  }

  // Priority 3: Default path
  return getDefaultDataPath();
}

/**
 * Alias for getAppDataPath (for backwards compatibility)
 * @returns {string} Path to app data directory
 */
const getDataPath = getAppDataPath;

/**
 * Get the database file path
 * @param {string} customPath - Optional custom path (overrides everything)
 * @returns {string} Path to database file
 */
function getDatabasePath(customPath = '') {
  if (customPath) {
    return customPath;
  }
  // Check environment variable for custom path (useful for testing)
  if (process.env.STICKYNOTES_DB_PATH) {
    return process.env.STICKYNOTES_DB_PATH;
  }
  return path.join(getAppDataPath(), 'stickynotes.db');
}

/**
 * Get the attachments directory path
 * @param {string} customPath - Optional custom path
 * @returns {string} Path to attachments directory
 */
function getAttachmentsPath(customPath = '') {
  if (customPath) {
    return customPath;
  }
  return path.join(getAppDataPath(), 'attachments');
}

/**
 * Get the backups directory path
 * Always uses DEFAULT path (backups stay local, not synced to cloud)
 * @returns {string} Path to backups directory
 */
function getBackupsPath() {
  return path.join(getDefaultDataPath(), 'backups');
}

/**
 * Get the logs directory path
 * Always uses DEFAULT path (logs stay local, not synced to cloud)
 * @returns {string} Path to logs directory
 */
function getLogsPath() {
  return path.join(getDefaultDataPath(), 'logs');
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Path to directory
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Ensure all app directories exist
 */
function ensureAppDirs() {
  // Main data directories (may be custom path)
  ensureDir(getAppDataPath());
  ensureDir(getAttachmentsPath());

  // Local-only directories (always default path)
  ensureDir(getBackupsPath());
  ensureDir(getLogsPath());
}

/**
 * Validate a path is usable for data storage
 * @param {string} targetPath - Path to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDataPath(targetPath) {
  if (!targetPath) {
    return { valid: false, error: 'Path is empty' };
  }

  // Normalize and resolve the path
  const normalizedPath = path.resolve(targetPath);

  // Check if path exists
  if (!fs.existsSync(normalizedPath)) {
    // Try to create it
    try {
      fs.mkdirSync(normalizedPath, { recursive: true });
    } catch (err) {
      return { valid: false, error: 'Cannot create folder: ' + err.message };
    }
  }

  // Check if it's a directory
  try {
    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return { valid: false, error: 'Path is not a folder' };
    }
  } catch (err) {
    return { valid: false, error: 'Cannot access folder: ' + err.message };
  }

  // Check if writable by creating a test file
  const testFile = path.join(normalizedPath, '.stickynotes-write-test');
  try {
    fs.writeFileSync(testFile, 'test', 'utf8');
    fs.unlinkSync(testFile);
  } catch (err) {
    return { valid: false, error: 'Folder is not writable: ' + err.message };
  }

  // Check it's not the same as current path
  const currentPath = getAppDataPath();
  if (path.resolve(currentPath) === normalizedPath) {
    return { valid: false, error: 'Same as current storage location' };
  }

  return { valid: true };
}

/**
 * Check if a path contains existing StickyNotes data
 * @param {string} targetPath - Path to check
 * @returns {{ hasData: boolean, files: string[] }}
 */
function checkExistingData(targetPath) {
  const files = [];
  const normalizedPath = path.resolve(targetPath);

  // Check for database
  const dbPath = path.join(normalizedPath, 'stickynotes.db');
  if (fs.existsSync(dbPath)) {
    files.push('stickynotes.db');
  }

  // Check for attachments directory
  const attachmentsPath = path.join(normalizedPath, 'attachments');
  if (fs.existsSync(attachmentsPath)) {
    files.push('attachments/');
  }

  return {
    hasData: files.length > 0,
    files,
  };
}

/**
 * Get storage statistics for a data path
 * @param {string} dataPath - Path to analyze
 * @returns {{ dbSize: number, attachmentCount: number, attachmentSize: number, totalSize: number }}
 */
function getStorageStats(dataPath) {
  const stats = {
    dbSize: 0,
    attachmentCount: 0,
    attachmentSize: 0,
    totalSize: 0,
  };

  const normalizedPath = path.resolve(dataPath);

  // Database size
  const dbPath = path.join(normalizedPath, 'stickynotes.db');
  if (fs.existsSync(dbPath)) {
    try {
      stats.dbSize = fs.statSync(dbPath).size;
      // Also count WAL and SHM files
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) {
        stats.dbSize += fs.statSync(walPath).size;
      }
      if (fs.existsSync(shmPath)) {
        stats.dbSize += fs.statSync(shmPath).size;
      }
    } catch (err) {
      console.error('[Paths] Error reading db stats:', err.message);
    }
  }

  // Attachments
  const attachmentsPath = path.join(normalizedPath, 'attachments');
  if (fs.existsSync(attachmentsPath)) {
    try {
      const countDirFiles = (dir) => {
        let count = 0;
        let size = 0;
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            const sub = countDirFiles(itemPath);
            count += sub.count;
            size += sub.size;
          } else {
            count++;
            size += fs.statSync(itemPath).size;
          }
        }
        return { count, size };
      };
      const attachStats = countDirFiles(attachmentsPath);
      stats.attachmentCount = attachStats.count;
      stats.attachmentSize = attachStats.size;
    } catch (err) {
      console.error('[Paths] Error reading attachment stats:', err.message);
    }
  }

  stats.totalSize = stats.dbSize + stats.attachmentSize;

  return stats;
}

module.exports = {
  initializeCustomDataPath,
  isCustomPathInitialized,
  isUsingCustomPath,
  isPortableMode,
  getPortableDataPath,
  getDefaultDataPath,
  getAppDataPath,
  getDataPath, // Alias for getAppDataPath
  getDatabasePath,
  getAttachmentsPath,
  getBackupsPath,
  getLogsPath,
  ensureDir,
  ensureAppDirs,
  validateDataPath,
  checkExistingData,
  getStorageStats,
  _resetPortableModeCache, // Exported for testing
};
