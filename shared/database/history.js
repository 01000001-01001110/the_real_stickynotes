/**
 * Note history operations
 */
const { getDatabase, withTransaction } = require('./index');
const { getSetting } = require('./settings');

/**
 * Save a version of a note to history
 * @param {string} noteId - Note ID
 * @param {string} title - Note title
 * @param {string} content - Note content
 * @returns {object} Created history entry
 */
function saveNoteVersion(noteId, title, content) {
  return withTransaction(() => {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO note_history (note_id, title, content, saved_at)
      VALUES (?, ?, ?, ?)
    `).run(noteId, title, content, now);
    
    // Prune old versions within same transaction
    pruneNoteHistoryInternal(db, noteId);
    
    return {
      id: result.lastInsertRowid,
      note_id: noteId,
      title,
      content,
      saved_at: now,
    };
  });
}

/**
 * Get history for a note
 * @param {string} noteId - Note ID
 * @param {number} limit - Max versions to return
 * @returns {object[]} Array of history entries
 */
function getNoteHistory(noteId, limit = 10) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM note_history
    WHERE note_id = ?
    ORDER BY saved_at DESC
    LIMIT ?
  `).all(noteId, limit);
}

/**
 * Get a specific history entry
 * @param {number} historyId - History entry ID
 * @returns {object|null} History entry or null
 */
function getHistoryEntry(historyId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM note_history WHERE id = ?').get(historyId) || null;
}

/**
 * Internal prune function that accepts db instance (for use in transactions)
 * @param {object} db - Database instance
 * @param {string} noteId - Note ID
 */
function pruneNoteHistoryInternal(db, noteId) {
  const maxVersions = getSetting('history.maxVersions') || 10;
  
  // Get IDs of entries to keep
  const toKeep = db.prepare(`
    SELECT id FROM note_history
    WHERE note_id = ?
    ORDER BY saved_at DESC
    LIMIT ?
  `).all(noteId, maxVersions).map(r => r.id);
  
  if (toKeep.length === 0) return;
  
  // Delete entries not in the keep list
  const placeholders = toKeep.map(() => '?').join(',');
  db.prepare(`
    DELETE FROM note_history
    WHERE note_id = ? AND id NOT IN (${placeholders})
  `).run(noteId, ...toKeep);
}

/**
 * Prune old history entries, keeping only the max allowed
 * @param {string} noteId - Note ID
 */
function pruneNoteHistory(noteId) {
  const db = getDatabase();
  pruneNoteHistoryInternal(db, noteId);
}

/**
 * Delete all history for a note
 * @param {string} noteId - Note ID
 * @returns {number} Number of entries deleted
 */
function deleteNoteHistory(noteId) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM note_history WHERE note_id = ?').run(noteId);
  return result.changes;
}

/**
 * Revert a note to a specific history version
 * @param {string} noteId - Note ID
 * @param {number} historyId - History entry ID to revert to
 * @returns {object|null} The history entry that was applied, or null
 */
function revertToVersion(noteId, historyId) {
  const { extractPlainText } = require('../utils/validators');
  const entry = getHistoryEntry(historyId);
  
  if (!entry || entry.note_id !== noteId) {
    return null;
  }
  
  // Use transaction to ensure atomicity
  return withTransaction(() => {
    const db = getDatabase();
    
    // First, save current state to history
    const currentNote = db.prepare('SELECT title, content FROM notes WHERE id = ?').get(noteId);
    if (currentNote) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO note_history (note_id, title, content, saved_at)
        VALUES (?, ?, ?, ?)
      `).run(noteId, currentNote.title, currentNote.content, now);
      
      pruneNoteHistoryInternal(db, noteId);
    }
    
    // Update the note with the historical version
    // Also update content_plain for search to work correctly
    const now = new Date().toISOString();
    const contentPlain = extractPlainText(entry.content || '');
    db.prepare(`
      UPDATE notes SET title = ?, content = ?, content_plain = ?, updated_at = ?
      WHERE id = ?
    `).run(entry.title, entry.content, contentPlain, now, noteId);
    
    return entry;
  });
}

/**
 * Check if a note has any history
 * @param {string} noteId - Note ID
 * @returns {boolean} True if note has history
 */
function hasHistory(noteId) {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM note_history WHERE note_id = ?
  `).get(noteId);
  return result.count > 0;
}

/**
 * Get the most recent history entry for a note
 * @param {string} noteId - Note ID
 * @returns {object|null} Most recent history entry or null
 */
function getLatestVersion(noteId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM note_history
    WHERE note_id = ?
    ORDER BY saved_at DESC
    LIMIT 1
  `).get(noteId) || null;
}

module.exports = {
  saveNoteVersion,
  getNoteHistory,
  getHistoryEntry,
  pruneNoteHistory,
  deleteNoteHistory,
  revertToVersion,
  hasHistory,
  getLatestVersion,
};
