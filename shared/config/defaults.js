/**
 * Default Configuration Generator
 *
 * Generates config.yaml with inline documentation comments
 * Used for first-run setup and config regeneration
 *
 * @module shared/config/defaults
 */

/**
 * Generate default config.yaml content with inline comments
 *
 * @returns {string} YAML content with comments
 */
function generateDefaultConfig() {
  return `# StickyNotes Configuration
# ========================
# This file contains all user-editable settings for StickyNotes.
# Edit this file directly - changes are detected and applied automatically.
# Delete this file to reset all settings to defaults.
#
# Schema Version: 3
# Documentation: https://stickynotes.app/docs/config
# Last Updated: ${new Date().toISOString().split('T')[0]}

schemaVersion: 3

# ============================================================================
# General Settings
# ============================================================================
general:
  # Start minimized to system tray when app launches
  # Default: false
  startMinimized: false

  # Minimize to tray instead of taskbar when clicking minimize button
  # Default: true
  minimizeToTray: true

  # Close button minimizes to tray instead of quitting the app
  # When false, closing all windows will quit the app
  # Default: true
  closeToTray: true

  # Show confirmation dialog before moving notes to trash
  # Default: true
  confirmDelete: true

  # Show confirmation dialog before permanently deleting from trash
  # Default: true
  confirmPermanentDelete: true

  # Auto-save delay in milliseconds (100-30000)
  # How long to wait after typing stops before saving
  # Lower values = more frequent saves but more disk I/O
  # Default: 1000
  autoSaveDelay: 1000

  # Days before notes are auto-purged from trash (0 = never auto-purge)
  # Range: 0-365
  # Default: 30
  trashRetentionDays: 30

# ============================================================================
# Appearance Settings
# ============================================================================
appearance:
  # Application theme: light, dark, or system
  # - light: Always use light theme
  # - dark: Always use dark theme
  # - system: Follow Windows system theme
  # Default: system
  theme: system

  # Default color for new notes
  # Options: yellow, pink, blue, green, purple, orange, gray, charcoal, random
  # Use 'random' to pick a random color for each new note
  # Default: yellow
  defaultNoteColor: yellow

  # Default width for new notes in pixels (100-2000)
  # Default: 300
  defaultNoteWidth: 300

  # Default height for new notes in pixels (100-2000)
  # Default: 350
  defaultNoteHeight: 350

  # Default font family for note text
  # Use any font installed on your system
  # Default: Segoe UI
  defaultFontFamily: Segoe UI

  # Default font size in pixels (8-72)
  # Default: 14
  defaultFontSize: 14

  # Note window opacity percentage (50-100)
  # 100 = fully opaque, 50 = semi-transparent
  # Default: 100
  noteOpacity: 100

  # Show window shadows on notes
  # Default: true
  enableShadows: true

  # Enable UI animations (fade in/out, transitions)
  # Disable for better performance on slower systems
  # Default: true
  enableAnimations: true

  # Show total note count in panel header
  # Default: true
  showNoteCount: true

# ============================================================================
# New Note Behavior
# ============================================================================
newNote:
  # Position for newly created notes
  # Options:
  # - cascade: Offset from previous note (classic sticky note behavior)
  # - center: Center of screen
  # - cursor: At mouse cursor position
  # - random: Random position on screen
  # Default: cascade
  position: cascade

  # Cascade offset in pixels (0-200)
  # Only used when position is 'cascade'
  # How far to offset each new note from the previous one
  # Default: 30
  cascadeOffset: 30

# ============================================================================
# System Tray Settings
# ============================================================================
tray:
  # Action for single-click on tray icon
  # Options:
  # - showPanel: Open the notes panel
  # - toggleNotes: Show/hide all notes
  # - newNote: Create a new note
  # - nothing: Do nothing
  # Default: showPanel
  singleClickAction: showPanel

  # Action for double-click on tray icon
  # Same options as singleClickAction
  # Default: newNote
  doubleClickAction: newNote

# ============================================================================
# Keyboard Shortcuts
# ============================================================================
# Format: Ctrl+Shift+Key, Alt+Key, etc.
# Modifiers: Ctrl, Shift, Alt
# Special keys: F1-F12, Space, Tab, etc.
shortcuts:
  # Global hotkey to create a new note
  # Works even when StickyNotes is not focused
  # Default: Ctrl+Shift+N
  globalNewNote: Ctrl+Shift+N

  # Global hotkey to show/hide all notes
  # Default: Ctrl+Shift+S
  globalToggle: Ctrl+Shift+S

  # Global hotkey to show the notes panel
  # Default: Ctrl+Shift+P
  globalPanel: Ctrl+Shift+P

# ============================================================================
# Editor Settings
# ============================================================================
editor:
  # Enable spellcheck in note editor
  # Uses Windows system spellcheck
  # Default: true
  spellcheck: true

  # Auto-detect and linkify URLs
  # Makes URLs clickable automatically
  # Default: true
  autoLinks: true

  # Auto-continue bullet/numbered lists on Enter
  # Pressing Enter in a list automatically creates next item
  # Default: true
  autoLists: true

  # Tab size for code blocks (1-8 spaces)
  # Default: 2
  tabSize: 2

  # Show word count in status bar
  # Default: false
  showWordCount: false

# ============================================================================
# Reminder Settings
# ============================================================================
reminders:
  # Enable reminder notifications
  # When false, all reminders are disabled
  # Default: true
  enabled: true

  # Play sound when reminder triggers
  # Default: true
  sound: true

  # Default snooze duration in minutes (1-1440)
  # 1440 = 24 hours
  # Default: 15
  snoozeMinutes: 15

  # Keep notification visible until dismissed
  # When false, notification auto-hides after a few seconds
  # Default: true
  persistUntilDismissed: true

# ============================================================================
# History Settings
# ============================================================================
history:
  # Maximum versions to keep per note (1-100)
  # Older versions are automatically pruned
  # Default: 10
  maxVersions: 10

  # Save version every N milliseconds (10000-3600000)
  # 300000 = 5 minutes, 3600000 = 1 hour
  # Versions are only saved if content has changed
  # Default: 300000 (5 minutes)
  saveInterval: 300000

# ============================================================================
# Advanced Settings
# ============================================================================
advanced:
  # Enable GPU hardware acceleration
  # Improves performance but may cause issues with some graphics drivers
  # IMPORTANT: Requires app restart to take effect
  # Default: true
  hardwareAcceleration: true

  # Show developer tools option in menus
  # Useful for debugging or advanced customization
  # Default: false
  devTools: false

# ============================================================================
# Notes About Other Settings
# ============================================================================
# Some settings are stored in the database instead of this file:
#
# - UI hints (hints.*)
#   UI state like whether user has seen the close hint
#
# - Start on Boot (general.startOnBoot)
#   Handled by Windows installer registry entry
#
# To modify these settings, use the Settings window in the app.
`;
}

