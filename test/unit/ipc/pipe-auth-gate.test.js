/**
 * Security test: the pipe server must reject any connection that has not
 * presented a valid auth token, and accept those that have. Fixed 2026-07-02
 * (previously the pipe had zero authentication — any local process could drive
 * the full method registry).
 *
 * Uses a real PipeServer + real socket on a unique pipe path, with the token
 * injected (no dependency on the on-disk token file).
 */
const net = require('net');
const os = require('os');
const { PipeServer } = require('../../../electron/ipc/pipe-server');

const TOKEN = 'test-token-abc123';

function pipePath(name) {
  if (os.platform() === 'win32') return `\\\\.\\pipe\\stickynotes-authtest-${name}`;
  return `/tmp/stickynotes-authtest-${name}.sock`;
}

// Open a fresh socket and send/receive one JSON-RPC frame per call.
function rpc(path, request) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(path);
    let buffer = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('rpc timeout'));
    }, 3000);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(JSON.stringify(request) + '\n'));
    socket.on('data', (chunk) => {
      buffer += chunk;
      const nl = buffer.indexOf('\n');
      if (nl !== -1) {
        clearTimeout(timer);
        const line = buffer.slice(0, nl);
        socket.destroy();
        resolve(JSON.parse(line));
      }
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// PERMISSION_DENIED from shared/config/error-codes.js
const PERMISSION_DENIED = -32008;

describe('pipe server auth gate', () => {
  let server;
  let path;

  beforeAll(async () => {
    server = new PipeServer();
    path = pipePath(`${process.pid}-${Date.now()}`);
    await server.start({ 'note:list': async () => [{ id: 'n1' }] }, path, { authToken: TOKEN });
  });

  afterAll(async () => {
    if (server) await server.stop(500);
  });

  it('rejects a method call with no prior auth', async () => {
    const res = await rpc(path, { jsonrpc: '2.0', id: 1, method: 'note:list', params: {} });
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(PERMISSION_DENIED);
    expect(res.result).toBeUndefined();
  });

  it('rejects a wrong token', async () => {
    const res = await rpc(path, {
      jsonrpc: '2.0',
      id: 1,
      method: 'auth',
      params: { token: 'nope' },
    });
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(PERMISSION_DENIED);
  });

  it('accepts the correct token and then dispatches methods on that connection', async () => {
    // Single connection: auth first, then a real call, framed as two lines.
    const result = await new Promise((resolve, reject) => {
      const socket = net.createConnection(path);
      const out = [];
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('timeout'));
      }, 3000);
      socket.setEncoding('utf8');
      let buffer = '';
      socket.on('connect', () => {
        socket.write(
          JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'auth', params: { token: TOKEN } }) + '\n'
        );
      });
      socket.on('data', (chunk) => {
        buffer += chunk;
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          const msg = JSON.parse(line);
          out.push(msg);
          if (out.length === 1) {
            // auth ok -> now send the real request on the SAME connection
            socket.write(
              JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'note:list', params: {} }) + '\n'
            );
          } else if (out.length === 2) {
            clearTimeout(timer);
            socket.destroy();
            resolve(out);
          }
        }
      });
      socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(result[0].result).toEqual({ authenticated: true });
    expect(result[1].result).toEqual([{ id: 'n1' }]);
  });
});
