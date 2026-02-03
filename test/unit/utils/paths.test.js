/**
 * Paths Tests
 */
const path = require('path');
const fs = require('fs');
const {
  getAppDataPath,
  getDatabasePath,
  getAttachmentsPath,
  getBackupsPath,
  getLogsPath,
  ensureDir,
  ensureAppDirs,
} = require('../../../shared/utils/paths');

describe('Paths', () => {
  describe('getAppDataPath', () => {
    it('should return a string', () => {
      const appPath = getAppDataPath();
      expect(typeof appPath).toBe('string');
    });

    it('should contain StickyNotes in path', () => {
      const appPath = getAppDataPath();
      expect(appPath.toLowerCase()).toContain('stickynotes');
    });

    it('should return platform-appropriate path', () => {
      const appPath = getAppDataPath();
      if (process.platform === 'win32') {
        expect(appPath).toContain('AppData');
      } else if (process.platform === 'darwin') {
        expect(appPath).toContain('Application Support');
      } else {
        expect(appPath).toContain('.config');
      }
    });
  });

  describe('getDatabasePath', () => {
    const originalEnv = process.env.STICKYNOTES_DB_PATH;

    afterEach(() => {
      // Restore original env
      if (originalEnv) {
        process.env.STICKYNOTES_DB_PATH = originalEnv;
      } else {
        delete process.env.STICKYNOTES_DB_PATH;
      }
    });

    it('should return default path when no custom path or env var', () => {
      delete process.env.STICKYNOTES_DB_PATH;
      const dbPath = getDatabasePath();
      expect(dbPath).toContain('stickynotes.db');
    });

    it('should return custom path when provided', () => {
      const customPath = '/custom/path/mydb.db';
      const dbPath = getDatabasePath(customPath);
      expect(dbPath).toBe(customPath);
    });

    it('should return env var path when set', () => {
      process.env.STICKYNOTES_DB_PATH = '/env/path/test.db';
      const dbPath = getDatabasePath();
      expect(dbPath).toBe('/env/path/test.db');
    });

    it('should prefer explicit custom path over env var', () => {
      process.env.STICKYNOTES_DB_PATH = '/env/path/test.db';
      const customPath = '/custom/path/mydb.db';
      const dbPath = getDatabasePath(customPath);
      expect(dbPath).toBe(customPath);
    });

    it('should return env var path for empty string', () => {
      process.env.STICKYNOTES_DB_PATH = '/env/path/test.db';
      const dbPath = getDatabasePath('');
      expect(dbPath).toBe('/env/path/test.db');
    });
  });

  describe('getAttachmentsPath', () => {
    it('should return default path when no custom path provided', () => {
      const attPath = getAttachmentsPath();
      expect(attPath).toContain('attachments');
    });

    it('should return custom path when provided', () => {
      const customPath = '/custom/attachments';
      const attPath = getAttachmentsPath(customPath);
      expect(attPath).toBe(customPath);
    });
  });

  describe('getBackupsPath', () => {
    it('should return path containing backups', () => {
      const backupsPath = getBackupsPath();
      expect(backupsPath).toContain('backups');
    });
  });

  describe('getLogsPath', () => {
    it('should return path containing logs', () => {
      const logsPath = getLogsPath();
      expect(logsPath).toContain('logs');
    });
  });

  describe('ensureDir', () => {
    it('should create directory if it does not exist', () => {
      const testDir = path.join(global.testDir, 'test-ensure-dir-' + Date.now());
      expect(fs.existsSync(testDir)).toBe(false);

      ensureDir(testDir);

      expect(fs.existsSync(testDir)).toBe(true);
      fs.rmdirSync(testDir);
    });

    it('should not throw if directory already exists', () => {
      const testDir = path.join(global.testDir, 'test-ensure-dir-exists-' + Date.now());
      fs.mkdirSync(testDir, { recursive: true });

      expect(() => ensureDir(testDir)).not.toThrow();
      fs.rmdirSync(testDir);
    });

    it('should create nested directories', () => {
      const testDir = path.join(global.testDir, 'nested', 'path', 'test-' + Date.now());

      ensureDir(testDir);

      expect(fs.existsSync(testDir)).toBe(true);
      fs.rmSync(path.join(global.testDir, 'nested'), { recursive: true });
    });

    it('should be idempotent', () => {
      const testDir = path.join(global.testDir, 'idempotent-' + Date.now());
      ensureDir(testDir);
      ensureDir(testDir);
      ensureDir(testDir);
      expect(fs.existsSync(testDir)).toBe(true);
      fs.rmdirSync(testDir);
    });
  });

  describe('ensureAppDirs', () => {
    it('should be a function', () => {
      expect(typeof ensureAppDirs).toBe('function');
    });

    it('should not throw when called', () => {
      expect(() => ensureAppDirs()).not.toThrow();
    });

    it('should create all required directories', () => {
      ensureAppDirs();
      expect(fs.existsSync(getAppDataPath())).toBe(true);
      expect(fs.existsSync(getAttachmentsPath())).toBe(true);
      expect(fs.existsSync(getBackupsPath())).toBe(true);
      expect(fs.existsSync(getLogsPath())).toBe(true);
    });

    it('should be idempotent', () => {
      ensureAppDirs();
      ensureAppDirs();
      ensureAppDirs();
      expect(fs.existsSync(getAppDataPath())).toBe(true);
    });
  });

  describe('platform-specific behavior', () => {
    it('should handle current platform correctly', () => {
      const appPath = getAppDataPath();
      // Should always return a valid path
      expect(appPath).toBeTruthy();
      expect(typeof appPath).toBe('string');
      expect(appPath.length).toBeGreaterThan(0);
    });
  });
});