/**
 * Generate minimal config.yaml for testing
 * Contains only required fields with default values
 *
 * @returns {string} Minimal YAML content
 */
function generateMinimalConfig() {
  return `schemaVersion: 3
general:
  startMinimized: false
  minimizeToTray: true
  closeToTray: true
  confirmDelete: true
  confirmPermanentDelete: true
  autoSaveDelay: 1000
  trashRetentionDays: 30
appearance:
  theme: system
  defaultNoteColor: yellow
  defaultNoteWidth: 300
  defaultNoteHeight: 350
  defaultFontFamily: Segoe UI
  defaultFontSize: 14
  noteOpacity: 100
  enableShadows: true
  enableAnimations: true
  showNoteCount: true
newNote:
  position: cascade
  cascadeOffset: 30
tray:
  singleClickAction: showPanel
  doubleClickAction: newNote
shortcuts:
  globalNewNote: Ctrl+Shift+N
  globalToggle: Ctrl+Shift+S
  globalPanel: Ctrl+Shift+P
editor:
  spellcheck: true
  autoLinks: true
  autoLists: true
  tabSize: 2
  showWordCount: false
reminders:
  enabled: true
  sound: true
  snoozeMinutes: 15
  persistUntilDismissed: true
history:
  maxVersions: 10
  saveInterval: 300000
advanced:
  hardwareAcceleration: true
  devTools: false
`;
}

/**
 * Get list of settings that should stay in SQLite
 *
 * @returns {string[]} Array of setting key prefixes that stay in SQLite
 */
function getSQLiteOnlySettings() {
  return [
    'hints.*', // UI hint state (whether user has seen tooltips, etc.)
  ];
}

/**
 * Get list of settings that migrate to YAML
 *
 * @returns {string[]} Array of setting key prefixes that go to YAML
 */
function getYAMLSettings() {
  return [
    'general.*', // EXCEPT general.startOnBoot (handled by installer)
    'appearance.*',
    'newNote.*',
    'tray.*',
    'shortcuts.*',
    'editor.*',
    'reminders.*',
    'history.*',
    'advanced.*',
  ];
}

/**
 * Check if a setting should be migrated to YAML
 *
 * @param {string} key - Setting key to check
 * @returns {boolean} True if setting goes to YAML, false if stays in SQLite
 */
function shouldMigrateToYAML(key) {
  // Special case: startOnBoot is handled by installer registry, not YAML
  if (key === 'general.startOnBoot') {
    return false;
  }

  // Check if key matches SQLite-only patterns
  const sqlitePatterns = getSQLiteOnlySettings();
  for (const pattern of sqlitePatterns) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -2); // Remove '.*'
      if (key.startsWith(prefix + '.')) {
        return false;
      }
    }
  }

  // Check if key matches YAML patterns
  const yamlPatterns = getYAMLSettings();
  for (const pattern of yamlPatterns) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -2); // Remove '.*'
      if (key.startsWith(prefix + '.')) {
        return true;
      }
    }
  }

  // Default: keep in SQLite for safety
  return false;
}

module.exports = {
  generateDefaultConfig,
  generateMinimalConfig,
  getSQLiteOnlySettings,
  getYAMLSettings,
  shouldMigrateToYAML,
};
