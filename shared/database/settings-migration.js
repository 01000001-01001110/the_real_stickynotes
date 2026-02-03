/**
 * Settings Schema Migration
 *
 * Handles migration of settings when schema version changes.
 * Settings schema version is stored in the database and compared
 * with SETTINGS_SCHEMA_VERSION from constants/settings.js.
 *
 * Migration History:
 * - v1: Initial schema
 * - v2: Sherpa-ONNX migration (later removed)
 * - v3: Removed voice transcription feature entirely
 */
const { SETTINGS_SCHEMA_VERSION, settingsSchema } = require('../constants/settings');

const SCHEMA_VERSION_KEY = '_schemaVersion';

// Internal reference to db, set by runSettingsMigrations
let _db = null;

/**
 * Get the current schema version from the database
 * @returns {number} Current schema version (0 if not set)
 */
function getCurrentSchemaVersion() {
  const db = _db;

  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SCHEMA_VERSION_KEY);
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Set the schema version in the database
 * @param {number} version - New schema version
 */
function setSchemaVersion(version) {
  const db = _db;
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO settings (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @updated_at
  `
  ).run({ key: SCHEMA_VERSION_KEY, value: String(version), updated_at: now });
}

/**
 * Migration: v2 → v3 (Remove voice transcription)
 *
 * Changes:
 * - Remove all whisper.* settings
 * - Remove setup.* settings
 */
function migrateV2ToV3() {
  const db = _db;

  console.log('[Settings Migration] Running v2 → v3 (Remove voice transcription)');

  // Delete all whisper and setup settings
  const result = db
    .prepare("DELETE FROM settings WHERE key LIKE 'whisper.%' OR key LIKE 'setup.%'")
    .run();

  console.log(`[Settings Migration] Removed ${result.changes} whisper/setup settings`);
  console.log('[Settings Migration] v2 → v3 complete');
}

/**
 * Migration registry
 * Maps version numbers to migration functions
 */
const migrations = {
  3: migrateV2ToV3,
};

/**
 * Run all pending migrations
 * @param {import('better-sqlite3').Database} db - Database instance to use
 * @returns {object} Migration result {migrated: boolean, fromVersion: number, toVersion: number}
 */
function runSettingsMigrations(db) {
  // Store db reference for use by internal functions
  _db = db;

  const currentVersion = getCurrentSchemaVersion();
  const targetVersion = SETTINGS_SCHEMA_VERSION;

  if (currentVersion >= targetVersion) {
    return {
      migrated: false,
      fromVersion: currentVersion,
      toVersion: targetVersion,
    };
  }

  console.log(`[Settings Migration] Upgrading from v${currentVersion} to v${targetVersion}`);

  // Run migrations sequentially
  for (let version = currentVersion + 1; version <= targetVersion; version++) {
    const migration = migrations[version];

    if (migration) {
      try {
        migration();
      } catch (error) {
        console.error(`[Settings Migration] Failed at v${version}:`, error);
        throw error;
      }
    } else {
      console.log(`[Settings Migration] No migration needed for v${version}`);
    }
  }

  // Update schema version
  setSchemaVersion(targetVersion);

  console.log(`[Settings Migration] Complete. Now at v${targetVersion}`);

  return {
    migrated: true,
    fromVersion: currentVersion,
    toVersion: targetVersion,
  };
}

/**
 * Remove obsolete settings that are no longer in the schema
 * @param {import('better-sqlite3').Database} [db] - Database instance (optional, uses _db if not provided)
 * @returns {string[]} Keys that were removed
 */
function cleanupObsoleteSettings(db) {
  db = db || _db;

  // Get all stored settings
  const storedKeys = db
    .prepare('SELECT key FROM settings WHERE key != ?')
    .all(SCHEMA_VERSION_KEY)
    .map((row) => row.key);

  // Find keys not in current schema
  const obsoleteKeys = storedKeys.filter((key) => !(key in settingsSchema));

  // Delete obsolete keys
  if (obsoleteKeys.length > 0) {
    const placeholders = obsoleteKeys.map(() => '?').join(',');
    db.prepare(`DELETE FROM settings WHERE key IN (${placeholders})`).run(...obsoleteKeys);

    console.log('[Settings Migration] Cleaned up obsolete settings:', obsoleteKeys);
  }

  return obsoleteKeys;
}

module.exports = {
  runSettingsMigrations,
  cleanupObsoleteSettings,
  getCurrentSchemaVersion,
  setSchemaVersion,
  SCHEMA_VERSION_KEY,
};
