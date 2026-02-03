/**
 * Config Edge Cases Tests - Simplified
 *
 * Tests for edge case handling with focus on actual behavior
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { ConfigManager, clearInstances } = require('../../../shared/config/manager');
const { generateDefaultConfig } = require('../../../shared/config/defaults');

describe('Config Edge Cases - Simplified', () => {
  let tempDir;
  let testConfigPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stickynotes-cfg-test-'));
    testConfigPath = path.join(tempDir, 'config.yaml');
    clearInstances();
  });

  afterEach(() => {
    clearInstances();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Config Corruption Recovery', () => {
    test('should backup corrupt config and regenerate with defaults', () => {
      // Write corrupt YAML
      fs.writeFileSync(testConfigPath, 'invalid: [yaml', 'utf8');

      // Create config manager - should handle corruption
      const config = new ConfigManager(testConfigPath);

      // Prevent unhandled error
      config.on('error', () => {});

      // Config should have defaults loaded
      expect(config.cache).toBeDefined();
      expect(config.get('schemaVersion')).toBe(3);

      // Backup file should exist
      const files = fs.readdirSync(tempDir);
      const backupFiles = files.filter((f) => f.startsWith('config.yaml.corrupt.'));
      expect(backupFiles.length).toBeGreaterThanOrEqual(1);

      // Original file should be regenerated
      const content = fs.readFileSync(testConfigPath, 'utf8');
      expect(content).toContain('schemaVersion: 3');
    });

    test('should recover from empty corrupt file', () => {
      fs.writeFileSync(testConfigPath, '', 'utf8');

      const config = new ConfigManager(testConfigPath);
      config.on('error', () => {});

      // Should handle empty file
      expect(config.cache).toBeDefined();
    });
  });

  describe('First-Run Experience', () => {
    test('should handle missing config file', () => {
      expect(fs.existsSync(testConfigPath)).toBe(false);

      const config = new ConfigManager(testConfigPath);

      // Should have empty cache
      expect(config.cache).toEqual({});

      // Should allow setting values
      config.set('test.value', 'test');
      expect(config.get('test.value')).toBe('test');
    });

    test('should work with default config', () => {
      fs.writeFileSync(testConfigPath, generateDefaultConfig(), 'utf8');

      const config = new ConfigManager(testConfigPath);

      expect(config.get('general.startMinimized')).toBe(false);
      expect(config.get('appearance.theme')).toBe('system');
    });
  });

  describe('Config Validation', () => {
    test('should provide validation interface', () => {
      fs.writeFileSync(testConfigPath, generateDefaultConfig(), 'utf8');

      const config = new ConfigManager(testConfigPath);
      const validation = config.validate();

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(Array.isArray(validation.errors) || validation.errors === null).toBe(true);
    });
  });

  describe('Write Lock', () => {
    test('should enforce write lock timeout', async () => {
      fs.writeFileSync(testConfigPath, generateDefaultConfig(), 'utf8');
      const config = new ConfigManager(testConfigPath);

      // Manually acquire lock
      config.writeLock = true;

      // Try to save - should timeout
      await expect(config.save()).rejects.toThrow('Timeout waiting for write lock');

      config.writeLock = false;
    });

    test('should allow save when lock is released', async () => {
      fs.writeFileSync(testConfigPath, generateDefaultConfig(), 'utf8');
      const config = new ConfigManager(testConfigPath);

      config.set('test.value', 'test');
      await expect(config.save()).resolves.not.toThrow();

      expect(config.get('test.value')).toBe('test');
    });
  });

  describe('File Watching', () => {
    test('should start and stop watching', () => {
      fs.writeFileSync(testConfigPath, generateDefaultConfig(), 'utf8');
      const config = new ConfigManager(testConfigPath);

      config.watch();
      expect(config.isWatching).toBe(true);

      config.unwatch();
      expect(config.isWatching).toBe(false);
    });

    test('should not double-watch', () => {
      fs.writeFileSync(testConfigPath, generateDefaultConfig(), 'utf8');
      const config = new ConfigManager(testConfigPath);

      config.watch();
      const watcher1 = config.watcher;

      config.watch();
      const watcher2 = config.watcher;

      // Should be same watcher
      expect(watcher1).toBe(watcher2);

      config.unwatch();
    });
  });

  describe('Error Handling', () => {
    test('should emit error events', (done) => {
      // Use actually invalid YAML syntax (unclosed bracket)
      fs.writeFileSync(testConfigPath, 'invalid: [yaml', 'utf8');

      const config = new ConfigManager(testConfigPath);
      let errorEmitted = false;

      config.on('error', () => {
        errorEmitted = true;
      });

      // Use setTimeout to ensure async events fire
      setTimeout(() => {
        expect(errorEmitted).toBe(true);
        done();
      }, 50);
    });

    test('should emit corruption events', (done) => {
      // Use actually invalid YAML syntax
      fs.writeFileSync(testConfigPath, 'invalid: [yaml', 'utf8');

      const config = new ConfigManager(testConfigPath);
      let corruptionEmitted = false;

      config.on('error', () => {}); // Prevent unhandled
      config.on('corruption', (data) => {
        corruptionEmitted = true;
        expect(data).toHaveProperty('backupPath');
        expect(data).toHaveProperty('parseError');
      });

      // Use setTimeout to ensure async events fire
      setTimeout(() => {
        expect(corruptionEmitted).toBe(true);
        done();
      }, 50);
    });
  });
});
