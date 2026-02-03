/**
 * Attachments IPC handlers
 */
const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  getAttachmentsForNote,
  saveAttachment,
  deleteAttachment,
  getAttachmentPath,
} = require('../../shared/database/attachments');

function register(_wm) {
  // windowManager stored in wm for future use (e.g., notifying windows when attachments change)

  // Get attachments for a note
  ipcMain.handle('attachments:getForNote', (event, noteId) => {
    return getAttachmentsForNote(noteId);
  });

  // Add attachment to note
  ipcMain.handle('attachments:add', (event, noteId, filePath) => {
    // Validate noteId
    if (!noteId || typeof noteId !== 'string') {
      return { success: false, error: 'Valid note ID is required' };
    }

    // Validate filePath
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Valid file path is required' };
    }

    // Normalize and validate path
    const normalizedPath = path.normalize(filePath);

    // Check for path traversal attempts
    if (normalizedPath.includes('..') || normalizedPath !== filePath.replace(/\//g, path.sep)) {
      // Allow normalized path if it's just slash normalization
      const isJustSlashNormalization = path.resolve(filePath) === path.resolve(normalizedPath);
      if (!isJustSlashNormalization && normalizedPath.includes('..')) {
        return { success: false, error: 'Invalid file path' };
      }
    }

    // Check file exists and is accessible
    try {
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Path must be a file, not a directory' };
      }
    } catch (err) {
      return { success: false, error: `File not accessible: ${err.message}` };
    }

    const filename = path.basename(filePath);
    try {
      const attachment = saveAttachment(noteId, filePath, filename);
      return { success: true, attachment };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Delete attachment
  ipcMain.handle('attachments:delete', (event, id) => {
    return deleteAttachment(id);
  });

  // Get attachment file path
  ipcMain.handle('attachments:getPath', (event, id) => {
    return getAttachmentPath(id);
  });
}

module.exports = { register };
