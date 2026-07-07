/**
 * The standalone CLI client must compute the SAME pipe path as the server on
 * every platform. It was hardcoded to the Windows named-pipe format, which
 * broke the CLI on macOS/Linux (server listens on a Unix domain socket).
 */
const os = require('os');
const { defaultPipePath } = require('../../../cli/lib/client');
const { getPipePath } = require('../../../electron/ipc/pipe-server');

describe('CLI client pipe path is cross-platform and matches the server', () => {
  const realPlatform = os.platform;
  const realUserInfo = os.userInfo;

  afterEach(() => {
    os.platform = realPlatform;
    os.userInfo = realUserInfo;
  });

  it('uses a Windows named pipe on win32', () => {
    os.platform = () => 'win32';
    os.userInfo = () => ({ username: 'alice', uid: -1 });
    expect(defaultPipePath()).toBe('\\\\.\\pipe\\stickynotes-alice');
    expect(defaultPipePath()).toBe(getPipePath());
  });

  it('uses a Unix domain socket on darwin', () => {
    os.platform = () => 'darwin';
    os.userInfo = () => ({ username: 'alice', uid: 501 });
    expect(defaultPipePath()).toBe('/tmp/stickynotes-501.sock');
    expect(defaultPipePath()).toBe(getPipePath());
  });

  it('uses a Unix domain socket on linux', () => {
    os.platform = () => 'linux';
    os.userInfo = () => ({ username: 'bob', uid: 1000 });
    expect(defaultPipePath()).toBe('/tmp/stickynotes-1000.sock');
    expect(defaultPipePath()).toBe(getPipePath());
  });

  it('sanitizes special characters in the Windows username', () => {
    os.platform = () => 'win32';
    os.userInfo = () => ({ username: 'DOMAIN\\Jo Smith', uid: -1 });
    expect(defaultPipePath()).toBe('\\\\.\\pipe\\stickynotes-DOMAIN_Jo_Smith');
    expect(defaultPipePath()).toBe(getPipePath());
  });
});
