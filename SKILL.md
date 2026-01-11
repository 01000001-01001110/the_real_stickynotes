# StickyNotes CLI Reference

> CLI commands for the StickyNotes desktop application.

## Overview

StickyNotes includes an integrated CLI that operates directly on the SQLite database—no HTTP server required. The CLI shares the same code path as the GUI for consistency.

**Database Location**:
- Windows: `%APPDATA%/StickyNotes/stickynotes.db`
- macOS: `~/Library/Application Support/StickyNotes/stickynotes.db`
- Linux: `~/.config/stickynotes/stickynotes.db`

## Quick Reference

```bash
# List notes as JSON
stickynotes note list --json

# Create a note
stickynotes note create --title "Title" --content "Content"

# Search notes
stickynotes search "keyword" --json

# Show app paths
stickynotes paths
```

## Commands

### Notes

```bash
stickynotes note list [--json] [--folder ID] [--tag NAME] [--archived] [--trash]
stickynotes note show <id> [--json] [--with-tags] [--with-history]
stickynotes note create --title "Title" --content "Content" [--color COLOR] [--folder ID] [--tags "a,b"] [--open]
stickynotes note edit <id> [--title] [--content] [--append TEXT] [--color] [--folder]
stickynotes note delete <id> [--force]    # --force = permanent delete
stickynotes note restore <id>
stickynotes note archive <id>
stickynotes note unarchive <id>
stickynotes note pin <id>
stickynotes note unpin <id>
stickynotes note lock <id> --password PASSWORD
stickynotes note unlock <id> --password PASSWORD
stickynotes note duplicate <id>
stickynotes note history <id> [--limit N]
stickynotes note revert <id> <version-id>
stickynotes note purge [--days N]         # Purge old trash
```

**Colors**: yellow, pink, blue, green, purple, orange, gray, charcoal

### Folders

```bash
stickynotes folder list [--json] [--tree]
stickynotes folder create NAME [--parent ID] [--color COLOR]
stickynotes folder rename <id> NEW_NAME
stickynotes folder move <id> --parent ID  # Use --parent none for root
stickynotes folder delete <id> [--force]
stickynotes folder notes <id>             # List notes in folder
```

### Tags

```bash
stickynotes tag list [--json] [--with-counts]
stickynotes tag add <note-id> <tag-name>
stickynotes tag remove <note-id> <tag-name>
stickynotes tag delete <tag-name>
```

### Search

```bash
stickynotes search "query" [--json] [--folder ID] [--archived] [--trash] [--limit N]
```

Uses FTS5 full-text search.

### Configuration

```bash
stickynotes config list [--json]
stickynotes config get <key>
stickynotes config set <key> <value>
stickynotes config reset [--all] [KEY]
stickynotes config path
```

### Export & Backup

```bash
stickynotes export [--format json|md|html] [--note ID] [--folder ID] [--output PATH]
stickynotes backup [--output PATH]
stickynotes restore <file> [--dry-run]
```

### App Control

```bash
stickynotes app status                # Check if app is running
stickynotes app panel                 # Show notes panel
stickynotes app show [--note ID]      # Show all notes or specific note
stickynotes app hide [--note ID]      # Hide notes
stickynotes app open <id>             # Open note window
stickynotes app close <id>            # Close note window
stickynotes app new [--title] [--content]  # Create and open note
stickynotes app reload                # Reload notes
stickynotes app quit                  # Quit application
```

### Utilities

```bash
stickynotes stats [--json]            # Database statistics
stickynotes doctor                    # Check database integrity
stickynotes db path                   # Show database path
stickynotes db vacuum                 # Compact database
stickynotes paths                     # Show all app paths
stickynotes version
stickynotes --help
```

### Whisper (Voice Transcription)

```bash
stickynotes whisper status [--json]   # Model status
stickynotes whisper list [--json]     # Available models
```

Model management is done through the GUI Settings.

## JSON Output

All commands support `--json` for programmatic output.

### Note Object

```json
{
  "id": "abc123xyz789",
  "title": "Note Title",
  "content": "# Markdown content",
  "content_plain": "Plain text",
  "color": "yellow",
  "folder_id": null,
  "is_pinned": 0,
  "is_locked": 0,
  "is_archived": 0,
  "is_deleted": 0,
  "reminder_at": null,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T12:00:00Z",
  "tags": ["tag1", "tag2"]
}
```

## Storage Location

Data can be stored in a cloud-synced folder (Dropbox, Google Drive, OneDrive, iCloud):

1. Open Settings → Advanced → Data Storage Location
2. Click "Change Location..."
3. Select your cloud folder
4. Data will be migrated to the new location
5. Restart the app

**Note**: Close the app before cloud sync runs. Avoid editing on multiple devices simultaneously.

## Build & Install

```bash
# Development
npm install
npm run setup:electron
npm start

# Build installers
npm run build           # Current platform
npm run build:win       # Windows (NSIS + Portable)

# Cross-platform builds require platform-specific environment
# macOS: DMG + ZIP
# Linux: AppImage, DEB, RPM
```

## Version

CLI Version: 2.0.0
Database Schema: v2 (FTS5 search)
