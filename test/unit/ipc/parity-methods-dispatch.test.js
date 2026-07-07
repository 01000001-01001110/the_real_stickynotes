/**
 * #18 parity: the newly-registered pipe methods dispatch to the right DB
 * functions end-to-end through processRequests.
 */
jest.mock('electron', () => ({
  app: { getVersion: () => '0.0.0-test', getName: () => 'test' },
}));

const mockNotes = {
  getNoteById: jest.fn(() => ({ id: 'n1', password_hash: null })),
  getNotes: jest.fn(() => [{ id: 't1' }, { id: 't2' }]),
  permanentlyDeleteNote: jest.fn(() => true),
};
const mockTags = {
  deleteTagByName: jest.fn(() => true),
  renameTag: jest.fn(() => true),
  getTagsForNotes: jest.fn(() => ({ n1: ['a'] })),
  cleanupOrphanedTags: jest.fn(() => 3),
};
const mockFolders = { getFolderTree: jest.fn(() => [{ id: 'f1', children: [] }]) };
const mockHistory = { revertToVersion: jest.fn(() => ({ id: 'h1' })) };
const mockLinks = {
  getOutgoingLinks: jest.fn(() => [{ target: 'x' }]),
  getBacklinks: jest.fn(() => [{ source: 'y' }]),
  createNoteFromLink: jest.fn(() => ({ id: 'new' })),
};

const mockSettings = {
  getSetting: jest.fn((k) => ({ 'a.b': 1, 'c.d': 'x' })[k]),
  resetSetting: jest.fn(() => 'default-value'),
};
const mockAttachments = {
  getAttachmentsForNote: jest.fn(() => [{ id: 'a1' }]),
  saveAttachment: jest.fn(() => ({ id: 'a2' })),
  deleteAttachment: jest.fn(() => true),
  getAttachmentPath: jest.fn(() => '/data/attachments/a1.png'),
};

jest.mock('../../../shared/database/notes', () => mockNotes);
jest.mock('../../../shared/database/tags', () => mockTags);
jest.mock('../../../shared/database/folders', () => mockFolders);
jest.mock('../../../shared/database/history', () => mockHistory);
jest.mock('../../../shared/database/links', () => mockLinks);
jest.mock('../../../shared/database/settings', () => mockSettings);
jest.mock('../../../shared/database/attachments', () => mockAttachments);

const { processRequests } = require('../../../electron/ipc/pipe-protocol');
const { createRegistry } = require('../../../electron/ipc/pipe-methods');

const registry = createRegistry({ windowManager: null });

async function call(method, params) {
  const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) + '\n';
  const [res] = await processRequests(req, registry);
  return res;
}

