/**
 * Attachments CRUD operations
 */
const { getDatabase } = require('./index');
const { generateAttachmentId } = require('../utils/id');
const { getAttachmentsPath, ensureDir } = require('../utils/paths');
const path = require('path');
const fs = require('fs');

/**
 * Validate that a filepath is safe (no path traversal)
 * @param {string} filepath - Filepath to validate
 * @returns {boolean} True if safe
 */
function isSafeFilepath(filepath) {
  if (!filepath || typeof filepath !== 'string') return false;

  // Normalize the path and check for traversal attempts
  const normalized = path.normalize(filepath);

  // Reject absolute paths
  if (path.isAbsolute(normalized)) return false;

  // Reject paths that try to go up directories
  if (normalized.startsWith('..') || normalized.includes('..')) return false;

  // Reject paths with suspicious characters
  if (/[<>:"|?*]/.test(filepath)) return false;

  return true;
}

/**
 * Create an attachment record
 * @param {object} data - Attachment data
 * @returns {object} Created attachment
 */
function createAttachment(data) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = generateAttachmentId();

  // Validate filepath to prevent path traversal attacks
  if (data.filepath && !isSafeFilepath(data.filepath)) {
    throw new Error('Invalid attachment filepath');
  }

  const attachment = {
    id,
    note_id: data.note_id,
    filename: data.filename,
    filepath: data.filepath,
    mime_type: data.mime_type || null,
    size_bytes: data.size_bytes || 0,
    created_at: now,
  };

  db.prepare(
    `
    INSERT INTO attachments (id, note_id, filename, filepath, mime_type, size_bytes, created_at)
    VALUES (@id, @note_id, @filename, @filepath, @mime_type, @size_bytes, @created_at)
  `
  ).run(attachment);

  return attachment;
}

/**
 * Get an attachment by ID
 * @param {string} id - Attachment ID
 * @returns {object|null} Attachment or null
 */
function getAttachmentById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) || null;
}

/**
 * Get all attachments for a note
 * @param {string} noteId - Note ID
 * @returns {object[]} Array of attachments
 */
function getAttachmentsForNote(noteId) {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT * FROM attachments WHERE note_id = ? ORDER BY created_at
  `
    )
    .all(noteId);
}

/**
 * Delete an attachment
 * @param {string} id - Attachment ID
 * @param {boolean} deleteFile - Also delete the file from disk
 * @returns {boolean} Success
 */
function deleteAttachment(id, deleteFile = true) {
  const db = getDatabase();
  const attachment = getAttachmentById(id);

  if (!attachment) return false;

  if (deleteFile && attachment.filepath) {
    const fullPath = path.join(getAttachmentsPath(), attachment.filepath);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error(`Failed to delete attachment file ${fullPath}:`, err.message);
      // Continue with database deletion even if file deletion fails
    }
  }

  const result = db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Delete all attachments for a note
 * @param {string} noteId - Note ID
 * @param {boolean} deleteFiles - Also delete files from disk
 * @returns {number} Number of attachments deleted
 */
function deleteAttachmentsForNote(noteId, deleteFiles = true) {
  const attachments = getAttachmentsForNote(noteId);
  let count = 0;

  for (const attachment of attachments) {
    if (deleteAttachment(attachment.id, deleteFiles)) {
      count++;
    }
  }

  return count;
}

/**
 * Save a file as an attachment
 * @param {string} noteId - Note ID
 * @param {string} sourcePath - Source file path
 * @param {string} filename - Original filename
 * @returns {object} Created attachment
 * @throws {Error} If file operations fail
 */
function saveAttachment(noteId, sourcePath, filename) {
  const attachmentsDir = getAttachmentsPath();
  ensureDir(attachmentsDir);

  // Generate unique filename
  const id = generateAttachmentId();
  const ext = path.extname(filename);
  const newFilename = `${id}${ext}`;
  const relativePath = newFilename;
  const fullPath = path.join(attachmentsDir, newFilename);

  // Copy file with error handling
  try {
    fs.copyFileSync(sourcePath, fullPath);
  } catch (err) {
    throw new Error(`Failed to copy attachment file: ${err.message}`);
  }

  // Get file stats with error handling
  let stats;
  try {
    stats = fs.statSync(fullPath);
  } catch (err) {
    // Clean up copied file on stat failure
    try {
      fs.unlinkSync(fullPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Failed to read attachment file stats: ${err.message}`);
  }

  // Determine MIME type from extension
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
  };
  const mimeType = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';

  return createAttachment({
    note_id: noteId,
    filename,
    filepath: relativePath,
    mime_type: mimeType,
    size_bytes: stats.size,
  });
}

/**
 * Get the full path to an attachment file
 * @param {string} attachmentId - Attachment ID
 * @returns {string|null} Full path or null
 */
function getAttachmentPath(attachmentId) {
  const attachment = getAttachmentById(attachmentId);
  if (!attachment) return null;

  // Validate filepath to prevent path traversal
  if (!isSafeFilepath(attachment.filepath)) {
    console.error('Unsafe filepath detected for attachment:', attachmentId);
    return null;
  }

  const fullPath = path.join(getAttachmentsPath(), attachment.filepath);

  // Double-check the resolved path is within attachments directory
  const attachmentsDir = getAttachmentsPath();
  const resolvedPath = path.resolve(fullPath);
  const resolvedDir = path.resolve(attachmentsDir);

  if (!resolvedPath.startsWith(resolvedDir)) {
    console.error('Path traversal attempt detected for attachment:', attachmentId);
    return null;
  }

  return fullPath;
}

/**
 * Get total size of all attachments
 * @returns {number} Total size in bytes
 */
function getTotalAttachmentsSize() {
  const db = getDatabase();
  const result = db.prepare('SELECT SUM(size_bytes) as total FROM attachments').get();
  return result.total || 0;
}

module.exports = {
  createAttachment,
  getAttachmentById,
  getAttachmentsForNote,
  deleteAttachment,
  deleteAttachmentsForNote,
  saveAttachment,
  getAttachmentPath,
  getTotalAttachmentsSize,
};
