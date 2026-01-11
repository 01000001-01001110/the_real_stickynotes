/**
 * Tags CRUD operations
 */
const { getDatabase, withTransaction } = require('./index');

/**
 * Create a new tag
 * @param {object} data - Tag data
 * @returns {object} Created tag
 */
function createTag(data) {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO tags (name, color, created_at)
    VALUES (@name, @color, @created_at)
  `);

  const result = stmt.run({
    name: data.name,
    color: data.color || null,
    created_at: now,
  });

  return getTagById(result.lastInsertRowid);
}

/**
 * Get a tag by ID
 * @param {number} id - Tag ID
 * @returns {object|null} Tag or null
 */
function getTagById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) || null;
}

/**
 * Get a tag by name
 * @param {string} name - Tag name
 * @returns {object|null} Tag or null
 */
function getTagByName(name) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name) || null;
}

/**
 * Get all tags
 * @param {object} options - Options
 * @returns {object[]} Array of tags
 */
function getTags(options = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM tags';
  
  if (options.withCounts) {
    query = `
      SELECT t.*, COUNT(nt.note_id) as note_count
      FROM tags t
      LEFT JOIN note_tags nt ON t.id = nt.tag_id
      LEFT JOIN notes n ON nt.note_id = n.id AND n.is_deleted = 0
      GROUP BY t.id
      ORDER BY t.name
    `;
  } else {
    query += ' ORDER BY name';
  }
  
  return db.prepare(query).all();
}

/**
 * Update a tag
 * @param {number} id - Tag ID
 * @param {object} data - Fields to update
 * @returns {object|null} Updated tag or null
 */
function updateTag(id, data) {
  const db = getDatabase();
  const updates = [];
  const params = { id };

  if (data.name !== undefined) {
    updates.push('name = @name');
    params.name = data.name;
  }

  if (data.color !== undefined) {
    updates.push('color = @color');
    params.color = data.color;
  }

  if (updates.length === 0) return getTagById(id);

  const query = `UPDATE tags SET ${updates.join(', ')} WHERE id = @id`;
  db.prepare(query).run(params);

  return getTagById(id);
}

/**
 * Rename a tag
 * @param {string} oldName - Current name
 * @param {string} newName - New name
 * @returns {object|null} Updated tag or null
 */
function renameTag(oldName, newName) {
  const tag = getTagByName(oldName);
  if (!tag) return null;
  return updateTag(tag.id, { name: newName });
}

/**
 * Delete a tag
 * @param {number} id - Tag ID
 * @returns {boolean} Success
 */
function deleteTag(id) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Delete a tag by name
 * @param {string} name - Tag name
 * @returns {boolean} Success
 */
function deleteTagByName(name) {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM tags WHERE name = ?').run(name);
  return result.changes > 0;
}

/**
 * Add a tag to a note
 * @param {string} noteId - Note ID
 * @param {string} tagName - Tag name (will be created if doesn't exist)
 * @returns {boolean} Success
 */
function addTagToNote(noteId, tagName) {
  const db = getDatabase();
  
  // Get or create tag
  let tag = getTagByName(tagName);
  if (!tag) {
    tag = createTag({ name: tagName });
  }
  
  try {
    db.prepare(`
      INSERT OR IGNORE INTO note_tags (note_id, tag_id)
      VALUES (?, ?)
    `).run(noteId, tag.id);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Remove a tag from a note
 * @param {string} noteId - Note ID
 * @param {string} tagName - Tag name
 * @returns {boolean} Success
 */
function removeTagFromNote(noteId, tagName) {
  const db = getDatabase();
  const tag = getTagByName(tagName);
  if (!tag) return false;
  
  const result = db.prepare(`
    DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?
  `).run(noteId, tag.id);
  
  return result.changes > 0;
}

/**
 * Get tags for a note
 * @param {string} noteId - Note ID
 * @returns {object[]} Array of tags
 */
function getTagsForNote(noteId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id = ?
    ORDER BY t.name
  `).all(noteId);
}

/**
 * Get tags for multiple notes in one query (batch operation)
 * @param {string[]} noteIds - Array of note IDs
 * @returns {Object.<string, object[]>} Map of noteId -> array of tags
 */
function getTagsForNotes(noteIds) {
  if (!noteIds || noteIds.length === 0) return {};
  
  const db = getDatabase();
  
  // Build a single query with placeholders
  const placeholders = noteIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT nt.note_id, t.* FROM tags t
    INNER JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id IN (${placeholders})
    ORDER BY t.name
  `).all(...noteIds);
  
  // Group by note_id
  const result = {};
  for (const noteId of noteIds) {
    result[noteId] = [];
  }
  for (const row of rows) {
    const { note_id, ...tag } = row;
    if (result[note_id]) {
      result[note_id].push(tag);
    }
  }
  
  return result;
}

/**
 * Get notes with a specific tag
 * @param {string} tagName - Tag name
 * @param {object} options - Filter options
 * @returns {object[]} Array of notes
 */
function getNotesWithTag(tagName, options = {}) {
  const db = getDatabase();
  const tag = getTagByName(tagName);
  if (!tag) return [];
  
  let query = `
    SELECT n.* FROM notes n
    INNER JOIN note_tags nt ON n.id = nt.note_id
    WHERE nt.tag_id = ?
  `;
  
  if (!options.includeDeleted) {
    query += ' AND n.is_deleted = 0';
  }
  
  if (!options.includeArchived) {
    query += ' AND n.is_archived = 0';
  }
  
  query += ' ORDER BY n.updated_at DESC';
  
  return db.prepare(query).all(tag.id);
}

/**
 * Set all tags for a note (replaces existing)
 * @param {string} noteId - Note ID
 * @param {string[]} tagNames - Array of tag names
 */
function setNoteTags(noteId, tagNames) {
  withTransaction(() => {
    const db = getDatabase();
    
    // Remove existing tags
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
    
    // Add new tags
    for (const tagName of tagNames) {
      // Get or create tag
      let tag = getTagByName(tagName);
      if (!tag) {
        const now = new Date().toISOString();
        const result = db.prepare(`
          INSERT INTO tags (name, color, created_at)
          VALUES (?, NULL, ?)
        `).run(tagName, now);
        tag = { id: result.lastInsertRowid };
      }
      
      db.prepare(`
        INSERT OR IGNORE INTO note_tags (note_id, tag_id)
        VALUES (?, ?)
      `).run(noteId, tag.id);
    }
  });
}

module.exports = {
  createTag,
  getTagById,
  getTagByName,
  getTags,
  updateTag,
  renameTag,
  deleteTag,
  deleteTagByName,
  addTagToNote,
  removeTagFromNote,
  getTagsForNote,
  getTagsForNotes,
  getNotesWithTag,
  setNoteTags,
};
