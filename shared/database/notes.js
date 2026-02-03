/**
 * Notes CRUD operations
 */
const { getDatabase } = require('./index');
const { generateNoteId } = require('../utils/id');
const { noteDefaults } = require('../constants/defaults');
const { extractPlainText } = require('../utils/validators');

// Available note colors
const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal'];

/**
 * Get a random note color
 */
function getRandomColor() {
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

/**
 * Get the effective note color based on settings
 * @param {string} providedColor - Color provided in data
 * @returns {string} The color to use
 */
function getEffectiveColor(providedColor) {
  if (providedColor && providedColor !== 'random') {
    return providedColor;
  }

  // Try to get from settings
  try {
    const { getSetting } = require('./settings');
    const defaultColor = getSetting('appearance.defaultNoteColor');
    if (defaultColor === 'random') {
      return getRandomColor();
    }
    return defaultColor || noteDefaults.color;
  } catch {
    // Settings not available (e.g., during initialization)
    return providedColor === 'random' ? getRandomColor() : providedColor || noteDefaults.color;
  }
}

/**
 * Create a new note
 * @param {object} data - Note data
 * @returns {object} Created note
 */
function createNote(data = {}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = generateNoteId();

  const note = {
    id,
    title: data.title || noteDefaults.title,
    content: data.content || noteDefaults.content,
    content_plain: extractPlainText(data.content || ''),
    folder_id: data.folder_id || noteDefaults.folder_id,
    color: getEffectiveColor(data.color),
    position_x: data.position_x ?? noteDefaults.position_x,
    position_y: data.position_y ?? noteDefaults.position_y,
    width: data.width || noteDefaults.width,
    height: data.height || noteDefaults.height,
    is_open: data.is_open ?? noteDefaults.is_open,
    is_pinned: data.is_pinned ?? noteDefaults.is_pinned,
    is_locked: data.is_locked ?? noteDefaults.is_locked,
    is_archived: noteDefaults.is_archived,
    is_deleted: noteDefaults.is_deleted,
    password_hash: data.password_hash || noteDefaults.password_hash,
    reminder_at: data.reminder_at || noteDefaults.reminder_at,
    reminder_notified: noteDefaults.reminder_notified,
    font_size: data.font_size ?? noteDefaults.font_size,
    opacity: data.opacity ?? noteDefaults.opacity,
    z_index: data.z_index ?? noteDefaults.z_index,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    archived_at: null,
  };

  const stmt = db.prepare(`
    INSERT INTO notes (
      id, title, content, content_plain, folder_id, color,
      position_x, position_y, width, height,
      is_open, is_pinned, is_locked, is_archived, is_deleted,
      password_hash, reminder_at, reminder_notified,
      font_size, opacity, z_index,
      created_at, updated_at, deleted_at, archived_at
    ) VALUES (
      @id, @title, @content, @content_plain, @folder_id, @color,
      @position_x, @position_y, @width, @height,
      @is_open, @is_pinned, @is_locked, @is_archived, @is_deleted,
      @password_hash, @reminder_at, @reminder_notified,
      @font_size, @opacity, @z_index,
      @created_at, @updated_at, @deleted_at, @archived_at
    )
  `);

  stmt.run(note);
  return note;
}

/**
 * Get a note by ID
 * @param {string} id - Note ID
 * @returns {object|null} Note or null if not found
 */
function getNoteById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id) || null;
}

/**
 * Get all notes with optional filtering
 * @param {object} options - Filter options
 * @returns {object[]} Array of notes
 */
