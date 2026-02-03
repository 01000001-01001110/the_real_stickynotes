/**
 * Named Pipe IPC Server for StickyNotes
 *
 * Provides fast inter-process communication via named pipes (Windows) or Unix sockets (Unix)
 * Implements connection pooling, idle timeouts, and graceful shutdown
 */

const net = require('net');
const os = require('os');
const fs = require('fs');
const EventEmitter = require('events');
const {
  processRequests,
  serializeMessage,
  createNotification,
  ERROR_CODES,
  createError,
} = require('./pipe-protocol');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (isDev) console.log(...args);
};

// Configuration
const MAX_CONNECTIONS = 100;
const IDLE_TIMEOUT = 30000; // 30 seconds
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds to wait for in-flight requests
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB max buffer to prevent memory attacks
const BUFFER_TIMEOUT = 30000; // 30 seconds timeout for incomplete messages

/**
 * Get platform-specific pipe path with per-user isolation
 * @returns {string} Pipe path
 */
function getPipePath() {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows named pipe: \\.\pipe\stickynotes-{USERNAME}
    // Sanitize username for special characters (spaces, etc.)
    const username = os.userInfo().username.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `\\\\.\\pipe\\stickynotes-${username}`;
  } else {
    // Unix socket: /tmp/stickynotes-{UID}.sock
    const uid = os.userInfo().uid;
    return `/tmp/stickynotes-${uid}.sock`;
  }
}

/**
 * Clean up stale pipe/socket file (Unix only)
 * @param {string} pipePath - Path to the pipe/socket
 */
function cleanupStalePipe(pipePath) {
  const platform = os.platform();

  // Windows named pipes are automatically cleaned up by the OS
  if (platform === 'win32') {
    return;
  }

  // Unix: Remove stale socket file if it exists
  try {
    if (fs.existsSync(pipePath)) {
      // Try to connect to see if server is already running
      const testSocket = net.connect(pipePath, () => {
        // Connection succeeded - server is running
        testSocket.destroy();
        throw new Error(`Pipe server already running at ${pipePath}`);
      });

      testSocket.on('error', (err) => {
        // Connection failed - socket is stale
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
          try {
            fs.unlinkSync(pipePath);
            debugLog(`Cleaned up stale socket: ${pipePath}`);
          } catch (unlinkErr) {
            console.warn(`Failed to clean up stale socket: ${unlinkErr.message}`);
          }
        }
      });
    }
  } catch (err) {
    if (err.message.includes('already running')) {
      throw err;
    }
    console.warn(`Error during stale pipe cleanup: ${err.message}`);
  }
}

/**
 * Represents a single client connection to the pipe server
 */
class PipeConnection {
  /**
   * @param {net.Socket} socket - The underlying socket
   * @param {PipeServer} server - The parent server
   * @param {string} connectionId - Unique connection identifier
   */
  constructor(socket, server, connectionId) {
    this.socket = socket;
    this.server = server;
    this.connectionId = connectionId;
    this.buffer = '';
    this.idleTimer = null;
    this.bufferTimer = null; // Timer for incomplete message cleanup
    this.isClosed = false;
    this.createdAt = Date.now();
    this.activeRequests = 0;

    // Set up idle timeout
    this.resetIdleTimer();

    // Handle incoming data
    this.socket.on('data', (data) => this.handleData(data));

    // Handle socket errors
    this.socket.on('error', (err) => {
      if (!this.isClosed) {
        console.error(`Socket error [${this.connectionId}]:`, err.message);
        this.close();
      }
    });

    // Handle socket close
    this.socket.on('close', () => {
      if (!this.isClosed) {
        this.close();
      }
    });

    // Handle socket end
    this.socket.on('end', () => {
      if (!this.isClosed) {
        this.close();
      }
    });
  }

