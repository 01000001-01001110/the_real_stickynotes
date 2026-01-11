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

  // Whisper/Transcription (Legacy API - maintained for compatibility)
  whisperGetModelStatus: () => ipcRenderer.invoke('whisper:getModelStatus'),
  whisperDownloadModel: (size) => ipcRenderer.invoke('whisper:downloadModel', size),
  whisperDeleteModel: () => ipcRenderer.invoke('whisper:deleteModel'),
  whisperLoadModel: (size) => ipcRenderer.invoke('whisper:loadModel', size),
  whisperTranscribe: (audioData) => ipcRenderer.invoke('whisper:transcribe', audioData),
  whisperIsAvailable: () => ipcRenderer.invoke('whisper:isAvailable'),
  whisperGetServiceStatus: () => ipcRenderer.invoke('whisper:getServiceStatus'),
  whisperListModels: () => ipcRenderer.invoke('whisper:listModels'),
  onWhisperDownloadProgress: (callback) => {
    const handler = (event, progress) => callback(progress);
    ipcRenderer.on('whisper:downloadProgress', handler);
    return () => ipcRenderer.removeListener('whisper:downloadProgress', handler);
  },
  onWhisperError: (callback) => {
    const handler = (event, error) => callback(error);
    ipcRenderer.on('whisper:error', handler);
    return () => ipcRenderer.removeListener('whisper:error', handler);
  },

  // Whisper/Transcription (New Sherpa-ONNX API)
  whisperInstallModel: (modelSize) => ipcRenderer.invoke('whisper:installModel', modelSize),
  whisperUninstallModel: (modelSize) => ipcRenderer.invoke('whisper:uninstallModel', modelSize),
  whisperGetInstallStatus: () => ipcRenderer.invoke('whisper:getInstallStatus'),
  whisperGetAvailableModels: () => ipcRenderer.invoke('whisper:getAvailableModels'),
  whisperVerifyModel: (modelSize) => ipcRenderer.invoke('whisper:verifyModel', modelSize),
  onWhisperInstallProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('whisper:installProgress', handler);
    return () => ipcRenderer.removeListener('whisper:installProgress', handler);
  },
  onWhisperInstallError: (callback) => {
    const handler = (event, error) => callback(error);
    ipcRenderer.on('whisper:installError', handler);
    return () => ipcRenderer.removeListener('whisper:installError', handler);
  },

  // Events from main process
  onNoteUpdated: (callback) => {
    ipcRenderer.on('note:updated', (event, note) => callback(note));
    return () => ipcRenderer.removeListener('note:updated', callback);
  },
  onNoteDeleted: (callback) => {
    ipcRenderer.on('note:deleted', (event, noteId) => callback(noteId));
    return () => ipcRenderer.removeListener('note:deleted', callback);
  },
  onNoteCreated: (callback) => {
    ipcRenderer.on('note:created', (event, note) => callback(note));
    return () => ipcRenderer.removeListener('note:created', callback);
  },
  onSettingChanged: (callback) => {
    ipcRenderer.on('setting:changed', (event, key, value) => callback(key, value));
    return () => ipcRenderer.removeListener('setting:changed', callback);
  },
  onReminderTriggered: (callback) => {
    ipcRenderer.on('reminder:triggered', (event, note) => callback(note));
    return () => ipcRenderer.removeListener('reminder:triggered', callback);
  },
  onThemeChanged: (callback) => {
    ipcRenderer.on('theme:changed', (event, theme) => callback(theme));
    return () => ipcRenderer.removeListener('theme:changed', callback);
  },

  // Get current window's note ID (for note windows)
  getCurrentNoteId: () => ipcRenderer.invoke('window:getCurrentNoteId'),
});
