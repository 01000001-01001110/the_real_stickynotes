/**
 * Folders IPC handlers
 */
const { ipcMain } = require('electron');
const {
  getFolders,
  getFolderTree,
  createFolder,
  updateFolder,
  deleteFolder,
  moveNoteToFolder,
} = require('../../shared/database/folders');

let windowManager = null;

function register(wm) {
  windowManager = wm;
  
  // Get all folders
  ipcMain.handle('folders:getAll', (event, options) => {
    return getFolders(options || {});
  });
  
  // Get folder tree
  ipcMain.handle('folders:getTree', () => {
    return getFolderTree();
  });
  
  // Create folder
  ipcMain.handle('folders:create', (event, data) => {
    return createFolder(data);
  });
  
  // Update folder
  ipcMain.handle('folders:update', (event, id, data) => {
    return updateFolder(id, data);
  });
  
  // Delete folder
  ipcMain.handle('folders:delete', (event, id, force) => {
    return deleteFolder(id, force);
  });
  
  // Move note to folder
  ipcMain.handle('folders:moveNote', (event, noteId, folderId) => {
    return moveNoteToFolder(noteId, folderId);
  });
}

module.exports = { register };
