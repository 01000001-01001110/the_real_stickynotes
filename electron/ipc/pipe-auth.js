/**
 * Named-pipe authentication token.
 *
 * The named pipe has no OS-level peer authentication (on Windows the default
 * DACL is not reliably user-restricted), so any local process could otherwise
 * connect and drive the full method registry. We gate every connection behind a
 * shared secret: a random token written to a user-scoped file at startup. The
 * CLI reads the file (only the current user can) and presents it as the first
 * frame; the server rejects all other methods until the token matches.
 *
 * NOTE: this is a local single-user trust boundary, not transport encryption.
 * Restricting the Windows pipe DACL to the current-user SID is a fast-follow.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppDataPath } = require('../../shared/utils/paths');

const TOKEN_FILENAME = 'pipe.token';
const TOKEN_BYTES = 32;

/**
 * @param {string} [customPath] - Explicit token path (testing).
 * @returns {string} Path to the token file.
 */
function getTokenPath(customPath) {
  return customPath || path.join(getAppDataPath(), TOKEN_FILENAME);
}

/**
 * Ensure a token file exists, creating a fresh random token if not.
 * Written with owner-only permissions (0600); on Windows the %APPDATA% profile
 * dir is already user-scoped by default ACL inheritance.
 * @param {string} [customPath]
 * @returns {string} The token (hex).
 */
function ensureToken(customPath) {
  const tokenPath = getTokenPath(customPath);
  try {
    const existing = fs.readFileSync(tokenPath, 'utf8').trim();
    if (existing) return existing;
  } catch (err) {
    // Not present / unreadable — regenerate below.
  }
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  try {
    fs.chmodSync(tokenPath, 0o600);
  } catch (err) {
    // chmod is a no-op on some Windows filesystems; ignore.
  }
  return token;
}

/**
 * Read the current token, or null if none.
 * @param {string} [customPath]
 * @returns {string|null}
 */
function readToken(customPath) {
  try {
    const token = fs.readFileSync(getTokenPath(customPath), 'utf8').trim();
    return token || null;
  } catch (err) {
    return null;
  }
}

/**
 * Constant-time comparison of a candidate token against the stored token.
 * @param {string} candidate
 * @param {string} [customPath]
 * @returns {boolean}
 */
function verifyToken(candidate, customPath) {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const stored = readToken(customPath);
  if (!stored) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  getTokenPath,
  ensureToken,
  readToken,
  verifyToken,
  TOKEN_FILENAME,
};
