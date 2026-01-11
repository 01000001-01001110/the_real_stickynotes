/**
 * System Tray functionality
 */
const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const { getSetting } = require('../shared/database/settings');
const { createNote } = require('../shared/database/notes');

let tray = null;
let windowManager = null;

/**
 * Get the tray icon path
 */
function getTrayIconPath() {
  const iconName = process.platform === 'win32' ? 'tray.ico' : 'tray.png';
  return path.join(__dirname, '..', 'assets', 'icons', iconName);
}

/**
 * Build the tray context menu
 */
function buildContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'New Note',
      click: () => {
        const note = createNote({});
        if (windowManager) {
          windowManager.openNote(note.id);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Show Notes Panel',
      click: () => {
        if (windowManager) {
          windowManager.showPanel();
        }
      },
    },
    {
      label: 'Show All Notes',
      click: () => {
        if (windowManager) {
          windowManager.showAllNotes();
        }
      },
    },
    {
      label: 'Hide All Notes',
      click: () => {
        if (windowManager) {
          windowManager.hideAllNotes();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (windowManager) {
          windowManager.openSettings();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        if (global.appState) global.appState.isQuitting = true;
        global.isQuitting = true;
        app.quit();
      },
    },
  ]);
}

/**
 * Handle tray single click
 */
function handleClick() {
  const action = getSetting('tray.singleClickAction');
  executeAction(action);
}

/**
 * Handle tray double click
 */
function handleDoubleClick() {
  const action = getSetting('tray.doubleClickAction');
  executeAction(action);
}

/**
 * Execute a tray action
 */
function executeAction(action) {
  if (!windowManager) return;

  switch (action) {
    case 'showPanel':
      windowManager.showPanel();
      break;
    case 'toggleNotes':
      windowManager.toggleAllNotes();
      break;
    case 'newNote':
      const note = createNote({});
      windowManager.openNote(note.id);
      break;
    case 'nothing':
    default:
      break;
  }
}

/**
 * Setup the system tray
 */
function setupTray(wm) {
  windowManager = wm;

  // Create tray icon
  const iconPath = getTrayIconPath();
  let icon;
  
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      // Create a simple colored icon if file doesn't exist
      icon = nativeImage.createEmpty();
    }
  } catch (err) {
    console.warn('Could not load tray icon:', err);
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('StickyNotes');
  tray.setContextMenu(buildContextMenu());

  // Handle clicks
  tray.on('click', handleClick);
  tray.on('double-click', handleDoubleClick);
}

/**
 * Update the tray menu
 */
function updateTrayMenu() {
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }
}

/**
 * Set tray icon badge (for reminders)
 */
function setTrayBadge(count) {
  if (tray && process.platform === 'darwin') {
    app.dock.setBadge(count > 0 ? String(count) : '');
  }
}

/**
 * Destroy the tray
 */
function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  setupTray,
  updateTrayMenu,
  setTrayBadge,
  destroyTray,
};
