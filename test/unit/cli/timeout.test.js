/**
 * CLI Timeout Tests
 *
 * Tests for CLI timeout option and timeout handling
 */

const { parseArgs } = require('../../../electron/cli/parser');
const { PipeClient, ERROR_CODES } = require('../../../cli/lib/client');

describe('CLI Timeout Handling', () => {
  describe('parseArgs timeout option', () => {
    test('should parse --timeout flag with value', () => {
      const args = ['node', 'stickynotes', 'app', 'status', '--timeout', '10000'];
      const result = parseArgs(args);

      expect(result.options.timeout).toBe(10000);
    });

    test('should parse timeout as number', () => {
      const args = ['node', 'stickynotes', 'note', 'list', '--timeout', '3000'];
      const result = parseArgs(args);

      expect(result.options.timeout).toBe(3000);
      expect(typeof result.options.timeout).toBe('number');
    });

    test('should reject invalid timeout values', () => {
      const args = ['node', 'stickynotes', 'app', 'status', '--timeout', 'invalid'];

      expect(() => parseArgs(args)).toThrow(
        '--timeout must be a positive number (in milliseconds)'
      );
    });

    test('should handle negative timeout values as separate arg', () => {
      // Note: -1 is interpreted as a short option, not a value for --timeout
      // This is expected parser behavior - negative values must use --timeout=-1 syntax
      const args = ['node', 'stickynotes', 'app', 'status', '--timeout', '-1'];

      // Parser doesn't throw - it treats --timeout as boolean flag and -1 as short option
      const result = parseArgs(args);
      expect(result.options.timeout).toBe(true);
    });

    test('should reject zero timeout', () => {
      const args = ['node', 'stickynotes', 'app', 'status', '--timeout', '0'];

      expect(() => parseArgs(args)).toThrow(
        '--timeout must be a positive number (in milliseconds)'
      );
    });

    test('should pass validation for positive timeout', () => {
      const args = ['node', 'stickynotes', 'app', 'status', '--timeout', '5000'];

      const result = parseArgs(args);
      expect(result.options.timeout).toBe(5000);
    });

    test('should handle timeout with other options', () => {
      const args = [
        'node',
        'stickynotes',
        'note',
        'list',
        '--timeout',
        '5000',
        '--json',
        '--archived',
      ];
      const result = parseArgs(args);

      expect(result.options.timeout).toBe(5000);
      expect(result.options.json).toBe(true);
      expect(result.options.archived).toBe(true);
    });
  });

  describe('PipeClient timeout behavior', () => {
    test('should use custom timeout when provided', () => {
      const client = new PipeClient({ timeout: 10000 });
      expect(client.timeout).toBe(10000);
    });

    test('should use default timeout when not provided', () => {
      const client = new PipeClient();
      expect(client.timeout).toBe(5000);
    });

    test('should timeout request after specified duration', async () => {
      // Create client with very short timeout
      const client = new PipeClient({ timeout: 100, retries: 0 });

      // Mock socket that never responds
      client.socket = {
        write: jest.fn(),
        destroyed: false,
      };
      client.connected = true;

      // Request should timeout
      await expect(client.request('test:method', {})).rejects.toMatchObject({
        code: ERROR_CODES.REQUEST_TIMEOUT,
        message: expect.stringContaining('timed out after 100ms'),
      });
    });

    test('should include timeout info in error', async () => {
      expect.assertions(4); // Ensures catch block is reached

      const client = new PipeClient({ timeout: 2000, retries: 0 });

      client.socket = {
        write: jest.fn(),
        destroyed: false,
      };
      client.connected = true;

      try {
        await client.request('test:method', {});
      } catch (error) {
        expect(error.code).toBe(ERROR_CODES.REQUEST_TIMEOUT);
        expect(error.message).toContain('2000ms');
        expect(error.details).toHaveProperty('timeout', 2000);
        expect(error.details).toHaveProperty('method', 'test:method');
      }
    });
  });

  describe('Connection timeout', () => {
    test('should timeout connection after specified duration', async () => {
      const client = new PipeClient({
        connectTimeout: 100,
        retries: 0,
        pipeName: '\\\\.\\pipe\\stickynotes-nonexistent-test-' + Date.now(),
      });

      // Connection should timeout quickly
      await expect(client.connect()).rejects.toMatchObject({
        code: ERROR_CODES.SERVICE_NOT_RUNNING,
      });
    });

    test('should respect connection timeout separate from request timeout', () => {
      const client = new PipeClient({
        timeout: 10000,
        connectTimeout: 1000,
      });

      expect(client.timeout).toBe(10000);
      expect(client.connectTimeout).toBe(1000);
    });
  });

  describe('Retry behavior with timeout', () => {
    test('should retry connection with backoff', async () => {
      const client = new PipeClient({
        timeout: 1000,
        retries: 2,
        backoff: [100, 200],
        connectTimeout: 100,
        pipeName: '\\\\.\\pipe\\stickynotes-nonexistent-test-' + Date.now(),
      });

      const startTime = Date.now();

      await expect(client.connect()).rejects.toMatchObject({
        code: ERROR_CODES.SERVICE_NOT_RUNNING,
      });

      const elapsed = Date.now() - startTime;

      // Should have tried 3 times (initial + 2 retries)
      // With backoff: 100ms + 100ms + 200ms = at least 400ms
      expect(elapsed).toBeGreaterThanOrEqual(300);
    });

    test('should reject with SERVICE_NOT_RUNNING when pipe not available', async () => {
      const client = new PipeClient({
        timeout: 1000,
        retries: 1, // Minimal retries for faster test
        backoff: [100], // Short backoff
        connectTimeout: 100,
        pipeName: '\\\\.\\pipe\\stickynotes-nonexistent-test-' + Date.now(),
      });

      await expect(client.connect()).rejects.toMatchObject({
        code: ERROR_CODES.SERVICE_NOT_RUNNING,
      });
    });

    test('should include attempt count in error details', async () => {
      expect.assertions(2); // Ensures catch block is reached

      const client = new PipeClient({
        timeout: 1000,
        retries: 2,
        connectTimeout: 100,
        pipeName: '\\\\.\\pipe\\stickynotes-nonexistent-test-' + Date.now(),
      });

      try {
        await client.connect();
      } catch (error) {
        expect(error.code).toBe(ERROR_CODES.SERVICE_NOT_RUNNING);
        expect(error.details).toHaveProperty('attempts', 3); // 1 initial + 2 retries
      }
    });
  });

  describe('Timeout edge cases', () => {
    test('should handle very short timeout', async () => {
      const client = new PipeClient({ timeout: 1, retries: 0 });

      client.socket = {
        write: jest.fn(),
        destroyed: false,
      };
      client.connected = true;

      // Even with 1ms timeout, should handle gracefully
      await expect(client.request('test:method', {})).rejects.toMatchObject({
        code: ERROR_CODES.REQUEST_TIMEOUT,
      });
    });

    test('should handle very long timeout', async () => {
      const client = new PipeClient({ timeout: 60000, retries: 0 });

      expect(client.timeout).toBe(60000);

      // Should not throw during construction
      expect(client).toBeDefined();
    });

    test('should clean up pending requests on timeout', async () => {
      const client = new PipeClient({ timeout: 100, retries: 0 });

      client.socket = {
        write: jest.fn(),
        destroyed: false,
      };
      client.connected = true;

      // Start a request that will timeout
      const promise = client.request('test:method', {});

      // Before timeout, pending request should exist
      expect(client.pendingRequests.size).toBe(1);

      // Wait for timeout
      await expect(promise).rejects.toMatchObject({
        code: ERROR_CODES.REQUEST_TIMEOUT,
      });

      // After timeout, pending request should be cleaned up
      expect(client.pendingRequests.size).toBe(0);
    });

    test('should handle multiple concurrent timeouts', async () => {
      const client = new PipeClient({ timeout: 100, retries: 0 });

      client.socket = {
        write: jest.fn(),
        destroyed: false,
      };
      client.connected = true;

      // Start multiple requests that will all timeout
      const promises = [
        client.request('test:method1', {}),
        client.request('test:method2', {}),
        client.request('test:method3', {}),
      ];

      // Wait for all to settle (all should timeout)
      const results = await Promise.allSettled(promises);

      // All should be rejected with timeout error
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
        expect(result.reason).toMatchObject({
          code: ERROR_CODES.REQUEST_TIMEOUT,
        });
      });

      // All pending requests should be cleaned up
      expect(client.pendingRequests.size).toBe(0);
    });
  });

  describe('Timeout with disconnect', () => {
    test('should reject pending requests when disconnecting during timeout', async () => {
      const client = new PipeClient({ timeout: 5000, retries: 0 });

      client.socket = {
        write: jest.fn(),
        end: jest.fn(),
        once: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(callback, 10);
          }
        }),
        destroyed: false,
      };
      client.connected = true;

      // Start request
      const promise = client.request('test:method', {});

      // Disconnect while request is pending
      await client.disconnect();

      // Request should be rejected
      await expect(promise).rejects.toBeDefined();
    });

    test('should handle disconnect timeout', async () => {
      const client = new PipeClient();

      const mockDestroy = jest.fn();
      client.socket = {
        end: jest.fn(),
        destroy: mockDestroy,
        once: jest.fn(), // Never calls callback
        destroyed: false,
      };
      client.connected = true;

      // Disconnect should complete even if socket doesn't close
      const startTime = Date.now();
      await client.disconnect();
      const elapsed = Date.now() - startTime;

      // Should timeout after 1 second and force close
      expect(elapsed).toBeLessThan(1500);
      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
