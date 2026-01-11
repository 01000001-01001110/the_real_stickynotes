/**
 * Tags IPC handlers
 */
const { ipcMain } = require('electron');
const {
  getTags,
  getTagsForNote,
  getTagsForNotes,
  addTagToNote,
  removeTagFromNote,
  setNoteTags,
  deleteTagByName,
  renameTag,
} = require('../../shared/database/tags');

let windowManager = null;

function register(wm) {
  windowManager = wm;
  
  // Get all tags
  ipcMain.handle('tags:getAll', (event, options) => {
    return getTags(options || {});
  });
  
  // Get tags for a note
  ipcMain.handle('tags:getForNote', (event, noteId) => {
    return getTagsForNote(noteId);
  });
  
  // Get tags for multiple notes (batch operation)
  ipcMain.handle('tags:getForNotes', (event, noteIds) => {
    return getTagsForNotes(noteIds || []);
  });
  
  // Add tag to note
  ipcMain.handle('tags:addToNote', (event, noteId, tagName) => {
    return addTagToNote(noteId, tagName);
  });
  
  // Remove tag from note
  ipcMain.handle('tags:removeFromNote', (event, noteId, tagName) => {
    return removeTagFromNote(noteId, tagName);
  });
  
  // Set all tags for a note
  ipcMain.handle('tags:setForNote', (event, noteId, tagNames) => {
    setNoteTags(noteId, tagNames);
    return getTagsForNote(noteId);
  });
  
  // Delete a tag
  ipcMain.handle('tags:delete', (event, name) => {
    return deleteTagByName(name);
  });
  
  // Rename a tag
  ipcMain.handle('tags:rename', (event, oldName, newName) => {
    return renameTag(oldName, newName);
  });
}

module.exports = { register };
