/**
 * Settings Window Script
 */

// Setting element IDs mapped to setting keys
const settingMappings = {
  // General
  startOnBoot: 'general.startOnBoot',
  startMinimized: 'general.startMinimized',
  minimizeToTray: 'general.minimizeToTray',
  closeToTray: 'general.closeToTray',
  enableCLI: 'general.enableCLI',
  confirmDelete: 'general.confirmDelete',
  confirmPermanentDelete: 'general.confirmPermanentDelete',
  autoSaveDelay: 'general.autoSaveDelay',
  trashRetentionDays: 'general.trashRetentionDays',

  // Appearance
  theme: 'appearance.theme',
  defaultNoteColor: 'appearance.defaultNoteColor',
  defaultNoteWidth: 'appearance.defaultNoteWidth',
  defaultNoteHeight: 'appearance.defaultNoteHeight',
  defaultFontFamily: 'appearance.defaultFontFamily',
  noteOpacity: 'appearance.noteOpacity',
  enableShadows: 'appearance.enableShadows',
  enableAnimations: 'appearance.enableAnimations',
  showNoteCount: 'appearance.showNoteCount',

  // New Note
  newNotePosition: 'newNote.position',
  cascadeOffset: 'newNote.cascadeOffset',

  // Tray
  traySingleClickAction: 'tray.singleClickAction',
  trayDoubleClickAction: 'tray.doubleClickAction',

  // Shortcuts
  globalNewNote: 'shortcuts.globalNewNote',
  globalToggle: 'shortcuts.globalToggle',
  globalPanel: 'shortcuts.globalPanel',

  // Editor
  spellcheck: 'editor.spellcheck',
  autoLinks: 'editor.autoLinks',
  autoLists: 'editor.autoLists',
  defaultFontSize: 'appearance.defaultFontSize',
  tabSize: 'editor.tabSize',
  showWordCount: 'editor.showWordCount',

  // Reminders
  remindersEnabled: 'reminders.enabled',
  remindersSound: 'reminders.sound',
  snoozeMinutes: 'reminders.snoozeMinutes',
  persistUntilDismissed: 'reminders.persistUntilDismissed',

  // History
  maxVersions: 'history.maxVersions',
  saveInterval: 'history.saveInterval',

  // Advanced
  hardwareAcceleration: 'advanced.hardwareAcceleration',
  devTools: 'advanced.devTools',
};

/**
 * Apply theme to document
 */
async function applyTheme(theme = null) {
  if (!theme) {
    theme = await api.getSetting('appearance.theme');
  }

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme || 'light');
  }
}

/**
 * Initialize settings page
 */
async function init() {
  // Apply theme first
  await applyTheme();

  // Setup window controls
  document.getElementById('minimizeBtn')?.addEventListener('click', () => {
    api.minimizeWindow();
  });

  document.getElementById('closeBtn')?.addEventListener('click', () => {
    api.closeWindow();
  });

  await loadSettings();
  setupNavigation();
  setupEventListeners();
  setupStorageSettings();

  // Listen for theme changes (including from this window)
  api.onSettingChanged((key, value) => {
    if (key === 'appearance.theme') {
      applyTheme(value);
    }
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const theme = await api.getSetting('appearance.theme');
    if (theme === 'system') {
      applyTheme('system');
    }
  });

  // Set version
  const version = await api.getAppVersion();
  document.getElementById('aboutVersion').textContent = `Version ${version}`;

  // Setup restart notification buttons
  const restartBtn = document.getElementById('restartButton');
  const dismissBtn = document.getElementById('dismissRestartBtn');

  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      api.restartApp();
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      const notification = document.getElementById('restartNotification');
      if (notification) {
        notification.style.display = 'none';
      }
    });
  }

  // Setup trash stats and purge
  await loadTrashStats();
  const purgeBtn = document.getElementById('purgeTrashBtn');
  if (purgeBtn) {
    purgeBtn.addEventListener('click', async () => {
      if (
        confirm(
          'Are you sure you want to permanently delete all notes in trash? This cannot be undone.'
        )
      ) {
        await api.purgeTrash();
        await loadTrashStats();
      }
    });
  }
}

/**
 * Load and display trash statistics
 */
async function loadTrashStats() {
  const trashStats = document.getElementById('trashStats');
  const purgeBtn = document.getElementById('purgeTrashBtn');
  if (!trashStats) return;

  try {
    const stats = await api.getTrashStats();
    if (stats.count === 0) {
      trashStats.textContent = 'Trash is empty';
      if (purgeBtn) purgeBtn.disabled = true;
    } else {
      trashStats.textContent = `${stats.count} note${stats.count !== 1 ? 's' : ''} in trash`;
      if (purgeBtn) purgeBtn.disabled = false;
    }
  } catch (error) {
    trashStats.textContent = 'Unable to load trash stats';
    if (purgeBtn) purgeBtn.disabled = true;
  }
}

