# Agent 7 - Complete Settings Inventory and Matrix

## Accurate Counts

- **Schema Definitions**: 53 settings total in `shared/constants/settings.js`
- **UI Mappings**: 49 settings in `settingMappings` object in `src/settings/settings.js`
- **Settings Actually Used in Code**: 38 settings
- **Settings in UI but Never Used**: 11 settings
- **Settings in Schema but No UI**: 4 settings
- **Dead Code** (neither UI nor used): 3 settings
- **Hidden Functional**: 1 setting (functional but not exposed in UI)

## Complete Settings Matrix

| Setting                                                            | In Schema | In UI | Used in Code | Files Using It                                                | Status                                  |
| ------------------------------------------------------------------ | --------- | ----- | ------------ | ------------------------------------------------------------- | --------------------------------------- |
| **General Category (9 in schema, 8 in UI, 6 actively used)**       |
| `general.language`                                                 | ✓         | ✗     | ✗            | None                                                          | **DEAD CODE** - No i18n system          |
| `general.startOnBoot`                                              | ✓         | ✓     | ✓            | electron/main.js, electron/ipc/settings.js                    | Active                                  |
| `general.startMinimized`                                           | ✓         | ✓     | ✓            | electron/main.js                                              | Active                                  |
| `general.minimizeToTray`                                           | ✓         | ✓     | ✓            | electron/windows/manager.js, electron/main.js                 | Active                                  |
| `general.closeToTray`                                              | ✓         | ✓     | ✓            | electron/windows/manager.js, electron/main.js                 | Active                                  |
| `general.confirmDelete`                                            | ✓         | ✓     | ✓            | src/panel/panel.js, src/note/note.js                          | Active                                  |
| `general.confirmPermanentDelete`                                   | ✓         | ✓     | ✗            | None                                                          | UI only - never checked                 |
| `general.autoSaveDelay`                                            | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `general.trashRetentionDays`                                       | ✓         | ✓     | ✗            | None                                                          | UI only - no auto-purge implemented     |
| **Appearance Category (10 in schema, 10 in UI, 10 actively used)** |
| `appearance.theme`                                                 | ✓         | ✓     | ✓            | Multiple files                                                | Active                                  |
| `appearance.defaultNoteColor`                                      | ✓         | ✓     | ✓            | shared/database/notes.js                                      | Active                                  |
| `appearance.defaultNoteWidth`                                      | ✓         | ✓     | ✓            | electron/windows/manager.js                                   | Active                                  |
| `appearance.defaultNoteHeight`                                     | ✓         | ✓     | ✓            | electron/windows/manager.js                                   | Active                                  |
| `appearance.defaultFontFamily`                                     | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `appearance.defaultFontSize`                                       | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `appearance.noteOpacity`                                           | ✓         | ✓     | ✓            | electron/windows/manager.js                                   | Active                                  |
| `appearance.enableShadows`                                         | ✓         | ✓     | ✓            | electron/windows/manager.js                                   | Active                                  |
| `appearance.enableAnimations`                                      | ✓         | ✓     | ✓            | src/panel/panel.js, src/note/note.js                          | Active                                  |
| `appearance.showNoteCount`                                         | ✓         | ✓     | ✓            | src/panel/panel.js                                            | Active                                  |
| **New Note Category (4 in schema, 4 in UI, 2 actively used)**      |
| `newNote.position`                                                 | ✓         | ✓     | ✓            | electron/windows/manager.js                                   | Active                                  |
| `newNote.cascadeOffset`                                            | ✓         | ✓     | ✓            | electron/windows/manager.js                                   | Active                                  |
| `newNote.openImmediately`                                          | ✓         | ✓     | ✗            | None                                                          | UI only - feature not implemented       |
| `newNote.focusTitle`                                               | ✓         | ✓     | ✗            | None                                                          | UI only - feature not implemented       |
| **Tray Category (3 in schema, 3 in UI, 2 actively used)**          |
| `tray.singleClickAction`                                           | ✓         | ✓     | ✓            | electron/tray.js                                              | Active                                  |
| `tray.doubleClickAction`                                           | ✓         | ✓     | ✓            | electron/tray.js                                              | Active                                  |
| `tray.showReminderBadge`                                           | ✓         | ✓     | ✗            | None                                                          | UI only - feature not implemented       |
| **Shortcuts Category (3 in schema, 3 in UI, 3 actively used)**     |
| `shortcuts.globalNewNote`                                          | ✓         | ✓     | ✓            | electron/shortcuts.js                                         | Active                                  |
| `shortcuts.globalToggle`                                           | ✓         | ✓     | ✓            | electron/shortcuts.js                                         | Active                                  |
| `shortcuts.globalPanel`                                            | ✓         | ✓     | ✓            | electron/shortcuts.js                                         | Active                                  |
| **Editor Category (5 in schema, 5 in UI, 5 actively used)**        |
| `editor.spellcheck`                                                | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `editor.autoLinks`                                                 | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `editor.autoLists`                                                 | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `editor.tabSize`                                                   | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `editor.showWordCount`                                             | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| **Reminders Category (4 in schema, 4 in UI, 4 actively used)**     |
| `reminders.enabled`                                                | ✓         | ✓     | ✓            | electron/reminders.js                                         | Active                                  |
| `reminders.sound`                                                  | ✓         | ✓     | ✓            | electron/reminders.js                                         | Active                                  |
| `reminders.snoozeMinutes`                                          | ✓         | ✓     | ✓            | electron/reminders.js                                         | Active                                  |
| `reminders.persistUntilDismissed`                                  | ✓         | ✓     | ✓            | electron/reminders.js                                         | Active                                  |
| **History Category (2 in schema, 2 in UI, 2 actively used)**       |
| `history.maxVersions`                                              | ✓         | ✓     | ✓            | shared/database/history.js                                    | Active                                  |
| `history.saveInterval`                                             | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| **Advanced Category (5 in schema, 5 in UI, 2 actively used)**      |
| `advanced.databasePath`                                            | ✓         | ✓     | ✗            | None                                                          | UI only - custom paths not implemented  |
| `advanced.attachmentsPath`                                         | ✓         | ✓     | ✗            | None                                                          | UI only - custom paths not implemented  |
| `advanced.serverPort`                                              | ✓         | ✓     | ✓            | electron/main.js, electron/server.js                          | Active                                  |
| `advanced.hardwareAcceleration`                                    | ✓         | ✓     | ✓            | electron/main.js                                              | Active                                  |
| `advanced.devTools`                                                | ✓         | ✓     | ✗            | None                                                          | UI only - feature not implemented       |
| **Whisper Category (9 in schema, 6 in UI, 5 actively used)**       |
| `whisper.enabled`                                                  | ✓         | ✓     | ✓            | electron/ipc/whisper.js, electron/server.js, src/note/note.js | Active                                  |
| `whisper.modelSize`                                                | ✓         | ✓     | ✓            | electron/ipc/whisper.js, electron/server.js                   | Active                                  |
| `whisper.language`                                                 | ✓         | ✓     | ✓            | electron/ipc/whisper.js, electron/server.js                   | Active                                  |
| `whisper.insertMode`                                               | ✓         | ✓     | ✓            | src/note/note.js                                              | Active                                  |
| `whisper.defaultSource`                                            | ✓         | ✓     | ✓            | electron/server.js                                            | Active                                  |
| `whisper.autoStopSilence`                                          | ✓         | ✓     | ✗            | None                                                          | UI only - feature not implemented       |
| `whisper.silenceTimeout`                                           | ✓         | ✗     | ✗            | None                                                          | **DEAD CODE** - no UI, no usage         |
| `whisper.showConfidence`                                           | ✓         | ✗     | ✗            | None                                                          | **DEAD CODE** - planned feature         |
| `whisper.autoDownload`                                             | ✓         | ✗     | ✗            | None                                                          | **DEAD CODE** - planned feature         |
| `whisper.chunkDuration`                                            | ✓         | ✗     | ✓            | src/note/note.js:1428                                         | **HIDDEN FUNCTIONAL** - works but no UI |

