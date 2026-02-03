/**
 * Method Mapper
 *
 * Maps CLI command structure to JSON-RPC method calls.
 * Handles argument transformation and parameter validation.
 */

/**
 * Map a parsed CLI command to a JSON-RPC method and params
 * @param {Object} parsed - Parsed CLI arguments from parser
 * @param {string} parsed.command - Main command (e.g., 'note', 'tag', 'folder')
 * @param {string} parsed.action - Action to perform (e.g., 'list', 'create', 'update')
 * @param {string[]} parsed.args - Positional arguments
 * @param {Object} parsed.options - Named options/flags
 * @returns {Object} JSON-RPC request object with method and params
 * @throws {Error} If command/action combination is invalid
 */
function mapCommand(parsed) {
  const { command, action, args, options } = parsed;

  // Handle special commands that don't map to JSON-RPC
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    return { method: null, params: {}, isLocal: true };
  }

  if (command === 'version' || command === '--version' || command === '-V') {
    return { method: null, params: {}, isLocal: true };
  }

  // Validate command and action
  if (!action) {
    throw new Error(`Missing action for command '${command}'. Try: stickynotes ${command} --help`);
  }

  // Build method name: command:action
  const method = `${command}:${action}`;

  // Build params based on command type
  const params = buildParams(command, action, args, options);

  return { method, params, isLocal: false };
}

/**
 * Build parameters object based on command, action, and arguments
 * @private
 * @param {string} command - Main command
 * @param {string} action - Action to perform
 * @param {string[]} args - Positional arguments
 * @param {Object} options - Named options
 * @returns {Object} Parameters object for JSON-RPC
 */
function buildParams(command, action, args, options) {
  const params = { ...options };

  // Handle command-specific argument mappings
  switch (command) {
    case 'note':
      return buildNoteParams(action, args, params);

    case 'tag':
      return buildTagParams(action, args, params);

    case 'folder':
      return buildFolderParams(action, args, params);

    case 'search':
      return buildSearchParams(action, args, params);

    case 'config':
      return buildConfigParams(action, args, params);

    case 'export':
      return buildExportParams(action, args, params);

    case 'backup':
      return buildBackupParams(action, args, params);

    case 'restore':
      return buildRestoreParams(action, args, params);

    case 'app':
      return buildAppParams(action, args, params);

    case 'service':
      return buildServiceParams(action, args, params);

    case 'stats':
      return buildStatsParams(action, args, params);

    case 'doctor':
      return buildDoctorParams(action, args, params);

    case 'db':
      return buildDbParams(action, args, params);

    case 'paths':
      return buildPathsParams(action, args, params);

    default:
      // Generic mapping - just pass options as params
      return params;
  }
}

/**
 * Build note command parameters
 * @private
 */
function buildNoteParams(action, args, params) {
  switch (action) {
    case 'list':
      // stickynotes note list [--limit N] [--archived] [--trash]
      return params;

    case 'create': {
      // stickynotes note create <title> [content] [--folder-id ID] [--tags tag1,tag2]
      if (args.length === 0) {
        throw new Error('Missing title for note create');
      }
      const result = {
        ...params,
        title: args[0],
        content: args[1] || '',
      };
      if (params.folderId) {
        result.folderId = params.folderId;
      }
      if (params.tags) {
        result.tags = params.tags.split(',').map((t) => t.trim());
      }
      return result;
    }

    case 'get':
    case 'show':
      // stickynotes note get <id> [--with-history] [--with-tags]
      if (args.length === 0) {
        throw new Error('Missing note ID');
      }
      return {
        id: args[0],
        ...params,
      };

    case 'update':
      // stickynotes note update <id> [--title TITLE] [--content CONTENT]
      if (args.length === 0) {
        throw new Error('Missing note ID for update');
      }
      return {
        id: args[0],
        ...params,
      };

    case 'delete':
      // stickynotes note delete <id> [--force]
      if (args.length === 0) {
        throw new Error('Missing note ID for delete');
      }
      return {
        id: args[0],
        ...params,
      };

    case 'archive':
    case 'unarchive':
    case 'trash':
    case 'restore':
    case 'pin':
    case 'unpin':
      // stickynotes note archive <id>
      if (args.length === 0) {
        throw new Error(`Missing note ID for ${action}`);
      }
      return {
        id: args[0],
        ...params,
      };

    case 'history':
      // stickynotes note history <id> [--limit N]
      if (args.length === 0) {
        throw new Error('Missing note ID for history');
      }
      return {
        id: args[0],
        limit: params.limit || 10,
        ...params,
      };

    case 'bulkDelete':
      // stickynotes note bulkDelete <id1> <id2> ... [--permanent]
      if (args.length === 0) {
        throw new Error('At least one note ID is required for bulk delete');
      }
      return {
        ids: args,
        permanent: params.permanent || false,
        ...params,
      };

    case 'bulkArchive':
      // stickynotes note bulkArchive <id1> <id2> ...
      if (args.length === 0) {
        throw new Error('At least one note ID is required for bulk archive');
      }
      return {
        ids: args,
        ...params,
      };

    default:
      return params;
  }
}

/**
 * Build tag command parameters
 * @private
 */