function getNotes(options = {}) {
  const db = getDatabase();
  const conditions = [];
  const params = {};

  // Default: exclude deleted notes
  if (options.includeDeleted) {
    // Include all
  } else if (options.trashedOnly) {
    conditions.push('is_deleted = 1');
  } else {
    conditions.push('is_deleted = 0');
  }

  // Archived filter
  if (options.archivedOnly) {
    conditions.push('is_archived = 1');
  } else if (!options.includeArchived && !options.trashedOnly) {
    conditions.push('is_archived = 0');
  }

  // Folder filter
  if (options.folder_id !== undefined) {
    if (options.folder_id === null) {
      conditions.push('folder_id IS NULL');
    } else {
      conditions.push('folder_id = @folder_id');
      params.folder_id = options.folder_id;
    }
  }

  // Color filter
  if (options.color) {
    conditions.push('color = @color');
    params.color = options.color;
  }

  // Reminder filter
  if (options.withReminder) {
    conditions.push('reminder_at IS NOT NULL');
  }

  // Overdue reminder filter
  if (options.overdue) {
    conditions.push('reminder_at IS NOT NULL AND reminder_at < @now AND reminder_notified = 0');
    params.now = new Date().toISOString();
  }

  // Open notes only
  if (options.openOnly) {
    conditions.push('is_open = 1');
  }

  // Build query
  let query = 'SELECT * FROM notes';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Sorting
  const sortField = options.sort || 'updated_at';
  const sortDir = options.desc ? 'DESC' : 'ASC';
  const validSortFields = ['created_at', 'updated_at', 'title', 'reminder_at', 'z_index'];
  if (validSortFields.includes(sortField)) {
    query += ` ORDER BY ${sortField} ${sortDir}`;
  } else {
    query += ' ORDER BY updated_at DESC';
  }

  // Limit
  if (options.limit) {
    query += ' LIMIT @limit';
    params.limit = options.limit;
  }

  return db.prepare(query).all(params);
}

/**
 * Update a note
 * @param {string} id - Note ID
 * @param {object} data - Fields to update
 * @returns {object|null} Updated note or null
 */
function updateNote(id, data) {
  const db = getDatabase();
  const existing = getNoteById(id);
  if (!existing) return null;

  const updates = [];
  const params = { id };

  const allowedFields = [
    'title',
    'content',
    'folder_id',
    'color',
    'position_x',
    'position_y',
    'width',
    'height',
    'is_open',
    'is_pinned',
    'is_locked',
    'password_hash',
    'reminder_at',
    'reminder_notified',
    'font_size',
    'opacity',
    'z_index',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = @${field}`);
      params[field] = data[field];
    }
  }

  // Update content_plain if content changed
  if (data.content !== undefined) {
    updates.push('content_plain = @content_plain');
    // Allow explicit content_plain value (e.g., for encrypted notes)
    // Otherwise auto-extract from content
    params.content_plain =
      data.content_plain !== undefined ? data.content_plain : extractPlainText(data.content);
  } else if (data.content_plain !== undefined) {
    // Allow updating content_plain independently
    updates.push('content_plain = @content_plain');
    params.content_plain = data.content_plain;
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = @updated_at');
  params.updated_at = new Date().toISOString();

  const query = `UPDATE notes SET ${updates.join(', ')} WHERE id = @id`;
  db.prepare(query).run(params);

  return getNoteById(id);
}

/**
 * Soft delete a note (move to trash)
 * @param {string} id - Note ID
 * @returns {boolean} Success
 */
function deleteNote(id) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
    UPDATE notes 
    SET is_deleted = 1, deleted_at = ?, updated_at = ?, is_open = 0
    WHERE id = ?
  `
    )
    .run(now, now, id);

  return result.changes > 0;
}

/**
 * Permanently delete a note
 * @param {string} id - Note ID
 * @returns {boolean} Success
 */
function permanentlyDeleteNote(id) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Restore a note from trash
 * @param {string} id - Note ID
 * @returns {object|null} Restored note or null
 */
function restoreNote(id) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
    UPDATE notes 
    SET is_deleted = 0, deleted_at = NULL, updated_at = ?
    WHERE id = ?
  `
    )
    .run(now, id);

  if (result.changes > 0) {
    return getNoteById(id);
  }
  return null;
}

/**
 * Archive a note
 * @param {string} id - Note ID
 * @returns {object|null} Archived note or null
 */
function archiveNote(id) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
    UPDATE notes 
    SET is_archived = 1, archived_at = ?, updated_at = ?, is_open = 0
    WHERE id = ?
  `
    )
    .run(now, now, id);

  if (result.changes > 0) {
    return getNoteById(id);
  }
  return null;
}

/**
 * Unarchive a note
 * @param {string} id - Note ID
 * @returns {object|null} Unarchived note or null
 */
