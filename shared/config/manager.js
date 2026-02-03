/**
 * ConfigManager - Hot-reloadable YAML configuration manager
 *
 * Features:
 * - In-memory cache for synchronous reads
 * - File watching with debounce (500ms)
 * - Atomic writes with file locking
 * - Comment preservation using yaml library
 * - EventEmitter for change notifications
 * - Graceful error handling and recovery
 *
 * @example
 * const config = getConfigManager('/path/to/config.yaml');
 * config.watch();
 * config.set('general.startMinimized', true);
 * await config.save();
 * config.on('configChanged', (changedKeys) => {
 *   console.log('Changed:', changedKeys);
 * });
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const chokidar = require('chokidar');
const writeFileAtomic = require('write-file-atomic');

/**
 * ConfigManager class with hot reload and atomic writes
 */
class ConfigManager extends EventEmitter {
  /**
   * Create a ConfigManager instance
   * @param {string} configPath - Absolute path to YAML config file
   */
  constructor(configPath) {
    super();

    if (!configPath || typeof configPath !== 'string') {
      throw new Error('ConfigManager requires a valid config path');
    }

    if (!path.isAbsolute(configPath)) {
      throw new Error('Config path must be absolute');
    }

    this.configPath = configPath;
    this.cache = {}; // In-memory cache for sync reads
    this.document = null; // YAML Document for comment preservation
    this.watcher = null;
    this.saveTimeout = null;
    this.writeLock = false;
    this.watchDebounceTimeout = null;
    this.isWatching = false;

    // Initialize cache by loading from file
    this._loadSync();
  }

  /**
   * Get a config value using dot notation
   * @param {string} key - Config key (e.g., 'general.startMinimized')
   * @returns {any} Config value or undefined if not found
   * @example
   * const startMinimized = config.get('general.startMinimized');
   */
  get(key) {
    if (!key || typeof key !== 'string') {
      return undefined;
    }

    const parts = key.split('.');
    let current = this.cache;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set a config value using dot notation
   * Schedules a save operation (debounced)
   * @param {string} key - Config key (e.g., 'general.startMinimized')
   * @param {any} value - Value to set
   * @throws {Error} If key is invalid
   * @example
   * config.set('general.startMinimized', true);
   */
  set(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Config key must be a non-empty string');
    }

    const parts = key.split('.');
    if (parts.length === 0) {
      throw new Error('Config key cannot be empty');
    }

    // Update cache
    let current = this.cache;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    const oldValue = current[lastPart];
    current[lastPart] = value;

    // Update YAML document if it exists
    if (this.document) {
      try {
        this.document.setIn(parts, value);
      } catch (error) {
        // If document update fails, continue with cache-only update
        this.emit('error', new Error(`Failed to update YAML document: ${error.message}`));
      }
    }

    // Emit change event only if value actually changed
    if (oldValue !== value) {
      this.emit('configChanged', [key]);
    }

    // Schedule save (debounced)
    this._scheduleSave();
  }

