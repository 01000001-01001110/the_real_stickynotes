/**
 * Unified CLI Command Handler
 *
 * All CLI commands in one place, directly using database functions.
 * No HTTP, no proxy - same code path as GUI.
 */
const fs = require('fs');
const path = require('path');
const {
  formatJson,
  formatNote,
  formatNoteList,
  formatNoteTable,
  formatTagTable,
  formatFolderTree,
  formatError,
} = require('./output');

// Database modules - directly imported, same as GUI uses
const notes = require('../../shared/database/notes');
const tags = require('../../shared/database/tags');
const folders = require('../../shared/database/folders');
const search = require('../../shared/database/search');
const settings = require('../../shared/database/settings');
const history = require('../../shared/database/history');
const { getStats, checkIntegrity, vacuum } = require('../../shared/database');
const { settingsSchema, parseSettingValue } = require('../../shared/constants/settings');
const {
  getDatabasePath,
  getAppDataPath,
  getAttachmentsPath,
  getBackupsPath,
  ensureDir,
} = require('../../shared/utils/paths');
const pkg = require('../../package.json');

/**
 * Execute a CLI command
 * @param {Object} parsed - Parsed command from parser.js
 * @param {Object} context - Context object with windowManager, etc.
 * @returns {Object} { output: string, exitCode: number, stayOpen: boolean }
 */
async function executeCommand(parsed, context = {}) {
  const { command, action, args, options } = parsed;
  const { windowManager } = context;

  try {
    switch (command) {
      case 'note':
        return await handleNoteCommand(action, args, options, windowManager);

      case 'tag':
        return await handleTagCommand(action, args, options);

      case 'folder':
        return await handleFolderCommand(action, args, options);

      case 'search':
        return await handleSearchCommand(action, args, options);

      case 'config':
        return await handleConfigCommand(action, args, options);

      case 'export':
        return await handleExportCommand(options);

      case 'backup':
        return await handleBackupCommand(options);

      case 'restore':
        return await handleRestoreCommand(action, options);

      case 'app':
        return await handleAppCommand(action, args, options, windowManager);

      case 'stats':
        return await handleStatsCommand(options);

      case 'version':
        return { output: `StickyNotes v${pkg.version}`, exitCode: 0 };

      case 'doctor':
        return handleDoctorCommand();

      case 'db':
        return await handleDbCommand(action, options);

      case 'paths':
        return handlePathsCommand();

      case 'whisper':
        return await handleWhisperCommand(action, args, options, windowManager);

      case '--help':
      case '-h':
        return { output: getHelpText(), exitCode: 0 };

      case '--version':
      case '-V':
        return { output: `StickyNotes v${pkg.version}`, exitCode: 0 };

      default:
        return {
          output: `Unknown command: ${command}\n\nRun 'stickynotes --help' for usage.`,
          exitCode: 1,
        };
    }
  } catch (error) {
    return { output: formatError(error), exitCode: 1 };
  }
}

// =============================================================================
// NOTE COMMANDS
// =============================================================================

