/**
 * Pipe Client Library
 *
 * Lightweight client for connecting to the StickyNotes background service
 * via named pipes. Uses JSON-RPC 2.0 protocol with retry logic.
 */

const net = require('net');
const os = require('os');
const { EventEmitter } = require('events');

/**
 * Custom error class for pipe client errors
 */
class PipeClientError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PipeClientError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, PipeClientError);
  }
}

/**
 * Error codes for pipe client
 */
const ERROR_CODES = {
  SERVICE_NOT_RUNNING: 'SERVICE_NOT_RUNNING',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PROTOCOL_ERROR: 'PROTOCOL_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  CONNECTION_LOST: 'CONNECTION_LOST',
};

/**
 * Pipe Client for communicating with StickyNotes service
 */
class PipeClient extends EventEmitter {
  /**
   * Create a new pipe client
   * @param {Object} options - Configuration options
   * @param {number} options.timeout - Request timeout in milliseconds (default: 5000)
   * @param {number} options.retries - Number of connection retries (default: 3)
   * @param {number[]} options.backoff - Backoff delays between retries in ms (default: [500, 1000, 2000])
   * @param {number} options.connectTimeout - Connection timeout in ms (default: 3000)
   * @param {string} options.pipeName - Custom pipe name (default: auto-generated)
   */
  constructor(options = {}) {
    super();

    this.timeout = options.timeout || 5000;
    this.retries = options.retries || 3;
    this.backoff = options.backoff || [500, 1000, 2000];
    this.connectTimeout = options.connectTimeout || 3000;

    // Per-user pipe path for Windows (sanitize username for special characters)
    const username = os.userInfo().username.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.pipePath = options.pipeName || `\\\\.\\pipe\\stickynotes-${username}`;

    this.socket = null;
    this.connected = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
  }

  /**
   * Connect to the pipe server with retry logic
   * @returns {Promise<void>}
   * @throws {PipeClientError}
   */
  async connect() {
    if (this.connected) {
      return;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        await this._attemptConnection();
        this.connected = true;
        this.emit('connected');
        return;
      } catch (error) {
        lastError = error;

        // Don't retry if we've exhausted attempts
        if (attempt < this.retries) {
          const delay = this.backoff[Math.min(attempt, this.backoff.length - 1)];
          await this._sleep(delay);
        }
      }
    }

