/**
 * Windows IPC handlers
 */
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { setReminder, clearReminder, snoozeReminder } = require('../reminders');

let windowManager = null;

function register(wm) {
  windowManager = wm;

  // Open a note window
  ipcMain.handle('windows:openNote', (event, noteId) => {
    if (windowManager) {
      windowManager.openNote(noteId);
      return true;
    }
    return false;
  });

  // Close a note window
  ipcMain.handle('windows:closeNote', (event, noteId) => {
    if (windowManager) {
      windowManager.closeNote(noteId);
      return true;
    }
    return false;
  });

  // Show panel
  ipcMain.handle('windows:showPanel', () => {
    if (windowManager) {
      windowManager.showPanel();
      return true;
    }
    return false;
  });

  // Hide panel
  ipcMain.handle('windows:hidePanel', () => {
    if (windowManager) {
      windowManager.hidePanel();
      return true;
    }
    return false;
  });

  // Show all notes
  ipcMain.handle('windows:showAll', () => {
    if (windowManager) {
      windowManager.showAllNotes();
      return true;
    }
    return false;
  });

  // Hide all notes
  ipcMain.handle('windows:hideAll', () => {
    if (windowManager) {
      windowManager.hideAllNotes();
      return true;
    }
    return false;
  });

  // Open settings
  ipcMain.handle('windows:openSettings', () => {
    if (windowManager) {
      windowManager.openSettings();
      return true;
    }
    return false;
  });

  // Open image viewer
  ipcMain.handle('windows:openImageViewer', (event, imageData) => {
    if (windowManager) {
      windowManager.openImageViewer(imageData);
      return true;
    }
    return false;
  });

  // Get image data for viewer window
  ipcMain.handle('windows:getImageData', (event) => {
    if (windowManager) {
      const window = require('electron').BrowserWindow.fromWebContents(event.sender);
      if (window && window.viewerId) {
        return windowManager.getImageData(window.viewerId);
      }
    }
    return null;
  });

  // Save image from viewer
  ipcMain.handle('windows:saveImage', async (event, dataUrl) => {
    try {
      const window = require('electron').BrowserWindow.fromWebContents(event.sender);

      const result = await dialog.showSaveDialog(window, {
        title: 'Save Image',
        defaultPath: path.join(require('os').homedir(), 'image.png'),
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'JPEG Images', extensions: ['jpg', 'jpeg'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return false;
      }

      // Remove data URL prefix and convert to buffer
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      fs.writeFileSync(result.filePath, buffer);
      return true;
    } catch (error) {
      console.error('Failed to save image:', error);
      return false;
    }
  });

  // Reminder handlers
  ipcMain.handle('reminders:set', (event, noteId, datetime) => {
    return setReminder(noteId, datetime);
  });

  ipcMain.handle('reminders:clear', (event, noteId) => {
    return clearReminder(noteId);
  });

  ipcMain.handle('reminders:snooze', (event, noteId, minutes) => {
    return snoozeReminder(noteId, minutes);
  });
}

module.exports = { register };