async function handleNoteCommand(action, args, options, windowManager) {
  switch (action) {
    case 'list': {
      const queryOptions = {
        folder_id: options.folder,
        color: options.color,
        archivedOnly: options.archived,
        trashedOnly: options.trash,
        withReminder: options.withReminder,
        overdue: options.overdue,
        sort: options.sort || 'updated_at',
        desc: options.desc !== false,
        limit: options.limit ? parseInt(options.limit) : undefined,
      };

      let noteList = notes.getNotes(queryOptions);

      // Filter by tag if specified
      if (options.tag) {
        const filtered = [];
        for (const n of noteList) {
          const noteTags = tags.getTagsForNote(n.id);
          if (noteTags.some((t) => t.name === options.tag)) {
            filtered.push(n);
          }
        }
        noteList = filtered;
      }

      if (options.json) {
        return { output: formatJson(noteList), exitCode: 0 };
      }
      return { output: formatNoteTable(noteList), exitCode: 0 };
    }

    case 'show': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }

      const note = notes.getNoteById(noteId);
      if (!note) {
        return { output: `Note not found: ${noteId}`, exitCode: 1 };
      }

      const result = { ...note };
      if (options.withTags) {
        result.tags = tags.getTagsForNote(noteId);
      }
      if (options.withHistory) {
        result.history = history.getNoteHistory(noteId);
      }

      if (options.json) {
        return { output: formatJson(result), exitCode: 0 };
      }
      return { output: formatNote(result), exitCode: 0 };
    }

    case 'create': {
      const noteData = {
        title: options.title,
        content: options.content,
        folder_id: options.folder,
        color: options.color,
      };

      const created = notes.createNote(noteData);

      // Add tags if specified
      if (options.tags) {
        const tagNames = options.tags.split(',').map((t) => t.trim());
        for (const tagName of tagNames) {
          tags.addTagToNote(created.id, tagName);
        }
      }

      // Open in window if requested
      let stayOpen = false;
      if (options.open && windowManager) {
        windowManager.openNote(created.id);
        stayOpen = true;
      }

      if (options.json) {
        return { output: formatJson(created), exitCode: 0, stayOpen };
      }
      return { output: `Created note: ${created.id}`, exitCode: 0, stayOpen };
    }

    case 'edit': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }

      const existing = notes.getNoteById(noteId);
      if (!existing) {
        return { output: `Note not found: ${noteId}`, exitCode: 1 };
      }

      const updates = {};
      if (options.title !== undefined) updates.title = options.title;
      if (options.content !== undefined) updates.content = options.content;
      if (options.append) updates.content = (existing.content || '') + options.append;
      if (options.color) updates.color = options.color;
      if (options.folder !== undefined) updates.folder_id = options.folder || null;

      const updated = notes.updateNote(noteId, updates);

      if (options.json) {
        return { output: formatJson(updated), exitCode: 0 };
      }
      return { output: `Updated note: ${noteId}`, exitCode: 0 };
    }

    case 'delete': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }

      let success;
      if (options.force) {
        success = notes.permanentlyDeleteNote(noteId);
        if (success) {
          return {
            output: options.json
              ? formatJson({ success: true, permanent: true })
              : `Permanently deleted: ${noteId}`,
            exitCode: 0,
          };
        }
      } else {
        success = notes.deleteNote(noteId);
        if (success) {
          return {
            output: options.json
              ? formatJson({ success: true, permanent: false })
              : `Moved to trash: ${noteId}`,
            exitCode: 0,
          };
        }
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'restore': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      const result = notes.restoreNote(noteId);
      if (result) {
        return { output: `Restored note: ${noteId}`, exitCode: 0 };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'archive': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      const result = notes.archiveNote(noteId);
      if (result) {
        return { output: `Archived note: ${noteId}`, exitCode: 0 };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'unarchive': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      const result = notes.unarchiveNote(noteId);
      if (result) {
        return { output: `Unarchived note: ${noteId}`, exitCode: 0 };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'pin': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      const result = notes.updateNote(noteId, { is_pinned: 1 });
      if (result) {
        return { output: `Pinned note: ${noteId}`, exitCode: 0 };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'unpin': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      const result = notes.updateNote(noteId, { is_pinned: 0 });
      if (result) {
        return { output: `Unpinned note: ${noteId}`, exitCode: 0 };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'lock': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      if (!options.password) {
        return { output: 'Error: --password required', exitCode: 1 };
      }
      const result = await notes.lockNote(noteId, options.password);
      if (result) {
        return {
          output: `Locked note: ${noteId}\nWARNING: If you forget the password, the content cannot be recovered!`,
          exitCode: 0,
        };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'unlock': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      if (!options.password) {
        return { output: 'Error: --password required', exitCode: 1 };
      }
      const result = await notes.unlockNote(noteId, options.password);
      if (result) {
        return { output: `Unlocked note: ${noteId}`, exitCode: 0 };
      }
      return { output: `Incorrect password or note not found`, exitCode: 1 };
    }

    case 'duplicate': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      const result = notes.duplicateNote(noteId);
      if (result) {
        if (options.json) {
          return { output: formatJson(result), exitCode: 0 };
        }
        return { output: `Duplicated note: ${result.id}`, exitCode: 0 };
      }
      return { output: `Note not found: ${noteId}`, exitCode: 1 };
    }

    case 'history': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      let noteHistory = history.getNoteHistory(noteId);
      if (options.limit) {
        noteHistory = noteHistory.slice(0, parseInt(options.limit));
      }

      if (options.json) {
        return { output: formatJson(noteHistory), exitCode: 0 };
      }

      if (noteHistory.length === 0) {
        return { output: 'No version history', exitCode: 0 };
      }

      const output = noteHistory
        .map(
          (entry, i) =>
            `[${i + 1}] Version ${entry.id} - ${new Date(entry.saved_at).toLocaleString()}\n   Title: ${entry.title || '(untitled)'}\n   Content: ${(entry.content || '').substring(0, 50)}...`
        )
        .join('\n\n');
      return { output, exitCode: 0 };
    }

    case 'revert': {
      const noteId = args[0];
      const versionId = args[1];
      if (!noteId || !versionId) {
        return { output: 'Error: Note ID and Version ID required', exitCode: 1 };
      }
      const result = history.revertToVersion(noteId, parseInt(versionId));
      if (result) {
        return { output: `Reverted note ${noteId} to version ${versionId}`, exitCode: 0 };
      }
      return { output: 'Version not found or note not found', exitCode: 1 };
    }

    case 'purge': {
      const trashedNotes = notes.getNotes({ trashedOnly: true });
      let count = 0;

      for (const n of trashedNotes) {
        if (options.days) {
          const deletedAt = new Date(n.deleted_at);
          const daysAgo = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysAgo < parseInt(options.days)) continue;
        }
        notes.permanentlyDeleteNote(n.id);
        count++;
      }

      return { output: `Purged ${count} notes from trash`, exitCode: 0 };
    }

    default:
      return { output: `Unknown note action: ${action}`, exitCode: 1 };
  }
}

// =============================================================================
// TAG COMMANDS
// =============================================================================

async function handleTagCommand(action, args, options) {
  switch (action) {
    case 'list': {
      const tagList = tags.getTags({ withCounts: options.withCounts });
      if (options.json) {
        return { output: formatJson(tagList), exitCode: 0 };
      }
      return { output: formatTagTable(tagList, options.withCounts), exitCode: 0 };
    }

    case 'delete': {
      const name = args[0];
      if (!name) {
        return { output: 'Error: Tag name required', exitCode: 1 };
      }
      const result = tags.deleteTag(name);
      if (result) {
        return { output: `Deleted tag: ${name}`, exitCode: 0 };
      }
      return { output: `Tag not found: ${name}`, exitCode: 1 };
    }

    case 'add': {
      const noteId = args[0];
      const tagName = args[1];
      if (!noteId || !tagName) {
        return { output: 'Error: Note ID and tag name required', exitCode: 1 };
      }
      const result = tags.addTagToNote(noteId, tagName);
      if (result) {
        return { output: `Added tag "${tagName}" to note ${noteId}`, exitCode: 0 };
      }
      return { output: 'Failed to add tag', exitCode: 1 };
    }

    case 'remove': {
      const noteId = args[0];
      const tagName = args[1];
      if (!noteId || !tagName) {
        return { output: 'Error: Note ID and tag name required', exitCode: 1 };
      }
      const result = tags.removeTagFromNote(noteId, tagName);
      if (result) {
        return { output: `Removed tag "${tagName}" from note ${noteId}`, exitCode: 0 };
      }
      return { output: 'Tag not found on note', exitCode: 1 };
    }

    default:
      return { output: `Unknown tag action: ${action}`, exitCode: 1 };
  }
}

// =============================================================================
// FOLDER COMMANDS
// =============================================================================

async function handleFolderCommand(action, args, options) {
  switch (action) {
    case 'list': {
      if (options.tree) {
        const tree = folders.getFolderTree();
        if (options.json) {
          return { output: formatJson(tree), exitCode: 0 };
        }
        return { output: formatFolderTree(tree), exitCode: 0 };
      }
      const folderList = folders.getFolders();
      if (options.json) {
        return { output: formatJson(folderList), exitCode: 0 };
      }
      if (folderList.length === 0) {
        return { output: 'No folders', exitCode: 0 };
      }
      const output = folderList.map((f) => `${f.id}  ${f.name}`).join('\n');
      return { output, exitCode: 0 };
    }

    case 'create': {
      const name = args[0];
      if (!name) {
        return { output: 'Error: Folder name required', exitCode: 1 };
      }
      const newFolder = folders.createFolder({
        name,
        parent_id: options.parent,
        color: options.color,
      });
      if (options.json) {
        return { output: formatJson(newFolder), exitCode: 0 };
      }
      return { output: `Created folder: ${newFolder.id}`, exitCode: 0 };
    }

    case 'rename': {
      const id = args[0];
      const newName = args[1];
      if (!id || !newName) {
        return { output: 'Error: Folder ID and new name required', exitCode: 1 };
      }
      const result = folders.updateFolder(id, { name: newName });
      if (result) {
        return { output: `Renamed folder to: ${newName}`, exitCode: 0 };
      }
      return { output: `Folder not found: ${id}`, exitCode: 1 };
    }

    case 'move': {
      const id = args[0];
      if (!id) {
        return { output: 'Error: Folder ID required', exitCode: 1 };
      }
      const parentId = options.parent === 'none' ? null : options.parent;
      const result = folders.updateFolder(id, { parent_id: parentId });
      if (result) {
        return { output: `Moved folder ${id} to ${parentId || 'root'}`, exitCode: 0 };
      }
      return { output: `Folder not found: ${id}`, exitCode: 1 };
    }

    case 'delete': {
      const id = args[0];
      if (!id) {
        return { output: 'Error: Folder ID required', exitCode: 1 };
      }
      const result = folders.deleteFolder(id, options.force);
      if (result) {
        return { output: `Deleted folder: ${id}`, exitCode: 0 };
      }
      return { output: `Folder not found: ${id}`, exitCode: 1 };
    }

    case 'notes': {
      const id = args[0];
      if (!id) {
        return { output: 'Error: Folder ID required', exitCode: 1 };
      }
      const noteList = notes.getNotes({ folder_id: id });
      if (options.json) {
        return { output: formatJson(noteList), exitCode: 0 };
      }
      if (noteList.length === 0) {
        return { output: 'No notes in this folder', exitCode: 0 };
      }
      const output = noteList.map((n) => `${n.id}  ${n.title || '(untitled)'}`).join('\n');
      return { output, exitCode: 0 };
    }

    default:
      return { output: `Unknown folder action: ${action}`, exitCode: 1 };
  }
}

// =============================================================================
// SEARCH COMMAND
// =============================================================================

async function handleSearchCommand(query, args, options) {
  // query is actually the first positional arg (action in parsed)
  const searchQuery = query || args[0];
  if (!searchQuery) {
    return { output: 'Error: Search query required', exitCode: 1 };
  }

  const searchOptions = {
    folder_id: options.folder,
    includeArchived: options.archived,
    includeDeleted: options.trash,
    limit: options.limit ? parseInt(options.limit) : undefined,
  };

  const results = search.searchNotes(searchQuery, searchOptions);

  if (options.json) {
    return { output: formatJson(results), exitCode: 0 };
  }

  if (results.length === 0) {
    return { output: 'No results found', exitCode: 0 };
  }

  return {
    output: `Found ${results.length} result(s):\n\n${formatNoteTable(results)}`,
    exitCode: 0,
  };
}

// =============================================================================
// CONFIG COMMANDS
// =============================================================================

async function handleConfigCommand(action, args, options) {
  switch (action) {
    case 'list': {
      const allSettings = settings.getAllSettings();
      if (options.json) {
        return { output: formatJson(allSettings), exitCode: 0 };
      }

      // Group by category
      const categories = {};
      for (const [key, value] of Object.entries(allSettings)) {
        const [category] = key.split('.');
        if (!categories[category]) categories[category] = [];
        categories[category].push({ key, value });
      }

      let output = '';
      for (const [category, items] of Object.entries(categories)) {
        output += `\n[${category}]\n`;
        for (const { key, value } of items) {
          const displayValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
          output += `  ${key} = ${displayValue}\n`;
        }
      }
      return { output, exitCode: 0 };
    }

    case 'get': {
      const key = args[0];
      if (!key) {
        return { output: 'Error: Setting key required', exitCode: 1 };
      }
      const value = settings.getSetting(key);
      if (options.json) {
        return { output: formatJson({ key, value }), exitCode: 0 };
      }
      return { output: String(value), exitCode: 0 };
    }

    case 'set': {
      const key = args[0];
      const value = args[1];
      if (!key || value === undefined) {
        return { output: 'Error: Setting key and value required', exitCode: 1 };
      }

      if (!settingsSchema[key]) {
        console.warn(`Warning: Unknown setting key: ${key}`);
      }

      const parsedValue = parseSettingValue(key, value);
      settings.setSetting(key, parsedValue);
      return { output: `Set ${key} = ${parsedValue}`, exitCode: 0 };
    }

    case 'reset': {
      const key = args[0];
      if (options.all || !key) {
        const count = settings.resetAllSettings();
        return { output: `Reset ${count} setting(s) to defaults`, exitCode: 0 };
      }

      const success = settings.resetSetting(key);
      if (success) {
        return { output: `Reset ${key} to default`, exitCode: 0 };
      }
      return { output: `Setting ${key} was already at default value`, exitCode: 0 };
    }

    case 'path': {
      return {
        output: `App Data: ${getAppDataPath()}\nDatabase: ${getDatabasePath()}`,
        exitCode: 0,
      };
    }

    default:
      return { output: `Unknown config action: ${action}`, exitCode: 1 };
  }
}

// =============================================================================
// EXPORT/BACKUP COMMANDS
// =============================================================================

async function handleExportCommand(options) {
  let noteList;

  if (options.note) {
    const note = notes.getNoteById(options.note);
    if (!note) {
      return { output: `Note not found: ${options.note}`, exitCode: 1 };
    }
    noteList = [note];
  } else if (options.folder) {
    noteList = notes.getNotes({ folder_id: options.folder });
  } else {
    noteList = notes.getNotes({});
  }

  // Add tags to notes
  const notesWithTags = noteList.map((note) => ({
    ...note,
    tags: tags.getTagsForNote(note.id).map((t) => t.name),
  }));

  const format = (options.format || 'json').toLowerCase();

  if (format === 'json') {
    const output = formatJson(notesWithTags, 2);
    if (options.output) {
      fs.writeFileSync(options.output, output);
      return {
        output: `Exported ${notesWithTags.length} note(s) to ${options.output}`,
        exitCode: 0,
      };
    }
    return { output, exitCode: 0 };
  }

  // For md/html, write to directory
  const outputDir = options.output || './export';
  ensureDir(outputDir);

  for (const note of notesWithTags) {
    const filename = sanitizeFilename(note.title || note.id) + (format === 'md' ? '.md' : '.html');
    const filepath = path.join(outputDir, filename);
    const content = format === 'md' ? noteToMarkdown(note) : noteToHtml(note);
    fs.writeFileSync(filepath, content);
  }

  return { output: `Exported ${notesWithTags.length} note(s) to ${outputDir}`, exitCode: 0 };
}

async function handleBackupCommand(options) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `stickynotes-backup-${timestamp}.json`;
  const outputPath = options.output || path.join(getBackupsPath(), filename);

  ensureDir(path.dirname(outputPath));

  const allNotes = notes.getNotes({ includeDeleted: true, includeArchived: true });
  const allFolders = folders.getFolders();
  const allTags = tags.getTags();
  const allSettings = settings.getAllSettings();

  // Add tags to notes
  const notesWithTags = allNotes.map((note) => ({
    ...note,
    tags: tags.getTagsForNote(note.id).map((t) => t.name),
  }));

  const backup = {
    version: pkg.version,
    created_at: new Date().toISOString(),
    notes: notesWithTags,
    folders: allFolders,
    tags: allTags,
    settings: allSettings,
  };

  fs.writeFileSync(outputPath, formatJson(backup, 2));

  return {
    output: `Backup created: ${outputPath}\n  Notes: ${backup.notes.length}\n  Folders: ${backup.folders.length}\n  Tags: ${backup.tags.length}`,
    exitCode: 0,
  };
}

