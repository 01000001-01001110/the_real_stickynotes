/**
 * Streaming Response Helpers for Named Pipe IPC
 *
 * Implements JSON-RPC 2.0 progress notifications for long-running operations.
 * Progress notifications are sent as JSON-RPC notifications (no id) while
 * the final result is sent as a standard JSON-RPC response (with id).
 *
 * @see specs/unified-app-architecture-plan.md - Named Pipe IPC section
 */

/**
 * StreamingResponse - Handles progress notifications and final responses
 *
 * Usage:
 *   const stream = new StreamingResponse(socket, requestId);
 *   stream.sendProgress(50, 'Processing...');
 *   stream.sendResult({ data: 'final result' });
 */
class StreamingResponse {
  /**
   * Create a streaming response handler
   * @param {import('net').Socket} socket - Client socket connection
   * @param {string|number} requestId - JSON-RPC request ID
   */
  constructor(socket, requestId) {
    if (!socket || typeof socket.write !== 'function') {
      throw new Error('StreamingResponse requires a valid socket with write() method');
    }
    if (requestId === null || requestId === undefined) {
      throw new Error('StreamingResponse requires a valid requestId');
    }

    this.socket = socket;
    this.requestId = requestId;
    this.completed = false;
  }

  /**
   * Send a progress notification to the client
   *
   * Sends a JSON-RPC notification (no id field) with progress information.
   * Can be called multiple times before sending the final result.
   *
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Human-readable progress message
   * @param {string|null} [stage=null] - Current stage name (e.g., 'download', 'extract')
   * @param {object|null} [details=null] - Additional stage-specific details
   * @throws {Error} If response already completed
   */
  sendProgress(percent, message, stage = null, details = null) {
    if (this.completed) {
      throw new Error('Cannot send progress after response is completed');
    }

    // Validate percent
    if (typeof percent !== 'number' || isNaN(percent) || percent < 0 || percent > 100) {
      throw new Error('Progress percent must be a number between 0 and 100');
    }

    // Validate message
    if (typeof message !== 'string' || message.trim() === '') {
      throw new Error('Progress message must be a non-empty string');
    }

    const notification = {
      jsonrpc: '2.0',
      method: 'progress',
      params: {
        id: this.requestId,
        percent,
        message,
      },
    };

    // Add optional fields only if provided
    if (stage !== null && stage !== undefined) {
      notification.params.stage = stage;
    }
    if (details !== null && details !== undefined) {
      notification.params.details = details;
    }

    this._write(notification);
  }

  /**
   * Send the final result and mark response as completed
   *
   * Sends a JSON-RPC response with the request ID.
   * Can only be called once per StreamingResponse instance.
   *
   * @param {any} result - Result data (will be JSON serialized)
   * @throws {Error} If response already completed
   */
  sendResult(result) {
    if (this.completed) {
      throw new Error('Response already completed. Cannot send result twice.');
    }

    this.completed = true;

    const response = {
      jsonrpc: '2.0',
      id: this.requestId,
      result: result,
    };

    this._write(response);
  }

  /**
   * Send an error and mark response as completed
   *
   * Sends a JSON-RPC error response with the request ID.
   * Can only be called once per StreamingResponse instance.
   *
   * @param {number} code - Error code (use ERROR_CODES from specs)
   * @param {string} message - Error message
   * @param {any} [data] - Optional additional error data
   * @throws {Error} If response already completed
   */
  sendError(code, message, data = undefined) {
    if (this.completed) {
      throw new Error('Response already completed. Cannot send error twice.');
    }

    // Validate error code
    if (typeof code !== 'number') {
      throw new Error('Error code must be a number');
    }

    // Validate error message
    if (typeof message !== 'string' || message.trim() === '') {
      throw new Error('Error message must be a non-empty string');
    }

    this.completed = true;

    const response = {
      jsonrpc: '2.0',
      id: this.requestId,
      error: {
        code,
        message,
      },
    };

    // Add optional data field if provided
    if (data !== undefined) {
      response.error.data = data;
    }

    this._write(response);
  }

