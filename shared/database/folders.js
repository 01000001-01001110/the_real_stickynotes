/**
 * Folders CRUD operations
 */
const { getDatabase, withTransaction } = require('./index');
const { generateFolderId } = require('../utils/id');
const { folderDefaults } = require('../constants/defaults');

/**
 * Create a new folder
 * @param {object} data - Folder data
 * @returns {object} Created folder
 */
function createFolder(data) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = generateFolderId();
  
  const folder = {
    id,
    name: data.name || folderDefaults.name,
    parent_id: data.parent_id || folderDefaults.parent_id,
    color: data.color || folderDefaults.color,
    sort_order: data.sort_order ?? folderDefaults.sort_order,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO folders (id, name, parent_id, color, sort_order, created_at, updated_at)
    VALUES (@id, @name, @parent_id, @color, @sort_order, @created_at, @updated_at)
  `).run(folder);

  return folder;
}

/**
 * Get a folder by ID
 * @param {string} id - Folder ID
 * @returns {object|null} Folder or null
 */
function getFolderById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) || null;
}

/**
 * Get all folders
 * @param {object} options - Options
 * @returns {object[]} Array of folders
 */
function getFolders(options = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM folders';
  const params = {};
  
  if (options.parent_id !== undefined) {
    if (options.parent_id === null) {
      query += ' WHERE parent_id IS NULL';
    } else {
      query += ' WHERE parent_id = @parent_id';
      params.parent_id = options.parent_id;
    }
  }
  
  query += ' ORDER BY sort_order, name';
  
  return db.prepare(query).all(params);
}

/**
 * Get folders as a tree structure
 * @returns {object[]} Tree of folders
 */
function getFolderTree() {
  const folders = getFolders();
  const map = {};
  const roots = [];

  // Create map
  for (const folder of folders) {
    map[folder.id] = { ...folder, children: [] };
  }

  // Build tree
  for (const folder of folders) {
    if (folder.parent_id && map[folder.parent_id]) {
      map[folder.parent_id].children.push(map[folder.id]);
    } else {
      roots.push(map[folder.id]);
    }
  }

  return roots;
}

/**
 * Update a folder
 * @param {string} id - Folder ID
 * @param {object} data - Fields to update
 * @returns {object|null} Updated folder or null
 */
function updateFolder(id, data) {
  const db = getDatabase();
  const existing = getFolderById(id);
  if (!existing) return null;

  const updates = [];
  const params = { id };

  if (data.name !== undefined) {
    updates.push('name = @name');
    params.name = data.name;
  }

  if (data.parent_id !== undefined) {
    // Prevent circular reference
    if (data.parent_id === id) {
      throw new Error('Folder cannot be its own parent');
    }
    updates.push('parent_id = @parent_id');
    params.parent_id = data.parent_id;
  }

  if (data.color !== undefined) {
    updates.push('color = @color');
    params.color = data.color;
  }

  if (data.sort_order !== undefined) {
    updates.push('sort_order = @sort_order');
    params.sort_order = data.sort_order;
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = @updated_at');
  params.updated_at = new Date().toISOString();

  const query = `UPDATE folders SET ${updates.join(', ')} WHERE id = @id`;
  db.prepare(query).run(params);

  return getFolderById(id);
}

/**
 * Delete a folder
 * @param {string} id - Folder ID
 * @param {boolean} force - If true, also delete contained notes
 * @returns {boolean} Success
 */
function deleteFolder(id, force = false) {
  return withTransaction(() => {
    const db = getDatabase();
    const folder = getFolderById(id);
    
    if (!folder) {
      return false;
    }
    
    if (force) {
      // Delete all notes in this folder
      db.prepare('DELETE FROM notes WHERE folder_id = ?').run(id);
    } else {
      // Move notes to no folder
      db.prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ?').run(id);
    }
    
    // Move child folders to parent
    db.prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?')
      .run(folder.parent_id, id);
    
    const result = db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    return result.changes > 0;
  });
}

/**
 * Get notes in a folder
 * @param {string} folderId - Folder ID
 * @param {object} options - Filter options
 * @returns {object[]} Array of notes
 */
function getNotesInFolder(folderId, options = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM notes WHERE folder_id = ?';
  
  if (!options.includeDeleted) {
    query += ' AND is_deleted = 0';
  }
  
  if (!options.includeArchived) {
    query += ' AND is_archived = 0';
  }
  
  query += ' ORDER BY updated_at DESC';
  
  return db.prepare(query).all(folderId);
}

/**
 * Move a note to a folder
 * @param {string} noteId - Note ID
 * @param {string|null} folderId - Folder ID or null for no folder
 * @returns {boolean} Success
 */
function moveNoteToFolder(noteId, folderId) {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const result = db.prepare(`
    UPDATE notes SET folder_id = ?, updated_at = ? WHERE id = ?
  `).run(folderId, now, noteId);
  
  return result.changes > 0;
}

/**
 * Get folder path (breadcrumb)
 * @param {string} folderId - Folder ID
 * @returns {object[]} Array of folders from root to target
 */
function getFolderPath(folderId) {
  const path = [];
  let currentId = folderId;
  
  while (currentId) {
    const folder = getFolderById(currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parent_id;
  }
  
  return path;
}

module.exports = {
  createFolder,
  getFolderById,
  getFolders,
  getFolderTree,
  updateFolder,
  deleteFolder,
  getNotesInFolder,
  moveNoteToFolder,
  getFolderPath,
};
