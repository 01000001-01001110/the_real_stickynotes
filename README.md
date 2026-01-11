# StickyNotes 2.0

A feature-rich, production-ready sticky notes desktop application built with Electron, featuring rich text editing, note encryption, reminders, and a comprehensive CLI for automation and scripting.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Tests](https://img.shields.io/badge/tests-647%20passing-green.svg)
![Coverage](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Desktop Application

- **Microsoft Sticky Notes-like UI** - Familiar floating note windows with colorful backgrounds
- **8 Color Themes** - Yellow, Pink, Blue, Green, Purple, Orange, Gray, Charcoal
- **Rich Text Editing** - Bold, italic, underline, strikethrough, lists, checkboxes
- **Markdown Shortcuts** - Notion-style markdown support (`**bold**`, `*italic*`, `# headers`)
- **Wiki-style Note Linking** - Link notes with `[[Note Title]]` syntax
- **System Tray Integration** - Quick access and minimize to tray
- **Global Keyboard Shortcuts** - Create notes from anywhere
- **Reminders** - Set due dates with desktop notifications
- **Password Protection** - AES-256-GCM encryption for individual notes
- **Version History** - Revert to previous versions (configurable retention)
- **Folders & Tags** - Hierarchical organization with nested folders
- **Full-text Search** - FTS5-powered instant search with highlighting
- **Soft Delete** - Recoverable trash with configurable retention
- **Speech-to-Text Transcription** - Local Whisper AI for voice notes (see below)

### CLI Tool

- **JSON Output** - Pipe-friendly output for scripting and automation
- **Full CRUD Operations** - Complete note, folder, tag management
- **Search** - Full-text search from command line
- **Export/Backup** - JSON, Markdown, HTML export
- **App Control** - Control the running desktop app remotely

### Security

- **bcrypt Password Hashing** - Industry-standard password hashing (10 salt rounds)
- **AES-256-GCM Encryption** - Authenticated encryption for note content
- **PBKDF2 Key Derivation** - 100,000 iterations for key stretching
- **Rate Limiting** - API rate limiting to prevent abuse
- **Input Validation** - Comprehensive validation at all boundaries

### Speech-to-Text Transcription

Built-in local transcription using OpenAI's Whisper model (via whisper.cpp):

- **100% Local Processing** - No internet required, audio never leaves your device
- **Multiple Audio Sources** - Microphone, system audio, or both
- **Real-time Streaming** - Text appears as you speak
- **13 Languages** - English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean, plus auto-detect
- **Three Model Sizes**:
  - **Tiny** (75MB) - Fastest, good for quick notes
  - **Base** (150MB) - Balanced speed and accuracy  
  - **Small** (500MB) - Best accuracy for most use cases

To enable transcription, run setup with the `--whisper` flag or download the model from Settings > Transcription.

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/stickynotes.git
cd stickynotes

# Run the automated setup script
node scripts/setup.mjs
```

The setup script will:

- Install all dependencies
- Rebuild native modules for your Node.js version
- Run tests to verify everything works
- Provide instructions for next steps

#### Setup Options

```bash
# Setup for testing and CLI usage (default)
node scripts/setup.mjs
# Or use npm script:
npm run setup

# Setup for running the Electron desktop app
node scripts/setup.mjs --electron
# Or use npm script:
npm run setup:electron

# Setup with speech-to-text transcription (downloads Whisper model)
node scripts/setup.mjs --electron --whisper
# Or use npm scripts:
npm run setup:whisper         # Downloads 'small' model (500MB, best accuracy)
npm run setup:whisper:tiny    # Downloads 'tiny' model (75MB, fastest)

# Skip tests during setup
node scripts/setup.mjs --skip-tests

# Show help
node scripts/setup.mjs --help
```

#### Manual Installation

If you prefer manual setup:

```bash
# Install dependencies
npm install

# Rebuild native modules for Node.js (for tests/CLI)
npm run rebuild

# Or rebuild for Electron (for desktop app)
npm run rebuild:electron

# Start the desktop application
npm start

# Or install CLI globally
npm link
stickynotes --help
```

### Native Module Notes

This project uses `better-sqlite3`, a native C++ module that must be compiled for either:

- **Node.js** (for running tests and CLI)
- **Electron** (for running the desktop app)

The setup script handles this automatically. If you need to switch:

```bash
# Switch to Node.js (for tests)
npm run rebuild

# Switch to Electron (for app)
npm run rebuild:electron
```

> **Note:** The native module can only be compiled for one target at a time. Use `npm run rebuild` before testing, and `npm run rebuild:electron` before running the app.

### Basic CLI Usage

```bash
# Create a note
stickynotes note create --title "My Note" --content "Hello World" --json

# List all notes
stickynotes note list --json

# Search notes
stickynotes search "meeting notes" --json

# Lock a note with password
stickynotes note lock <id> --password "mySecretPassword"

# Unlock a note
stickynotes note unlock <id> --password "mySecretPassword"
```

## Documentation

### CLI Reference

See **[SKILL.md](./SKILL.md)** for comprehensive CLI documentation including:

- Complete command reference
- JSON output schemas
- Common workflows
- Scripting examples

### CLI Command Reference

#### Notes

```bash
stickynotes note list [--folder <id>] [--tag <name>] [--color <color>] [--archived] [--trash] [--json]
stickynotes note create --title "Title" [--content "Content"] [--color <color>] [--folder <id>] [--tags "tag1,tag2"] [--json]
stickynotes note show <id> [--json]
stickynotes note edit <id> [--title "New Title"] [--content "New Content"] [--append "More text"] [--color <color>] [--json]
stickynotes note delete <id> [--force]        # Soft delete (--force for permanent)
stickynotes note restore <id>                  # Restore from trash
stickynotes note archive <id>                  # Archive note
stickynotes note unarchive <id>                # Unarchive note
stickynotes note pin <id>                      # Pin to top
stickynotes note unpin <id>                    # Unpin
stickynotes note duplicate <id> [--json]       # Create a copy
stickynotes note lock <id> --password <pass>   # Encrypt with password
stickynotes note unlock <id> --password <pass> # Decrypt
stickynotes note history <id> [--json]         # Version history
stickynotes note revert <id> <versionId>       # Revert to version
stickynotes note purge [--days <n>]            # Empty trash
```

#### Folders

```bash
stickynotes folder list [--json]
stickynotes folder create <name> [--parent <id>] [--color <color>] [--json]
stickynotes folder rename <id> <newName>
stickynotes folder delete <id> [--force]       # --force also deletes notes
stickynotes folder notes <id> [--json]         # List notes in folder
```

#### Tags

```bash
stickynotes tag list [--json]
stickynotes tag create <name> [--color <color>] [--json]
stickynotes tag rename <oldName> <newName>
stickynotes tag delete <name>
stickynotes tag add <noteId> <tagName>         # Add tag to note
stickynotes tag remove <noteId> <tagName>      # Remove tag from note
stickynotes tag notes <tagName> [--json]       # List notes with tag
```

#### Search

```bash
stickynotes search <query> [--folder <id>] [--tag <name>] [--limit <n>] [--json]
```

#### Settings

```bash
stickynotes config list [--json]               # List all settings
stickynotes config get <key>                   # Get setting value
stickynotes config set <key> <value>           # Set setting value
stickynotes config reset [key]                 # Reset to defaults
```

#### Database Utilities

```bash
stickynotes stats [--json]                     # Database statistics
stickynotes doctor                             # Integrity check
stickynotes backup [--path <dir>]              # Create backup
stickynotes restore <file>                     # Restore from backup
stickynotes paths                              # Show data locations
```

### CLI Transcription Commands

```bash
# Quick voice note
stickynotes voice --source mic

# Quick voice note with title
stickynotes voice --title "Meeting Notes" --source mic

# Create note with transcription
stickynotes note create --title "Meeting" --transcribe --source both --open

# Check whisper model status
stickynotes whisper status
stickynotes whisper status --json

# Download whisper model via CLI
stickynotes whisper download --model small
stickynotes whisper download --model tiny

# List available models
stickynotes whisper list
stickynotes whisper list --json

# Delete current model
stickynotes whisper delete
```

## Project Structure

```
StickyNotes_2.0/
├── electron/               # Electron main process
│   ├── main.js             # Application entry point
│   ├── preload.js          # Context bridge for renderer
│   ├── ipc/                # IPC handlers
│   ├── windows/            # Window management
│   ├── tray.js             # System tray integration
│   ├── shortcuts.js        # Global keyboard shortcuts
│   ├── server.js           # HTTP server for CLI (with rate limiting)
│   └── reminders.js        # Reminder scheduler
├── src/                    # Renderer process (UI)
│   ├── panel/              # Notes list panel
│   ├── note/               # Individual note window
│   ├── settings/           # Settings window
│   └── styles/             # CSS styles
├── cli/                    # CLI tool
│   ├── bin/                # CLI entry point
│   │   └── stickynotes.js
│   ├── commands/           # Command implementations
│   │   ├── note.js
│   │   ├── folder.js
│   │   ├── tag.js
│   │   ├── search.js
│   │   └── config.js
│   └── output/             # Output formatters
│       └── formatter.js
├── shared/                 # Shared code (CLI + Electron)
│   ├── database/           # SQLite operations
│   │   ├── index.js        # Connection management
│   │   ├── notes.js        # Note CRUD
│   │   ├── folders.js      # Folder CRUD
│   │   ├── tags.js         # Tag operations
│   │   ├── search.js       # FTS5 search
│   │   ├── settings.js     # Settings storage
│   │   ├── history.js      # Version history
│   │   └── migrations/     # Schema migrations
│   ├── crypto.js           # Password hashing & encryption
│   ├── constants/          # Colors, defaults, settings
│   └── utils/              # Validators, ID generation, paths
├── test/                   # Test suites
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── assets/                 # Icons, sounds
├── SKILL.md                # CLI reference documentation
└── README.md               # This file
```

## Database

StickyNotes uses **SQLite** with **FTS5** for full-text search. Database location:

| Platform | Path |
|----------|------|
| **Windows** | `%APPDATA%\StickyNotes\stickynotes.db` |
| **macOS** | `~/Library/Application Support/StickyNotes/stickynotes.db` |
| **Linux** | `~/.config/stickynotes/stickynotes.db` |

### Schema Overview

- **notes** - Note content, metadata, position, encryption state
- **folders** - Hierarchical folder organization
- **tags** - Tag definitions with colors
- **note_tags** - Note-to-tag associations
- **note_history** - Version history snapshots
- **note_links** - Wiki-style note linking
- **attachments** - File attachment metadata
- **settings** - User preferences
- **migrations** - Schema version tracking

## Configuration

All settings can be configured via Settings window or CLI:

| Setting | Default | Description |
|---------|---------|-------------|
| `general.startOnBoot` | `false` | Start with operating system |
| `general.closeToTray` | `true` | Keep running when closing |
| `general.trashRetentionDays` | `30` | Days to keep deleted notes |
| `appearance.theme` | `system` | `light` / `dark` / `system` |
| `appearance.defaultNoteColor` | `yellow` | Default note color |
| `appearance.defaultNoteWidth` | `300` | Default note width (px) |
| `appearance.defaultNoteHeight` | `350` | Default note height (px) |
| `shortcuts.globalNewNote` | `Ctrl+Shift+N` | New note hotkey |
| `shortcuts.globalToggle` | `Ctrl+Shift+S` | Toggle visibility |
| `editor.spellcheck` | `true` | Enable spell checking |
| `history.maxVersions` | `10` | Max history versions per note |
| `advanced.serverPort` | `47474` | CLI communication port |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch
```

### Test Coverage

| Metric | Coverage |
|--------|----------|
| **Statements** | 99.23% |
| **Branches** | 96.5% |
| **Functions** | 100% |
| **Lines** | 99.16% |

**647 tests** covering:

- Crypto (password hashing, encryption/decryption)
- Database operations (CRUD, search, migrations)
- Input validation
- CLI commands and output formatting
- Integration workflows

## Security

### Password-Protected Notes

Notes can be individually encrypted with passwords:

```bash
# Lock a note (encrypts content with AES-256-GCM)
stickynotes note lock <id> --password "MySecurePassword123!"

# The note content is now:
# - Encrypted with AES-256-GCM
# - Password hashed with bcrypt (10 rounds)
# - Key derived with PBKDF2 (100,000 iterations)
# - content_plain shows "[ENCRYPTED]"

# Unlock with correct password
stickynotes note unlock <id> --password "MySecurePassword123!"
```

**Warning**: If you forget the password, the encrypted content **cannot be recovered**.

### API Security

The HTTP server (for CLI communication) includes:

- Rate limiting (100 requests/minute)
- Optional authentication token
- Request body size limits
- Security headers (via Helmet)
- Input validation on all endpoints

## Transcription (Speech-to-Text)

### Setup

```bash
# Option 1: During initial setup
npm run setup:whisper           # Downloads 'small' model (recommended)
npm run setup:whisper:tiny      # Downloads 'tiny' model (faster download)

# Option 2: From Settings UI
# Go to Settings > Transcription > Download Model
```

### Usage

1. Open any note
2. Click the microphone icon in the toolbar
3. Select audio source:
   - **Microphone** - Transcribe your voice
   - **System Audio** - Transcribe video/audio playing on your computer (shows share dialog)
   - **All Audio** - Transcribe both (useful for meetings)
4. Click the microphone icon again to stop recording

Transcribed text is automatically inserted at your cursor position.

### Settings

In **Settings > Transcription** you can configure:

- **Model size** - Tiny (fast), Base (balanced), Small (accurate)
- **Language** - 13 languages plus auto-detect
- **Insert mode** - Cursor position, end of note, or replace selection
- **Default audio source** - Pre-select your preferred source
- **Auto-stop on silence** - Automatically stop when silence is detected

### Requirements

- Microphone permission (for mic input)
- Screen sharing permission (for system audio capture)
- No internet connection required - all processing is local

## Development

```bash
# Run in development mode (with DevTools)
npm run dev

# Build for production
npm run build

# Build Windows installer
npm run build:win

# Run linting
npm run lint
```

## Dependencies

### Runtime

- `better-sqlite3` - SQLite database driver
- `bcryptjs` - Password hashing
- `chalk` - Terminal styling
- `cli-table3` - CLI table formatting
- `commander` - CLI framework
- `express` - HTTP server for CLI
- `marked` - Markdown parsing
- `nanoid` - ID generation

### Development

- `electron` - Desktop framework
- `electron-builder` - Packaging
- `jest` - Testing framework

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built for productivity
</p>
