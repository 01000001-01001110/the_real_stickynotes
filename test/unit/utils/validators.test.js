/**
 * Validators Tests
 */
const {
  validateNote,
  validateFolder,
  validateTag,
  sanitizeString,
  extractPlainText,
  validateSearchQuery,
  sanitizeFtsQuery,
  validateLimit,
  validateDays,
  isValidNoteId,
} = require('../../../shared/utils/validators');

describe('Validators', () => {
  describe('validateNote', () => {
    it('should pass for valid note data', () => {
      const result = validateNote({
        title: 'Test Note',
        content: 'Some content',
        color: 'yellow',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for empty data (all optional)', () => {
      const result = validateNote({});
      expect(result.valid).toBe(true);
    });

    it('should fail for non-string title', () => {
      const result = validateNote({ title: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be a string');
    });

    it('should fail for title exceeding 500 characters', () => {
      const result = validateNote({ title: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be 500 characters or less');
    });

    it('should fail for non-string content', () => {
      const result = validateNote({ content: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Content must be a string');
    });

    it('should fail for invalid color', () => {
      const result = validateNote({ color: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Color must be one of');
    });

    it('should accept all valid colors', () => {
      const validColors = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'gray', 'charcoal'];
      for (const color of validColors) {
        const result = validateNote({ color });
        expect(result.valid).toBe(true);
      }
    });

    it('should fail for width less than 150', () => {
      const result = validateNote({ width: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Width must be a number between 150 and 5000');
    });

    it('should fail for height less than 150', () => {
      const result = validateNote({ height: 100 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Height must be a number between 150 and 5000');
    });

    it('should fail for opacity outside 50-100 range', () => {
      expect(validateNote({ opacity: 49 }).valid).toBe(false);
      expect(validateNote({ opacity: 101 }).valid).toBe(false);
      expect(validateNote({ opacity: 50 }).valid).toBe(true);
      expect(validateNote({ opacity: 100 }).valid).toBe(true);
    });

    it('should fail for invalid reminder_at', () => {
      const result = validateNote({ reminder_at: 'not-a-date' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('reminder_at must be a valid ISO date string');
    });

    it('should accept valid reminder_at', () => {
      const result = validateNote({ reminder_at: '2024-12-25T10:00:00Z' });
      expect(result.valid).toBe(true);
    });

    it('should accept null reminder_at', () => {
      const result = validateNote({ reminder_at: null });
      expect(result.valid).toBe(true);
    });

    it('should collect multiple errors', () => {
      const result = validateNote({
        title: 123,
        content: 456,
        color: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should fail for content exceeding max length', () => {
      const hugeContent = 'a'.repeat(1024 * 1024 + 1); // Over 1MB
      const result = validateNote({ content: hugeContent });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('bytes or less');
    });

    it('should fail for width over 5000', () => {
      const result = validateNote({ width: 6000 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Width must be a number between 150 and 5000');
    });

    it('should fail for height over 5000', () => {
      const result = validateNote({ height: 6000 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Height must be a number between 150 and 5000');
    });

    it('should fail for non-finite position_x', () => {
      expect(validateNote({ position_x: Infinity }).valid).toBe(false);
      expect(validateNote({ position_x: NaN }).valid).toBe(false);
      expect(validateNote({ position_x: 'abc' }).valid).toBe(false);
    });

    it('should fail for non-finite position_y', () => {
      expect(validateNote({ position_y: Infinity }).valid).toBe(false);
      expect(validateNote({ position_y: NaN }).valid).toBe(false);
      expect(validateNote({ position_y: 'abc' }).valid).toBe(false);
    });

    it('should accept valid position values', () => {
      expect(validateNote({ position_x: 0, position_y: 0 }).valid).toBe(true);
      expect(validateNote({ position_x: -100, position_y: -200 }).valid).toBe(true);
      expect(validateNote({ position_x: 1920, position_y: 1080 }).valid).toBe(true);
    });

    it('should fail for non-number width', () => {
      const result = validateNote({ width: '300' });
      expect(result.valid).toBe(false);
    });

    it('should fail for non-number height', () => {
      const result = validateNote({ height: '350' });
      expect(result.valid).toBe(false);
    });

    it('should fail for non-number opacity', () => {
      const result = validateNote({ opacity: '75' });
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFolder', () => {
    it('should pass for valid folder data', () => {
      const result = validateFolder({ name: 'My Folder' });
      expect(result.valid).toBe(true);
    });

    it('should fail for missing name', () => {
      const result = validateFolder({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail for empty name', () => {
      const result = validateFolder({ name: '' });
      expect(result.valid).toBe(false);
    });

    it('should fail for non-string name', () => {
      const result = validateFolder({ name: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should fail for name exceeding 100 characters', () => {
      const result = validateFolder({ name: 'a'.repeat(101) });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be 100 characters or less');
    });

    it('should accept null color', () => {
      const result = validateFolder({ name: 'Test', color: null });
      expect(result.valid).toBe(true);
    });

    it('should fail for invalid color', () => {
      const result = validateFolder({ name: 'Test', color: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Color must be one of');
    });

    it('should accept valid folder color', () => {
      const result = validateFolder({ name: 'Test', color: 'green' });
      expect(result.valid).toBe(true);
    });

    it('should fail for non-string folder name (number)', () => {
      const result = validateFolder({ name: 12345 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should fail for null folder name', () => {
      const result = validateFolder({ name: null });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });
  });

  describe('validateTag', () => {
    it('should pass for valid tag data', () => {
      const result = validateTag({ name: 'my-tag' });
      expect(result.valid).toBe(true);
    });

    it('should fail for missing name', () => {
      const result = validateTag({});
      expect(result.valid).toBe(false);
    });

    it('should fail for name exceeding 50 characters', () => {
      const result = validateTag({ name: 'a'.repeat(51) });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be 50 characters or less');
    });

    it('should fail for names with invalid characters', () => {
      // Invalid: dangerous chars like < > / \ : * ? " | and control chars
      const invalidNames = ['has<bracket', 'has>bracket', 'has/slash', 'has\\backslash', 'has:colon', 'has*star', 'has?question', 'has"quote', 'has|pipe'];
      for (const name of invalidNames) {
        const result = validateTag({ name });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Name contains invalid characters');
      }
    });

    it('should accept valid tag names', () => {
      // Now allows unicode, spaces, and common punctuation
      const validNames = ['my-tag', 'my_tag', 'MyTag123', 'TAG', 'has space', 'has.dot', 'café', '日本語', 'To Read'];
      for (const name of validNames) {
        const result = validateTag({ name });
        expect(result.valid).toBe(true);
      }
    });

    it('should fail for non-string tag name (number)', () => {
      const result = validateTag({ name: 12345 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should fail for non-string tag name (array)', () => {
      const result = validateTag({ name: ['array'] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should fail for non-string tag name (object)', () => {
      const result = validateTag({ name: { object: true } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });

    it('should fail for invalid tag color', () => {
      const result = validateTag({ name: 'valid-tag', color: 'invalid-color' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Color must be one of');
    });

    it('should accept valid tag color', () => {
      const result = validateTag({ name: 'valid-tag', color: 'blue' });
      expect(result.valid).toBe(true);
    });

    it('should accept null tag color', () => {
      const result = validateTag({ name: 'valid-tag', color: null });
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should return empty string for non-strings', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
      expect(sanitizeString(123)).toBe('');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('extractPlainText', () => {
    it('should remove HTML tags', () => {
      expect(extractPlainText('<p>Hello</p>')).toBe('Hello');
      expect(extractPlainText('<b>Bold</b> text')).toBe('Bold text');
    });

    it('should remove markdown bold', () => {
      expect(extractPlainText('**bold**')).toBe('bold');
      expect(extractPlainText('__bold__')).toBe('bold');
    });

    it('should remove markdown italic', () => {
      expect(extractPlainText('*italic*')).toBe('italic');
      expect(extractPlainText('_italic_')).toBe('italic');
    });

    it('should remove markdown strikethrough', () => {
      expect(extractPlainText('~~deleted~~')).toBe('deleted');
    });

    it('should remove markdown headers', () => {
      expect(extractPlainText('# Header')).toBe('Header');
      expect(extractPlainText('## Header 2')).toBe('Header 2');
    });

    it('should remove markdown list markers', () => {
      expect(extractPlainText('- item')).toBe('item');
      expect(extractPlainText('* item')).toBe('item');
      expect(extractPlainText('1. item')).toBe('item');
    });

    it('should extract text from markdown links', () => {
      expect(extractPlainText('[link text](http://example.com)')).toBe('link text');
    });

    it('should extract alt text from images', () => {
      expect(extractPlainText('![alt text](image.png)')).toBe('alt text');
    });

    it('should remove blockquotes', () => {
      expect(extractPlainText('> quoted')).toBe('quoted');
    });

    it('should handle empty/null content', () => {
      expect(extractPlainText('')).toBe('');
      expect(extractPlainText(null)).toBe('');
      expect(extractPlainText(undefined)).toBe('');
    });
  });

  describe('validateSearchQuery', () => {
    it('should pass for valid search query', () => {
      const result = validateSearchQuery('hello world');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('hello world');
    });

    it('should trim whitespace', () => {
      const result = validateSearchQuery('  search term  ');
      expect(result.sanitized).toBe('search term');
    });

    it('should fail for non-string input', () => {
      const result = validateSearchQuery(123);
      expect(result.valid).toBe(false);
    });

    it('should fail for query exceeding max length', () => {
      const longQuery = 'a'.repeat(501);
      const result = validateSearchQuery(longQuery);
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeFtsQuery', () => {
    it('should return safe query for normal input', () => {
      const result = sanitizeFtsQuery('hello world');
      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('should remove FTS special characters from terms', () => {
      const result = sanitizeFtsQuery('test"query\'with*special-chars');
      // The output will be properly formatted for FTS with quotes around terms
      // The key is that the dangerous characters are stripped from the search terms
      expect(result).toContain('testquerywithspecialchars'); // Terms joined without special chars
      // Result should be valid FTS format: "term"*
      expect(result).toMatch(/^"[a-zA-Z0-9]+"\*$/);
    });

    it('should return empty string for empty input', () => {
      expect(sanitizeFtsQuery('')).toBe('');
      expect(sanitizeFtsQuery('   ')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(sanitizeFtsQuery(null)).toBe('');
      expect(sanitizeFtsQuery(undefined)).toBe('');
    });

    it('should handle unicode characters', () => {
      const result = sanitizeFtsQuery('привет мир');
      expect(result).toContain('привет');
      expect(result).toContain('мир');
    });

    it('should prevent SQL injection attempts', () => {
      const result = sanitizeFtsQuery('test" OR 1=1 --');
      // The dangerous characters like " and = and -- are stripped
      // The remaining alphanumeric words become search terms
      expect(result).not.toContain('='); // No equals sign
      expect(result).not.toContain('--'); // No double-dash comments
      // "test", "OR", "1", "11" become separate search terms in FTS format
      // This is safe - they're just search words, not SQL commands
      expect(result).toMatch(/"test"\*/);
    });

    it('should return empty for query exceeding max length', () => {
      const longQuery = 'a'.repeat(501);
      expect(sanitizeFtsQuery(longQuery)).toBe('');
    });

    it('should filter out very long individual terms', () => {
      const result = sanitizeFtsQuery('short ' + 'x'.repeat(101));
      // The very long term is filtered out, only "short" remains
      expect(result).toContain('short');
    });

    it('should return empty for query with only special characters', () => {
      expect(sanitizeFtsQuery('!@#$%^&*()')).toBe('');
      expect(sanitizeFtsQuery('"\'*+-')).toBe('');
    });

    it('should handle mixed valid and invalid terms', () => {
      const result = sanitizeFtsQuery('valid !@# also-valid');
      expect(result).toContain('valid');
      expect(result).toContain('alsovalid');
    });

    it('should handle multiple spaces between terms', () => {
      const result = sanitizeFtsQuery('term1     term2');
      expect(result).toContain('term1');
      expect(result).toContain('term2');
    });
  });

  describe('validateLimit', () => {
    it('should return null for undefined', () => {
      expect(validateLimit(undefined)).toBeNull();
    });

    it('should return null for invalid values', () => {
      expect(validateLimit('abc')).toBeNull();
      expect(validateLimit(-1)).toBeNull();
      expect(validateLimit(0)).toBeNull();
    });

    it('should parse string numbers', () => {
      expect(validateLimit('50')).toBe(50);
    });

    it('should cap at max limit', () => {
      expect(validateLimit(2000, 1000)).toBe(1000);
    });

    it('should return value if under max', () => {
      expect(validateLimit(500, 1000)).toBe(500);
    });
  });

  describe('validateDays', () => {
    it('should return 0 for undefined', () => {
      expect(validateDays(undefined)).toBe(0);
    });

    it('should return 0 for invalid values', () => {
      expect(validateDays('abc')).toBe(0);
      expect(validateDays(-1)).toBe(0);
    });

    it('should parse string numbers', () => {
      expect(validateDays('30')).toBe(30);
    });

    it('should return positive numbers as is', () => {
      expect(validateDays(7)).toBe(7);
    });
  });

  describe('isValidNoteId', () => {
    it('should return true for valid nanoid', () => {
      expect(isValidNoteId('abc123XYZ789defGHIjkl')).toBe(true);
    });

    it('should return false for too short IDs', () => {
      expect(isValidNoteId('abc123')).toBe(false);
    });

    it('should return false for too long IDs', () => {
      expect(isValidNoteId('a'.repeat(51))).toBe(false);
    });

    it('should return false for IDs with invalid characters', () => {
      expect(isValidNoteId('abc123!@#$%^&*()')).toBe(false);
      expect(isValidNoteId('abc 123 def')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isValidNoteId(123)).toBe(false);
      expect(isValidNoteId(null)).toBe(false);
      expect(isValidNoteId(undefined)).toBe(false);
    });

    it('should allow hyphens and underscores', () => {
      expect(isValidNoteId('abc-123_XYZ-789')).toBe(true);
    });
  });
});
