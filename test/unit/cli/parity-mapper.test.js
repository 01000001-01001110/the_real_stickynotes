/**
 * #18 parity: new CLI verbs map to the correct pipe methods + params.
 */
const { mapCommand } = require('../../../cli/lib/method-mapper');

function map(command, action, args = [], options = {}) {
  return mapCommand({ command, action, args, options });
}

describe('CLI parity verb mapping', () => {
  it('note revert <id> <historyId>', () => {
    const r = map('note', 'revert', ['n1', 'h9']);
    expect(r.method).toBe('note:revert');
    expect(r.params).toMatchObject({ id: 'n1', historyId: 'h9' });
  });

  it('note purge -> note:purgeTrash', () => {
    expect(map('note', 'purge').method).toBe('note:purgeTrash');
  });

  it('note verify <id> --password -> note:verifyPassword', () => {
    const r = map('note', 'verify', ['n1'], { password: 'pw' });
    expect(r.method).toBe('note:verifyPassword');
    expect(r.params).toMatchObject({ id: 'n1', password: 'pw' });
  });

  it('note delete <id> --force -> note:permanentDelete', () => {
    const r = map('note', 'delete', ['n1'], { force: true });
    expect(r.method).toBe('note:permanentDelete');
    expect(r.params).toMatchObject({ id: 'n1' });
  });

  it('note delete <id> without --force stays soft delete', () => {
    expect(map('note', 'delete', ['n1']).method).toBe('note:delete');
  });

  it('tag delete <name> -> tag:delete', () => {
    const r = map('tag', 'delete', ['work']);
    expect(r.method).toBe('tag:delete');
    expect(r.params.tag).toBe('work');
  });

  it('tag rename <old> <new> -> tag:rename', () => {
    const r = map('tag', 'rename', ['old', 'new']);
    expect(r.method).toBe('tag:rename');
    expect(r.params).toMatchObject({ oldName: 'old', newName: 'new' });
  });

  it('folder tree -> folder:tree', () => {
    expect(map('folder', 'tree').method).toBe('folder:tree');
  });

  // ---- tranche 2 ----

  it('config reset <key> -> config:reset', () => {
    const r = map('config', 'reset', ['a.b']);
    expect(r.method).toBe('config:reset');
    expect(r.params).toMatchObject({ key: 'a.b' });
  });

  it('config get-multiple k1 k2 -> config:getMultiple', () => {
    const r = map('config', 'get-multiple', ['a.b', 'c.d']);
    expect(r.method).toBe('config:getMultiple');
    expect(r.params).toMatchObject({ keys: ['a.b', 'c.d'] });
  });

  it('config default-paths -> config:defaultPaths', () => {
    expect(map('config', 'default-paths').method).toBe('config:defaultPaths');
  });

  it('app open/close <id> -> app:openNote/closeNote', () => {
    expect(map('app', 'open', ['n1'])).toMatchObject({
      method: 'app:openNote',
      params: { id: 'n1' },
    });
    expect(map('app', 'close', ['n1'])).toMatchObject({
      method: 'app:closeNote',
      params: { id: 'n1' },
    });
  });

  it('app showall/hideall -> app:showAll/hideAll', () => {
    expect(map('app', 'showall').method).toBe('app:showAll');
    expect(map('app', 'hideall').method).toBe('app:hideAll');
  });

  it('attachment verbs map correctly', () => {
    expect(map('attachment', 'list', ['n1'])).toMatchObject({
      method: 'attachment:list',
      params: { noteId: 'n1' },
    });
    expect(map('attachment', 'add', ['n1', '/f.png'])).toMatchObject({
      method: 'attachment:add',
      params: { noteId: 'n1', filePath: '/f.png' },
    });
    expect(map('attachment', 'delete', ['a1'])).toMatchObject({
      method: 'attachment:delete',
      params: { id: 'a1' },
    });
    expect(map('attachment', 'path', ['a1'])).toMatchObject({
      method: 'attachment:getPath',
      params: { id: 'a1' },
    });
  });
});
