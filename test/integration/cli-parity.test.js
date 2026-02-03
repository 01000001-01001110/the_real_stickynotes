/**
 * CLI Parity Tests
 *
 * Tests for Phase E: CLI parity commands
 * - app settings
 * - app panel
 * - config edit
 * - service stop/restart
 */

const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Path to CLI binary
const CLI_PATH = path.join(__dirname, '../../cli/bin/stickynotes.js');

describe('CLI Parity - Phase E', () => {
  let testDir;
  let testDbPath;
  let testConfigPath;

  beforeAll(() => {
    testDir = path.join(os.tmpdir(), 'stickynotes-parity-test-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    testDbPath = path.join(testDir, 'test.db');
    testConfigPath = path.join(testDir, 'config.yaml');

    // Create a test config file
    fs.writeFileSync(
      testConfigPath,
      `# StickyNotes Configuration
general:
  startMinimized: false
  theme: light
`,
      'utf8'
    );

    process.env.STICKYNOTES_DB_PATH = testDbPath;
    process.env.STICKYNOTES_TEST = 'true';
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.STICKYNOTES_DB_PATH;
    delete process.env.STICKYNOTES_TEST;
  });

  // Helper to run CLI command
  const runCli = (args, options = {}) => {
    const cmd = `node "${CLI_PATH}" ${args}`;
    try {
      const result = execSync(cmd, {
        cwd: testDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          STICKYNOTES_DB_PATH: testDbPath,
        },
        ...options,
      });
      return { success: true, output: result.trim() };
    } catch (error) {
      return {
        success: false,
        output: (error.stderr || error.stdout || error.message).trim(),
        error,
        exitCode: error.status,
      };
    }
  };

  describe('E.1 & E.2: App Control Commands', () => {
    test('should recognize app panel command', () => {
      // Without running service, should fail with service not running
      const result = runCli('app panel');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThanOrEqual(1); // Service not running
    });

    test('should recognize app settings command', () => {
      // Without running service, should fail with service not running
      const result = runCli('app settings');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThanOrEqual(1); // Service not running
    });

    test('should show app panel in help text', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('app panel');
    });

    test('should show app settings in help text', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('app settings');
    });
  });

  describe('E.3: Config Edit Command', () => {
    test('should recognize config edit command', () => {
      // Without running service, should fail with service not running
      const result = runCli('config edit');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThanOrEqual(1); // Service not running
    });

    test('should show config edit in help text', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('config edit');
      expect(result.output).toContain('Edit config.yaml');
    });
  });

  describe('E.4: Service Control Commands', () => {
    test('should recognize service stop command', () => {
      // Without running service, should fail with service not running
      const result = runCli('service stop');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThanOrEqual(1); // Service not running
    });

    test('should show service commands in help text', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('service');
      expect(result.output).toContain('Service control');
      expect(result.output).toContain('stop, restart');
    });

    test('should show service stop example', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('service stop');
      expect(result.output).toContain('Stop StickyNotes service');
    });

    test('should show service restart example', () => {
      const result = runCli('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('service restart');
      expect(result.output).toContain('Restart StickyNotes service');
    });
  });

  describe('E.5: Method Mapper Integration', () => {
    test('should map app:panel correctly', () => {
      const { mapCommand } = require('../../cli/lib/method-mapper');
      const parsed = {
        command: 'app',
        action: 'panel',
        args: [],
        options: {},
      };
      const mapping = mapCommand(parsed);
      expect(mapping.method).toBe('app:panel');
      expect(mapping.isLocal).toBe(false);
    });

    test('should map app:settings correctly', () => {
      const { mapCommand } = require('../../cli/lib/method-mapper');
      const parsed = {
        command: 'app',
        action: 'settings',
        args: [],
        options: {},
      };
      const mapping = mapCommand(parsed);
      expect(mapping.method).toBe('app:settings');
      expect(mapping.isLocal).toBe(false);
    });

    test('should map config:edit correctly', () => {
      const { mapCommand } = require('../../cli/lib/method-mapper');
      const parsed = {
        command: 'config',
        action: 'edit',
        args: [],
        options: {},
      };
      const mapping = mapCommand(parsed);
      expect(mapping.method).toBe('config:edit');
      expect(mapping.isLocal).toBe(false);
    });

    test('should map service:stop correctly', () => {
      const { mapCommand } = require('../../cli/lib/method-mapper');
      const parsed = {
        command: 'service',
        action: 'stop',
        args: [],
        options: {},
      };
      const mapping = mapCommand(parsed);
      expect(mapping.method).toBe('service:stop');
      expect(mapping.isLocal).toBe(false);
    });

    test('should map service:restart correctly', () => {
      const { mapCommand } = require('../../cli/lib/method-mapper');
      const parsed = {
        command: 'service',
        action: 'restart',
        args: [],
        options: {},
      };
      const mapping = mapCommand(parsed);
      expect(mapping.method).toBe('service:restart');
      expect(mapping.isLocal).toBe(false);
    });
  });

  describe('Command Validation', () => {
    test('should validate app:panel method call', () => {
      const { validateMethodCall } = require('../../cli/lib/method-mapper');
      expect(() => {
        validateMethodCall('app:panel', {});
      }).not.toThrow();
    });

    test('should validate app:settings method call', () => {
      const { validateMethodCall } = require('../../cli/lib/method-mapper');
      expect(() => {
        validateMethodCall('app:settings', {});
      }).not.toThrow();
    });

    test('should validate config:edit method call', () => {
      const { validateMethodCall } = require('../../cli/lib/method-mapper');
      expect(() => {
        validateMethodCall('config:edit', {});
      }).not.toThrow();
    });

    test('should validate service:stop method call', () => {
      const { validateMethodCall } = require('../../cli/lib/method-mapper');
      expect(() => {
        validateMethodCall('service:stop', {});
      }).not.toThrow();
    });

    test('should validate service:restart method call', () => {
      const { validateMethodCall } = require('../../cli/lib/method-mapper');
      expect(() => {
        validateMethodCall('service:restart', {});
      }).not.toThrow();
    });
  });
});
