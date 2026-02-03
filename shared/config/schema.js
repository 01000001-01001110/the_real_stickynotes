/**
 * YAML Configuration Schema
 *
 * Validates user-editable settings stored in config.yaml
 * Uses JSON Schema Draft-07 with ajv for validation
 *
 * @module shared/config/schema
 */

const Ajv = require('ajv');

/**
 * JSON Schema for config.yaml validation
 *
 * SCHEMA VERSIONING:
 * - Increment schemaVersion when making breaking changes
 * - Add new properties with defaults for backward compatibility
 * - Use migrations when changing structure
 */
const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion'],
  properties: {
    schemaVersion: {
      type: 'number',
      const: 3,
      description: 'Configuration schema version for migration tracking',
    },

    general: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        startMinimized: {
          type: 'boolean',
          default: false,
          description: 'Start minimized to system tray',
        },
        minimizeToTray: {
          type: 'boolean',
          default: true,
          description: 'Minimize to tray instead of taskbar',
        },
        closeToTray: {
          type: 'boolean',
          default: true,
          description: 'Close button minimizes to tray instead of quitting',
        },
        confirmDelete: {
          type: 'boolean',
          default: true,
          description: 'Show confirmation before moving notes to trash',
        },
        confirmPermanentDelete: {
          type: 'boolean',
          default: true,
          description: 'Show confirmation before permanent delete from trash',
        },
        autoSaveDelay: {
          type: 'number',
          minimum: 100,
          maximum: 30000,
          default: 1000,
          description: 'Auto-save delay in milliseconds (100-30000)',
        },
        trashRetentionDays: {
          type: 'number',
          minimum: 0,
          maximum: 365,
          default: 30,
          description: 'Days before auto-purge from trash (0=never)',
        },
      },
    },

    appearance: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'system'],
          default: 'system',
          description: 'Application theme',
        },
        defaultNoteColor: {
          type: 'string',
          enum: [
            'yellow',
            'pink',
            'blue',
            'green',
            'purple',
            'orange',
            'gray',
            'charcoal',
            'random',
          ],
          default: 'yellow',
          description: 'Default color for new notes',
        },
        defaultNoteWidth: {
          type: 'number',
          minimum: 100,
          maximum: 2000,
          default: 300,
          description: 'Default width in pixels',
        },
        defaultNoteHeight: {
          type: 'number',
          minimum: 100,
          maximum: 2000,
          default: 350,
          description: 'Default height in pixels',
        },
        defaultFontFamily: {
          type: 'string',
          default: 'Segoe UI',
          description: 'Default font family for notes',
        },
        defaultFontSize: {
          type: 'number',
          minimum: 8,
          maximum: 72,
          default: 14,
          description: 'Default font size in pixels',
        },
        noteOpacity: {
          type: 'number',
          minimum: 50,
          maximum: 100,
          default: 100,
          description: 'Note window opacity percentage (50-100)',
        },
        enableShadows: {
          type: 'boolean',
          default: true,
          description: 'Show window shadows on notes',
        },
        enableAnimations: {
          type: 'boolean',
          default: true,
          description: 'Enable UI animations',
        },
        showNoteCount: {
          type: 'boolean',
          default: true,
          description: 'Show note count in panel',
        },
      },
    },

    newNote: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        position: {
          type: 'string',
          enum: ['cascade', 'center', 'cursor', 'random'],
          default: 'cascade',
          description: 'Position for new notes',
        },
        cascadeOffset: {
          type: 'number',
          minimum: 0,
          maximum: 200,
          default: 30,
          description: 'Cascade offset in pixels when position is cascade',
        },
      },
    },

    tray: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        singleClickAction: {
          type: 'string',
          enum: ['showPanel', 'toggleNotes', 'newNote', 'nothing'],
          default: 'showPanel',
          description: 'Action for single-click on tray icon',
        },
        doubleClickAction: {
          type: 'string',
          enum: ['showPanel', 'toggleNotes', 'newNote', 'nothing'],
          default: 'newNote',
          description: 'Action for double-click on tray icon',
        },
      },
    },

    shortcuts: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        globalNewNote: {
          type: 'string',
          default: 'Ctrl+Shift+N',
          description: 'Global hotkey to create new note',
        },
        globalToggle: {
          type: 'string',
          default: 'Ctrl+Shift+S',
          description: 'Global hotkey to show/hide all notes',
        },
        globalPanel: {
          type: 'string',
          default: 'Ctrl+Shift+P',
          description: 'Global hotkey to show panel',
        },
      },
    },

    editor: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        spellcheck: {
          type: 'boolean',
          default: true,
          description: 'Enable spellcheck in note editor',
        },
        autoLinks: {
          type: 'boolean',
          default: true,
          description: 'Auto-detect and linkify URLs',
        },
        autoLists: {
          type: 'boolean',
          default: true,
          description: 'Auto-continue bullet/numbered lists on Enter',
        },
        tabSize: {
          type: 'number',
          minimum: 1,
          maximum: 8,
          default: 2,
          description: 'Tab size for code blocks',
        },
        showWordCount: {
          type: 'boolean',
          default: false,
          description: 'Show word count in status bar',
        },
      },
    },

    reminders: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Enable reminder notifications',
        },
        sound: {
          type: 'boolean',
          default: true,
          description: 'Play sound when reminder triggers',
        },
        snoozeMinutes: {
          type: 'number',
          minimum: 1,
          maximum: 1440,
          default: 15,
          description: 'Default snooze duration in minutes',
        },
        persistUntilDismissed: {
          type: 'boolean',
          default: true,
          description: 'Keep notification visible until dismissed',
        },
      },
    },

    history: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        maxVersions: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 10,
          description: 'Maximum versions to keep per note',
        },
        saveInterval: {
          type: 'number',
          minimum: 10000,
          maximum: 3600000,
          default: 300000,
          description: 'Save version every N milliseconds (default 5 minutes)',
        },
      },
    },

    advanced: {
      type: 'object',
      additionalProperties: false,
      default: {},
      properties: {
        hardwareAcceleration: {
          type: 'boolean',
          default: true,
          description: 'Enable GPU hardware acceleration (requires restart)',
        },
        devTools: {
          type: 'boolean',
          default: false,
          description: 'Show developer tools option in menus',
        },
      },
    },
  },
};

