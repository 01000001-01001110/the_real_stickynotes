/**
 * Standardized JSON-RPC 2.0 Error Codes for StickyNotes
 *
 * This module defines all error codes used throughout the application
 * to ensure consistent error handling across IPC, CLI, and internal operations.
 *
 * Reference: https://www.jsonrpc.org/specification#error_object
 */

/**
 * JSON-RPC 2.0 Error Codes
 * @readonly
 * @enum {number}
 */
const ERROR_CODES = {
  // ============================================================================
  // Standard JSON-RPC 2.0 errors (-32768 to -32000)
  // ============================================================================

  /**
   * Parse error - Invalid JSON was received by the server
   * An error occurred on the server while parsing the JSON text
   */
  PARSE_ERROR: -32700,

  /**
   * Invalid Request - The JSON sent is not a valid Request object
   */
  INVALID_REQUEST: -32600,

  /**
   * Method not found - The method does not exist / is not available
   */
  METHOD_NOT_FOUND: -32601,

  /**
   * Invalid params - Invalid method parameter(s)
   */
  INVALID_PARAMS: -32602,

  /**
   * Internal error - Internal JSON-RPC error
   */
  INTERNAL_ERROR: -32603,

  // ============================================================================
  // Application-specific errors (-32099 to -32000)
  // ============================================================================

  /**
   * Note not found - The requested note does not exist or has been deleted
   */
  NOTE_NOT_FOUND: -32001,

  /**
   * Folder not found - The requested folder does not exist
   */
  FOLDER_NOT_FOUND: -32002,

  /**
   * Tag not found - The requested tag does not exist
   */
  TAG_NOT_FOUND: -32003,

  /**
   * Validation failed - Input validation failed
   */
  VALIDATION_FAILED: -32004,

  /**
   * Config invalid - Configuration is invalid or corrupt
   */
  CONFIG_INVALID: -32005,

  /**
   * Service unavailable - The service is temporarily unavailable
   */
  SERVICE_UNAVAILABLE: -32006,

  /**
   * Timeout - Operation timed out
   */
  TIMEOUT: -32007,

  /**
   * Permission denied - Insufficient permissions to perform operation
   */
  PERMISSION_DENIED: -32008,

  /**
   * Database error - Database operation failed
   */
  DATABASE_ERROR: -32009,

  /**
   * Attachment not found - The requested attachment does not exist
   */
  ATTACHMENT_NOT_FOUND: -32010,

  /**
   * File error - File system operation failed
   */
  FILE_ERROR: -32011,

  /**
   * Network error - Network operation failed
   */
  NETWORK_ERROR: -32012,

  /**
   * Already exists - Resource already exists (duplicate)
   */
  ALREADY_EXISTS: -32013,

  /**
   * Resource locked - Resource is locked and cannot be modified
   */
  RESOURCE_LOCKED: -32014,

  /**
   * Operation cancelled - Operation was cancelled by user or system
   */
  OPERATION_CANCELLED: -32015,

  /**
   * Not implemented - Feature not yet implemented
   */
  NOT_IMPLEMENTED: -32016,

  /**
   * Rate limit exceeded - Too many requests
   */
  RATE_LIMIT_EXCEEDED: -32017,

  /**
   * Resource limit exceeded - Storage or other resource limit exceeded
   */
  RESOURCE_LIMIT_EXCEEDED: -32018,
};

/**
 * Error code metadata
 * Provides human-readable descriptions and suggested HTTP status codes
 */
