/**
 * Notes IPC handlers
 */
const { ipcMain } = require('electron');
const {
  createNote,
  getNoteById,
  getNotes,
  updateNote,
  deleteNote,
  permanentlyDeleteNote,
  restoreNote,
  archiveNote,
  unarchiveNote,
  duplicateNote,
  lockNote,
  unlockNote,
} = require('../../shared/database/notes');
const { verifyPasswordSync } = require('../../shared/crypto');
const { saveNoteVersion, getNoteHistory, revertToVersion } = require('../../shared/database/history');
const { updateNoteLinks, getOutgoingLinks, getBacklinks } = require('../../shared/database/links');
const { searchNotes } = require('../../shared/database/search');

let windowManager = null;

function register(wm) {
  windowManager = wm;
  
  // Get all notes
  ipcMain.handle('notes:getAll', (event, options) => {
    return getNotes(options || {});
  });
  
  // Get single note
  ipcMain.handle('notes:get', (event, id) => {
    return getNoteById(id);
  });
  
  // Create note
  ipcMain.handle('notes:create', (event, data) => {
    const note = createNote(data || {});
    if (windowManager) {
      windowManager.broadcast('note:created', note);
    }
    return note;
  });
  
  // Update note
  ipcMain.handle('notes:update', (event, id, data) => {
    const oldNote = getNoteById(id);
    const note = updateNote(id, data);
    
    if (note) {
      // Save to history if content changed
      if (oldNote && data.content !== undefined && oldNote.content !== data.content) {
        saveNoteVersion(id, oldNote.title, oldNote.content);
      }
      
      // Update links if content changed
      if (data.content !== undefined) {
        updateNoteLinks(id, data.content);
      }
      
      if (windowManager) {
        windowManager.broadcast('note:updated', note);
      }
    }
    return note;
  });
  
  // Delete note (soft delete)
  ipcMain.handle('notes:delete', (event, id) => {
    const success = deleteNote(id);
    if (success && windowManager) {
      windowManager.broadcast('note:deleted', id);
    }
    return success;
  });
  
  // Permanently delete note
  ipcMain.handle('notes:permanentDelete', (event, id) => {
    const success = permanentlyDeleteNote(id);
    if (success && windowManager) {
      windowManager.broadcast('note:deleted', id);
    }
    return success;
  });
  
  // Restore note from trash
  ipcMain.handle('notes:restore', (event, id) => {
    const note = restoreNote(id);
    if (note && windowManager) {
      windowManager.broadcast('note:created', note);
    }
    return note;
  });
  
  // Archive note
  ipcMain.handle('notes:archive', (event, id) => {
    const note = archiveNote(id);
    if (note && windowManager) {
      windowManager.broadcast('note:updated', note);
    }
    return note;
  });
  
  // Unarchive note
  ipcMain.handle('notes:unarchive', (event, id) => {
    const note = unarchiveNote(id);
    if (note && windowManager) {
      windowManager.broadcast('note:updated', note);
    }
    return note;
  });
  
  // Duplicate note
  ipcMain.handle('notes:duplicate', (event, id) => {
    const note = duplicateNote(id);
    if (note && windowManager) {
      windowManager.broadcast('note:created', note);
    }
    return note;
  });
  
  // Lock note with password (encrypts content with AES-256-GCM)
  ipcMain.handle('notes:lock', async (event, id, password) => {
    try {
      const note = await lockNote(id, password);
      if (note && windowManager) {
        windowManager.broadcast('note:updated', note);
      }
      return note;
    } catch (err) {
      console.error('Failed to lock note:', err.message);
      return null;
    }
  });
  
  // Unlock note (decrypts content)
  ipcMain.handle('notes:unlock', async (event, id, password) => {
    try {
      const note = await unlockNote(id, password);
      if (note && windowManager) {
        windowManager.broadcast('note:updated', note);
      }
      return note;
    } catch (err) {
      console.error('Failed to unlock note:', err.message);
      return null;
    }
  });
  
  // Verify note password
  ipcMain.handle('notes:verifyPassword', (event, id, password) => {
    const note = getNoteById(id);
    if (!note || !note.password_hash) return true;
    return verifyPasswordSync(password, note.password_hash);
  });
  
  // History handlers
  ipcMain.handle('history:get', (event, noteId) => {
    return getNoteHistory(noteId);
  });
  
  ipcMain.handle('history:revert', (event, noteId, historyId) => {
    const entry = revertToVersion(noteId, historyId);
    if (entry) {
      const note = getNoteById(noteId);
      if (windowManager) {
        windowManager.broadcast('note:updated', note);
      }
    }
    return entry;
  });
  
  // Link handlers
  ipcMain.handle('links:getOutgoing', (event, noteId) => {
    return getOutgoingLinks(noteId);
  });
  
  ipcMain.handle('links:getBacklinks', (event, noteId) => {
    return getBacklinks(noteId);
  });
  
  // Search handler
  ipcMain.handle('search:notes', (event, query, options) => {
    return searchNotes(query, options || {});
  });
}

module.exports = { register };