async function handleRestoreCommand(file, options) {
  if (!file) {
    return { output: 'Error: Backup file path required', exitCode: 1 };
  }

  if (!fs.existsSync(file)) {
    return { output: `File not found: ${file}`, exitCode: 1 };
  }

  const content = fs.readFileSync(file, 'utf-8');
  let backup;

  try {
    backup = JSON.parse(content);
  } catch {
    return { output: 'Invalid backup file format', exitCode: 1 };
  }

  let output = `Backup contents:\n  Created: ${backup.created_at}\n  Notes: ${backup.notes?.length || 0}\n  Folders: ${backup.folders?.length || 0}\n  Tags: ${backup.tags?.length || 0}`;

  if (options.dryRun) {
    output += '\n\n[Dry run - no changes made]';
  } else {
    output += '\n\nUse the desktop app for full restore capabilities.';
  }

  return { output, exitCode: 0 };
}

// =============================================================================
// APP COMMANDS
// =============================================================================

async function handleAppCommand(action, args, options, windowManager) {
  if (!windowManager) {
    return { output: 'App control requires running instance. Start the app first.', exitCode: 1 };
  }

  switch (action) {
    case 'status':
      return { output: '[OK] StickyNotes app is running', exitCode: 0 };

    case 'show':
      if (options.note) {
        windowManager.openNote(options.note);
        return { output: `Showing note: ${options.note}`, exitCode: 0, stayOpen: true };
      }
      windowManager.showAllNotes();
      return { output: 'Showing all notes', exitCode: 0, stayOpen: true };

    case 'hide':
      if (options.note) {
        windowManager.closeNote(options.note);
        return { output: `Hiding note: ${options.note}`, exitCode: 0 };
      }
      windowManager.hideAllNotes();
      return { output: 'Hiding all notes', exitCode: 0 };

    case 'open': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      windowManager.openNote(noteId);
      return { output: `Opened note: ${noteId}`, exitCode: 0, stayOpen: true };
    }

    case 'close': {
      const noteId = args[0];
      if (!noteId) {
        return { output: 'Error: Note ID required', exitCode: 1 };
      }
      windowManager.closeNote(noteId);
      return { output: `Closed note: ${noteId}`, exitCode: 0 };
    }

    case 'panel':
      windowManager.showPanel();
      return { output: 'Showing notes panel', exitCode: 0, stayOpen: true };

    case 'new': {
      const note = notes.createNote({
        title: options.title,
        content: options.content,
      });
      windowManager.openNote(note.id);
      return { output: `Created and opened note: ${note.id}`, exitCode: 0, stayOpen: true };
    }

    case 'reload':
      windowManager.broadcast('notes:reload');
      return { output: 'Reloaded notes', exitCode: 0 };

    case 'quit': {
      const { app } = require('electron');
      setTimeout(() => {
        if (global.appState) global.appState.isQuitting = true;
        global.isQuitting = true;
        app.quit();
      }, 100);
      return { output: 'Quitting StickyNotes', exitCode: 0 };
    }

    default:
      return { output: `Unknown app action: ${action}`, exitCode: 1 };
  }
}

