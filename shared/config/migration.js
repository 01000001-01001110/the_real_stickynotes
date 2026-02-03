/**
 * Settings Migration System
 * SQLite to YAML migration with version tracking
 *
 * MIGRATION STRATEGY:
 * 1. On startup, check if config.yaml exists
 * 2. If not, read all migratable settings from SQLite
 * 3. Generate config.yaml with inline comments using defaults
 * 4. Write version marker to SQLite: settings_migrated_to_yaml: true
 * 5. On subsequent runs, if marker exists, use YAML only for those settings
 * 6. Keep SQLite settings read-only for 30-day rollback period
 *
 * @module shared/config/migration
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { shouldMigrateToYAML } = require('./defaults');
const { getSetting, setSetting, getAllSettings } = require('../database/settings');
const { settingsSchema, SETTINGS_SCHEMA_VERSION } = require('../constants/settings');

/**
 * Migration tracking constants
 */
const MIGRATION_MARKER = 'settings_migrated_to_yaml';
const MIGRATION_DATE_KEY = 'settings_migration_date';
const SCHEMA_VERSION_KEY = 'config_schema_version';

/**
 * Check if migration has already been completed
 * @returns {boolean} True if migration marker exists in SQLite
 */
function isMigrationComplete() {
  try {
    return getSetting(MIGRATION_MARKER) === true;
  } catch (error) {
    // If database isn't initialized yet, migration isn't complete
    return false;
  }
}

/**
 * Get the date when migration was performed
 * @returns {string|null} ISO date string or null if not migrated
 */
function getMigrationDate() {
  try {
    const date = getSetting(MIGRATION_DATE_KEY);
    return date || null;
  } catch (error) {
    return null;
  }
}

/**
 * Transform flat setting keys to nested YAML structure
 * Example: 'general.startMinimized' → { general: { startMinimized: true } }
 * @param {object} flatSettings - Object with dot-notation keys
 * @returns {object} Nested object suitable for YAML
 */
function flatToNested(flatSettings) {
  const nested = {};

  for (const [key, value] of Object.entries(flatSettings)) {
    setNestedValue(nested, key.split('.'), value);
  }

  return nested;
}

/**
 * Set a value in a nested object using a path array
 * @param {object} obj - Object to modify
 * @param {string[]} path - Path components
 * @param {any} value - Value to set
 */
function setNestedValue(obj, path, value) {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    if (!current[path[i]]) {
      current[path[i]] = {};
    }
    current = current[path[i]];
  }

  current[path[path.length - 1]] = value;
}

/**
 * Generate YAML content with inline comments from schema
 * @param {object} config - Nested config object
 * @returns {string} YAML string with comments
 */
function generateYamlWithComments(config) {
  const doc = new YAML.Document(config);

  // Add header comment
  doc.commentBefore = ` StickyNotes Configuration
 ========================
 Edit this file directly - changes apply automatically.
 Delete this file to reset all settings to defaults.

 Schema Version: ${SETTINGS_SCHEMA_VERSION}
 Documentation: https://stickynotes.app/docs/config`;

  // Add inline comments from schema
  addSchemaComments(doc.contents, '', doc);

  // Add footer note about SQLite-only settings
  const yamlStr = doc.toString();
  return (
    yamlStr +
    '\n# Note: Some settings (hints.*) are stored in SQLite\n' +
    '#       These require special handling and are not user-editable via YAML.\n'
  );
}

/**
 * Recursively add comments from schema to YAML document nodes
 * @param {object} node - YAML document node
 * @param {string} prefix - Current path prefix (e.g., 'general')
 * @param {object} doc - Root YAML document
 */
function addSchemaComments(node, prefix, doc) {
  if (!node || !node.items) return;

  for (const pair of node.items) {
    if (!pair.key || !pair.key.value) continue;

    const key = pair.key.value;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const schema = settingsSchema[fullKey];

    if (schema && schema.description) {
      // Add comment before the key
      pair.key.commentBefore = ` ${schema.description}`;

      // Add type and constraints info
      const constraints = [];
      if (schema.type === 'number' && (schema.min !== undefined || schema.max !== undefined)) {
        if (schema.min !== undefined && schema.max !== undefined) {
          constraints.push(`Range: ${schema.min}-${schema.max}`);
        } else if (schema.min !== undefined) {
          constraints.push(`Min: ${schema.min}`);
        } else if (schema.max !== undefined) {
          constraints.push(`Max: ${schema.max}`);
        }
      }
      if (schema.options) {
        constraints.push(`Options: ${schema.options.join(', ')}`);
      }
      if (schema.requiresRestart) {
        constraints.push('Requires restart');
      }

      if (constraints.length > 0) {
        pair.key.commentBefore += `\n ${constraints.join(' | ')}`;
      }
    }

    // Recurse into nested objects
    if (pair.value && pair.value.items) {
      addSchemaComments(pair.value, fullKey, doc);
    }
  }
}

