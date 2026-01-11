/**
 * Settings Database Operations Tests
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../../../shared/database/migrations');

describe('Settings Database Operations', () => {
  let db;
  let testDbPath;

  beforeEach(() => {
    testDbPath = path.join(global.testDir, `settings-test-${Date.now()}-${Math.random()}.db`);
    db = new Database(testDbPath);
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
    if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  });

  describe('setSetting', () => {
    it('should insert a new setting', () => {
      const now = new Date().toISOString();
      
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('test.setting', 'test-value', now);
      
      const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('test.setting');
      expect(setting.value).toBe('test-value');
    });

    it('should update existing setting', () => {
      const now = new Date().toISOString();
      
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('test.setting', 'original', now);
      db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('test.setting', 'updated', now);
      
      const settings = db.prepare('SELECT * FROM settings WHERE key = ?').all('test.setting');
      expect(settings).toHaveLength(1);
      expect(settings[0].value).toBe('updated');
    });

    it('should store boolean as string', () => {
      const now = new Date().toISOString();
      
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('bool.setting', 'true', now);
      
      const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('bool.setting');
      expect(setting.value).toBe('true');
    });

    it('should store number as string', () => {
      const now = new Date().toISOString();
      
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('number.setting', '42', now);
      
      const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('number.setting');
      expect(setting.value).toBe('42');
    });
  });

  describe('getSetting', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('appearance.theme', 'dark', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('general.startOnBoot', 'true', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('appearance.defaultNoteWidth', '350', now);
    });

    it('should get a setting by key', () => {
      const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('appearance.theme');
      expect(setting.value).toBe('dark');
    });

    it('should return undefined for non-existent setting', () => {
      const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('nonexistent');
      expect(setting).toBeUndefined();
    });
  });

  describe('getAllSettings', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('setting1', 'value1', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('setting2', 'value2', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('setting3', 'value3', now);
    });

    it('should get all settings', () => {
      const settings = db.prepare('SELECT * FROM settings').all();
      expect(settings).toHaveLength(3);
    });

    it('should convert to object format', () => {
      const rows = db.prepare('SELECT key, value FROM settings').all();
      const settings = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      
      expect(settings['setting1']).toBe('value1');
      expect(settings['setting2']).toBe('value2');
      expect(settings['setting3']).toBe('value3');
    });
  });

  describe('deleteSetting', () => {
    it('should delete a setting', () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('delete.me', 'value', now);
      
      const result = db.prepare('DELETE FROM settings WHERE key = ?').run('delete.me');
      expect(result.changes).toBe(1);
      
      const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get('delete.me');
      expect(setting).toBeUndefined();
    });
  });

  describe('Settings by group', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('general.startOnBoot', 'false', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('general.startMinimized', 'true', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('appearance.theme', 'dark', now);
      db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('appearance.defaultNoteColor', 'blue', now);
    });

    it('should filter settings by prefix', () => {
      const generalSettings = db.prepare("SELECT * FROM settings WHERE key LIKE 'general.%'").all();
      expect(generalSettings).toHaveLength(2);
      
      const appearanceSettings = db.prepare("SELECT * FROM settings WHERE key LIKE 'appearance.%'").all();
      expect(appearanceSettings).toHaveLength(2);
    });
  });
});
