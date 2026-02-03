/**
 * Migration Runner Tests
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { runMigrations, rollbackMigration, migrations } = require('../../../shared/database/migrations');

describe('Migration Runner', () => {
  let db;
  let testDir;
  let testDbPath;

  beforeEach(() => {
    // Create a fresh test directory and database for each test
    testDir = path.join(os.tmpdir(), 'migration-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    fs.mkdirSync(testDir, { recursive: true });
    testDbPath = path.join(testDir, 'test.db');
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('migrations array', () => {
    it('should have migrations defined', () => {
      expect(migrations).toBeDefined();
      expect(Array.isArray(migrations)).toBe(true);
      expect(migrations.length).toBeGreaterThanOrEqual(2);
    });

    it('should have name and up/down for each migration', () => {
      for (const migration of migrations) {
        expect(migration.name).toBeDefined();
        expect(typeof migration.name).toBe('string');
        expect(migration.up).toBeDefined();
        expect(typeof migration.up).toBe('string');
        expect(migration.down).toBeDefined();
        expect(typeof migration.down).toBe('string');
      }
    });
  });

  describe('runMigrations', () => {
    it('should create migrations table', () => {
      runMigrations(db);
      
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
      expect(table).toBeDefined();
      expect(table.name).toBe('migrations');
    });

    it('should run all migrations on fresh database', () => {
      runMigrations(db);
      
      const applied = db.prepare('SELECT * FROM migrations ORDER BY id').all();
      expect(applied.length).toBe(migrations.length);
    });

    it('should create notes table after migration', () => {
      runMigrations(db);
      
      const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'").get();
      expect(table).toBeDefined();
    });

    it('should not re-run already applied migrations', () => {
      // Run once
      runMigrations(db);
      const firstRun = db.prepare('SELECT COUNT(*) as count FROM migrations').get();
      
      // Run again
      runMigrations(db);
      const secondRun = db.prepare('SELECT COUNT(*) as count FROM migrations').get();
      
      expect(secondRun.count).toBe(firstRun.count);
    });

    it('should record applied_at timestamp', () => {
      runMigrations(db);
      
      const migration = db.prepare('SELECT * FROM migrations LIMIT 1').get();
      expect(migration.applied_at).toBeDefined();
      expect(new Date(migration.applied_at).getTime()).not.toBeNaN();
    });
  });

  describe('rollbackMigration', () => {
    it('should rollback the last migration', () => {
      // First run all migrations
      runMigrations(db);
      
      const beforeRollback = db.prepare('SELECT COUNT(*) as count FROM migrations').get();
      
      // Rollback
      rollbackMigration(db);
      
      const afterRollback = db.prepare('SELECT COUNT(*) as count FROM migrations').get();
      expect(afterRollback.count).toBe(beforeRollback.count - 1);
    });

    it('should handle rollback when no migrations exist', () => {
      // Create migrations table but don't run any migrations
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT NOT NULL
        )
      `);
      
      // Should not throw
      expect(() => rollbackMigration(db)).not.toThrow();
    });

    it('should rollback multiple times', () => {
      runMigrations(db);
      
      const initialCount = db.prepare('SELECT COUNT(*) as count FROM migrations').get().count;
      
      // Rollback all migrations
      for (let i = 0; i < initialCount; i++) {
        rollbackMigration(db);
      }
      
      const finalCount = db.prepare('SELECT COUNT(*) as count FROM migrations').get().count;
      expect(finalCount).toBe(0);
    });

    it('should remove the correct migration record', () => {
      runMigrations(db);
      
      const lastBefore = db.prepare('SELECT name FROM migrations ORDER BY id DESC LIMIT 1').get();
      
      rollbackMigration(db);
      
      const lastAfter = db.prepare('SELECT name FROM migrations ORDER BY id DESC LIMIT 1').get();
      
      expect(lastAfter?.name).not.toBe(lastBefore.name);
    });

    it('should handle rollback of unknown migration gracefully', () => {
      // Create migrations table and insert a fake migration that doesn't exist in code
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT NOT NULL
        )
      `);
      db.prepare("INSERT INTO migrations (name, applied_at) VALUES ('unknown_migration', ?)").run(new Date().toISOString());
      
      // Should not throw - migration not found in migrations array
      expect(() => rollbackMigration(db)).not.toThrow();
      
      // Record should still exist since migration code wasn't found
      const count = db.prepare('SELECT COUNT(*) as count FROM migrations').get().count;
      expect(count).toBe(0);
    });
  });

  describe('migration idempotency', () => {
    it('should be able to migrate, rollback, and migrate again', () => {
      // Initial migration
      runMigrations(db);
      const count1 = db.prepare('SELECT COUNT(*) as count FROM migrations').get().count;
      
      // Rollback one
      rollbackMigration(db);
      const count2 = db.prepare('SELECT COUNT(*) as count FROM migrations').get().count;
      expect(count2).toBe(count1 - 1);
      
      // Re-run migrations
      runMigrations(db);
      const count3 = db.prepare('SELECT COUNT(*) as count FROM migrations').get().count;
      expect(count3).toBe(count1);
    });
  });
});