/**
 * Update font selector to show selected font in its own typeface
 */
function updateFontSelectorPreview() {
  const fontSelect = document.getElementById('defaultFontFamily');
  if (fontSelect && fontSelect.value) {
    fontSelect.style.fontFamily = fontSelect.value;
  }
}

/**
 * Load all settings
 */
async function loadSettings() {
  const settings = await api.getAllSettings();

  for (const [elementId, settingKey] of Object.entries(settingMappings)) {
    const element = document.getElementById(elementId);
    if (!element) continue;

    let value = settings[settingKey];

    // Special handling for saveInterval (stored in ms, display in minutes)
    if (settingKey === 'history.saveInterval') {
      value = Math.round(value / 60000); // ms to minutes
    }

    if (element.type === 'checkbox') {
      element.checked = value;
    } else if (element.type === 'range') {
      element.value = value;
      updateRangeValue(element);
    } else {
      element.value = value ?? '';
    }
  }

  // Update font selector to show in selected font
  updateFontSelectorPreview();
}

/**
 * Setup navigation between sections
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;

      // Update active states
      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');

      sections.forEach((s) => s.classList.remove('active'));
      document.getElementById(`section-${sectionId}`).classList.add('active');
    });
  });
}

/**
 * Show restart notification for settings that require restart
 */
function showRestartNotification(_settingKey) {
  const restartNotification = document.getElementById('restartNotification');
  if (!restartNotification) return;

  // Display notification
  restartNotification.style.display = 'block';

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (restartNotification.style.display === 'block') {
      restartNotification.style.display = 'none';
    }
  }, 10000);
}

/**
 * Setup event listeners for settings changes
 */
function setupEventListeners() {
  // Auto-save on change
  for (const [elementId, settingKey] of Object.entries(settingMappings)) {
    const element = document.getElementById(elementId);
    if (!element) continue;

    const eventType = element.type === 'checkbox' ? 'change' : 'input';

    element.addEventListener(eventType, async () => {
      let value =
        element.type === 'checkbox'
          ? element.checked
          : element.type === 'number' || element.type === 'range'
            ? Number(element.value)
            : element.value;

      // Special handling for saveInterval (display in minutes, store in ms)
      if (settingKey === 'history.saveInterval') {
        value = value * 60000; // minutes to ms
      }

      await api.setSetting(settingKey, value);

      // Check if this setting requires a restart
      const needsRestart = await api.settingRequiresRestart(settingKey);
      if (needsRestart) {
        showRestartNotification(settingKey);
      }

      // Update range display
      if (element.type === 'range') {
        updateRangeValue(element);
      }

      // Update font selector preview when font changes
      if (elementId === 'defaultFontFamily') {
        updateFontSelectorPreview();
      }
    });
  }

  // Shortcut inputs
  document.querySelectorAll('.setting-input.shortcut').forEach((input) => {
    input.addEventListener('focus', () => {
      input.placeholder = 'Press keys...';
    });

    input.addEventListener('blur', () => {
      input.placeholder = 'Click to record';
    });

    input.addEventListener('keydown', async (e) => {
      e.preventDefault();

      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');

      const key = e.key.toUpperCase();
      if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
        keys.push(key);
      }

      if (keys.length > 1) {
        const shortcut = keys.join('+');
        input.value = shortcut;

        const settingKey = settingMappings[input.id];
        await api.setSetting(settingKey, shortcut);
        input.blur();
      }
    });
  });

  // Reset settings button
  document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await api.resetSetting(null);
      await loadSettings();
    }
  });

  // Check for updates button
  document.getElementById('checkUpdatesBtn').addEventListener('click', () => {
    api.checkForUpdates();
  });
}

/**
 * Update range value display
 */
function updateRangeValue(rangeElement) {
  const valueDisplay =
    document.getElementById(`${rangeElement.id.replace(/([A-Z])/g, '_$1').toLowerCase()}Value`) ||
    rangeElement.nextElementSibling;
  if (valueDisplay && valueDisplay.classList.contains('range-value')) {
    valueDisplay.textContent = `${rangeElement.value}%`;
  }
}

/**
 * Setup Storage Location settings
 */