const ERROR_METADATA = {
  [ERROR_CODES.PARSE_ERROR]: {
    name: 'ParseError',
    description: 'Invalid JSON was received',
    httpStatus: 400,
    retryable: false,
  },
  [ERROR_CODES.INVALID_REQUEST]: {
    name: 'InvalidRequest',
    description: 'The request is not a valid JSON-RPC request',
    httpStatus: 400,
    retryable: false,
  },
  [ERROR_CODES.METHOD_NOT_FOUND]: {
    name: 'MethodNotFound',
    description: 'The requested method does not exist',
    httpStatus: 404,
    retryable: false,
  },
  [ERROR_CODES.INVALID_PARAMS]: {
    name: 'InvalidParams',
    description: 'Invalid method parameters',
    httpStatus: 400,
    retryable: false,
  },
  [ERROR_CODES.INTERNAL_ERROR]: {
    name: 'InternalError',
    description: 'Internal error',
    httpStatus: 500,
    retryable: true,
  },
  [ERROR_CODES.NOTE_NOT_FOUND]: {
    name: 'NoteNotFound',
    description: 'The requested note does not exist',
    httpStatus: 404,
    retryable: false,
  },
  [ERROR_CODES.FOLDER_NOT_FOUND]: {
    name: 'FolderNotFound',
    description: 'The requested folder does not exist',
    httpStatus: 404,
    retryable: false,
  },
  [ERROR_CODES.TAG_NOT_FOUND]: {
    name: 'TagNotFound',
    description: 'The requested tag does not exist',
    httpStatus: 404,
    retryable: false,
  },
  [ERROR_CODES.VALIDATION_FAILED]: {
    name: 'ValidationFailed',
    description: 'Input validation failed',
    httpStatus: 400,
    retryable: false,
  },
  [ERROR_CODES.CONFIG_INVALID]: {
    name: 'ConfigInvalid',
    description: 'Configuration is invalid or corrupt',
    httpStatus: 500,
    retryable: false,
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    name: 'ServiceUnavailable',
    description: 'The service is temporarily unavailable',
    httpStatus: 503,
    retryable: true,
  },
  [ERROR_CODES.TIMEOUT]: {
    name: 'Timeout',
    description: 'Operation timed out',
    httpStatus: 504,
    retryable: true,
  },
  [ERROR_CODES.PERMISSION_DENIED]: {
    name: 'PermissionDenied',
    description: 'Insufficient permissions',
    httpStatus: 403,
    retryable: false,
  },
  [ERROR_CODES.DATABASE_ERROR]: {
    name: 'DatabaseError',
    description: 'Database operation failed',
    httpStatus: 500,
    retryable: true,
  },
  [ERROR_CODES.ATTACHMENT_NOT_FOUND]: {
    name: 'AttachmentNotFound',
    description: 'The requested attachment does not exist',
    httpStatus: 404,
    retryable: false,
  },
  [ERROR_CODES.FILE_ERROR]: {
    name: 'FileError',
    description: 'File system operation failed',
    httpStatus: 500,
    retryable: true,
  },
  [ERROR_CODES.NETWORK_ERROR]: {
    name: 'NetworkError',
    description: 'Network operation failed',
    httpStatus: 503,
    retryable: true,
  },
  [ERROR_CODES.ALREADY_EXISTS]: {
    name: 'AlreadyExists',
    description: 'Resource already exists',
    httpStatus: 409,
    retryable: false,
  },
  [ERROR_CODES.RESOURCE_LOCKED]: {
    name: 'ResourceLocked',
    description: 'Resource is locked',
    httpStatus: 423,
    retryable: true,
  },
  [ERROR_CODES.OPERATION_CANCELLED]: {
    name: 'OperationCancelled',
    description: 'Operation was cancelled',
    httpStatus: 499,
    retryable: false,
  },
  [ERROR_CODES.NOT_IMPLEMENTED]: {
    name: 'NotImplemented',
    description: 'Feature not yet implemented',
    httpStatus: 501,
    retryable: false,
  },
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: {
    name: 'RateLimitExceeded',
    description: 'Too many requests',
    httpStatus: 429,
    retryable: true,
  },
  [ERROR_CODES.RESOURCE_LIMIT_EXCEEDED]: {
    name: 'ResourceLimitExceeded',
    description: 'Resource limit exceeded',
    httpStatus: 507,
    retryable: false,
  },
};

/**
 * Base Application Error
 * All custom application errors should extend this class
 */
class AppError extends Error {
  /**
   * Create an application error
   * @param {number} code - JSON-RPC error code
   * @param {string} message - Error message
   * @param {*} data - Optional additional error data
   */
  constructor(code, message, data = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.data = data;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Add metadata if available
    const metadata = ERROR_METADATA[code];
    if (metadata) {
      this.name = metadata.name;
      this.httpStatus = metadata.httpStatus;
      this.retryable = metadata.retryable;
    }
  }

  /**
   * Convert error to JSON-RPC error object
   * @returns {object} JSON-RPC error object
   */
  toJSON() {
    const error = {
      code: this.code,
      message: this.message,
    };

    if (this.data !== null && this.data !== undefined) {
      error.data = this.data;
    }

    return error;
  }

  /**
   * Convert error to JSON-RPC response
   * @param {string|number|null} id - Request ID
   * @returns {object} JSON-RPC error response
   */
  toResponse(id) {
    return {
      jsonrpc: '2.0',
      id,
      error: this.toJSON(),
    };
  }

  /**
   * Check if error is retryable
   * @returns {boolean}
   */
  isRetryable() {
    return this.retryable === true;
  }
}

/**
 * Validation Error
 */
