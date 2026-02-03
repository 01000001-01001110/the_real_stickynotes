/**
 * CLI Argument Parser
 *
 * Parses process.argv into structured command objects.
 * Used by main.js to determine if running in CLI or GUI mode.
 */

/**
 * Check if running in CLI mode
 * @param {string[]} argv - process.argv
 * @returns {boolean}
 */
function isCliMode(argv) {
  // Skip node/electron and script path
  const args = argv.slice(2);

  // CLI mode if we have a command
  if (args.length === 0) return false;

  // Check for known commands
  const commands = [
    'note',
    'tag',
    'folder',
    'search',
    'config',
    'export',
    'backup',
    'restore',
    'app',
    'stats',
    'version',
    'doctor',
    'db',
    'paths',
    '--help',
    '-h',
    '--version',
    '-V',
  ];

  return commands.includes(args[0]);
}

/**
 * Parse CLI arguments into structured format
 * @param {string[]} argv - process.argv
 * @returns {Object} Parsed arguments
 */
function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.length === 0) {
    return { command: null, action: null, args: [], options: {} };
  }

  const result = {
    command: args[0],
    action: null,
    args: [],
    options: {
      json: false,
    },
  };

  // Parse remaining arguments
  let i = 1;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);

      // Check for boolean flags
      if (
        key === 'json' ||
        key === 'help' ||
        key === 'force' ||
        key === 'archived' ||
        key === 'trash' ||
        key === 'tree' ||
        key === 'with-counts' ||
        key === 'with-history' ||
        key === 'with-tags' ||
        key === 'open' ||
        key === 'transcribe' ||
        key === 'desc' ||
        key === 'all' ||
        key === 'dry-run' ||
        key === 'skip-settings' ||
        key === 'with-reminder' ||
        key === 'overdue'
      ) {
        result.options[camelCase(key)] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        // Option with value
        const value = args[i + 1];
        const camelKey = camelCase(key);

        // Special handling for timeout - convert to milliseconds
        if (key === 'timeout') {
          const timeoutValue = parseInt(value, 10);
          if (isNaN(timeoutValue) || timeoutValue <= 0) {
            throw new Error('--timeout must be a positive number (in milliseconds)');
          }
          result.options[camelKey] = timeoutValue;
        } else {
          result.options[camelKey] = value;
        }
        i++;
      } else {
        result.options[camelCase(key)] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short option
      const shortMap = {
        h: 'help',
        V: 'version',
        v: 'verbose',
      };
      const key = shortMap[arg[1]] || arg[1];
      result.options[key] = true;
    } else if (!result.action && !arg.startsWith('-')) {
      // First positional arg after command is the action
      result.action = arg;
    } else if (!arg.startsWith('-')) {
      // Additional positional arguments
      result.args.push(arg);
    }

    i++;
  }

  return result;
}

/**
 * Convert kebab-case to camelCase
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Format CLI result for output
 * @param {*} data - Result data
 * @param {Object} options - Output options
 * @returns {string}
 */
function formatResult(data, options = {}) {
  if (options.json) {
    return JSON.stringify(data, null, 2);
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => formatResult(item, options)).join('\n');
  }

  if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  return String(data);
}

module.exports = {
  isCliMode,
  parseArgs,
  formatResult,
  camelCase,
};
