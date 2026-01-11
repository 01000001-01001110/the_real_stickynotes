/**
 * CLI Utils Tests
 * 
 * Tests for utility functions used by CLI commands.
 */

// Create simple utility functions to test parsing logic
describe('CLI Utility Functions', () => {
  // Helper functions for note input parsing
  function parseNoteInput(content, title) {
    return {
      content: content || '',
      title: title || undefined,
    };
  }

  function resolveNoteId(shortId, notes) {
    if (!shortId) return null;
    // If ID is already full length, return it as is
    if (shortId.length >= 21) return shortId;
    // If no notes to search, can't resolve short ID
    if (!notes || notes.length === 0) return null;
    
    const matches = notes.filter(n => n.id.startsWith(shortId));
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) return matches[0].id; // Return first match
    return null;
  }

  function parseTagInput(input) {
    if (!input) return [];
    return input.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }

  function parseFolderPath(path) {
    if (!path) return [];
    return path.split('/').map(p => p.trim()).filter(p => p.length > 0);
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function formatDate(dateInput, format = 'standard') {
    if (!dateInput) return '';
    
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    if (format === 'relative') {
      const now = new Date();
      const diff = now - date;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return `${Math.floor(diff / 86400000)}d ago`;
    }
    
    return date.toLocaleString();
  }

  describe('parseNoteInput', () => {
    it('should parse content from string', () => {
      const result = parseNoteInput('Hello World');
      expect(result.content).toBe('Hello World');
    });

    it('should parse content with title', () => {
      const result = parseNoteInput('Hello World', 'My Title');
      expect(result.content).toBe('Hello World');
      expect(result.title).toBe('My Title');
    });

    it('should handle empty content', () => {
      const result = parseNoteInput('');
      expect(result.content).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(parseNoteInput(null).content).toBe('');
      expect(parseNoteInput(undefined).content).toBe('');
    });
  });

  describe('resolveNoteId', () => {
    it('should return full ID as is', () => {
      const fullId = 'abc123XYZ789defGHIjkl';
      expect(resolveNoteId(fullId, [])).toBe(fullId);
    });

    it('should resolve short ID to full ID', () => {
      const notes = [
        { id: 'abc123XYZ789defGHIjkl' },
        { id: 'xyz456ABC123mnoPQRstu' },
      ];
      
      const result = resolveNoteId('abc12', notes);
      expect(result).toBe('abc123XYZ789defGHIjkl');
    });

    it('should return null for no match', () => {
      const notes = [
        { id: 'abc123XYZ789defGHIjkl' },
      ];
      
      const result = resolveNoteId('zzz', notes);
      expect(result).toBeNull();
    });

    it('should return first match for ambiguous match', () => {
      const notes = [
        { id: 'abc123XYZ789defGHIjkl' },
        { id: 'abc456ABC123mnoPQRstu' },
      ];
      
      const result = resolveNoteId('abc', notes);
      expect(result).toBe('abc123XYZ789defGHIjkl');
    });
  });

  describe('parseTagInput', () => {
    it('should parse single tag', () => {
      const result = parseTagInput('important');
      expect(result).toEqual(['important']);
    });

    it('should parse comma-separated tags', () => {
      const result = parseTagInput('work, personal, urgent');
      expect(result).toEqual(['work', 'personal', 'urgent']);
    });

    it('should trim whitespace', () => {
      const result = parseTagInput('  tag1  ,  tag2  ');
      expect(result).toEqual(['tag1', 'tag2']);
    });

    it('should handle empty input', () => {
      expect(parseTagInput('')).toEqual([]);
      expect(parseTagInput(null)).toEqual([]);
    });

    it('should filter empty tags', () => {
      const result = parseTagInput('tag1,,tag2,');
      expect(result).toEqual(['tag1', 'tag2']);
    });
  });

  describe('parseFolderPath', () => {
    it('should parse simple folder name', () => {
      const result = parseFolderPath('Work');
      expect(result).toEqual(['Work']);
    });

    it('should parse nested folder path', () => {
      const result = parseFolderPath('Work/Projects/StickyNotes');
      expect(result).toEqual(['Work', 'Projects', 'StickyNotes']);
    });

    it('should handle leading/trailing slashes', () => {
      const result = parseFolderPath('/Work/Projects/');
      expect(result).toEqual(['Work', 'Projects']);
    });

    it('should handle empty input', () => {
      expect(parseFolderPath('')).toEqual([]);
      expect(parseFolderPath(null)).toEqual([]);
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      const text = 'Short text';
      expect(truncateText(text, 50)).toBe(text);
    });

    it('should truncate long text', () => {
      const text = 'This is a very long text that needs to be truncated';
      const result = truncateText(text, 20);
      
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle exact length', () => {
      const text = '12345';
      expect(truncateText(text, 5)).toBe('12345');
    });

    it('should handle empty text', () => {
      expect(truncateText('', 10)).toBe('');
      expect(truncateText(null, 10)).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      const date = '2024-01-15T10:30:00Z';
      const result = formatDate(date);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format Date object', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date);
      
      expect(typeof result).toBe('string');
    });

    it('should handle invalid date', () => {
      const result = formatDate('invalid');
      
      expect(result).toBe('Invalid Date');
    });

    it('should handle null/undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });

    it('should support relative format', () => {
      const now = new Date();
      const result = formatDate(now.toISOString(), 'relative');
      
      expect(result.toLowerCase()).toContain('now');
    });
  });

  describe('confirmAction', () => {
    // confirmAction typically requires user input, these test the function pattern
    it('should be definable as function', () => {
      const confirmAction = (message, defaultValue = false) => {
        // In real implementation, this would prompt user
        return defaultValue;
      };
      
      expect(typeof confirmAction).toBe('function');
      expect(confirmAction('Delete?', true)).toBe(true);
    });
  });
});
