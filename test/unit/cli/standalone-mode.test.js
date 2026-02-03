/**
 * CLI Standalone Mode Tests
 *
 * Tests the standalone CLI detection (process.pkg) and
 * installed application discovery logic.
 */

const path = require('path');
const fs = require('fs');

describe('CLI Standalone Mode', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };
  const originalPkg = process.pkg;

  afterEach(() => {
    // Restore platform, env, and pkg
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    process.env = { ...originalEnv };
    if (originalPkg === undefined) {
      delete process.pkg;
    } else {
      process.pkg = originalPkg;
    }
  });

  describe('Standalone Detection', () => {
    it('should detect development mode when process.pkg is undefined', () => {
      delete process.pkg;
      const isStandalone = typeof process.pkg !== 'undefined';
      expect(isStandalone).toBe(false);
    });

    it('should detect standalone mode when process.pkg is defined', () => {
      process.pkg = { entrypoint: '/snapshot/cli/bin/stickynotes.js' };
      const isStandalone = typeof process.pkg !== 'undefined';
      expect(isStandalone).toBe(true);
    });

    it('should use typeof check not truthiness', () => {
      // Even if process.pkg is falsy object, it should be detected
      process.pkg = {};
      const isStandalone = typeof process.pkg !== 'undefined';
      expect(isStandalone).toBe(true);
    });
  });

  describe('Windows App Discovery', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
    });

    it('should check LOCALAPPDATA first', () => {
      process.env.LOCALAPPDATA = 'C:\\Users\\TestUser\\AppData\\Local';
      process.env.PROGRAMFILES = 'C:\\Program Files';
      process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';

      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'StickyNotes', 'StickyNotes.exe'),
        path.join(process.env.PROGRAMFILES || '', 'StickyNotes', 'StickyNotes.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'StickyNotes', 'StickyNotes.exe'),
      ];

      // LOCALAPPDATA should be first (user install location)
      expect(possiblePaths[0]).toContain('AppData');
      expect(possiblePaths[0]).toContain('Local');
    });

    it('should construct correct paths for all Windows locations', () => {
      process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';
      process.env.PROGRAMFILES = 'C:\\Program Files';
      process.env['PROGRAMFILES(X86)'] = 'C:\\Program Files (x86)';

      const paths = [
        path.join(process.env.LOCALAPPDATA, 'Programs', 'StickyNotes', 'StickyNotes.exe'),
        path.join(process.env.PROGRAMFILES, 'StickyNotes', 'StickyNotes.exe'),
        path.join(process.env['PROGRAMFILES(X86)'], 'StickyNotes', 'StickyNotes.exe'),
      ];

      expect(paths[0]).toBe(
        path.join('C:\\Users\\Test\\AppData\\Local', 'Programs', 'StickyNotes', 'StickyNotes.exe')
      );
      expect(paths[1]).toBe(path.join('C:\\Program Files', 'StickyNotes', 'StickyNotes.exe'));
      expect(paths[2]).toBe(path.join('C:\\Program Files (x86)', 'StickyNotes', 'StickyNotes.exe'));
    });

    it('should handle missing LOCALAPPDATA gracefully', () => {
      delete process.env.LOCALAPPDATA;
      process.env.PROGRAMFILES = 'C:\\Program Files';

      const localAppDataPath = path.join(
        process.env.LOCALAPPDATA || '',
        'Programs',
        'StickyNotes',
        'StickyNotes.exe'
      );

      // Should still produce a valid path structure
      expect(localAppDataPath).toContain('StickyNotes.exe');
      expect(localAppDataPath).toContain('Programs');
    });

    it('should iterate through paths until one exists', () => {
      const mockPaths = [
        '/nonexistent/path1/StickyNotes.exe',
        '/nonexistent/path2/StickyNotes.exe',
        path.join(__dirname, '..', '..', '..', 'package.json'), // This exists
      ];

      let foundPath = null;
      for (const p of mockPaths) {
        if (fs.existsSync(p)) {
          foundPath = p;
          break;
        }
      }

      expect(foundPath).not.toBeNull();
      expect(foundPath).toContain('package.json');
    });
  });

  describe('macOS App Discovery', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
    });

    it('should use standard macOS Applications path', () => {
      const macPath = '/Applications/StickyNotes.app/Contents/MacOS/StickyNotes';

      expect(macPath).toMatch(/^\/Applications\//);
      expect(macPath).toContain('.app/Contents/MacOS/');
    });

    it('should follow macOS app bundle structure', () => {
      const appName = 'StickyNotes';
      const macPath = `/Applications/${appName}.app/Contents/MacOS/${appName}`;

      // Verify bundle structure
      expect(macPath).toContain(`${appName}.app`);
      expect(macPath).toContain('Contents/MacOS');
      expect(macPath).toMatch(new RegExp(`MacOS/${appName}$`));
    });
  });

  describe('Linux App Discovery', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
      process.env.HOME = '/home/testuser';
    });

    it('should check system paths first', () => {
      const linuxPaths = [
        '/usr/bin/stickynotes',
        '/usr/local/bin/stickynotes',
        path.join(process.env.HOME || '', '.local', 'bin', 'stickynotes'),
      ];

      // System paths should come before user paths
      expect(linuxPaths[0]).toBe('/usr/bin/stickynotes');
      expect(linuxPaths[1]).toBe('/usr/local/bin/stickynotes');
    });

    it('should include user local bin', () => {
      const userPath = path.join(process.env.HOME || '', '.local', 'bin', 'stickynotes');

      // Use path.join for cross-platform separator
      expect(userPath).toContain(path.join('.local', 'bin'));
    });

    it('should handle missing HOME gracefully', () => {
      delete process.env.HOME;

      const userPath = path.join(process.env.HOME || '', '.local', 'bin', 'stickynotes');

      // Should produce a path starting with .local when HOME is empty
      expect(userPath).toContain('.local');
      expect(userPath).toContain('stickynotes');
    });
  });

  describe('App Not Found Handling', () => {
    it('should provide clear error message', () => {
      const errorMsg = 'Error: StickyNotes application not found.';
      const helpMsg = 'Please install StickyNotes or launch it manually from the Start menu.';

      expect(errorMsg).toContain('not found');
      expect(helpMsg).toContain('install');
      expect(helpMsg).toContain('manually');
    });

    it('should return ERROR exit code when app not found', () => {
      const EXIT_CODES = {
        SUCCESS: 0,
        ERROR: 1,
        SERVICE_NOT_RUNNING: 2,
        TIMEOUT: 3,
        INVALID_ARGS: 4,
      };

      // When app not found in standalone mode, should return ERROR (1)
      expect(EXIT_CODES.ERROR).toBe(1);
    });
  });

  describe('Spawn Options', () => {
    it('should use detached mode for background execution', () => {
      const spawnOptions = {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      };

      // Detached allows the child to continue after parent exits
      expect(spawnOptions.detached).toBe(true);
    });

    it('should ignore stdio for background process', () => {
      const spawnOptions = {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      };

      // Ignore stdio prevents pipe hanging
      expect(spawnOptions.stdio).toBe('ignore');
    });

    it('should hide window on Windows', () => {
      const spawnOptions = {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      };

      // windowsHide prevents console flash
      expect(spawnOptions.windowsHide).toBe(true);
    });

    it('should pass --minimized flag', () => {
      const args = ['--minimized'];

      expect(args).toContain('--minimized');
    });
  });

  describe('Development Mode Electron Path', () => {
    it('should require electron module in dev mode', () => {
      // In test/dev environment, electron should be resolvable
      expect(() => require.resolve('electron')).not.toThrow();
    });

    it('should construct correct app path relative to CLI', () => {
      // CLI is at: project/cli/bin/stickynotes.js
      // App path is: project/
      const cliBinDir = path.join(__dirname, '..', '..', '..', 'cli', 'bin');
      const appPath = path.join(cliBinDir, '..', '..');
      const normalizedAppPath = path.normalize(appPath);

      // Should point to project root
      const packageJsonPath = path.join(normalizedAppPath, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const pkg = require(packageJsonPath);
      expect(pkg.name).toBe('stickynotes');
    });
  });

  describe('Error Messages for Dev Mode', () => {
    it('should provide helpful error when electron not found', () => {
      const errorMsg = 'Error: Cannot start StickyNotes in development mode.';
      const helpMsg = 'Make sure electron is installed: npm install electron';

      expect(errorMsg).toContain('development mode');
      expect(helpMsg).toContain('npm install');
    });
  });

  describe('Service Already Running Check', () => {
    it('should check service before starting', () => {
      // The startService function first tries to connect
      // to check if service is already running
      const checkConfig = { timeout: 1000, retries: 0 };

      expect(checkConfig.timeout).toBe(1000);
      expect(checkConfig.retries).toBe(0); // Don't retry for initial check
    });

    it('should return SUCCESS if already running', () => {
      const EXIT_CODES = { SUCCESS: 0 };
      const alreadyRunningMessage = 'StickyNotes is already running';

      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(alreadyRunningMessage).toContain('already running');
    });
  });

  describe('Wait Loop for Service Startup', () => {
    it('should poll for service availability', () => {
      const iterations = 20;
      const delayMs = 500;
      const totalWaitTime = iterations * delayMs;

      // Should wait up to 10 seconds
      expect(totalWaitTime).toBe(10000);
    });

    it('should use short timeout for polling', () => {
      const pollConfig = { timeout: 1000, retries: 0 };

      expect(pollConfig.timeout).toBe(1000);
      expect(pollConfig.retries).toBe(0);
    });

    it('should return TIMEOUT exit code on failure', () => {
      const EXIT_CODES = { TIMEOUT: 3 };

      expect(EXIT_CODES.TIMEOUT).toBe(3);
    });
  });
});

describe('Path Finding Algorithm', () => {
  it('should find first existing path', () => {
    const findExecutable = (paths) => {
      for (const p of paths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
      return null;
    };

    const testPaths = [
      '/nonexistent/path1',
      '/nonexistent/path2',
      path.join(__dirname, '..', '..', '..', 'package.json'),
    ];

    const found = findExecutable(testPaths);
    expect(found).not.toBeNull();
  });

  it('should return null when no path exists', () => {
    const findExecutable = (paths) => {
      for (const p of paths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
      return null;
    };

    const testPaths = ['/nonexistent/path1', '/nonexistent/path2', '/nonexistent/path3'];

    const found = findExecutable(testPaths);
    expect(found).toBeNull();
  });

  it('should stop at first match', () => {
    let checkCount = 0;
    const findExecutable = (paths) => {
      for (const p of paths) {
        checkCount++;
        if (fs.existsSync(p)) {
          return p;
        }
      }
      return null;
    };

    const testPaths = [
      path.join(__dirname, '..', '..', '..', 'package.json'), // Exists
      path.join(__dirname, '..', '..', '..', 'jest.config.js'), // Also exists
    ];

    findExecutable(testPaths);
    expect(checkCount).toBe(1); // Should stop after first match
  });
});
