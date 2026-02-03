/**
 * Tests for CLI PATH utilities
 */

const nodePath = require('path');

// Mock modules
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'E:\\Projects\\the_real_stickynotes',
  },
}));

jest.mock('child_process');

const {
  getCLIPath,
  addToPath,
  removeFromPath,
  isInPath,
} = require('../../../shared/utils/cli-path');

describe('CLI PATH Utilities', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  describe('getCLIPath', () => {
    it('should return development path when not packaged', () => {
      const path = getCLIPath();
      expect(path).toContain(nodePath.join('cli', 'bin'));
      expect(path).toContain('the_real_stickynotes');
    });

    it('should return production path when packaged', () => {
      const { app } = require('electron');
      app.isPackaged = true;

      // Mock process.resourcesPath
      const originalResourcesPath = process.resourcesPath;
      Object.defineProperty(process, 'resourcesPath', {
        value: 'C:\\Program Files\\StickyNotes\\resources',
        writable: true,
      });

      const path = getCLIPath();
      expect(path).toContain('app.asar.unpacked');
      expect(path).toContain(nodePath.join('cli', 'bin'));

      // Restore
      app.isPackaged = false;
      Object.defineProperty(process, 'resourcesPath', {
        value: originalResourcesPath,
        writable: true,
      });
    });
  });

  describe('addToPath - Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });
    });

    it('should add CLI to PATH when not already present', async () => {
      const { exec } = require('child_process');

      // Mock exec to return current PATH without CLI
      exec.mockImplementation((cmd, callback) => {
        if (cmd.includes('GetEnvironmentVariable')) {
          callback(null, { stdout: 'C:\\Windows\\System32;C:\\Program Files\\Git\\cmd' });
        } else if (cmd.includes('SetEnvironmentVariable')) {
          callback(null, { stdout: '' });
        } else if (cmd.includes('SendMessageTimeout')) {
          callback(null, { stdout: '' });
        } else {
          callback(new Error('Unknown command'));
        }
      });

      const result = await addToPath();
      expect(result).toBe(true);
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('GetEnvironmentVariable'),
        expect.any(Function)
      );
    });

    it('should return true if CLI already in PATH', async () => {
      const { exec } = require('child_process');
      const cliPath = getCLIPath();

      // Mock exec to return PATH with CLI already present
      exec.mockImplementation((cmd, callback) => {
        if (cmd.includes('GetEnvironmentVariable')) {
          callback(null, {
            stdout: `C:\\Windows\\System32;${cliPath};C:\\Program Files\\Git\\cmd`,
          });
        } else {
          callback(new Error('Should not set PATH'));
        }
      });

      const result = await addToPath();
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { exec } = require('child_process');

      exec.mockImplementation((cmd, callback) => {
        callback(new Error('PowerShell not found'));
      });

      const result = await addToPath();
      expect(result).toBe(false);
    });
  });

  describe('removeFromPath - Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });
    });

    it('should remove CLI from PATH', async () => {
      const { exec } = require('child_process');
      const cliPath = getCLIPath();

      // Mock exec to return PATH with CLI present
      exec.mockImplementation((cmd, callback) => {
        if (cmd.includes('GetEnvironmentVariable')) {
          callback(null, {
            stdout: `C:\\Windows\\System32;${cliPath};C:\\Program Files\\Git\\cmd`,
          });
        } else if (cmd.includes('SetEnvironmentVariable')) {
          callback(null, { stdout: '' });
        } else if (cmd.includes('SendMessageTimeout')) {
          callback(null, { stdout: '' });
        } else {
          callback(new Error('Unknown command'));
        }
      });

      const result = await removeFromPath();
      expect(result).toBe(true);
    });

    it('should return true if CLI not in PATH', async () => {
      const { exec } = require('child_process');

      // Mock exec to return PATH without CLI
      exec.mockImplementation((cmd, callback) => {
        if (cmd.includes('GetEnvironmentVariable')) {
          callback(null, { stdout: 'C:\\Windows\\System32;C:\\Program Files\\Git\\cmd' });
        } else {
          callback(new Error('Should not modify PATH'));
        }
      });

      const result = await removeFromPath();
      expect(result).toBe(true);
    });

    it('should handle different separator positions', async () => {
      const { exec } = require('child_process');
      const cliPath = getCLIPath();

      // Test CLI at beginning
      exec.mockImplementation((cmd, callback) => {
        if (cmd.includes('GetEnvironmentVariable')) {
          callback(null, { stdout: `${cliPath};C:\\Windows\\System32` });
        } else if (cmd.includes('SetEnvironmentVariable')) {
          callback(null, { stdout: '' });
        } else if (cmd.includes('SendMessageTimeout')) {
          callback(null, { stdout: '' });
        }
      });

      let result = await removeFromPath();
      expect(result).toBe(true);

      // Test CLI at end
      exec.mockImplementation((cmd, callback) => {
        if (cmd.includes('GetEnvironmentVariable')) {
          callback(null, { stdout: `C:\\Windows\\System32;${cliPath}` });
        } else if (cmd.includes('SetEnvironmentVariable')) {
          callback(null, { stdout: '' });
        } else if (cmd.includes('SendMessageTimeout')) {
          callback(null, { stdout: '' });
        }
      });

      result = await removeFromPath();
      expect(result).toBe(true);
    });
  });

  describe('isInPath - Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });
    });

    it('should return true if CLI in PATH', async () => {
      const { exec } = require('child_process');
      const cliPath = getCLIPath();

      exec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: `C:\\Windows\\System32;${cliPath};C:\\Program Files\\Git\\cmd` });
      });

      const result = await isInPath();
      expect(result).toBe(true);
    });

    it('should return false if CLI not in PATH', async () => {
      const { exec } = require('child_process');

      exec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'C:\\Windows\\System32;C:\\Program Files\\Git\\cmd' });
      });

      const result = await isInPath();
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const { exec } = require('child_process');

      exec.mockImplementation((cmd, callback) => {
        callback(new Error('PowerShell error'));
      });

      const result = await isInPath();
      expect(result).toBe(false);
    });
  });

  describe('Non-Windows platforms', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });
    });

    it('addToPath should return false on non-Windows', async () => {
      const result = await addToPath();
      expect(result).toBe(false);
    });

    it('removeFromPath should return false on non-Windows', async () => {
      const result = await removeFromPath();
      expect(result).toBe(false);
    });

    it('isInPath should return false on non-Windows', async () => {
      const result = await isInPath();
      expect(result).toBe(false);
    });
  });
});
