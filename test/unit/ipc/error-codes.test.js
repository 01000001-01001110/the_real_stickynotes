/**
 * Tests for standardized error codes
 */

const {
  ERROR_CODES,
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  TimeoutError,
  ServiceUnavailableError,
  DatabaseError,
  ConfigError,
  mapError,
  isValidErrorCode,
  isRetryableError,
  getHttpStatus,
} = require('../../../shared/config/error-codes');

describe('Error Codes Module', () => {
  describe('ERROR_CODES constants', () => {
    test('should define standard JSON-RPC codes', () => {
      expect(ERROR_CODES.PARSE_ERROR).toBe(-32700);
      expect(ERROR_CODES.INVALID_REQUEST).toBe(-32600);
      expect(ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
      expect(ERROR_CODES.INVALID_PARAMS).toBe(-32602);
      expect(ERROR_CODES.INTERNAL_ERROR).toBe(-32603);
    });

    test('should define application-specific codes', () => {
      expect(ERROR_CODES.NOTE_NOT_FOUND).toBe(-32001);
      expect(ERROR_CODES.FOLDER_NOT_FOUND).toBe(-32002);
      expect(ERROR_CODES.TAG_NOT_FOUND).toBe(-32003);
      expect(ERROR_CODES.VALIDATION_FAILED).toBe(-32004);
      expect(ERROR_CODES.CONFIG_INVALID).toBe(-32005);
      expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe(-32006);
      expect(ERROR_CODES.TIMEOUT).toBe(-32007);
      expect(ERROR_CODES.PERMISSION_DENIED).toBe(-32008);
    });

    test('should have unique error codes', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('AppError', () => {
    test('should create error with code and message', () => {
      const error = new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
      expect(error.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
      expect(error.message).toBe('Note not found');
      expect(error.name).toBe('NoteNotFound');
    });

    test('should include optional data', () => {
      const error = new AppError(ERROR_CODES.VALIDATION_FAILED, 'Invalid input', {
        field: 'title',
      });
      expect(error.data).toEqual({ field: 'title' });
    });

    test('should convert to JSON', () => {
      const error = new AppError(ERROR_CODES.INTERNAL_ERROR, 'Something went wrong', {
        detail: 'Database connection failed',
      });
      const json = error.toJSON();
      expect(json).toEqual({
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Something went wrong',
        data: { detail: 'Database connection failed' },
      });
    });

    test('should convert to JSON-RPC response', () => {
      const error = new AppError(ERROR_CODES.METHOD_NOT_FOUND, 'Method not found');
      const response = error.toResponse(123);
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 123,
        error: {
          code: ERROR_CODES.METHOD_NOT_FOUND,
          message: 'Method not found',
        },
      });
    });

    test('should indicate if error is retryable', () => {
      const retryable = new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, 'Service unavailable');
      expect(retryable.isRetryable()).toBe(true);

      const notRetryable = new AppError(ERROR_CODES.VALIDATION_FAILED, 'Invalid input');
      expect(notRetryable.isRetryable()).toBe(false);
    });
  });

  describe('Specialized Error Classes', () => {
    test('ValidationError should use VALIDATION_FAILED code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      expect(error.name).toBe('ValidationError');
    });

    test('NotFoundError should use resource-specific code', () => {
      const noteError = new NotFoundError('note', '123');
      expect(noteError.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
      expect(noteError.message).toContain('note');
      expect(noteError.message).toContain('123');
      expect(noteError.resource).toBe('note');
      expect(noteError.identifier).toBe('123');

      const folderError = new NotFoundError('folder', '456');
      expect(folderError.code).toBe(ERROR_CODES.FOLDER_NOT_FOUND);
    });

    test('PermissionError should use PERMISSION_DENIED code', () => {
      const error = new PermissionError('Access denied');
      expect(error.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    });

    test('TimeoutError should use TIMEOUT code', () => {
      const error = new TimeoutError();
      expect(error.code).toBe(ERROR_CODES.TIMEOUT);
      expect(error.message).toContain('timed out');
    });

    test('ServiceUnavailableError should use SERVICE_UNAVAILABLE code', () => {
      const error = new ServiceUnavailableError();
      expect(error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
    });

    test('DatabaseError should use DATABASE_ERROR code', () => {
      const error = new DatabaseError('Query failed');
      expect(error.code).toBe(ERROR_CODES.DATABASE_ERROR);
    });

    test('ConfigError should use CONFIG_INVALID code', () => {
      const error = new ConfigError('Invalid config');
      expect(error.code).toBe(ERROR_CODES.CONFIG_INVALID);
    });
  });

  describe('mapError', () => {
    test('should pass through AppError unchanged', () => {
      const original = new AppError(ERROR_CODES.NOTE_NOT_FOUND, 'Note not found');
      const mapped = mapError(original);
      expect(mapped).toBe(original);
    });

    test('should map error with valid code', () => {
      const error = new Error('Something went wrong');
      error.code = ERROR_CODES.TIMEOUT;
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.TIMEOUT);
    });

    test('should map "note not found" message', () => {
      const error = new Error('Note not found');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.NOTE_NOT_FOUND);
    });

    test('should map "folder not found" message', () => {
      const error = new Error('Folder not found');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.FOLDER_NOT_FOUND);
    });

    test('should map "tag not found" message', () => {
      const error = new Error('Tag not found');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.TAG_NOT_FOUND);
    });

    test('should map validation errors', () => {
      const error = new Error('Invalid input provided');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    });

    test('should map timeout errors', () => {
      const error = new Error('Operation timed out');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.TIMEOUT);
    });

    test('should map permission errors', () => {
      const error = new Error('Permission denied');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.PERMISSION_DENIED);
    });

    test('should map config errors', () => {
      const error = new Error('Config is invalid');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.CONFIG_INVALID);
    });

    test('should map service unavailable errors', () => {
      const error = new Error('Service unavailable');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
    });

    test('should map database errors', () => {
      const error = new Error('Database query failed');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.DATABASE_ERROR);
    });

    test('should default to INTERNAL_ERROR', () => {
      const error = new Error('Something unexpected');
      const mapped = mapError(error);
      expect(mapped.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe('Utility functions', () => {
    test('isValidErrorCode should validate error codes', () => {
      expect(isValidErrorCode(ERROR_CODES.NOTE_NOT_FOUND)).toBe(true);
      expect(isValidErrorCode(-99999)).toBe(false);
    });

    test('isRetryableError should identify retryable errors', () => {
      expect(isRetryableError(ERROR_CODES.SERVICE_UNAVAILABLE)).toBe(true);
      expect(isRetryableError(ERROR_CODES.TIMEOUT)).toBe(true);
      expect(isRetryableError(ERROR_CODES.VALIDATION_FAILED)).toBe(false);
      expect(isRetryableError(ERROR_CODES.NOTE_NOT_FOUND)).toBe(false);
    });

    test('getHttpStatus should return appropriate HTTP codes', () => {
      expect(getHttpStatus(ERROR_CODES.NOTE_NOT_FOUND)).toBe(404);
      expect(getHttpStatus(ERROR_CODES.VALIDATION_FAILED)).toBe(400);
      expect(getHttpStatus(ERROR_CODES.PERMISSION_DENIED)).toBe(403);
      expect(getHttpStatus(ERROR_CODES.INTERNAL_ERROR)).toBe(500);
      expect(getHttpStatus(ERROR_CODES.SERVICE_UNAVAILABLE)).toBe(503);
      expect(getHttpStatus(ERROR_CODES.TIMEOUT)).toBe(504);
    });
  });
});
