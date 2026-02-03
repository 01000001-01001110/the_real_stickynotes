#!/usr/bin/env node
/**
 * StickyNotes CLI Entry Point
 *
 * Lightweight CLI client that connects to the StickyNotes background service
 * via named pipes. Uses JSON-RPC 2.0 protocol for fast communication.
 *
 * Size: <100KB (vs ~50MB when spawning Electron)
 */

const path = require('path');
const fs = require('fs');
const { PipeClient, PipeClientError, ERROR_CODES } = require('../lib/client');
const { mapCommand, validateMethodCall } = require('../lib/method-mapper');
const { parseArgs, formatResult } = require('../../electron/cli/parser');

// Package metadata - handle both dev and production (asar) environments
let VERSION = '0.0.0';
try {
  // Try development path first
  const packageJson = require('../../package.json');
  VERSION = packageJson.version;
} catch {
  try {
    // Production: package.json is inside asar, read from known location
    const asarPackageJson = path.join(__dirname, '..', '..', '..', 'app.asar', 'package.json');
    if (fs.existsSync(asarPackageJson)) {
      const packageJson = JSON.parse(fs.readFileSync(asarPackageJson, 'utf8'));
      VERSION = packageJson.version;
    }
  } catch {
    // Fallback - could not determine version
    VERSION = 'unknown';
  }
}

/**
 * Exit codes
 */
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  SERVICE_NOT_RUNNING: 2,
  TIMEOUT: 3,
  INVALID_ARGS: 4,
};

/**
 * Sleep helper
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the StickyNotes service
 * @returns {Promise<number>} Exit code
 */
