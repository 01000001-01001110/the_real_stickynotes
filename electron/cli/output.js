/**
 * CLI Output Formatting Utilities
 *
 * Provides consistent formatting for CLI output.
 * Moved from cli/output/formatter.js to electron/cli/output.js
 */
const chalk = require('chalk');
const Table = require('cli-table3');

/**
 * Format data as JSON
 */
function formatJson(data, indent = 2) {
  return JSON.stringify(data, null, indent);
}

/**
 * Generic output formatter
 */
function formatOutput(data, format = 'text') {
  if (format === 'json') {
    return formatJson(data);
  }
  if (data === null || data === undefined) {
    return '';
  }
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => formatOutput(item, format)).join('\n');
  }
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  return String(data);
}

/**
 * Format a single note for display
 */
function formatNote(note, format = 'text') {
  if (format === 'json') {
    return formatJson(note);
  }

  const lines = [];

  lines.push(chalk.bold(`ID: ${note.id}`));
  lines.push(`Title: ${note.title || chalk.gray('(untitled)')}`);
  lines.push(`Color: ${note.color}`);

  if (note.folder_id || note.folder_name) {
    lines.push(`Folder: ${note.folder_name || note.folder_id}`);
  }

  if (note.tags && note.tags.length > 0) {
    lines.push(`Tags: ${note.tags.join(', ')}`);
  }

  lines.push(`Created: ${formatDate(note.created_at)}`);
  lines.push(`Updated: ${formatDate(note.updated_at)}`);

  // Status indicators
  const status = [];
  if (note.is_pinned) status.push('[PINNED]');
  if (note.is_locked) status.push('[LOCKED]');
  if (note.is_archived) status.push('[ARCHIVED]');
  if (note.is_deleted) status.push('[DELETED]');
  if (note.reminder_at) status.push(`[REMINDER: ${formatDate(note.reminder_at)}]`);

  if (status.length > 0) {
    lines.push(`Status: ${status.join(', ')}`);
  }

  lines.push('');
  lines.push(chalk.gray('─'.repeat(40)));
  lines.push(note.content_plain || note.content || chalk.gray('(empty)'));

  return lines.join('\n');
}

/**
 * Format notes as a list
 */
function formatNoteList(notes, format = 'text') {
  if (format === 'json') {
    return formatJson(notes);
  }

  if (!notes || notes.length === 0) {
    return 'No notes found';
  }

  const header = chalk.bold(`Found ${notes.length} note(s):\n`);
  const list = notes
    .map((note) => {
      const title = note.title || chalk.gray('(untitled)');
      const preview = (note.content_plain || '').substring(0, 50).replace(/\n/g, ' ');
      const indicators = [];

      if (note.is_pinned) indicators.push('[P]');
      if (note.is_locked) indicators.push('[L]');
      if (note.reminder_at && !note.reminder_notified) indicators.push('[R]');

      return `${chalk.blue(note.id)}  ${title} ${indicators.join('')}\n  ${chalk.gray(preview)}${preview.length === 50 ? '...' : ''}`;
    })
    .join('\n\n');

  return header + list;
}

/**
 * Format notes as a table
 */
function formatNoteTable(notes) {
  if (notes.length === 0) {
    return 'No notes found';
  }

  const table = new Table({
    head: ['ID', 'Title', 'Color', 'Updated', 'Status'],
    style: { head: ['cyan'] },
    colWidths: [25, 30, 10, 20, 15],
  });

  notes.forEach((note) => {
    const status = [];
    if (note.is_pinned) status.push('P');
    if (note.is_locked) status.push('L');
    if (note.is_archived) status.push('A');
    if (note.is_deleted) status.push('D');
    if (note.reminder_at) status.push('R');

    table.push([
      note.id.substring(0, 21) + '...',
      (note.title || '(untitled)').substring(0, 27),
      note.color,
      formatDate(note.updated_at),
      status.join('') || '-',
    ]);
  });

  return table.toString();
}

/**
 * Format a single tag
 */
function formatTag(tag, format = 'text') {
  if (format === 'json') {
    return formatJson(tag);
  }

  const lines = [];
  lines.push(chalk.bold(`Tag: ${tag.name}`));
  if (tag.color) lines.push(`Color: ${tag.color}`);
  if (tag.note_count !== undefined) lines.push(`Notes: ${tag.note_count}`);
  return lines.join('\n');
}

/**
 * Format tags as a list
 */
function formatTagList(tags, format = 'text') {
  if (format === 'json') {
    return formatJson(tags);
  }

  if (!tags || tags.length === 0) {
    return 'No tags found';
  }

  return tags
    .map((tag) => {
      const count = tag.note_count !== undefined ? ` (${tag.note_count})` : '';
      return `${chalk.cyan(tag.name)}${count}`;
    })
    .join('\n');
}

/**
 * Format tags as a table
 */
function formatTagTable(tags, withCounts = false) {
  if (!tags || tags.length === 0) {
    return 'No tags found';
  }

  const table = new Table({
    head: withCounts ? ['ID', 'Name', 'Color', 'Notes'] : ['ID', 'Name', 'Color'],
    style: { head: ['cyan'] },
  });

  tags.forEach((tag) => {
    const row = [tag.id, tag.name, tag.color || '-'];
    if (withCounts) {
      row.push(tag.note_count || 0);
    }
    table.push(row);
  });

  return table.toString();
}

/**
 * Format a single folder
 */
function formatFolder(folder, format = 'text') {
  if (format === 'json') {
    return formatJson(folder);
  }

  const lines = [];
  lines.push(chalk.bold(`Folder: ${folder.name}`));
  lines.push(`ID: ${folder.id}`);
  if (folder.color) lines.push(`Color: ${folder.color}`);
  if (folder.parent_id) lines.push(`Parent: ${folder.parent_id}`);
  if (folder.note_count !== undefined) lines.push(`Notes: ${folder.note_count}`);
  return lines.join('\n');
}

/**
 * Format folders as a list
 */
function formatFolderList(folders, format = 'text') {
  if (format === 'json') {
    return formatJson(folders);
  }

  if (!folders || folders.length === 0) {
    return 'No folders found';
  }

  return folders
    .map((folder) => {
      const count = folder.note_count !== undefined ? ` (${folder.note_count} notes)` : '';
      const indent = folder.parent_id ? '  +-- ' : '';
      return `${indent}[/] ${folder.name}${count}`;
    })
    .join('\n');
}

/**
 * Format folder tree
 */
function formatFolderTree(tree, indent = 0) {
  let output = '';
  const prefix = '  '.repeat(indent);

  if (!tree || tree.length === 0) {
    return 'No folders';
  }

  for (const folder of tree) {
    output += `${prefix}[/] ${folder.name} (${folder.id})\n`;
    if (folder.children && folder.children.length > 0) {
      output += formatFolderTree(folder.children, indent + 1);
    }
  }

  return output;
}

/**
 * Format a date
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const now = new Date();
  const diff = now - date;

  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than an hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Format as date
  return date.toLocaleDateString();
}

/**
 * Format an error message
 */
function formatError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return chalk.red(`Error: ${message}`);
}

/**
 * Format a success message
 */
function formatSuccess(message) {
  return chalk.green(`[OK] ${message}`);
}

module.exports = {
  formatOutput,
  formatJson,
  formatNote,
  formatNoteList,
  formatNoteTable,
  formatTag,
  formatTagList,
  formatTagTable,
  formatFolder,
  formatFolderList,
  formatFolderTree,
  formatDate,
  formatError,
  formatSuccess,
};