describe('parity pipe methods dispatch', () => {
  it('note:permanentDelete', async () => {
    const res = await call('note:permanentDelete', { id: 'n1' });
    expect(res.result).toEqual({ success: true });
    expect(mockNotes.permanentlyDeleteNote).toHaveBeenCalledWith('n1');
  });

  it('note:purgeTrash purges every trashed note + cleans orphan tags', async () => {
    const res = await call('note:purgeTrash', {});
    expect(res.result).toMatchObject({ success: true, deleted: 2, orphanedTagsDeleted: 3 });
    expect(mockNotes.permanentlyDeleteNote).toHaveBeenCalledTimes(2 + 1); // +1 from prior test call
  });

  it('note:trashStats returns the count', async () => {
    const res = await call('note:trashStats', {});
    expect(res.result).toEqual({ count: 2 });
  });

  it('note:verifyPassword (no password set)', async () => {
    const res = await call('note:verifyPassword', { id: 'n1' });
    expect(res.result).toEqual({ exists: true, requiresPassword: false, valid: true });
  });

  it('note:revert reverts and returns the note', async () => {
    const res = await call('note:revert', { id: 'n1', historyId: 'h9' });
    expect(res.result.success).toBe(true);
    expect(mockHistory.revertToVersion).toHaveBeenCalledWith('n1', 'h9');
  });

  it('tag:delete / tag:rename / tag:cleanupOrphaned', async () => {
    expect((await call('tag:delete', { name: 'work' })).result).toEqual({ success: true });
    expect(mockTags.deleteTagByName).toHaveBeenCalledWith('work');
    expect((await call('tag:rename', { oldName: 'a', newName: 'b' })).result).toEqual({
      success: true,
    });
    expect((await call('tag:cleanupOrphaned', {})).result).toEqual({ success: true, deleted: 3 });
  });

  it('folder:tree', async () => {
    const res = await call('folder:tree', {});
    expect(res.result).toEqual([{ id: 'f1', children: [] }]);
  });

  it('links:getOutgoing / getBacklinks / createFromLink', async () => {
    expect((await call('links:getOutgoing', { noteId: 'n1' })).result).toEqual([{ target: 'x' }]);
    expect((await call('links:getBacklinks', { noteId: 'n1' })).result).toEqual([{ source: 'y' }]);
    expect((await call('links:createFromLink', { title: 'New' })).result.note).toEqual({
      id: 'new',
    });
  });

  it('validation errors when required params are missing', async () => {
    expect((await call('note:permanentDelete', {})).error).toBeDefined();
    expect((await call('tag:rename', { oldName: 'a' })).error).toBeDefined();
    expect((await call('links:getOutgoing', {})).error).toBeDefined();
  });

  // ---- tranche 2: config, attachments ----

  it('config:getMultiple returns an object of key->value', async () => {
    const res = await call('config:getMultiple', { keys: ['a.b', 'c.d'] });
    expect(res.result).toEqual({ 'a.b': 1, 'c.d': 'x' });
  });

  it('config:reset resets a key', async () => {
    const res = await call('config:reset', { key: 'a.b' });
    expect(res.result).toMatchObject({ success: true, key: 'a.b', value: 'default-value' });
    expect(mockSettings.resetSetting).toHaveBeenCalledWith('a.b');
  });

  it('config:defaultPaths returns data/attachments/backups', async () => {
    const res = await call('config:defaultPaths', {});
    expect(res.result).toHaveProperty('data');
    expect(res.result).toHaveProperty('attachments');
    expect(res.result).toHaveProperty('backups');
  });

  it('attachment:list / add / delete / getPath', async () => {
    expect((await call('attachment:list', { noteId: 'n1' })).result).toEqual([{ id: 'a1' }]);
    expect(
      (await call('attachment:add', { noteId: 'n1', filePath: '/f.png' })).result.attachment
    ).toEqual({ id: 'a2' });
    expect((await call('attachment:delete', { id: 'a1' })).result).toEqual({ success: true });
    expect((await call('attachment:getPath', { id: 'a1' })).result).toEqual({
      path: '/data/attachments/a1.png',
    });
  });
});

// Window-control methods need a WindowManager; build a separate registry.
describe('parity window-control methods', () => {
  const wm = {
    openNote: jest.fn(),
    closeNote: jest.fn(),
    showAllNotes: jest.fn(),
    hideAllNotes: jest.fn(),
  };
  const reg = createRegistry({ windowManager: wm });

  async function wcall(method, params) {
    const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) + '\n';
    const [res] = await processRequests(req, reg);
    return res;
  }

  it('app:openNote / closeNote drive the window manager', async () => {
    expect((await wcall('app:openNote', { id: 'n1' })).result).toEqual({ success: true });
    expect(wm.openNote).toHaveBeenCalledWith('n1');
    expect((await wcall('app:closeNote', { id: 'n1' })).result).toEqual({ success: true });
    expect(wm.closeNote).toHaveBeenCalledWith('n1');
  });

  it('app:showAll / hideAll drive the window manager', async () => {
    await wcall('app:showAll', {});
    await wcall('app:hideAll', {});
    expect(wm.showAllNotes).toHaveBeenCalled();
    expect(wm.hideAllNotes).toHaveBeenCalled();
  });
});
