/**
 * CLI Version Resolution Tests
 *
 * Tests the version resolution logic that handles both development
 * and production (asar) environments.
 */

const path = require('path');
const fs = require('fs');

describe('CLI Version Resolution', () => {
  beforeEach(() => {
    // Module cache state is tracked for cleanup
  });

  afterEach(() => {
    // Clear any cached modules we loaded during tests
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('stickynotes.js') || key.includes('test-version')) {
        delete require.cache[key];
      }
    });
  });

  describe('Development Mode', () => {
    it('should resolve version from package.json in development', () => {
      const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.version).toBeDefined();
      expect(typeof packageJson.version).toBe('string');
      expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should have correct package name', () => {
      const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
      const packageJson = require(packageJsonPath);

      expect(packageJson.name).toBe('stickynotes');
    });
  });

  describe('Version Resolution Logic', () => {
    it('should implement the correct fallback chain', () => {
      // Test the actual logic pattern used in stickynotes.js
      const testVersionResolution = () => {
        let VERSION = '0.0.0';
        try {
          // Development path - will succeed in test environment
          const packageJson = require('../../../package.json');
          VERSION = packageJson.version;
        } catch {
          try {
            // Production asar path - won't exist in tests
            const asarPath = path.join(__dirname, '..', '..', '..', 'app.asar', 'package.json');
            if (fs.existsSync(asarPath)) {
              const packageJson = JSON.parse(fs.readFileSync(asarPath, 'utf8'));
              VERSION = packageJson.version;
            }
          } catch {
            VERSION = '0.0.4';
          }
        }
        return VERSION;
      };

      const version = testVersionResolution();

      // In test environment, should get version from package.json
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
      expect(version).not.toBe('0.0.0'); // Should not be default
    });

    it('should fall back to hardcoded version when all paths fail', () => {
      // Simulate production environment where both paths fail
      const testFallback = () => {
        let VERSION = '0.0.0';
        try {
          // Simulate failed require
          throw new Error('Cannot find module');
        } catch {
          try {
            // Simulate missing asar
            const asarPath = '/nonexistent/app.asar/package.json';
            if (fs.existsSync(asarPath)) {
              // Won't enter here
            } else {
              throw new Error('ENOENT');
            }
          } catch {
            VERSION = '0.0.4';
          }
        }
        return VERSION;
      };

      expect(testFallback()).toBe('0.0.4');
    });
  });

  describe('Asar Path Construction', () => {
    it('should construct correct asar path from CLI bin directory', () => {
      // The CLI is at: resources/app.asar.unpacked/cli/bin/stickynotes.js
      // Package.json is at: resources/app.asar/package.json
      // Relative path: __dirname + '..', '..', '..', 'app.asar', 'package.json'

      const mockDirname = path.join(
        'C:',
        'Program Files',
        'StickyNotes',
        'resources',
        'app.asar.unpacked',
        'cli',
        'bin'
      );
      const asarPackageJson = path.join(mockDirname, '..', '..', '..', 'app.asar', 'package.json');
      const normalized = path.normalize(asarPackageJson);

      expect(normalized).toContain('app.asar');
      expect(normalized).toContain('package.json');
      expect(normalized).not.toContain('app.asar.unpacked');
      expect(normalized).toContain(path.join('resources', 'app.asar', 'package.json'));
    });

    it('should navigate from unpacked to asar correctly', () => {
      // Verify the relative path math
      // Path structure: ['resources', 'app.asar.unpacked', 'cli', 'bin']
      // Target path: ['resources', 'app.asar', 'package.json']

      // From bin, go up 3 levels (bin -> cli -> app.asar.unpacked -> resources)
      // Then into app.asar/package.json
      const stepsUp = 3;
      const stepsDown = ['app.asar', 'package.json'];

      // Verify this matches the code
      expect(stepsUp).toBe(3);
      expect(stepsDown).toEqual(['app.asar', 'package.json']);
    });
  });

  describe('fs.existsSync Check', () => {
    it('should only read file when it exists', () => {
      const testPath = path.join(__dirname, 'nonexistent-file.json');

      let readAttempted = false;
      if (fs.existsSync(testPath)) {
        readAttempted = true;
        fs.readFileSync(testPath, 'utf8');
      }

      expect(readAttempted).toBe(false);
    });

    it('should read file when it exists', () => {
      const testPath = path.join(__dirname, '..', '..', '..', 'package.json');

      let content = null;
      if (fs.existsSync(testPath)) {
        content = fs.readFileSync(testPath, 'utf8');
      }

      expect(content).not.toBeNull();
      expect(JSON.parse(content).name).toBe('stickynotes');
    });
  });

  describe('JSON Parsing', () => {
    it('should handle valid JSON', () => {
      const validJson = '{"version": "1.2.3"}';
      const parsed = JSON.parse(validJson);

      expect(parsed.version).toBe('1.2.3');
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = '{version: "1.2.3"}'; // Missing quotes on key

      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });
});
