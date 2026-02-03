/**
 * Structured Logger Tests
 * Tests for shared/logging/logger.js
 */

// Store original environment
const originalEnv = { ...process.env };

// Mock console methods
const mockConsole = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  warn: jest.spyOn(console, 'warn').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation(),
};

// Must require logger AFTER setting up mocks
let logger;

describe('Structured Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_JSON;
    // Re-require logger to get fresh state
    jest.resetModules();
    logger = require('../../../shared/logging/logger');
    // Reset to default level
    logger.setLevel('info');
    logger.setJsonFormat(false);
  });

  afterAll(() => {
    process.env = originalEnv;
    mockConsole.log.mockRestore();
    mockConsole.warn.mockRestore();
    mockConsole.error.mockRestore();
  });

  describe('create', () => {
    it('should create a logger instance with component name', () => {
      const log = logger.create('TestComponent');

      expect(log).toBeDefined();
      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.child).toBe('function');
    });

    it('should use "App" as default component name', () => {
      const log = logger.create();
      log.info('test message');

      expect(mockConsole.log).toHaveBeenCalled();
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toContain('[App]');
    });
  });

  describe('Log Levels', () => {
    describe('debug', () => {
      it('should not log when level is info (default)', () => {
        const log = logger.create('Test');
        log.debug('debug message');

        expect(mockConsole.log).not.toHaveBeenCalled();
      });

      it('should log when level is debug', () => {
        logger.setLevel('debug');
        const log = logger.create('Test');
        log.debug('debug message');

        expect(mockConsole.log).toHaveBeenCalled();
        const logCall = mockConsole.log.mock.calls[0][0];
        expect(logCall).toContain('[DEBUG]');
        expect(logCall).toContain('[Test]');
        expect(logCall).toContain('debug message');
      });
    });

    describe('info', () => {
      it('should log at default level', () => {
        const log = logger.create('Test');
        log.info('info message');

        expect(mockConsole.log).toHaveBeenCalled();
        const logCall = mockConsole.log.mock.calls[0][0];
        expect(logCall).toContain('[INFO]');
        expect(logCall).toContain('info message');
      });

      it('should not log when level is warn', () => {
        logger.setLevel('warn');
        const log = logger.create('Test');
        log.info('info message');

        expect(mockConsole.log).not.toHaveBeenCalled();
      });
    });

    describe('warn', () => {
      it('should log at default level', () => {
        const log = logger.create('Test');
        log.warn('warning message');

        expect(mockConsole.warn).toHaveBeenCalled();
        const logCall = mockConsole.warn.mock.calls[0][0];
        expect(logCall).toContain('[WARN]');
        expect(logCall).toContain('warning message');
      });

      it('should log when level is warn', () => {
        logger.setLevel('warn');
        const log = logger.create('Test');
        log.warn('warning message');

        expect(mockConsole.warn).toHaveBeenCalled();
      });

      it('should not log when level is error', () => {
        logger.setLevel('error');
        const log = logger.create('Test');
        log.warn('warning message');

        expect(mockConsole.warn).not.toHaveBeenCalled();
      });
    });

    describe('error', () => {
      it('should log at any level', () => {
        const log = logger.create('Test');
        log.error('error message');

        expect(mockConsole.error).toHaveBeenCalled();
        const logCall = mockConsole.error.mock.calls[0][0];
        expect(logCall).toContain('[ERROR]');
        expect(logCall).toContain('error message');
      });

      it('should always log even at error level', () => {
        logger.setLevel('error');
        const log = logger.create('Test');
        log.error('error message');

        expect(mockConsole.error).toHaveBeenCalled();
      });
    });
  });

  describe('Log Data', () => {
    it('should log additional data object', () => {
      const log = logger.create('Test');
      const data = { key: 'value', count: 42 };
      log.info('message with data', data);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('[INFO]'), data);
    });

    it('should format Error objects', () => {
      const log = logger.create('Test');
      const error = new Error('test error');
      error.code = 'TEST_CODE';
      log.error('error occurred', error);

      expect(mockConsole.error).toHaveBeenCalled();
      const [, formattedError] = mockConsole.error.mock.calls[0];
      expect(formattedError).toHaveProperty('name', 'Error');
      expect(formattedError).toHaveProperty('message', 'test error');
      expect(formattedError).toHaveProperty('stack');
      expect(formattedError).toHaveProperty('code', 'TEST_CODE');
    });

    it('should handle null data', () => {
      const log = logger.create('Test');
      log.info('message only');

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      // Should only have the message string, not additional data
      expect(mockConsole.log.mock.calls[0].length).toBe(1);
    });

    it('should handle non-Error objects passed to error', () => {
      const log = logger.create('Test');
      log.error('error with string', 'just a string');

      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('JSON Output Mode', () => {
    beforeEach(() => {
      logger.setJsonFormat(true);
    });

    it('should output JSON formatted log', () => {
      const log = logger.create('TestComponent');
      log.info('json message');

      expect(mockConsole.log).toHaveBeenCalled();
      const logOutput = mockConsole.log.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'INFO');
      expect(parsed).toHaveProperty('component', 'TestComponent');
      expect(parsed).toHaveProperty('message', 'json message');
    });

    it('should include data in JSON output', () => {
      const log = logger.create('Test');
      log.info('message', { extra: 'data' });

      const logOutput = mockConsole.log.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.data).toEqual({ extra: 'data' });
    });

    it('should use console.error for error level in JSON mode', () => {
      const log = logger.create('Test');
      log.error('json error');

      expect(mockConsole.error).toHaveBeenCalled();
      const logOutput = mockConsole.error.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('ERROR');
    });

    it('should use console.warn for warn level in JSON mode', () => {
      const log = logger.create('Test');
      log.warn('json warning');

      expect(mockConsole.warn).toHaveBeenCalled();
      const logOutput = mockConsole.warn.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('WARN');
    });

    it('should have ISO timestamp in JSON output', () => {
      const log = logger.create('Test');
      const before = new Date().toISOString();
      log.info('timestamp test');
      const after = new Date().toISOString();

      const logOutput = mockConsole.log.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.timestamp >= before).toBe(true);
      expect(parsed.timestamp <= after).toBe(true);
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with combined component name', () => {
      const log = logger.create('Parent');
      const childLog = log.child('Child');
      childLog.info('child message');

      expect(mockConsole.log).toHaveBeenCalled();
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toContain('[Parent:Child]');
    });

    it('should create deeply nested child loggers', () => {
      const log = logger.create('Level1');
      const child1 = log.child('Level2');
      const child2 = child1.child('Level3');
      child2.info('nested message');

      expect(mockConsole.log).toHaveBeenCalled();
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toContain('[Level1:Level2:Level3]');
    });

    it('should inherit log level from parent', () => {
      logger.setLevel('warn');
      const log = logger.create('Parent');
      const childLog = log.child('Child');
      childLog.info('should not appear');
      childLog.warn('should appear');

      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
    });
  });

  describe('setLevel', () => {
    it('should change minimum log level', () => {
      const log = logger.create('Test');

      logger.setLevel('debug');
      log.debug('debug visible');
      expect(mockConsole.log).toHaveBeenCalled();

      mockConsole.log.mockClear();

      logger.setLevel('error');
      log.info('info hidden');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('should handle uppercase level names', () => {
      logger.setLevel('DEBUG');
      const log = logger.create('Test');
      log.debug('debug message');

      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('should ignore invalid level names', () => {
      const originalLevel = logger.getLevel();
      logger.setLevel('invalid');

      expect(logger.getLevel()).toBe(originalLevel);
    });
  });

  describe('setJsonFormat', () => {
    it('should enable JSON format', () => {
      logger.setJsonFormat(true);
      const log = logger.create('Test');
      log.info('test');

      const logOutput = mockConsole.log.mock.calls[0][0];
      expect(() => JSON.parse(logOutput)).not.toThrow();
    });

    it('should disable JSON format', () => {
      logger.setJsonFormat(true);
      logger.setJsonFormat(false);
      const log = logger.create('Test');
      log.info('test');

      const logOutput = mockConsole.log.mock.calls[0][0];
      expect(logOutput).toContain('[INFO]');
      expect(() => JSON.parse(logOutput)).toThrow();
    });
  });

  describe('getLevel', () => {
    it('should return current level name', () => {
      expect(logger.getLevel()).toBe('info');

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });
  });

  describe('LOG_LEVELS constant', () => {
    it('should export LOG_LEVELS', () => {
      expect(logger.LOG_LEVELS).toBeDefined();
      expect(logger.LOG_LEVELS.debug).toBe(0);
      expect(logger.LOG_LEVELS.info).toBe(1);
      expect(logger.LOG_LEVELS.warn).toBe(2);
      expect(logger.LOG_LEVELS.error).toBe(3);
    });
  });

  describe('Timestamp Format', () => {
    it('should include ISO timestamp in human-readable format', () => {
      const log = logger.create('Test');
      log.info('timestamp test');

      const logCall = mockConsole.log.mock.calls[0][0];
      // Timestamp should be at the beginning in brackets
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should respect LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'debug';
      jest.resetModules();
      const freshLogger = require('../../../shared/logging/logger');

      const log = freshLogger.create('Test');
      log.debug('should appear');

      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('should respect LOG_JSON environment variable', () => {
      process.env.LOG_JSON = 'true';
      jest.resetModules();
      const freshLogger = require('../../../shared/logging/logger');

      const log = freshLogger.create('Test');
      log.info('json test');

      const logOutput = mockConsole.log.mock.calls[0][0];
      expect(() => JSON.parse(logOutput)).not.toThrow();
    });
  });
});
