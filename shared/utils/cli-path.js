/**
 * CLI PATH Management
 *
 * Utilities for adding/removing the CLI from system PATH on Windows
 */

const { app } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Get the CLI bin directory path
 * @returns {string} Full path to CLI bin directory
 */
function getCLIPath() {
  if (app.isPackaged) {
    // Production: inside asar.unpacked
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'cli', 'bin');
  } else {
    // Development
    return path.join(app.getAppPath(), 'cli', 'bin');
  }
}

/**
 * Add CLI to user PATH (Windows only)
 * @returns {Promise<boolean>} Success status
 */
async function addToPath() {
  if (process.platform !== 'win32') {
    console.warn('[CLI-PATH] Only supported on Windows');
    return false;
  }

  const cliPath = getCLIPath();

  try {
    // Get current user PATH
    const { stdout } = await execAsync(
      "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
    );
    const currentPath = stdout.trim();

    // Check if already in PATH
    if (currentPath.includes(cliPath)) {
      console.log('[CLI-PATH] Already in PATH:', cliPath);
      return true;
    }

    // Add to PATH
    const newPath = currentPath ? `${currentPath};${cliPath}` : cliPath;
    await execAsync(
      `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(/'/g, "''")}', 'User')"`
    );

    // Broadcast environment change
    await execAsync(
      'powershell -Command "Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult); }\'; $HWND_BROADCAST = [IntPtr]0xffff; $WM_SETTINGCHANGE = 0x1a; $result = [UIntPtr]::Zero; [Win32]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, \'Environment\', 2, 5000, [ref]$result)"'
    );

    console.log('[CLI-PATH] Added to PATH:', cliPath);
    return true;
  } catch (error) {
    console.error('[CLI-PATH] Failed to add to PATH:', error.message);
    return false;
  }
}

/**
 * Remove CLI from user PATH (Windows only)
 * @returns {Promise<boolean>} Success status
 */
async function removeFromPath() {
  if (process.platform !== 'win32') {
    console.warn('[CLI-PATH] Only supported on Windows');
    return false;
  }

  const cliPath = getCLIPath();

  try {
    // Get current user PATH
    const { stdout } = await execAsync(
      "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
    );
    const currentPath = stdout.trim();

    // Check if not in PATH
    if (!currentPath.includes(cliPath)) {
      console.log('[CLI-PATH] Not in PATH, nothing to remove');
      return true;
    }

    // Remove from PATH (handle different separator positions)
    let newPath = currentPath
      .replace(`;${cliPath}`, '')
      .replace(`${cliPath};`, '')
      .replace(cliPath, '');

    // Clean up double semicolons
    newPath = newPath.replace(/;;+/g, ';');

    // Remove leading/trailing semicolons
    newPath = newPath.replace(/^;|;$/g, '');

    await execAsync(
      `powershell -Command "[Environment]::SetEnvironmentVariable('Path', '${newPath.replace(/'/g, "''")}', 'User')"`
    );

    // Broadcast environment change
    await execAsync(
      'powershell -Command "Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\"user32.dll\\", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult); }\'; $HWND_BROADCAST = [IntPtr]0xffff; $WM_SETTINGCHANGE = 0x1a; $result = [UIntPtr]::Zero; [Win32]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, \'Environment\', 2, 5000, [ref]$result)"'
    );

    console.log('[CLI-PATH] Removed from PATH:', cliPath);
    return true;
  } catch (error) {
    console.error('[CLI-PATH] Failed to remove from PATH:', error.message);
    return false;
  }
}

/**
 * Check if CLI is in user PATH (Windows only)
 * @returns {Promise<boolean>} True if in PATH
 */
async function isInPath() {
  if (process.platform !== 'win32') {
    return false;
  }

  const cliPath = getCLIPath();

  try {
    const { stdout } = await execAsync(
      "powershell -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\""
    );
    return stdout.trim().includes(cliPath);
  } catch (error) {
    console.error('[CLI-PATH] Failed to check PATH:', error.message);
    return false;
  }
}

module.exports = {
  getCLIPath,
  addToPath,
  removeFromPath,
  isInPath,
};
