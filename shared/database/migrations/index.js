/**
 * Migration runner
 */
const migration001 = require('./001_initial');
const migration002 = require('./002_fts');

const migrations = [
  migration001,
  migration002,
];

/**
 * Run pending migrations
 * @param {import('better-sqlite3').Database} db - Database instance
 */
function runMigrations(db) {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  // Get applied migrations
  const appliedMigrations = db
    .prepare('SELECT name FROM migrations')
    .all()
    .map(row => row.name);

  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedMigrations.includes(migration.name)) {
      console.log(`Running migration: ${migration.name}`);
      
      db.exec(migration.up);
      
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
        .run(migration.name, new Date().toISOString());
      
      console.log(`Migration ${migration.name} completed`);
    }
  }
}

/**
 * Rollback the last migration
 * @param {import('better-sqlite3').Database} db - Database instance
 */
function rollbackMigration(db) {
  const lastMigration = db
    .prepare('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')
    .get();

  if (!lastMigration) {
    console.log('No migrations to rollback');
    return;
  }

  const migration = migrations.find(m => m.name === lastMigration.name);
  if (migration) {
    console.log(`Rolling back migration: ${migration.name}`);
    db.exec(migration.down);
    db.prepare('DELETE FROM migrations WHERE name = ?').run(migration.name);
    console.log(`Rollback of ${migration.name} completed`);
  }
}

module.exports = {
  migrations,
  runMigrations,
  rollbackMigration,
};
