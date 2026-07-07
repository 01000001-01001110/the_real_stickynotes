/**
 * Structural regression guards for renderer/config wiring that cannot be
 * exercised directly in the node test environment (no DOM / no live app).
 * These still fail if the fix is reverted, which is the point.
 *
 *  #5  every note-content innerHTML sink is routed through sanitizeHtml()
 *  #10 the opacity slider range matches the validator (50-100, not 0-100)
 *  #9  config init calls the real migrateToYaml, not the non-existent
 *      migrateFromSQLite
 */
const fs = require('fs');
const path = require('path');

const noteJs = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'src', 'note', 'note.js'),
  'utf8'
);
const noteHtml = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'src', 'note', 'index.html'),
  'utf8'
);
const configIndex = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'config', 'index.js'),
  'utf8'
);

describe('#5 note content is always sanitized before innerHTML', () => {
  it('has no raw note-content innerHTML assignments', () => {
    // These would be XSS sinks if present unsanitized.
    expect(noteJs).not.toMatch(/innerHTML\s*=\s*renderedContent\s*;/);
    expect(noteJs).not.toMatch(/innerHTML\s*=\s*entry\.content/);
  });

  it('routes note content through sanitizeHtml()', () => {
    expect(noteJs).toMatch(/innerHTML\s*=\s*sanitizeHtml\(renderedContent\)/);
    expect(noteJs).toMatch(/innerHTML\s*=\s*sanitizeHtml\(entry\.content/);
  });

  it('sanitizeHtml strips script/style/iframe and event handlers', () => {
    // Guard the sanitizer's denylist so it is not weakened.
    const body = noteJs.slice(noteJs.indexOf('function sanitizeHtml'));
    expect(body).toMatch(/script,\s*style,\s*iframe/);
    expect(body).toMatch(/attr\.name\.startsWith\(['"]on['"]\)/);
  });
});

describe('#10 opacity slider range matches the validator', () => {
  it('slider min is 50, not 0', () => {
    const slider = noteHtml.match(/id="opacitySlider"[^>]*>/)[0];
    expect(slider).toContain('min="50"');
    expect(slider).not.toContain('min="0"');
  });

  it('input handler clamps to 50-100', () => {
    expect(noteJs).toMatch(/Math\.max\(50,\s*Math\.min\(100,/);
  });
});

describe('#9 config migration calls the real function', () => {
  it('does not reference the non-existent migrateFromSQLite', () => {
    expect(configIndex).not.toContain('migrateFromSQLite');
  });

  it('calls migrateToYaml, which the migration module exports', () => {
    expect(configIndex).toContain('migrateToYaml');
    const migration = require('../../../shared/config/migration');
    expect(typeof migration.migrateToYaml).toBe('function');
  });
});
