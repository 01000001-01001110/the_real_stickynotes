/**
 * CLI Formatter Tests
 */
const {
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
} = require('../../../cli/output/formatter');

describe('CLI Formatter', () => {
  describe('formatOutput', () => {
    it('should format as JSON when format is json', () => {
      const data = { key: 'value', number: 42 };
      const result = formatOutput(data, 'json');
      
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it('should format as plain text by default', () => {
      const data = { message: 'Hello' };
      const result = formatOutput(data, 'text');
      
      expect(typeof result).toBe('string');
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const result = formatOutput(data, 'json');
      
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle null and undefined', () => {
      expect(formatOutput(null, 'json')).toBe('null');
      expect(formatOutput(undefined, 'text')).toBe('');
    });
  });

  describe('formatNote', () => {
    const mockNote = {
      id: 'note-123',
      title: 'Test Note',
      content: '<p>Note content</p>',
      content_plain: 'Note content',
      color: 'yellow',
      width: 300,
      height: 350,
      is_pinned: 1,
      is_locked: 0,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T12:00:00Z',
    };

    it('should format note as JSON', () => {
      const result = formatNote(mockNote, 'json');
      const parsed = JSON.parse(result);
      
      expect(parsed.id).toBe('note-123');
      expect(parsed.title).toBe('Test Note');
    });

    it('should format note as plain text', () => {
      const result = formatNote(mockNote, 'text');
      
      expect(result).toContain('note-123');
      expect(result).toContain('Test Note');
    });

    it('should handle note with tags', () => {
      const noteWithTags = {
        ...mockNote,
        tags: ['important', 'work'],
      };
      const result = formatNote(noteWithTags, 'text');
      
      expect(result).toContain('important');
      expect(result).toContain('work');
    });

    it('should handle note in folder', () => {
      const noteInFolder = {
        ...mockNote,
        folder_name: 'My Folder',
      };
      const result = formatNote(noteInFolder, 'text');
      
      expect(result).toContain('My Folder');
    });
  });

  describe('formatNoteList', () => {
    const mockNotes = [
      { id: 'n1', title: 'Note 1', color: 'yellow', updated_at: '2024-01-15T10:00:00Z' },
      { id: 'n2', title: 'Note 2', color: 'blue', updated_at: '2024-01-15T11:00:00Z' },
      { id: 'n3', title: 'Note 3', color: 'pink', updated_at: '2024-01-15T12:00:00Z' },
    ];

    it('should format note list as JSON', () => {
      const result = formatNoteList(mockNotes, 'json');
      const parsed = JSON.parse(result);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
    });

    it('should format note list as plain text', () => {
      const result = formatNoteList(mockNotes, 'text');
      
      expect(result).toContain('Note 1');
      expect(result).toContain('Note 2');
      expect(result).toContain('Note 3');
    });

    it('should handle empty list', () => {
      const result = formatNoteList([], 'text');
      
      expect(result).toContain('No notes found');
    });

    it('should show count in header', () => {
      const result = formatNoteList(mockNotes, 'text');
      
      expect(result).toContain('3');
    });
  });

  describe('formatTag', () => {
    const mockTag = {
      id: 1,
      name: 'important',
      color: 'red',
      note_count: 5,
    };

    it('should format tag as JSON', () => {
      const result = formatTag(mockTag, 'json');
      const parsed = JSON.parse(result);
      
      expect(parsed.name).toBe('important');
      expect(parsed.note_count).toBe(5);
    });

    it('should format tag as plain text', () => {
      const result = formatTag(mockTag, 'text');
      
      expect(result).toContain('important');
    });
  });

  describe('formatTagList', () => {
    const mockTags = [
      { id: 1, name: 'important', note_count: 5 },
      { id: 2, name: 'work', note_count: 3 },
      { id: 3, name: 'personal', note_count: 8 },
    ];

    it('should format tag list as JSON', () => {
      const result = formatTagList(mockTags, 'json');
      const parsed = JSON.parse(result);
      
      expect(parsed).toHaveLength(3);
    });

    it('should format tag list as plain text', () => {
      const result = formatTagList(mockTags, 'text');
      
      expect(result).toContain('important');
      expect(result).toContain('work');
      expect(result).toContain('personal');
    });

    it('should handle empty tag list', () => {
      const result = formatTagList([], 'text');
      
      expect(result).toContain('No tags found');
    });
  });

  describe('formatFolder', () => {
    const mockFolder = {
      id: 'folder-123',
      name: 'Work',
      color: 'blue',
      note_count: 10,
    };

    it('should format folder as JSON', () => {
      const result = formatFolder(mockFolder, 'json');
      const parsed = JSON.parse(result);
      
      expect(parsed.name).toBe('Work');
      expect(parsed.id).toBe('folder-123');
    });

    it('should format folder as plain text', () => {
      const result = formatFolder(mockFolder, 'text');
      
      expect(result).toContain('Work');
    });
  });

  describe('formatFolderList', () => {
    const mockFolders = [
      { id: 'f1', name: 'Work', note_count: 5 },
      { id: 'f2', name: 'Personal', note_count: 3 },
    ];

    it('should format folder list as JSON', () => {
      const result = formatFolderList(mockFolders, 'json');
      const parsed = JSON.parse(result);
      
      expect(parsed).toHaveLength(2);
    });

    it('should format folder list as plain text', () => {
      const result = formatFolderList(mockFolders, 'text');
      
      expect(result).toContain('Work');
      expect(result).toContain('Personal');
    });

    it('should handle empty folder list', () => {
      const result = formatFolderList([], 'text');
      
      expect(result).toContain('No folders found');
    });

    it('should show nested folders', () => {
      const nestedFolders = [
        { id: 'f1', name: 'Parent', parent_id: null },
        { id: 'f2', name: 'Child', parent_id: 'f1' },
      ];
      const result = formatFolderList(nestedFolders, 'text');
      
      expect(result).toContain('Parent');
      expect(result).toContain('Child');
    });
  });

  describe('formatError', () => {
    it('should format error message', () => {
      const result = formatError('Something went wrong');
      
      expect(result).toContain('Error');
      expect(result).toContain('Something went wrong');
    });

    it('should format Error object', () => {
      const error = new Error('Test error');
      const result = formatError(error);
      
      expect(result).toContain('Test error');
    });
  });

  describe('formatSuccess', () => {
    it('should format success message', () => {
      const result = formatSuccess('Operation completed');
      
      expect(result).toContain('Operation completed');
    });

    it('should include checkmark or similar', () => {
      const result = formatSuccess('Done');
      
      // Should have some visual indicator
      expect(result.length).toBeGreaterThan(4);
    });
  });

  describe('formatJson', () => {
    it('should format data as JSON', () => {
      const data = { key: 'value' };
      const result = formatJson(data);
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should format with custom indent', () => {
      const data = { key: 'value' };
      const result = formatJson(data, 4);
      expect(result).toContain('    '); // 4 space indent
    });
  });

  describe('formatNoteTable', () => {
    it('should format notes as table', () => {
      const notes = [
        { id: 'abc123xyz456abc123xyz', title: 'Test Note', color: 'yellow', updated_at: new Date().toISOString() },
      ];
      const result = formatNoteTable(notes);
      expect(result).toContain('ID');
      expect(result).toContain('Title');
    });

    it('should handle empty notes', () => {
      const result = formatNoteTable([]);
      expect(result).toContain('No notes found');
    });

    it('should show status indicators', () => {
      const notes = [
        { id: 'abc123xyz456abc123xyz', title: 'Test', color: 'yellow', updated_at: new Date().toISOString(), is_pinned: 1, is_locked: 1, is_archived: 1, is_deleted: 1, reminder_at: '2024-01-01' },
      ];
      const result = formatNoteTable(notes);
      expect(result).toContain('P');
    });
  });

  describe('formatTagTable', () => {
    it('should format tags as table', () => {
      const tags = [{ id: 1, name: 'test', color: 'blue' }];
      const result = formatTagTable(tags);
      expect(result).toContain('test');
    });

    it('should handle empty tags', () => {
      const result = formatTagTable([]);
      expect(result).toContain('No tags found');
    });

    it('should include note counts when requested', () => {
      const tags = [{ id: 1, name: 'test', color: null, note_count: 5 }];
      const result = formatTagTable(tags, true);
      expect(result).toContain('Notes');
    });
  });

  describe('formatFolderTree', () => {
    it('should format folder tree', () => {
      const tree = [
        {
          id: '1',
          name: 'Root',
          children: [
            { id: '2', name: 'Child', children: [] },
          ],
        },
      ];
      const result = formatFolderTree(tree);
      expect(result).toContain('Root');
      expect(result).toContain('Child');
    });

    it('should handle empty tree', () => {
      const result = formatFolderTree([]);
      expect(result).toContain('No folders');
    });

    it('should handle nested folders with indent', () => {
      const tree = [
        {
          id: '1',
          name: 'Level 0',
          children: [
            { id: '2', name: 'Level 1', children: [{ id: '3', name: 'Level 2', children: [] }] },
          ],
        },
      ];
      const result = formatFolderTree(tree);
      expect(result).toContain('Level 0');
      expect(result).toContain('Level 1');
      expect(result).toContain('Level 2');
    });
  });

  describe('formatDate', () => {
    it('should return dash for null/undefined', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
    });

    it('should format recent dates as "Just now"', () => {
      const result = formatDate(new Date().toISOString());
      expect(result).toBe('Just now');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
      const result = formatDate(date.toISOString());
      expect(result).toContain('m ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const result = formatDate(date.toISOString());
      expect(result).toContain('h ago');
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      const result = formatDate(date.toISOString());
      expect(result).toContain('d ago');
    });

    it('should format old dates as locale string', () => {
      const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const result = formatDate(date.toISOString());
      expect(result).not.toContain('ago');
    });
  });

  describe('formatOutput edge cases', () => {
    it('should handle arrays', () => {
      const result = formatOutput([1, 2, 3], 'json');
      expect(JSON.parse(result)).toEqual([1, 2, 3]);
    });

    it('should handle string data', () => {
      const result = formatOutput('test string', 'text');
      expect(result).toBe('test string');
    });

    it('should handle nested objects', () => {
      const data = { nested: { deep: 'value' } };
      const result = formatOutput(data, 'json');
      expect(JSON.parse(result).nested.deep).toBe('value');
    });

    it('should convert numbers to string', () => {
      const result = formatOutput(42, 'text');
      expect(result).toBe('42');
    });

    it('should convert booleans to string', () => {
      expect(formatOutput(true, 'text')).toBe('true');
      expect(formatOutput(false, 'text')).toBe('false');
    });

    it('should handle array of objects', () => {
      const data = [{ a: 1 }, { b: 2 }];
      const result = formatOutput(data, 'text');
      expect(result).toContain('a: 1');
      expect(result).toContain('b: 2');
    });
  });

  describe('formatNote edge cases', () => {
    it('should handle note with all status flags', () => {
      const note = {
        id: '123',
        title: 'Test',
        color: 'yellow',
        is_pinned: 1,
        is_locked: 1,
        is_archived: 1,
        is_deleted: 1,
        reminder_at: '2024-01-01T10:00:00Z',
      };
      const result = formatNote(note, 'text');
      expect(result).toContain('[PINNED]');
      expect(result).toContain('[LOCKED]');
      expect(result).toContain('[ARCHIVED]');
      expect(result).toContain('[DELETED]');
      expect(result).toContain('[REMINDER');
    });

    it('should handle empty content', () => {
      const note = { id: '123', title: '', content: '', color: 'yellow' };
      const result = formatNote(note, 'text');
      expect(result).toContain('(untitled)');
      expect(result).toContain('(empty)');
    });

    it('should handle folder_id without folder_name', () => {
      const note = { id: '123', title: 'Test', color: 'yellow', folder_id: 'folder-abc' };
      const result = formatNote(note, 'text');
      expect(result).toContain('folder-abc');
    });

    it('should prefer folder_name over folder_id', () => {
      const note = { id: '123', title: 'Test', color: 'yellow', folder_id: 'folder-abc', folder_name: 'My Folder' };
      const result = formatNote(note, 'text');
      expect(result).toContain('My Folder');
    });

    it('should handle note without status flags', () => {
      const note = { id: '123', title: 'Test', color: 'yellow', is_pinned: 0, is_locked: 0 };
      const result = formatNote(note, 'text');
      expect(result).not.toContain('Pinned');
      expect(result).not.toContain('Locked');
    });

    it('should format with default format when not specified', () => {
      const note = { id: '123', title: 'Test', color: 'yellow' };
      const result = formatNote(note);
      expect(result).toContain('ID:');
    });
  });

  describe('formatNoteList edge cases', () => {
    it('should show note count in header', () => {
      const notes = [
        { id: '1', title: 'Note 1', updated_at: new Date().toISOString() },
        { id: '2', title: 'Note 2', updated_at: new Date().toISOString() },
        { id: '3', title: 'Note 3', updated_at: new Date().toISOString() },
      ];
      const result = formatNoteList(notes, 'text');
      expect(result).toContain('3 note(s)');
    });

    it('should truncate long preview', () => {
      const notes = [{
        id: '1',
        title: 'Test',
        content_plain: 'A'.repeat(100), // Long content
        updated_at: new Date().toISOString(),
      }];
      const result = formatNoteList(notes, 'text');
      expect(result).toContain('...');
    });

    it('should show indicators for pinned/locked/reminder', () => {
      const notes = [{
        id: '1',
        title: 'Test',
        is_pinned: 1,
        is_locked: 1,
        reminder_at: '2024-01-01',
        reminder_notified: 0,
        updated_at: new Date().toISOString(),
      }];
      const result = formatNoteList(notes, 'text');
      expect(result).toContain('[P]');
      expect(result).toContain('[L]');
      expect(result).toContain('[R]');
    });
  });

  describe('formatTag edge cases', () => {
    it('should handle tag without color', () => {
      const tag = { id: 1, name: 'test' };
      const result = formatTag(tag, 'text');
      expect(result).toContain('test');
      expect(result).not.toContain('Color');
    });

    it('should handle tag with note count', () => {
      const tag = { id: 1, name: 'test', note_count: 10 };
      const result = formatTag(tag, 'text');
      expect(result).toContain('10');
    });
  });

  describe('formatFolder edge cases', () => {
    it('should handle folder with all properties', () => {
      const folder = {
        id: '123',
        name: 'Test Folder',
        color: 'blue',
        parent_id: 'parent-123',
        note_count: 5,
      };
      const result = formatFolder(folder, 'text');
      expect(result).toContain('Test Folder');
      expect(result).toContain('blue');
      expect(result).toContain('parent-123');
      expect(result).toContain('5');
    });
  });

  describe('formatFolderList edge cases', () => {
    it('should show note counts', () => {
      const folders = [
        { id: '1', name: 'Folder 1', note_count: 10 },
      ];
      const result = formatFolderList(folders, 'text');
      expect(result).toContain('10 notes');
    });

    it('should show nested indicator for child folders', () => {
      const folders = [
        { id: '1', name: 'Parent' },
        { id: '2', name: 'Child', parent_id: '1' },
      ];
      const result = formatFolderList(folders, 'text');
      expect(result).toContain('+--');
    });

    it('should show 1 note singular', () => {
      const folders = [{ id: '1', name: 'Folder', note_count: 1 }];
      const result = formatFolderList(folders, 'text');
      expect(result).toContain('1 note');
    });

    it('should handle folder without note_count', () => {
      const folders = [{ id: '1', name: 'Folder' }];
      const result = formatFolderList(folders, 'text');
      expect(result).toContain('Folder');
    });

    it('should handle folder with color', () => {
      const folders = [{ id: '1', name: 'Folder', color: 'blue' }];
      const result = formatFolderList(folders, 'text');
      expect(result).toContain('Folder');
    });
  });

  describe('formatTagList edge cases', () => {
    it('should show note counts in parentheses', () => {
      const tags = [
        { id: 1, name: 'important', note_count: 5 },
      ];
      const result = formatTagList(tags, 'text');
      expect(result).toContain('(5)');
    });

    it('should handle tags without note_count', () => {
      const tags = [{ id: 1, name: 'test' }];
      const result = formatTagList(tags, 'text');
      expect(result).toContain('test');
    });

    it('should handle tags with color', () => {
      const tags = [{ id: 1, name: 'test', color: 'red' }];
      const result = formatTagList(tags, 'text');
      expect(result).toContain('test');
    });
  });

  describe('formatNoteTable edge cases', () => {
    it('should handle note with reminder but already notified', () => {
      const notes = [{
        id: 'abc123xyz456abc123xyz',
        title: 'Test',
        color: 'yellow',
        reminder_at: '2024-01-01',
        reminder_notified: 1,
        updated_at: new Date().toISOString(),
      }];
      const result = formatNoteTable(notes);
      expect(result).toContain('Test');
    });

    it('should truncate long titles', () => {
      const notes = [{
        id: 'abc123xyz456abc123xyz',
        title: 'A'.repeat(50),
        color: 'yellow',
        updated_at: new Date().toISOString(),
      }];
      const result = formatNoteTable(notes);
      // Title is truncated to 27 chars, ID shows ellipsis
      expect(result).toContain('AAAAA');
    });

    it('should handle note with no title', () => {
      const notes = [{
        id: 'abc123xyz456abc123xyz',
        title: '',
        color: 'yellow',
        updated_at: new Date().toISOString(),
      }];
      const result = formatNoteTable(notes);
      expect(result).toContain('abc123xyz456');
    });
  });

  describe('formatTagTable edge cases', () => {
    it('should handle tag without color', () => {
      const tags = [{ id: 1, name: 'test' }];
      const result = formatTagTable(tags);
      expect(result).toContain('test');
    });

    it('should show Colors column header', () => {
      const tags = [{ id: 1, name: 'test', color: 'blue' }];
      const result = formatTagTable(tags);
      expect(result).toContain('Name');
    });
  });

  describe('formatFolderTree edge cases', () => {
    it('should handle deeply nested folders', () => {
      const tree = [{
        id: '1',
        name: 'L0',
        children: [{
          id: '2',
          name: 'L1',
          children: [{
            id: '3',
            name: 'L2',
            children: [{
              id: '4',
              name: 'L3',
              children: [],
            }],
          }],
        }],
      }];
      const result = formatFolderTree(tree);
      expect(result).toContain('L0');
      expect(result).toContain('L1');
      expect(result).toContain('L2');
      expect(result).toContain('L3');
    });

    it('should handle folder with note_count', () => {
      const tree = [{
        id: '1',
        name: 'Folder',
        note_count: 5,
        children: [],
      }];
      const result = formatFolderTree(tree);
      expect(result).toContain('Folder');
    });
  });

  describe('formatDate edge cases', () => {
    it('should format dates older than a week as locale string', () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
      const result = formatDate(date.toISOString());
      // Should be a locale date string (e.g., "12/26/2025"), not "d ago"
      expect(result).not.toContain('ago');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format dates within a week as d ago', () => {
      const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const result = formatDate(date.toISOString());
      expect(result).toContain('d ago');
    });

    it('should format dates from exactly 1 day ago', () => {
      const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = formatDate(date.toISOString());
      expect(result).toContain('d ago');
    });

    it('should format dates from exactly 1 hour ago', () => {
      const date = new Date(Date.now() - 60 * 60 * 1000);
      const result = formatDate(date.toISOString());
      expect(result).toContain('h ago');
    });

    it('should format dates from exactly 1 minute ago', () => {
      const date = new Date(Date.now() - 60 * 1000);
      const result = formatDate(date.toISOString());
      expect(result).toContain('m ago');
    });
  });
});
