/**
 * Settings CRUD operations
 */
const { getDatabase } = require('./index');
const {
  settingsSchema,
  getSettingDefault,
  parseSettingValue,
  isValidSettingKey,
  getSettingType,
} = require('../constants/settings');

/**
 * Validate that a setting value matches its expected type
 * @param {string} key - Setting key
 * @param {any} value - Setting value to validate
 * @returns {object} {valid: boolean, error?: string}
 */
function validateSettingType(key, value) {
  const type = getSettingType(key);

  // If type is unknown, allow any value
  if (!type) {
    return { valid: true };
  }

  switch (type) {
    case 'boolean': {
      // Accept boolean values
      if (typeof value === 'boolean') {
        return { valid: true };
      }
      // Accept strings that can be parsed as boolean
      if (typeof value === 'string') {
        if (value === 'true' || value === 'false' || value === '0' || value === '1') {
          return { valid: true };
        }
      }
      // Accept numbers 0 and 1
      if (typeof value === 'number') {
        if (value === 0 || value === 1) {
          return { valid: true };
        }
      }
      return {
        valid: false,
        error: `Setting "${key}" expects boolean, got ${typeof value}: ${value}`,
      };
    }
    case 'number': {
      // Accept number type
      if (typeof value === 'number') {
        if (!isNaN(value)) {
          return { valid: true };
        }
      }
      // Accept strings that can be parsed as numbers
      if (typeof value === 'string') {
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') {
          return { valid: true };
        }
      }
      return {
        valid: false,
        error: `Setting "${key}" expects number, got ${typeof value}: ${value}`,
      };
    }
    case 'string': {
      // Accept string type
      if (typeof value === 'string') {
        return { valid: true };
      }
      // Accept numbers and booleans that can be stringified
      if (typeof value === 'number' || typeof value === 'boolean') {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Setting "${key}" expects string, got ${typeof value}: ${value}`,
      };
    }
    default:
      return { valid: true };
  }
}

/**
 * Validate that a setting value is within its allowed range
 * @param {string} key - Setting key
 * @param {any} value - Setting value to validate (should be parsed to correct type first)
 * @returns {object} {valid: boolean, error?: string}
 */
function validateSettingRange(key, value) {
  const setting = settingsSchema[key];

  // If setting doesn't exist or is not a number, skip range validation
  if (!setting || setting.type !== 'number') {
    return { valid: true };
  }

  // Convert to number for range checking
  const numValue = typeof value === 'string' ? Number(value) : value;

  // Check minimum value
  if (typeof setting.min !== 'undefined' && numValue < setting.min) {
    return {
      valid: false,
      error: `Setting "${key}" must be at least ${setting.min}, got ${numValue}`,
    };
  }

  // Check maximum value
  if (typeof setting.max !== 'undefined' && numValue > setting.max) {
    return {
      valid: false,
      error: `Setting "${key}" must be at most ${setting.max}, got ${numValue}`,
    };
  }

  return { valid: true };
}

/**
 * Validate that a setting value is one of the allowed options
 * @param {string} key - Setting key
 * @param {any} value - Setting value to validate (should be parsed to correct type first)
 * @returns {object} {valid: boolean, error?: string}
 */
function validateSettingOptions(key, value) {
  const setting = settingsSchema[key];

  // If setting doesn't exist or has no options array, skip options validation
  if (!setting || !Array.isArray(setting.options)) {
    return { valid: true };
  }

  // Convert value to string for comparison (options are always strings)
  const stringValue = String(value);

  // Check if value is in the allowed options
  if (!setting.options.includes(stringValue)) {
    return {
      valid: false,
      error: `Setting "${key}" must be one of [${setting.options.map((o) => `'${o}'`).join(', ')}], got '${stringValue}'`,
    };
  }

  return { valid: true };
}

/**
 * Get a setting value
 * Routes to YAML config for migratable settings, SQLite for others
 * @param {string} key - Setting key
 * @returns {any} Setting value (parsed to correct type)
 */
function getSetting(key) {
  // Try to route to YAML config if initialized and setting should be in YAML
  try {
    const { isConfigInitialized, getConfig, shouldMigrateToYAML } = require('../config');

    if (isConfigInitialized() && shouldMigrateToYAML(key)) {
      const value = getConfig().get(key);
      // If value exists in YAML, return it
      if (value !== undefined) {
        return value;
      }
      // Fall through to default if not in YAML
    }
  } catch (error) {
    // Config system not available, fall back to SQLite
  }

  // SQLite-only settings (hints.*, etc.)
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);

  if (row) {
    return parseSettingValue(key, row.value);
  }

  return getSettingDefault(key);
}

/**
 * Set a setting value
 * Routes to YAML config for migratable settings, SQLite for others
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {boolean} Success
 * @throws {Error} If key is unknown or value type does not match the setting's expected type
 */
function setSetting(key, value) {
  // Validate key exists in schema
  if (!isValidSettingKey(key)) {
    throw new Error(`Unknown setting key: "${key}"`);
  }

  // Validate value matches expected type
  const validation = validateSettingType(key, value);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Validate value is within range (for number settings)
  const rangeValidation = validateSettingRange(key, value);
  if (!rangeValidation.valid) {
    throw new Error(rangeValidation.error);
  }

  // Validate value is one of the allowed options (for enum-like settings)
  const optionsValidation = validateSettingOptions(key, value);
  if (!optionsValidation.valid) {
    throw new Error(optionsValidation.error);
  }

  // Try to route to YAML config if initialized and setting should be in YAML
  try {
    const { isConfigInitialized, getConfig, shouldMigrateToYAML } = require('../config');

    if (isConfigInitialized() && shouldMigrateToYAML(key)) {
      getConfig().set(key, value);
      return true;
    }
  } catch (error) {
    // Config system not available, fall back to SQLite
  }

  // SQLite-only settings (hints.*, etc.)
  const db = getDatabase();
  const now = new Date().toISOString();
  const stringValue = value === null ? null : String(value);

  db.prepare(
    `
    INSERT INTO settings (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
  `
  ).run({ key, value: stringValue, updated_at: now });

  return true;
}

/**
 * Get all settings
 * Merges YAML config settings with SQLite settings
 * @returns {object} Object with all settings
 */
function getAllSettings() {
  // Start with defaults
  const settings = {};
  for (const [key, schema] of Object.entries(settingsSchema)) {
    settings[key] = schema.default;
  }

  // Try to get YAML config settings
  try {
    const { isConfigInitialized, getConfig, shouldMigrateToYAML } = require('../config');

    if (isConfigInitialized()) {
      const config = getConfig();

      // Merge YAML settings
      for (const key of Object.keys(settingsSchema)) {
        if (shouldMigrateToYAML(key)) {
          const value = config.get(key);
          if (value !== undefined) {
            settings[key] = value;
          }
        }
      }
    }
  } catch (error) {
    // Config system not available, will use SQLite only
  }

  // Override with SQLite values (for hints.*, etc.)
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM settings').all();

  for (const row of rows) {
    // Only use SQLite values for non-YAML settings
    try {
      const { shouldMigrateToYAML } = require('../config');
      if (!shouldMigrateToYAML(row.key)) {
        settings[row.key] = parseSettingValue(row.key, row.value);
      }
    } catch (error) {
      // Fallback: use all SQLite values if config not available
      settings[row.key] = parseSettingValue(row.key, row.value);
    }
  }

  return settings;
}

/**
 * Reset a setting to default
 * @param {string} key - Setting key
 * @returns {boolean} Success
 */
function resetSetting(key) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  return result.changes > 0;
}

/**
 * Reset all settings to defaults
 * @returns {number} Number of settings reset
 */
function resetAllSettings() {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM settings').run();
  return result.changes;
}

/**
 * Get settings by category
 * @param {string} category - Category prefix (e.g., 'general', 'appearance')
 * @returns {object} Settings in that category
 */
function getSettingsByCategory(category) {
  const all = getAllSettings();
  const categorySettings = {};
  const prefix = category + '.';

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(prefix)) {
      const shortKey = key.substring(prefix.length);
      categorySettings[shortKey] = value;
    }
  }

  return categorySettings;
}

/**
 * Bulk set settings
 * @param {object} settings - Object of key-value pairs
 * @throws {Error} If any key is unknown or value type does not match its setting's expected type
 */
function setSettings(settings) {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Validate all settings first (key, type, range, and options)
  for (const [key, value] of Object.entries(settings)) {
    // Validate key exists in schema
    if (!isValidSettingKey(key)) {
      throw new Error(`Unknown setting key: "${key}"`);
    }

    const typeValidation = validateSettingType(key, value);
    if (!typeValidation.valid) {
      throw new Error(typeValidation.error);
    }

    const rangeValidation = validateSettingRange(key, value);
    if (!rangeValidation.valid) {
      throw new Error(rangeValidation.error);
    }

    const optionsValidation = validateSettingOptions(key, value);
    if (!optionsValidation.valid) {
      throw new Error(optionsValidation.error);
    }
  }

  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
  `);

  const transaction = db.transaction((items) => {
    for (const [key, value] of Object.entries(items)) {
      stmt.run({ key, value: value === null ? null : String(value), updated_at: now });
    }
  });

  transaction(settings);
}

module.exports = {
  getSetting,
  setSetting,
  getAllSettings,
  resetSetting,
  resetAllSettings,
  getSettingsByCategory,
  setSettings,
  validateSettingType,
  validateSettingRange,
  validateSettingOptions,
};
