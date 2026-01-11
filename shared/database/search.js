/**
 * Full-text search operations
 */
const { getDatabase } = require('./index');
const { sanitizeFtsQuery, validateLimit } = require('../utils/validators');

/**
 * Search notes using full-text search
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {object[]} Array of matching notes with relevance
 */
function searchNotes(query, options = {}) {
  const db = getDatabase();
  
  // Use safe FTS query sanitizer
  const sanitizedQuery = sanitizeFtsQuery(query);
  
  if (!sanitizedQuery) {
    // Fall back to simple search for empty/invalid queries
    return query ? searchNotesSimple(query, options) : [];
  }
  
  let sql = `
    SELECT n.*, 
           bm25(notes_fts) as relevance,
           snippet(notes_fts, 0, '<mark>', '</mark>', '...', 32) as title_snippet,
           snippet(notes_fts, 1, '<mark>', '</mark>', '...', 64) as content_snippet
    FROM notes n
    INNER JOIN notes_fts ON n.rowid = notes_fts.rowid
    WHERE notes_fts MATCH @query
  `;
  
  const params = { query: sanitizedQuery };
  
  // Apply filters
  if (!options.includeDeleted) {
    sql += ' AND n.is_deleted = 0';
  }
  
  if (!options.includeArchived && !options.archivedOnly) {
    sql += ' AND n.is_archived = 0';
  } else if (options.archivedOnly) {
    sql += ' AND n.is_archived = 1';
  }
  
  if (options.folder_id) {
    sql += ' AND n.folder_id = @folder_id';
    params.folder_id = options.folder_id;
  }
  
  // Order by relevance
  sql += ' ORDER BY relevance';
  
  // Limit with validation
  const limit = validateLimit(options.limit, 500);
  if (limit) {
    sql += ' LIMIT @limit';
    params.limit = limit;
  }
  
  try {
    return db.prepare(sql).all(params);
  } catch (err) {
    // FTS query error, fall back to simple LIKE search
    console.warn('FTS search failed, falling back to LIKE:', err.message);
    return searchNotesSimple(query, options);
  }
}

/**
 * Simple LIKE-based search fallback
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {object[]} Array of matching notes
 */
function searchNotesSimple(query, options = {}) {
  const db = getDatabase();
  
  // Sanitize the query for LIKE - escape special characters
  const sanitized = String(query || '')
    .substring(0, 500) // Limit length
    .replace(/[%_\\]/g, '\\$&'); // Escape LIKE special chars
  
  if (!sanitized.trim()) {
    return [];
  }
  
  const pattern = `%${sanitized}%`;
  
  let sql = `
    SELECT DISTINCT n.* FROM notes n
    LEFT JOIN note_tags nt ON n.id = nt.note_id
    LEFT JOIN tags t ON nt.tag_id = t.id
    WHERE (n.title LIKE @pattern ESCAPE '\\' OR n.content_plain LIKE @pattern ESCAPE '\\' OR t.name LIKE @pattern ESCAPE '\\')
  `;
  
  const params = { pattern };
  
  if (!options.includeDeleted) {
    sql += ' AND n.is_deleted = 0';
  }
  
  if (!options.includeArchived) {
    sql += ' AND n.is_archived = 0';
  }
  
  if (options.folder_id) {
    sql += ' AND n.folder_id = @folder_id';
    params.folder_id = options.folder_id;
  }
  
  sql += ' ORDER BY n.updated_at DESC';
  
  // Validate limit
  const limit = validateLimit(options.limit, 500);
  if (limit) {
    sql += ' LIMIT @limit';
    params.limit = limit;
  }
  
  return db.prepare(sql).all(params);
}

/**
 * Search for notes by tag
 * @param {string} tagName - Tag name to search for
 * @param {object} options - Search options
 * @returns {object[]} Array of matching notes
 */
function searchByTag(tagName, options = {}) {
  const db = getDatabase();
  
  let sql = `
    SELECT n.* FROM notes n
    INNER JOIN note_tags nt ON n.id = nt.note_id
    INNER JOIN tags t ON nt.tag_id = t.id
    WHERE t.name LIKE @tagName
  `;
  
  const params = { tagName: `%${tagName}%` };
  
  if (!options.includeDeleted) {
    sql += ' AND n.is_deleted = 0';
  }
  
  if (!options.includeArchived) {
    sql += ' AND n.is_archived = 0';
  }
  
  sql += ' ORDER BY n.updated_at DESC';
  
  return db.prepare(sql).all(params);
}

/**
 * Rebuild the FTS index
 */
function rebuildSearchIndex() {
  const db = getDatabase();
  
  // Clear and rebuild the FTS table
  db.exec(`
    DELETE FROM notes_fts;
    INSERT INTO notes_fts(rowid, title, content_plain)
    SELECT rowid, title, content_plain FROM notes;
  `);
}

/**
 * Get search suggestions based on partial query
 * @param {string} partial - Partial search query
 * @param {number} limit - Max suggestions
 * @returns {string[]} Array of suggestions
 */
function getSearchSuggestions(partial, limit = 5) {
  const db = getDatabase();
  
  // Sanitize the partial query - escape LIKE special characters
  const sanitized = String(partial || '')
    .substring(0, 100) // Limit length
    .replace(/[%_\\]/g, '\\$&'); // Escape LIKE special chars
  
  if (!sanitized.trim()) {
    return [];
  }
  
  // Get unique words from titles that match
  const results = db.prepare(`
    SELECT DISTINCT title FROM notes
    WHERE title LIKE ? ESCAPE '\\' AND n.is_deleted = 0
    ORDER BY n.updated_at DESC
    LIMIT ?
  `).all(`%${sanitized}%`, limit);
  
  return results.map(r => r.title).filter(Boolean);
}

module.exports = {
  searchNotes,
  searchNotesSimple,
  searchByTag,
  rebuildSearchIndex,
  getSearchSuggestions,
};
