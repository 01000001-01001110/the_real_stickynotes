/**
 * Attachments IPC handlers
 */
const { ipcMain } = require('electron');
const {
  getAttachmentsForNote,
  saveAttachment,
  deleteAttachment,
  getAttachmentPath,
} = require('../../shared/database/attachments');

let windowManager = null;

function register(wm) {
  windowManager = wm;
  
  // Get attachments for a note
  ipcMain.handle('attachments:getForNote', (event, noteId) => {
    return getAttachmentsForNote(noteId);
  });
  
  // Add attachment to note
  ipcMain.handle('attachments:add', (event, noteId, filePath) => {
    const path = require('path');
    const filename = path.basename(filePath);
    return saveAttachment(noteId, filePath, filename);
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