/**
 * Validate configuration object against schema
 *
 * @param {object} config - Configuration object to validate
 * @returns {{valid: boolean, errors: Array|null, config: object}} Validation result
 */
function validateConfig(config) {
  const ajv = new Ajv({
    useDefaults: true, // Apply defaults from schema
    coerceTypes: true, // Coerce types (e.g., '1' -> 1)
    removeAdditional: false, // Don't remove unknown properties (for forward compatibility)
    allErrors: true, // Collect all errors, not just first
  });

  const validate = ajv.compile(configSchema);
  const valid = validate(config);

  return {
    valid,
    errors: valid ? null : validate.errors,
    config, // Return potentially modified config (with defaults applied)
  };
}

/**
 * Get default value for a specific setting key
 *
 * @param {string} key - Dot-notation setting key (e.g., 'general.startMinimized')
 * @returns {*} Default value or undefined if not found
 */
function getDefaultValue(key) {
  const parts = key.split('.');
  if (parts.length !== 2) return undefined;

  const [section, setting] = parts;
  const sectionSchema = configSchema.properties[section];
  if (!sectionSchema) return undefined;

  const settingSchema = sectionSchema.properties[setting];
  return settingSchema ? settingSchema.default : undefined;
}

/**
 * Get all default values as a flat object
 *
 * @returns {object} Object with all defaults in dot-notation keys
 */
function getAllDefaults() {
  const defaults = {};

  for (const [section, sectionSchema] of Object.entries(configSchema.properties)) {
    if (section === 'schemaVersion') {
      defaults.schemaVersion = configSchema.properties.schemaVersion.const;
      continue;
    }

    if (sectionSchema.type === 'object' && sectionSchema.properties) {
      for (const [setting, settingSchema] of Object.entries(sectionSchema.properties)) {
        if (settingSchema.default !== undefined) {
          defaults[`${section}.${setting}`] = settingSchema.default;
        }
      }
    }
  }

  return defaults;
}

/**
 * Get all defaults as nested object (for YAML generation)
 *
 * @returns {object} Nested configuration object with all defaults
 */
function getAllDefaultsNested() {
  const defaults = { schemaVersion: 3 };

  for (const [section, sectionSchema] of Object.entries(configSchema.properties)) {
    if (section === 'schemaVersion') continue;

    if (sectionSchema.type === 'object' && sectionSchema.properties) {
      defaults[section] = {};
      for (const [setting, settingSchema] of Object.entries(sectionSchema.properties)) {
        if (settingSchema.default !== undefined) {
          defaults[section][setting] = settingSchema.default;
        }
      }
    }
  }

  return defaults;
}

/**
 * Settings that require application restart when changed
 * Add new settings here as needed
 */
const RESTART_REQUIRED_SETTINGS = new Set([
  'advanced.hardwareAcceleration',
  // Add more settings here if they require restart
]);

/**
 * Check if a setting requires restart
 *
 * @param {string} key - Dot-notation setting key
 * @returns {boolean} True if changing this setting requires app restart
 */
function requiresRestart(key) {
  return RESTART_REQUIRED_SETTINGS.has(key);
}

/**
 * Get validation constraints for a setting
 *
 * @param {string} key - Dot-notation setting key
 * @returns {object|null} Constraints object or null if not found
 */
function getConstraints(key) {
  const parts = key.split('.');
  if (parts.length !== 2) return null;

  const [section, setting] = parts;
  const sectionSchema = configSchema.properties[section];
  if (!sectionSchema) return null;

  const settingSchema = sectionSchema.properties[setting];
  if (!settingSchema) return null;

  const constraints = {
    type: settingSchema.type,
    default: settingSchema.default,
  };

  if (settingSchema.minimum !== undefined) constraints.minimum = settingSchema.minimum;
  if (settingSchema.maximum !== undefined) constraints.maximum = settingSchema.maximum;
  if (settingSchema.enum) constraints.enum = settingSchema.enum;

  return constraints;
}

module.exports = {
  configSchema,
  validateConfig,
  getDefaultValue,
  getAllDefaults,
  getAllDefaultsNested,
  requiresRestart,
  getConstraints,
};
