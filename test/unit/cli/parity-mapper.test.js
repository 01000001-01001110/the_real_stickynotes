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
});