/**
 * Perform migration from SQLite to YAML
 * @param {string} configPath - Absolute path to config.yaml file
 * @returns {object} Migration result { success: boolean, migrated: number, skipped: number, errors?: string[] }
 */
function migrateToYaml(configPath) {
  const errors = [];

  try {
    // Validate config path
    if (!configPath || typeof configPath !== 'string') {
      throw new Error('Invalid config path provided');
    }

    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      throw new Error(`Config directory does not exist: ${configDir}`);
    }

    // 1. Get all settings from SQLite
    let allSettings;
    try {
      allSettings = getAllSettings();
    } catch (error) {
      throw new Error(`Failed to read settings from SQLite: ${error.message}`);
    }

    // 2. Filter to migratable settings only
    const toMigrate = {};
    let skippedCount = 0;

    for (const [key, value] of Object.entries(allSettings)) {
      if (shouldMigrateToYAML(key)) {
        // Validate setting exists in schema
        if (settingsSchema[key]) {
          toMigrate[key] = value;
        } else {
          errors.push(`Warning: Unknown setting skipped: ${key}`);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    // 3. Transform flat keys to nested YAML structure
    const yamlConfig = flatToNested(toMigrate);

    // Add schema version
    yamlConfig.schemaVersion = SETTINGS_SCHEMA_VERSION;

    // 4. Generate YAML with comments
    const yamlContent = generateYamlWithComments(yamlConfig);

    // 5. Write config file atomically
    try {
      // Create backup if file already exists
      if (fs.existsSync(configPath)) {
        const backupPath = `${configPath}.backup-${Date.now()}`;
        fs.copyFileSync(configPath, backupPath);
        errors.push(`Info: Existing config backed up to ${backupPath}`);
      }

      fs.writeFileSync(configPath, yamlContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write config file: ${error.message}`);
    }

    // 6. Set migration marker in SQLite
    try {
      setSetting(MIGRATION_MARKER, true);
      setSetting(MIGRATION_DATE_KEY, new Date().toISOString());
      setSetting(SCHEMA_VERSION_KEY, SETTINGS_SCHEMA_VERSION);
    } catch (error) {
      throw new Error(`Failed to set migration marker: ${error.message}`);
    }

    return {
      success: true,
      migrated: Object.keys(toMigrate).length,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    errors.push(`Migration failed: ${error.message}`);
    return {
      success: false,
      migrated: 0,
      skipped: 0,
      errors,
    };
  }
}

/**
 * Check if rollback period has expired (30 days)
 * After this period, SQLite settings can be safely cleaned up
 * @returns {boolean} True if more than 30 days since migration
 */
function isRollbackPeriodExpired() {
  const migrationDate = getMigrationDate();
  if (!migrationDate) {
    return false;
  }

  const daysSinceMigration =
    (Date.now() - new Date(migrationDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceMigration > 30;
}

/**
 * Get list of settings that should be migrated to YAML
 * Useful for validation and documentation
 * @returns {string[]} Array of setting keys
 */
function getMigratableSettings() {
  return Object.keys(settingsSchema).filter((key) => shouldMigrateToYAML(key));
}

/**
 * Get list of settings that stay in SQLite
 * @returns {string[]} Array of setting keys
 */
function getSqliteOnlySettings() {
  return Object.keys(settingsSchema).filter((key) => !shouldMigrateToYAML(key));
}

/**
 * Validate that config.yaml contains expected settings
 * @param {object} yamlConfig - Parsed YAML config object (nested format)
 * @returns {object} { valid: boolean, missing: string[], unexpected: string[] }
 */
function validateMigratedConfig(yamlConfig) {
  const migratableKeys = getMigratableSettings();
  const yamlKeys = flattenKeys(yamlConfig);

  const missing = migratableKeys.filter((key) => !yamlKeys.includes(key));
  const unexpected = yamlKeys.filter((key) => !settingsSchema[key] && key !== 'schemaVersion');

  return {
    valid: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}

/**
 * Flatten nested object keys to dot-notation
 * @param {object} obj - Nested object
 * @param {string} prefix - Current prefix
 * @returns {string[]} Array of flat keys
 */
function flattenKeys(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

module.exports = {
  // Core migration functions
  migrateToYaml,
  isMigrationComplete,
  getMigrationDate,
  isRollbackPeriodExpired,

  // Setting classification
  shouldMigrateSetting: shouldMigrateToYAML,
  getMigratableSettings,
  getSqliteOnlySettings,

  // Validation
  validateMigratedConfig,

  // Utilities
  flatToNested,

  // Constants
  MIGRATION_MARKER,
  MIGRATION_DATE_KEY,
  SCHEMA_VERSION_KEY,
};
