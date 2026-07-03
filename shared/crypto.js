/**
 * Cryptographic utilities for password hashing and content encryption
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 10;
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
// AUTH_TAG_LENGTH is 16 by default in aes-256-gcm - we use Node's default
// Legacy (v1) blobs were derived at 100k. New (v2) blobs use 600k to match
// current OWASP guidance. v2 blobs carry a magic prefix so decrypt can pick the
// right iteration count; legacy blobs (no prefix) still decrypt at 100k. Notes
// re-encrypt to v2 the next time they are locked (lazy migration).
const PBKDF2_ITERATIONS_LEGACY = 100000;
const PBKDF2_ITERATIONS = 600000;
const KDF_MAGIC = Buffer.from('SNv2', 'utf8'); // 4 bytes marking a v2 blob

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
function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
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

  // Combine v2: magic (4) + salt (32) + iv (16) + authTag (16) + encrypted
  const combined = Buffer.concat([KDF_MAGIC, salt, iv, authTag, encrypted]);

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

  const combined = Buffer.from(encryptedBase64, 'base64');

  const hasMagic =
    combined.length >= KDF_MAGIC.length && combined.subarray(0, KDF_MAGIC.length).equals(KDF_MAGIC);

  // Try v2 (magic prefix, 600k) first when the marker is present, then fall back
  // to the legacy layout (no prefix, 100k). Because GCM is authenticated, a
  // wrong interpretation fails cleanly, so a legacy blob whose random bytes
  // happen to start with the magic still decrypts via the fallback.
  if (hasMagic) {
    const v2 = tryDecrypt(combined.subarray(KDF_MAGIC.length), password, PBKDF2_ITERATIONS);
    if (v2 !== null) return v2;
  }
  return tryDecrypt(combined, password, PBKDF2_ITERATIONS_LEGACY);
}

/**
 * Attempt to decrypt a raw (magic-stripped) blob at a given iteration count.
 * @param {Buffer} body - salt(32) + iv(16) + authTag(16) + ciphertext
 * @param {string} password
 * @param {number} iterations
 * @returns {string|null} Plaintext or null on any failure.
 */
function tryDecrypt(body, password, iterations) {
  try {
    // Minimum size: salt (32) + iv (16) + authTag (16) + at least 1 byte
    if (body.length < 65) {
      return null;
    }

    const salt = body.subarray(0, 32);
    const iv = body.subarray(32, 48);
    const authTag = body.subarray(48, 64);
    const encrypted = body.subarray(64);

    const key = deriveKey(password, salt, iterations);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    // Decryption failed (wrong password, corrupted data, wrong iteration count).
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
    return decoded.length >= 64 && content.match(/^[A-Za-z0-9+/]+=*$/) !== null;
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