class ValidationError extends AppError {
  constructor(message, data = null) {
    super(ERROR_CODES.VALIDATION_FAILED, message, data);
    this.name = 'ValidationError';
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends AppError {
  constructor(resource, identifier, data = null) {
    const code = ERROR_CODES[`${resource.toUpperCase()}_NOT_FOUND`] || ERROR_CODES.INTERNAL_ERROR;
    const message = identifier ? `${resource} not found: ${identifier}` : `${resource} not found`;
    super(code, message, data);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.identifier = identifier;
  }
}

/**
 * Permission Error
 */
class PermissionError extends AppError {
  constructor(message, data = null) {
    super(ERROR_CODES.PERMISSION_DENIED, message, data);
    this.name = 'PermissionError';
  }
}

/**
 * Timeout Error
 */
class TimeoutError extends AppError {
  constructor(message = 'Operation timed out', data = null) {
    super(ERROR_CODES.TIMEOUT, message, data);
    this.name = 'TimeoutError';
  }
}

/**
 * Service Unavailable Error
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', data = null) {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, message, data);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Database Error
 */
class DatabaseError extends AppError {
  constructor(message, data = null) {
    super(ERROR_CODES.DATABASE_ERROR, message, data);
    this.name = 'DatabaseError';
  }
}

/**
 * Config Error
 */
class ConfigError extends AppError {
  constructor(message, data = null) {
    super(ERROR_CODES.CONFIG_INVALID, message, data);
    this.name = 'ConfigError';
  }
}

/**
 * Get error metadata
 * @param {number} code - Error code
 * @returns {object|null} Error metadata
 */
function getErrorMetadata(code) {
  return ERROR_METADATA[code] || null;
}

/**
 * Check if error code is valid
 * @param {number} code - Error code
 * @returns {boolean}
 */
function isValidErrorCode(code) {
  return Object.values(ERROR_CODES).includes(code);
}

/**
 * Check if error code is retryable
 * @param {number} code - Error code
 * @returns {boolean}
 */
function isRetryableError(code) {
  const metadata = ERROR_METADATA[code];
  return metadata ? metadata.retryable : false;
}

/**
 * Get HTTP status code for error
 * @param {number} code - Error code
 * @returns {number} HTTP status code
 */
function getHttpStatus(code) {
  const metadata = ERROR_METADATA[code];
  return metadata ? metadata.httpStatus : 500;
}

/**
 * Map a generic error to an AppError
 * @param {Error} error - Generic error
 * @param {number} defaultCode - Default error code to use
 * @returns {AppError}
 */
function mapError(error, defaultCode = ERROR_CODES.INTERNAL_ERROR) {
  // If already an AppError, return as-is
  if (error instanceof AppError) {
    return error;
  }

  // If has a valid code property, use it
  if (error.code && isValidErrorCode(error.code)) {
    return new AppError(error.code, error.message, { originalError: error.message });
  }

  // Map based on error message patterns
  // Check most specific patterns first to avoid false matches
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('not found')) {
    if (msg.includes('note')) {
      return new NotFoundError('note', null, { originalError: error.message });
    }
    if (msg.includes('folder')) {
      return new NotFoundError('folder', null, { originalError: error.message });
    }
    if (msg.includes('tag')) {
      return new NotFoundError('tag', null, { originalError: error.message });
    }
    if (msg.includes('attachment')) {
      return new NotFoundError('attachment', null, { originalError: error.message });
    }
  }

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return new TimeoutError(error.message, { originalError: error.message });
  }

  if (msg.includes('permission') || msg.includes('denied') || msg.includes('unauthorized')) {
    return new PermissionError(error.message, { originalError: error.message });
  }

  if (msg.includes('config')) {
    return new ConfigError(error.message, { originalError: error.message });
  }

  if (msg.includes('database') || msg.includes('sqlite')) {
    return new DatabaseError(error.message, { originalError: error.message });
  }

  if (msg.includes('unavailable') || msg.includes('offline')) {
    return new ServiceUnavailableError(error.message, { originalError: error.message });
  }

  // Check validation last since "invalid" is very generic
  if (msg.includes('invalid') || msg.includes('validation')) {
    return new ValidationError(error.message, { originalError: error.message });
  }

  // Default to internal error
  return new AppError(defaultCode, error.message || 'Internal error', {
    originalError: error.message,
  });
}

module.exports = {
  ERROR_CODES,
  ERROR_METADATA,
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  TimeoutError,
  ServiceUnavailableError,
  DatabaseError,
  ConfigError,
  getErrorMetadata,
  isValidErrorCode,
  isRetryableError,
  getHttpStatus,
  mapError,
};