function setupStorageSettings() {
  // DOM elements
  const storagePath = document.getElementById('storagePath');
  const storagePathBadge = document.getElementById('storagePathBadge');
  const storageDbSize = document.getElementById('storageDbSize');
  const storageAttachments = document.getElementById('storageAttachments');
  const storageTotal = document.getElementById('storageTotal');
  const changeStorageBtn = document.getElementById('changeStorageBtn');
  const resetStorageBtn = document.getElementById('resetStorageBtn');
  const migrationProgress = document.getElementById('migrationProgress');
  const migrationStage = document.getElementById('migrationStage');
  const migrationProgressFill = document.getElementById('migrationProgressFill');
  const migrationProgressText = document.getElementById('migrationProgressText');

  // Format bytes to human readable
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Load and display storage info
  async function loadStorageInfo() {
    try {
      const info = await api.storageGetCurrentPath();

      // Update path display
      if (storagePath) {
        storagePath.textContent = info.currentPath;
      }

      // Update badge
      if (storagePathBadge) {
        if (info.isCustom) {
          storagePathBadge.textContent = 'Custom';
          storagePathBadge.classList.add('custom');
        } else {
          storagePathBadge.textContent = 'Default';
          storagePathBadge.classList.remove('custom');
        }
      }

      // Update stats
      if (storageDbSize) {
        storageDbSize.textContent = formatBytes(info.stats.dbSize);
      }
      if (storageAttachments) {
        storageAttachments.textContent = `${info.stats.attachmentCount} files (${formatBytes(info.stats.attachmentSize)})`;
      }
      if (storageTotal) {
        storageTotal.textContent = formatBytes(info.stats.totalSize);
      }

      // Show/hide reset button
      if (resetStorageBtn) {
        resetStorageBtn.style.display = info.isCustom ? 'inline-block' : 'none';
      }
    } catch (err) {
      console.error('Failed to load storage info:', err);
      if (storagePath) {
        storagePath.textContent = 'Error loading path';
      }
    }
  }

  // Change storage location
  if (changeStorageBtn) {
    changeStorageBtn.addEventListener('click', async () => {
      // Select folder
      const result = await api.storageSelectFolder();

      if (result.canceled) {
        return;
      }

      if (!result.valid) {
        alert(`Cannot use this folder: ${result.error}`);
        return;
      }

      // Check for existing data
      let proceed = true;
      if (result.hasExistingData) {
        proceed = confirm(
          `This folder already contains StickyNotes data:\n${result.existingFiles.join(', ')}\n\nDo you want to use this existing data instead of migrating your current data?`
        );

        if (!proceed) {
          return;
        }
      } else {
        // Confirm migration
        proceed = confirm(
          `Move your data to:\n${result.path}\n\nThis will copy your database and attachments to the new location. The app will restart after migration.\n\nContinue?`
        );
      }

      if (!proceed) {
        return;
      }

      // Show progress
      if (migrationProgress) {
        migrationProgress.style.display = 'block';
      }
      if (changeStorageBtn) {
        changeStorageBtn.disabled = true;
      }

      // Start migration
      const migrationResult = await api.storageMigrateData(result.path, {
        overwriteExisting: result.hasExistingData,
      });

      if (migrationResult.success) {
        if (migrationResult.requiresRestart) {
          const restart = confirm(
            'Migration complete! The app needs to restart to use the new location.\n\nRestart now?'
          );
          if (restart) {
            api.storageRestartApp();
          }
        }
      } else {
        alert(`Migration failed: ${migrationResult.error}`);
      }

      // Hide progress
      if (migrationProgress) {
        migrationProgress.style.display = 'none';
      }
      if (changeStorageBtn) {
        changeStorageBtn.disabled = false;
      }

      // Refresh display
      await loadStorageInfo();
    });
  }

  // Reset to default
  if (resetStorageBtn) {
    resetStorageBtn.addEventListener('click', async () => {
      const result = await api.storageResetToDefault();

      if (result.canceled) {
        return;
      }

      if (result.success) {
        if (result.requiresRestart) {
          const restart = confirm(
            'Storage location has been reset to default. The app needs to restart.\n\nRestart now?'
          );
          if (restart) {
            api.storageRestartApp();
          }
        }
        await loadStorageInfo();
      } else if (result.error) {
        alert(`Reset failed: ${result.error}`);
      }
    });
  }

  // Listen for migration progress
  api.onStorageMigrationProgress((data) => {
    if (migrationStage) {
      migrationStage.textContent = data.message;
    }
    if (migrationProgressFill) {
      migrationProgressFill.style.width = `${data.percent}%`;
    }
    if (migrationProgressText) {
      migrationProgressText.textContent = `${data.percent}%`;
    }
  });

  // Load initial storage info
  loadStorageInfo();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
