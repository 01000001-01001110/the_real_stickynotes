# StickyNotes 2.0

A feature-rich sticky notes desktop application built with Electron.

## Architecture Overview

```
the_real_stickynotes/
├── src/           # Renderer processes (UI)
├── electron/      # Main process (Electron)
├── cli/           # Command-line interface
├── shared/        # Shared utilities & types
├── test/          # Jest test suites
└── assets/        # Icons and resources
```

## Key Components

### src/ - Frontend Modules

- **note/** - Individual sticky note window with editing, password protection, reminders, tags, transcription, and history
- **panel/** - Main control panel with notes grid, folder/tag navigation, search, and filtering
- **imageviewer/** - Image viewer with zoom, rotate, drawing tools, and undo
- **settings/** - User preferences configuration
- **styles/** - Shared CSS (themes, animations, variables)

### electron/ - Main Process

- **main.js** - App entry point; initializes database, window manager, IPC, tray, shortcuts, reminders, and local HTTP server
- **preload.js** - Security bridge exposing 80+ methods via contextBridge
- **windows/manager.js** - Window lifecycle, positioning, state persistence, cross-window broadcasting
- **ipc/\*.js** - Modular handlers for notes, tags, folders, settings, attachments, windows, whisper

### cli/ - Command Line Interface

Built with Commander.js. Uses HTTP API when app is running, direct database access otherwise.

**Commands:** `note`, `folder`, `tag`, `search`, `config`, `export`, `app`, `utils`, `whisper`

Supports `--json` flag for scripting automation.

### shared/ - Common Infrastructure

- **Database** - SQLite with WAL mode, transactions, retry logic
- **Validation** - Input bounds (1MB content, 500 char titles)
- **Crypto** - bcrypt hashing, AES-256-GCM encryption, PBKDF2 key derivation
- **Types** - Data models for notes, folders, tags, attachments

## Tech Stack

- **Runtime:** Electron
- **Database:** better-sqlite3 with FTS5 full-text search
- **Security:** bcryptjs, AES-256-GCM encryption
- **CLI:** Commander.js, chalk, cli-table3
- **Transcription:** whisper-node (local, offline)
- **Updates:** electron-updater

## Development Commands

```bash
npm start          # Run the app
npm run dev        # Run with DevTools
npm test           # Run all tests
npm run test:coverage  # Test with coverage report
npm run lint       # ESLint
npm run build      # Production build
```

## Key Features

- 8 color themes with dark mode
- Rich text editing with markdown shortcuts
- Wiki-style note linking (`[[note title]]`)
- Password-protected notes (AES-256-GCM)
- Version history with restore
- Folders and tags organization
- Full-text search (FTS5)
- System tray integration
- Global keyboard shortcuts
- Local Whisper transcription (13 languages)
- Comprehensive CLI for automation

## Testing

Jest with 80% coverage thresholds. 647 tests covering:

- Unit tests for CLI, database, crypto, utils
- Integration tests for CLI workflows and database operations
