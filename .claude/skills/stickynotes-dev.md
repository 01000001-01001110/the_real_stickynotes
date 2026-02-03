# StickyNotes Development Skill

> Drop-in Claude Code skill for developing and maintaining the StickyNotes Electron application.

## Usage

Copy this file to your `.claude/skills/` directory to give Claude Code context about the StickyNotes codebase.

## Architecture

```
the_real_stickynotes/
├── electron/           # Main process (Electron)
│   ├── main.js         # Entry point
│   ├── ipc/            # IPC handlers (settings, notes, folders, tags)
│   ├── cli/            # CLI command parser and handlers
│   └── windows/        # Window management
├── src/                # Renderer process (HTML/CSS/JS)
│   ├── panel/          # Main notes panel
│   ├── note/           # Individual note windows
│   ├── settings/       # Settings page
│   └── imageviewer/    # Image viewer with annotation
├── shared/             # Shared between main/renderer
│   ├── database/       # SQLite via better-sqlite3
│   ├── constants/      # Settings schema, defaults
│   ├── config/         # YAML config management
│   └── utils/          # Path helpers, etc.
├── cli/                # Command-line interface
└── test/               # Jest tests
```

## Key Files

| Purpose             | File                             |
| ------------------- | -------------------------------- |
| Settings Schema     | `shared/constants/settings.js`   |
| Database Operations | `shared/database/index.js`       |
| IPC Handlers        | `electron/ipc/*.js`              |
| Preload API         | `electron/preload.js`            |
| Note Editor         | `src/note/note.js`               |
| Panel View          | `src/panel/panel.js`             |
| Image Viewer        | `src/imageviewer/imageviewer.js` |

## Development Rules

1. **Settings**: Always define in `shared/constants/settings.js` BEFORE using
2. **CSS Variables**: Define in `:root` block in respective CSS files
3. **IPC**: Follow existing pattern in `electron/ipc/` for new handlers
4. **No TypeScript**: This is a JavaScript project
5. **Tests**: Use Jest, located in `test/` directory

## Adding New Features

### New Setting

1. Add to `shared/constants/settings.js` schema
2. Add UI in `src/settings/settings.js` and `index.html`

### New IPC Handler

1. Create in `electron/ipc/`
2. Register in `electron/ipc/index.js`
3. Expose in `electron/preload.js`

## Commands

```bash
npm run dev           # Development
npm run build:win     # Windows build
npm test              # Run tests
```

## Database

SQLite via better-sqlite3 at:

- Windows: `%APPDATA%/StickyNotes/stickynotes.db`
- macOS: `~/Library/Application Support/StickyNotes/`
- Linux: `~/.config/stickynotes/`