async function startService() {
  // First check if already running
  try {
    const client = new PipeClient({ timeout: 1000, retries: 0 });
    await client.connect();
    await client.disconnect();
    console.log('StickyNotes is already running');
    return EXIT_CODES.SUCCESS;
  } catch (err) {
    // Not running, continue to start it
  }

  // Spawn the Electron app
  const { spawn } = require('child_process');

  // Try to find the StickyNotes executable
  let appExecutable = null;

  // Check if running as standalone CLI (pkg bundled)
  const isStandalone = typeof process.pkg !== 'undefined';

  if (isStandalone) {
    // Standalone mode - try to find installed StickyNotes
    if (process.platform === 'win32') {
      const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'StickyNotes', 'StickyNotes.exe'),
        path.join(process.env.PROGRAMFILES || '', 'StickyNotes', 'StickyNotes.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'StickyNotes', 'StickyNotes.exe'),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          appExecutable = p;
          break;
        }
      }
    } else if (process.platform === 'darwin') {
      const macPath = '/Applications/StickyNotes.app/Contents/MacOS/StickyNotes';
      if (fs.existsSync(macPath)) {
        appExecutable = macPath;
      }
    } else {
      // Linux - check common paths
      const linuxPaths = [
        '/usr/bin/stickynotes',
        '/usr/local/bin/stickynotes',
        path.join(process.env.HOME || '', '.local', 'bin', 'stickynotes'),
      ];
      for (const p of linuxPaths) {
        if (fs.existsSync(p)) {
          appExecutable = p;
          break;
        }
      }
    }

    if (!appExecutable) {
      console.error('Error: StickyNotes application not found.');
      console.error('Please install StickyNotes or launch it manually from the Start menu.');
      return EXIT_CODES.ERROR;
    }
  } else {
    // Development mode - use electron
    try {
      const electronPath = require('electron');
      const appPath = path.join(__dirname, '..', '..');
      appExecutable = electronPath;
      // For electron, we need to pass appPath as argument
      try {
        const child = spawn(appExecutable, [appPath, '--minimized'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
      } catch (spawnError) {
        console.error('Failed to start StickyNotes:', spawnError.message);
        return EXIT_CODES.ERROR;
      }

      // Wait for pipe (reuse existing logic below)
      console.log('Starting StickyNotes...');
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        try {
          const client = new PipeClient({ timeout: 1000, retries: 0 });
          await client.connect();
          await client.disconnect();
          console.log('StickyNotes started successfully');
          return EXIT_CODES.SUCCESS;
        } catch (err) {
          // Keep waiting
        }
      }
      console.error('Failed to start StickyNotes - timed out waiting for service to be ready');
      return EXIT_CODES.TIMEOUT;
    } catch (e) {
      console.error('Error: Cannot start StickyNotes in development mode.');
      console.error('Make sure electron is installed: npm install electron');
      return EXIT_CODES.ERROR;
    }
  }

  try {
    // Start the installed application
    const child = spawn(appExecutable, ['--minimized'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    // Wait for pipe to be available (up to 10 seconds)
    console.log('Starting StickyNotes...');
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const client = new PipeClient({ timeout: 1000, retries: 0 });
        await client.connect();
        await client.disconnect();
        console.log('StickyNotes started successfully');
        return EXIT_CODES.SUCCESS;
      } catch (err) {
        // Keep waiting
      }
    }

    console.error('Failed to start StickyNotes - timed out waiting for service to be ready');
    console.error('The application may still be starting. Try running a command in a few seconds.');
    return EXIT_CODES.TIMEOUT;
  } catch (error) {
    console.error('Failed to start StickyNotes:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    return EXIT_CODES.ERROR;
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    // Parse command line arguments
    const parsed = parseArgs(process.argv);

    // Handle local commands (don't require connection to service)
    if (await handleLocalCommands(parsed)) {
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Map CLI command to JSON-RPC method
    let mapping;
    try {
      mapping = mapCommand(parsed);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    // If it's a local command (like help/version), it's already handled
    if (mapping.isLocal) {
      process.exit(EXIT_CODES.SUCCESS);
    }

    // Map service:stop to app:quit (alias)
    if (mapping.method === 'service:stop') {
      mapping.method = 'app:quit';
    }

    // Validate method call
    try {
      validateMethodCall(mapping.method, mapping.params);
    } catch (error) {
      console.error(`Invalid command: ${error.message}`);
      process.exit(EXIT_CODES.INVALID_ARGS);
    }

    // Connect to service and execute command
    const result = await executeCommand(mapping.method, mapping.params, parsed.options);

    // Format and output result
    const output = formatResult(result, parsed.options);
    if (output) {
      console.log(output);
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    handleError(error);
  }
}

/**
 * Handle commands that don't require connection to service
 * @param {Object} parsed - Parsed CLI arguments
 * @returns {boolean} True if command was handled locally
 */
async function handleLocalCommands(parsed) {
  const { command, action, options } = parsed;

  // Version flag
  if (command === 'version' || command === '--version' || command === '-V' || options.version) {
    console.log(`StickyNotes v${VERSION}`);
    return true;
  }

  // Help flag
  if (command === 'help' || command === '--help' || command === '-h' || options.help || !command) {
    showHelp();
    return true;
  }

  // App start command - starts the service if not running
  if (command === 'app' && action === 'start') {
    const exitCode = await startService();
    process.exit(exitCode);
  }

  // Service stop command - alias for app:quit
  if (command === 'service' && action === 'stop') {
    // This will be handled by app:quit via normal command flow
    return false;
  }

  // Service restart command - stop then start
  if (command === 'service' && action === 'restart') {
    // First stop the service
    try {
      const client = new PipeClient({ timeout: 5000, retries: 1 });
      await client.connect();
      await client.request('app:quit', {});
      await client.disconnect();
      console.log('Stopping StickyNotes...');
    } catch (error) {
      // Service might not be running, that's OK
      if (
        error.code !== ERROR_CODES.SERVICE_NOT_RUNNING &&
        error.code !== ERROR_CODES.CONNECTION_REFUSED
      ) {
        console.error('Warning: Error stopping service:', error.message);
      }
    }

    // Wait for service to fully stop
    await sleep(1000);

    // Start the service
    console.log('Restarting StickyNotes...');
    const exitCode = await startService();
    process.exit(exitCode);
  }

  return false;
}

/**
 * Execute a JSON-RPC command via pipe client
 * @param {string} method - JSON-RPC method name
 * @param {Object} params - Method parameters
 * @param {Object} options - CLI options (for timeout override)
 * @returns {Promise<*>} Command result
 */
async function executeCommand(method, params, options = {}) {
  // Use timeout from options (already in milliseconds from parser)
  // Default to 5000ms if not specified
  const timeout = options.timeout || 5000;

  const client = new PipeClient({
    timeout,
    retries: 3,
    backoff: [500, 1000, 2000],
  });

  try {
    // Connect to service
    await client.connect();

    // Send request
    const result = await client.request(method, params);

    // Disconnect
    await client.disconnect();

    return result;
  } catch (error) {
    // Ensure cleanup
    await client.disconnect().catch(() => {});
    throw error;
  }
}

/**
 * Handle errors and exit with appropriate code
 * @param {Error} error - Error to handle
 */
function handleError(error) {
  if (error instanceof PipeClientError) {
    switch (error.code) {
      case ERROR_CODES.SERVICE_NOT_RUNNING:
        console.error(error.message);
        process.exit(EXIT_CODES.SERVICE_NOT_RUNNING);
        break;

      case ERROR_CODES.REQUEST_TIMEOUT:
      case ERROR_CODES.CONNECTION_TIMEOUT:
        console.error(`Error: ${error.message}`);
        process.exit(EXIT_CODES.TIMEOUT);
        break;

      case ERROR_CODES.CONNECTION_REFUSED:
        console.error('Error: Cannot connect to StickyNotes service');
        console.error('Make sure StickyNotes is running.');
        process.exit(EXIT_CODES.SERVICE_NOT_RUNNING);
        break;

      case ERROR_CODES.CONNECTION_LOST:
        console.error('Error: Connection to StickyNotes service was lost');
        process.exit(EXIT_CODES.ERROR);
        break;

      default:
        // JSON-RPC error codes (from server)
        if (typeof error.code === 'number') {
          console.error(`Error: ${error.message}`);
          if (error.details) {
            console.error('Details:', JSON.stringify(error.details, null, 2));
          }
        } else {
          console.error(`Error: ${error.message}`);
        }
        process.exit(EXIT_CODES.ERROR);
    }
  } else {
    // Unexpected error
    console.error('Unexpected error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(EXIT_CODES.ERROR);
  }
}

/**
 * Show CLI help
 */
function showHelp() {
  console.log(`
StickyNotes CLI v${VERSION}

Usage: stickynotes <command> <action> [arguments] [options]

Commands:
  note        Manage notes (list, create, update, delete, etc.)
  tag         Manage tags (list, add, remove, etc.)
  folder      Manage folders (list, create, update, delete)
  search      Search notes
  config      Manage configuration (get, set, list, edit)
  export      Export notes to various formats
  backup      Create and manage backups
  restore     Restore from backup
  app         Control the application (start, show, hide, quit, panel, settings)
  service     Service control (stop, restart)
  stats       Show statistics
  doctor      Run diagnostics
  db          Database operations
  paths       Show application paths

Examples:
  stickynotes app start                          Start StickyNotes service
  stickynotes app panel                          Open main panel
  stickynotes app settings                       Open settings window
  stickynotes service stop                       Stop StickyNotes service
  stickynotes service restart                    Restart StickyNotes service
  stickynotes note list
  stickynotes note create "My Note" "Note content"
  stickynotes note get <id>
  stickynotes tag list
  stickynotes search "search term"
  stickynotes config get general.theme
  stickynotes config edit                        Edit config.yaml in default editor
  stickynotes backup create

Options:
  --json              Output in JSON format
  --timeout <ms>      Request timeout in milliseconds (default: 5000)
  --help, -h          Show help
  --version, -V       Show version

Exit Codes:
  0  Success
  1  General error
  2  Service not running
  3  Request timeout
  4  Invalid arguments

For command-specific help:
  stickynotes <command> --help

Documentation: https://github.com/01000001-01001110/the_real_stickynotes#readme
  `);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(EXIT_CODES.ERROR);
});
