/**
 * Unit tests for the pipe auth token module.
 */
const path = require('path');
const fs = require('fs');
const { ensureToken, readToken, verifyToken } = require('../../../electron/ipc/pipe-auth');

let tokenPath;

beforeEach(() => {
  tokenPath = path.join(global.testDir, `pipe-token-${Date.now()}-${Math.random()}`);
});

afterEach(() => {
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
});

describe('pipe-auth token', () => {
  it('ensureToken creates a 64-char hex token and is stable on re-read', () => {
    const t1 = ensureToken(tokenPath);
    expect(t1).toMatch(/^[a-f0-9]{64}$/);
    const t2 = ensureToken(tokenPath);
    expect(t2).toBe(t1); // does not regenerate when a token already exists
    expect(readToken(tokenPath)).toBe(t1);
  });

  it('verifyToken matches the correct token and rejects others', () => {
    const token = ensureToken(tokenPath);
    expect(verifyToken(token, tokenPath)).toBe(true);
    expect(verifyToken('wrong', tokenPath)).toBe(false);
    expect(verifyToken('', tokenPath)).toBe(false);
    expect(verifyToken(token + 'x', tokenPath)).toBe(false);
  });

  it('readToken/verifyToken return null/false when no token file exists', () => {
    expect(readToken(tokenPath)).toBeNull();
    expect(verifyToken('anything', tokenPath)).toBe(false);
  });
});