  /**
   * Write JSON-RPC message to socket
   * @private
   * @param {object} message - JSON-RPC message
   */
  _write(message) {
    try {
      const json = JSON.stringify(message);
      this.socket.write(json + '\n');
    } catch (error) {
      console.error('[StreamingResponse] Failed to write message:', error);
      // Don't throw - socket errors will be handled by connection manager
    }
  }

  /**
   * Check if response has been completed
   * @returns {boolean}
   */
  isCompleted() {
    return this.completed;
  }
}

/**
 * ProgressTracker - Multi-stage progress tracking with weighted stages
 *
 * Calculates overall progress based on multiple stages with different weights.
 * Each stage contributes to the total progress proportional to its weight.
 *
 * Usage:
 *   const tracker = new ProgressTracker([
 *     { name: 'download', weight: 60 },
 *     { name: 'extract', weight: 30 },
 *     { name: 'verify', weight: 10 }
 *   ]);
 *
 *   // Download at 50% complete
 *   tracker.update('download', 50); // Returns 30 (50% of 60)
 *
 *   // Download complete, extract at 0%
 *   tracker.update('extract', 0); // Returns 60 (100% of 60 + 0% of 30)
 *
 *   // Extract at 50% complete
 *   tracker.update('extract', 50); // Returns 75 (60 + 50% of 30)
 */
class ProgressTracker {
  /**
   * Create a progress tracker with weighted stages
   *
   * @param {Array<{name: string, weight: number}>} stages - Stage definitions
   * @throws {Error} If stages are invalid or weights don't sum to 100
   *
   * @example
   * const tracker = new ProgressTracker([
   *   { name: 'load', weight: 20 },
   *   { name: 'transcribe', weight: 80 }
   * ]);
   */
  constructor(stages) {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error('ProgressTracker requires a non-empty array of stages');
    }

    // Validate stages
    const seenNames = new Set();
    let totalWeight = 0;

    for (const stage of stages) {
      if (!stage || typeof stage !== 'object') {
        throw new Error('Each stage must be an object');
      }
      if (typeof stage.name !== 'string' || stage.name.trim() === '') {
        throw new Error('Each stage must have a non-empty name');
      }
      if (typeof stage.weight !== 'number' || stage.weight <= 0) {
        throw new Error('Each stage must have a positive weight');
      }
      if (seenNames.has(stage.name)) {
        throw new Error(`Duplicate stage name: ${stage.name}`);
      }

      seenNames.add(stage.name);
      totalWeight += stage.weight;
    }

