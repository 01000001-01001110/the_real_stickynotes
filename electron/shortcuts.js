/**
 * Global keyboard shortcuts
 */
const { globalShortcut } = require('electron');
const { getSetting } = require('../shared/database/settings');
const { createNote } = require('../shared/database/notes');

let windowManager = null;

/**
 * Setup global keyboard shortcuts
 */
function setupShortcuts(wm) {
  windowManager = wm;
  registerShortcuts();

  // Subscribe to config changes for hot reload
  try {
    const { onConfigChange } = require('../shared/config');
    onConfigChange((changedKeys) => {
      if (changedKeys.some((k) => k.startsWith('shortcuts.'))) {
        console.log('[Shortcuts] Config changed, reloading shortcuts');
        registerShortcuts();
      }
    });
  } catch (error) {
    // Config system not available
  }
}

/**
 * Register all shortcuts
 */
function registerShortcuts() {
  // Unregister existing shortcuts first
  globalShortcut.unregisterAll();

  // New note shortcut
  const newNoteShortcut = getSetting('shortcuts.globalNewNote');
  if (newNoteShortcut) {
    try {
      globalShortcut.register(newNoteShortcut, () => {
        const note = createNote({});
        if (windowManager) {
          windowManager.openNote(note.id);
        }
      });
    } catch (err) {
      console.warn('Could not register new note shortcut:', err);
    }
  }

  // Toggle all notes shortcut
  const toggleShortcut = getSetting('shortcuts.globalToggle');
  if (toggleShortcut) {
    try {
      globalShortcut.register(toggleShortcut, () => {
        if (windowManager) {
          windowManager.toggleAllNotes();
        }
      });
    } catch (err) {
      console.warn('Could not register toggle shortcut:', err);
    }
  }

  // Show panel shortcut
  const panelShortcut = getSetting('shortcuts.globalPanel');
  if (panelShortcut) {
    try {
      globalShortcut.register(panelShortcut, () => {
        if (windowManager) {
          windowManager.togglePanel();
        }
      });
    } catch (err) {
      console.warn('Could not register panel shortcut:', err);
    }
  }
}

/**
 * Unregister all shortcuts
 */
function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

/**
 * Update shortcuts (call after settings change)
 */
function updateShortcuts() {
  registerShortcuts();
}

module.exports = {
  setupShortcuts,
  unregisterShortcuts,
  updateShortcuts,
};
