/**
 * In-memory unlock throttle for password-locked notes.
 *
 * unlockNote() verifies passwords with bcrypt and has no natural rate limit, so
 * a caller (including any local process over the pipe) could brute-force a note
 * password online. This tracks failed attempts per note id and locks out further
 * attempts for a cooldown once a threshold is hit — even a correct password is
 * refused while locked out.
 *
 * State is process-local (resets on app restart), which is appropriate for this
 * local single-user threat model.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000; // 30 seconds

// id -> { count, lockedUntil }
const attempts = new Map();

/**
 * Throw if the note is currently locked out. Call before verifying a password.
 * @param {string} id - Note ID
 * @throws {Error} when locked out
 */
function assertNotLockedOut(id) {
  const entry = attempts.get(id);
  if (!entry || !entry.lockedUntil) return;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining > 0) {
    const secs = Math.ceil(remaining / 1000);
    throw new Error(`Too many unlock attempts. Try again in ${secs}s.`);
  }
  // Cooldown expired — clear so counting starts fresh.
  attempts.delete(id);
}

/**
 * Record a failed unlock attempt; engages a lockout at the threshold.
 * @param {string} id - Note ID
 */
function recordFailure(id) {
  const entry = attempts.get(id) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  attempts.set(id, entry);
}

/**
 * Clear throttle state after a successful unlock.
 * @param {string} id - Note ID
 */
function recordSuccess(id) {
  attempts.delete(id);
}

/** Test helper: clear all throttle state. */
function _reset() {
  attempts.clear();
}

module.exports = {
  assertNotLockedOut,
  recordFailure,
  recordSuccess,
  _reset,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
};
