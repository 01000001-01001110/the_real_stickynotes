/**
 * Versioned KDF tests (#4): new note encryption uses PBKDF2 600k with a magic
 * prefix, while legacy 100k blobs (no prefix) still decrypt (lazy migration).
 */
const crypto = require('crypto');
const { encryptContent, decryptContent, isEncryptedContent } = require('../../shared/crypto');

// Reproduce the OLD (v1) on-disk format: salt(32)|iv(16)|tag(16)|ct at 100k, no prefix.
function legacyEncrypt(content, password) {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(content, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]).toString('base64');
}

describe('versioned KDF', () => {
  const password = 'Correct Horse Battery 9!';
  const secret = 'my sensitive note body';

  it('round-trips new (v2) content', () => {
    const enc = encryptContent(secret, password);
    expect(decryptContent(enc, password)).toBe(secret);
  });

  it('writes the v2 magic prefix and stays valid base64/encrypted', () => {
    const enc = encryptContent(secret, password);
    const raw = Buffer.from(enc, 'base64');
    expect(raw.subarray(0, 4).toString('utf8')).toBe('SNv2');
    expect(isEncryptedContent(enc)).toBe(true);
  });

  it('still decrypts legacy (v1, 100k, no-prefix) blobs', () => {
    const legacy = legacyEncrypt(secret, password);
    // Legacy blob must NOT carry the v2 magic...
    expect(Buffer.from(legacy, 'base64').subarray(0, 4).toString('utf8')).not.toBe('SNv2');
    // ...and must still decrypt via the fallback path.
    expect(decryptContent(legacy, password)).toBe(secret);
  });

  it('returns null for a wrong password (both v2 and legacy)', () => {
    expect(decryptContent(encryptContent(secret, password), 'wrong')).toBeNull();
    expect(decryptContent(legacyEncrypt(secret, password), 'wrong')).toBeNull();
  });
});