## Dead Code Settings - Removal Candidates

These 3 settings should be removed from the schema as they are completely unused:

1. **`general.language`** - No i18n system exists, will never be used
2. **`whisper.silenceTimeout`** - Related to unimplemented `autoStopSilence` feature
3. **`whisper.showConfidence`** - Planned feature never implemented

## Unimplemented Features - Settings with UI but No Code

These 11 settings have UI controls but the functionality is never checked/used:

1. **`general.confirmPermanentDelete`** - No permanent delete confirmation logic
2. **`general.trashRetentionDays`** - No auto-purge background task
3. **`newNote.openImmediately`** - Notes always open immediately regardless
4. **`newNote.focusTitle`** - No focus management code
5. **`tray.showReminderBadge`** - No badge display logic
6. **`advanced.databasePath`** - Custom paths not supported
7. **`advanced.attachmentsPath`** - Custom paths not supported
8. **`advanced.devTools`** - No dev tools menu toggle
9. **`whisper.autoStopSilence`** - Auto-stop logic not implemented
10. **`whisper.autoDownload`** - Manual download only
11. **`whisper.showConfidence`** - No confidence display

## Hidden Functional Setting

1. **`whisper.chunkDuration`** - Actually works in code (src/note/note.js:1428) but has no UI control. Should be exposed in settings UI.

## Recommendations

### Immediate Actions

1. **Remove dead code**: Delete `general.language`, `whisper.silenceTimeout`, `whisper.showConfidence` from schema
2. **Add missing UI**: Create UI control for `whisper.chunkDuration` in settings/transcription section
3. **Document unimplemented**: Add comments to schema marking which settings are UI-only (not implemented)

### Code Quality

4. **Add validation**: Settings that accept specific values (like `theme`, `defaultNoteColor`) should be validated before saving
5. **Add type checking**: Validate types match schema before storage
6. **Fix unit conversion**: Move ms↔minutes conversion for `history.saveInterval` to backend layer
7. **Fix category confusion**: Move `defaultFontSize` comment to Appearance section in UI mappings

### Feature Completion

8. **Implement or remove UI-only settings**: Either implement the 11 unimplemented features or remove their UI controls
9. **Add proper error handling**: `setSetting()` should reject invalid keys instead of just warning
