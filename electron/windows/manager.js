/**
 * Window Manager - handles all application windows
 */
const { app, BrowserWindow, screen, Menu, shell } = require('electron');
const path = require('path');
const { getNotes, getNoteById, updateNote } = require('../../shared/database/notes');
const { getSetting } = require('../../shared/database/settings');

const isDev = process.argv.includes('--dev');

/**
 * Get the correct icon path for both development and packaged apps.
 * Windows cannot read icons from inside asar archives, so icons must be unpacked.
 * @returns {string} Path to the application icon
 */
function getIconPath() {
  const iconFile = process.platform === 'win32' ? 'icons/win/icon.ico' : 'icons/mac/icon.icns';

  if (app.isPackaged) {
    // In packaged app, icons are in app.asar.unpacked (due to asarUnpack config)
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icons', iconFile);
  } else {
    // In development, use relative path from this file
    return path.join(__dirname, '..', '..', 'assets', 'icons', iconFile);
  }
}

/**
 * Create a debounced version of a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

class WindowManager {
  constructor() {
    this.panelWindow = null;
    this.noteWindows = new Map(); // noteId -> BrowserWindow
    this.settingsWindow = null;
    this.imageViewerWindows = new Map(); // unique id -> { window, imageData }
    this.cascadeOffset = 0;
    this.positionSaveDebounced = new Map(); // noteId -> debounced save function
    this.sizeSaveDebounced = new Map(); // noteId -> debounced save function
    this.imageViewerCounter = 0; // Counter to ensure unique IDs

    // Subscribe to config changes for hot reload
    this.setupConfigWatcher();
  }

  /**
   * Setup configuration change watcher
   */
  setupConfigWatcher() {
    try {
      const { onConfigChange } = require('../../shared/config');
      onConfigChange((changedKeys) => {
        // Check for appearance changes that affect existing windows
        if (
          changedKeys.some(
            (k) =>
              k.startsWith('appearance.') || k.startsWith('newNote.') || k.startsWith('general.')
          )
        ) {
          if (isDev)
            console.log('[WindowManager] Config changed, settings will apply to new windows');
          // Settings are read when creating windows, so no action needed
          // Existing windows keep their current appearance
        }
      });
    } catch (error) {
      // Config system not available
    }
  }

  /**
   * Get or create a debounced position save function for a note
   */
  getPositionSaver(noteId) {
    if (!this.positionSaveDebounced.has(noteId)) {
      this.positionSaveDebounced.set(
        noteId,
        debounce((x, y) => {
          updateNote(noteId, { position_x: x, position_y: y });
        }, 500)
      );
    }
    return this.positionSaveDebounced.get(noteId);
  }

  /**
   * Get or create a debounced size save function for a note
   */
  getSizeSaver(noteId) {
    if (!this.sizeSaveDebounced.has(noteId)) {
      this.sizeSaveDebounced.set(
        noteId,
        debounce((w, h) => {
          updateNote(noteId, { width: w, height: h });
        }, 500)
      );
    }
    return this.sizeSaveDebounced.get(noteId);
  }

  getPreloadPath() {
    return path.join(__dirname, '..', 'preload.js');
  }

  /**
   * Attach navigation handler to a window to open links externally
   */
  attachNavigationHandler(window) {
    // Helper: only open http/https URLs externally, block everything else
    const openExternalSafe = (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url);
        } else {
          console.warn('[Navigation] Blocked non-http(s) URL:', parsed.protocol);
        }
      } catch {
        console.warn('[Navigation] Blocked invalid URL');
      }
    };

    // Prevent navigation to external URLs - open in default browser instead
    window.webContents.on('will-navigate', (event, url) => {
      // Allow internal navigation (e.g. reloading index.html)
      if (url.startsWith('file://')) {
        if (isDev) console.log('[Navigation] Allowing file:// navigation:', url);
        return;
      }

      if (isDev) console.log('[Navigation] Preventing navigation to:', url);
      if (isDev) console.log('[Navigation] Opening in external browser instead');
      event.preventDefault();
      openExternalSafe(url);
    });

    // Handle window.open() and target="_blank" links
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isDev) console.log('[Navigation] window.open() or target="_blank" detected:', url);
      if (url.startsWith('file://')) {
        return { action: 'allow' };
      }
      if (isDev) console.log('[Navigation] Opening in external browser instead');
      openExternalSafe(url);
      return { action: 'deny' };
    });

    // Additional safety: prevent all navigation attempts via webContents.loadURL
    const originalLoadURL = window.webContents.loadURL.bind(window.webContents);
    window.webContents.loadURL = function (url, options) {
      if (!url.startsWith('file://')) {
        if (isDev) console.warn('[Navigation] Prevented loadURL to external URL:', url);
        openExternalSafe(url);
        return Promise.resolve();
      }
      return originalLoadURL(url, options);
    };

    // Final safety net: catch any navigation that got through
    window.webContents.on('did-navigate', (event, url) => {
      if (!url.startsWith('file://')) {
        console.error('[Navigation] UNEXPECTED: Window navigated to external URL:', url);
        console.error('[Navigation] This should have been prevented. Please report this bug.');
        console.error('[Navigation] Attempting to navigate back...');
        // Try to go back
        if (window.webContents.canGoBack()) {
          window.webContents.goBack();
        }
      }
    });
  }

  /**
   * Create and show the main panel window
   */
  showPanel() {
    try {
      if (this.panelWindow && !this.panelWindow.isDestroyed()) {
        this.panelWindow.show();
        this.panelWindow.focus();
        return this.panelWindow;
      }

      if (isDev) console.log('Creating panel window...');
      const preloadPath = this.getPreloadPath();
      if (isDev) console.log('Preload path:', preloadPath);

      const htmlPath = path.join(__dirname, '..', '..', 'src', 'panel', 'index.html');
      if (isDev) console.log('HTML path:', htmlPath);

      this.panelWindow = new BrowserWindow({
        width: 400,
        height: 600,
        minWidth: 300,
        minHeight: 400,
        frame: false,
        show: true,
        titleBarStyle: 'hidden',
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          devTools: process.argv.includes('--dev'),
        },
        icon: getIconPath(),
      });

      this.panelWindow.loadFile(htmlPath);
      if (isDev) console.log('Panel HTML loaded');

      this.panelWindow.once('ready-to-show', () => {
        if (isDev) console.log('Panel ready to show');
        this.panelWindow.show();
      });

      this.attachNavigationHandler(this.panelWindow);

      this.panelWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
        console.error('Panel failed to load:', errorCode, errorDesc);
      });

      this.panelWindow.on('close', (event) => {
        const closeToTray = getSetting('general.closeToTray');
        const isQuitting = global.appState?.isQuitting || global.isQuitting;
        if (closeToTray && !isQuitting) {
          event.preventDefault();
          this.panelWindow.hide();
        }
      });

      this.panelWindow.on('closed', () => {
        this.panelWindow = null;
      });

      return this.panelWindow;
    } catch (error) {
      console.error('Failed to create panel:', error);
      return null;
    }
  }

  /**
   * Hide the panel window
   */
  hidePanel() {
    if (this.panelWindow && !this.panelWindow.isDestroyed()) {
      this.panelWindow.hide();
    }
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    if (this.panelWindow && !this.panelWindow.isDestroyed() && this.panelWindow.isVisible()) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  /**
   * Check if a position is visible on any available display
   */
  isPositionOnScreen(x, y, width, height) {
    const displays = screen.getAllDisplays();
    // Check if at least part of the window is visible on any display
    for (const display of displays) {
      const bounds = display.workArea;
      const visibleX = x < bounds.x + bounds.width && x + width > bounds.x;
      const visibleY = y < bounds.y + bounds.height && y + height > bounds.y;
      if (visibleX && visibleY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate position for a new note window
   */
  calculateNotePosition(note) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const defaultWidth = getSetting('appearance.defaultNoteWidth');
    const defaultHeight = getSetting('appearance.defaultNoteHeight');
    const position = getSetting('newNote.position');

    // If note has saved position, validate it's on-screen
    if (note.position_x !== null && note.position_y !== null) {
      const width = note.width || defaultWidth;
      const height = note.height || defaultHeight;

      // Check if position is visible on any display
      if (this.isPositionOnScreen(note.position_x, note.position_y, width, height)) {
        return {
          x: note.position_x,
          y: note.position_y,
          width,
          height,
        };
      }
      // Position is off-screen (e.g., monitor disconnected), fall through to recalculate
    }

    let x, y;
    const width = note.width || defaultWidth;
    const height = note.height || defaultHeight;

    switch (position) {
      case 'center':
        x = Math.floor((screenWidth - width) / 2);
        y = Math.floor((screenHeight - height) / 2);
        break;
      case 'random':
        x = Math.floor(Math.random() * (screenWidth - width - 100)) + 50;
        y = Math.floor(Math.random() * (screenHeight - height - 100)) + 50;
        break;
      case 'cascade':
      default: {
        const offset = getSetting('newNote.cascadeOffset');
        x = 100 + this.cascadeOffset * offset;
        y = 100 + this.cascadeOffset * offset;
        this.cascadeOffset = (this.cascadeOffset + 1) % 10;

        // Keep on screen
        if (x + width > screenWidth) x = 100;
        if (y + height > screenHeight) y = 100;
        break;
      }
    }

    return { x, y, width, height };
  }

  /**
   * Open a note in its own window
   */
  openNote(noteId) {
    // Check if window already exists
    if (this.noteWindows.has(noteId)) {
      const existingWindow = this.noteWindows.get(noteId);
      if (!existingWindow.isDestroyed()) {
        existingWindow.show();
        existingWindow.focus();
        return existingWindow;
      }
      this.noteWindows.delete(noteId);
    }

    const note = getNoteById(noteId);
    if (!note) {
      console.error(`[WindowManager] Note ${noteId} not found in database`);
      return null;
    }

    const { x, y, width, height } = this.calculateNotePosition(note);
    const opacity = (note.opacity ?? getSetting('appearance.noteOpacity')) / 100;
    const enableShadows = getSetting('appearance.enableShadows') !== false;

    const noteWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      minWidth: 200,
      minHeight: 150,
      frame: false,
      titleBarStyle: 'hidden',
      transparent: false,
      alwaysOnTop: note.is_pinned === 1,
      opacity,
      show: false,
      hasShadow: enableShadows,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true,
        devTools: process.argv.includes('--dev'),
      },
      icon: getIconPath(),
    });

    // Store note ID in window for retrieval
    noteWindow.noteId = noteId;

    // Open DevTools in development mode for debugging
    if (process.argv.includes('--dev')) {
      noteWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Setup spellcheck context menu
    noteWindow.webContents.on('context-menu', (event, params) => {
      const menuItems = [];

      // Add spelling suggestions if there's a misspelled word
      if (params.misspelledWord) {
        if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
          params.dictionarySuggestions.forEach((suggestion) => {
            menuItems.push({
              label: suggestion,
              click: () => noteWindow.webContents.replaceMisspelling(suggestion),
            });
          });
          menuItems.push({ type: 'separator' });
        }

        menuItems.push({
          label: 'Add to Dictionary',
          click: () =>
            noteWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        });
        menuItems.push({ type: 'separator' });
      }

      // Standard edit menu items
      if (params.isEditable) {
        menuItems.push(
          { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
          { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
          { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
          { type: 'separator' },
          { label: 'Select All', role: 'selectAll' }
        );
      } else if (params.selectionText) {
        menuItems.push({ label: 'Copy', role: 'copy' });
      }

      // Only show menu if there are items
      if (menuItems.length > 0) {
        const menu = Menu.buildFromTemplate(menuItems);
        menu.popup({ window: noteWindow });
      }
    });

    noteWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'note', 'index.html'));

    noteWindow.once('ready-to-show', () => {
      noteWindow.show();
      noteWindow.focus();
      updateNote(noteId, { is_open: 1 });
    });

    // Add error handler for debugging
    noteWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
      console.error(`[WindowManager] Note window ${noteId} failed to load:`, errorCode, errorDesc);
    });

    // Save position on move (debounced to avoid flooding database)
    const savePosition = this.getPositionSaver(noteId);
    noteWindow.on('move', () => {
      if (!noteWindow.isDestroyed()) {
        const [posX, posY] = noteWindow.getPosition();
        savePosition(posX, posY);
      }
    });

    // Save size on resize (debounced to avoid flooding database)
    const saveSize = this.getSizeSaver(noteId);
    noteWindow.on('resize', () => {
      if (!noteWindow.isDestroyed()) {
        const [w, h] = noteWindow.getSize();
        saveSize(w, h);
      }
    });

    noteWindow.on('closed', () => {
      this.noteWindows.delete(noteId);
      // Clean up debounced functions
      this.positionSaveDebounced.delete(noteId);
      this.sizeSaveDebounced.delete(noteId);
      // Mark note as closed
      updateNote(noteId, { is_open: 0 });
    });

    this.noteWindows.set(noteId, noteWindow);
    this.attachNavigationHandler(noteWindow);
    return noteWindow;
  }

  /**
   * Close a note window
   */
  closeNote(noteId) {
    const window = this.noteWindows.get(noteId);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  /**
   * Get a note window
   */
  getNoteWindow(noteId) {
    return this.noteWindows.get(noteId);
  }

  /**
   * Show all note windows
   */
  showAllNotes() {
    for (const window of this.noteWindows.values()) {
      if (!window.isDestroyed()) {
        window.show();
      }
    }
  }

  /**
   * Hide all note windows
   */
  hideAllNotes() {
    for (const window of this.noteWindows.values()) {
      if (!window.isDestroyed()) {
        window.hide();
      }
    }
  }

  /**
   * Toggle all notes visibility
   */
  toggleAllNotes() {
    let anyVisible = false;
    for (const window of this.noteWindows.values()) {
      if (!window.isDestroyed() && window.isVisible()) {
        anyVisible = true;
        break;
      }
    }

    if (anyVisible) {
      this.hideAllNotes();
    } else {
      this.showAllNotes();
    }
  }

  /**
   * Restore previously open notes
   */
  restoreOpenNotes() {
    const openNotes = getNotes({ openOnly: true });
    for (const note of openNotes) {
      this.openNote(note.id);
    }
  }

  /**
   * Save all window states before quit
   */
  saveAllWindowStates() {
    // Note windows auto-save their position on move/resize
    // This is just a final sync if needed
  }

  /**
   * Open settings window
   */
  openSettings() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 900,
      height: 1100,
      minWidth: 600,
      minHeight: 500,
      frame: false,
      show: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
      icon: getIconPath(),
    });

    this.settingsWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'settings', 'index.html'));

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow.show();
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    this.attachNavigationHandler(this.settingsWindow);

    return this.settingsWindow;
  }

  /**
   * Open image viewer window
   * @param {string} imageData - Base64 image data or URL
   * @returns {BrowserWindow}
   */
  openImageViewer(imageData) {
    // Use counter + timestamp to ensure uniqueness even in same millisecond
    this.imageViewerCounter++;
    const viewerId = `${Date.now()}-${this.imageViewerCounter}`;

    const imageWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 500,
      minHeight: 400,
      frame: false,
      show: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
      icon: getIconPath(),
    });

    // Store image data for retrieval by the window
    this.imageViewerWindows.set(viewerId, { window: imageWindow, imageData });
    imageWindow.viewerId = viewerId;

    imageWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'imageviewer', 'index.html'));

    imageWindow.once('ready-to-show', () => {
      imageWindow.show();
    });

    imageWindow.on('closed', () => {
      this.imageViewerWindows.delete(viewerId);
    });

    this.attachNavigationHandler(imageWindow);

    return imageWindow;
  }

  /**
   * Get image data for a viewer window
   * @param {string} viewerId
   * @returns {string|null}
   */
  getImageData(viewerId) {
    const viewer = this.imageViewerWindows.get(viewerId);
    return viewer ? viewer.imageData : null;
  }

  /**
   * Broadcast event to all windows
   */
  broadcast(channel, ...args) {
    if (this.panelWindow && !this.panelWindow.isDestroyed()) {
      this.panelWindow.webContents.send(channel, ...args);
    }
    for (const window of this.noteWindows.values()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, ...args);
      }
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.webContents.send(channel, ...args);
    }
  }

  /**
   * Get all windows count
   */
  getWindowCount() {
    let count = 0;
    if (this.panelWindow && !this.panelWindow.isDestroyed()) count++;
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) count++;
    count += this.noteWindows.size;
    return count;
  }
}

module.exports = { WindowManager };