  /**
   * Get all config values
   * @returns {object} Deep copy of entire config
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.cache));
  }

  /**
   * Start watching config file for changes
   * Changes are debounced by 500ms
   * @example
   * config.watch();
   * config.on('configChanged', (keys) => console.log('Changed:', keys));
   */
  watch() {
    if (this.isWatching) {
      return;
    }

    try {
      this.watcher = chokidar.watch(this.configPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      this.watcher.on('change', () => {
        this._handleFileChange();
      });

      this.watcher.on('error', (error) => {
        this.emit('error', new Error(`File watcher error: ${error.message}`));
      });

      this.isWatching = true;
    } catch (error) {
      this.emit('error', new Error(`Failed to start file watcher: ${error.message}`));
    }
  }

  /**
   * Stop watching config file
   */
  unwatch() {
    if (this.watcher) {
      try {
        this.watcher.close();
        this.watcher = null;
      } catch (error) {
        this.emit('error', new Error(`Failed to stop file watcher: ${error.message}`));
      }
    }

    if (this.watchDebounceTimeout) {
      clearTimeout(this.watchDebounceTimeout);
      this.watchDebounceTimeout = null;
    }

    this.isWatching = false;
  }

  /**
   * Save config to disk atomically
   * Uses write-file-atomic to prevent corruption
   * @returns {Promise<void>}
   * @throws {Error} If save fails
   */
  async save() {
    try {
      await this._acquireLock();

      // Generate YAML content
      let yamlContent;
      if (this.document) {
        // Preserve comments
        yamlContent = this.document.toString();
      } else {
        // Create new YAML document
        this.document = new YAML.Document(this.cache);
        yamlContent = this.document.toString();
      }

      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Atomic write
      await writeFileAtomic(this.configPath, yamlContent, { encoding: 'utf8' });
    } catch (error) {
      this.emit('error', new Error(`Failed to save config: ${error.message}`));
      throw error;
    } finally {
      this._releaseLock();
    }
  }

  /**
   * Reload config from disk
   * @returns {string[]} Array of changed keys
   */
  reload() {
    const oldCache = JSON.parse(JSON.stringify(this.cache));
    this._loadSync();
    const changedKeys = this._getChangedKeys(oldCache, this.cache);

    if (changedKeys.length > 0) {
      this.emit('configChanged', changedKeys);
    }

    return changedKeys;
  }

  /**
   * Validate config against schema
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    // Import schema validation if available
    try {
      const { validateConfig } = require('./schema');
      return validateConfig(this.cache);
    } catch (error) {
      // Schema validation not available, assume valid
      return { valid: true, errors: [] };
    }
  }

  /**
   * Load config from disk synchronously
   * @private
   */
  _loadSync() {
    try {
      if (!fs.existsSync(this.configPath)) {
        // File doesn't exist, use empty config
        this.cache = {};
        this.document = new YAML.Document({});
        return;
      }

      const fileContents = fs.readFileSync(this.configPath, 'utf8');

      try {
        // Parse YAML preserving comments
        this.document = YAML.parseDocument(fileContents);

        // Check for parse errors
        if (this.document.errors && this.document.errors.length > 0) {
          const errorMsg = this.document.errors[0].message || 'Unknown parse error';
          throw new Error(errorMsg);
        }

        this.cache = this.document.toJSON() || {};
      } catch (parseError) {
        // YAML parse failed - backup corrupt file and reset
        this._handleCorruptFile(parseError);
      }
    } catch (error) {
      // Emit error asynchronously to allow listeners to be registered first
      setImmediate(() => {
        this.emit('error', new Error(`Failed to load config: ${error.message}`));
      });
      this.cache = {};
      this.document = new YAML.Document({});
    }
  }

  /**
   * Handle corrupt config file
   * @private
   * @param {Error} parseError - Parse error
   */
  _handleCorruptFile(parseError) {
    try {
      // Backup corrupt file
      const backupPath = `${this.configPath}.corrupt.${Date.now()}`;
      fs.copyFileSync(this.configPath, backupPath);

      console.error(
        `[ConfigManager] Config file is corrupt. Backed up to: ${backupPath}\n` +
          `Parse error: ${parseError.message}\n` +
          'Regenerating with defaults...'
      );

      // Emit corruption event asynchronously to allow listeners to be registered first
      setImmediate(() => {
        this.emit('corruption', {
          backupPath,
          parseError: parseError.message,
        });
      });

      // Reset to defaults by loading default config
      try {
        const { generateDefaultConfig } = require('./defaults');
        const defaultYaml = generateDefaultConfig();
        this.document = YAML.parseDocument(defaultYaml);
        this.cache = this.document.toJSON() || {};

        // Write defaults to disk
        fs.writeFileSync(this.configPath, defaultYaml, 'utf8');

        console.log('[ConfigManager] Config file regenerated with defaults');
      } catch (resetError) {
        // If we can't load defaults, use empty config
        console.error('[ConfigManager] Failed to load defaults:', resetError.message);
        this.cache = {};
        this.document = new YAML.Document({});
      }

      // Emit error asynchronously to allow listeners to be registered first
      setImmediate(() => {
        this.emit(
          'error',
          new Error(
            `Config file was corrupt and has been backed up to ${backupPath}. ` +
              `Parse error: ${parseError.message}. Config has been reset to defaults.`
          )
        );
      });
    } catch (backupError) {
      console.error(
        '[ConfigManager] Failed to backup corrupt config:',
        backupError.message,
        '\nOriginal parse error:',
        parseError.message
      );

      // Emit error asynchronously to allow listeners to be registered first
      setImmediate(() => {
        this.emit(
          'error',
          new Error(
            `Failed to backup corrupt config file: ${backupError.message}. ` +
              `Original parse error: ${parseError.message}`
          )
        );
      });

      // Still try to reset to defaults
      this.cache = {};
      this.document = new YAML.Document({});
    }
  }

  /**
   * Handle file change event (debounced)
   * @private
   */
  _handleFileChange() {
    // Clear existing timeout
    if (this.watchDebounceTimeout) {
      clearTimeout(this.watchDebounceTimeout);
    }

    // Debounce by 500ms
    this.watchDebounceTimeout = setTimeout(() => {
      try {
        const changedKeys = this.reload();
        if (changedKeys.length > 0) {
          // Event already emitted by reload()
        }
      } catch (error) {
        this.emit('error', new Error(`Failed to reload config on file change: ${error.message}`));
      }
    }, 500);
  }

  /**
   * Schedule a save operation (debounced)
   * @private
   */
  _scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save().catch(() => {
        // Error already emitted by save()
      });
    }, 100);
  }

  /**
   * Acquire write lock
   * Uses simple mutex pattern with timeout
   * @private
   * @returns {Promise<void>}
   */
  async _acquireLock() {
    const startTime = Date.now();
    const timeout = 5000; // 5 second timeout

    while (this.writeLock) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for write lock');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.writeLock = true;
  }

  /**
   * Release write lock
   * @private
   */
  _releaseLock() {
    this.writeLock = false;
  }

  /**
   * Compare two objects and return array of changed keys
   * @private
   * @param {object} oldObj - Old object
   * @param {object} newObj - New object
   * @param {string} prefix - Key prefix for recursion
   * @returns {string[]} Array of changed keys in dot notation
   */
  _getChangedKeys(oldObj, newObj, prefix = '') {
    const changes = [];

    // Get all keys from both objects
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const oldValue = oldObj ? oldObj[key] : undefined;
      const newValue = newObj ? newObj[key] : undefined;

      // Check if both are objects
      const oldIsObject =
        oldValue !== null && typeof oldValue === 'object' && !Array.isArray(oldValue);
      const newIsObject =
        newValue !== null && typeof newValue === 'object' && !Array.isArray(newValue);

      if (oldIsObject && newIsObject) {
        // Recurse into nested objects
        changes.push(...this._getChangedKeys(oldValue, newValue, fullKey));
      } else {
        // Compare values
        if (!this._deepEqual(oldValue, newValue)) {
          changes.push(fullKey);
        }
      }
    }

    return changes;
  }

  /**
   * Deep equality check
   * @private
   * @param {any} a - First value
   * @param {any} b - Second value
   * @returns {boolean} True if equal
   */
  _deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this._deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!this._deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.unwatch();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    this.removeAllListeners();
  }
}

/**
 * Singleton instance cache
 * Maps config path to ConfigManager instance
 */
const instances = new Map();

/**
 * Get or create ConfigManager instance (singleton pattern)
 * @param {string} configPath - Absolute path to config file
 * @returns {ConfigManager} ConfigManager instance
 */
function getConfigManager(configPath) {
  if (!configPath) {
    throw new Error('Config path is required');
  }

  const normalizedPath = path.normalize(configPath);

  if (!instances.has(normalizedPath)) {
    instances.set(normalizedPath, new ConfigManager(normalizedPath));
  }

  return instances.get(normalizedPath);
}

/**
 * Clear all singleton instances (for testing)
 */
function clearInstances() {
  for (const instance of instances.values()) {
    instance.destroy();
  }
  instances.clear();
}

module.exports = {
  ConfigManager,
  getConfigManager,
  clearInstances,
};
