/**
 * Tests for pipe-methods.js - Named Pipe Method Registry
 */

const {
  MethodRegistry,
  ValidationError,
  ERROR_CODES,
} = require('../../../electron/ipc/pipe-methods');
const { NotFoundError } = require('../../../shared/config/error-codes');

describe('MethodRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new MethodRegistry();
  });

  describe('constructor', () => {
    test('creates empty registry', () => {
      expect(registry.methods.size).toBe(0);
      expect(registry.middleware.length).toBe(0);
    });
  });

  describe('register', () => {
    test('registers a method', () => {
      const handler = async () => 'test';
      registry.register('test:method', handler);

      expect(registry.has('test:method')).toBe(true);
    });

    test('throws error for non-function handler', () => {
      expect(() => {
        registry.register('test:method', 'not a function');
      }).toThrow('Handler for method "test:method" must be a function');
    });

    test('registers method with options', () => {
      const handler = async () => 'test';
      const options = { description: 'Test method' };
      registry.register('test:method', handler, options);

      expect(registry.has('test:method')).toBe(true);
    });
  });

  describe('has', () => {
    test('returns true for registered method', () => {
      registry.register('test:method', async () => 'test');
      expect(registry.has('test:method')).toBe(true);
    });

    test('returns false for unregistered method', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('list', () => {
    test('returns empty array for empty registry', () => {
      expect(registry.list()).toEqual([]);
    });

    test('returns sorted list of method names', () => {
      registry.register('zebra:method', async () => 'z');
      registry.register('alpha:method', async () => 'a');
      registry.register('beta:method', async () => 'b');

      const list = registry.list();
      expect(list).toEqual(['alpha:method', 'beta:method', 'zebra:method']);
    });
  });

  describe('use', () => {
    test('adds middleware function', () => {
      const middleware = async (_method, _params) => {};
      registry.use(middleware);

      expect(registry.middleware.length).toBe(1);
      expect(registry.middleware[0]).toBe(middleware);
    });

    test('throws error for non-function middleware', () => {
      expect(() => {
        registry.use('not a function');
      }).toThrow('Middleware must be a function');
    });

    test('adds multiple middleware functions', () => {
      const middleware1 = async (_method, _params) => {};
      const middleware2 = async (_method, _params) => {};

      registry.use(middleware1);
      registry.use(middleware2);

      expect(registry.middleware.length).toBe(2);
    });
  });

  describe('call', () => {
    test('calls registered method with params', async () => {
      const handler = async (params) => ({ result: params.value * 2 });
      registry.register('test:double', handler);

      const result = await registry.call('test:double', { value: 5 });
      expect(result).toEqual({ result: 10 });
    });

    test('throws NotFoundError for unregistered method', async () => {
      await expect(registry.call('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    test('executes middleware before handler', async () => {
      const order = [];

      const middleware1 = async () => {
        order.push('middleware1');
      };
      const middleware2 = async () => {
        order.push('middleware2');
      };
      const handler = async () => {
        order.push('handler');
        return 'result';
      };

      registry.use(middleware1);
      registry.use(middleware2);
      registry.register('test:method', handler);

      await registry.call('test:method', {});

      expect(order).toEqual(['middleware1', 'middleware2', 'handler']);
    });

    test('passes method and params to middleware', async () => {
      let capturedMethod;
      let capturedParams;

      const middleware = async (method, params) => {
        capturedMethod = method;
        capturedParams = params;
      };

      registry.use(middleware);
      registry.register('test:method', async () => 'result');

      await registry.call('test:method', { foo: 'bar' });

      expect(capturedMethod).toBe('test:method');
      expect(capturedParams).toEqual({ foo: 'bar' });
    });

    test('wraps handler errors with INTERNAL_ERROR code', async () => {
      const handler = async () => {
        throw new Error('Handler failed');
      };

      registry.register('test:method', handler);

      await expect(registry.call('test:method', {})).rejects.toMatchObject({
        message: 'Handler failed',
        code: ERROR_CODES.INTERNAL_ERROR,
      });
    });

    test('preserves custom error codes', async () => {
      const handler = async () => {
        const error = new Error('Custom error');
        error.code = ERROR_CODES.NOTE_NOT_FOUND;
        throw error;
      };

      registry.register('test:method', handler);

      await expect(registry.call('test:method', {})).rejects.toMatchObject({
        message: 'Custom error',
        code: ERROR_CODES.NOTE_NOT_FOUND,
      });
    });
  });
});

describe('Error Classes', () => {
  describe('ValidationError', () => {
    test('has correct properties', () => {
      const error = new ValidationError('Validation failed');

      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    });
  });
});

describe('ERROR_CODES', () => {
  test('contains standard JSON-RPC error codes', () => {
    expect(ERROR_CODES.PARSE_ERROR).toBe(-32700);
    expect(ERROR_CODES.INVALID_REQUEST).toBe(-32600);
    expect(ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
    expect(ERROR_CODES.INVALID_PARAMS).toBe(-32602);
    expect(ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
  });

  test('contains application-specific error codes', () => {
    expect(ERROR_CODES.NOTE_NOT_FOUND).toBe(-32001);
    expect(ERROR_CODES.FOLDER_NOT_FOUND).toBe(-32002);
    expect(ERROR_CODES.TAG_NOT_FOUND).toBe(-32003);
    expect(ERROR_CODES.VALIDATION_FAILED).toBe(-32004);
    expect(ERROR_CODES.CONFIG_INVALID).toBe(-32005);
    expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe(-32006);
    expect(ERROR_CODES.TIMEOUT).toBe(-32007);
    expect(ERROR_CODES.PERMISSION_DENIED).toBe(-32008);
  });

  test('all error codes are negative integers', () => {
    Object.values(ERROR_CODES).forEach((code) => {
      expect(typeof code).toBe('number');
      expect(code).toBeLessThan(0);
      expect(Number.isInteger(code)).toBe(true);
    });
  });
});
