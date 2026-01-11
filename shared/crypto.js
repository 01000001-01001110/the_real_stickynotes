/**
 * Cryptographic utilities for password hashing and content encryption
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 10;
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * Hash a password
 * @param {string} password - The password to hash
 * @returns {Promise<string>} The hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Hash a password synchronously
 * @param {string} password - The password to hash
 * @returns {string} The hashed password
 */
function hashPasswordSync(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param {string} password - The password to verify
 * @param {string} hash - The hash to compare against
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Verify a password synchronously
 * @param {string} password - The password to verify
 * @param {string} hash - The hash to compare against
 * @returns {boolean} True if password matches
 */
function verifyPasswordSync(password, hash) {
  return bcrypt.compareSync(password, hash);
}

/**
 * Derive an encryption key from a password using PBKDF2
 * @param {string} password - The password
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} The derived key
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt content with a password
 * @param {string} content - The content to encrypt
 * @param {string} password - The encryption password
 * @returns {string} Base64 encoded encrypted content with salt, iv, and auth tag
 */
function encryptContent(content, password) {
  if (!content || !password) {
    throw new Error('Content and password are required for encryption');
  }
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from password
  const key = deriveKey(password, salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt content
  const contentBuffer = Buffer.from(content, 'utf8');
  const encrypted = Buffer.concat([cipher.update(contentBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Combine: salt (32) + iv (16) + authTag (16) + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypt content with a password
 * @param {string} encryptedBase64 - Base64 encoded encrypted content
 * @param {string} password - The decryption password
 * @returns {string|null} Decrypted content or null if decryption fails
 */
function decryptContent(encryptedBase64, password) {
  if (!encryptedBase64 || !password) {
    return null;
  }
  
  try {
    const combined = Buffer.from(encryptedBase64, 'base64');
    
    // Minimum size check: salt (32) + iv (16) + authTag (16) + at least 1 byte
    if (combined.length < 65) {
      return null;
    }
    
    // Extract components
    const salt = combined.subarray(0, 32);
    const iv = combined.subarray(32, 48);
    const authTag = combined.subarray(48, 64);
    const encrypted = combined.subarray(64);
    
    // Derive key
    const key = deriveKey(password, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (err) {
    // Decryption failed (wrong password, corrupted data, etc.)
    return null;
  }
}

/**
 * Check if content appears to be encrypted (base64 with proper length)
 * @param {string} content - Content to check
 * @returns {boolean} True if content appears encrypted
 */
function isEncryptedContent(content) {
  if (!content || typeof content !== 'string') return false;
  
  // Check if it's base64 and has minimum size for our format
  try {
    const decoded = Buffer.from(content, 'base64');
    // Must have at least: salt (32) + iv (16) + authTag (16) = 64 bytes
    return decoded.length >= 64 && 
           content.match(/^[A-Za-z0-9+/]+=*$/) !== null;
  } catch {
    return false;
  }
}

/**
 * Generate a random secure password
 * @param {number} length - Password length (default 16)
 * @returns {string} Random password
 */
function generateSecurePassword(length = 16) {
  return crypto.randomBytes(length).toString('base64').substring(0, length);
}

module.exports = {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordSync,
  encryptContent,
  decryptContent,
  isEncryptedContent,
  generateSecurePassword,
};
