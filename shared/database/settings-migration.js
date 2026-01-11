/**
 * Settings Schema Migration
 *
 * Handles migration of settings when schema version changes.
 * Settings schema version is stored in the database and compared
 * with SETTINGS_SCHEMA_VERSION from constants/settings.js.
 *
 * Migration History:
 * - v1: Initial schema (whisper with chunkDuration, old model names)
 * - v2: Sherpa-ONNX migration (VAD settings, new model names, removed chunkDuration)
 */
const { SETTINGS_SCHEMA_VERSION, settingsSchema } = require('../constants/settings');
const { MODEL_MIGRATION_MAP } = require('../constants/whisper');

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
 * Migration: v1 → v2 (Sherpa-ONNX)
 *
 * Changes:
 * - Remove: whisper.chunkDuration (VAD handles this now)
 * - Add: whisper.vadThreshold, whisper.vadMinSilence, whisper.vadMaxSpeech, whisper.numThreads
 * - Migrate: whisper.modelSize values (tiny→tiny.en, base→base.en, small→small.en)
 * - Update: whisper.language options (only 'en' for English-only models)
 * - Update: whisper.enabled default to false (requires installation)
 */
function migrateV1ToV2() {
  const db = _db;
  const now = new Date().toISOString();

  console.log('[Settings Migration] Running v1 → v2 (Sherpa-ONNX)');

  // 1. Delete removed settings
  const removedKeys = ['whisper.chunkDuration'];
  for (const key of removedKeys) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    console.log(`[Settings Migration] Removed: ${key}`);
  }

  // 2. Migrate whisper.modelSize to new format
  const modelSizeRow = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('whisper.modelSize');

  if (modelSizeRow) {
    const oldValue = modelSizeRow.value;
    const newValue = MODEL_MIGRATION_MAP[oldValue];

    if (newValue && newValue !== oldValue) {
      db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(
        newValue,
        now,
        'whisper.modelSize'
      );
      console.log(`[Settings Migration] Migrated whisper.modelSize: ${oldValue} → ${newValue}`);
    }
  }

  // 3. Migrate language to 'en' if it was 'auto' or multilingual
  const languageRow = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('whisper.language');

  if (languageRow && languageRow.value !== 'en') {
    db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(
      'en',
      now,
      'whisper.language'
    );
    console.log(`[Settings Migration] Migrated whisper.language: ${languageRow.value} → en`);
  }

  // 4. Set whisper.enabled to false (requires model reinstall)
  db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(
    'false',
    now,
    'whisper.enabled'
  );
  console.log('[Settings Migration] Set whisper.enabled to false (requires model reinstall)');

  // 5. Add new VAD settings with defaults
  const newSettings = [
    { key: 'whisper.vadThreshold', default: 0.5 },
    { key: 'whisper.vadMinSilence', default: 0.25 },
    { key: 'whisper.vadMaxSpeech', default: 5.0 },
    { key: 'whisper.numThreads', default: 4 },
  ];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
  `);

  for (const setting of newSettings) {
    insertStmt.run({
      key: setting.key,
      value: String(setting.default),
      updated_at: now,
    });
    console.log(`[Settings Migration] Added: ${setting.key} = ${setting.default}`);
  }

  console.log('[Settings Migration] v1 → v2 complete');
}

/**
 * Migration registry
 * Maps version numbers to migration functions
 */
const migrations = {
  2: migrateV1ToV2,
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
