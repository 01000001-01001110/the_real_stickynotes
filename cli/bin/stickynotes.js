#!/usr/bin/env node
/**
 * StickyNotes CLI Entry Point
 *
 * Simple launcher that invokes Electron with CLI arguments.
 * All command handling is done in electron/main.js
 */
const { spawn } = require('child_process');
const path = require('path');

// Get the electron executable
const electronPath = require('electron');

// Path to the app (parent of cli directory)
const appPath = path.join(__dirname, '..', '..');

// Pass all CLI arguments to Electron
const args = [appPath, ...process.argv.slice(2)];

// Spawn Electron with inherited stdio for proper output
const child = spawn(electronPath, args, {
  stdio: 'inherit',
  windowsHide: true,
});

// Exit with Electron's exit code
child.on('close', (code) => {
  process.exit(code || 0);
});

// Handle errors
child.on('error', (err) => {
  console.error('Failed to start StickyNotes:', err.message);
  process.exit(1);
});
