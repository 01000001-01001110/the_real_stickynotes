# CLAUDE.md - Project Guidelines for AI Assistants

## Project Overview

StickyNotes is an Electron-based desktop sticky notes application with:

- Voice transcription using Sherpa-ONNX/Whisper (local, offline)
- CLI tool for managing notes
- Tag-based organization
- Auto-save and system tray support

## Architecture

```
the_true_stickynotes/
├── electron/           # Main process (Electron)
│   ├── main.js         # Entry point
│   ├── ipc/            # IPC handlers (settings, notes, etc.)
│   └── whisper/        # Voice transcription
├── src/                # Renderer process (HTML/CSS/JS)
│   ├── panel/          # Main notes panel
│   ├── note/           # Individual note windows
│   └── settings/       # Settings page
├── shared/             # Shared between main/renderer
│   ├── database/       # SQLite via better-sqlite3
│   ├── constants/      # Settings schema, defaults
│   └── utils/          # Path helpers, etc.
├── cli/                # Command-line interface
└── test/               # Jest tests
```

## Key Files

- **Settings Schema**: `shared/constants/settings.js` - All settings MUST be defined here before use
- **Database**: `shared/database/` - SQLite with better-sqlite3
- **IPC Handlers**: `electron/ipc/` - Main-renderer communication
- **Preload**: `electron/preload.js` - Exposes APIs to renderer

## Coding Standards

1. **Settings**: Always add new settings to `shared/constants/settings.js` schema
2. **CSS Variables**: Define in `:root` block in respective CSS files
3. **IPC**: Follow existing pattern in `electron/ipc/` for new handlers
4. **No TypeScript**: This is a JavaScript project
5. **Tests**: Use Jest, located in `test/` directory

## Common Gotchas

- Settings used in code must be defined in the schema first
- CSS custom properties (--var) must be declared before use
- Electron preload exposes APIs via `window.api`
- Voice transcription models are downloaded to user data directory

## Testing

```bash
npm test           # Run all tests
npm run test:unit  # Unit tests only
npm run dev        # Development mode
npm run build:win  # Build for Windows
```

## Database Location

- Windows: `%APPDATA%/StickyNotes/stickynotes.db`
- macOS: `~/Library/Application Support/StickyNotes/stickynotes.db`
- Linux: `~/.config/stickynotes/stickynotes.db`
