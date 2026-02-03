/**
 * Unified Config Interface
 *
 * Provides a single entry point for configuration management.
 * Routes settings between YAML (user-editable) and SQLite (complex state).
 *
 * @module shared/config
 */

const path = require('path');
const fs = require('fs');
const { getConfigManager } = require('./manager');
const { generateDefaultConfig, shouldMigrateToYAML } = require('./defaults');
const { getDataPath } = require('../utils/paths');

/**
 * Global ConfigManager instance
 * @type {ConfigManager|null}
 */
let configManager = null;

/**
 * Path to config.yaml
 * @type {string|null}
 */
let configPath = null;

/**
 * Initialize the config system
 *
 * This should be called during app startup (Phase 2 initialization)
 * AFTER database initialization (Phase 1)
 *
 * @returns {ConfigManager} ConfigManager instance
 */
function initConfig() {
  if (configManager) {
    return configManager;
  }

  // Get config path in data directory
  configPath = path.join(getDataPath(), 'config.yaml');

  // Ensure config file exists
  if (!fs.existsSync(configPath)) {
    // Create default config file
    const defaultConfig = generateDefaultConfig();
    const dir = path.dirname(configPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write default config
    fs.writeFileSync(configPath, defaultConfig, 'utf8');

    // Run migration from SQLite if needed
    const { migrateFromSQLite } = require('./migration');
    try {
      migrateFromSQLite(configPath);
    } catch (error) {
      console.error('Config migration failed:', error.message);
      // Continue with defaults if migration fails
    }
  }

  // Create ConfigManager instance
  configManager = getConfigManager(configPath);

  // Start file watching for hot reload
  configManager.watch();

  return configManager;
}

/**
 * Get the ConfigManager instance
 *
 * @returns {ConfigManager} ConfigManager instance
 * @throws {Error} If config not initialized
 */
function getConfig() {
  if (!configManager) {
    throw new Error('Config not initialized. Call initConfig() first.');
  }
  return configManager;
}

/**
 * Subscribe to configuration changes
 *
 * @param {Function} callback - Callback function (changedKeys: string[]) => void
 * @example
 * onConfigChange((changedKeys) => {
 *   if (changedKeys.some(k => k.startsWith('shortcuts.'))) {
 *     reloadShortcuts();
 *   }
 * });
 */
function onConfigChange(callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }

  const config = getConfig();
  config.on('configChanged', callback);
}

/**
 * Unsubscribe from configuration changes
 *
 * @param {Function} callback - Callback function to remove
 */
function offConfigChange(callback) {
  if (!configManager) {
    return;
  }
  configManager.off('configChanged', callback);
}

/**
 * Get a configuration value
 *
 * Convenience wrapper around getConfig().get()
 *
 * @param {string} key - Dot-notation config key (e.g., 'general.startMinimized')
 * @returns {any} Config value or undefined
 */
function getConfigValue(key) {
  return getConfig().get(key);
}

/**
 * Set a configuration value
 *
 * Convenience wrapper around getConfig().set()
 *
 * @param {string} key - Dot-notation config key
 * @param {any} value - Value to set
 */
function setConfigValue(key, value) {
  getConfig().set(key, value);
}

/**
 * Get all configuration values
 *
 * @returns {object} All config values
 */
function getAllConfig() {
  return getConfig().getAll();
}

/**
 * Reload configuration from disk
 *
 * @returns {string[]} Array of changed keys
 */
function reloadConfig() {
  return getConfig().reload();
}

/**
 * Save configuration to disk
 *
 * @returns {Promise<void>}
 */
async function saveConfig() {
  return getConfig().save();
}

/**
 * Validate configuration against schema
 *
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateConfig() {
  return getConfig().validate();
}

/**
 * Destroy config manager instance
 * Used for cleanup on app shutdown or testing
 */
function destroyConfig() {
  if (configManager) {
    configManager.destroy();
    configManager = null;
  }
}

/**
 * Check if config system is initialized
 *
 * @returns {boolean} True if initialized
 */
function isConfigInitialized() {
  return configManager !== null;
}

/**
 * Get the config file path
 *
 * @returns {string|null} Path to config.yaml or null if not initialized
 */
function getConfigPath() {
  return configPath;
}

module.exports = {
  // Initialization
  initConfig,
  getConfig,
  isConfigInitialized,
  destroyConfig,

  // Value access
  getConfigValue,
  setConfigValue,
  getAllConfig,

  // File operations
  reloadConfig,
  saveConfig,
  validateConfig,
  getConfigPath,

  // Event subscription
  onConfigChange,
  offConfigChange,

  // Re-export for convenience
  shouldMigrateToYAML,
};
