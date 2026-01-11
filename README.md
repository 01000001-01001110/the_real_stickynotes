# StickyNotes

A feature-rich sticky notes desktop application built with Electron, featuring rich text editing, note encryption, cloud storage sync support, and voice transcription.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

![StickyNotes Screenshot](assets/screenshots/screenshot-main.png)

![CLI Integration](assets/screenshots/screenshot-second.png)
*CLI commands seamlessly sync with the desktop app*

## Features

- **Microsoft Sticky Notes-like UI** - Familiar floating note windows
- **8 Color Themes** - Yellow, Pink, Blue, Green, Purple, Orange, Gray, Charcoal
- **Rich Text Editing** - Bold, italic, lists, checkboxes, markdown shortcuts
- **Note Encryption** - AES-256-GCM password protection per note
- **Wiki-style Linking** - Link notes with `[[Note Title]]` syntax
- **Cloud Storage Sync** - Store data in Dropbox, Google Drive, OneDrive, or iCloud
- **System Tray** - Quick access and minimize to tray
- **Global Hotkeys** - Create notes from anywhere
- **Reminders** - Desktop notifications for due dates
- **Version History** - Revert to previous versions
- **Folders & Tags** - Hierarchical organization
- **Full-text Search** - FTS5-powered instant search
- **Voice Transcription** - Local Whisper AI for speech-to-text
- **CLI Integration** - Full automation support with JSON output

## Quick Start

```bash
# Clone and install
git clone https://github.com/01000001-01001110/the_true_stickynotes.git
cd the_true_stickynotes
npm install

# Setup for desktop app
npm run setup:electron

# Start the app
npm start

# Optional: Setup with voice transcription
npm run setup:whisper
```

## Building Installers

```bash
# Windows (NSIS installer + portable)
npm run build:win

# macOS (DMG + ZIP, requires macOS)
npm run build:mac

# Linux (AppImage, DEB, RPM)
npm run build:linux

# All platforms (requires appropriate environment)
npm run build
```

Installers are output to the `dist/` directory.

### Installation Warnings

The app is not code-signed, so you'll see security warnings during installation:

**Windows**: "Windows protected your PC" (SmartScreen)
- Click **"More info"** → **"Run anyway"**

**macOS**: "App is damaged" or "unidentified developer"
- Right-click the app → **"Open"** → **"Open"**
- Or: System Preferences → Security & Privacy → **"Open Anyway"**

**Linux**: No warnings (signing not required)

This is normal for open-source software without paid code signing certificates ($200-400/year for Windows, $99/year for macOS).

### Code Signing (Optional)

To remove security warnings, you need signing certificates:

**Windows** - Code Signing Certificate:
- EV Certificate (~$400/year) - Immediate SmartScreen trust
- Standard Certificate (~$200/year) - Builds reputation over time

**macOS** - Apple Developer Program:
- $99/year membership required
- Notarization required for distribution

Add credentials to `electron-builder.yml`:
```yaml
win:
  certificateFile: ./certs/windows.pfx
  certificatePassword: ${WIN_CSC_KEY_PASSWORD}

mac:
  notarize:
    teamId: YOUR_APPLE_TEAM_ID
```

Set environment variables before building:
```bash
export WIN_CSC_KEY_PASSWORD="your-cert-password"
export APPLE_ID="your@apple.id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

## Cloud Storage

Store your notes in a cloud-synced folder for automatic backup:

1. Open **Settings → Advanced → Data Storage Location**
2. Click **"Change Location..."**
3. Select your cloud folder (Dropbox, Google Drive, OneDrive, iCloud)
4. Restart the app

**Note**: Close the app before cloud sync runs. Avoid editing on multiple devices simultaneously.

## CLI Usage

```bash
# List notes
stickynotes note list --json

# Create a note
stickynotes note create --title "Meeting" --content "Agenda..." --color blue

# Search
stickynotes search "keyword" --json

# Full CLI reference
stickynotes --help
```

See [SKILL.md](./SKILL.md) for complete CLI documentation.

## Project Structure

```
├── electron/           # Main process
│   ├── main.js         # Application entry
│   ├── cli/            # Integrated CLI commands
│   ├── ipc/            # IPC handlers
│   └── windows/        # Window management
├── src/                # Renderer (UI)
│   ├── panel/          # Notes list panel
│   ├── note/           # Note editor window
│   └── settings/       # Settings window
├── shared/             # Shared code
│   ├── database/       # SQLite operations
│   └── utils/          # Validators, paths
├── assets/icons/       # App icons (all platforms)
├── build/              # Build resources
└── test/               # Test suites
```

## Development

```bash
npm run dev           # Development mode with DevTools
npm test              # Run tests
npm run test:coverage # Tests with coverage report
npm run lint          # ESLint
```

## Security

- **AES-256-GCM** encryption for locked notes
- **bcrypt** password hashing (10 rounds)
- **PBKDF2** key derivation (100,000 iterations)

## Data Location

| Platform | Default Path |
|----------|--------------|
| Windows  | `%APPDATA%\StickyNotes\` |
| macOS    | `~/Library/Application Support/StickyNotes/` |
| Linux    | `~/.config/stickynotes/` |

## License

MIT License - see [LICENSE](LICENSE)