  /**
   * Reset the idle timeout timer
   */
  resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      debugLog(`Connection idle timeout [${this.connectionId}]`);
      this.close();
    }, IDLE_TIMEOUT);
  }

  /**
   * Reset the buffer cleanup timer
   * Called when data is received to track incomplete messages
   */
  resetBufferTimer() {
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
    }

    // If buffer has content, set a timeout to clear stale incomplete messages
    if (this.buffer.length > 0) {
      this.bufferTimer = setTimeout(() => {
        if (this.buffer.length > 0) {
          console.warn(
            `[${this.connectionId}] Clearing stale buffer (${this.buffer.length} bytes, truncated): ${this.buffer.substring(0, 100)}...`
          );
          this.buffer = '';
        }
      }, BUFFER_TIMEOUT);
    }
  }

  /**
   * Handle incoming data from the socket
   * @param {Buffer} data - Raw data buffer
   */
  async handleData(data) {
    // Reset idle timer on activity
    this.resetIdleTimer();

    // Append to buffer
    this.buffer += data.toString('utf8');

    // Check buffer size limit to prevent memory attacks
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      console.warn(
        `[${this.connectionId}] Buffer size limit exceeded (${this.buffer.length} bytes), clearing`
      );
      this.buffer = '';
      this.send(
        createError(ERROR_CODES.INVALID_REQUEST, 'Message too large', null, {
          maxSize: MAX_BUFFER_SIZE,
        })
      );
      return;
    }

    // Check for complete messages (separated by newlines)
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    // Reset buffer timer for incomplete message tracking
    this.resetBufferTimer();

    // Process complete lines
    if (lines.length > 0) {
      const completeData = lines.join('\n') + '\n';

      try {
        // Increment active request counter
        this.activeRequests++;
        this.server.incrementActiveRequests();

        const responses = await processRequests(completeData, this.server.methodRegistry);

        // Send all responses
        for (const response of responses) {
          this.send(response);
        }
      } catch (err) {
        console.error(`Error processing request [${this.connectionId}]:`, err);
        this.send(
          createError(ERROR_CODES.INTERNAL_ERROR, 'Failed to process request', null, {
            reason: err.message,
          })
        );
      } finally {
        // Decrement active request counter
        this.activeRequests--;
        this.server.decrementActiveRequests();
      }
    }
  }

  /**
   * Send a response to the client
   * @param {object} response - The response object to send
   */
  send(response) {
    if (this.isClosed || !this.socket.writable) {
      return;
    }

    try {
      const message = serializeMessage(response);
      this.socket.write(message, 'utf8');
    } catch (err) {
      console.error(`Error sending response [${this.connectionId}]:`, err);
      this.close();
    }
  }

  /**
   * Close the connection
   */
  close() {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Clear buffer timer
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }

    // Close socket
    try {
      this.socket.end();
      this.socket.destroy();
    } catch (err) {
      // Ignore errors during close
    }

    // Remove from server's connection pool
    this.server.removeConnection(this.connectionId);
  }

  /**
   * Check if connection has active requests
   * @returns {boolean} True if requests are being processed
   */
  hasActiveRequests() {
    return this.activeRequests > 0;
  }

  /**
   * Get connection info for debugging
   * @returns {object} Connection information
   */
  getInfo() {
    return {
      id: this.connectionId,
      age: Date.now() - this.createdAt,
      bufferSize: this.buffer.length,
      writable: this.socket.writable,
      closed: this.isClosed,
      activeRequests: this.activeRequests,
    };
  }
}

/**
 * Named Pipe IPC Server
 */
class PipeServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.connections = new Map();
    this.methodRegistry = {};
    this.pipePath = null;
    this.isRunning = false;
    this.connectionCounter = 0;
    this.activeRequestCount = 0;
    this.isShuttingDown = false;
  }

  /**
   * Increment the global active request counter
   */
  incrementActiveRequests() {
    this.activeRequestCount++;
  }

  /**
   * Decrement the global active request counter
   */
  decrementActiveRequests() {
    this.activeRequestCount--;
    if (this.activeRequestCount < 0) {
      this.activeRequestCount = 0;
    }
  }

  /**
   * Get the number of active requests across all connections
   * @returns {number} Number of active requests
   */
  getActiveRequestCount() {
    return this.activeRequestCount;
  }

  /**
   * Start the pipe server
   * @param {object} methodRegistry - Map of method names to handler functions
   * @param {string} customPipePath - Optional custom pipe path (for testing)
   * @returns {Promise<string>} The pipe path
   */
  async start(methodRegistry, customPipePath = null) {
    if (this.isRunning) {
      throw new Error('Pipe server is already running');
    }

    this.methodRegistry = methodRegistry || {};
    this.pipePath = customPipePath || getPipePath();

    // Clean up stale pipes (Unix only)
    try {
      cleanupStalePipe(this.pipePath);
    } catch (err) {
      throw new Error(`Failed to start pipe server: ${err.message}`);
    }

    // Create the server
    this.server = net.createServer((socket) => this.handleConnection(socket));

    // Handle server errors
    this.server.on('error', (err) => {
      console.error('Pipe server error:', err);
      this.emit('error', err);
    });

    // Start listening
    return new Promise((resolve, reject) => {
      this.server.listen(this.pipePath, () => {
        this.isRunning = true;
        debugLog(`Pipe server listening on: ${this.pipePath}`);
        this.emit('started', this.pipePath);
        resolve(this.pipePath);
      });

      this.server.on('error', (err) => {
        if (!this.isRunning) {
          reject(err);
        }
      });
    });
  }

  /**
   * Handle a new client connection
   * @param {net.Socket} socket - The client socket
   */
  handleConnection(socket) {
    // Reject connections during shutdown
    if (this.isShuttingDown) {
      console.warn('Rejecting connection - server is shutting down');
      const error = createError(ERROR_CODES.SERVICE_UNAVAILABLE, 'Server is shutting down', null);
      socket.write(serializeMessage(error));
      socket.end();
      return;
    }

    // Check connection limit
    if (this.connections.size >= MAX_CONNECTIONS) {
      console.warn(`Connection limit reached (${MAX_CONNECTIONS}), rejecting connection`);
      const error = createError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Server connection limit reached',
        null
      );
      socket.write(serializeMessage(error));
      socket.end();
      return;
    }

    // Create connection
    const connectionId = `conn-${++this.connectionCounter}`;
    const connection = new PipeConnection(socket, this, connectionId);
    this.connections.set(connectionId, connection);

    debugLog(
      `New connection [${connectionId}] (total: ${this.connections.size}/${MAX_CONNECTIONS})`
    );
    this.emit('connection', connection);
  }

  /**
   * Remove a connection from the pool
   * @param {string} connectionId - Connection identifier
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      debugLog(`Connection closed [${connectionId}] (total: ${this.connections.size})`);
      this.emit('disconnection', connectionId);
    }
  }

  /**
   * Broadcast a notification to all connected clients
   * @param {string} method - Notification method name
   * @param {*} params - Notification parameters
   */
  broadcast(method, params) {
    const notification = createNotification(method, params);

    for (const connection of this.connections.values()) {
      connection.send(notification);
    }
  }

  /**
   * Stop the pipe server gracefully
   * @param {number} timeout - Maximum time to wait for in-flight requests (default: 5000ms)
   * @returns {Promise<void>}
   */
  async stop(timeout = SHUTDOWN_TIMEOUT) {
    if (!this.isRunning) {
      return;
    }

    debugLog('[PipeServer] Starting graceful shutdown...');
    this.isShuttingDown = true;

    // Step 1: Stop accepting new connections
    if (this.server) {
      this.server.close();
      debugLog('[PipeServer] Stopped accepting new connections');
    }

    // Step 2: Wait for in-flight requests to complete
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (this.activeRequestCount > 0 && Date.now() - startTime < timeout) {
      debugLog(`[PipeServer] Waiting for ${this.activeRequestCount} in-flight request(s)...`);
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    if (this.activeRequestCount > 0) {
      console.warn(
        `[PipeServer] Shutdown timeout reached with ${this.activeRequestCount} requests still active`
      );
    } else {
      debugLog('[PipeServer] All in-flight requests completed');
    }

    // Step 3: Close all connections
    const closePromises = [];
    for (const connection of this.connections.values()) {
      closePromises.push(
        new Promise((resolve) => {
          connection.close();
          resolve();
        })
      );
    }

    await Promise.all(closePromises);
    this.connections.clear();
    debugLog('[PipeServer] All connections closed');

    // Step 4: Mark as stopped
    this.isRunning = false;
    this.server = null;
    debugLog('[PipeServer] Shutdown complete');
    this.emit('stopped');
  }

  /**
   * Get server status information
   * @returns {object} Server status
   */
  getStatus() {
    return {
      running: this.isRunning,
      shuttingDown: this.isShuttingDown,
      pipePath: this.pipePath,
      connections: this.connections.size,
      maxConnections: MAX_CONNECTIONS,
      activeRequests: this.activeRequestCount,
      idleTimeout: IDLE_TIMEOUT,
      connectionDetails: Array.from(this.connections.values()).map((conn) => conn.getInfo()),
    };
  }

  /**
   * Register a method handler
   * @param {string} method - Method name
   * @param {Function} handler - Handler function
   */
  registerMethod(method, handler) {
    this.methodRegistry[method] = handler;
  }

  /**
   * Unregister a method handler
   * @param {string} method - Method name
   */
  unregisterMethod(method) {
    delete this.methodRegistry[method];
  }

  /**
   * Check if server is running
   * @returns {boolean}
   */
  isActive() {
    return this.isRunning;
  }
}

// Singleton instance
let serverInstance = null;

/**
 * Get the singleton pipe server instance
 * @returns {PipeServer}
 */
function getInstance() {
  if (!serverInstance) {
    serverInstance = new PipeServer();
  }
  return serverInstance;
}

module.exports = {
  PipeServer,
  PipeConnection,
  getInstance,
  getPipePath,
  MAX_CONNECTIONS,
  IDLE_TIMEOUT,
  SHUTDOWN_TIMEOUT,
};