    // Validate total weight (allow small floating point tolerance)
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Stage weights must sum to 100 (got ${totalWeight})`);
    }

    this.stages = stages;
    this.stageMap = new Map(stages.map((s, i) => [s.name, i]));
  }

  /**
   * Calculate overall progress based on stage progress
   *
   * Calculates progress by assuming all stages before the current one are complete (100%),
   * the current stage is at the given percent, and all stages after are not started (0%).
   *
   * @param {string} stageName - Name of the current stage
   * @param {number} percent - Progress within the current stage (0-100)
   * @returns {number} Overall progress (0-100)
   * @throws {Error} If stage name is invalid or percent is out of range
   *
   * @example
   * // With stages: download(60), extract(30), verify(10)
   * tracker.update('download', 50); // Returns 30 (50% of 60 weight)
   * tracker.update('extract', 0);   // Returns 60 (download complete, extract not started)
   * tracker.update('extract', 100); // Returns 90 (download + extract complete)
   * tracker.update('verify', 50);   // Returns 95 (download + extract + 50% of verify)
   */
  update(stageName, percent) {
    // Validate stageName
    const stageIndex = this.stageMap.get(stageName);
    if (stageIndex === undefined) {
      throw new Error(
        `Unknown stage: ${stageName}. Valid stages: ${this.stages.map((s) => s.name).join(', ')}`
      );
    }

    // Validate percent
    if (typeof percent !== 'number' || isNaN(percent) || percent < 0 || percent > 100) {
      throw new Error('Stage percent must be a number between 0 and 100');
    }

    // Calculate total progress
    // All stages before current stage = 100%
    const beforeWeight = this.stages.slice(0, stageIndex).reduce((sum, s) => sum + s.weight, 0);

    // Current stage = percent%
    const stageWeight = this.stages[stageIndex].weight;
    const currentProgress = (stageWeight * percent) / 100;

    // All stages after current stage = 0% (not included in calculation)

    return Math.round(beforeWeight + currentProgress);
  }

  /**
   * Get stage information
   * @param {string} stageName - Stage name
   * @returns {{name: string, weight: number, index: number}|null}
   */
  getStage(stageName) {
    const index = this.stageMap.get(stageName);
    if (index === undefined) return null;

    return {
      ...this.stages[index],
      index,
    };
  }

  /**
   * Get all stages
   * @returns {Array<{name: string, weight: number}>}
   */
  getStages() {
    return [...this.stages];
  }

  /**
   * Get total number of stages
   * @returns {number}
   */
  getStageCount() {
    return this.stages.length;
  }
}

/**
 * Standard JSON-RPC error codes
 *
 * Combines standard JSON-RPC 2.0 error codes with application-specific codes.
 * Use these constants in StreamingResponse.sendError() calls.
 *
 * @see https://www.jsonrpc.org/specification#error_object
 */
const ERROR_CODES = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // Application-specific errors (range: -32000 to -32099)
  NOTE_NOT_FOUND: -32001,
  FOLDER_NOT_FOUND: -32002,
  TAG_NOT_FOUND: -32003,
  VALIDATION_FAILED: -32004,
  CONFIG_INVALID: -32005,
  SERVICE_UNAVAILABLE: -32006,
  TIMEOUT: -32007,
  PERMISSION_DENIED: -32008,
  ALREADY_IN_PROGRESS: -32009,
  INSUFFICIENT_SPACE: -32010,
  DOWNLOAD_FAILED: -32011,
  EXTRACTION_FAILED: -32012,
  VERIFICATION_FAILED: -32013,
  BACKUP_FAILED: -32014,
  RESTORE_FAILED: -32015,
};

/**
 * Helper function to create a streaming response wrapper for existing handlers
 *
 * Wraps an existing IPC handler to use StreamingResponse for consistent error handling.
 * The handler receives a StreamingResponse instance and must call either sendResult() or sendError().
 *
 * @param {function(params, StreamingResponse): Promise<void>} handler - Async handler function
 * @returns {function(params, socket, requestId): Promise<void>} Wrapped handler
 *
 * @example
 * const handler = wrapStreamingHandler(async (params, stream) => {
 *   stream.sendProgress(50, 'Processing...');
 *   const result = await doWork(params);
 *   stream.sendResult(result);
 * });
 *
 * registry.register('method:name', handler, { streaming: true });
 */
function wrapStreamingHandler(handler) {
  return async (params, socket, requestId) => {
    const stream = new StreamingResponse(socket, requestId);

    try {
      await handler(params, stream);

      // Ensure handler sent a response
      if (!stream.isCompleted()) {
        stream.sendError(
          ERROR_CODES.INTERNAL_ERROR,
          'Handler did not send a response (developer error - handler must call sendResult or sendError)'
        );
      }
    } catch (error) {
      // Catch any unhandled errors and send error response
      if (!stream.isCompleted()) {
        console.error('[StreamingResponse] Unhandled error in handler:', error);
        stream.sendError(ERROR_CODES.INTERNAL_ERROR, error.message || 'Internal server error', {
          error: error.toString(),
        });
      }
    }
  };
}

module.exports = {
  StreamingResponse,
  ProgressTracker,
  ERROR_CODES,
  wrapStreamingHandler,
};
