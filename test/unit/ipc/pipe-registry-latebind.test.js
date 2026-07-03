/**
 * Regression test for the pipe method-registry window-manager wiring
 * (fixed 2026-07-02).
 *
 * The registry is built in Phase 2, before the WindowManager exists (Phase 3).
 * Previously createRegistry captured its argument directly, so:
 *   - it received the stores wrapper, not a WindowManager, and
 *   - it captured null and never saw the WindowManager injected later.
 * Result: pipe-driven note:create/update/delete broadcasts threw instead of
 * notifying open windows.
 *
 * This proves the WindowManager is resolved lazily: injected AFTER
 * createRegistry() returns, and still used by handlers.
 */
jest.mock('electron', () => ({
  app: { getVersion: () => '0.0.0-test', getName: () => 'stickynotes-test' },
}));

jest.mock('../../../shared/database/notes', () => ({
  createNote: jest.fn((data) => ({ id: 'note-1', ...data })),
  getNoteById: jest.fn(() => ({ id: 'note-1' })),
}));

const { createRegistry } = require('../../../electron/ipc/pipe-methods');

describe('pipe registry resolves WindowManager lazily', () => {
  it('broadcasts note:created via a WindowManager injected after build', async () => {
    // stores.windowManager is null at registry-build time (Phase 2)...
    const stores = { windowManager: null, getSetting: () => undefined };
    const registry = createRegistry(stores);

    // ...and injected later (Phase 3), exactly as electron/main.js now does.
    const broadcast = jest.fn();
    stores.windowManager = { broadcast };

    const result = await registry.call('note:create', { title: 't', content: 'c' });

    expect(result.success).toBe(true);
    expect(broadcast).toHaveBeenCalledWith(
      'note:created',
      expect.objectContaining({ id: 'note-1' })
    );
  });
});

describe('app:status database path uses an exported symbol', () => {
  it('shared/database exports getCurrentPath (guards the app:status import)', () => {
    const db = require('../../../shared/database');
    expect(typeof db.getCurrentPath).toBe('function');
    // getDatabasePath is intentionally NOT exported here — app:status must not import it.
    expect(db.getDatabasePath).toBeUndefined();
  });
});
