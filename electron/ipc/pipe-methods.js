/**
 * Named Pipe Method Registry
 *
 * Maps JSON-RPC methods to existing IPC handlers and database functions.
 * This registry exposes all application functionality via named pipe for CLI access.
 */

const { app } = require('electron');

// Import standardized error codes and error classes
const {
  ERROR_CODES,
  AppError,
  ValidationError,
  NotFoundError,
  PermissionError,
  ServiceUnavailableError,
  ConfigError,
} = require('../../shared/config/error-codes');

/**
 * Method Registry
 * Manages registration and execution of JSON-RPC methods
 */
class MethodRegistry {
  constructor() {
    this.methods = new Map();
    this.middleware = [];
  }

  /**
   * Register a method handler
   * @param {string} method - Method name (e.g., 'note:list')
   * @param {Function} handler - Handler function
   * @param {object} options - Optional metadata
   */
  register(method, handler, options = {}) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for method "${method}" must be a function`);
    }
    this.methods.set(method, { handler, options });
  }

  /**
   * Check if a method is registered
   * @param {string} method - Method name
   * @returns {boolean}
   */
  has(method) {
    return this.methods.has(method);
  }

  /**
   * Get all registered method names
   * @returns {string[]}
   */
  list() {
    return Array.from(this.methods.keys()).sort();
  }

  /**
   * Add middleware function
   * @param {Function} fn - Middleware function
   */
  use(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this.middleware.push(fn);
  }

  /**
   * Call a registered method
   * @param {string} method - Method name
   * @param {any} params - Method parameters
   * @returns {Promise<any>} Method result
   * @throws {NotFoundError} If method not found
   * @throws {Error} If method execution fails
   */
  async call(method, params) {
    const entry = this.methods.get(method);

    if (!entry) {
      throw new NotFoundError('method', method);
    }

    try {
      // Execute middleware chain
      for (const middleware of this.middleware) {
        await middleware(method, params);
      }

      // Execute handler
      const result = await entry.handler(params);
      return result;
    } catch (error) {
      // Re-throw custom errors as-is
      if (error.code) {
        throw error;
      }

      // Wrap other errors
      const wrappedError = new Error(error.message);
      wrappedError.code = ERROR_CODES.INTERNAL_ERROR;
      wrappedError.data = { originalError: error.message };
      throw wrappedError;
    }
  }
}

/**
 * Create and configure the method registry
 * @param {Object|WindowManager} stores - Either a stores object
 *   ({ windowManager, getSetting, ... }) whose `windowManager` may be injected
 *   AFTER this call (the pipe server starts in Phase 2, before the WindowManager
 *   exists in Phase 3), or a raw WindowManager (legacy/tests).
 * @returns {MethodRegistry}
 */
function createRegistry(stores) {
  const registry = new MethodRegistry();

  // Late-bound window manager. The registry is built before the WindowManager
  // exists, so handlers must resolve it at call time — not capture it here.
  // Accepts a stores wrapper (preferred) or a raw WindowManager.
  const resolveWM = () => {
    if (!stores) return null;
    if (typeof stores.broadcast === 'function' || typeof stores.showPanel === 'function') {
      return stores; // raw WindowManager
    }
    return stores.windowManager || null;
  };

  // Import database functions lazily to avoid circular dependencies
  const getNotes = () => require('../../shared/database/notes').getNotes;
  const getNoteById = () => require('../../shared/database/notes').getNoteById;
  const createNote = () => require('../../shared/database/notes').createNote;
  const updateNote = () => require('../../shared/database/notes').updateNote;
  const deleteNote = () => require('../../shared/database/notes').deleteNote;
  const restoreNote = () => require('../../shared/database/notes').restoreNote;
  const archiveNote = () => require('../../shared/database/notes').archiveNote;
  const duplicateNote = () => require('../../shared/database/notes').duplicateNote;
  const lockNote = () => require('../../shared/database/notes').lockNote;
  const unlockNote = () => require('../../shared/database/notes').unlockNote;
  const permanentlyDeleteNote = () => require('../../shared/database/notes').permanentlyDeleteNote;
  const verifyPasswordSync = () => require('../../shared/crypto').verifyPasswordSync;
  const revertToVersion = () => require('../../shared/database/history').revertToVersion;

  const getTags = () => require('../../shared/database/tags').getTags;
  const getTagsForNote = () => require('../../shared/database/tags').getTagsForNote;
  const getTagsForNotes = () => require('../../shared/database/tags').getTagsForNotes;
  const addTagToNote = () => require('../../shared/database/tags').addTagToNote;
  const removeTagFromNote = () => require('../../shared/database/tags').removeTagFromNote;
  const setNoteTags = () => require('../../shared/database/tags').setNoteTags;
  const deleteTagByName = () => require('../../shared/database/tags').deleteTagByName;
  const renameTag = () => require('../../shared/database/tags').renameTag;
  const cleanupOrphanedTags = () => require('../../shared/database/tags').cleanupOrphanedTags;

  const getFolders = () => require('../../shared/database/folders').getFolders;
  const getFolderTree = () => require('../../shared/database/folders').getFolderTree;
  const createFolder = () => require('../../shared/database/folders').createFolder;
  const updateFolder = () => require('../../shared/database/folders').updateFolder;
  const deleteFolder = () => require('../../shared/database/folders').deleteFolder;
  const moveNoteToFolder = () => require('../../shared/database/folders').moveNoteToFolder;

  const getOutgoingLinks = () => require('../../shared/database/links').getOutgoingLinks;
  const getBacklinks = () => require('../../shared/database/links').getBacklinks;
  const createNoteFromLink = () => require('../../shared/database/links').createNoteFromLink;

  const searchNotes = () => require('../../shared/database/search').searchNotes;
  const searchByTag = () => require('../../shared/database/search').searchByTag;

  const getSetting = () => require('../../shared/database/settings').getSetting;
  const setSetting = () => require('../../shared/database/settings').setSetting;
  const getAllSettings = () => require('../../shared/database/settings').getAllSettings;
  const resetSetting = () => require('../../shared/database/settings').resetSetting;

  const getAttachmentsForNote = () =>
    require('../../shared/database/attachments').getAttachmentsForNote;
  const saveAttachment = () => require('../../shared/database/attachments').saveAttachment;
  const deleteAttachment = () => require('../../shared/database/attachments').deleteAttachment;
  const getAttachmentPath = () => require('../../shared/database/attachments').getAttachmentPath;

  const validateNote = () => require('../../shared/utils/validators').validateNote;
  const isValidNoteId = () => require('../../shared/utils/validators').isValidNoteId;

  // ============================================================================
  // AUTH
  // ============================================================================

  // The real token check happens at the connection layer (pipe-server.js) before
  // any method is dispatched. This handler only exists so the client's uniform
  // "send auth first" handshake succeeds when auth is disabled (dev/tests) or the
  // connection is already authenticated — it never gates anything by itself.
  registry.register('auth', async () => ({ authenticated: true }), {
    description: 'Authenticate the connection (token verified at the connection layer)',
  });

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  registry.register(
    'note:list',
    async (params) => {
      const options = params || {};
      return getNotes()(options);
    },
    { description: 'List all notes with optional filters' }
  );

  registry.register(
    'note:get',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = getNoteById()(params.id);
      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      return note;
    },
    { description: 'Get a single note by ID' }
  );

  registry.register(
    'note:create',
    async (params) => {
      const noteData = params || {};

      // Validate input if provided
      if (Object.keys(noteData).length > 0) {
        const validation = validateNote()(noteData);
        if (!validation.valid) {
          throw new ValidationError(validation.errors.join(', '));
        }
      }

      try {
        const note = createNote()(noteData);

        // Broadcast to other clients
        if (resolveWM()) {
          resolveWM().broadcast('note:created', note);
        }

        return { success: true, note };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Create a new note' }
  );

  registry.register(
    'note:update',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const { id, ...data } = params;

      // Validate note ID
      if (!isValidNoteId()(id)) {
        throw new ValidationError('Valid note ID is required');
      }

      // Validate update data if provided
      if (data && Object.keys(data).length > 0) {
        const validation = validateNote()(data);
        if (!validation.valid) {
          throw new ValidationError(validation.errors.join(', '));
        }
      }

      const oldNote = getNoteById()(id);
      if (!oldNote) {
        throw new NotFoundError('note', id);
      }

      try {
        const note = updateNote()(id, data);

        if (note) {
          // Save to history if content changed
          if (oldNote && data.content !== undefined && oldNote.content !== data.content) {
            const { saveNoteVersion } = require('../../shared/database/history');
            saveNoteVersion(id, oldNote.title, oldNote.content);
          }

          // Update links if content changed
          if (data.content !== undefined) {
            const { updateNoteLinks } = require('../../shared/database/links');
            updateNoteLinks(id, data.content);
          }

          // Broadcast to other clients
          if (resolveWM()) {
            resolveWM().broadcast('note:updated', note);
          }
        }

        return { success: true, note };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Update an existing note' }
  );

  registry.register(
    'note:delete',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const success = deleteNote()(params.id);

      if (success && resolveWM()) {
        resolveWM().broadcast('note:deleted', params.id);
      }

      return { success };
    },
    { description: 'Delete a note (soft delete)' }
  );

  registry.register(
    'note:restore',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = restoreNote()(params.id);

      if (!note) {
        throw new NotFoundError('note', params.id, {
          reason: 'Note not found or cannot be restored',
        });
      }

      if (resolveWM()) {
        resolveWM().broadcast('note:created', note);
      }

      return { success: true, note };
    },
    { description: 'Restore a deleted note' }
  );

  registry.register(
    'note:archive',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = archiveNote()(params.id);

      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      if (resolveWM()) {
        resolveWM().broadcast('note:updated', note);
      }

      return { success: true, note };
    },
    { description: 'Archive a note' }
  );

  registry.register(
    'note:duplicate',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = duplicateNote()(params.id);

      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      if (resolveWM()) {
        resolveWM().broadcast('note:created', note);
      }

      return { success: true, note };
    },
    { description: 'Duplicate a note' }
  );

  registry.register(
    'note:lock',
    async (params) => {
      if (!params || !params.id || !params.password) {
        throw new ValidationError('Note ID and password are required');
      }

      try {
        const note = await lockNote()(params.id, params.password);

        if (!note) {
          throw new NotFoundError('note', params.id);
        }

        if (resolveWM()) {
          resolveWM().broadcast('note:updated', note);
        }

        return { success: true, note };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Lock a note with password encryption' }
  );

  registry.register(
    'note:unlock',
    async (params) => {
      if (!params || !params.id || !params.password) {
        throw new ValidationError('Note ID and password are required');
      }

      try {
        const note = await unlockNote()(params.id, params.password);

        if (!note) {
          throw new PermissionError('Note not found or wrong password');
        }

        if (resolveWM()) {
          resolveWM().broadcast('note:updated', note);
        }

        return { success: true, note };
      } catch (err) {
        throw new PermissionError(err.message);
      }
    },
    { description: 'Unlock a password-protected note' }
  );

  registry.register(
    'note:pin',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = getNoteById()(params.id);
      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      const updated = updateNote()(params.id, { is_pinned: 1 });

      if (resolveWM()) {
        resolveWM().broadcast('note:updated', updated);
      }

      return { success: true, note: updated };
    },
    { description: 'Pin a note to the top' }
  );

  registry.register(
    'note:unpin',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = getNoteById()(params.id);
      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      const updated = updateNote()(params.id, { is_pinned: 0 });

      if (resolveWM()) {
        resolveWM().broadcast('note:updated', updated);
      }

      return { success: true, note: updated };
    },
    { description: 'Unpin a note' }
  );

  registry.register(
    'note:unarchive',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = getNoteById()(params.id);
      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      const updated = updateNote()(params.id, { is_archived: 0, archived_at: null });

      if (resolveWM()) {
        resolveWM().broadcast('note:updated', updated);
      }

      return { success: true, note: updated };
    },
    { description: 'Unarchive a note' }
  );

  registry.register(
    'note:history',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }

      const note = getNoteById()(params.id);
      if (!note) {
        throw new NotFoundError('note', params.id);
      }

      // Do not expose version history for a locked note (see history:get).
      if (note.is_locked) {
        return { success: true, history: [] };
      }

      try {
        const { getNoteHistory } = require('../../shared/database/history');
        const limit = params.limit || 10;
        const history = getNoteHistory(params.id, limit);
        return { success: true, history };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Get version history for a note' }
  );

  registry.register(
    'note:bulkDelete',
    async (params) => {
      if (!params || !params.ids || !Array.isArray(params.ids) || params.ids.length === 0) {
        throw new ValidationError('Array of note IDs is required');
      }

      const permanent = params.permanent || false;
      const results = [];

      for (const id of params.ids) {
        try {
          const success = deleteNote()(id, permanent);
          results.push({ id, success });

          if (success && resolveWM()) {
            resolveWM().broadcast('note:deleted', id);
          }
        } catch (err) {
          results.push({ id, success: false, error: err.message });
        }
      }

      return { success: true, results };
    },
    { description: 'Delete multiple notes at once' }
  );

  registry.register(
    'note:bulkArchive',
    async (params) => {
      if (!params || !params.ids || !Array.isArray(params.ids) || params.ids.length === 0) {
        throw new ValidationError('Array of note IDs is required');
      }

      const results = [];

      for (const id of params.ids) {
        try {
          const note = archiveNote()(id);
          results.push({ id, success: !!note });

          if (note && resolveWM()) {
            resolveWM().broadcast('note:updated', note);
          }
        } catch (err) {
          results.push({ id, success: false, error: err.message });
        }
      }

      return { success: true, results };
    },
    { description: 'Archive multiple notes at once' }
  );

  registry.register(
    'note:permanentDelete',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }
      const success = permanentlyDeleteNote()(params.id);
      if (success && resolveWM()) {
        resolveWM().broadcast('note:deleted', params.id);
      }
      return { success };
    },
    { description: 'Permanently delete a note (irreversible)' }
  );

  registry.register(
    'note:trashStats',
    async () => {
      const trashed = getNotes()({ trashedOnly: true });
      return { count: trashed.length };
    },
    { description: 'Get trash statistics' }
  );

  registry.register(
    'note:purgeTrash',
    async () => {
      const trashed = getNotes()({ trashedOnly: true });
      let deleted = 0;
      for (const note of trashed) {
        permanentlyDeleteNote()(note.id);
        deleted++;
      }
      const orphanedTagsDeleted = cleanupOrphanedTags()();
      if (resolveWM()) {
        resolveWM().broadcast('notes:trashPurged', { count: deleted, orphanedTagsDeleted });
      }
      return { success: true, deleted, orphanedTagsDeleted };
    },
    { description: 'Permanently delete all trashed notes' }
  );

  registry.register(
    'note:verifyPassword',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }
      const note = getNoteById()(params.id);
      if (!note) {
        return { exists: false, requiresPassword: false, valid: false };
      }
      if (!note.password_hash) {
        return { exists: true, requiresPassword: false, valid: true };
      }
      const valid = verifyPasswordSync()(params.password || '', note.password_hash);
      return { exists: true, requiresPassword: true, valid };
    },
    { description: 'Verify a note password without unlocking' }
  );

  registry.register(
    'note:revert',
    async (params) => {
      if (!params || !params.id || !params.historyId) {
        throw new ValidationError('Note ID and history ID are required');
      }
      const entry = revertToVersion()(params.id, params.historyId);
      if (!entry) {
        throw new NotFoundError('history entry', params.historyId);
      }
      const note = getNoteById()(params.id);
      if (resolveWM()) {
        resolveWM().broadcast('note:updated', note);
      }
      return { success: true, note };
    },
    { description: 'Revert a note to a previous version' }
  );

  // ============================================================================
  // TAG OPERATIONS
  // ============================================================================

  registry.register(
    'tag:list',
    async (params) => {
      const options = params || {};
      return getTags()(options);
    },
    { description: 'List all tags' }
  );

  registry.register(
    'tag:add',
    async (params) => {
      if (!params || !params.noteId || !params.tagName) {
        throw new ValidationError('Note ID and tag name are required');
      }

      const success = addTagToNote()(params.noteId, params.tagName);
      return { success };
    },
    { description: 'Add a tag to a note' }
  );

  registry.register(
    'tag:remove',
    async (params) => {
      if (!params || !params.noteId || !params.tagName) {
        throw new ValidationError('Note ID and tag name are required');
      }

      const success = removeTagFromNote()(params.noteId, params.tagName);
      return { success };
    },
    { description: 'Remove a tag from a note' }
  );

  registry.register(
    'tag:getForNote',
    async (params) => {
      if (!params || !params.noteId) {
        throw new ValidationError('Note ID is required');
      }

      return getTagsForNote()(params.noteId);
    },
    { description: 'Get all tags for a note' }
  );

  registry.register(
    'tag:setForNote',
    async (params) => {
      if (!params || !params.noteId) {
        throw new ValidationError('Note ID is required');
      }

      const noteId = params.noteId;
      const tagNames = params.tagNames || [];

      // Validate note exists
      const note = getNoteById()(noteId);
      if (!note) {
        throw new NotFoundError('note', params.noteId);
      }

      const success = setNoteTags()(noteId, tagNames);
      const tags = getTagsForNote()(noteId);

      return { success, tags };
    },
    { description: 'Set all tags for a note (replaces existing)' }
  );

  registry.register(
    'tag:delete',
    async (params) => {
      const name = params && (params.name || params.tag);
      if (!name) {
        throw new ValidationError('Tag name is required');
      }
      const success = deleteTagByName()(name);
      return { success };
    },
    { description: 'Delete a tag globally by name' }
  );

  registry.register(
    'tag:rename',
    async (params) => {
      if (!params || !params.oldName || !params.newName) {
        throw new ValidationError('Old and new tag names are required');
      }
      const success = renameTag()(params.oldName, params.newName);
      return { success };
    },
    { description: 'Rename a tag globally' }
  );

  registry.register(
    'tag:getForNotes',
    async (params) => {
      if (!params || !Array.isArray(params.noteIds)) {
        throw new ValidationError('noteIds array is required');
      }
      return getTagsForNotes()(params.noteIds);
    },
    { description: 'Get tags for multiple notes' }
  );

  registry.register(
    'tag:cleanupOrphaned',
    async () => {
      const deleted = cleanupOrphanedTags()();
      return { success: true, deleted };
    },
    { description: 'Delete tags no longer attached to any note' }
  );

  // ============================================================================
  // FOLDER OPERATIONS
  // ============================================================================

  registry.register(
    'folder:list',
    async (params) => {
      const options = params || {};
      return getFolders()(options);
    },
    { description: 'List all folders' }
  );

  registry.register(
    'folder:create',
    async (params) => {
      if (!params || !params.name) {
        throw new ValidationError('Folder name is required');
      }

      try {
        const folder = createFolder()(params);
        return { success: true, folder };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Create a new folder' }
  );

  registry.register(
    'folder:update',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Folder ID is required');
      }

      const { id, ...data } = params;

      try {
        const folder = updateFolder()(id, data);

        if (!folder) {
          throw new NotFoundError('folder', id);
        }

        return { success: true, folder };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Update a folder' }
  );

  registry.register(
    'folder:delete',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Folder ID is required');
      }

      const force = params.force || false;

      try {
        const success = deleteFolder()(params.id, force);
        return { success };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Delete a folder' }
  );

  registry.register(
    'folder:tree',
    async () => {
      return getFolderTree()();
    },
    { description: 'Get the folder tree' }
  );

  registry.register(
    'folder:moveNote',
    async (params) => {
      if (!params || !params.noteId) {
        throw new ValidationError('Note ID is required');
      }

      const { noteId, folderId } = params;

      // Validate folder exists if folderId is provided (null is valid for "no folder")
      if (folderId !== null && folderId !== undefined) {
        const { getFolderById } = require('../../shared/database/folders');
        const folder = getFolderById(folderId);
        if (!folder) {
          throw new NotFoundError('folder', folderId);
        }
      }

      const success = moveNoteToFolder()(noteId, folderId);
      return { success };
    },
    { description: 'Move a note to a folder' }
  );

  // ============================================================================
  // LINK OPERATIONS
  // ============================================================================

  registry.register(
    'links:getOutgoing',
    async (params) => {
      if (!params || !params.noteId) {
        throw new ValidationError('Note ID is required');
      }
      return getOutgoingLinks()(params.noteId);
    },
    { description: 'Get outgoing [[wiki links]] for a note' }
  );

  registry.register(
    'links:getBacklinks',
    async (params) => {
      if (!params || !params.noteId) {
        throw new ValidationError('Note ID is required');
      }
      return getBacklinks()(params.noteId);
    },
    { description: 'Get notes that link to this note' }
  );

  registry.register(
    'links:createFromLink',
    async (params) => {
      if (!params || !params.title) {
        throw new ValidationError('Title is required');
      }
      const note = createNoteFromLink()(params.title, params.sourceNoteId || null);
      if (note && resolveWM()) {
        resolveWM().broadcast('note:created', note);
      }
      return { success: true, note };
    },
    { description: 'Create a note from an unresolved [[wiki link]]' }
  );

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  registry.register(
    'search:notes',
    async (params) => {
      if (!params || !params.query) {
        throw new ValidationError('Search query is required');
      }

      const { query, ...options } = params;
      return searchNotes()(query, options);
    },
    { description: 'Search notes by query' }
  );

  registry.register(
    'search:byTag',
    async (params) => {
      if (!params || !params.tagName) {
        throw new ValidationError('Tag name is required');
      }

      const { tagName, ...options } = params;
      return searchByTag()(tagName, options);
    },
    { description: 'Search notes by tag' }
  );

  // ============================================================================
  // CONFIG OPERATIONS
  // ============================================================================

  registry.register(
    'config:get',
    async (params) => {
      if (!params || !params.key) {
        throw new ValidationError('Config key is required');
      }

      try {
        const value = getSetting()(params.key);
        return { key: params.key, value };
      } catch (err) {
        throw new ConfigError(err.message);
      }
    },
    { description: 'Get a configuration value' }
  );

  registry.register(
    'config:set',
    async (params) => {
      if (!params || !params.key || params.value === undefined) {
        throw new ValidationError('Config key and value are required');
      }

      try {
        const success = setSetting()(params.key, params.value);
        return { success, key: params.key, value: params.value };
      } catch (err) {
        throw new ConfigError(err.message);
      }
    },
    { description: 'Set a configuration value' }
  );

  registry.register(
    'config:list',
    async (_params) => {
      try {
        const settings = getAllSettings()();
        return settings;
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'List all configuration values' }
  );

  registry.register(
    'config:getMultiple',
    async (params) => {
      if (!params || !Array.isArray(params.keys)) {
        throw new ValidationError('keys array is required');
      }
      const get = getSetting();
      const result = {};
      for (const key of params.keys) {
        result[key] = get(key);
      }
      return result;
    },
    { description: 'Get multiple configuration values at once' }
  );

  registry.register(
    'config:reset',
    async (params) => {
      if (!params || !params.key) {
        throw new ValidationError('Config key is required');
      }
      try {
        const value = resetSetting()(params.key);
        return { success: true, key: params.key, value };
      } catch (err) {
        throw new ConfigError(err.message);
      }
    },
    { description: 'Reset a configuration value to its default' }
  );

  registry.register(
    'config:defaultPaths',
    async () => {
      const paths = require('../../shared/utils/paths');
      return {
        data: paths.getDefaultDataPath(),
        attachments: paths.getAttachmentsPath(),
        backups: paths.getBackupsPath(),
      };
    },
    { description: 'Get the default data/attachments/backups paths' }
  );

  // ============================================================================
  // APP CONTROL OPERATIONS
  // ============================================================================

  registry.register(
    'app:show',
    async (_params) => {
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }

      resolveWM().showPanel();
      return { success: true };
    },
    { description: 'Show the main application window' }
  );

  registry.register(
    'app:hide',
    async (_params) => {
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }

      resolveWM().hidePanel();
      return { success: true };
    },
    { description: 'Hide the main application window' }
  );

  registry.register(
    'app:quit',
    async (_params) => {
      // Set global quit flag
      if (global.appState) {
        global.appState.isQuitting = true;
      }
      global.isQuitting = true;

      // Quit the app after a short delay to allow response to be sent
      setTimeout(() => {
        app.quit();
      }, 100);

      return { success: true };
    },
    { description: 'Quit the application' }
  );

  registry.register(
    'app:settings',
    async (_params) => {
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }

      if (typeof resolveWM().showSettings === 'function') {
        resolveWM().showSettings();
      } else {
        // Fallback: show panel and broadcast settings event
        resolveWM().showPanel();
        if (typeof resolveWM().broadcast === 'function') {
          resolveWM().broadcast('app:openSettings');
        }
      }

      return { success: true };
    },
    { description: 'Open settings window' }
  );

  registry.register(
    'app:panel',
    async (_params) => {
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }

      resolveWM().showPanel();
      return { success: true };
    },
    { description: 'Show the main panel window' }
  );

  registry.register(
    'app:openNote',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }
      resolveWM().openNote(params.id);
      return { success: true };
    },
    { description: 'Open a note window' }
  );

  registry.register(
    'app:closeNote',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Note ID is required');
      }
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }
      resolveWM().closeNote(params.id);
      return { success: true };
    },
    { description: 'Close a note window' }
  );

  registry.register(
    'app:showAll',
    async (_params) => {
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }
      resolveWM().showAllNotes();
      return { success: true };
    },
    { description: 'Show all note windows' }
  );

  registry.register(
    'app:hideAll',
    async (_params) => {
      if (!resolveWM()) {
        throw new ServiceUnavailableError('Window manager not available');
      }
      resolveWM().hideAllNotes();
      return { success: true };
    },
    { description: 'Hide all note windows' }
  );

  // ============================================================================
  // ATTACHMENT OPERATIONS
  // ============================================================================

  registry.register(
    'attachment:list',
    async (params) => {
      if (!params || !params.noteId) {
        throw new ValidationError('Note ID is required');
      }
      return getAttachmentsForNote()(params.noteId);
    },
    { description: 'List attachments for a note' }
  );

  registry.register(
    'attachment:add',
    async (params) => {
      if (!params || !params.noteId || !params.filePath) {
        throw new ValidationError('Note ID and file path are required');
      }
      try {
        const attachment = saveAttachment()(
          params.noteId,
          params.filePath,
          params.filename || null
        );
        return { success: true, attachment };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Add an attachment to a note from a file path' }
  );

  registry.register(
    'attachment:delete',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Attachment ID is required');
      }
      const success = deleteAttachment()(params.id);
      return { success };
    },
    { description: 'Delete an attachment' }
  );

  registry.register(
    'attachment:getPath',
    async (params) => {
      if (!params || !params.id) {
        throw new ValidationError('Attachment ID is required');
      }
      return { path: getAttachmentPath()(params.id) };
    },
    { description: 'Get the on-disk path of an attachment' }
  );

  // ============================================================================
  // CONFIG FILE OPERATIONS
  // ============================================================================

  registry.register(
    'config:edit',
    async (_params) => {
      const { shell } = require('electron');
      const { getConfigPath } = require('../../shared/config');

      try {
        const configPath = getConfigPath();

        if (!configPath) {
          throw new ConfigError('Config path not available. Config may not be initialized.');
        }

        // Check if file exists
        const fs = require('fs');
        if (!fs.existsSync(configPath)) {
          throw new ConfigError(`Config file not found: ${configPath}`);
        }

        // Open in default editor/viewer
        const result = await shell.openPath(configPath);

        if (result) {
          // Non-empty string indicates error
          throw new AppError(ERROR_CODES.INTERNAL_ERROR, `Failed to open config file: ${result}`);
        }

        return { success: true, path: configPath };
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        throw new AppError(
          ERROR_CODES.INTERNAL_ERROR,
          `Failed to open config file: ${err.message}`
        );
      }
    },
    { description: 'Open config.yaml in default editor' }
  );

  // ============================================================================
  // STATUS OPERATIONS
  // ============================================================================

  registry.register(
    'app:status',
    async (_params) => {
      const { getDatabase, getCurrentPath } = require('../../shared/database');
      const { getConfig } = require('../../shared/config');

      try {
        const db = getDatabase();
        const noteCount = db
          .prepare('SELECT COUNT(*) as count FROM notes WHERE is_deleted = 0')
          .get().count;
        const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get().count;
        const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders').get().count;

        // Get config validation status
        let configStatus = { valid: true, errors: [] };
        try {
          const config = getConfig();
          configStatus = config.validate();
        } catch (err) {
          configStatus = { valid: false, errors: [err.message] };
        }

        // Get config path
        let configPath = null;
        try {
          const config = getConfig();
          configPath = config.configPath;
        } catch (err) {
          // Config not initialized
        }

        // Get pipe server status
        let pipeStatus = { running: true, connections: 0 };
        if (resolveWM() && typeof resolveWM().getPipeServer === 'function') {
          const pipeServer = resolveWM().getPipeServer();
          if (pipeServer && typeof pipeServer.getStatus === 'function') {
            pipeStatus = pipeServer.getStatus();
            pipeStatus.running = true;
          }
        }

        return {
          running: true,
          version: app.getVersion(),
          uptime: process.uptime(),
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          memory: {
            heapUsed: process.memoryUsage().heapUsed,
            heapTotal: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external,
            rss: process.memoryUsage().rss,
          },
          database: {
            connected: true,
            path: getCurrentPath(),
            notes: noteCount,
            tags: tagCount,
            folders: folderCount,
          },
          config: {
            path: configPath,
            valid: configStatus.valid,
            errors: configStatus.errors,
          },
          pipeServer: pipeStatus,
          windows: {
            panel: resolveWM()?.panelWindow ? !resolveWM().panelWindow.isDestroyed() : false,
            notes: resolveWM()?.noteWindows?.size || 0,
          },
        };
      } catch (err) {
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, err.message);
      }
    },
    { description: 'Get application status and health check information' }
  );

  registry.register(
    'app:version',
    async (_params) => {
      return {
        version: app.getVersion(),
        name: app.getName(),
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
      };
    },
    { description: 'Get application version information' }
  );

  registry.register(
    'app:health',
    async (_params) => {
      // Lightweight health check (ping)
      try {
        const { getDatabase } = require('../../shared/database');
        const db = getDatabase();

        // Simple database ping
        db.prepare('SELECT 1').get();

        return {
          healthy: true,
          timestamp: Date.now(),
          uptime: process.uptime(),
        };
      } catch (err) {
        // Return unhealthy status instead of throwing
        return {
          healthy: false,
          timestamp: Date.now(),
          uptime: process.uptime(),
          error: err.message,
        };
      }
    },
    { description: 'Lightweight health check endpoint (ping)' }
  );

  return registry;
}

module.exports = {
  MethodRegistry,
  ValidationError,
  ERROR_CODES,
  createRegistry,
};
