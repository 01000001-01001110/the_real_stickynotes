/**
 * End-to-end pipe dispatch test (was completely missing).
 *
 * Exercises the REAL path a pipe request takes:
 *   raw NDJSON -> processRequests(data, server.methodRegistry) -> handleRequest ->
 *   registry lookup -> handler.
 *
 * createRegistry() returns a MethodRegistry (methods in a Map), but
 * pipe-protocol.handleRequest historically looked methods up as
 * `methodRegistry[method]` (plain-object style) -> every call resolved to
 * METHOD_NOT_FOUND. This test proves real method dispatch works.
 */
jest.mock('electron', () => ({
  app: { getVersion: () => '0.0.0-test', getName: () => 'stickynotes-test' },
}));

jest.mock('../../../shared/database/notes', () => ({
  getNotes: jest.fn(() => [{ id: 'n1', title: 'hello' }]),
}));

const { processRequests } = require('../../../electron/ipc/pipe-protocol');
const { createRegistry } = require('../../../electron/ipc/pipe-methods');

describe('pipe dispatch end-to-end', () => {
  it('dispatches a real registered method (note:list) through processRequests', async () => {
    const registry = createRegistry({ windowManager: null });
    const request =
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'note:list', params: {} }) + '\n';

    const responses = await processRequests(request, registry);

    expect(responses).toHaveLength(1);
    expect(responses[0].error).toBeUndefined();
    expect(responses[0].result).toEqual([{ id: 'n1', title: 'hello' }]);
  });
});
