/**
 * Structured Logger
 *
 * Provides consistent logging with levels, timestamps, and component names.
 * Designed for easy debugging and monitoring of the application.
 *
 * Usage:
 *   const logger = require('../shared/logging/logger').create('ComponentName');
 *   logger.info('Message');
 *   logger.error('Error occurred', error);
 *
 * Log Levels (in order of severity):
 *   debug < info < warn < error
 *
 * Environment Variables:
 *   LOG_LEVEL - Set minimum log level (default: 'info')
 *   LOG_JSON  - Output JSON format (default: false)
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default minimum level (can be overridden via environment variable)
let minLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;
let useJson = process.env.LOG_JSON === 'true';

/**
 * Format timestamp in ISO format
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Format error for logging
 * @param {Error} error - Error object
 * @returns {object} Formatted error info
 */
function formatError(error) {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.code && { code: error.code }),
    };
  }
  return { message: String(error) };
}

/**
 * Create a logger instance for a specific component
 * @param {string} component - Component name (e.g., 'SherpaService', 'PipeServer')
 * @returns {object} Logger instance with debug, info, warn, error methods
 */
function create(component) {
  const componentName = component || 'App';

  /**
   * Log a message at the specified level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {any} data - Optional additional data
   */
  function log(level, message, data = null) {
    const levelNum = LOG_LEVELS[level];

    // Skip if below minimum level
    if (levelNum < minLevel) {
      return;
    }

    const timestamp = getTimestamp();
    const levelUpper = level.toUpperCase();

    if (useJson) {
      // JSON format for structured log aggregation
      const logEntry = {
        timestamp,
        level: levelUpper,
        component: componentName,
        message,
        ...(data && { data }),
      };
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        JSON.stringify(logEntry)
      );
    } else {
      // Human-readable format
      const prefix = `[${timestamp}] [${levelUpper}] [${componentName}]`;

      if (data) {
        if (data instanceof Error) {
          console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
            `${prefix} ${message}`,
            formatError(data)
          );
        } else {
          console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
            `${prefix} ${message}`,
            data
          );
        }
      } else {
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
          `${prefix} ${message}`
        );
      }
    }
  }

  return {
    /**
     * Log a debug message (development only)
     * @param {string} message - Debug message
     * @param {any} data - Optional data
     */
    debug(message, data) {
      log('debug', message, data);
    },

    /**
     * Log an info message
     * @param {string} message - Info message
     * @param {any} data - Optional data
     */
    info(message, data) {
      log('info', message, data);
    },

    /**
     * Log a warning message
     * @param {string} message - Warning message
     * @param {any} data - Optional data
     */
    warn(message, data) {
      log('warn', message, data);
    },

    /**
     * Log an error message
     * @param {string} message - Error message
     * @param {Error|any} error - Error object or data
     */
    error(message, error) {
      log('error', message, error);
    },

    /**
     * Create a child logger with additional context
     * @param {string} subComponent - Sub-component name
     * @returns {object} Child logger instance
     */
    child(subComponent) {
      return create(`${componentName}:${subComponent}`);
    },
  };
}

/**
 * Set the minimum log level globally
 * @param {string} level - Level name ('debug', 'info', 'warn', 'error')
 */
function setLevel(level) {
  const levelLower = level.toLowerCase();
  if (LOG_LEVELS[levelLower] !== undefined) {
    minLevel = LOG_LEVELS[levelLower];
  }
}

/**
 * Enable or disable JSON output format
 * @param {boolean} enabled - Whether to use JSON format
 */
function setJsonFormat(enabled) {
  useJson = enabled;
}

/**
 * Get the current log level
 * @returns {string} Current log level name
 */
function getLevel() {
  return Object.keys(LOG_LEVELS).find((key) => LOG_LEVELS[key] === minLevel) || 'info';
}

module.exports = {
  create,
  setLevel,
  setJsonFormat,
  getLevel,
  LOG_LEVELS,
};