    // All retries failed
    const errorMessage = 'StickyNotes is not running. Start with: stickynotes app start';
    throw new PipeClientError(errorMessage, ERROR_CODES.SERVICE_NOT_RUNNING, {
      originalError: lastError?.message,
      attempts: this.retries + 1,
    });
  }

  /**
   * Attempt a single connection
   * @private
   * @returns {Promise<void>}
   */
  _attemptConnection() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.pipePath);

      const timeoutTimer = setTimeout(() => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      }, this.connectTimeout);

      socket.on('connect', () => {
        clearTimeout(timeoutTimer);
        this.socket = socket;
        this._setupSocketHandlers();
        resolve();
      });

      socket.on('error', (error) => {
        clearTimeout(timeoutTimer);

        // Common error codes
        if (error.code === 'ENOENT' || error.code === 'ECONNREFUSED') {
          reject(new Error('Service not running'));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Setup socket event handlers
   * @private
   */
  _setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.setEncoding('utf8');

    this.socket.on('data', (chunk) => {
      this._handleData(chunk);
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
      this._handleConnectionError(error);
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.emit('disconnected');

      // Reject all pending requests
      for (const [, request] of this.pendingRequests) {
        clearTimeout(request.timeoutTimer);
        request.reject(new PipeClientError('Connection closed', ERROR_CODES.CONNECTION_LOST));
      }
      this.pendingRequests.clear();
    });

    this.socket.on('end', () => {
      this.connected = false;
      this.emit('disconnected');
    });
  }

  /**
   * Handle incoming data from socket
   * @private
   * @param {string} chunk - Data chunk
   */
  _handleData(chunk) {
    this.buffer += chunk;

    // Process all complete lines (NDJSON - newline delimited JSON)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        this._handleResponse(response);
      } catch (error) {
        this.emit(
          'error',
          new PipeClientError('Invalid JSON response', ERROR_CODES.PROTOCOL_ERROR, {
            line,
            error: error.message,
          })
        );
      }
    }
  }

  /**
   * Handle a JSON-RPC response
   * @private
   * @param {Object} response - JSON-RPC response object
   */
  _handleResponse(response) {
    // Validate JSON-RPC format
    if (!response.jsonrpc || response.jsonrpc !== '2.0') {
      this.emit(
        'error',
        new PipeClientError('Invalid JSON-RPC version', ERROR_CODES.PROTOCOL_ERROR, { response })
      );
      return;
    }

    // Handle notifications (no id)
    if (response.id === undefined) {
      this.emit('notification', response);
      return;
    }

    // Handle responses to requests
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      // Unknown request ID - might be a late response (request timed out)
      console.warn(
        `[PipeClient] Late/unknown response for ID ${response.id} (request may have timed out)`
      );
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeoutTimer);
    this.pendingRequests.delete(response.id);

    // Check for errors
    if (response.error) {
      pending.reject(
        new PipeClientError(
          response.error.message || 'Request failed',
          response.error.code || -32603,
          response.error.data
        )
      );
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle connection errors
   * @private
   * @param {Error} error - Connection error
   */
  _handleConnectionError(error) {
    const code =
      error.code === 'ECONNRESET' || error.code === 'EPIPE'
        ? ERROR_CODES.CONNECTION_LOST
        : ERROR_CODES.NETWORK_ERROR;

    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeoutTimer);
      request.reject(
        new PipeClientError(`Network error: ${error.message}`, code, { originalError: error.code })
      );
    }
    this.pendingRequests.clear();
  }

  /**
   * Send a JSON-RPC request and wait for response
   * @param {string} method - JSON-RPC method name
   * @param {Object} params - Method parameters
   * @param {Object} options - Request options
   * @param {number} options.timeout - Override default timeout
   * @returns {Promise<*>} Response result
   * @throws {PipeClientError}
   */
  async request(method, params = {}, options = {}) {
    if (!this.connected || !this.socket) {
      throw new PipeClientError('Not connected to service', ERROR_CODES.SERVICE_NOT_RUNNING);
    }

    // Validate method
    if (typeof method !== 'string' || !method) {
      throw new PipeClientError('Method must be a non-empty string', ERROR_CODES.PROTOCOL_ERROR);
    }

    // Generate request ID (with overflow protection)
    if (this.requestId >= Number.MAX_SAFE_INTEGER - 1) {
      this.requestId = 0;
    }
    const id = ++this.requestId;
    const timeout = options.timeout || this.timeout;

    // Build JSON-RPC request
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    // Send request
    return new Promise((resolve, reject) => {
      // Setup timeout
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new PipeClientError(`Request timed out after ${timeout}ms`, ERROR_CODES.REQUEST_TIMEOUT, {
            method,
            timeout,
          })
        );
      }, timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeoutTimer,
        method,
        timestamp: Date.now(),
      });

      // Send request as NDJSON (newline-delimited JSON)
      try {
        this.socket.write(JSON.stringify(request) + '\n');
      } catch (error) {
        clearTimeout(timeoutTimer);
        this.pendingRequests.delete(id);
        reject(
          new PipeClientError(
            `Failed to send request: ${error.message}`,
            ERROR_CODES.NETWORK_ERROR,
            { originalError: error.message }
          )
        );
      }
    });
  }

  /**
   * Send a notification (no response expected)
   * @param {string} method - JSON-RPC method name
   * @param {Object} params - Method parameters
   */
  notify(method, params = {}) {
    if (!this.connected || !this.socket) {
      throw new PipeClientError('Not connected to service', ERROR_CODES.SERVICE_NOT_RUNNING);
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params: params || {},
    };

    try {
      this.socket.write(JSON.stringify(notification) + '\n');
    } catch (error) {
      throw new PipeClientError(
        `Failed to send notification: ${error.message}`,
        ERROR_CODES.NETWORK_ERROR,
        { originalError: error.message }
      );
    }
  }

  /**
   * Disconnect from the pipe server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.socket) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.connected) {
        try {
          if (this.socket) {
            this.socket.destroy();
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        this.socket = null;
        resolve();
        return;
      }

      let resolved = false;
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        try {
          if (this.socket && !this.socket.destroyed) {
            this.socket.destroy();
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        this.socket = null;
        this.connected = false;
        resolve();
      };

      this.socket.once('close', cleanup);
      this.socket.once('error', cleanup);

      try {
        this.socket.end();
      } catch (e) {
        // socket.end() failed, force cleanup
        cleanup();
        return;
      }

      // Force close after 1 second if graceful close doesn't complete
      setTimeout(cleanup, 1000);
    });
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.socket && !this.socket.destroyed;
  }

  /**
   * Sleep helper
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  PipeClient,
  PipeClientError,
  ERROR_CODES,
};
