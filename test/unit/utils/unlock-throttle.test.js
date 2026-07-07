/**
 * Tests for the unlock brute-force throttle (#6).
 */
const throttle = require('../../../shared/utils/unlock-throttle');

beforeEach(() => throttle._reset());

describe('unlock throttle', () => {
  it('allows attempts below the threshold', () => {
    for (let i = 0; i < throttle.MAX_ATTEMPTS - 1; i++) {
      throttle.recordFailure('note-1');
      expect(() => throttle.assertNotLockedOut('note-1')).not.toThrow();
    }
  });

  it('locks out after MAX_ATTEMPTS failures, refusing even a correct password', () => {
    for (let i = 0; i < throttle.MAX_ATTEMPTS; i++) {
      throttle.recordFailure('note-1');
    }
    // Now locked out — the caller would refuse to even check the password.
    expect(() => throttle.assertNotLockedOut('note-1')).toThrow(/Too many unlock attempts/);
  });

  it('isolates lockout per note id', () => {
    for (let i = 0; i < throttle.MAX_ATTEMPTS; i++) throttle.recordFailure('note-1');
    expect(() => throttle.assertNotLockedOut('note-1')).toThrow();
    expect(() => throttle.assertNotLockedOut('note-2')).not.toThrow();
  });

  it('clears the lockout after the cooldown expires', () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < throttle.MAX_ATTEMPTS; i++) throttle.recordFailure('note-1');
      expect(() => throttle.assertNotLockedOut('note-1')).toThrow();

      jest.advanceTimersByTime(throttle.LOCKOUT_MS + 1);
      expect(() => throttle.assertNotLockedOut('note-1')).not.toThrow();
    } finally {
      jest.useRealTimers();
    }
  });

  it('recordSuccess clears prior failures', () => {
    for (let i = 0; i < throttle.MAX_ATTEMPTS - 1; i++) throttle.recordFailure('note-1');
    throttle.recordSuccess('note-1');
    // Counter reset — one more failure must not trip the lockout.
    throttle.recordFailure('note-1');
    expect(() => throttle.assertNotLockedOut('note-1')).not.toThrow();
  });
});
