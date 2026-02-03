/**
 * Folders IPC handlers
 */
const { ipcMain } = require('electron');
const {
  getFolders,
  getFolderTree,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  moveNoteToFolder,
} = require('../../shared/database/folders');

function register(_wm) {
  // windowManager stored in wm for future use (e.g., notifying windows when folders change)

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
    // Validate folder exists if folderId is provided (null is valid for "no folder")
    if (folderId !== null && folderId !== undefined) {
      const folder = getFolderById(folderId);
      if (!folder) {
        return { success: false, error: 'Folder not found' };
      }
    }
    const success = moveNoteToFolder(noteId, folderId);
    return { success };
  });
}

module.exports = { register };