// =============================================================================
// UTILITY COMMANDS
// =============================================================================

async function handleStatsCommand(options) {
  const stats = getStats();

  if (options.json) {
    return { output: formatJson(stats), exitCode: 0 };
  }

  return {
    output: `StickyNotes Statistics
======================

Notes:
  Total:      ${stats.notes?.total || 0}
  Active:     ${stats.notes?.active || 0}
  Archived:   ${stats.notes?.archived || 0}
  Trashed:    ${stats.notes?.trashed || 0}

Folders:      ${stats.folders || 0}
Tags:         ${stats.tags || 0}
Attachments:  ${stats.attachments || 0}`,
    exitCode: 0,
  };
}

function handleDoctorCommand() {
  const result = checkIntegrity();
  if (result.ok) {
    return { output: '[OK] Database integrity check passed', exitCode: 0 };
  }
  return { output: `[FAIL] Database integrity check failed:\n${result.message}`, exitCode: 1 };
}

async function handleDbCommand(action, options) {
  switch (action) {
    case 'path':
      return { output: getDatabasePath(), exitCode: 0 };

    case 'vacuum':
      vacuum();
      return { output: 'Database compacted successfully', exitCode: 0 };

    default:
      return { output: `Unknown db action: ${action}`, exitCode: 1 };
  }
}

