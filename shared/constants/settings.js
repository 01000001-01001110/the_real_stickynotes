/**
 * Settings schema version for migration tracking
 *
 * VERSIONING GUIDE:
 * - Increment MAJOR (e.g., 2) when removing/renaming settings or changing structure
 * - Increment MINOR (e.g., 1.1) when adding new settings (backward compatible)
 * - Increment PATCH (e.g., 1.0.1) when fixing default values only
 *
 * MIGRATION PATTERN (for future use):
 * 1. Load settings with old schema version
 * 2. Transform via migration function
 * 3. Save with new schema version
 * 4. Update stored version
 *
 * VERSION HISTORY:
 * - v1: Initial schema
 * - v2: Sherpa-ONNX migration - removed chunkDuration, added VAD settings, updated modelSize options
 *
 * @type {number}
 */
const SETTINGS_SCHEMA_VERSION = 2;

/**
 * Settings keys and their metadata
 */
const settingsSchema = {
  // General Settings
  'general.startOnBoot': {
    type: 'boolean',
    default: false,
    description: 'Start with Windows',
  },
  'general.startMinimized': {
    type: 'boolean',
    default: false,
    description: 'Start minimized to tray',
  },
  'general.minimizeToTray': {
    type: 'boolean',
    default: true,
    description: 'Minimize to tray instead of taskbar',
  },
  'general.closeToTray': {
    type: 'boolean',
    default: true,
    description: 'Close button minimizes to tray',
  },
  'general.confirmDelete': {
    type: 'boolean',
    default: true,
    description: 'Confirm before moving to trash',
  },
  'general.confirmPermanentDelete': {
    type: 'boolean',
    default: true,
    description: 'Confirm before permanent delete',
  },
  'general.autoSaveDelay': {
    type: 'number',
    default: 1000,
    min: 100,
    max: 30000,
    description: 'Auto-save delay in ms',
  },
  'general.trashRetentionDays': {
    type: 'number',
    default: 30,
    min: 0,
    max: 365,
    description: 'Days before auto-purge from trash (0=never)',
  },

  // Appearance Settings
  'appearance.theme': {
    type: 'string',
    default: 'system',
    description: 'App theme: light/dark/system',
    options: ['light', 'dark', 'system'],
  },
  'appearance.defaultNoteColor': {
    type: 'string',
    default: 'yellow',
    description: 'Default color for new notes',
    options: ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal', 'random'],
  },
  'appearance.defaultNoteWidth': {
    type: 'number',
    default: 300,
    min: 100,
    max: 2000,
    description: 'Default width in pixels',
  },
  'appearance.defaultNoteHeight': {
    type: 'number',
    default: 350,
    min: 100,
    max: 2000,
    description: 'Default height in pixels',
  },
  'appearance.defaultFontFamily': {
    type: 'string',
    default: 'Segoe UI',
    description: 'Font family',
  },
  'appearance.defaultFontSize': {
    type: 'number',
    default: 14,
    min: 8,
    max: 72,
    description: 'Font size in pixels',
  },
  'appearance.noteOpacity': {
    type: 'number',
    default: 100,
    min: 50,
    max: 100,
    description: 'Window opacity 50-100',
  },
  'appearance.enableShadows': {
    type: 'boolean',
    default: true,
    description: 'Show window shadows',
  },
  'appearance.enableAnimations': {
    type: 'boolean',
    default: true,
    description: 'Enable UI animations',
  },
  'appearance.showNoteCount': {
    type: 'boolean',
    default: true,
    description: 'Show note count in panel',
  },

  // New Note Behavior
  'newNote.position': {
    type: 'string',
    default: 'cascade',
    description: 'Position: cascade/center/cursor/random',
    options: ['cascade', 'center', 'cursor', 'random'],
  },
  'newNote.cascadeOffset': {
    type: 'number',
    default: 30,
    min: 0,
    max: 200,
    description: 'Cascade offset in pixels',
  },

  // Tray Settings
  'tray.singleClickAction': {
    type: 'string',
    default: 'showPanel',
    description: 'Action: showPanel/toggleNotes/newNote/nothing',
    options: ['showPanel', 'toggleNotes', 'newNote', 'nothing'],
  },
  'tray.doubleClickAction': {
    type: 'string',
    default: 'newNote',
    description: 'Action on double click',
    options: ['showPanel', 'toggleNotes', 'newNote', 'nothing'],
  },

  // Keyboard Shortcuts
  'shortcuts.globalNewNote': {
    type: 'string',
    default: 'Ctrl+Shift+N',
    description: 'Global hotkey for new note',
  },
  'shortcuts.globalToggle': {
    type: 'string',
    default: 'Ctrl+Shift+S',
    description: 'Global hotkey to show/hide all',
  },
  'shortcuts.globalPanel': {
    type: 'string',
    default: 'Ctrl+Shift+P',
    description: 'Global hotkey to show panel',
  },

  // Editor Settings
  'editor.spellcheck': {
    type: 'boolean',
    default: true,
    description: 'Enable spellcheck',
  },
  'editor.autoLinks': {
    type: 'boolean',
    default: true,
    description: 'Auto-detect and linkify URLs',
  },
  'editor.autoLists': {
    type: 'boolean',
    default: true,
    description: 'Auto-continue bullet/numbered lists',
  },
  'editor.tabSize': {
    type: 'number',
    default: 2,
    min: 1,
    max: 8,
    description: 'Tab size for code blocks',
  },
  'editor.showWordCount': {
    type: 'boolean',
    default: false,
    description: 'Show word count in status bar',
  },

  // Reminder Settings
  'reminders.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable reminder notifications',
  },
  'reminders.sound': {
    type: 'boolean',
    default: true,
    description: 'Play sound on reminder',
  },
  'reminders.snoozeMinutes': {
    type: 'number',
    default: 15,
    min: 1,
    max: 1440,
    description: 'Default snooze duration',
  },
  'reminders.persistUntilDismissed': {
    type: 'boolean',
    default: true,
    description: 'Keep notification until dismissed',
  },

  // History Settings
  'history.maxVersions': {
    type: 'number',
    default: 10,
    min: 1,
    max: 100,
    description: 'Max versions to keep per note',
  },
  'history.saveInterval': {
    type: 'number',
    default: 300000,
    min: 10000,
    max: 3600000,
    description: 'Save version every N ms (5 min)',
  },

  // Advanced Settings
  'advanced.hardwareAcceleration': {
    type: 'boolean',
    default: true,
    description: 'Enable GPU acceleration',
    requiresRestart: true,
  },
  'advanced.devTools': {
    type: 'boolean',
    default: false,
    description: 'Show dev tools option',
  },

  // Whisper/Transcription Settings (Sherpa-ONNX v2)
  'whisper.enabled': {
    type: 'boolean',
    default: false,
    description: 'Enable transcription feature (requires model installation)',
  },
  'whisper.modelSize': {
    type: 'string',
    default: 'base.en',
    description: 'Whisper model size (ONNX format)',
    options: ['tiny.en', 'base.en', 'small.en'],
  },
  'whisper.language': {
    type: 'string',
    default: 'en',
    description: 'Transcription language code',
    options: ['en'],
  },
  'whisper.insertMode': {
    type: 'string',
    default: 'cursor',
    description: 'Where to insert transcribed text',
    options: ['cursor', 'append', 'replace'],
  },
  'whisper.defaultSource': {
    type: 'string',
    default: 'microphone',
    description: 'Default audio source',
    options: ['microphone', 'system', 'both'],
  },
  // VAD (Voice Activity Detection) Settings
  'whisper.vadThreshold': {
    type: 'number',
    default: 0.5,
    min: 0.1,
    max: 0.9,
    description: 'Voice activity detection sensitivity (lower = more sensitive)',
  },
  'whisper.vadMinSilence': {
    type: 'number',
    default: 0.25,
    min: 0.1,
    max: 2.0,
    description: 'Minimum silence duration (seconds) before ending speech segment',
  },
  'whisper.vadMaxSpeech': {
    type: 'number',
    default: 5.0,
    min: 1.0,
    max: 30.0,
    description: 'Maximum speech segment duration (seconds)',
  },
  'whisper.numThreads': {
    type: 'number',
    default: 4,
    min: 1,
    max: 8,
    description: 'CPU threads for transcription',
  },

  // Setup/First-Launch Settings
  'setup.transcriptionOffered': {
    type: 'boolean',
    default: false,
    description: 'Whether transcription setup has been offered to user',
  },

  // Hints (one-time user guidance)
  'hints.noteCloseHintSeen': {
    type: 'boolean',
    default: false,
    description: 'Whether user has seen the note close hint',
  },
};

function getSettingDefault(key) {
  const setting = settingsSchema[key];
  return setting ? setting.default : null;
}

function getSettingType(key) {
  const setting = settingsSchema[key];
  return setting ? setting.type : null;
}

function isValidSettingKey(key) {
  return key in settingsSchema;
}

function parseSettingValue(key, value) {
  const type = getSettingType(key);
  if (!type) return value;

  switch (type) {
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1';
    case 'number': {
      const num = Number(value);
      // Handle NaN by returning the default value
      if (isNaN(num)) {
        return getSettingDefault(key);
      }
      return num;
    }
    case 'string':
    default:
      return String(value);
  }
}

function getAllDefaults() {
  const defaults = {};
  for (const [key, schema] of Object.entries(settingsSchema)) {
    defaults[key] = schema.default;
  }
  return defaults;
}

function requiresRestart(key) {
  const setting = settingsSchema[key];
  return setting ? setting.requiresRestart === true : false;
}

module.exports = {
  settingsSchema,
  SETTINGS_SCHEMA_VERSION,
  getSettingDefault,
  getSettingType,
  isValidSettingKey,
  parseSettingValue,
  getAllDefaults,
  requiresRestart,
};