function unarchiveNote(id) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
    UPDATE notes 
    SET is_archived = 0, archived_at = NULL, updated_at = ?
    WHERE id = ?
  `
    )
    .run(now, id);

  if (result.changes > 0) {
    return getNoteById(id);
  }
  return null;
}

/**
 * Duplicate a note
 * @param {string} id - Note ID to duplicate
 * @returns {object|null} New duplicated note or null
 * @throws {Error} If note is locked/encrypted
 */
function duplicateNote(id) {
  const original = getNoteById(id);
  if (!original) return null;

  // Prevent duplicating locked notes - the encrypted content would be useless
  // User must unlock first, then duplicate
  if (original.is_locked) {
    throw new Error('Cannot duplicate a locked note. Please unlock it first.');
  }

  return createNote({
    title: original.title ? `${original.title} (copy)` : '',
    content: original.content,
    folder_id: original.folder_id,
    color: original.color,
    width: original.width,
    height: original.height,
    font_size: original.font_size,
    opacity: original.opacity,
  });
}

/**
 * Purge old deleted notes
 * @param {number} daysOld - Delete notes older than this many days
 * @returns {number} Number of notes purged
 */
function purgeDeletedNotes(daysOld = 30) {
  if (daysOld <= 0) return 0;

  const db = getDatabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = db
    .prepare(
      `
    DELETE FROM notes 
    WHERE is_deleted = 1 AND deleted_at < ?
  `
    )
    .run(cutoff.toISOString());

  return result.changes;
}

/**
 * Get notes count by status
 * @returns {object} Count object
 */
function getNotesCount() {
  const db = getDatabase();

  const total = db.prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 0').get().count;
  const archived = db
    .prepare('SELECT COUNT(*) as count FROM notes WHERE is_archived = 1 AND is_deleted = 0')
    .get().count;
  const trashed = db
    .prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 1')
    .get().count;
  const withReminder = db
    .prepare('SELECT COUNT(*) as count FROM notes WHERE reminder_at IS NOT NULL AND is_deleted = 0')
    .get().count;

  return {
    total,
    active: total - archived,
    archived,
    trashed,
    withReminder,
  };
}

/**
 * Lock a note with password encryption
 * @param {string} id - Note ID
 * @param {string} password - Password to encrypt with
 * @returns {object|null} Updated note or null
 */
async function lockNote(id, password) {
  const { hashPassword, encryptContent } = require('../crypto');
  const { validatePassword } = require('../utils/validators');
  const db = getDatabase();
  const existing = getNoteById(id);
  if (!existing) return null;
  if (existing.is_locked) {
    throw new Error('Note is already locked');
  }

  // Validate password
  const validation = validatePassword(password);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const passwordHash = await hashPassword(password);
  const encryptedContent = encryptContent(existing.content || '', password);
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE notes 
    SET is_locked = 1, password_hash = ?, content = ?, content_plain = '[ENCRYPTED]', updated_at = ?
    WHERE id = ?
  `
  ).run(passwordHash, encryptedContent, now, id);

  return getNoteById(id);
}

/**
 * Unlock a note with password
 * @param {string} id - Note ID
 * @param {string} password - Password to verify and decrypt
 * @returns {object|null} Updated note or null if password incorrect
 */
async function unlockNote(id, password) {
  const { verifyPassword, decryptContent } = require('../crypto');
  const db = getDatabase();
  const existing = getNoteById(id);
  if (!existing || !existing.is_locked) return null;

  const isMatch = await verifyPassword(password, existing.password_hash);
  if (!isMatch) {
    throw new Error('Incorrect password');
  }

  const decryptedContent = decryptContent(existing.content, password);
  if (decryptedContent === null) {
    throw new Error('Failed to decrypt content');
  }

  const { extractPlainText } = require('../utils/validators');
  const now = new Date().toISOString();

  db.prepare(
    `
    UPDATE notes 
    SET is_locked = 0, password_hash = NULL, content = ?, content_plain = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(decryptedContent, extractPlainText(decryptedContent), now, id);

  return getNoteById(id);
}

module.exports = {
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
  purgeDeletedNotes,
  getNotesCount,
  lockNote,
  unlockNote,
};
