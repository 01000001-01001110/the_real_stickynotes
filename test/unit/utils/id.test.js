/**
 * ID Generation Tests
 */
const {
  generateNoteId,
  generateFolderId,
  generateAttachmentId,
  isValidId,
} = require('../../../shared/utils/id');

describe('ID Generation', () => {
  describe('generateNoteId', () => {
    it('should generate a unique ID', () => {
      const id = generateNoteId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should generate IDs of consistent length', () => {
      const id = generateNoteId();
      expect(id.length).toBe(21); // nanoid default length
    });

    it('should generate unique IDs on each call', () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateNoteId());
      }
      expect(ids.size).toBe(1000);
    });

    it('should only contain URL-safe characters', () => {
      const id = generateNoteId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateFolderId', () => {
    it('should generate a unique folder ID', () => {
      const id = generateFolderId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(21);
    });

    it('should generate unique folder IDs', () => {
      const id1 = generateFolderId();
      const id2 = generateFolderId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateAttachmentId', () => {
    it('should generate a unique attachment ID', () => {
      const id = generateAttachmentId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(21);
    });
  });

  describe('isValidId', () => {
    it('should return true for valid IDs', () => {
      const id = generateNoteId();
      expect(isValidId(id)).toBe(true);
    });

    it('should return true for custom valid IDs', () => {
      expect(isValidId('abc123XYZ_-')).toBe(true);
      expect(isValidId('1234567890')).toBe(true);
      expect(isValidId('ABCDEFGHIJ')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidId('')).toBe(false);
      expect(isValidId('short')).toBe(false); // Less than 10 chars
      expect(isValidId(null)).toBe(false);
      expect(isValidId(undefined)).toBe(false);
      expect(isValidId(123)).toBe(false);
      expect(isValidId('has spaces here')).toBe(false);
      expect(isValidId('has@special#chars')).toBe(false);
    });
  });
});
