/**
 * IPC Handler Registration
 */
const { ipcMain, dialog, shell, app, BrowserWindow } = require('electron');
const notesHandlers = require('./notes');
const tagsHandlers = require('./tags');
const foldersHandlers = require('./folders');
const settingsHandlers = require('./settings');
const attachmentsHandlers = require('./attachments');
const windowsHandlers = require('./windows');
const storageHandlers = require('./storage');

/**
 * Setup all IPC handlers
 */
function setupIpcHandlers(windowManager) {
  // Notes handlers
  notesHandlers.register(windowManager);

  // Tags handlers
  tagsHandlers.register(windowManager);

  // Folders handlers
  foldersHandlers.register(windowManager);

  // Settings handlers
  settingsHandlers.register(windowManager);

  // Attachments handlers
  attachmentsHandlers.register(windowManager);

  // Windows handlers
  windowsHandlers.register(windowManager);

  // Storage location handlers
  storageHandlers.register(windowManager);

  // App handlers
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:checkUpdates', async () => {
    const { checkForUpdates } = require('../updater');
    return await checkForUpdates(true);
  });

  ipcMain.handle('app:quit', () => {
    global.isQuitting = true;
    app.quit();
  });

  ipcMain.handle('app:restart', () => {
    app.relaunch();
    global.isQuitting = true;
    app.quit();
  });

  ipcMain.handle('app:openExternal', (event, url) => {
    if (typeof url !== 'string') return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.warn('[Security] Blocked openExternal for non-http URL:', url);
        return;
      }
    } catch {
      console.warn('[Security] Blocked openExternal for invalid URL:', url);
      return;
    }
    return shell.openExternal(url);
  });

  // Dialog handlers
  ipcMain.handle('dialog:showOpen', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return dialog.showOpenDialog(window, options);
  });

  ipcMain.handle('dialog:showSave', async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return dialog.showSaveDialog(window, options);
  });

  // Window control handlers
  ipcMain.handle('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.handle('window:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.close();
  });

  ipcMain.handle('window:setAlwaysOnTop', (event, value) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.setAlwaysOnTop(value);
  });

  ipcMain.handle('window:setOpacity', (event, value) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      // Clamp opacity between 0.1 and 1.0
      const opacity = Math.max(0.1, Math.min(1.0, value));
      window.setOpacity(opacity);
    }
  });

  ipcMain.handle('window:getCurrentNoteId', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? window.noteId : null;
  });
}

module.exports = { setupIpcHandlers };
