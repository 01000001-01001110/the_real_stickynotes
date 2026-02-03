/**
 * Default values for notes and other entities
 */
const noteDefaults = {
  title: '',
  content: '',
  content_plain: '',
  folder_id: null,
  color: 'yellow',
  position_x: null,
  position_y: null,
  width: 300,
  height: 350,
  is_open: 0,
  is_pinned: 0,
  is_locked: 0,
  is_archived: 0,
  is_deleted: 0,
  password_hash: null,
  reminder_at: null,
  reminder_notified: 0,
  font_size: null,
  opacity: null,
  z_index: 0,
};

const folderDefaults = {
  name: 'New Folder',
  parent_id: null,
  color: null,
  sort_order: 0,
};

const tagDefaults = {
  name: '',
  color: null,
};

const attachmentDefaults = {
  filename: '',
  filepath: '',
  mime_type: null,
  size_bytes: 0,
};

module.exports = {
  noteDefaults,
  folderDefaults,
  tagDefaults,
  attachmentDefaults,
};
