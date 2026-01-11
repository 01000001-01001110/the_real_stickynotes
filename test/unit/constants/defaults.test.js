/**
 * Defaults Constants Tests
 */
const {
  noteDefaults,
  folderDefaults,
  tagDefaults,
  attachmentDefaults,
} = require('../../../shared/constants/defaults');

describe('Defaults Constants', () => {
  describe('noteDefaults', () => {
    it('should have all required properties', () => {
      expect(noteDefaults.title).toBeDefined();
      expect(noteDefaults.content).toBeDefined();
      expect(noteDefaults.color).toBeDefined();
      expect(noteDefaults.width).toBeDefined();
      expect(noteDefaults.height).toBeDefined();
    });

    it('should have correct default values', () => {
      expect(noteDefaults.title).toBe('');
      expect(noteDefaults.content).toBe('');
      expect(noteDefaults.color).toBe('yellow');
      expect(noteDefaults.width).toBe(300);
      expect(noteDefaults.height).toBe(350);
      expect(noteDefaults.is_open).toBe(0);
      expect(noteDefaults.is_pinned).toBe(0);
      expect(noteDefaults.is_locked).toBe(0);
      expect(noteDefaults.is_archived).toBe(0);
      expect(noteDefaults.is_deleted).toBe(0);
    });

    it('should have null for optional fields', () => {
      expect(noteDefaults.folder_id).toBeNull();
      expect(noteDefaults.password_hash).toBeNull();
      expect(noteDefaults.reminder_at).toBeNull();
      expect(noteDefaults.font_size).toBeNull();
      expect(noteDefaults.opacity).toBeNull();
      expect(noteDefaults.position_x).toBeNull();
      expect(noteDefaults.position_y).toBeNull();
    });
  });

  describe('folderDefaults', () => {
    it('should have required properties', () => {
      expect(folderDefaults.name).toBeDefined();
      expect(folderDefaults.parent_id).toBeDefined();
      expect(folderDefaults.sort_order).toBeDefined();
    });

    it('should have correct default values', () => {
      expect(folderDefaults.name).toBe('New Folder');
      expect(folderDefaults.parent_id).toBeNull();
      expect(folderDefaults.color).toBeNull();
      expect(folderDefaults.sort_order).toBe(0);
    });
  });

  describe('tagDefaults', () => {
    it('should have required properties', () => {
      expect(tagDefaults.name).toBeDefined();
    });

    it('should have correct default values', () => {
      expect(tagDefaults.name).toBe('');
      expect(tagDefaults.color).toBeNull();
    });
  });

  describe('attachmentDefaults', () => {
    it('should have required properties', () => {
      expect(attachmentDefaults.filename).toBeDefined();
      expect(attachmentDefaults.filepath).toBeDefined();
    });

    it('should have correct default values', () => {
      expect(attachmentDefaults.filename).toBe('');
      expect(attachmentDefaults.filepath).toBe('');
      expect(attachmentDefaults.mime_type).toBeNull();
      expect(attachmentDefaults.size_bytes).toBe(0);
    });
  });
});