function buildTagParams(action, args, params) {
  switch (action) {
    case 'list':
      // stickynotes tag list [--with-counts]
      return params;

    case 'add':
      // stickynotes tag add <note-id> <tag-name>
      if (args.length < 2) {
        throw new Error('tag add requires note ID and tag name');
      }
      return {
        noteId: args[0],
        tag: args[1],
        ...params,
      };

    case 'remove':
      // stickynotes tag remove <note-id> <tag-name>
      if (args.length < 2) {
        throw new Error('tag remove requires note ID and tag name');
      }
      return {
        noteId: args[0],
        tag: args[1],
        ...params,
      };

    case 'rename':
      // stickynotes tag rename <old-name> <new-name>
      if (args.length < 2) {
        throw new Error('tag rename requires old name and new name');
      }
      return {
        oldName: args[0],
        newName: args[1],
        ...params,
      };

    case 'delete':
      // stickynotes tag delete <tag-name>
      if (args.length === 0) {
        throw new Error('Missing tag name for delete');
      }
      return {
        tag: args[0],
        ...params,
      };

    default:
      return params;
  }
}

/**
 * Build folder command parameters
 * @private
 */
function buildFolderParams(action, args, params) {
  switch (action) {
    case 'list':
      // stickynotes folder list [--tree]
      return params;

    case 'create':
      // stickynotes folder create <name> [--parent-id ID]
      if (args.length === 0) {
        throw new Error('Missing folder name');
      }
      return {
        name: args[0],
        parentId: params.parentId,
        ...params,
      };

    case 'get':
      // stickynotes folder get <id>
      if (args.length === 0) {
        throw new Error('Missing folder ID');
      }
      return {
        id: args[0],
        ...params,
      };

    case 'update':
      // stickynotes folder update <id> --name NAME
      if (args.length === 0) {
        throw new Error('Missing folder ID');
      }
      return {
        id: args[0],
        ...params,
      };

    case 'delete':
      // stickynotes folder delete <id> [--force]
      if (args.length === 0) {
        throw new Error('Missing folder ID');
      }
      return {
        id: args[0],
        ...params,
      };

    default:
      return params;
  }
}

/**
 * Build search command parameters
 * @private
 */
function buildSearchParams(action, args, params) {
  // stickynotes search <query> [--in-content] [--in-title] [--limit N]
  if (args.length === 0) {
    throw new Error('Missing search query');
  }

  return {
    query: args.join(' '),
    ...params,
  };
}

/**
 * Build config command parameters
 * @private
 */
function buildConfigParams(action, args, params) {
  switch (action) {
    case 'get':
      // stickynotes config get <key>
      if (args.length === 0) {
        throw new Error('Missing config key');
      }
      return {
        key: args[0],
        ...params,
      };

    case 'set':
      // stickynotes config set <key> <value>
      if (args.length < 2) {
        throw new Error('config set requires key and value');
      }
      return {
        key: args[0],
        value: args[1],
        ...params,
      };

    case 'list':
      // stickynotes config list
      return params;

    case 'edit':
      // stickynotes config edit (opens in editor)
      return params;

    default:
      return params;
  }
}

/**
 * Build export command parameters
 * @private
 */
function buildExportParams(action, args, params) {
  // stickynotes export <format> <output-file> [--all]
  if (args.length < 2) {
    throw new Error('export requires format and output file');
  }

  return {
    format: args[0],
    outputFile: args[1],
    ...params,
  };
}

/**
 * Build backup command parameters
 * @private
 */
function buildBackupParams(action, args, params) {
  switch (action) {
    case 'create':
      // stickynotes backup create [output-file]
      return {
        outputFile: args[0],
        ...params,
      };

    case 'list':
      // stickynotes backup list
      return params;

    default:
      return params;
  }
}

/**
 * Build restore command parameters
 * @private
 */
function buildRestoreParams(action, args, params) {
  // stickynotes restore <backup-file>
  if (args.length === 0) {
    throw new Error('Missing backup file path');
  }

  return {
    backupFile: args[0],
    ...params,
  };
}

/**
 * Build app command parameters
 * @private
 */
function buildAppParams(action, args, params) {
  switch (action) {
    case 'start':
    case 'stop':
    case 'restart':
    case 'quit':
    case 'show':
    case 'hide':
    case 'panel':
    case 'settings':
    case 'status':
    case 'version':
      // No additional params needed
      return params;

    default:
      return params;
  }
}

/**
 * Build service command parameters
 * @private
 */
function buildServiceParams(action, args, params) {
  switch (action) {
    case 'stop':
    case 'restart':
      // No additional params needed
      return params;

    default:
      return params;
  }
}

/**
 * Build stats command parameters
 * @private
 */
function buildStatsParams(action, args, params) {
  // stickynotes stats [--all]
  return params;
}

/**
 * Build doctor command parameters
 * @private
 */
function buildDoctorParams(action, args, params) {
  // stickynotes doctor [--fix]
  return params;
}

/**
 * Build db command parameters
 * @private
 */
function buildDbParams(action, args, params) {
  switch (action) {
    case 'migrate':
    case 'vacuum':
    case 'integrity':
    case 'stats':
      // No additional params needed
      return params;

    default:
      return params;
  }
}

/**
 * Build paths command parameters
 * @private
 */
function buildPathsParams(action, args, params) {
  // stickynotes paths
  return params;
}

/**
 * Validate a method and params before sending
 * @param {string} method - JSON-RPC method name
 * @param {Object} params - Parameters object
 * @throws {Error} If validation fails
 */
function validateMethodCall(method, params) {
  if (!method) {
    throw new Error('Method cannot be empty');
  }

  if (typeof method !== 'string') {
    throw new Error('Method must be a string');
  }

  if (!method.includes(':')) {
    throw new Error(`Invalid method format: ${method}. Expected format: command:action`);
  }

  if (typeof params !== 'object' || params === null) {
    throw new Error('Params must be an object');
  }
}

module.exports = {
  mapCommand,
  validateMethodCall,
};
