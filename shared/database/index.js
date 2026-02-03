/**
 * Database connection manager
 */
const Database = require('better-sqlite3');
const { getDatabasePath, ensureAppDirs } = require('../utils/paths');
const { runMigrations } = require('./migrations');
const { runSettingsMigrations } = require('./settings-migration');

let db = null;
let dbPath = null;
let isClosing = false;

/**
 * Initialize the database connection
 * @param {string} customPath - Optional custom database path
 * @returns {import('better-sqlite3').Database} Database instance
 */
function initDatabase(customPath = '') {
  const requestedPath = getDatabasePath(customPath);

  // If already initialized with same path, return existing
  if (db && dbPath === requestedPath) {
    return db;
  }

  // If initialized with different path, close first
  if (db && dbPath !== requestedPath) {
    closeDatabase();
  }

  ensureAppDirs();

  dbPath = requestedPath;
  // Use stderr for initialization message to avoid mixing with JSON output
  if (process.env.STICKYNOTES_TEST !== 'true') {
    console.error(`Initializing database at: ${dbPath}`);
  }

  try {
    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Set busy timeout to handle concurrent access (5 seconds)
    db.pragma('busy_timeout = 5000');

    // Run database schema migrations
    runMigrations(db);

    // Run settings migrations (v1→v2 Sherpa-ONNX)
    try {
      runSettingsMigrations(db);
    } catch (err) {
      console.error('Settings migration failed:', err.message);
    }

    isClosing = false;
  } catch (err) {
    db = null;
    dbPath = null;
    throw new Error(`Failed to initialize database: ${err.message}`);
  }

  return db;
}

/**
 * Get the database instance
 * @returns {import('better-sqlite3').Database} Database instance
 * @throws {Error} If database is closing or not initialized
 */
function getDatabase() {
  if (isClosing) {
    throw new Error('Database is closing, cannot perform operations');
  }
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
function closeDatabase() {
  if (db) {
    isClosing = true;
    try {
      // Checkpoint WAL before closing
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
    } catch (err) {
      console.error('Error closing database:', err.message);
    } finally {
      db = null;
      dbPath = null;
      isClosing = false;
    }
  }
}

/**
 * Execute a function within a transaction
 * Automatically commits on success, rolls back on error
 * @template T
 * @param {function(): T} fn - Function to execute within transaction
 * @returns {T} Result of the function
 * @throws {Error} Re-throws any error after rollback
 */
function withTransaction(fn) {
  const database = getDatabase();

  return database.transaction(() => {
    return fn();
  })();
}

/**
 * Execute a function with retry logic for busy database
 * @template T
 * @param {function(): T} fn - Function to execute
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} delayMs - Delay between retries in ms (default: 100)
 * @returns {T} Result of the function
 */
function withRetry(fn, maxRetries = 3, delayMs = 100) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;

      // Only retry on SQLITE_BUSY errors
      if (err.code === 'SQLITE_BUSY' && attempt < maxRetries) {
        // Synchronous delay using Atomics.wait for non-blocking sleep
        const delay = delayMs * (attempt + 1);
        try {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        } catch {
          // Fallback for environments without SharedArrayBuffer
          const start = Date.now();
          while (Date.now() - start < delay) {
            /* spin */
          }
        }
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Check database integrity
 * @returns {{ ok: boolean, message: string }}
 */
function checkIntegrity() {
  const database = getDatabase();
  const result = database.pragma('integrity_check');
  const ok = result[0].integrity_check === 'ok';
  return {
    ok,
    message: ok ? 'Database integrity check passed' : result[0].integrity_check,
  };
}

/**
 * Vacuum the database to reclaim space
 */
function vacuum() {
  const database = getDatabase();
  database.exec('VACUUM');
}

/**
 * Get database statistics
 * @returns {object} Statistics object
 */
function getStats() {
  const database = getDatabase();

  const notesCount = database
    .prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 0')
    .get().count;
  const archivedCount = database
    .prepare('SELECT COUNT(*) as count FROM notes WHERE is_archived = 1 AND is_deleted = 0')
    .get().count;
  const trashedCount = database
    .prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 1')
    .get().count;
  const foldersCount = database.prepare('SELECT COUNT(*) as count FROM folders').get().count;
  const tagsCount = database.prepare('SELECT COUNT(*) as count FROM tags').get().count;
  const attachmentsCount = database
    .prepare('SELECT COUNT(*) as count FROM attachments')
    .get().count;

  return {
    notes: {
      total: notesCount,
      archived: archivedCount,
      trashed: trashedCount,
      active: notesCount - archivedCount,
    },
    folders: foldersCount,
    tags: tagsCount,
    attachments: attachmentsCount,
  };
}

/**
 * Check if database is initialized and open
 * @returns {boolean}
 */
function isOpen() {
  return db !== null && !isClosing;
}

/**
 * Get current database path
 * @returns {string|null}
 */
function getCurrentPath() {
  return dbPath;
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  withTransaction,
  withRetry,
  isOpen,
  getCurrentPath,
  checkIntegrity,
  vacuum,
  getStats,
};
