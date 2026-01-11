/**
 * Full-text search migration
 */
const up = `
-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content_plain,
    content='notes',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content_plain)
    VALUES (NEW.rowid, NEW.title, NEW.content_plain);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
    VALUES('delete', OLD.rowid, OLD.title, OLD.content_plain);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content_plain)
    VALUES('delete', OLD.rowid, OLD.title, OLD.content_plain);
    INSERT INTO notes_fts(rowid, title, content_plain)
    VALUES (NEW.rowid, NEW.title, NEW.content_plain);
END;
`;

const down = `
DROP TRIGGER IF EXISTS notes_au;
DROP TRIGGER IF EXISTS notes_ad;
DROP TRIGGER IF EXISTS notes_ai;
DROP TABLE IF EXISTS notes_fts;
`;

module.exports = {
  name: '002_fts',
  up,
  down,
};
