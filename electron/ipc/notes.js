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
const {
  saveNoteVersion,
  getNoteHistory,
  revertToVersion,
} = require('../../shared/database/history');
const {
  updateNoteLinks,
  getOutgoingLinks,
  getBacklinks,
  renderLinks,
  createNoteFromLink,
} = require('../../shared/database/links');
const { searchNotes } = require('../../shared/database/search');
const { cleanupOrphanedTags } = require('../../shared/database/tags');
const { validateNote, isValidNoteId } = require('../../shared/utils/validators');

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
    // Validate input if provided
    const noteData = data || {};
    if (Object.keys(noteData).length > 0) {
      const validation = validateNote(noteData);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', '), note: null };
      }
    }

    try {
      const note = createNote(noteData);
      if (windowManager) {
        windowManager.broadcast('note:created', note);
      }
      return { success: true, note };
    } catch (err) {
      return { success: false, error: err.message, note: null };
    }
  });

  // Update note
  ipcMain.handle('notes:update', (event, id, data) => {
    // Validate note ID
    if (!id || !isValidNoteId(id)) {
      return { success: false, error: 'Valid note ID is required', note: null };
    }

    // Validate update data if provided
    if (data && Object.keys(data).length > 0) {
      const validation = validateNote(data);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', '), note: null };
      }
    }

    const oldNote = getNoteById(id);
    if (!oldNote) {
      return { success: false, error: 'Note not found', note: null };
    }

    try {
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
      return { success: true, note };
    } catch (err) {
      return { success: false, error: err.message, note: null };
    }
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
    if (success) {
      // Clean up orphaned tags after permanent deletion
      cleanupOrphanedTags();
      if (windowManager) {
        windowManager.broadcast('note:deleted', id);
      }
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
      // Return consistent response format
      return note ? { success: true, note } : { success: false, error: 'Note not found' };
    } catch (err) {
      console.error('Failed to lock note:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Unlock note (decrypts content)
  ipcMain.handle('notes:unlock', async (event, id, password) => {
    try {
      const note = await unlockNote(id, password);
      if (note && windowManager) {
        windowManager.broadcast('note:updated', note);
      }
      // Return consistent response format
      return note
        ? { success: true, note }
        : { success: false, error: 'Note not found or wrong password' };
    } catch (err) {
      console.error('Failed to unlock note:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Verify note password
  ipcMain.handle('notes:verifyPassword', (event, id, password) => {
    const note = getNoteById(id);
    // Distinguish between "no note", "no password", and "password match"
    if (!note) {
      return { exists: false, requiresPassword: false, valid: false };
    }
    if (!note.password_hash) {
      return { exists: true, requiresPassword: false, valid: true };
    }
    const valid = verifyPasswordSync(password, note.password_hash);
    return { exists: true, requiresPassword: true, valid };
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

  // Render [[wiki links]] in content to HTML anchors
  ipcMain.handle('links:render', (event, content) => {
    return renderLinks(content);
  });

  // Create a new note from an unresolved link
  ipcMain.handle('links:createFromLink', (event, title, sourceNoteId) => {
    const note = createNoteFromLink(title, sourceNoteId);
    if (note && windowManager) {
      windowManager.broadcast('note:created', note);
    }
    return note;
  });

  // Trash stats handler
  ipcMain.handle('notes:trashStats', () => {
    const trashedNotes = getNotes({ trashedOnly: true });
    return { count: trashedNotes.length };
  });

  // Purge trash handler - permanently delete all trashed notes
  ipcMain.handle('notes:purgeTrash', () => {
    const trashedNotes = getNotes({ trashedOnly: true });
    let deleted = 0;
    for (const note of trashedNotes) {
      permanentlyDeleteNote(note.id);
      deleted++;
    }

    // Clean up orphaned tags (tags with no associated active notes)
    const orphanedTagsDeleted = cleanupOrphanedTags();

    if (windowManager) {
      windowManager.broadcast('notes:trashPurged', { count: deleted, orphanedTagsDeleted });
    }
    return { success: true, count: deleted, orphanedTagsDeleted };
  });

  // Search handler
  ipcMain.handle('search:notes', (event, query, options) => {
    return searchNotes(query, options || {});
  });
}

module.exports = { register };
