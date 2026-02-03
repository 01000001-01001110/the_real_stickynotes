/**
 * Named Pipe Server Integration Helper
 *
 * Provides lifecycle management for the pipe server:
 * - Initialization with stores
 * - Graceful shutdown with timeout
 * - Client notification broadcasting
 */

const { PipeServer } = require('./pipe-server');
const { createRegistry } = require('./pipe-methods');

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const debugLog = (...args) => {
  if (isDev) console.log(...args);
};

let pipeServer = null;

/**
 * Initialize and start the named pipe server
 * @param {Object} stores - Application stores (database, config, windowManager)
 * @param {Object} options - Optional configuration
 * @returns {Promise<PipeServer>} Started pipe server instance
 */
async function initPipeServer(stores, options = {}) {
  if (pipeServer) {
    console.warn('[PipeIntegration] Pipe server already initialized');
    return pipeServer;
  }

  try {
    // Create method registry with store bindings
    const registry = createRegistry(stores);

    // Create and start server
    // Note: PipeServer.start() accepts (methodRegistry, customPipePath)
    pipeServer = new PipeServer();
    await pipeServer.start(registry, options.pipePath || null);

    debugLog('[PipeIntegration] Pipe server started successfully');
    return pipeServer;
  } catch (error) {
    console.error('[PipeIntegration] Failed to start pipe server:', error);
    pipeServer = null;
    throw error;
  }
}

/**
 * Gracefully shutdown the pipe server
 * Waits for in-flight requests to complete
 * @param {number} timeout - Maximum wait time in milliseconds (default: 5000)
 * @returns {Promise<void>}
 */
async function shutdownPipeServer(timeout = 5000) {
  if (!pipeServer) {
    return;
  }

  try {
    debugLog('[PipeIntegration] Shutting down pipe server...');
    await pipeServer.stop(timeout);
    pipeServer = null;
    debugLog('[PipeIntegration] Pipe server stopped successfully');
  } catch (error) {
    console.error('[PipeIntegration] Error during pipe server shutdown:', error);
    pipeServer = null;
  }
}

/**
 * Broadcast notification to all connected clients
 * Used for real-time updates (note changes, config changes, etc.)
 * @param {string} event - Event name (method in JSON-RPC terms)
 * @param {any} data - Event data (params in JSON-RPC terms)
 */
function notifyClients(event, data) {
  if (pipeServer) {
    try {
      pipeServer.broadcast(event, data);
    } catch (error) {
      console.error('[PipeIntegration] Failed to broadcast notification:', error);
    }
  }
}

/**
 * Get current pipe server status
 * @returns {Object} Status information
 */
function getPipeServerStatus() {
  if (!pipeServer) {
    return {
      running: false,
      connections: 0,
      uptime: 0,
    };
  }

  return {
    running: true,
    connections: pipeServer.getConnectionCount ? pipeServer.getConnectionCount() : 0,
    uptime: pipeServer.getUptime ? pipeServer.getUptime() : 0,
  };
}

module.exports = {
  initPipeServer,
  shutdownPipeServer,
  notifyClients,
  getPipeServerStatus,
};
