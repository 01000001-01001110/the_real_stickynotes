/**
 * Preload script - exposes safe IPC methods to renderer
 */
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Notes
  getNotes: (options) => ipcRenderer.invoke('notes:getAll', options),
  getNote: (id) => ipcRenderer.invoke('notes:get', id),
  createNote: (data) => ipcRenderer.invoke('notes:create', data),
  updateNote: (id, data) => ipcRenderer.invoke('notes:update', id, data),
  deleteNote: (id) => ipcRenderer.invoke('notes:delete', id),
  permanentlyDeleteNote: (id) => ipcRenderer.invoke('notes:permanentDelete', id),
  restoreNote: (id) => ipcRenderer.invoke('notes:restore', id),
  archiveNote: (id) => ipcRenderer.invoke('notes:archive', id),
  unarchiveNote: (id) => ipcRenderer.invoke('notes:unarchive', id),
  duplicateNote: (id) => ipcRenderer.invoke('notes:duplicate', id),
  getTrashStats: () => ipcRenderer.invoke('notes:trashStats'),
  purgeTrash: () => ipcRenderer.invoke('notes:purgeTrash'),

  // Tags
  getTags: (options) => ipcRenderer.invoke('tags:getAll', options),
  getTagsForNote: (noteId) => ipcRenderer.invoke('tags:getForNote', noteId),
  getTagsForNotes: (noteIds) => ipcRenderer.invoke('tags:getForNotes', noteIds),
  addTagToNote: (noteId, tagName) => ipcRenderer.invoke('tags:addToNote', noteId, tagName),
  removeTagFromNote: (noteId, tagName) =>
    ipcRenderer.invoke('tags:removeFromNote', noteId, tagName),
  setNoteTags: (noteId, tagNames) => ipcRenderer.invoke('tags:setForNote', noteId, tagNames),
  deleteTag: (name) => ipcRenderer.invoke('tags:delete', name),
  renameTag: (oldName, newName) => ipcRenderer.invoke('tags:rename', oldName, newName),
  cleanupOrphanedTags: () => ipcRenderer.invoke('tags:cleanupOrphaned'),

  // Folders
  getFolders: (options) => ipcRenderer.invoke('folders:getAll', options),
  getFolderTree: () => ipcRenderer.invoke('folders:getTree'),
  createFolder: (data) => ipcRenderer.invoke('folders:create', data),
  updateFolder: (id, data) => ipcRenderer.invoke('folders:update', id, data),
  deleteFolder: (id, force) => ipcRenderer.invoke('folders:delete', id, force),
  moveNoteToFolder: (noteId, folderId) => ipcRenderer.invoke('folders:moveNote', noteId, folderId),

  // Search
  searchNotes: (query, options) => ipcRenderer.invoke('search:notes', query, options),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  getSettings: (keys) => ipcRenderer.invoke('settings:getMultiple', keys),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  resetSetting: (key) => ipcRenderer.invoke('settings:reset', key),
  getDefaultPaths: () => ipcRenderer.invoke('settings:getDefaultPaths'),
  settingRequiresRestart: (key) => ipcRenderer.invoke('settings:requiresRestart', key),

  // Storage Location (Cloud Storage Path)
  storageGetCurrentPath: () => ipcRenderer.invoke('storage:getCurrentPath'),
  storageSelectFolder: () => ipcRenderer.invoke('storage:selectFolder'),
  storageGetMigrationInfo: (targetPath) =>
    ipcRenderer.invoke('storage:getMigrationInfo', targetPath),
  storageMigrateData: (targetPath, options) =>
    ipcRenderer.invoke('storage:migrateData', targetPath, options),
  storageResetToDefault: () => ipcRenderer.invoke('storage:resetToDefault'),
  storageRestartApp: () => ipcRenderer.invoke('storage:restartApp'),
  onStorageMigrationProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('storage:migrationProgress', handler);
    return () => ipcRenderer.removeListener('storage:migrationProgress', handler);
  },

  // Attachments
  getAttachments: (noteId) => ipcRenderer.invoke('attachments:getForNote', noteId),
  addAttachment: (noteId, filePath) => ipcRenderer.invoke('attachments:add', noteId, filePath),
  deleteAttachment: (id) => ipcRenderer.invoke('attachments:delete', id),
  getAttachmentPath: (id) => ipcRenderer.invoke('attachments:getPath', id),

  // History
  getNoteHistory: (noteId) => ipcRenderer.invoke('history:get', noteId),
  revertToVersion: (noteId, historyId) => ipcRenderer.invoke('history:revert', noteId, historyId),

  // Links
  getOutgoingLinks: (noteId) => ipcRenderer.invoke('links:getOutgoing', noteId),
  getBacklinks: (noteId) => ipcRenderer.invoke('links:getBacklinks', noteId),
  renderLinks: (content) => ipcRenderer.invoke('links:render', content),
  createNoteFromLink: (title, sourceNoteId) =>
    ipcRenderer.invoke('links:createFromLink', title, sourceNoteId),

  // Windows
  openNote: (noteId) => ipcRenderer.invoke('windows:openNote', noteId),
  closeNote: (noteId) => ipcRenderer.invoke('windows:closeNote', noteId),
  showPanel: () => ipcRenderer.invoke('windows:showPanel'),
  hidePanel: () => ipcRenderer.invoke('windows:hidePanel'),
  showAllNotes: () => ipcRenderer.invoke('windows:showAll'),
  hideAllNotes: () => ipcRenderer.invoke('windows:hideAll'),
  openSettings: () => ipcRenderer.invoke('windows:openSettings'),
  openImageViewer: (imageData) => ipcRenderer.invoke('windows:openImageViewer', imageData),
  getImageData: () => ipcRenderer.invoke('windows:getImageData'),
  saveImage: (dataUrl) => ipcRenderer.invoke('windows:saveImage', dataUrl),

  // Window control (for frameless windows)
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:setAlwaysOnTop', value),
  setWindowOpacity: (value) => ipcRenderer.invoke('window:setOpacity', value),

  // App
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpen', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options),

  // Reminders
  setReminder: (noteId, datetime) => ipcRenderer.invoke('reminders:set', noteId, datetime),
  clearReminder: (noteId) => ipcRenderer.invoke('reminders:clear', noteId),
  snoozeReminder: (noteId, minutes) => ipcRenderer.invoke('reminders:snooze', noteId, minutes),

  // Note password
  lockNote: (noteId, password) => ipcRenderer.invoke('notes:lock', noteId, password),
  unlockNote: (noteId, password) => ipcRenderer.invoke('notes:unlock', noteId, password),
  verifyNotePassword: (noteId, password) =>
    ipcRenderer.invoke('notes:verifyPassword', noteId, password),

  // Events from main process
  // Note: Store handler reference to properly unsubscribe (arrow function !== callback)
  onNoteUpdated: (callback) => {
    const handler = (event, note) => callback(note);
    ipcRenderer.on('note:updated', handler);
    return () => ipcRenderer.removeListener('note:updated', handler);
  },
  onNoteDeleted: (callback) => {
    const handler = (event, noteId) => callback(noteId);
    ipcRenderer.on('note:deleted', handler);
    return () => ipcRenderer.removeListener('note:deleted', handler);
  },
  onNoteCreated: (callback) => {
    const handler = (event, note) => callback(note);
    ipcRenderer.on('note:created', handler);
    return () => ipcRenderer.removeListener('note:created', handler);
  },
  onSettingChanged: (callback) => {
    const handler = (event, key, value) => callback(key, value);
    ipcRenderer.on('setting:changed', handler);
    return () => ipcRenderer.removeListener('setting:changed', handler);
  },
  onReminderTriggered: (callback) => {
    const handler = (event, note) => callback(note);
    ipcRenderer.on('reminder:triggered', handler);
    return () => ipcRenderer.removeListener('reminder:triggered', handler);
  },
  onThemeChanged: (callback) => {
    const handler = (event, theme) => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => ipcRenderer.removeListener('theme:changed', handler);
  },

  // Get current window's note ID (for note windows)
  getCurrentNoteId: () => ipcRenderer.invoke('window:getCurrentNoteId'),
});