function handlePathsCommand() {
  return {
    output: `Application Paths
=================
App Data:     ${getAppDataPath()}
Database:     ${getDatabasePath()}
Attachments:  ${getAttachmentsPath()}
Backups:      ${getBackupsPath()}`,
    exitCode: 0,
  };
}

// =============================================================================
// WHISPER COMMANDS
// =============================================================================

async function handleWhisperCommand(action, args, options, windowManager) {
  const { WHISPER_MODELS } = require('../../shared/constants/whisper');

  switch (action) {
    case 'status': {
      try {
        const modelManager = require('../whisper/model-manager');
        const whisperService = require('../whisper/service');

        const modelSize = settings.getSetting('whisper.modelSize') || 'small';
        const status = await modelManager.getStatus(modelSize);
        const serviceStatus = whisperService.getServiceStatus();

        const result = {
          enabled: settings.getSetting('whisper.enabled'),
          modelSize,
          loaded: serviceStatus.loaded,
          modelExists: status.exists,
          modelPath: status.path,
          serviceStatus: serviceStatus.loaded
            ? 'ready'
            : serviceStatus.loading
              ? 'loading'
              : 'idle',
        };

        if (options.json) {
          return { output: formatJson(result), exitCode: 0 };
        }

        return {
          output: `=== Whisper Status ===

Enabled:        ${result.enabled ? 'Yes' : 'No'}
Model Size:     ${result.modelSize}
Model Loaded:   ${result.loaded ? 'Yes' : 'No'}
Model Exists:   ${result.modelExists ? 'Yes' : 'No'}
Service Status: ${result.serviceStatus}`,
          exitCode: 0,
        };
      } catch (error) {
        return { output: `Error: ${error.message}`, exitCode: 1 };
      }
    }

    case 'list': {
      const models = Object.entries(WHISPER_MODELS).map(([size, model]) => ({
        size,
        name: model.name,
        fileSize: model.size,
        description: model.description,
      }));

      if (options.json) {
        return { output: formatJson(models), exitCode: 0 };
      }

      let output = '=== Available Whisper Models ===\n';
      for (const model of models) {
        output += `\n${model.size}\n  Size: ${model.fileSize}\n  ${model.description}\n`;
      }
      return { output, exitCode: 0 };
    }

    default:
      return { output: `Unknown whisper action: ${action}`, exitCode: 1 };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

function noteToMarkdown(note) {
  let md = '';
  if (note.title) {
    md += `# ${note.title}\n\n`;
  }
  if (note.tags && note.tags.length > 0) {
    md += `Tags: ${note.tags.join(', ')}\n\n`;
  }
  md += note.content_plain || note.content || '';
  md += '\n';
  return md;
}

function noteToHtml(note) {
  const escapeHtml = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${note.title || 'Note'}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .tags { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    .content { line-height: 1.6; }
  </style>
</head>
<body>
  ${note.title ? `<h1>${escapeHtml(note.title)}</h1>` : ''}
  ${note.tags && note.tags.length > 0 ? `<div class="tags">Tags: ${note.tags.join(', ')}</div>` : ''}
  <div class="content">${note.content || escapeHtml(note.content_plain || '')}</div>
</body>
</html>`;
}

function getHelpText() {
  return `StickyNotes CLI v${pkg.version}

Usage: stickynotes <command> [options]

Commands:
  note        Manage notes (list, create, edit, delete, etc.)
  tag         Manage tags (list, add, remove, delete)
  folder      Manage folders (list, create, rename, delete)
  search      Search notes using full-text search
  config      Manage settings (list, get, set, reset)
  export      Export notes to JSON/Markdown/HTML
  backup      Create a full backup
  restore     Restore from backup
  app         Control the running app (show, hide, panel, quit)
  stats       Show database statistics
  doctor      Check database integrity
  db          Database utilities (path, vacuum)
  paths       Show application paths
  whisper     Manage Whisper transcription model

Options:
  --json      Output as JSON (available for most commands)
  --help, -h  Show help

Examples:
  stickynotes note list --json
  stickynotes note create --title "Hello" --open
  stickynotes search "meeting" --limit 10
  stickynotes config set appearance.theme dark
  stickynotes app panel
`;
}

module.exports = {
  executeCommand,
  getHelpText,
};
