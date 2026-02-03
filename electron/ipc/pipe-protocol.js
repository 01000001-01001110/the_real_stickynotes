/**
 * JSON-RPC 2.0 Protocol Handler for Named Pipe IPC
 *
 * Implements JSON-RPC 2.0 specification over NDJSON (newline-delimited JSON)
 * Reference: https://www.jsonrpc.org/specification
 */

const { ERROR_CODES, mapError, AppError } = require('../../shared/config/error-codes');

/**
 * Parse NDJSON data into individual JSON-RPC messages
 * @param {string} data - Raw string data that may contain multiple lines
 * @returns {Array<object>} Array of parsed JSON-RPC messages
 */
function parseNDJSON(data) {
  const messages = [];
  const lines = data.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue; // Skip empty lines
    }

    try {
      const parsed = JSON.parse(trimmed);
      messages.push(parsed);
    } catch (err) {
      // Return parse error for this line
      messages.push({
        error: {
          code: ERROR_CODES.PARSE_ERROR,
          message: 'Parse error',
          data: { line: trimmed, reason: err.message },
        },
        jsonrpc: '2.0',
        id: null,
      });
    }
  }

  return messages;
}

/**
 * Validate a JSON-RPC 2.0 request
 * @param {object} request - The request object to validate
 * @returns {{valid: boolean, error?: object}} Validation result
 */
function validateRequest(request) {
  // Must be an object
  if (typeof request !== 'object' || request === null) {
    return {
      valid: false,
      error: createError(ERROR_CODES.INVALID_REQUEST, 'Request must be an object', null),
    };
  }

  // Must specify jsonrpc version
  if (request.jsonrpc !== '2.0') {
    return {
      valid: false,
      error: createError(
        ERROR_CODES.INVALID_REQUEST,
        'Invalid or missing jsonrpc version (must be "2.0")',
        request.id || null
      ),
    };
  }

  // Must have a method
  if (!request.method || typeof request.method !== 'string') {
    return {
      valid: false,
      error: createError(
        ERROR_CODES.INVALID_REQUEST,
        'Method must be a non-empty string',
        request.id || null
      ),
    };
  }

  // Params is optional, but if present must be object or array
  if (request.params !== undefined) {
    const paramsType = typeof request.params;
    if (paramsType !== 'object' || request.params === null) {
      return {
        valid: false,
        error: createError(
          ERROR_CODES.INVALID_REQUEST,
          'Params must be an object or array',
          request.id || null
        ),
      };
    }
  }

  return { valid: true };
}

/**
 * Create a JSON-RPC 2.0 error object
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {*} id - Request ID (null for parse errors)
 * @param {*} data - Optional additional error data
 * @returns {object} JSON-RPC error response
 */
function createError(code, message, id, data = undefined) {
  const error = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };

  if (data !== undefined) {
    error.error.data = data;
  }

  return error;
}

/**
 * Create a JSON-RPC 2.0 success response
 * @param {*} result - The result data
 * @param {*} id - Request ID
 * @returns {object} JSON-RPC success response
 */
function createResponse(result, id) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create a JSON-RPC 2.0 notification (no response expected)
 * @param {string} method - The notification method name
 * @param {*} params - The notification parameters
 * @returns {object} JSON-RPC notification
 */
function createNotification(method, params) {
  const notification = {
    jsonrpc: '2.0',
    method,
  };

  if (params !== undefined) {
    notification.params = params;
  }

  return notification;
}

/**
 * Serialize a JSON-RPC message to NDJSON format
 * @param {object} message - The message to serialize
 * @returns {string} NDJSON string (with trailing newline)
 */
function serializeMessage(message) {
  const json = JSON.stringify(message);
  const size = Buffer.byteLength(json, 'utf8');

  // Configuration for large response warnings
  const WARN_SIZE = 1000000; // 1MB
  const MAX_SIZE = 10000000; // 10MB

  // Warn about large responses
  if (size > WARN_SIZE) {
    const sizeMB = (size / 1000000).toFixed(2);
    const requestId = message.id;
    const method = message.result ? 'result' : message.error ? 'error' : 'notification';

    console.warn(`[Protocol] Large response: ${sizeMB}MB for ${method} (id: ${requestId})`);

    // Suggest optimizations for very large responses
    if (size > MAX_SIZE) {
      console.error(
        `[Protocol] Response size exceeds ${MAX_SIZE / 1000000}MB! ` +
          'Consider implementing pagination or streaming for this operation.'
      );
    }
  }

  return json + '\n';
}

/**
 * Handle a single JSON-RPC request
 * @param {object} request - The validated request object
 * @param {object} methodRegistry - Map of method names to handler functions
 * @returns {Promise<object>} Response object (or null for notifications)
 */
async function handleRequest(request, methodRegistry) {
  // Validate the request
  const validation = validateRequest(request);
  if (!validation.valid) {
    return validation.error;
  }

  const { method, params, id } = request;

  // Notifications (requests without id) don't get responses
  const isNotification = id === undefined;

  // Check if method exists
  const handler = methodRegistry[method];
  if (!handler) {
    if (isNotification) {
      // Silent failure for notifications
      return null;
    }
    return createError(ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`, id);
  }

  // Execute the handler
  try {
    const result = await handler(params || {});

    // Don't send response for notifications
    if (isNotification) {
      return null;
    }

    return createResponse(result, id);
  } catch (err) {
    // Don't send response for notifications
    if (isNotification) {
      console.error(`Notification handler error [${method}]:`, err);
      return null;
    }

    // Map error to standardized AppError
    const appError = err instanceof AppError ? err : mapError(err);

    // Include stack trace in development
    let errorData = appError.data;
    if (process.env.NODE_ENV === 'development' && err.stack) {
      errorData = errorData || {};
      errorData.stack = err.stack;
    }

    return createError(appError.code, appError.message, id, errorData);
  }
}

/**
 * Process a batch of JSON-RPC requests
 * @param {string} data - Raw NDJSON data
 * @param {object} methodRegistry - Map of method names to handler functions
 * @returns {Promise<Array<object>>} Array of response objects
 */
async function processRequests(data, methodRegistry) {
  const messages = parseNDJSON(data);
  const responses = [];

  for (const message of messages) {
    // Handle parse errors (already formatted as error responses)
    if (message.error && message.error.code === ERROR_CODES.PARSE_ERROR) {
      responses.push(message);
      continue;
    }

    const response = await handleRequest(message, methodRegistry);
    if (response !== null) {
      responses.push(response);
    }
  }

  return responses;
}

/**
 * Map application error to JSON-RPC error code
 * @deprecated Use mapError from error-codes.js instead
 * @param {Error} error - Application error
 * @returns {number} JSON-RPC error code
 */
function mapErrorCode(error) {
  if (!error) return ERROR_CODES.INTERNAL_ERROR;
  const appError = mapError(error);
  return appError.code;
}

module.exports = {
  ERROR_CODES,
  parseNDJSON,
  validateRequest,
  createError,
  createResponse,
  createNotification,
  serializeMessage,
  handleRequest,
  processRequests,
  mapErrorCode,
};
