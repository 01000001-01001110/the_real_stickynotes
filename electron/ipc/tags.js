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
  cleanupOrphanedTags,
} = require('../../shared/database/tags');
const { getNoteById } = require('../../shared/database/notes');

function register(_wm) {
  // windowManager stored in wm for future use (e.g., notifying windows when tags change)

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
    // Validate note exists before setting tags
    if (!noteId) {
      return { success: false, error: 'Note ID is required', tags: [] };
    }
    const note = getNoteById(noteId);
    if (!note) {
      return { success: false, error: 'Note not found', tags: [] };
    }
    const success = setNoteTags(noteId, tagNames);
    const tags = getTagsForNote(noteId);
    return { success, tags };
  });

  // Delete a tag
  ipcMain.handle('tags:delete', (event, name) => {
    return deleteTagByName(name);
  });

  // Rename a tag
  ipcMain.handle('tags:rename', (event, oldName, newName) => {
    return renameTag(oldName, newName);
  });

  // Clean up orphaned tags (tags with no associated active notes)
  ipcMain.handle('tags:cleanupOrphaned', () => {
    const deleted = cleanupOrphanedTags();
    return { success: true, deleted };
  });
}

module.exports = { register };
