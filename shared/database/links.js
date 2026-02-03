/**
 * Note linking operations (wiki-style [[links]])
 */
const { getDatabase } = require('./index');

/**
 * Parse [[links]] from note content
 * @param {string} content - Note content
 * @returns {string[]} Array of link texts
 */
function parseNoteLinks(content) {
  if (!content) return [];

  const linkPattern = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    links.push(match[1].trim());
  }

  return [...new Set(links)]; // Remove duplicates
}

/**
 * Find a note by title (for resolving links)
 * @param {string} title - Note title to find
 * @returns {object|null} Note or null
 */
function findNoteByTitle(title) {
  const db = getDatabase();
  return (
    db
      .prepare(
        `
    SELECT * FROM notes 
    WHERE title = ? AND is_deleted = 0
    LIMIT 1
  `
      )
      .get(title) || null
  );
}

/**
 * Update links for a note based on its content
 * @param {string} noteId - Source note ID
 * @param {string} content - Note content
 */
function updateNoteLinks(noteId, content) {
  const db = getDatabase();
  const linkTexts = parseNoteLinks(content);

  // Remove existing links from this note
  db.prepare('DELETE FROM note_links WHERE source_note_id = ?').run(noteId);

  // Add new links
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO note_links (source_note_id, target_note_id, link_text)
    VALUES (?, ?, ?)
  `);

  for (const linkText of linkTexts) {
    const targetNote = findNoteByTitle(linkText);
    if (targetNote && targetNote.id !== noteId) {
      insertStmt.run(noteId, targetNote.id, linkText);
    }
  }
}

/**
 * Get all outgoing links from a note
 * @param {string} noteId - Source note ID
 * @returns {object[]} Array of linked notes with link text
 */
function getOutgoingLinks(noteId) {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT n.*, nl.link_text
    FROM note_links nl
    INNER JOIN notes n ON nl.target_note_id = n.id
    WHERE nl.source_note_id = ? AND n.is_deleted = 0
    ORDER BY nl.link_text
  `
    )
    .all(noteId);
}

/**
 * Get all incoming links to a note (backlinks)
 * @param {string} noteId - Target note ID
 * @returns {object[]} Array of notes that link to this note
 */
function getBacklinks(noteId) {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT n.*, nl.link_text
    FROM note_links nl
    INNER JOIN notes n ON nl.source_note_id = n.id
    WHERE nl.target_note_id = ? AND n.is_deleted = 0
    ORDER BY n.updated_at DESC
  `
    )
    .all(noteId);
}

/**
 * Check if a link exists between two notes
 * @param {string} sourceId - Source note ID
 * @param {string} targetId - Target note ID
 * @returns {boolean} True if link exists
 */
function hasLink(sourceId, targetId) {
  const db = getDatabase();
  const result = db
    .prepare(
      `
    SELECT 1 FROM note_links
    WHERE source_note_id = ? AND target_note_id = ?
    LIMIT 1
  `
    )
    .get(sourceId, targetId);
  return !!result;
}

/**
 * Get unresolved links (links to non-existent notes)
 * @param {string} noteId - Note ID
 * @returns {string[]} Array of link texts that don't resolve
 */
function getUnresolvedLinks(noteId) {
  const db = getDatabase();
  const note = db.prepare('SELECT content FROM notes WHERE id = ?').get(noteId);
  if (!note) return [];

  const linkTexts = parseNoteLinks(note.content);
  const unresolved = [];

  for (const linkText of linkTexts) {
    const target = findNoteByTitle(linkText);
    if (!target) {
      unresolved.push(linkText);
    }
  }

  return unresolved;
}

/**
 * Create a note from an unresolved link
 * @param {string} title - The link text to use as title
 * @param {string} sourceNoteId - The note containing the link
 * @returns {object} Created note
 */
function createNoteFromLink(title, sourceNoteId) {
  const { createNote } = require('./notes');

  // Create the new note
  const newNote = createNote({ title });

  // Update links in the source note
  const db = getDatabase();
  const sourceNote = db.prepare('SELECT content FROM notes WHERE id = ?').get(sourceNoteId);
  if (sourceNote) {
    updateNoteLinks(sourceNoteId, sourceNote.content);
  }

  return newNote;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render note content with resolved links
 * @param {string} content - Note content
 * @returns {string} Content with links rendered as HTML
 */
function renderLinks(content) {
  if (!content) return '';

  return content.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
    const escaped = escapeHtml(linkText);
    const targetNote = findNoteByTitle(linkText.trim());
    if (targetNote) {
      return `<a href="#" class="note-link" data-note-id="${escapeHtml(targetNote.id)}">${escaped}</a>`;
    } else {
      return `<a href="#" class="note-link unresolved" data-link-text="${escaped}">${escaped}</a>`;
    }
  });
}

module.exports = {
  parseNoteLinks,
  findNoteByTitle,
  updateNoteLinks,
  getOutgoingLinks,
  getBacklinks,
  hasLink,
  getUnresolvedLinks,
  createNoteFromLink,
  renderLinks,
};
