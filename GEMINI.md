# StickyNotes 2.0

Feature-rich desktop sticky notes application built with Electron, SQLite, and local AI transcription.

## Project Structure

| Directory   | Purpose                                                          |
| ----------- | ---------------------------------------------------------------- |
| `src/`      | Renderer UI modules (note, panel, imageviewer, settings, styles) |
| `electron/` | Main process (window manager, IPC handlers, tray, shortcuts)     |
| `cli/`      | Command-line interface with Commander.js                         |
| `shared/`   | Database, crypto, validation, type definitions                   |
| `test/`     | Jest unit and integration tests                                  |
| `assets/`   | Application icons and resources                                  |

## Core Modules

### Frontend (src/)

Each module is self-contained with HTML, CSS, and JS:

- **note** - Sticky note editor with password protection, reminders, tags, transcription
- **panel** - Main dashboard with grid view, folders, tags, search
- **imageviewer** - Image viewing with zoom, rotate, drawing tools
- **settings** - Configuration panel

### Backend (electron/)

- **main.js** - Entry point, database init, system integration
- **preload.js** - Secure API bridge (80+ methods)
- **windows/manager.js** - Multi-window management with state persistence
- **ipc/** - Modular IPC handlers

### CLI (cli/)

Transparent proxy: HTTP API when app running, direct DB otherwise.

Commands: `note`, `folder`, `tag`, `search`, `config`, `export`, `app`, `utils`, `whisper`

### Shared (shared/)

- SQLite database layer (WAL mode, transactions)
- AES-256-GCM encryption, bcrypt hashing
- Input validation and sanitization
- Type definitions for all entities

## Dependencies

| Package          | Purpose                   |
| ---------------- | ------------------------- |
| better-sqlite3   | Database with FTS5 search |
| bcryptjs         | Password hashing          |
| express          | HTTP server for CLI       |
| commander        | CLI framework             |
| whisper-node     | Local speech-to-text      |
| electron-updater | Auto-updates              |

## Scripts

| Command         | Description                    |
| --------------- | ------------------------------ |
| `npm start`     | Run application                |
| `npm run dev`   | Development mode with DevTools |
| `npm test`      | Run test suite                 |
| `npm run build` | Production build               |
| `npm run lint`  | Code linting                   |

## Features

**Notes**

- Rich text editing with markdown
- Wiki-style linking (`[[title]]`)
- Password protection (AES-256-GCM)
- Version history
- Reminders with notifications

**Organization**

- Nested folders
- Color-coded tags
- Full-text search (FTS5)
- Archive and trash

**System Integration**

- System tray
- Global shortcuts
- Auto-updates
- Local Whisper transcription

## Testing

Jest framework with 80% coverage thresholds across 647 tests:

- Unit: CLI, database, crypto, utils, whisper
- Integration: End-to-end workflows

## Security

- Context isolation with preload bridge
- AES-256-GCM note encryption
- bcrypt password hashing
- PBKDF2 key derivation
- Rate limiting on HTTP server
- Input validation (1MB content limit)
