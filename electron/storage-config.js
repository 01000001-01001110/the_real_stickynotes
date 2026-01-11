/**
 * Storage Configuration Module
 *
 * Handles the storage path configuration that must be read BEFORE
 * the database is initialized (chicken-and-egg problem).
 *
 * The config file is always stored in the DEFAULT platform location,
 * not the custom path, so it can always be found on startup.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILENAME = 'storage-config.json';

/**
 * Get the default platform-specific app data path
 * This is where storage-config.json is always stored
 * @returns {string}
 */
function getDefaultConfigDir() {
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
 * Get the full path to the storage config file
 * @returns {string}
 */
function getConfigPath() {
  return path.join(getDefaultConfigDir(), CONFIG_FILENAME);
}

/**
 * Ensure the config directory exists
 */
function ensureConfigDir() {
  const configDir = getDefaultConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Read the storage configuration
 * @returns {{ dataPath: string|null }}
 */
function getStorageConfig() {
  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      return {
        dataPath: config.dataPath || null,
      };
    }
  } catch (err) {
    console.error('[StorageConfig] Failed to read config:', err.message);
  }

  return { dataPath: null };
}

/**
 * Save the storage configuration
 * @param {string|null} dataPath - Custom data path or null for default
 */
function setStorageConfig(dataPath) {
  ensureConfigDir();
  const configPath = getConfigPath();

  const config = {
    dataPath: dataPath || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[StorageConfig] Config saved:', configPath);
  } catch (err) {
    console.error('[StorageConfig] Failed to save config:', err.message);
    throw err;
  }
}

/**
 * Clear the custom storage path (reset to default)
 */
function clearStorageConfig() {
  setStorageConfig(null);
}

module.exports = {
  getDefaultConfigDir,
  getConfigPath,
  getStorageConfig,
  setStorageConfig,
  clearStorageConfig,
};
