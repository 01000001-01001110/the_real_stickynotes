/**
 * ID generation utilities
 */
const { nanoid } = require('nanoid');

/**
 * Generate a unique ID for notes
 * @returns {string} A 21-character unique ID
 */
function generateNoteId() {
  return nanoid();
}

/**
 * Generate a unique ID for folders
 * @returns {string} A 21-character unique ID
 */
function generateFolderId() {
  return nanoid();
}

/**
 * Generate a unique ID for attachments
 * @returns {string} A 21-character unique ID
 */
function generateAttachmentId() {
  return nanoid();
}

/**
 * Validate that a string looks like a valid ID
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid
 */
function isValidId(id) {
  return typeof id === 'string' && id.length >= 10 && /^[A-Za-z0-9_-]+$/.test(id);
}

module.exports = {
  generateNoteId,
  generateFolderId,
  generateAttachmentId,
  isValidId,
};
