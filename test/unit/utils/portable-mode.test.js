/**
 * Portable Mode Tests
 *
 * Tests for portable mode detection and path handling.
 * Portable mode is activated by placing a 'portable.txt' file next to the executable.
 */
const path = require('path');
const fs = require('fs');

// Mock electron module before requiring paths
jest.mock('electron', () => ({
  app: {
    isPackaged: true,
  },
}));

const {
  isPortableMode,
  getPortableDataPath,
  getAppDataPath,
  _resetPortableModeCache,
} = require('../../../shared/utils/paths');

describe('Portable Mode', () => {
  const originalExecPath = process.execPath;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset portable mode cache before each test
    _resetPortableModeCache();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'execPath', {
      value: originalExecPath,
      writable: true,
      configurable: true,
    });
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    _resetPortableModeCache();
  });

  describe('isPortableMode', () => {
    it('should return false in development mode', () => {
      process.env.NODE_ENV = 'development';
      _resetPortableModeCache();

      expect(isPortableMode()).toBe(false);
    });

    it('should return false when portable.txt does not exist', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Create a temporary directory without portable.txt
      const tempDir = path.join(global.testDir, 'no-portable-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      // Mock process.execPath to point to this directory
      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      const result = isPortableMode();
      expect(result).toBe(false);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should return true when portable.txt exists next to executable', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Create a temporary directory with portable.txt
      const tempDir = path.join(global.testDir, 'portable-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      const markerPath = path.join(tempDir, 'portable.txt');
      fs.writeFileSync(markerPath, 'Portable mode enabled', 'utf8');

      // Mock process.execPath to point to this directory
      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      const result = isPortableMode();
      expect(result).toBe(true);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should cache the result after first check', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Create a temporary directory with portable.txt
      const tempDir = path.join(global.testDir, 'portable-cache-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      const markerPath = path.join(tempDir, 'portable.txt');
      fs.writeFileSync(markerPath, 'test', 'utf8');

      // Mock process.execPath
      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      // First call should check and cache
      const result1 = isPortableMode();
      expect(result1).toBe(true);

      // Delete the marker file
      fs.unlinkSync(markerPath);

      // Second call should return cached result (still true)
      const result2 = isPortableMode();
      expect(result2).toBe(true);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should handle errors gracefully', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Mock process.execPath to a path that will cause errors
      Object.defineProperty(process, 'execPath', {
        get: () => {
          throw new Error('Access denied');
        },
        configurable: true,
      });

      // Should not throw, should return false
      expect(() => isPortableMode()).not.toThrow();
      expect(isPortableMode()).toBe(false);
    });
  });

  describe('getPortableDataPath', () => {
    it('should return null when not in portable mode', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Setup non-portable environment
      const tempDir = path.join(global.testDir, 'non-portable-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      expect(getPortableDataPath()).toBeNull();

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should return portable data path when in portable mode', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Setup portable environment
      const tempDir = path.join(global.testDir, 'portable-data-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'portable.txt'), 'test', 'utf8');

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      const portablePath = getPortableDataPath();
      expect(portablePath).not.toBeNull();
      expect(portablePath).toBe(path.join(tempDir, 'StickyNotes_Data'));

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should return the same path on multiple calls', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Setup portable environment
      const tempDir = path.join(global.testDir, 'portable-same-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'portable.txt'), 'test', 'utf8');

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      const path1 = getPortableDataPath();
      const path2 = getPortableDataPath();
      const path3 = getPortableDataPath();

      expect(path1).toBe(path2);
      expect(path2).toBe(path3);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('getAppDataPath integration', () => {
    it('should prioritize portable mode over default path', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Setup portable environment
      const tempDir = path.join(global.testDir, 'portable-priority-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'portable.txt'), 'test', 'utf8');

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      const appDataPath = getAppDataPath();
      const expectedPortablePath = path.join(tempDir, 'StickyNotes_Data');

      expect(appDataPath).toBe(expectedPortablePath);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should use default path when not in portable mode', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Setup non-portable environment
      const tempDir = path.join(global.testDir, 'non-portable-default-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      const appDataPath = getAppDataPath();

      // Should contain default path components
      expect(appDataPath.toLowerCase()).toContain('stickynotes');
      // Should NOT be the portable path
      expect(appDataPath).not.toContain('StickyNotes_Data');

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('_resetPortableModeCache', () => {
    it('should reset the cache allowing re-detection', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Setup portable environment
      const tempDir = path.join(global.testDir, 'reset-cache-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      const markerPath = path.join(tempDir, 'portable.txt');
      fs.writeFileSync(markerPath, 'test', 'utf8');

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      // First check - should be portable
      expect(isPortableMode()).toBe(true);

      // Remove marker
      fs.unlinkSync(markerPath);

      // Without reset, should still be true (cached)
      expect(isPortableMode()).toBe(true);

      // Reset cache
      _resetPortableModeCache();

      // Now should be false
      expect(isPortableMode()).toBe(false);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('Electron context handling', () => {
    it('should work when electron app is available', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Electron is mocked at the top of the file
      // Just verify it doesn't throw
      expect(() => isPortableMode()).not.toThrow();
    });
  });

  describe('Portable mode file content', () => {
    it('should detect portable mode regardless of file content', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      // Test with empty file
      const tempDir = path.join(global.testDir, 'portable-empty-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'portable.txt'), '', 'utf8');

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      expect(isPortableMode()).toBe(true);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });

    it('should detect portable mode with any file content', () => {
      delete process.env.NODE_ENV;
      _resetPortableModeCache();

      const tempDir = path.join(global.testDir, 'portable-content-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'portable.txt'),
        'This is a portable installation\nData will be stored locally',
        'utf8'
      );

      Object.defineProperty(process, 'execPath', {
        value: path.join(tempDir, 'stickynotes.exe'),
        writable: true,
        configurable: true,
      });

      expect(isPortableMode()).toBe(true);
      expect(getPortableDataPath()).toBe(path.join(tempDir, 'StickyNotes_Data'));

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });
});
